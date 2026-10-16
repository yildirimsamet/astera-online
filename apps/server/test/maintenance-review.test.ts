import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { battleReports, missions, planets, seasons, watches } from '../src/db/schema.js';
import { maintenanceAction } from '../src/services/maintenance.js';
import { readHomeHealth } from '../src/services/homeHealth.js';
import { launchTransfer } from '../src/services/movement.js';
import { launchAttack } from '../src/services/mission.js';
import { dockLotsOf, landHpShips } from '../src/services/shipDamage.js';
import { EventBus } from '../src/stream/bus.js';
import { EventWorker } from '../src/worker/loop.js';
import { TEST_DATABASE_URL, fuelUp, giveUnits, grant, levelWorld, seedWorld, settledAt, testDb, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });
let f: Fixture;
beforeEach(async () => { f = await seedWorld(3, 141061); });
afterAll(async () => { await (await testDb()).close(); });

describe('maintenance review: exact wounds and live inventory', () => {
  it('returns a fleet that became unable to fight without looting an undefended world', async () => {
    const world = f.planetIds[0]!, target = f.planetIds[1]!, owner = f.playerIds[0]!;
    await f.db.update(seasons).set({ rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
    await levelWorld(f.db, f.planetIds);
    await fuelUp(f.db, world, 200_000);
    await grant(f.db, world, 200_000, 100_000);
    await grant(f.db, target, 200_000, 100_000);
    await giveUnits(f.db, world, { DART: 2, COURIER: 3 });
    const launched = await launchAttack(f.db, world, target, { DART: 2, COURIER: 3 }, f.clock, owner);
    const damage = [{ hull: 'DART' as const, count: 2, damageBp: 9500, remainderBp: 0.25 }];
    await f.db.update(missions).set({ damage }).where(eq(missions.id, launched.missionId));
    f.clock.set(settledAt(launched.arriveAt));
    const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);
    await worker.tick();
    const [report] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, launched.missionId));
    expect(report).toMatchObject({ grade: 'REPELLED', loot: { alloy: 0, crystal: 0, deuterium: 0 },
      attackerLosses: {}, defenderLosses: {} });
    const [returning] = await f.db.select().from(missions).where(eq(missions.parentMissionId, launched.missionId));
    expect(returning?.damage).toEqual(damage);
    expect(returning).toMatchObject({ kind: 'return', status: 'in_flight' });
  });
  it.each([15, 18])('keeps both transfer legs and sub-bp wounds exact in ruleset %s', async version => {
    const world = f.planetIds[0]!, target = f.planetIds[1]!, owner = f.playerIds[0]!;
    await f.db.update(seasons).set({ rulesetVersion: version }).where(eq(seasons.id, f.seasonId));
    await levelWorld(f.db, f.planetIds);
    await fuelUp(f.db, world, 200_000);
    await f.db.update(planets).set({ controllerPlayerId: owner, kind: 'COLONY' }).where(eq(planets.id, target));
    await giveUnits(f.db, world, { DART: 0, COURIER: 0 });
    const staying = [{ hull: 'DART' as const, count: 1, damageBp: 1000, remainderBp: 0.25 },
      { hull: 'DART' as const, count: 1, damageBp: 0, remainderBp: 0.125 }];
    const returning = [{ hull: 'COURIER' as const, count: 1, damageBp: 3000, remainderBp: 0.75 }];
    await f.db.transaction(tx => landHpShips(tx, { planetId: world, ownerPlayerId: owner,
      fleet: { DART: 2, COURIER: 1 }, damage: [...staying, ...returning], at: f.clock.now() }));
    const outbound = await launchTransfer(f.db, owner, world, target, { DART: 2, COURIER: 1 },
      { alloy: 0, crystal: 0, deuterium: 0 }, f.clock, 1, { cargoShips: 'RETURN', otherShips: 'STAY' });
    const worker = new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);
    f.clock.set(outbound.arriveAt);
    await worker.tick();
    const [back] = await f.db.select().from(missions).where(eq(missions.parentMissionId, outbound.missionId));
    expect(back?.damage).toEqual(returning);
    expect((await readHomeHealth(f.db, target)).damage).toEqual(staying);
    if (!back) throw new Error('Missing transfer return');
    f.clock.set(back.arriveAt);
    await worker.tick();
    expect((await readHomeHealth(f.db, world)).damage).toEqual(returning);
    expect(await dockLotsOf(f.db, world)).toEqual([]);
  });

  it.each(['DOCK', 'RETURN', 'SCRAP'] as const)('refreshes telescope observers once after %s changes the home fleet', async action => {
    const world = f.planetIds[0]!, owner = f.playerIds[0]!, observer = f.playerIds[1]!;
    await f.db.transaction(tx => landHpShips(tx, { planetId: world, ownerPlayerId: owner,
      fleet: { DART: 2 }, damage: [{ hull: 'DART', count: 2, damageBp: 1000 }], at: f.clock.now() }));
    const home = { source: 'HOME' as const, groups: [{ hull: 'DART' as const, count: 1, damageBp: 1000 }] };
    if (action === 'RETURN') await maintenanceAction(f.db, owner, world, 'DOCK', home, randomUUID(), f.clock);
    const [lot] = await dockLotsOf(f.db, world);
    const selection = action === 'RETURN' && lot
      ? { source: 'DOCK' as const, lots: [{ id: lot.id, count: 1 }] } : home;
    await f.db.insert(watches).values({ observerPlayerId: observer, observerPlanetId: f.planetIds[1]!,
      slot: 0, targetPlanetId: world });
    const bus = new EventBus(TEST_DATABASE_URL, silent);
    await bus.start();
    const observed: string[] = [], unrelated: string[] = [], publicEvents: string[] = [];
    bus.subscribe(observer, event => observed.push(event.kind));
    bus.subscribe(f.playerIds[2]!, event => unrelated.push(event.kind));
    bus.subscribeShard(f.seasonId, event => publicEvents.push(event.kind));
    try {
      const key = randomUUID();
      await maintenanceAction(f.db, owner, world, action, selection, key, f.clock);
      await maintenanceAction(f.db, owner, world, action, selection, key, f.clock);
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(observed.filter(kind => kind === 'private:sight')).toHaveLength(1);
      expect(unrelated).not.toContain('private:sight');
      expect(publicEvents).toEqual([]);
    } finally { await bus.stop(); }
  });
});
