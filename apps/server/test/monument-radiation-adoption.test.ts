import { afterAll, beforeEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { segmentsExposureHp } from '@astera/rules';
import { hpRadiationSources, monuments, monumentWaves, playerResearch, seasons } from '../src/db/schema.js';
import { activateMonumentRadiation } from '../src/services/monumentRadiationAdoption.js';
import { hpRadiationForGalaxy, hpSourcesForSeason } from '../src/services/radiationSources.js';
import { loadLocked } from '../src/services/planet.js';
import { researchView } from '../src/services/researchState.js';
import { completeResearch } from '../src/services/research.js';
import { sendMonument } from '../src/services/monument.js';
import { launchMonumentProbe } from '../src/services/monumentProbe.js';
import { giveResearch, giveUnits, grant, seedWorld, setLevel, settleBuilds, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let target: typeof monuments.$inferSelect;
beforeEach(async () => {
  f = await seedWorld(1, 20261012);
  await f.db.update(seasons).set({ rulesetVersion: 16, monumentMotionStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 10);
  await setLevel(f.db, f.planetIds[0]!, 'HANGAR', 10);
  await grant(f.db, f.planetIds[0]!, 100_000, 100_000);
  await giveUnits(f.db, f.planetIds[0]!, { RAMPART: 3 });
  const [row] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1, difficulty: 'HARD',
    x: 6000, y: 0, z: 0, capacity: 100_000, garrison: {}, productionPerMinute: 8, settledAt: f.clock.now() }).returning();
  target = row!;
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: target.id,
    x: target.x, y: target.y, z: target.z, radius: 1000, mode: 'EMIT', radiationLevel: 2,
    intensityHpPerMinute: 5, activeFrom: f.clock.now(), label: 'Monument 1 cloud' });
});
afterAll(async () => { await (await testDb()).close(); });
const activate = (apply = true) => activateMonumentRadiation(f.db, { seasonId: f.seasonId, clock: f.clock, apply });
const view = () => f.db.transaction(async tx => researchView(tx, await loadLocked(tx, f.planetIds[0]!, f.clock)));

it('previews without changing rates, season or research availability', async () => {
  const old = await f.db.select().from(hpRadiationSources);
  expect(await activate(false)).toMatchObject({ status: 'READY', applied: false, monuments: 1 });
  expect(await f.db.select().from(hpRadiationSources)).toEqual(old);
  expect((await view()).some(row => row.id === 'RADIATION_SHIELDING')).toBe(false);
});

it('backfills only authored legacy base levels without repricing rates or historical windows', async () => {
  await f.db.update(hpRadiationSources).set({ radiationLevel: null }).where(eq(hpRadiationSources.seasonId, f.seasonId));
  const [easy] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 5, difficulty: 'EASY',
    x: -6000, y: 0, z: 0, capacity: 1550, productionPerMinute: 3, settledAt: f.clock.now() }).returning();
  await f.db.insert(hpRadiationSources).values([
    { seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: easy!.id, x: -6000, y: 0, z: 0, radius: 1000,
      mode: 'EMIT', intensityHpPerMinute: 2, activeFrom: f.clock.now(), label: 'Monument 5 cloud' },
    { seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: target.id, x: 6000, y: 0, z: 0, radius: 1000,
      mode: 'EMIT', intensityHpPerMinute: 5, activeFrom: f.clock.now(), label: 'Custom five' },
    { seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: target.id, x: 6000, y: 0, z: 0, radius: 1000,
      mode: 'SHELTER', intensityHpPerMinute: 5, activeFrom: f.clock.now(), label: 'Monument 1 cloud' },
    { seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: target.id, x: 6000, y: 0, z: 0, radius: 1000,
      mode: 'EMIT', intensityHpPerMinute: 4, activeFrom: f.clock.now(), label: 'Monument 1 cloud' },
  ]);
  const before = await f.db.select().from(hpRadiationSources);
  const update = readFileSync(new URL('../drizzle/0155_monument_radiation_shielding.sql', import.meta.url), 'utf8')
    .split('--> statement-breakpoint').find(statement => statement.includes('UPDATE "hp_radiation_sources"'));
  if (!update) throw new Error('Missing source level backfill');
  await f.db.execute(sql.raw(update));
  const after = await f.db.select().from(hpRadiationSources);
  for (const old of before) {
    const current = after.find(row => row.id === old.id)!;
    const expectedLevel = old.mode === 'EMIT' && old.label === 'Monument 1 cloud' && old.intensityHpPerMinute === 5 ? 2
      : old.label === 'Monument 5 cloud' ? 1 : null;
    expect(current).toEqual({ ...old, radiationLevel: expectedLevel });
  }
});

