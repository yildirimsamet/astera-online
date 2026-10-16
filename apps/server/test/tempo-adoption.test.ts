import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { ANTI_STRATEGIC, DEATH_STAR, TRADE } from '@astera/rules';
import { asteroidSpawnHours, buildOrders, galaxyEventOccurrences, notifications, pirateRaids, planets, seasons, strategicAssets, tradeRuns } from '../src/db/schema.js';
import { activateTempoSlowdown } from '../src/services/tempoAdoption.js';
import { loadPirateSnapshot } from '../src/services/pirateField.js';
import { activeGalaxyEvents, notifyActiveGalaxyEventsForPlayer, processGalaxyEventLifecycle, tradeShipOccurrence } from '../src/services/galaxyEvents.js';
import { buildDeathStar, buildInterceptor } from '../src/services/strategic.js';
import { upgradeBuilding } from '../src/services/build.js';
import { loadLocked } from '../src/services/planet.js';
import { standingAt } from '../src/services/intel.js';
import * as stream from '../src/stream/bus.js';
import { giveInstrument, giveResearch, giveSatellite, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(1, 20261013, { pirates: true });
  await f.db.update(seasons).set({ tempoStartsAt: null }).where(eq(seasons.id, f.seasonId));
  f.clock.advance(120);
});
afterAll(async () => { await (await testDb()).close(); });
const activate = (apply = true) => activateTempoSlowdown(f.db, { seasonId: f.seasonId, clock: f.clock, apply });
const season = async () => (await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId)))[0]!;
const merchant = async () => {
  const [row] = await f.db.insert(galaxyEventOccurrences).values({
    seasonId: f.seasonId, kind: 'TRADE_SHIP', sequence: 100_001,
    startsAt: new Date(f.clock.now().getTime() - 60_000),
    endsAt: new Date(f.clock.now().getTime() + 60 * 60_000),
    definitionVersion: 1, effect: { rate: TRADE.rate },
  }).returning();
  return row!;
};

it('previews without touching the season, NPCs or their calendar', async () => {
  const before = await season();
  expect(await activate(false)).toMatchObject({ status: 'READY', applied: false });
  expect(await season()).toEqual(before);
});

it('records an idempotent cutover without changing unrelated rules or historical event rows', async () => {
  const before = await season();
  const event = await merchant();
  expect(await activate()).toMatchObject({ status: 'READY', applied: true, startsAt: f.clock.now() });
  expect((await season()).rulesetVersion).toBe(before.rulesetVersion);
  expect((await season()).tempoStartsAt).toEqual(f.clock.now());
  expect(await activate()).toMatchObject({ status: 'ALREADY_ACTIVE', applied: false });
  expect((await f.db.select().from(galaxyEventOccurrences).where(eq(galaxyEventOccurrences.id, event.id)))[0]).toEqual(event);
});

it('removes current merchants from both publication and new dispatch, preserving future windows', async () => {
  const current = await merchant();
  const [future] = await f.db.insert(galaxyEventOccurrences).values({
    ...current, id: undefined, sequence: 100_002,
    startsAt: new Date(f.clock.now().getTime() + 60 * 60_000),
    endsAt: new Date(f.clock.now().getTime() + 120 * 60_000),
  }).returning();
  expect(await tradeShipOccurrence(f.db, f.seasonId, current.id)).not.toBeNull();
  await activate();
  expect(await tradeShipOccurrence(f.db, f.seasonId, current.id)).toBeNull();
  expect(await tradeShipOccurrence(f.db, f.seasonId, future!.id)).not.toBeNull();
  const visible = await activeGalaxyEvents(f.db, f.accountIds[0]!, f.clock);
  expect(visible.some(row => row.id === current.id)).toBe(false);
});

it('refreshes public NPC events as well as fleets and the economy on activation', async () => {
  const published = vi.spyOn(stream, 'publishShard');
  try {
    await activate();
    const kinds = published.mock.calls.map(([, , kind]) => kind);
    expect(kinds).toContain('control');
    expect(kinds).toContain('galaxy-event');
  } finally { published.mockRestore(); }
});

it.each([1, 16])('retires visible pirates and refuses old handles in ruleset %i', async (rulesetVersion) => {
  await f.db.update(seasons).set({ rulesetVersion }).where(eq(seasons.id, f.seasonId));
  await f.db.insert(asteroidSpawnHours).values({
    seasonId: f.seasonId, hourStartsAt: (await season()).startsAt,
    spawnFrom: (await season()).startsAt,
    activePlayers: 1, lanes: [], pirateLane: { fromMinute: 0, untilMinute: 60, count: 10 },
  }).onConflictDoUpdate({ target: [asteroidSpawnHours.seasonId, asteroidSpawnHours.hourStartsAt],
    set: { pirateLane: { fromMinute: 0, untilMinute: 60, count: 10 } } });
  const before = await loadPirateSnapshot(f.db, f.seasonId, f.clock.now());
  const old = before.standing(f.clock.now());
  expect(old.length).toBeGreaterThan(0);
  await activate();
  const after = await loadPirateSnapshot(f.db, f.seasonId, f.clock.now());
  expect(after.standing(f.clock.now())).toEqual([]);
  for (const spec of old) expect(after.spec(spec.index)).toBeUndefined();
});

