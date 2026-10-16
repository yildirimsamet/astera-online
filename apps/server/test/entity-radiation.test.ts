import { readHomeHealth } from '../src/services/homeHealth.js';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { HULLS, MONUMENT_SEASON_DEFAULTS, segmentsExposureHp } from '@astera/rules';
import { hpRadiationSources, monuments, monumentShipLots, monumentWaves, notifications, seasons } from '../src/db/schema.js';
import { quoteMonument, sendMonument } from '../src/services/monument.js';
import { advanceMonument } from '../src/services/monumentArrival.js';
import { recallMonument, resolveMonumentReturn } from '../src/services/monumentMovement.js';
import { hpSourcesForSeason, hpRadiationForGalaxy } from '../src/services/radiationSources.js';
import { addHpRadiationSource } from '../src/services/radiation.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let target: typeof monuments.$inferSelect;
beforeEach(async () => {
  f = await seedWorld(1, 20261012);
  await f.db.update(seasons).set({ rulesetVersion: 17 }).where(eq(seasons.id, f.seasonId));
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 6);
  await setLevel(f.db, f.planetIds[0]!, 'HANGAR', 10);
  await grant(f.db, f.planetIds[0]!, 100_000, 100_000);
  await giveUnits(f.db, f.planetIds[0]!, { RAMPART: 2 });
  const [row] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1,
    ...MONUMENT_SEASON_DEFAULTS.positions[0]!, capacity: 100_000, productionPerMinute: 3,
    garrison: {}, settledAt: f.clock.now() }).returning();
  target = row!;
});
afterAll(async () => { await (await testDb()).close(); });

const request = () => ({ senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, monumentId: target.id,
  fleet: { RAMPART: 2 }, purpose: 'ATTACK' as const, acknowledgeShieldLoss: true, clock: f.clock });
async function source(radius: number, intensityHpPerMinute = 1) {
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: target.id,
    x: target.x, y: target.y, z: target.z, radius, mode: 'EMIT', intensityHpPerMinute, activeFrom: f.clock.now() });
}

it('quotes a safe flight through an entity aura and ignores anonymous space zones', async () => {
  await source(100_000);
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE',
    x: 0, y: 0, z: 0, radius: 100_000, mode: 'EMIT', intensityHpPerMinute: 100_000, activeFrom: f.clock.now() });
  const quote = await f.db.transaction(tx => quoteMonument(tx, request()));
  expect(quote.outboundForecast).toMatchObject({ doseHp: 0, destroyed: 0, fleet: { RAMPART: 2 } });
});

it('refuses a new unanchored damage zone before any source or HOLD cursor is changed', async () => {
  await expect(addHpRadiationSource(f.db, { seasonId: f.seasonId, anchor: { kind: 'ZONE', at: { x: 0, y: 0, z: 0 } },
    radius: 1000, intensityHpPerMinute: 5, mode: 'EMIT', label: 'unsupported zone' }, f.clock))
    .rejects.toMatchObject({ code: 'RADIATION_BAD_SOURCE' });
  expect(await f.db.select().from(hpRadiationSources)).toHaveLength(0);
  const [unchanged] = await f.db.select().from(monuments).where(eq(monuments.id, target.id));
  expect(unchanged!.settledAt).toEqual(target.settledAt);
});

it('takes waiting damage from its monument and carries the same wound home without flight damage', async () => {
  // A radius smaller than the visible movement proves HOLD uses identity, not geometry.
  await source(1);
  const sent = await f.db.transaction(tx => sendMonument(tx, request()));
  const arrival = sent.wave.arriveAt!;
  const depart = new Date(arrival.getTime() + 20 * 60_000);
  f.clock.set(depart);
  await f.db.transaction(tx => advanceMonument(tx, { monumentId: target.id, at: depart }));
  const [held] = await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id));
  expect(held!.damageBp + held!.remainderBp).toBeCloseTo(20 / HULLS.RAMPART.hp * 10_000, 6);
  await f.db.transaction(tx => recallMonument(tx, { playerId: f.playerIds[0]!, waveId: sent.wave.id, all: true, clock: f.clock }));
  const [returning] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, sent.wave.id));
  f.clock.set(returning!.arriveAt!);
  const landed = await f.db.transaction(tx => resolveMonumentReturn(tx, { waveId: sent.wave.id, generation: returning!.generation, at: f.clock.now() }));
  // The return settles no additional environmental dose; its parked lots were removed on landing.
  const [home] = await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, sent.wave.id));
  expect(home!.status).toBe('HOME');
  expect(landed?.dock).toMatchObject({ docked: [], autoRepaired: [] });
  expect((await readHomeHealth(f.db, sent.wave.originPlanetId)).damage[0]).toMatchObject({ hull: 'RAMPART', count: 2, damageBp: held!.damageBp, remainderBp: held!.remainderBp });
  const [notice] = (await f.db.select().from(notifications)).filter(row => row.kind === 'fleet_returned');
  expect(notice?.payload).not.toHaveProperty('autoRepaired');
  expect(notice?.payload).not.toHaveProperty('docked');
  expect(await f.db.select().from(monumentShipLots).where(eq(monumentShipLots.waveId, sent.wave.id))).toHaveLength(0);
});

it('attaches a planet source to a waiting segment while ordinary flight remains harmless', async () => {
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: f.planetIds[0]!,
    x: 0, y: 0, z: 0, radius: 100_000, mode: 'EMIT', intensityHpPerMinute: 2, activeFrom: f.clock.now() });
  const sources = await hpSourcesForSeason(f.db, f.seasonId);
  const startMs = f.clock.now().getTime(), point = { x: -6000, y: 6000, z: 0 };
  const segment = { from: point, to: point, startMs, endMs: startMs + 60_000 };
  expect(segmentsExposureHp([segment], sources)).toBe(0);
  expect(segmentsExposureHp([{ ...segment, target: { kind: 'PLANET', id: f.planetIds[0]! } }], sources)).toBe(2);
});

it('publishes entity identity and derives aura motion without a stored trajectory', async () => {
  await source(1000);
  const views = await hpRadiationForGalaxy(f.db, f.seasonId, f.clock.now());
  expect(views[0]).toMatchObject({ target: { kind: 'MONUMENT', id: target.id }, motion: { periodYMs: 8 * 3_600_000, periodXMs: 16 * 3_600_000 } });
  await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
  const legacy = await hpSourcesForSeason(f.db, f.seasonId);
  expect(legacy[0]?.target).toBeUndefined();
  expect(segmentsExposureHp([{ from: target, to: target, startMs: f.clock.now().getTime(), endMs: f.clock.now().getTime() + 60_000 }], legacy)).toBe(1);
});
