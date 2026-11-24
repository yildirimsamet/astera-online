import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON, MULTI_WORLD, generateGalaxy, seedMoonPlan, selectNeutralSlots, type MoonRarity } from '@astera/rules';
import { FixedClock } from '../src/clock.js';
import type { Db } from '../src/db/client.js';
import { moonSeedLedger, moons, neutralPlanetState, planets, seasons } from '../src/db/schema.js';
import { seasonHasMoons } from '../src/services/moon.js';
import { activateMoons } from '../src/services/moonActivation.js';
import { createSeason } from '../src/services/season.js';
import { joinSettled, makeAccount, testDb, truncateAll } from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/*
  MOONS ARRIVE IN THE LIVE SEASON (owner, 2026-11-24). A season dealt ruleset 19 opens moons from one
  explicit instant (`seasons.moons_starts_at`), never by a ruleset bump: galaxies of one cycle must keep
  equal rulesets for returns and transfers. At that instant every commander's colony gets a moon by the
  tier of its slot (T1 Common, T2 Rare, T3 Epic), so nobody's world is handed to someone else; capitals get
  none; unowned neutrals get the season's seeded plan (§6.3). Everything goes through the seed ledger.
*/
const SEED = 44_551;
const BY_TIER: Record<1 | 2 | 3, MoonRarity> = { 1: 'COMMON', 2: 'RARE', 3: 'EPIC' };

describe('activating moons in a live season', () => {
  let db: Db;
  let clock: FixedClock;
  let seasonId: string;
  let colonies: { planetId: string; tier: 1 | 2 | 3 }[];
  let capitals: string[];

  beforeEach(async () => {
    ({ db } = await testDb());
    await truncateAll(db);
    clock = new FixedClock(new Date('2026-11-25T00:00:00.000Z'));
    const { season } = await createSeason(db, {
      shardCode: 'EU-LIVE', seed: SEED, startsAt: clock.now(), rulesetVersion: MOON.rulesetVersion - 1,
    });
    seasonId = season.id;
    const a = await joinSettled(db, (await makeAccount(db, 'Moon holder')).id, seasonId, clock);
    const b = await joinSettled(db, (await makeAccount(db, 'Moon rival')).id, seasonId, clock);
    capitals = [a.planetId, b.planetId];
    // A holds one colony of each tier, taken from the neutrals; and B's capital, taken in battle.
    const neutrals = await db.select({ planetId: neutralPlanetState.planetId, tier: neutralPlanetState.tier })
      .from(neutralPlanetState).innerJoin(planets, eq(planets.id, neutralPlanetState.planetId))
      .where(eq(planets.seasonId, seasonId));
    colonies = ([1, 2, 3] as const).map((tier) => {
      const row = neutrals.find((n) => n.tier === tier);
      if (!row) throw new Error(`no T${String(tier)} neutral`);
      return { planetId: row.planetId, tier };
    });
    const owned = [...colonies.map((c) => c.planetId), b.planetId];
    await db.update(planets).set({ kind: 'COLONY', controllerPlayerId: a.playerId, statsOwnerPlayerId: a.playerId })
      .where(inArray(planets.id, owned));
    await db.delete(neutralPlanetState).where(inArray(neutralPlanetState.planetId, colonies.map((c) => c.planetId)));
  });

  const activate = (apply = true) => activateMoons(db, { seasonId, clock, apply });
  const moonOf = async (planetId: string) => (await db.select().from(moons).where(eq(moons.planetId, planetId)))[0];
  const plan = () => seedMoonPlan(SEED, selectNeutralSlots(SEED, generateGalaxy(SEED, MULTI_WORLD.neutralSlotPool).slots));

  it('gives every colony the moon of its tier, capitals none, and unowned neutrals the seeded plan', async () => {
    const result = await activate();
    expect(result).toMatchObject({ status: 'ACTIVATED', applied: true, colonies: { COMMON: 1, RARE: 1, EPIC: 1 } });
    for (const colony of colonies) {
      expect(await moonOf(colony.planetId)).toMatchObject({ rarity: BY_TIER[colony.tier], origin: 'SEED', cracks: 0 });
    }
    // Neither a capital nor a captured capital is a neutral slot.
    for (const capital of capitals) expect(await moonOf(capital)).toBeUndefined();
    const planned = plan();
    const unowned = await db.select({ planetId: planets.id, slotIndex: planets.slotIndex }).from(planets)
      .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id)).where(eq(planets.seasonId, seasonId));
    let seeded = 0;
    for (const world of unowned) {
      const moon = await moonOf(world.planetId);
      expect(moon?.rarity ?? null).toBe(planned.get(world.slotIndex) ?? null);
      if (moon) seeded += 1;
    }
    expect(seeded).toBeGreaterThan(0);
    expect(Object.values(result.neutrals).reduce((sum, n) => sum + n, 0)).toBe(seeded);
    const ledger = await db.select().from(moonSeedLedger).where(eq(moonSeedLedger.seasonId, seasonId));
    expect(ledger).toHaveLength(seeded + colonies.length);
  });

  it('opens moons from that instant without touching the ruleset', async () => {
    expect(await seasonHasMoons(db, seasonId)).toBe(false);
    await activate();
    const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
    expect(season).toMatchObject({ rulesetVersion: MOON.rulesetVersion - 1, moonsStartsAt: clock.now() });
    expect(await seasonHasMoons(db, seasonId)).toBe(true);
  });

  it('previews the counts and writes nothing', async () => {
    const preview = await activate(false);
    expect(preview).toMatchObject({ status: 'READY', applied: false, colonies: { COMMON: 1, RARE: 1, EPIC: 1 } });
    expect(await db.select().from(moons)).toEqual([]);
    expect(await db.select().from(moonSeedLedger)).toEqual([]);
    expect((await db.select().from(seasons).where(eq(seasons.id, seasonId)))[0]!.moonsStartsAt).toBeNull();
    const applied = await activate();
    expect(applied.neutrals).toEqual(preview.neutrals);
  });

  it('activates once: a race or a retry places no second moon', async () => {
    const results = await Promise.all([activate(), activate()]);
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    const count = (await db.select().from(moons)).length;
    clock.advance(10);
    expect(await activate()).toMatchObject({ status: 'ALREADY_ACTIVE', applied: false });
    expect(await db.select().from(moons)).toHaveLength(count);
  });

  it('keeps a moon a colony already has', async () => {
    const t1 = colonies[0]!.planetId;
    await db.insert(moons).values({ planetId: t1, rarity: 'RARE', origin: 'BATTLE', visualSeed: 7, bornAt: clock.now() });
    await activate();
    expect(await moonOf(t1)).toMatchObject({ rarity: 'RARE', origin: 'BATTLE' });
  });

  it('refuses a closed season and a galaxy that never has moons; a season dealt moons needs nothing', async () => {
    const { season: waiting } = await createSeason(db, {
      shardCode: 'EU-WAIT', seed: 7, startsAt: clock.now(), rulesetVersion: MOON.rulesetVersion - 1, role: 'WAITING',
    });
    await expect(activateMoons(db, { seasonId: waiting.id, clock, apply: true })).rejects.toMatchObject({ code: 'MOONS_DISABLED' });
    const { season: dealt } = await createSeason(db, { shardCode: 'EU-DEALT', seed: 8, startsAt: clock.now(), rulesetVersion: MOON.rulesetVersion });
    expect(await activateMoons(db, { seasonId: dealt.id, clock, apply: true })).toMatchObject({ status: 'DEALT', applied: false });
    await db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, seasonId));
    await expect(activate()).rejects.toMatchObject({ code: 'SEASON_FROZEN' });
  });
});
