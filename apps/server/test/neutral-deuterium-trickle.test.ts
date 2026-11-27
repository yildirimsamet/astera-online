import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { MULTI_WORLD, SERVERS, neutralDeuteriumCap, type NeutralTier } from '@astera/rules';
import { FixedClock } from '../src/clock.js';
import { neutralPlanetState, planets } from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { standingAt } from '../src/services/intel.js';
import { advanceNeutralEconomy, reinforceNeutral } from '../src/services/neutral.js';
import { testDb, truncateAll } from './helpers.js';

/**
 * CARETAKER DEUTERIUM TRICKLE — owner, 2026-11-27. T2 and T3 worlds refill the seeded deuterium
 * stockpile at `deuteriumPerHour`; T1 is untouched. The same figure must reach the battle, the
 * probe and the reinforcement, or one of them reads a world the others do not see.
 */

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

const HOURS = 10;

async function galaxy() {
  const { db } = await testDb();
  await truncateAll(db);
  const clock = new FixedClock(new Date('2026-08-01T00:00:00.000Z'));
  const { season } = await createSeason(db, {
    shardCode: 'EU-D2TR',
    seed: 4417,
    startsAt: clock.now(),
    playerCap: SERVERS.capacity,
    rulesetVersion: MULTI_WORLD.rulesetVersion,
  });
  const rows = await db
    .select({ world: planets, state: neutralPlanetState })
    .from(planets)
    .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id));
  const later = new Date(clock.now().getTime() + HOURS * 3_600_000);
  return { db, clock, season, rows, later };
}

const worldOf = async (db: Awaited<ReturnType<typeof galaxy>>['db'], id: string) =>
  (await db.select().from(planets).where(eq(planets.id, id)))[0]!;

describe('caretaker deuterium trickle', () => {
  it.each([1, 2, 3] as const)('seeds a tier %i world with exactly its refill ceiling', async (tier: NeutralTier) => {
    const g = await galaxy();
    const sample = g.rows.find((row) => row.state.tier === tier)!;
    expect(sample.world.deuterium).toBe(neutralDeuteriumCap(tier));
  });

  it.each([2, 3] as const)('refills a drained tier %i world by rate x hours and writes it', async (tier: NeutralTier) => {
    const g = await galaxy();
    const target = g.rows.find((row) => row.state.tier === tier)!.world;
    await g.db.update(planets).set({ deuterium: 100 }).where(eq(planets.id, target.id));
    const advanced = await g.db.transaction((tx) => advanceNeutralEconomy(tx, target.id, g.later));
    const expected = 100 + MULTI_WORLD.neutral[tier].deuteriumPerHour * HOURS;
    expect(advanced?.deuterium).toBeCloseTo(expected, 6);
    expect((await worldOf(g.db, target.id)).deuterium).toBeCloseTo(expected, 6);
  });

  it('never refills past the seeded stockpile', async () => {
    const g = await galaxy();
    const target = g.rows.find((row) => row.state.tier === 2)!.world;
    const cap = neutralDeuteriumCap(2);
    await g.db.update(planets).set({ deuterium: cap - 10 }).where(eq(planets.id, target.id));
    await g.db.transaction((tx) => advanceNeutralEconomy(tx, target.id, g.later));
    expect((await worldOf(g.db, target.id)).deuterium).toBe(cap);
  });

  it('leaves a tier 1 world exactly as it was', async () => {
    const g = await galaxy();
    const target = g.rows.find((row) => row.state.tier === 1)!.world;
    await g.db.update(planets).set({ deuterium: 100 }).where(eq(planets.id, target.id));
    await g.db.transaction((tx) => advanceNeutralEconomy(tx, target.id, g.later));
    expect((await worldOf(g.db, target.id)).deuterium).toBe(100);
  });

  it('lets a probe read the refilled stock without writing it', async () => {
    const g = await galaxy();
    const target = g.rows.find((row) => row.state.tier === 2)!.world;
    await g.db.update(planets).set({ deuterium: 100 }).where(eq(planets.id, target.id));
    const row = await worldOf(g.db, target.id);
    const seen = await g.db.transaction((tx) => standingAt(tx, row, g.later));
    expect(seen.deuterium).toBeCloseTo(100 + MULTI_WORLD.neutral[2].deuteriumPerHour * HOURS, 6);
    expect((await worldOf(g.db, target.id)).deuterium).toBe(100);
  });

  it('keeps the refilled deuterium when the guard is rebuilt', async () => {
    const g = await galaxy();
    const target = g.rows.find((row) => row.state.tier === 2)!.world;
    await g.db.update(planets).set({ deuterium: 100 }).where(eq(planets.id, target.id));
    await g.db.transaction((tx) => reinforceNeutral(tx, target.id, g.later));
    expect((await worldOf(g.db, target.id)).deuterium)
      .toBeCloseTo(100 + MULTI_WORLD.neutral[2].deuteriumPerHour * HOURS, 6);
  });
});
