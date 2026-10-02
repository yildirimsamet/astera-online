import { randomUUID } from 'node:crypto';
import { and, eq, like } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  BUILD,
  MULTI_WORLD,
  shipRepairCost,
  shipRepairMinutes,
  type DamageLot,
  type Fleet,
  type HullId,
} from '@astera/rules';
import { buildOrders, planets, seasons, units } from '../src/db/schema.js';
import { abandonBuildOrder, cancelBuildOrder } from '../src/services/buildQueue.js';
import { secedeColony } from '../src/services/loyalty.js';
import { planetView } from '../src/services/planetView.js';
import { startRepair } from '../src/services/repair.js';
import { dockLotsOf, landShips } from '../src/services/shipDamage.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveResearch, giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * THE REPAIR STATION. Owner decisions K2, K6, 2026-09-29 (`plan.md` F4).
 *
 * Every world has one; it costs nothing and has no levels. A lot above the owner's
 * twenty percent waits in its dock until the commander pays the damaged share of what
 * the ships cost to build, in the damaged share of the time the yard would take. Jobs
 * run one after another, three deep, beside the yard rather than in it. Cancelling
 * gives back half, rounded down — the yard's own rule — and the ships wait again.
 */

const silent = pino({ level: 'silent' });
const lot = (hull: HullId, count: number, damageBp: number): DamageLot => ({ hull, count, damageBp });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('the Repair Station', () => {
  let f: Fixture;
  let mine: string;
  let me: string;

  const worker = () => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

  const stock = async (planetId = mine) => {
    const [row] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    return { alloy: row!.alloy, crystal: row!.crystal, deuterium: row!.deuterium };
  };

  const homeOf = async (planetId = mine): Promise<Fleet> => {
    const rows = await f.db.select().from(units).where(and(eq(units.planetId, planetId), eq(units.location, 'home')));
    const out: Fleet = {};
    for (const row of rows) if (row.count > 0) out[row.hull] = row.count;
    return out;
  };

  /** Land ships straight into a world's dock and hand back the lot ids, oldest first. */
  const dock = async (lots: DamageLot[], planetId = mine, owner = me): Promise<string[]> => {
    for (const row of lots) {
      await f.db.transaction((tx) => landShips(tx, {
        planetId, ownerPlayerId: owner, fleet: { [row.hull]: row.count }, damage: [row], at: f.clock.now(),
      }));
    }
    return (await dockLotsOf(f.db, planetId)).map((row) => row.id);
  };

  const repairOrders = () => f.db.select().from(buildOrders)
    .where(and(eq(buildOrders.queue, 'REPAIR'), eq(buildOrders.status, 'BUILDING')))
    .orderBy(buildOrders.slot);

  beforeEach(async () => {
    f = await seedWorld(2);
    mine = f.planetIds[0]!;
    me = f.playerIds[0]!;
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion })
      .where(eq(seasons.id, f.seasonId));
    await setLevel(f.db, mine, 'SHIPYARD', 4);
    await grant(f.db, mine, 200_000, 100_000);
    await f.db.update(planets).set({ deuterium: 5_000 }).where(eq(planets.id, mine));
  });

  it('repairs a lot for the damaged share of its price and time, and brings the ships home whole', async () => {
    const [id] = await dock([lot('BALLISTA', 2, 6400)]);
    const before = await stock();
    const homeBefore = (await homeOf()).BALLISTA ?? 0;

    const result = await startRepair(f.db, mine, { lotIds: [id!] }, f.clock, me);

    const bill = shipRepairCost([lot('BALLISTA', 2, 6400)], 100);
    const after = await stock();
    expect(before.alloy - after.alloy).toBeCloseTo(bill.alloy, 6);
    expect(before.crystal - after.crystal).toBeCloseTo(bill.crystal, 6);
    expect(before.deuterium - after.deuterium).toBeCloseTo(bill.deuterium, 6);
    const [order] = await repairOrders();
    const minutes = shipRepairMinutes([lot('BALLISTA', 2, 6400)], 4, {}, 100);
    expect(order).toMatchObject({ kind: 'REPAIR', subject: 'BALLISTA', count: 2, cost: bill });
    expect(order!.readyAt.getTime() - order!.startedAt.getTime()).toBe(Math.ceil(minutes * 60) * 1000);
    expect((await dockLotsOf(f.db, mine))[0]?.repairing).toBe(true);
    // Unusable while it is repaired: still in the dock, not at home.
    expect((await homeOf()).BALLISTA ?? 0).toBe(homeBefore);
    // The lot names its job, so a mixed job can list the ships it holds.
    expect(result.planet.dock.lots).toMatchObject([{ id, hull: 'BALLISTA', count: 2, repairing: true, orderId: order!.id }]);
    expect(result.planet.queues.REPAIR).toHaveLength(1);

    f.clock.set(order!.readyAt);
    await worker().tick();
    expect((await homeOf()).BALLISTA).toBe(homeBefore + 2);
    expect(await dockLotsOf(f.db, mine)).toEqual([]);
    expect(await f.db.select().from(units).where(like(units.location, 'dock:%'))).toEqual([]);
  });

  it('repairs every waiting lot with one order', async () => {
    await dock([lot('BALLISTA', 2, 6400), lot('TALON', 1, 3500)]);
    await startRepair(f.db, mine, { all: true }, f.clock, me);
    const orders = await repairOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      subject: 'ALL', count: 3, cost: shipRepairCost([lot('BALLISTA', 2, 6400), lot('TALON', 1, 3500)], 100),
    });
    expect((await dockLotsOf(f.db, mine)).every((row) => row.repairing)).toBe(true);
  });

  it('runs repairs one after another, three at most, beside the yard', async () => {
    const ids = await dock([lot('DART', 1, 5000), lot('PIKE', 1, 5000), lot('TALON', 1, 5000), lot('VIPER', 1, 5000)]);
    for (const id of ids.slice(0, 3)) await startRepair(f.db, mine, { lotIds: [id] }, f.clock, me);
    const orders = await repairOrders();
    expect(orders.map((order) => order.slot)).toEqual([0, 1, 2]);
    expect(orders[1]!.startedAt.getTime()).toBe(orders[0]!.readyAt.getTime());
    await expect(startRepair(f.db, mine, { lotIds: [ids[3]!] }, f.clock, me))
      .rejects.toMatchObject({ code: 'QUEUE_FULL' });
    expect(BUILD.queueDepth).toBe(3);
  });

  it('gives back half on a cancel, rounded down, and the ships wait again', async () => {
    const [id] = await dock([lot('BALLISTA', 1, 6400)]);
    await startRepair(f.db, mine, { lotIds: [id!] }, f.clock, me);
    const [order] = await repairOrders();
    const before = await stock();
    await cancelBuildOrder(f.db, mine, order!.id, f.clock, me);
    const after = await stock();
    expect(after.alloy - before.alloy).toBeCloseTo(Math.floor(order!.cost.alloy * BUILD.cancelRefund), 6);
    expect(after.crystal - before.crystal).toBeCloseTo(Math.floor(order!.cost.crystal * BUILD.cancelRefund), 6);
    // A cancelled job holds nothing: the lot waits again and names no job.
    expect(await dockLotsOf(f.db, mine)).toMatchObject([{ id, repairing: false, orderId: null }]);
    await expect(startRepair(f.db, mine, { lotIds: [id!] }, f.clock, me)).resolves.toBeDefined();
  });

  it('gives everything back when the server gives up on a repair', async () => {
    const [id] = await dock([lot('BALLISTA', 1, 6400)]);
    const before = await stock();
    await startRepair(f.db, mine, { lotIds: [id!] }, f.clock, me);
    const [order] = await repairOrders();
    expect(await abandonBuildOrder(f.db, order!.id, f.clock)).toBe(true);
    const after = await stock();
    expect(after.alloy).toBeCloseTo(before.alloy, 6);
    expect(after.crystal).toBeCloseTo(before.crystal, 6);
    expect((await dockLotsOf(f.db, mine))[0]?.repairing).toBe(false);
  });

  it('takes Industrial\'s share off the bill and the time', async () => {
    await giveResearch(f.db, mine, 'INDUSTRIAL', 2);
    const [id] = await dock([lot('BALLISTA', 2, 6400)]);
    await startRepair(f.db, mine, { lotIds: [id!] }, f.clock, me);
    const [order] = await repairOrders();
    expect(order!.cost).toEqual(shipRepairCost([lot('BALLISTA', 2, 6400)], 50));
    const minutes = shipRepairMinutes([lot('BALLISTA', 2, 6400)], 4, { INDUSTRIAL: 2 }, 50);
    expect(order!.readyAt.getTime() - order!.startedAt.getTime()).toBe(Math.ceil(minutes * 60) * 1000);
  });

  it('repairs at a world whose Shipyard could never have built the hull', async () => {
    await setLevel(f.db, mine, 'SHIPYARD', 0);
    const [id] = await dock([lot('CATACLYSM', 1, 5000)]);
    await startRepair(f.db, mine, { lotIds: [id!] }, f.clock, me);
    const [order] = await repairOrders();
    const minutes = shipRepairMinutes([lot('CATACLYSM', 1, 5000)], 0, {}, 100);
    expect(order!.readyAt.getTime() - order!.startedAt.getTime()).toBe(Math.ceil(minutes * 60) * 1000);
  });

  it('refuses what it cannot do, and says why', async () => {
    const [id] = await dock([lot('BALLISTA', 1, 6400)]);
    await expect(startRepair(f.db, mine, { lotIds: [randomUUID()] }, f.clock, me))
      .rejects.toMatchObject({ code: 'REPAIR_LOT_NOT_FOUND' });
    const [theirs] = await dock([lot('TALON', 1, 6000)], f.planetIds[1], f.playerIds[1]);
    await expect(startRepair(f.db, mine, { lotIds: [theirs!] }, f.clock, me))
      .rejects.toMatchObject({ code: 'REPAIR_LOT_NOT_FOUND' });

    await f.db.update(planets).set({ alloy: 0 }).where(eq(planets.id, mine));
    await expect(startRepair(f.db, mine, { lotIds: [id!] }, f.clock, me))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
    await grant(f.db, mine, 200_000, 100_000);

    await startRepair(f.db, mine, { lotIds: [id!] }, f.clock, me);
    await expect(startRepair(f.db, mine, { lotIds: [id!] }, f.clock, me))
      .rejects.toMatchObject({ code: 'REPAIR_LOT_BUSY' });
    await expect(startRepair(f.db, mine, { all: true }, f.clock, me))
      .rejects.toMatchObject({ code: 'REPAIR_NOTHING_WAITING' });
  });

  it('does not exist in a season dealt before the rule', async () => {
    await f.db.update(seasons).set({ rulesetVersion: 13 }).where(eq(seasons.id, f.seasonId));
    await expect(startRepair(f.db, mine, { all: true }, f.clock, me))
      .rejects.toMatchObject({ code: 'SHIP_DAMAGE_UNAVAILABLE' });
  });

  it('never pays twice or books one lot twice when two taps race', async () => {
    const [id] = await dock([lot('BALLISTA', 1, 6400)]);
    const before = await stock();
    const results = await Promise.allSettled([
      startRepair(f.db, mine, { lotIds: [id!] }, f.clock, me),
      startRepair(f.db, mine, { lotIds: [id!] }, f.clock, me),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((row) => row.status === 'rejected')).toMatchObject({ reason: { code: 'REPAIR_LOT_BUSY' } });
    expect(await repairOrders()).toHaveLength(1);
    const after = await stock();
    expect(before.alloy - after.alloy).toBeCloseTo(shipRepairCost([lot('BALLISTA', 1, 6400)], 100).alloy, 6);
  });

  it('never refunds twice when two cancels race', async () => {
    const [id] = await dock([lot('BALLISTA', 1, 6400)]);
    await startRepair(f.db, mine, { lotIds: [id!] }, f.clock, me);
    const [order] = await repairOrders();
    const before = await stock();
    const results = await Promise.allSettled([
      cancelBuildOrder(f.db, mine, order!.id, f.clock, me),
      cancelBuildOrder(f.db, mine, order!.id, f.clock, me),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const after = await stock();
    expect(after.alloy - before.alloy).toBeCloseTo(Math.floor(order!.cost.alloy * BUILD.cancelRefund), 6);
  });

  it('lets the ships wait again in the capital when their colony secedes mid-repair', async () => {
    const colony = mine;
    const owner = f.playerIds[1]!;
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: owner }).where(eq(planets.id, colony));
    const [id] = await dock([lot('BALLISTA', 1, 6400)], colony, owner);
    await startRepair(f.db, colony, { lotIds: [id!] }, f.clock, owner);
    expect(await f.db.transaction((tx) => secedeColony(tx, colony, f.clock.now(), randomUUID()))).toBe(true);
    expect(await dockLotsOf(f.db, f.planetIds[1]!)).toMatchObject([{ id, repairing: false }]);
  });

  it('prices every waiting lot on the planet view, before anybody pays', async () => {
    await giveUnits(f.db, mine, { DART: 1 });
    await dock([lot('BALLISTA', 2, 6400)]);
    const view = await f.db.transaction((tx) => planetView(tx, mine, f.clock));
    expect(view.dock.lots).toMatchObject([{
      hull: 'BALLISTA', count: 2, damageBp: 6400, repairing: false, orderId: null,
      cost: shipRepairCost([lot('BALLISTA', 2, 6400)], 100),
    }]);
    expect(view.dock.lots[0]!.minutes).toBeCloseTo(shipRepairMinutes([lot('BALLISTA', 2, 6400)], 4, {}, 100), 9);
    expect(view.dock.waiting.cost).toEqual(shipRepairCost([lot('BALLISTA', 2, 6400)], 100));
    expect(view.queues.REPAIR).toEqual([]);
  });
});
