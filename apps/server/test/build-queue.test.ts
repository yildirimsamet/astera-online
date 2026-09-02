import { and, eq } from 'drizzle-orm';
import { HULLS, cancelRefund, shipMinutes } from '@astera/rules';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  buildOrders,
  buildings,
  planets,
  players,
  scheduledEvents,
  seasons,
  units,
} from '../src/db/schema.js';
import { buildUnits, raiseInstrument, upgradeBuilding } from '../src/services/build.js';
import { abandonBuildOrder, cancelBuildOrder } from '../src/services/buildQueue.js';
import { loadLocked } from '../src/services/planet.js';
import { sweepStranded } from '../src/worker/abandon.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveSatellite,
  grant,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const worker = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('ordinary build queues', () => {
  let f: Fixture;
  let planetId: string;

  beforeEach(async () => {
    f = await seedWorld(1);
    planetId = f.planetIds[0]!;
  });

  it('commits now and creates the hull only at the named instant', async () => {
    const before = await f.db
      .select({ builtEver: planets.builtEver })
      .from(planets)
      .where(eq(planets.id, planetId));
    const placed = await buildUnits(f.db, planetId, 'DART', 2, f.clock);
    const [order] = await f.db
      .select()
      .from(buildOrders)
      .where(eq(buildOrders.planetId, planetId));
    expect(order).toMatchObject({ queue: 'YARD', kind: 'HULL', subject: 'DART', count: 2 });
    expect(placed.planet.fleet.DART ?? 0).toBe(0);
    expect(placed.planet.queues.YARD[0]?.finishesAt).toEqual(order!.readyAt);
    expect((await f.db.select().from(units).where(eq(units.planetId, planetId)))).toHaveLength(0);
    expect(before[0]?.builtEver.DART ?? 0).toBe(0);

    f.clock.set(order!.readyAt);
    await worker(f).tick();

    const completed = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));
    const [world] = await f.db
      .select({ builtEver: planets.builtEver })
      .from(planets)
      .where(eq(planets.id, planetId));
    expect(completed.homeFleet.DART).toBe(2);
    expect(world?.builtEver.DART).toBe(2);
    expect((await f.db.select().from(buildOrders))[0]?.status).toBe('COMPLETED');
  });

  it('reads gates through earlier orders in the same queue', async () => {
    await upgradeBuilding(f.db, planetId, 'CORE', f.clock);
    await expect(upgradeBuilding(f.db, planetId, 'REFINERY', f.clock)).resolves.toMatchObject({
      level: 2,
    });

    const before = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));
    expect(before.buildings.CORE).toBe(1);
    expect(before.buildings.REFINERY).toBe(1);
    const orders = await f.db
      .select()
      .from(buildOrders)
      .where(eq(buildOrders.planetId, planetId))
      .orderBy(buildOrders.slot);
    expect(orders.map((order) => order.subject)).toEqual(['CORE', 'REFINERY']);

    f.clock.set(orders[0]!.readyAt);
    await worker(f).tick();
    const middle = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));
    expect(middle.buildings.CORE).toBe(2);
    expect(middle.buildings.REFINERY).toBe(1);

    f.clock.set(orders[1]!.readyAt);
    await worker(f).tick();
    const after = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));
    expect(after.buildings.CORE).toBe(2);
    expect(after.buildings.REFINERY).toBe(2);
  });

  it('requires the Uplink to occupy an active slot and projects a queued Core reopening it', async () => {
    await grant(f.db, planetId, 100_000, 100_000);
    await setLevel(f.db, planetId, 'CORE', 2);
    await giveSatellite(f.db, planetId, 'FOUNDRY');
    await giveSatellite(f.db, planetId, 'UPLINK');

    const damaged = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));
    expect(damaged.storedOrbit).toEqual(['FOUNDRY', 'UPLINK']);
    expect(damaged.orbit).toEqual(['FOUNDRY']);
    await expect(raiseInstrument(f.db, planetId, 'TELESCOPE', f.clock)).rejects.toMatchObject({
      code: 'NEEDS_UPLINK',
    });

    await expect(upgradeBuilding(f.db, planetId, 'CORE', f.clock)).resolves.toMatchObject({
      level: 3,
    });
    await expect(raiseInstrument(f.db, planetId, 'TELESCOPE', f.clock)).resolves.toMatchObject({
      level: 1,
    });
    const orders = await f.db
      .select()
      .from(buildOrders)
      .where(eq(buildOrders.planetId, planetId))
      .orderBy(buildOrders.slot);
    expect(orders.map((order) => order.subject)).toEqual(['CORE', 'TELESCOPE']);
  });

  it('caps each queue at three while allowing the other queue to run', async () => {
    for (let i = 0; i < 3; i++) await upgradeBuilding(f.db, planetId, 'CORE', f.clock);
    await expect(upgradeBuilding(f.db, planetId, 'CORE', f.clock)).rejects.toMatchObject({
      code: 'QUEUE_FULL',
      params: { queue: 'CONSTRUCTION', max: 3 },
    });
    await expect(buildUnits(f.db, planetId, 'DART', 1, f.clock)).resolves.toBeTruthy();
  });

  it('refunds half on cancel and pulls the tail forward', async () => {
    await grant(f.db, planetId, 100_000, 30_000);
    await buildUnits(f.db, planetId, 'DART', 20, f.clock);
    await buildUnits(f.db, planetId, 'DART', 1, f.clock);
    const before = await f.db
      .select()
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.status, 'BUILDING')))
      .orderBy(buildOrders.slot);
    const [stockBefore] = await f.db.select().from(planets).where(eq(planets.id, planetId));

    const result = await cancelBuildOrder(f.db, planetId, before[0]!.id, f.clock);
    const [remaining] = await f.db
      .select()
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.status, 'BUILDING')));
    const expected = cancelRefund(before[0]!.cost);
    expect(result.refund).toEqual(expected);
    expect(result.planet.planet.alloy - stockBefore!.alloy).toBe(expected.alloy);
    expect(remaining).toMatchObject({ slot: 0, startedAt: f.clock.now() });
    expect(remaining!.readyAt.getTime()).toBeLessThan(before[1]!.readyAt.getTime());
  });

  it('keeps the running head fixed when a middle order is cancelled', async () => {
    await grant(f.db, planetId, 100_000, 30_000);
    await buildUnits(f.db, planetId, 'DART', 20, f.clock);
    await buildUnits(f.db, planetId, 'DART', 10, f.clock);
    await buildUnits(f.db, planetId, 'DART', 1, f.clock);
    const before = await f.db
      .select()
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.status, 'BUILDING')))
      .orderBy(buildOrders.slot);

    await cancelBuildOrder(f.db, planetId, before[1]!.id, f.clock);

    const after = await f.db
      .select()
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.status, 'BUILDING')))
      .orderBy(buildOrders.slot);
    expect(after.map((order) => order.id)).toEqual([before[0]!.id, before[2]!.id]);
    expect(after[0]).toMatchObject({
      slot: 0,
      startedAt: before[0]!.startedAt,
      readyAt: before[0]!.readyAt,
    });
    expect(after[1]).toMatchObject({ slot: 1, startedAt: before[0]!.readyAt });
    expect(after[1]!.readyAt.getTime()).toBe(
      before[0]!.readyAt.getTime() + before[2]!.remainingSeconds * 1_000,
    );

    const [tailEvent] = await f.db
      .select()
      .from(scheduledEvents)
      .where(and(
        eq(scheduledEvents.kind, 'build_complete'),
        eq(scheduledEvents.refId, before[2]!.id),
      ));
    expect(tailEvent?.resolveAt).toEqual(after[1]!.readyAt);
    expect(tailEvent?.payload).toMatchObject({ expectedReadyAt: after[1]!.readyAt.toISOString() });
  });

  it('cannot cancel a queued prerequisite out from under a dependent order', async () => {
    await upgradeBuilding(f.db, planetId, 'CORE', f.clock);
    await upgradeBuilding(f.db, planetId, 'REFINERY', f.clock);
    const before = await f.db
      .select()
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.status, 'BUILDING')))
      .orderBy(buildOrders.slot);

    await expect(cancelBuildOrder(f.db, planetId, before[0]!.id, f.clock)).rejects.toMatchObject({
      code: 'BUILD_ORDER_HAS_DEPENDENTS',
      params: { count: 1 },
    });

    const after = await f.db
      .select()
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.status, 'BUILDING')))
      .orderBy(buildOrders.slot);
    expect(after.map((candidate) => candidate.id)).toEqual(before.map((candidate) => candidate.id));
  });

  it('fully refunds a dependent tail when the system abandons its prerequisite', async () => {
    const [stockBefore] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    await upgradeBuilding(f.db, planetId, 'CORE', f.clock);
    await upgradeBuilding(f.db, planetId, 'REFINERY', f.clock);
    const orders = await f.db
      .select()
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.status, 'BUILDING')))
      .orderBy(buildOrders.slot);

    expect(await abandonBuildOrder(f.db, orders[0]!.id, f.clock)).toBe(true);

    const [stockAfter] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    const after = await f.db.select().from(buildOrders).orderBy(buildOrders.slot);
    const events = await f.db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'build_complete'));
    expect(after.map((candidate) => candidate.status)).toEqual(['FAILED', 'FAILED']);
    expect(events.map((event) => event.status)).toEqual(['done', 'done']);
    expect(stockAfter).toMatchObject({
      alloy: stockBefore!.alloy,
      crystal: stockBefore!.crystal,
      deuterium: stockBefore!.deuterium,
    });
  });

  it('serialises concurrent placements into three unique slots and refuses the fourth', async () => {
    const attempts = await Promise.allSettled(
      Array.from({ length: 4 }, () => upgradeBuilding(f.db, planetId, 'CORE', f.clock)),
    );
    const failures = attempts
      .filter((attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected')
      .map((attempt) => attempt.reason instanceof Error
        ? `${attempt.reason.name}: ${attempt.reason.message}`
        : String(attempt.reason));
    expect(
      attempts.filter((attempt) => attempt.status === 'fulfilled'),
      failures.join('\n'),
    ).toHaveLength(3);
    const refusal = attempts.find((attempt) => attempt.status === 'rejected');
    expect(refusal).toMatchObject({
      status: 'rejected',
      reason: { code: 'QUEUE_FULL' },
    });
    const active = await f.db
      .select({ slot: buildOrders.slot })
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, planetId), eq(buildOrders.status, 'BUILDING')))
      .orderBy(buildOrders.slot);
    expect(active.map((order) => order.slot)).toEqual([0, 1, 2]);
  });

  it('refuses an order that cannot finish before the season and spends nothing', async () => {
    const locked = await f.db.transaction((tx) => loadLocked(tx, planetId, f.clock));
    f.clock.set(new Date(locked.seasonEndsAt.getTime() - 1_000));
    const [before] = await f.db.select().from(planets).where(eq(planets.id, planetId));

    await expect(buildUnits(f.db, planetId, 'DART', 1, f.clock)).rejects.toMatchObject({
      code: 'SEASON_ENDS_BEFORE_BUILD',
    });

    const [after] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    expect(after).toMatchObject({ alloy: before!.alloy, crystal: before!.crystal });
    expect(await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, planetId)))
      .toHaveLength(0);
  });

  it('reserves the exact season deadline for freeze instead of racing it', async () => {
    const durationSeconds = Math.max(1, Math.ceil(shipMinutes(HULLS.DART, 0, {}) * 60));
    await f.db
      .update(seasons)
      .set({ endsAt: new Date(f.clock.now().getTime() + durationSeconds * 1_000) })
      .where(eq(seasons.id, f.seasonId));
    const [before] = await f.db.select().from(planets).where(eq(planets.id, planetId));

    await expect(buildUnits(f.db, planetId, 'DART', 1, f.clock)).rejects.toMatchObject({
      code: 'SEASON_ENDS_BEFORE_BUILD',
    });

    const [after] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    expect(after).toMatchObject({ alloy: before!.alloy, crystal: before!.crystal });
    expect(await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, planetId)))
      .toHaveLength(0);
  });

  it('never lets a build id cancel an order belonging to another planet', async () => {
    const other = await seedWorld(2);
    await buildUnits(other.db, other.planetIds[0]!, 'DART', 1, other.clock);
    const [order] = await other.db
      .select()
      .from(buildOrders)
      .where(eq(buildOrders.planetId, other.planetIds[0]!));

    await expect(
      cancelBuildOrder(other.db, other.planetIds[1]!, order!.id, other.clock),
    ).rejects.toMatchObject({ code: 'BUILD_ORDER_NOT_FOUND' });
    expect((await other.db.select().from(buildOrders).where(eq(buildOrders.id, order!.id)))[0])
      .toMatchObject({ status: 'BUILDING' });
  });

  it('returns everything and records failure when the system abandons an order', async () => {
    const [before] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    await buildUnits(f.db, planetId, 'DART', 1, f.clock);
    const [order] = await f.db.select().from(buildOrders);
    expect(await abandonBuildOrder(f.db, order!.id, f.clock)).toBe(true);

    const [after] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    const [failed] = await f.db.select().from(buildOrders).where(eq(buildOrders.id, order!.id));
    expect(after?.alloy).toBe(before?.alloy);
    expect(after?.crystal).toBe(before?.crystal);
    expect(failed?.status).toBe('FAILED');
    expect((await f.db.select().from(units))).toHaveLength(0);
  });

  it('repairs an overdue order whose event row disappeared', async () => {
    const [before] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    await buildUnits(f.db, planetId, 'DART', 1, f.clock);
    const [order] = await f.db.select().from(buildOrders);
    await f.db
      .delete(scheduledEvents)
      .where(and(
        eq(scheduledEvents.kind, 'build_complete'),
        eq(scheduledEvents.refId, order!.id),
      ));
    f.clock.set(new Date(order!.readyAt.getTime() + 6 * 60_000));

    expect(await sweepStranded(f.db, f.clock)).toBe(1);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    expect(after?.alloy).toBe(before?.alloy);
    expect((await f.db.select().from(buildOrders))[0]?.status).toBe('FAILED');
  });

  it('counts committed resources at full value and writes off only the cancel fee', async () => {
    const [playerBefore] = await f.db
      .select({ wealth: players.wealth })
      .from(players)
      .where(eq(players.id, f.playerIds[0]!));
    await buildUnits(f.db, planetId, 'DART', 1, f.clock);
    const [order] = await f.db.select().from(buildOrders);
    const [committed] = await f.db
      .select({ wealth: players.wealth })
      .from(players)
      .where(eq(players.id, f.playerIds[0]!));
    expect(committed?.wealth).toBe(playerBefore?.wealth);

    await cancelBuildOrder(f.db, planetId, order!.id, f.clock);
    const [cancelled] = await f.db
      .select({ wealth: players.wealth })
      .from(players)
      .where(eq(players.id, f.playerIds[0]!));
    const refund = cancelRefund(HULLS.DART);
    const fee = HULLS.DART.alloy + HULLS.DART.crystal + HULLS.DART.deuterium
      - refund.alloy - refund.crystal - refund.deuterium;
    expect(cancelled!.wealth).toBe(committed!.wealth - fee);
  });

  it('applies a delivered completion event only once', async () => {
    await buildUnits(f.db, planetId, 'DART', 1, f.clock);
    const [order] = await f.db.select().from(buildOrders);
    f.clock.set(order!.readyAt);
    const w = worker(f);
    await w.tick();
    await f.db
      .update(scheduledEvents)
      .set({ status: 'pending', resolveAt: f.clock.now() })
      .where(and(
        eq(scheduledEvents.kind, 'build_complete'),
        eq(scheduledEvents.refId, order!.id),
      ));
    await w.tick();
    const [stack] = await f.db.select().from(units).where(eq(units.planetId, planetId));
    expect(stack?.count).toBe(1);
  });

  it('keeps the stored building unchanged until completion', async () => {
    await upgradeBuilding(f.db, planetId, 'CORE', f.clock);
    const [row] = await f.db
      .select()
      .from(buildings)
      .where(and(eq(buildings.planetId, planetId), eq(buildings.type, 'CORE')));
    expect(row?.level).toBe(1);
  });
});
