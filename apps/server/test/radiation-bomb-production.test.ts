import { afterAll, beforeEach, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { RADIATION_BOMB, radiationBombBuildSeconds } from '@astera/rules';
import { buildOrders, planets, radiationBombFlights, scheduledEvents, seasons, strategicAssets } from '../src/db/schema.js';
import { buildRadiationBomb } from '../src/services/radiationBomb.js';
import { abandonDeathStarBuild, finishDeathStarBuild } from '../src/services/strategic.js';
import { grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';
import { recomputePlayerWealth } from '../src/services/planet.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { ownedHonorNavy } from '../src/services/honorNavy.js';
import { honorSeasons } from '../src/db/schema.js';

let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(1);
  await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now(), rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 13);
  await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 5);
  await grant(f.db, f.planetIds[0]!, 500000, 500000);
  await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, f.planetIds[0]!));
});
afterAll(async () => { await (await testDb()).close(); });
const build = (level: 1 | 2 | 3) => buildRadiationBomb(f.db, f.planetIds[0]!, level, f.clock, f.playerIds[0]);

it('builds all three levels in parallel with exact invoices, deadlines and no ordinary queue occupation', async () => {
  const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  for (const level of [1, 2, 3] as const) {
    const result = await build(level);
    expect(result.readyAt.getTime() - f.clock.now().getTime()).toBe(radiationBombBuildSeconds(level) * 1000);
    const [asset] = await f.db.select().from(strategicAssets).where(eq(strategicAssets.id, result.assetId));
    expect(asset).toMatchObject({ type: RADIATION_BOMB.levels[level].type, status: 'BUILDING', startedAt: f.clock.now(), remainingSeconds: radiationBombBuildSeconds(level) });
    const [event] = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.refId, result.assetId));
    expect(event).toMatchObject({ kind: 'death_star_ready', resolveAt: result.readyAt });
  }
  const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect(after!.alloy).toBeCloseTo(before!.alloy - 120000);
  expect(after!.crystal).toBeCloseTo(before!.crystal - 83000);
  expect(after!.deuterium).toBeCloseTo(before!.deuterium - 7500);
  expect(await f.db.select().from(buildOrders)).toHaveLength(0);
});

it('serializes competing production requests into exactly one occupied slot', async () => {
  const results = await Promise.allSettled([build(1), build(1)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(await f.db.select().from(strategicAssets).where(eq(strategicAssets.type, 'RADIATION_BOMB_L1'))).toHaveLength(1);
});

it('keeps BUILDING, PAUSED, READY and LAUNCHED assets in their slot and frees only a terminal asset', async () => {
  const first = await build(2);
  const [asset] = await f.db.select().from(strategicAssets).where(eq(strategicAssets.id, first.assetId));
  for (const status of ['BUILDING', 'PAUSED', 'READY', 'LAUNCHED'] as const) {
    await f.db.update(strategicAssets).set({ status }).where(eq(strategicAssets.id, first.assetId));
    await expect(build(2)).rejects.toMatchObject({ code: 'RADIATION_BOMB_EXISTS' });
  }
  await f.db.insert(radiationBombFlights).values({ assetId: first.assetId, seasonId: f.seasonId,
    ownerPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, targetKind: 'PLANET',
    targetPlanetId: f.planetIds[0]!, level: 2, departAt: f.clock.now(), arriveAt: first.readyAt,
    originPosition: { x: 0, y: 0, z: 0 }, targetPosition: { x: 1, y: 0, z: 0 } });
  await f.db.update(strategicAssets).set({ status: 'CONSUMED' }).where(eq(strategicAssets.id, asset!.id));
  expect((await build(2)).assetId).not.toBe(first.assetId);
});

it('refuses pre-adoption seasons, missing gates, wrong ownership and insufficient funds without placing an asset', async () => {
  await f.db.update(seasons).set({ radiationBombStartsAt: null }).where(eq(seasons.id, f.seasonId));
  await expect(build(1)).rejects.toMatchObject({ code: 'RADIATION_BOMB_UNAVAILABLE' });
  await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now(), rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 12);
  await expect(build(1)).rejects.toMatchObject({ code: 'RADIATION_BOMB_LOCKED' });
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 13);
  await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 4);
  await expect(build(1)).rejects.toMatchObject({ code: 'RADIATION_BOMB_LOCKED' });
  await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 5);
  await expect(buildRadiationBomb(f.db, f.planetIds[0]!, 1, f.clock, f.accountIds[0])).rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
  await f.db.update(planets).set({ alloy: 0 }).where(eq(planets.id, f.planetIds[0]!));
  await expect(build(1)).rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
  expect(await f.db.select().from(strategicAssets)).toHaveLength(0);
});

