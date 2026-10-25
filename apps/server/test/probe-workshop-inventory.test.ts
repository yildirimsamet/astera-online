import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { classReading, combatValue, type Fleet, type HpDamageLots } from '@astera/rules';
import { missions, probeReports, satellites, seasons } from '../src/db/schema.js';
import { launchProbe, readProbeReports } from '../src/services/intel.js';
import { maintenanceAction } from '../src/services/maintenance.js';
import { startRepair } from '../src/services/repair.js';
import { dockLotsOf } from '../src/services/shipDamage.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, grant, landAndDockShips, levelWorld, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
const logger = pino({ level: 'silent' });
const tick = () => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, logger).tick();
const dock = (damage: HpDamageLots, index = 1) => {
  const fleet: Fleet = {};
  for (const lot of damage) fleet[lot.hull] = (fleet[lot.hull] ?? 0) + lot.count;
  return landAndDockShips(f.db, { planetId: f.planetIds[index]!, ownerPlayerId: f.playerIds[index]!,
    fleet, damage, at: f.clock.now() }, f.clock);
};
async function probe() {
  const flight = await launchProbe(f.db, f.planetIds[0]!, f.planetIds[1]!, f.clock);
  f.clock.set(flight.arriveAt);
  await tick();
  const [report] = await f.db.select().from(probeReports).where(eq(probeReports.missionId, flight.missionId));
  if (!report) throw new Error('Missing probe snapshot');
  return { report, flight };
}
beforeEach(async () => {
  f = await seedWorld(3, 231023);
  await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
  await levelWorld(f.db, f.planetIds);
  for (const world of f.planetIds) {
    await grant(f.db, world, 200_000, 100_000);
    await fuelUp(f.db, world, 100_000);
  }
  await setLevel(f.db, f.planetIds[0]!, 'SHIPYARD', 4);
});
afterAll(async () => { await (await testDb()).close(); });

