import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
import { buildOrders, honorEvents, honorTotals, planets, scheduledEvents, seasons } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { buildUnits } from '../src/services/build.js';
import { launchAttack } from '../src/services/mission.js';
import { onBuildComplete, onMissionArrival } from '../src/worker/handlers.js';
import { fuelUp, giveUnits, grant, levelWorld, seedWorld, setLevel, settledAt, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });
describe('a real defender finishes an existing yard order while the raid is in flight', () => {
  it.each([1, 2, 4] as const)('records genuine defensive success without backdating navy, Honor version %s', async version => {
    const f = await seedWorld(2, 24017);
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await levelWorld(f.db, f.planetIds);
    await f.db.update(planets).set({ defencePosture: 'HOLD' }).where(eq(planets.seasonId, f.seasonId));
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 12);
      await setLevel(f.db, id, 'HANGAR', 10);
    }
    await giveUnits(f.db, f.planetIds[0]!, { DART: 40 });
    await fuelUp(f.db, f.planetIds[0]!, 50000);
    await grant(f.db, f.planetIds[1]!, 50000, 30000);
    f.clock.advance(250);
    await buildUnits(f.db, f.planetIds[1]!, 'DART', 40, f.clock);
    const [order] = await f.db.select().from(buildOrders);
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, version));
    f.clock.set(new Date(order!.readyAt.getTime() - 1000));
    const raid = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 40 }, f.clock);
    expect(raid.arriveAt.getTime()).toBeGreaterThan(order!.readyAt.getTime());
    f.clock.set(settledAt(order!.readyAt));
    const [buildEvent] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, order!.id), eq(scheduledEvents.kind, 'build_complete')));
    await onBuildComplete({ db: f.db, clock: f.clock }, buildEvent!);
    expect((await f.db.select().from(buildOrders))[0]?.status).toBe('COMPLETED');
    f.clock.set(settledAt(raid.arriveAt));
    const [arrival] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, raid.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
    await onMissionArrival({ db: f.db, clock: f.clock }, arrival!);
    const [entry] = await f.db.select().from(honorEvents);
    expect(entry?.evidence.defence[0]?.navy).toBe(0);
    expect(entry?.evidence.defence[0]?.weight).toBeGreaterThan(0);
    expect(entry?.evidence.attack[0]?.combatLoss).toBeGreaterThan(0);
    if (version === 1) expect(entry?.outcome.defence.total).toBe(0);
    else expect(entry?.outcome.defence.total).toBeGreaterThan(0);
    const totals = await f.db.select().from(honorTotals);
    await onMissionArrival({ db: f.db, clock: f.clock }, arrival!);
    expect(await f.db.select().from(honorTotals)).toEqual(totals);
  });
});