it.each(['outbound', 'returning'] as const)('blocks active pirate raids in %s, leaving all state intact', async (status) => {
  const [raid] = await f.db.insert(pirateRaids).values({
    seasonId: f.seasonId, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
    pirateIndex: 0, status, fleet: { DART: 1 }, interceptX: 0, interceptY: 0, interceptZ: 0,
    departAt: f.clock.now(), arriveAt: new Date(f.clock.now().getTime() + 60_000),
  }).returning();
  expect(await activate()).toMatchObject({ status: 'BUSY', applied: false, pirateRaids: 1 });
  expect((await season()).tempoStartsAt).toBeNull();
  expect((await f.db.select().from(pirateRaids).where(eq(pirateRaids.id, raid!.id)))[0]).toEqual(raid);
});

it.each(['outbound', 'returning'] as const)('blocks active merchant convoys in %s', async (status) => {
  const event = await merchant();
  await f.db.insert(tradeRuns).values({
    seasonId: f.seasonId, occurrenceId: event.id, planetId: f.planetIds[0]!, ownerPlayerId: f.playerIds[0]!,
    status, fleet: { COURIER: 1 }, give: { alloy: 1, crystal: 0, deuterium: 0 },
    want: { alloy: 0, crystal: 1, deuterium: 0 }, rate: TRADE.rate,
    interceptX: 0, interceptY: 0, interceptZ: 0,
    departAt: f.clock.now(), arriveAt: new Date(f.clock.now().getTime() + 60_000),
  });
  expect(await activate()).toMatchObject({ status: 'BUSY', applied: false, tradeRuns: 1 });
  expect((await season()).tempoStartsAt).toBeNull();
});

it('serializes simultaneous activations without resetting the cutover', async () => {
  const results = await Promise.all([activate(), activate()]);
  expect(results.filter(row => row.applied)).toHaveLength(1);
  expect(results.filter(row => row.status === 'ALREADY_ACTIVE')).toHaveLength(1);
});

it('preserves earned production in owner reads, probe reads and productive-time telemetry', async () => {
  const start = (await season()).startsAt;
  await f.db.update(planets).set({ bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0, lastTickAt: start })
    .where(eq(planets.id, f.planetIds[0]!));
  f.clock.set(new Date(start.getTime() + 60 * 60_000));
  await activate();
  f.clock.advance(60);
  const [raw] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  const spy = await f.db.transaction(tx => standingAt(tx, raw!, f.clock.now()));
  expect(spy.bufferAlloy).toBeCloseTo(87.5 + 70, 8);
  const owner = await f.db.transaction(tx => loadLocked(tx, f.planetIds[0]!, f.clock));
  expect(owner.bufferAlloy).toBeCloseTo(87.5 + 70, 8);
  const [saved] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  expect(saved!.seasonTelemetry.productiveSeconds).toBeCloseTo(7200, 6);
});

it('preserves already-paid queue deadlines and committed work at adoption', async () => {
  await upgradeBuilding(f.db, f.planetIds[0]!, 'CORE', f.clock);
  const before = await f.db.select().from(buildOrders);
  expect(before).toHaveLength(1);
  await activate();
  expect(await f.db.select().from(buildOrders)).toEqual(before);
});

it('does not advertise a retired merchant to a new player or a delayed lifecycle worker', async () => {
  const current = await merchant();
  await activate();
  await processGalaxyEventLifecycle(f.db, { occurrenceId: current.id, seasonId: f.seasonId,
    lifecycle: 'start', processedAt: f.clock.now() });
  await f.db.transaction(tx => notifyActiveGalaxyEventsForPlayer(tx, {
    seasonId: f.seasonId, playerId: f.playerIds[0]!, at: f.clock.now(),
  }));
  expect((await f.db.select().from(notifications)).some(row => row.refId === current.id)).toBe(false);
});

it.each(['DEATH_STAR', 'INTERCEPTOR'] as const)('stores %s production in whole seconds with a matching deadline', async (kind) => {
  const origin = f.planetIds[0]!;
  await setLevel(f.db, origin, 'CORE', 16);
  await setLevel(f.db, origin, 'SHIPYARD', 5);
  await giveSatellite(f.db, origin, 'UPLINK');
  await giveInstrument(f.db, origin, 'RADAR', ANTI_STRATEGIC.requiredRadar);
  await giveResearch(f.db, origin, 'INTERCEPTION_GRID', 1);
  await grant(f.db, origin, 100_000, 100_000);
  await f.db.update(planets).set({ deuterium: 100_000 }).where(eq(planets.id, origin));
  const result = kind === 'DEATH_STAR' ? await buildDeathStar(f.db, origin, f.clock)
    : await buildInterceptor(f.db, origin, f.clock);
  const [saved] = await f.db.select().from(strategicAssets).where(eq(strategicAssets.id, result.assetId));
  const seconds = Math.ceil((kind === 'DEATH_STAR' ? DEATH_STAR : ANTI_STRATEGIC).buildMinutes * 60);
  expect(saved!.remainingSeconds).toBe(seconds);
  expect(result.readyAt.getTime() - f.clock.now().getTime()).toBe(seconds * 1000);
});

it('refuses ended or not-yet-open seasons', async () => {
  const row = await season();
  f.clock.set(new Date(row.endsAt.getTime()));
  await expect(activate()).rejects.toMatchObject({ code: 'SEASON_FROZEN' });
  f.clock.set(new Date(row.startsAt.getTime() - 1));
  await expect(activate()).rejects.toMatchObject({ code: 'SEASON_FROZEN' });
});

it('deals a newly created season at the new tempo from its first instant', async () => {
  const fresh = await seedWorld(1, 20261014);
  const [row] = await fresh.db.select().from(seasons).where(eq(seasons.id, fresh.seasonId));
  expect(row!.tempoStartsAt).toEqual(row!.startsAt);
});