describe('probe inventory includes ships in the workshop', () => {
  it('counts waiting and repairing ships once, without adding them to defending power or cargo', async () => {
    await giveUnits(f.db, f.planetIds[1]!, { DART: 2, COURIER: 1 });
    await dock([{ hull: 'CORSAIR', count: 4, damageBp: 7500 }, { hull: 'ARGOSY', count: 6, damageBp: 5100 }]);
    const corsair = (await dockLotsOf(f.db, f.planetIds[1]!)).find(lot => lot.hull === 'CORSAIR');
    if (!corsair) throw new Error('Missing workshop fixture');
    await startRepair(f.db, f.planetIds[1]!, { lotIds: [corsair.id] }, f.clock, f.playerIds[1]);
    const { report } = await probe();
    expect((await dockLotsOf(f.db, f.planetIds[1]!)).find(lot => lot.id === corsair.id)?.repairing).toBe(true);
    expect(report.accuracy).toBe(1);
    expect(report.fleetSize).toEqual({ low: 13, high: 13 });
    expect(report.defence).toEqual({ low: combatValue({ DART: 2 }), high: combatValue({ DART: 2 }) });
    expect(report.unarmed).toEqual({ low: 1, high: 1 });
    expect(report.classReading).toEqual(classReading({ DART: 2, COURIER: 1 }, 1));
    expect(report.fleetHome).toBe(true);
  });

  it('still sees a fleet when every ship is docked, with zero combat-ready defence', async () => {
    await dock([{ hull: 'CORSAIR', count: 7, damageBp: 6000 }, { hull: 'ARGOSY', count: 3, damageBp: 9000 }]);
    const { report } = await probe();
    expect(report.fleetSize).toEqual({ low: 10, high: 10 });
    expect(report.defence).toEqual({ low: 0, high: 0 });
    expect(report.unarmed).toEqual({ low: 0, high: 0 });
    expect(report.fleetHome).toBe(true);
  });

  it('excludes away fleets and another world’s workshop from this world’s count', async () => {
    await giveUnits(f.db, f.planetIds[1]!, { DART: 1 });
    await dock([{ hull: 'CORSAIR', count: 2, damageBp: 5000 }]);
    await giveUnits(f.db, f.planetIds[1]!, { CORSAIR: 99 }, randomUUID());
    await dock([{ hull: 'CORSAIR', count: 100, damageBp: 5000 }], 2);
    const { report } = await probe();
    expect(report.fleetSize).toEqual({ low: 3, high: 3 });
    expect(report.defence).toEqual({ low: combatValue({ DART: 1 }), high: combatValue({ DART: 1 }) });
    expect(report.fleetHome).toBe(false);
  });

  it('adds separate workshop lots of the same hull without overwriting or double-counting them', async () => {
    await giveUnits(f.db, f.planetIds[1]!, { DART: 1 });
    await dock([{ hull: 'DART', count: 2, damageBp: 3000 }, { hull: 'DART', count: 3, damageBp: 6000 }]);
    expect(await dockLotsOf(f.db, f.planetIds[1]!)).toHaveLength(2);
    const { report } = await probe();
    expect(report.fleetSize).toEqual({ low: 6, high: 6 });
    expect(report.defence).toEqual({ low: combatValue({ DART: 1 }), high: combatValue({ DART: 1 }) });
  });

  it('keeps a blurred probe blurred when the workshop holds most of the ships', async () => {
    await dock([{ hull: 'DART', count: 1000, damageBp: 3000 }]);
    await f.db.insert(satellites).values({ planetId: f.planetIds[1]!, slot: 0, type: 'VEIL', level: 2 })
      .onConflictDoUpdate({ target: [satellites.planetId, satellites.slot], set: { type: 'VEIL', level: 2 } });
    const { report } = await probe();
    expect(report.accuracy).toBeLessThan(1);
    expect(report.fleetSize.high).toBeGreaterThan(report.fleetSize.low);
    expect(report.fleetSize.low).toBeLessThanOrEqual(1000);
    expect(report.fleetSize.high).toBeGreaterThanOrEqual(1000);
    expect(report.defence).toEqual({ low: 0, high: 0 });
  });

  it('preserves the delivered snapshot while ships return from the workshop', async () => {
    await giveUnits(f.db, f.planetIds[1]!, { DART: 2 });
    await dock([{ hull: 'DART', count: 5, damageBp: 4000, remainderBp: 0.25 }]);
    const { report, flight } = await probe();
    const [lot] = await dockLotsOf(f.db, f.planetIds[1]!);
    if (!lot) throw new Error('Missing workshop fixture');
    await maintenanceAction(f.db, f.playerIds[1]!, f.planetIds[1]!, 'RETURN',
      { source: 'DOCK', lots: [{ id: lot.id, count: 3 }] }, randomUUID(), f.clock);
    const [back] = await f.db.select().from(missions).where(and(eq(missions.parentMissionId, flight.missionId), eq(missions.kind, 'probe')));
    if (!back) throw new Error('Missing probe return');
    f.clock.set(back.arriveAt);
    await tick();
    const delivered = (await readProbeReports(f.db, f.playerIds[0]!)).find(row => row.report.id === report.id)?.report;
    expect(delivered?.fleetSize).toEqual({ low: 7, high: 7 });
    expect(delivered?.defence).toEqual(report.defence);
    f.clock.set(new Date(f.clock.now().getTime() + 60 * 60_000));
    const next = await probe();
    expect(next.report.fleetSize).toEqual({ low: 7, high: 7 });
    expect(next.report.defence).toEqual({ low: combatValue({ DART: 5 }), high: combatValue({ DART: 5 }) });
  });

  it('keeps the same physical count after a repair finishes', async () => {
    await dock([{ hull: 'CORSAIR', count: 4, damageBp: 5000 }]);
    const [lot] = await dockLotsOf(f.db, f.planetIds[1]!);
    if (!lot) throw new Error('Missing workshop fixture');
    const { orderId } = await startRepair(f.db, f.planetIds[1]!, { lotIds: [lot.id] }, f.clock, f.playerIds[1]);
    const first = await probe();
    expect(first.report.fleetSize).toEqual({ low: 4, high: 4 });
    const { buildOrders } = await import('../src/db/schema.js');
    const [order] = await f.db.select().from(buildOrders).where(eq(buildOrders.id, orderId));
    if (!order) throw new Error('Missing repair');
    f.clock.set(new Date(Math.max(order.readyAt.getTime(), f.clock.now().getTime() + 60 * 60_000)));
    await tick();
    expect(await dockLotsOf(f.db, f.planetIds[1]!)).toEqual([]);
    const next = await probe();
    expect(next.report.fleetSize).toEqual({ low: 4, high: 4 });
    expect(next.report.defence).toEqual({ low: combatValue({ CORSAIR: 4 }), high: combatValue({ CORSAIR: 4 }) });
  });
});
