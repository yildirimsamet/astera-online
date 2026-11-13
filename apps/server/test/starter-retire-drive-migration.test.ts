import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { starterEvents, vesselOrders, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

/**
 * THE SHIPS ALREADY ABOARD MOVE TO THE NEW JUMP (plan 2026-11-13 §6). The jump needs no drive, part or
 * fuel: the tank goes back to the deuterium stock, a drive repair still in the queue is cancelled with
 * everything back, and the work behind it moves up. A ship already leaving is left to finish its way.
 */
let world: Awaited<ReturnType<typeof starterWorld>>;
beforeEach(async () => { world = await starterWorld(); });
afterEach(async () => { await world.built.close(); });

const MIGRATION = new URL('../drizzle/0250_retire_drive_work.sql', import.meta.url);
async function migrate(): Promise<void> {
  for (const statement of readFileSync(MIGRATION, 'utf8').split('--> statement-breakpoint')) {
    if (statement.trim()) await world.f.db.execute(sql.raw(statement));
  }
}

const SECOND = 1000;
/** The queue as it stands, in the database's own time, since the migration reads `now()`. */
async function queue(vesselId: string, orders: { subject: string; stage: number; minutes: number; startsIn?: number; alloy?: number; crystal?: number }[]) {
  const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, vesselId));
  let at = Date.now() + (orders[0]?.startsIn ?? 0) * SECOND;
  const ids: string[] = [];
  for (const [slot, order] of orders.entries()) {
    const startedAt = new Date(at);
    const readyAt = new Date(at + order.minutes * 60 * SECOND);
    at = readyAt.getTime();
    const [row] = await world.f.db.insert(vesselOrders).values({
      vesselId, queue: 'CONSTRUCTION', slot, subject: order.subject, stage: order.stage, startedAt, readyAt,
      remainingSeconds: order.minutes * 60, cost: { alloy: order.alloy ?? 100, crystal: order.crystal ?? 50, deuterium: 0 },
    }).returning({ id: vesselOrders.id });
    await world.f.db.insert(starterEvents).values({ starterGalaxyId: ship!.starterGalaxyId, kind: 'vessel_order_complete', refId: row!.id, resolveAt: readyAt });
    ids.push(row!.id);
  }
  return ids;
}
const orderRow = async (id: string) => (await world.f.db.select().from(vesselOrders).where(eq(vesselOrders.id, id)))[0]!;
const eventOf = async (id: string) => (await world.f.db.select().from(starterEvents).where(eq(starterEvents.refId, id)))[0]!;
const shipRow = async (id: string) => (await world.f.db.select().from(vessels).where(eq(vessels.id, id)))[0]!;

it('puts the fuel in the tank back into the deuterium stock, awake or asleep', async () => {
  const awake = await aboard(world, 'Awake');
  const asleep = await aboard(world, 'Asleep');
  await world.f.db.update(vessels).set({ fuel: 120, deuterium: 30 }).where(eq(vessels.id, awake.vesselId));
  await world.f.db.update(vessels).set({ fuel: 40, deuterium: 5, status: 'DORMANT', slotIndex: null }).where(eq(vessels.id, asleep.vesselId));
  await migrate();
  expect(await shipRow(awake.vesselId)).toMatchObject({ fuel: 0, deuterium: 150 });
  expect(await shipRow(asleep.vesselId)).toMatchObject({ fuel: 0, deuterium: 45 });
});

it('cancels a queued drive repair with everything back, and moves the work behind it up', async () => {
  const me = await aboard(world, 'Me');
  await world.f.db.update(vessels).set({ alloy: 1000, crystal: 500 }).where(eq(vessels.id, me.vesselId));
  const [drive, behind] = await queue(me.vesselId, [
    { subject: 'DRIVE_HULL', stage: 1, minutes: 20, alloy: 900, crystal: 400 },
    { subject: 'EXTRACTOR', stage: 2, minutes: 10 },
  ]);
  await migrate();
  expect(await orderRow(drive!)).toMatchObject({ status: 'CANCELLED' });
  expect(await eventOf(drive!)).toMatchObject({ status: 'done' });
  const after = await shipRow(me.vesselId);
  expect(after).toMatchObject({ alloy: 1900, crystal: 900 });

  const moved = await orderRow(behind!);
  expect(moved.slot).toBe(0);
  expect(Math.abs(moved.startedAt.getTime() - Date.now())).toBeLessThan(30 * SECOND);
  expect(moved.readyAt.getTime() - moved.startedAt.getTime()).toBe(10 * 60 * SECOND);
  expect((await eventOf(behind!)).resolveAt).toEqual(moved.readyAt);
});

it('keeps the order in hand where it is when the drive repair waited behind it', async () => {
  const me = await aboard(world, 'Me');
  const [head, drive, thrust, last] = await queue(me.vesselId, [
    { subject: 'EXTRACTOR', stage: 2, minutes: 10, startsIn: -60 },
    { subject: 'DRIVE_HULL', stage: 1, minutes: 20 },
    { subject: 'DRIVE_THRUST', stage: 1, minutes: 25 },
    { subject: 'SURVEY', stage: 2, minutes: 5 },
  ]);
  const before = await orderRow(head!);
  await migrate();
  expect(await orderRow(head!)).toMatchObject({ slot: 0, startedAt: before.startedAt, readyAt: before.readyAt });
  expect((await orderRow(drive!)).status).toBe('CANCELLED');
  expect((await orderRow(thrust!)).status).toBe('CANCELLED');
  const moved = await orderRow(last!);
  expect(moved).toMatchObject({ slot: 1, startedAt: before.readyAt });
  expect(moved.readyAt.getTime()).toBe(before.readyAt.getTime() + 5 * 60 * SECOND);
  expect((await eventOf(last!)).resolveAt).toEqual(moved.readyAt);
});

it('leaves a ship already leaving to finish its way', async () => {
  const me = await aboard(world, 'Me');
  await world.f.db.update(vessels).set({ fuel: 80, deuterium: 10, status: 'DEPARTING' }).where(eq(vessels.id, me.vesselId));
  const [drive] = await queue(me.vesselId, [{ subject: 'DRIVE_HULL', stage: 1, minutes: 20 }]);
  await migrate();
  expect(await shipRow(me.vesselId)).toMatchObject({ fuel: 80, deuterium: 10 });
  expect((await orderRow(drive!)).status).toBe('BUILDING');
});

it('changes nothing the second time it runs', async () => {
  const me = await aboard(world, 'Me');
  await world.f.db.update(vessels).set({ fuel: 60, deuterium: 0 }).where(eq(vessels.id, me.vesselId));
  const [, behind] = await queue(me.vesselId, [
    { subject: 'DRIVE_HULL', stage: 1, minutes: 20, alloy: 900, crystal: 400 },
    { subject: 'EXTRACTOR', stage: 2, minutes: 10 },
  ]);
  await migrate();
  const once = { ship: await shipRow(me.vesselId), order: await orderRow(behind!) };
  await migrate();
  expect(await shipRow(me.vesselId)).toEqual(once.ship);
  expect(await orderRow(behind!)).toEqual(once.order);
});
