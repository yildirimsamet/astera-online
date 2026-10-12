import { readFileSync } from 'node:fs';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';
import { SHIELD, instrumentCost, investedInInstrument, shieldHp } from '@astera/rules';
import { buildOrders, planets, satellites } from '../src/db/schema.js';
import { runMigrations } from '../src/db/migrate.js';
import { raiseInstrument } from '../src/services/build.js';
import { applyBuildCompletion, cancelBuildOrder } from '../src/services/buildQueue.js';
import { loadLocked, recomputePlayerWealth } from '../src/services/planet.js';
import { planetView } from '../src/services/planetView.js';
import { giveInstrument, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

async function adopt(f: Fixture) {
  const migration = readFileSync(new URL('../drizzle/0152_aegis_balance.sql', import.meta.url), 'utf8');
  await f.db.transaction(async (tx) => {
    for (const statement of migration.split('--> statement-breakpoint')) {
      if (statement.trim()) await tx.execute(sql.raw(statement));
    }
  });
}

async function legacyWorld(level = 1, core = level, shield = 45) {
  const f = await seedWorld(1);
  const id = f.planetIds[0]!;
  await setLevel(f.db, id, 'CORE', core);
  await giveInstrument(f.db, id, 'AEGIS', level);
  await f.db.update(planets).set({ shield }).where(eq(planets.id, id));
  return { f, id };
}

it('scales charge proportionally and preserves resource balances and lazy anchors', async () => {
  const { f, id } = await legacyWorld();
  const [before] = await f.db.select().from(planets).where(eq(planets.id, id));
  await adopt(f);
  const [after] = await f.db.select().from(planets).where(eq(planets.id, id));
  expect(after).toEqual({ ...before, shield: 75 });
  const view = await f.db.transaction((tx) => planetView(tx, id, f.clock));
  expect(view.planet).toMatchObject({ shield: 75, shieldMax: 150, shieldPerHour: 53 });
});

it.each([0, 90, 180, -1])('clamps legacy charge %s to the new capacity range', async (shield) => {
  const { f, id } = await legacyWorld(1, 1, shield);
  await adopt(f);
  const [after] = await f.db.select().from(planets).where(eq(planets.id, id));
  expect(after!.shield).toBe(shield <= 0 ? 0 : 150);
});

it('uses the effective Core-capped Aegis level and preserves the rounded capacity ratio', async () => {
  const { f, id } = await legacyWorld(8, 3, 101.5);
  await adopt(f);
  const [after] = await f.db.select().from(planets).where(eq(planets.id, id));
  expect(after!.shield).toBe(169); // 101.5/203 × 338.
  const view = await f.db.transaction((tx) => planetView(tx, id, f.clock));
  expect(view.planet.shieldMax).toBe(338);
});

it('keeps an EMP-drained shield empty and resumes ordinary regeneration after expiry', async () => {
  const { f, id } = await legacyWorld(1, 1, 0);
  const empUntil = new Date(f.clock.now().getTime() + 60 * 60_000);
  await f.db.update(planets).set({ empUntil }).where(eq(planets.id, id));
  await adopt(f);
  f.clock.advance(30);
  const during = await f.db.transaction((tx) => loadLocked(tx, id, f.clock));
  expect(during.shield).toBe(0);
  f.clock.advance(60);
  const after = await f.db.transaction((tx) => loadLocked(tx, id, f.clock));
  expect(after.shield).toBeCloseTo(150 * SHIELD.regenPerHour / 2, 5);
});

it('adopts capitals, colonies and neutrals once and leaves worlds without an Aegis alone', async () => {
  const f = await seedWorld(4);
  for (const [i, id] of f.planetIds.slice(0, 3).entries()) {
    await giveInstrument(f.db, id, 'AEGIS', 1);
    await f.db.update(planets).set({ shield: 90, kind: i === 0 ? 'CAPITAL' : i === 1 ? 'COLONY' : 'NEUTRAL',
      ...(i === 2 ? { controllerPlayerId: null } : {}) })
      .where(eq(planets.id, id));
  }
  const noDome = (await f.db.select().from(planets).where(eq(planets.id, f.planetIds[3]!)))[0]!;
  await f.db.delete(satellites).where(and(eq(satellites.planetId, noDome.id), eq(satellites.type, 'AEGIS')));
  await f.db.update(planets).set({ shield: 0 }).where(eq(planets.id, noDome.id));
  const [before] = await f.db.select().from(planets).where(eq(planets.id, noDome.id));
  await adopt(f);
  await adopt(f);
  await runMigrations(f.db);
  for (const id of f.planetIds.slice(0, 3)) {
    const [after] = await f.db.select().from(planets).where(eq(planets.id, id));
    expect(after!.shield).toBe(150);
  }
  const [untouched] = await f.db.select().from(planets).where(eq(planets.id, noDome.id));
  expect(untouched).toEqual(before);
});

it('preserves the historical investment for installed levels, including levels above the Core', async () => {
  const { f, id } = await legacyWorld(8, 3, 203);
  const before = await f.db.transaction((tx) => recomputePlayerWealth(tx, f.playerIds[0]!));
  await adopt(f);
  const after = await f.db.transaction((tx) => recomputePlayerWealth(tx, f.playerIds[0]!));
  expect(after - before).toBe(1118090 - investedInInstrument('AEGIS', 8));
  const investment = await f.db.execute<{ value: number }>(sql`
    SELECT aegis_invested_value AS value FROM satellites WHERE planet_id = ${id} AND type = 'AEGIS'
  `);
  expect(investment[0]!.value).toBe(1118090);
});

it('matches the legacy price table through level 20 when recording historical investment', async () => {
  const { f, id } = await legacyWorld(20, 20, 199515);
  await adopt(f);
  const investment = await f.db.execute<{ value: number }>(sql`
    SELECT aegis_invested_value AS value FROM satellites WHERE planet_id = ${id} AND type = 'AEGIS'
  `);
  expect(investment[0]!.value).toBe(6963187093 + 5222390325);
  const [after] = await f.db.select().from(planets).where(eq(planets.id, id));
  expect(after!.shield).toBe(shieldHp(20));
});

it('retains old queue invoices and wealth on completion, then charges new prices', async () => {
  const { f, id } = await legacyWorld(1, 4, 90);
  await adopt(f);
  await grant(f.db, id, 100000, 100000);
  await raiseInstrument(f.db, id, 'AEGIS', f.clock);
  const [order] = await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, id));
  const oldCost = { alloy: 971, crystal: 728, deuterium: 0 };
  await f.db.update(buildOrders).set({ cost: oldCost }).where(eq(buildOrders.id, order!.id));
  await adopt(f);
  const [kept] = await f.db.select().from(buildOrders).where(eq(buildOrders.id, order!.id));
  expect(kept).toEqual({ ...order, cost: oldCost });
  f.clock.set(order!.readyAt);
  await f.db.transaction((tx) => loadLocked(tx, id, f.clock));
  const complete = () => f.db.transaction(
    (tx) => applyBuildCompletion(tx, order!.id, order!.readyAt.toISOString(), f.clock));
  const before = await f.db.transaction((tx) => recomputePlayerWealth(tx, f.playerIds[0]!));
  expect(await complete()).toBe(true);
  const after = await f.db.transaction((tx) => recomputePlayerWealth(tx, f.playerIds[0]!));
  expect(after).toBe(before);
  expect(await complete()).toBe(false);
  await raiseInstrument(f.db, id, 'AEGIS', f.clock);
  const [next] = (await f.db.select().from(buildOrders)).filter((row) => row.status === 'BUILDING');
  expect(next!.cost).toEqual(instrumentCost('AEGIS', 2));
});

it('keeps old queue cancellation refunds tied to the paid invoice', async () => {
  const { f, id } = await legacyWorld(1, 4, 90);
  await adopt(f);
  await grant(f.db, id, 100000, 100000);
  await raiseInstrument(f.db, id, 'AEGIS', f.clock);
  const [order] = await f.db.select().from(buildOrders);
  await f.db.update(buildOrders).set({ cost: { alloy: 971, crystal: 728, deuterium: 0 } })
    .where(eq(buildOrders.id, order!.id));
  await adopt(f);
  const result = await cancelBuildOrder(f.db, id, order!.id, f.clock);
  expect(result.refund.alloy).toBeGreaterThan(instrumentCost('AEGIS', 1).alloy);
});
