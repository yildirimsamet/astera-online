import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { HULLS } from '@astera/rules';
import { buildOrders, planets, scheduledEvents, seasons } from '../src/db/schema.js';
import { addHpRadiationSource, endHpRadiationSource } from '../src/services/radiation.js';
import { maintenanceAction } from '../src/services/maintenance.js';
import { startRepair } from '../src/services/repair.js';
import { readHomeHealth, writeHomeHealth } from '../src/services/homeHealth.js';
import { loadLocked } from '../src/services/planet.js';
import { dockLotsOf } from '../src/services/shipDamage.js';
import { EventWorker } from '../src/worker/loop.js';
import { beginPlanetRadiationBoundary } from '../src/services/planetRadiation.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
let home: string;
beforeEach(async () => {
  f = await seedWorld(1);
  home = f.planetIds[0]!;
  await f.db.update(seasons).set({ rulesetVersion: 18, radiationBombStartsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
  await setLevel(f.db, home, 'SHIPYARD', 5);
  await setLevel(f.db, home, 'HANGAR', 12);
  await grant(f.db, home, 500000, 500000);
  await f.db.update(planets).set({ deuterium: 500000 }).where(eq(planets.id, home));
});
afterAll(async () => { await (await testDb()).close(); });

async function repairing() {
  await giveUnits(f.db, home, { CITADEL: 1 });
  await f.db.transaction(tx => writeHomeHealth(tx, home, { CITADEL: 1 }, [{ hull: 'CITADEL', count: 1, damageBp: 5000 }]));
  await maintenanceAction(f.db, f.playerIds[0]!, home, 'DOCK', { source: 'HOME', groups: [{ hull: 'CITADEL', count: 1, damageBp: 5000 }] }, randomUUID(), f.clock);
  const [lot] = await dockLotsOf(f.db, home);
  const result = await startRepair(f.db, home, { lots: [{ id: lot!.id, count: 1 }] }, f.clock, f.playerIds[0]);
  return (await f.db.select().from(buildOrders).where(eq(buildOrders.id, result.orderId)))[0]!;
}

function source(activeFrom = f.clock.now()) {
  return addHpRadiationSource(f.db, { seasonId: f.seasonId, anchor: { kind: 'PLANET', planetId: home },
    radius: 1, intensityHpPerMinute: 9, mode: 'EMIT', label: 'Operator source', activeFrom }, f.clock);
}

it('applies the same repair cancellation and full invoice refund when an existing planet source starts', async () => {
  const order = await repairing();
  const [before] = await f.db.select().from(planets).where(eq(planets.id, home));
  await source();
  expect((await f.db.select().from(buildOrders).where(eq(buildOrders.id, order.id)))[0]!.status).toBe('CANCELLED');
  const [after] = await f.db.select().from(planets).where(eq(planets.id, home));
  expect(after!.alloy - before!.alloy).toBeCloseTo(order.cost.alloy);
  expect(after!.crystal - before!.crystal).toBeCloseTo(order.cost.crystal);
  expect((await dockLotsOf(f.db, home))[0]!.repairing).toBe(false);
});

it('schedules a future source start and prevents a late repair completion from skipping that boundary', async () => {
  const order = await repairing();
  const startsAt = new Date(f.clock.now().getTime() + 60000);
  await source(startsAt);
  expect((await f.db.select().from(buildOrders).where(eq(buildOrders.id, order.id)))[0]!.status).toBe('BUILDING');
  const timers = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.kind, 'planet_radiation_boundary'), eq(scheduledEvents.refId, home)));
  expect(timers.some(timer => timer.resolveAt.getTime() === startsAt.getTime())).toBe(true);
  f.clock.set(new Date(startsAt.getTime() + 60000));
  await expect(f.db.transaction(tx => loadLocked(tx, home, f.clock))).rejects.toMatchObject({ code: 'RADIATION_SOURCE_PENDING' });
  await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
  expect((await f.db.select().from(buildOrders).where(eq(buildOrders.id, order.id)))[0]!.status).toBe('CANCELLED');
  const [lot] = await dockLotsOf(f.db, home);
  expect(lot!.damageBp + (lot!.remainderBp ?? 0)).toBeCloseTo(5000 + 9 / HULLS.CITADEL.hp * 10000);
});

it('settles the old planet dose before ending a source and plans its expiry even without a missile', async () => {
  await giveUnits(f.db, home, { CITADEL: 1 });
  const row = await source();
  f.clock.advance(1);
  await endHpRadiationSource(f.db, row.id, f.clock);
  const health = await readHomeHealth(f.db, home);
  expect(health.damage).toHaveLength(1);
  expect(health.damage[0]!.damageBp + (health.damage[0]!.remainderBp ?? 0)).toBeCloseTo(9 / HULLS.CITADEL.hp * 10000);
  f.clock.advance(1);
  await f.db.transaction(tx => loadLocked(tx, home, f.clock));
  expect((await readHomeHealth(f.db, home)).damage).toEqual(health.damage);
});

it('does not cancel a new paid repair when an old radiation boundary is retried after the source ends', async () => {
  await repairing();
  const startedAt = f.clock.now();
  const row = await source();
  f.clock.advance(1);
  await endHpRadiationSource(f.db, row.id, f.clock);
  const [lot] = await dockLotsOf(f.db, home);
  const repair = await startRepair(f.db, home, { lots: [{ id: lot!.id, count: 1 }] }, f.clock, f.playerIds[0]);
  await f.db.transaction(tx => beginPlanetRadiationBoundary(tx, home, startedAt));
  expect((await f.db.select().from(buildOrders).where(eq(buildOrders.id, repair.orderId)))[0]!.status).toBe('BUILDING');
});