it('completes once through the existing ready transition and never resurrects a consumed bomb', async () => {
  const result = await build(3);
  await f.db.transaction(async tx => {
    expect(await finishDeathStarBuild(tx, result.assetId, result.readyAt.toISOString())).toHaveLength(1);
    expect(await finishDeathStarBuild(tx, result.assetId, result.readyAt.toISOString())).toHaveLength(0);
  });
  await f.db.update(strategicAssets).set({ status: 'CONSUMED' }).where(eq(strategicAssets.id, result.assetId));
  expect(await f.db.transaction(tx => finishDeathStarBuild(tx, result.assetId, result.readyAt.toISOString()))).toHaveLength(0);
});

it('returns only the correct bomb invoice once when its production permanently fails', async () => {
  const result = await build(1);
  const [before] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect(await abandonDeathStarBuild(f.db, result.assetId, f.clock)).toBe(true);
  expect(await abandonDeathStarBuild(f.db, result.assetId, f.clock)).toBe(false);
  const [after] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect(after!.alloy - before!.alloy).toBeCloseTo(RADIATION_BOMB.levels[1].cost.alloy);
  expect(after!.crystal - before!.crystal).toBeCloseTo(RADIATION_BOMB.levels[1].cost.crystal);
  expect(after!.deuterium - before!.deuterium).toBeCloseTo(RADIATION_BOMB.levels[1].cost.deuterium);
  expect(await f.db.select().from(strategicAssets).where(and(eq(strategicAssets.id, result.assetId), eq(strategicAssets.status, 'CONSUMED')))).toHaveLength(1);
});

it('values stored and launched bombs at their own price without changing the frozen Honor catalogue', async () => {
  const value = () => f.db.transaction(tx => recomputePlayerWealth(tx, f.playerIds[0]!, f.clock.now()));
  const before = await value();
  const result = await build(1);
  expect(await value()).toBeCloseTo(before);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, result.assetId));
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 2));
  const [config] = await f.db.select().from(honorSeasons);
  expect(await ownedHonorNavy(f.db, f.playerIds[0]!, config!)).toBe(0);
  await f.db.insert(radiationBombFlights).values({ assetId: result.assetId, seasonId: f.seasonId,
    ownerPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, targetKind: 'PLANET',
    targetPlanetId: f.planetIds[0]!, level: 1, departAt: f.clock.now(), arriveAt: result.readyAt,
    originPosition: { x: 0, y: 0, z: 0 }, targetPosition: { x: 1, y: 0, z: 0 } });
  await f.db.update(strategicAssets).set({ status: 'LAUNCHED' }).where(eq(strategicAssets.id, result.assetId));
  expect(await value()).toBeCloseTo(before);
  await f.db.update(strategicAssets).set({ status: 'CONSUMED' }).where(eq(strategicAssets.id, result.assetId));
  expect(await value()).toBeCloseTo(before - 52000);
});

it('keeps ready bombs outside an existing frozen Honor military catalogue', async () => {
  const result = await build(1);
  await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, result.assetId));
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 2));
  const [config] = await f.db.select().from(honorSeasons);
  expect(await ownedHonorNavy(f.db, f.playerIds[0]!, config!)).toBe(0);
});
