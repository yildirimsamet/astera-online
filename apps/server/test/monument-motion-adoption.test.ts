import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { distance, segmentsExposureHp } from '@astera/rules';
import { monuments, monumentWaves, seasons } from '../src/db/schema.js';
import { activateMonumentMotion } from '../src/services/monumentMotionAdoption.js';
import { monumentPosition } from '../src/services/monumentMotion.js';
import { sendMonument } from '../src/services/monument.js';
import { launchMonumentProbe } from '../src/services/monumentProbe.js';
import { hpSourcesForSeason } from '../src/services/radiationSources.js';
import { hpRadiationSources } from '../src/db/schema.js';
import * as stream from '../src/stream/bus.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let target: typeof monuments.$inferSelect;
beforeEach(async () => {
  f = await seedWorld(1, 20261012);
  await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
  await setLevel(f.db, f.planetIds[0]!, 'CORE', 8);
  await setLevel(f.db, f.planetIds[0]!, 'HANGAR', 10);
  await grant(f.db, f.planetIds[0]!, 100_000, 100_000);
  await giveUnits(f.db, f.planetIds[0]!, { RAMPART: 3 });
  const [row] = await f.db.insert(monuments).values({ seasonId: f.seasonId, ordinal: 1,
    x: 6000, y: 0, z: 0, capacity: 100_000, garrison: {}, productionPerMinute: 3, settledAt: f.clock.now() }).returning();
  target = row!;
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: target.id,
    x: target.x, y: target.y, z: target.z, radius: 1000, mode: 'EMIT', intensityHpPerMinute: 1, activeFrom: f.clock.now() });
});
afterAll(async () => { await (await testDb()).close(); });
const activate = (apply = true) => activateMonumentMotion(f.db, { seasonId: f.seasonId, clock: f.clock, apply, adminUsernames: [] });

it('starts an active season from its current coordinates and does not change its other rules', async () => {
  f.clock.advance(60);
  const at = f.clock.now();
  expect(await activate()).toMatchObject({ applied: true, startsAt: at });
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  expect(season!.rulesetVersion).toBe(16);
  expect(distance(monumentPosition(target, season!, at), target)).toBeLessThan(1e-7);
  expect(distance(monumentPosition(target, season!, new Date(at.getTime() + 3_600_000)), target)).toBeGreaterThan(1000);
  expect(await activate()).toMatchObject({ applied: false, status: 'ALREADY_ACTIVE', startsAt: at });
});

it('previews without writing a phase, a wave, or radiation history', async () => {
  const [before] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  expect(await activate(false)).toMatchObject({ applied: false, status: 'READY' });
  expect((await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId)))[0]).toEqual(before);
});

it('refreshes open monument panels and traffic projections on a live cutover', async () => {
  const published = vi.spyOn(stream, 'publishShard');
  try {
    await activate();
    // control refreshes monuments, galaxy and traffic; world omits the first and last.
    expect(published.mock.calls.map(([, seasonId, event]) => ({ seasonId, event })))
      .toContainEqual({ seasonId: f.seasonId, event: 'control' });
  } finally { published.mockRestore(); }
});

it('refuses active outbound contracts without changing their route, event or fuel', async () => {
  const old = await f.db.transaction(tx => sendMonument(tx, { senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    monumentId: target.id, fleet: { RAMPART: 1 }, purpose: 'ATTACK', acknowledgeShieldLoss: true, clock: f.clock }));
  f.clock.advance(1);
  expect(await activate()).toMatchObject({ applied: false, status: 'BUSY', fleets: 1 });
  expect((await f.db.select().from(monumentWaves).where(eq(monumentWaves.id, old.wave.id)))[0]).toEqual(old.wave);
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  expect(season!.monumentMotionStartsAt).toBeNull();
});

it('keeps pre-cutover exposure and removes only post-cutover flight dose', async () => {
  const first = f.clock.now().getTime();
  f.clock.advance(1);
  const activation = await activate();
  const sources = await hpSourcesForSeason(f.db, f.seasonId);
  const path = { from: target, to: target, startMs: first, endMs: activation.startsAt.getTime() + 60_000 };
  expect(segmentsExposureHp([path], sources)).toBeCloseTo(1, 10);
  expect(segmentsExposureHp([{ ...path, target: { kind: 'MONUMENT', id: target.id } }], sources)).toBeCloseTo(2, 10);
});

it('rejects an activation clock before the season begins', async () => {
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  f.clock.set(new Date(season!.startsAt.getTime() - 1));
  await expect(activate()).rejects.toMatchObject({ code: 'SEASON_FROZEN' });
});

it('refuses activation while a probe is travelling even if no fleet holds a monument', async () => {
  await f.db.transaction(tx => launchMonumentProbe(tx, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
    monumentId: target.id, clock: f.clock }));
  expect(await activate()).toMatchObject({ applied: false, status: 'BUSY', fleets: 0, probes: 1 });
});

it('serializes two activations without resetting the orbital epoch', async () => {
  const result = await Promise.all([activate(), activate()]);
  expect(result.filter(row => row.applied)).toHaveLength(1);
  expect(result.filter(row => row.status === 'ALREADY_ACTIVE')).toHaveLength(1);
  expect(result[0].startsAt).toEqual(result[1].startsAt);
});

it('serializes dispatch with activation so no static route can be introduced after the cutover', async () => {
  const [activation, sent] = await Promise.all([activate(), f.db.transaction(tx => sendMonument(tx, {
    senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, monumentId: target.id,
    fleet: { RAMPART: 1 }, purpose: 'ATTACK', acknowledgeShieldLoss: true, clock: f.clock,
  }))]);
  expect(activation.applied).toBe(sent.quote.returnFuelReserve !== undefined);
  expect(activation.status).toBe(activation.applied ? 'READY' : 'BUSY');
});