it('opens shielding and new rates atomically while preserving historical exposure and other rules', async () => {
  const from = f.clock.now().getTime();
  f.clock.advance(1);
  const at = f.clock.now();
  expect(await activate()).toMatchObject({ applied: true, startsAt: at });
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  expect(season).toMatchObject({ rulesetVersion: 16, monumentRadiationStartsAt: at });
  const sources = await hpSourcesForSeason(f.db, f.seasonId);
  expect(segmentsExposureHp([{ from: target, to: target, startMs: from, endMs: at.getTime() + 60_000,
    target: { kind: 'MONUMENT', id: target.id } }], sources)).toBeCloseTo(17.5, 9);
  expect((await view()).find(row => row.id === 'RADIATION_SHIELDING')).toMatchObject({ maxLevel: 4, available: true });
  expect((await f.db.select().from(monuments))[0]).toEqual(target);
  const current = (await hpRadiationForGalaxy(f.db, f.seasonId, at)).find(row => row.activeUntil === null);
  expect(current).toMatchObject({ level: 2, intensityHpPerMinute: 12.5 });
  expect(await activate()).toMatchObject({ status: 'ALREADY_ACTIVE', applied: false, startsAt: at });
});

it('serializes duplicate activations without duplicating base sources', async () => {
  const result = await Promise.all([activate(), activate()]);
  expect(result.filter(row => row.applied)).toHaveLength(1);
  expect(await f.db.select().from(hpRadiationSources).where(isNull(hpRadiationSources.activeUntil))).toHaveLength(1);
});

it.each(['OUTBOUND', 'HOLD', 'RETURNING'] as const)('refuses a %s fleet without changing fuel or history', async status => {
  const sent = await f.db.transaction(tx => sendMonument(tx, { senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    monumentId: target.id, fleet: { RAMPART: 1 }, purpose: 'ATTACK', acknowledgeShieldLoss: true, clock: f.clock }));
  const [before] = await f.db.update(monumentWaves).set({ status, heldAt: status === 'HOLD' ? f.clock.now() : null,
    returnReason: status === 'RETURNING' ? 'RECALLED' : null }).where(eq(monumentWaves.id, sent.wave.id)).returning();
  expect(await activate()).toMatchObject({ status: 'BUSY', applied: false, fleets: 1 });
  expect((await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, sent.wave.id)))[0]).toEqual(before);
});

it('serializes dispatch with calibration so a new contract sees one complete source configuration', async () => {
  const [activation, sent] = await Promise.all([activate(), f.db.transaction(tx => sendMonument(tx, {
    senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, monumentId: target.id,
    fleet: { RAMPART: 1 }, purpose: 'ATTACK', acknowledgeShieldLoss: true, clock: f.clock,
  }))]);
  expect(activation.status === 'READY' || activation.status === 'BUSY').toBe(true);
  expect(sent.quote.radiationProtection.hpPerMinute).toBe(activation.applied ? 12.5 : 5);
  const current = await f.db.select().from(hpRadiationSources).where(isNull(hpRadiationSources.activeUntil));
  expect(current).toHaveLength(1);
  expect(current[0]?.intensityHpPerMinute).toBe(activation.applied ? 12.5 : 5);
});

it('refuses a travelling probe even when no fleet is stationed at a monument', async () => {
  await f.db.transaction(tx => launchMonumentProbe(tx, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, monumentId: target.id, clock: f.clock }));
  expect(await activate()).toMatchObject({ status: 'BUSY', applied: false, probes: 1 });
});

it('leaves extra unlevelled sources intact and shows explicit source levels independently of intensity', async () => {
  const [extra] = await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: target.id,
    x: target.x, y: target.y, z: target.z, radius: 1000, mode: 'EMIT', intensityHpPerMinute: 3, activeFrom: f.clock.now(), label: 'Extra dose' }).returning();
  await activate();
  expect((await f.db.select().from(hpRadiationSources).where(eq(hpRadiationSources.id, extra!.id)))[0]).toEqual(extra);
  expect((await hpRadiationForGalaxy(f.db, f.seasonId, f.clock.now())).find(row => row.id === extra!.id)).not.toHaveProperty('level');
});

it('refuses a missing base source and rolls back all changes', async () => {
  await f.db.delete(hpRadiationSources).where(eq(hpRadiationSources.seasonId, f.seasonId));
  await expect(activate()).rejects.toMatchObject({ code: 'MONUMENT_RADIATION_INVALID' });
  expect((await f.db.select().from(seasons))[0]?.monumentRadiationStartsAt).toBeNull();
});

