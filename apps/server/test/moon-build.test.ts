import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON, hashSeed, rollMoonBirth } from '@astera/rules';
import { buildOrders, moons, planets, seasons } from '../src/db/schema.js';
import { cancelBuildOrder } from '../src/services/buildQueue.js';
import { orderMoon } from '../src/services/moonBuild.js';
import { settleMoonBirth } from '../src/services/moonBirth.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveResearch, grant, levelWorld, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

/*
  V34 slice (S7, S8, V1, V29): a commander who holds Lunar Capture builds a Common moon on the CONSTRUCTION
  line for 25k alloy and 15k crystal in eight hours. One moon a world, one order a world. A moon born in
  battle while the order stands cancels the order and returns every unit of its price.
*/
describe('building a Common moon', () => {
  let f: Fixture;
  let home: string;

  beforeEach(async () => {
    f = await seedWorld(1, 20_195);
    home = f.planetIds[0]!;
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await setLevel(f.db, home, 'CORE', 12);
    await grant(f.db, home, 200_000, 200_000);
    await levelWorld(f.db, [home]);
    await giveResearch(f.db, home, 'LUNAR_CAPTURE');
    f.clock.advance(10);
  });
  afterAll(async () => { await (await testDb()).close(); });

  const tank = async () => (await f.db.select({ alloy: planets.alloy, crystal: planets.crystal, deuterium: planets.deuterium })
    .from(planets).where(eq(planets.id, home)))[0]!;
  const moonOf = async () => (await f.db.select().from(moons).where(eq(moons.planetId, home)))[0];
  const orderOf = async (id: string) => (await f.db.select().from(buildOrders).where(eq(buildOrders.id, id)))[0]!;

  it('takes the owner’s price, stands eight hours on the construction line, and leaves a Common moon', async () => {
    const before = await tank();
    const { orderId } = await orderMoon(f.db, home, f.clock);
    const after = await tank();
    expect(before.alloy - after.alloy).toBeCloseTo(25_000, 0);
    expect(before.crystal - after.crystal).toBeCloseTo(15_000, 0);
    expect(before.deuterium - after.deuterium).toBeCloseTo(0, 0);
    const order = await orderOf(orderId);
    expect(order).toMatchObject({ queue: 'CONSTRUCTION', kind: 'MOON', subject: 'COMMON', status: 'BUILDING' });
    expect(order.readyAt.getTime() - order.startedAt.getTime()).toBe(MOON.build.minutes * 60_000);

    f.clock.set(order.readyAt);
    await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
    expect(await moonOf()).toMatchObject({ rarity: 'COMMON', origin: 'BUILT', cracks: 0 });
    expect((await orderOf(orderId)).status).toBe('COMPLETED');
  });

  it('refuses without Lunar Capture, on a world with a moon, twice in a queue, and in a galaxy without moons', async () => {
    await expect(orderMoon(f.db, home, f.clock)).resolves.toBeDefined();
    await expect(orderMoon(f.db, home, f.clock)).rejects.toMatchObject({ code: 'MOON_ALREADY_ORDERED' });

    const g = await seedWorld(2, 20_196);
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, g.seasonId));
    const [noResearch, withMoon] = g.planetIds as [string, string];
    for (const id of g.planetIds) { await setLevel(g.db, id, 'CORE', 12); await grant(g.db, id, 200_000, 200_000); }
    await expect(orderMoon(g.db, noResearch, g.clock)).rejects.toMatchObject({ code: 'RESEARCH_LOCKED' });
    await giveResearch(g.db, withMoon, 'LUNAR_CAPTURE');
    await g.db.insert(moons).values({ planetId: withMoon, rarity: 'RARE', origin: 'SEED', visualSeed: 3, bornAt: g.clock.now() });
    await expect(orderMoon(g.db, withMoon, g.clock)).rejects.toMatchObject({ code: 'MOON_EXISTS' });
    await g.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion - 1 }).where(eq(seasons.id, g.seasonId));
    await g.db.delete(moons).where(eq(moons.planetId, withMoon));
    await expect(orderMoon(g.db, withMoon, g.clock)).rejects.toMatchObject({ code: 'MOONS_DISABLED' });
  });

  it('a player who cancels gets the ordinary cancel refund, and may order again', async () => {
    const before = await tank();
    const { orderId } = await orderMoon(f.db, home, f.clock);
    await cancelBuildOrder(f.db, home, orderId, f.clock);
    const after = await tank();
    expect(after.alloy).toBeLessThan(before.alloy);
    expect(after.alloy).toBeGreaterThan(before.alloy - 25_000);
    await expect(orderMoon(f.db, home, f.clock)).resolves.toBeDefined();
  });

  it('answers on the API for the world’s own commander only', async () => {
    const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`;
      const post = (planetId: string, payload: Record<string, unknown> = {}) => built.app.inject({
        method: 'POST', url: `/api/planets/${planetId}/moon/build`, headers: { authorization }, payload });
      expect((await post(home, { extra: true })).statusCode).toBe(400);
      const ok = await post(home);
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toHaveProperty('orderId');
      expect((await post(home)).json()).toMatchObject({ error: 'MOON_ALREADY_ORDERED' });
      expect((await post(randomUUID())).statusCode).not.toBe(200);
    } finally {
      await built.close();
    }
  });

  it('a moon born in battle while the order stands cancels it and returns the whole price (V1)', async () => {
    const before = await tank();
    const { orderId } = await orderMoon(f.db, home, f.clock);
    let battle = randomUUID();
    while (rollMoonBirth(hashSeed('moon-birth', battle), 100_000) === null) battle = randomUUID();
    const rarity = await f.db.transaction((tx) => settleMoonBirth(tx, { planetId: home, missionId: battle, wreck: 100_000, now: f.clock.now() }));
    expect(rarity).not.toBeNull();
    expect((await orderOf(orderId)).status).toBe('FAILED');
    const after = await tank();
    expect(after.alloy).toBeCloseTo(before.alloy, 0);
    expect(after.crystal).toBeCloseTo(before.crystal, 0);
    expect((await moonOf())?.origin).toBe('BATTLE');
    expect(await f.db.select().from(buildOrders).where(and(eq(buildOrders.planetId, home), eq(buildOrders.status, 'BUILDING')))).toEqual([]);
  });
});
