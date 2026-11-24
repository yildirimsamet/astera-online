import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON, MULTI_WORLD, generateGalaxy, seedMoonPlan, selectNeutralSlots } from '@astera/rules';
import { FixedClock } from '../src/clock.js';
import type { Db } from '../src/db/client.js';
import { moonSeedLedger, moons, neutralPlanetState, planets, scheduledEvents } from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { seedMoonAt } from '../src/services/moon.js';
import { wipeAllServers } from '../src/services/servers.js';
import { forceSeasonEnd, onNeutralCensus } from '../src/worker/handlers.js';
import { joinSettled, makeAccount, setLevel, testDb, truncateAll } from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/*
  F2c (plan §6.3, S22, E14): seeded moons come from the season seed and the WHOLE neutral
  selection, so a slot opened on day nine carries the moon it would have had on day one,
  and the ledger keeps a destroyed or carried seeded moon from ever coming back.
*/
describe('seeded moons', () => {
  let db: Db;
  let clock: FixedClock;
  const SEED = 44_551;

  beforeEach(async () => {
    ({ db } = await testDb());
    await truncateAll(db);
    clock = new FixedClock(new Date('2026-12-27T00:00:00.000Z'));
  });

  const open = (rulesetVersion: number) => createSeason(db, {
    shardCode: `EU-MOON-${String(rulesetVersion)}`, seed: SEED, startsAt: clock.now(), rulesetVersion,
  });

  const plan = () => seedMoonPlan(SEED, selectNeutralSlots(SEED, generateGalaxy(SEED, MULTI_WORLD.neutralSlotPool).slots));

  const neutralsWithMoons = async (seasonId: string) => db
    .select({ slotIndex: planets.slotIndex, rarity: moons.rarity, origin: moons.origin, cracks: moons.cracks })
    .from(planets)
    .innerJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
    .leftJoin(moons, eq(moons.planetId, planets.id))
    .where(eq(planets.seasonId, seasonId));

  it('gives every opened neutral exactly the moon its slot was planned, and nothing else', async () => {
    const { season } = await open(MOON.rulesetVersion);
    const planned = plan();
    const rows = await neutralsWithMoons(season.id);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.rarity ?? null).toBe(planned.get(row.slotIndex) ?? null);
      if (row.rarity) expect(row).toMatchObject({ origin: 'SEED', cracks: 0 });
    }
    const seeded = rows.filter((row) => row.rarity !== null).map((row) => row.slotIndex).sort();
    expect(seeded.length).toBeGreaterThan(0);
    const ledger = await db.select().from(moonSeedLedger).where(eq(moonSeedLedger.seasonId, season.id));
    expect(ledger.map((row) => row.slotIndex).sort()).toEqual(seeded);
  });

  it('seeds nothing in a season dealt an older ruleset', async () => {
    const { season } = await open(MOON.rulesetVersion - 1);
    expect(await db.select().from(moons)).toEqual([]);
    expect(await db.select().from(moonSeedLedger).where(eq(moonSeedLedger.seasonId, season.id))).toEqual([]);
  });

  it('a slot the census opens later still gets its planned moon', async () => {
    const { season } = await open(MOON.rulesetVersion);
    const before = (await neutralsWithMoons(season.id)).length;
    for (let index = 0; index < 16; index++) {
      const account = await makeAccount(db, `Moon census ${String(index)}`);
      const joined = await joinSettled(db, account.id, season.id, clock);
      await setLevel(db, joined.planetId, 'CORE', 9);
    }
    const [event] = await db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, season.id), eq(scheduledEvents.kind, 'neutral_census')));
    if (!event) throw new Error('missing neutral census');
    clock.set(event.resolveAt);
    await onNeutralCensus({ db, clock }, event);
    const rows = await neutralsWithMoons(season.id);
    expect(rows.length).toBeGreaterThan(before);
    const planned = plan();
    for (const row of rows) expect(row.rarity ?? null).toBe(planned.get(row.slotIndex) ?? null);
  });

  it('a galaxy wipe takes its moons with the worlds (§6.17)', async () => {
    const { season } = await open(MOON.rulesetVersion);
    expect((await db.select().from(moons)).length).toBeGreaterThan(0);
    const before = (await db.select({ id: moons.planetId }).from(moons)).map((row) => row.id);
    await forceSeasonEnd({ db, clock }, season.id);
    await wipeAllServers(db, clock, { count: 1, capacity: 4 });
    // The next cycle is dealt its own seeded moons (ruleset 20 default); none of the old ones survive.
    const after = await db.select({ id: moons.planetId, seasonId: planets.seasonId }).from(moons)
      .innerJoin(planets, eq(planets.id, moons.planetId));
    expect(after.filter((row) => before.includes(row.id) || row.seasonId === season.id)).toEqual([]);
  });

  it('never seeds a slot twice, even on a new world row in that slot', async () => {
    const { season } = await open(MOON.rulesetVersion);
    const [seededRow] = await db.select({ planetId: moons.planetId, slotIndex: planets.slotIndex })
      .from(moons).innerJoin(planets, eq(planets.id, moons.planetId)).where(eq(planets.seasonId, season.id)).limit(1);
    if (!seededRow) throw new Error('no seeded moon to destroy');
    // The moon is destroyed (S54); the world stays.
    await db.delete(moons).where(eq(moons.planetId, seededRow.planetId));
    const again = await db.transaction((tx) => seedMoonAt(tx, {
      seasonId: season.id, planetId: seededRow.planetId, slotIndex: seededRow.slotIndex, rarity: 'EPIC', now: clock.now(),
    }));
    expect(again).toBe(false);
    expect(await db.select().from(moons).where(eq(moons.planetId, seededRow.planetId))).toEqual([]);
  });
});