it('recognizes an authored old-image base source created after the metadata migration', async () => {
  await f.db.update(hpRadiationSources).set({ radiationLevel: null }).where(eq(hpRadiationSources.seasonId, f.seasonId));
  const [extra] = await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: target.id,
    x: target.x, y: target.y, z: target.z, radius: 1000, mode: 'EMIT', intensityHpPerMinute: 5, activeFrom: f.clock.now(), label: 'Custom five' }).returning();
  expect(await activate()).toMatchObject({ applied: true });
  expect((await f.db.select().from(hpRadiationSources).where(eq(hpRadiationSources.id, extra!.id)))[0]).toEqual(extra);
  const current = await f.db.select().from(hpRadiationSources).where(and(isNull(hpRadiationSources.activeUntil), eq(hpRadiationSources.radiationLevel, 2)));
  expect(current).toHaveLength(1);
  expect(current[0]?.intensityHpPerMinute).toBe(12.5);
});

it.each(['duplicate', 'wrong-level', 'future'] as const)('refuses a %s base source without opening research', async problem => {
  const [base] = await f.db.select().from(hpRadiationSources);
  if (problem === 'duplicate') await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: target.id,
    x: target.x, y: target.y, z: target.z, radius: 1000, mode: 'EMIT', radiationLevel: 2, intensityHpPerMinute: 5, activeFrom: f.clock.now() });
  else await f.db.update(hpRadiationSources).set(problem === 'wrong-level' ? { radiationLevel: 1 }
    : { activeFrom: new Date(f.clock.now().getTime() + 60_000) }).where(eq(hpRadiationSources.id, base!.id));
  await expect(activate()).rejects.toMatchObject({ code: 'MONUMENT_RADIATION_INVALID' });
  expect((await view()).some(row => row.id === 'RADIATION_SHIELDING')).toBe(false);
  expect((await f.db.select().from(hpRadiationSources)).every(row => row.activeUntil === null)).toBe(true);
});

it('requires entity radiation first and an open live season', async () => {
  await f.db.update(seasons).set({ monumentMotionStartsAt: null }).where(eq(seasons.id, f.seasonId));
  await expect(activate()).rejects.toMatchObject({ code: 'MONUMENT_MOTION_REQUIRED' });
  await f.db.update(seasons).set({ monumentMotionStartsAt: f.clock.now(), status: 'frozen' }).where(eq(seasons.id, f.seasonId));
  await expect(activate()).rejects.toMatchObject({ code: 'SEASON_FROZEN' });
});

it('uses the normal research queue and freezes shielding into the dispatched wave', async () => {
  await activate();
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 2);
  await expect(completeResearch(f.db, f.planetIds[0]!, 'RADIATION_SHIELDING', f.clock)).rejects.toMatchObject({ code: 'RESEARCH_UNAVAILABLE' });
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 8);
  await completeResearch(f.db, f.planetIds[0]!, 'RADIATION_SHIELDING', f.clock);
  await giveResearch(f.db, f.planetIds[0]!, 'RADIATION_SHIELDING', 2);
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 10);
  const sent = await f.db.transaction(tx => sendMonument(tx, { senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    monumentId: target.id, fleet: { RAMPART: 1 }, purpose: 'ATTACK', acknowledgeShieldLoss: true, clock: f.clock }));
  await giveResearch(f.db, f.planetIds[0]!, 'RADIATION_SHIELDING', 4);
  const [wave] = await f.db.select().from(monumentWaves).where(and(eq(monumentWaves.id, sent.wave.id), eq(monumentWaves.playerId, f.playerIds[0]!)));
  expect(wave?.tech.RADIATION_SHIELDING).toBe(2);
});

it('completes all four paid levels through real research events and caps the fifth', async () => {
  await activate();
  for (let level = 1; level <= 4; level++) {
    await completeResearch(f.db, f.planetIds[0]!, 'RADIATION_SHIELDING', f.clock);
    await settleBuilds(f, f.planetIds[0]);
    const [held] = await f.db.select().from(playerResearch).where(and(eq(playerResearch.playerId, f.playerIds[0]!),
      eq(playerResearch.projectId, 'RADIATION_SHIELDING')));
    expect(held?.level).toBe(level);
  }
  expect((await view()).find(row => row.id === 'RADIATION_SHIELDING')).toMatchObject({ level: 4, completed: true });
  await expect(completeResearch(f.db, f.planetIds[0]!, 'RADIATION_SHIELDING', f.clock)).rejects.toMatchObject({ code: 'RESEARCH_ALREADY_COMPLETE' });
});
