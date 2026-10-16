import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { segmentsExposureHp } from '@astera/rules';
import { buildOrders, hpRadiationSources, planets, seasons } from '../src/db/schema.js';
import { activateRadiationBombs } from '../src/services/radiationBombAdoption.js';
import { hpSourcesForSeason } from '../src/services/radiationSources.js';
import { createSeason } from '../src/services/season.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';
import { writeHomeHealth } from '../src/services/homeHealth.js';
import { maintenanceAction } from '../src/services/maintenance.js';
import { startRepair } from '../src/services/repair.js';
import { dockLotsOf } from '../src/services/shipDamage.js';
import { randomUUID } from 'node:crypto';

let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(1);
  await f.db.update(seasons).set({ rulesetVersion: 16, monumentMotionStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await f.db.insert(hpRadiationSources).values([0, 1].map(() => ({ seasonId: f.seasonId,
    anchorKind: 'PLANET' as const, anchorId: f.planetIds[0]!, x: 0, y: 0, z: 0, radius: 1,
    intensityHpPerMinute: 40, mode: 'EMIT' as const, activeFrom: f.clock.now() })));
});
afterAll(async () => { await (await testDb()).close(); });
const activate = (apply = true) => activateRadiationBombs(f.db, { seasonId: f.seasonId, clock: f.clock, apply });

it('previews activation without changing existing sources, health, season rules or resources', async () => {
  const before = await f.db.select().from(planets);
  const sources = await f.db.select().from(hpRadiationSources);
  expect(await activate(false)).toMatchObject({ status: 'READY', applied: false, planets: 1 });
  expect(await f.db.select().from(planets)).toEqual(before);
  expect(await f.db.select().from(hpRadiationSources)).toEqual(sources);
  expect((await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId)))[0]).toMatchObject({ rulesetVersion: 16, radiationBombStartsAt: null });
});

it('sets one health/cap epoch atomically and never reprices historical exposure or resets it on retry', async () => {
  const old = f.clock.now().getTime();
  const sources = await f.db.select().from(hpRadiationSources);
  const [world] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
  f.clock.advance(10);
  const at = f.clock.now();
  const results = await Promise.all([activate(), activate()]);
  expect(results.filter(result => result.applied)).toHaveLength(1);
  expect(await f.db.select().from(hpRadiationSources)).toEqual(sources);
  expect((await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]).toEqual({ ...world, radiationSettledAt: at });
  const profile = await hpSourcesForSeason(f.db, f.seasonId);
  expect(segmentsExposureHp([{ from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 },
    startMs: old, endMs: at.getTime() + 600000, target: { kind: 'PLANET', id: f.planetIds[0]! } }], profile)).toBeCloseTo(1300);
  f.clock.advance(10);
  expect(await activate()).toMatchObject({ status: 'ALREADY_ACTIVE', applied: false, startsAt: at });
  expect((await f.db.select().from(seasons).where(and(eq(seasons.id, f.seasonId), eq(seasons.rulesetVersion, 16))))[0]!.radiationBombStartsAt).toEqual(at);
});

it('refuses activation on a closed season and before entity radiation is available', async () => {
  await f.db.update(seasons).set({ monumentMotionStartsAt: null }).where(eq(seasons.id, f.seasonId));
  await expect(activate()).rejects.toMatchObject({ code: 'MONUMENT_MOTION_REQUIRED' });
  await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
  await expect(activate()).rejects.toMatchObject({ code: 'SEASON_FROZEN' });
});

it('starts newly created current seasons with bombs available while older authored rules stay unchanged', async () => {
  const current = await createSeason(f.db, { shardCode: 'BOMB-CURRENT', seed: 918, startsAt: f.clock.now() });
  expect(current.season.radiationBombStartsAt).toEqual(current.season.startsAt);
  const legacy = await createSeason(f.db, { shardCode: 'BOMB-LEGACY', seed: 919, startsAt: f.clock.now(), rulesetVersion: 16 });
  expect(legacy.season.radiationBombStartsAt).toBeNull();
});

it('preserves paid repairs under a shelter when activating a season with existing emitters', async () => {
  const home = f.planetIds[0]!;
  await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'PLANET', anchorId: home,
    x: 0, y: 0, z: 0, radius: 1, intensityHpPerMinute: 0, mode: 'SHELTER', activeFrom: f.clock.now() });
  await setLevel(f.db, home, 'SHIPYARD', 5);
  await setLevel(f.db, home, 'HANGAR', 12);
  await grant(f.db, home, 500000, 500000);
  await giveUnits(f.db, home, { CITADEL: 1 });
  await f.db.transaction(tx => writeHomeHealth(tx, home, { CITADEL: 1 }, [{ hull: 'CITADEL', count: 1, damageBp: 5000 }]));
  await maintenanceAction(f.db, f.playerIds[0]!, home, 'DOCK', { source: 'HOME', groups: [{ hull: 'CITADEL', count: 1, damageBp: 5000 }] }, randomUUID(), f.clock);
  const [lot] = await dockLotsOf(f.db, home);
  const order = await startRepair(f.db, home, { lots: [{ id: lot!.id, count: 1 }] }, f.clock, f.playerIds[0]);
  await activate();
  expect((await f.db.select().from(buildOrders).where(eq(buildOrders.id, order.orderId)))[0]!.status).toBe('BUILDING');
  expect((await dockLotsOf(f.db, home))[0]!.repairing).toBe(true);
});
