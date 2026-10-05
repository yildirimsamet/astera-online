import { readFileSync } from 'node:fs';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ASTEROID_DYNAMIC } from '@astera/rules';
import { accounts, asteroidSpawnHours, botProfiles, buildings, planets, players, seasons } from '../src/db/schema.js';
import { countEligibleCommanders, openAsteroidHour } from '../src/services/asteroidSpawn.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * WHO PAYS FOR THE SKY. Plan §15.6 — *"Sybil sınırı şart"*.
 *
 * One rock an hour per active commander is the right rule and an open door: the count was a raw
 * `lastActiveAt` sweep, so a hundred free accounts logging in bought a hundred rocks an hour for
 * whoever made them. The gate is the two things a fake account does not have — a day in the season
 * AND a Core that took real production to raise.
 *
 * A NEW COMMANDER IS NOT LOCKED OUT OF ANYTHING. They fly at the same field; they simply do not
 * inflate it before they have played.
 */
describe('who counts toward the asteroid supply', () => {
  let f: Fixture;

  const settle = async (playerId: string, minutesAgo: number, core: number): Promise<void> => {
    await f.db.update(players)
      .set({
        joinedAt: new Date(f.clock.now().getTime() - minutesAgo * 60_000),
        lastActiveAt: f.clock.now(),
      })
      .where(eq(players.id, playerId));
    const [world] = await f.db.select().from(planets)
      .where(eq(planets.controllerPlayerId, playerId));
    if (world) await setLevel(f.db, world.id, 'CORE', core);
  };

  beforeEach(async () => {
    f = await seedWorld(3);
    f.clock.advance(60 * 24 * 3);
    // Push the season's opening back so nobody here is a founder; the founders have their own test.
    await f.db.update(seasons)
      .set({ startsAt: new Date(f.clock.now().getTime() - 60 * 24 * 10 * 60_000) })
      .where(eq(seasons.id, f.seasonId));
  });

  /**
   * THE FOUNDING POPULATION IS NOT A SYBIL INJECTION. Everybody present when the doors opened is
   * the baseline, so they count from the first hour — otherwise the sky is empty for a season's
   * first day, which is the one day a new commander decides whether to keep playing.
   */
  it('counts everybody who was there when the season opened', async () => {
    await f.db.update(seasons)
      .set({ startsAt: new Date(f.clock.now().getTime() - 60 * 60_000) })
      .where(eq(seasons.id, f.seasonId));
    for (const id of f.playerIds) await settle(id, 0, 1);
    expect(await countEligibleCommanders(f.db, f.seasonId, f.clock.now())).toBe(3);
  });

  it('counts a commander who has both the day and the Core', async () => {
    for (const id of f.playerIds) await settle(id, 0, 1);
    await settle(f.playerIds[0]!, ASTEROID_DYNAMIC.supply.graceMinutes + 60, ASTEROID_DYNAMIC.supply.coreLevel);
    expect(await countEligibleCommanders(f.db, f.seasonId, f.clock.now())).toBe(1);
  });

  it('refuses one that has the day but not the Core', async () => {
    for (const id of f.playerIds) await settle(id, ASTEROID_DYNAMIC.supply.graceMinutes + 60, 1);
    expect(await countEligibleCommanders(f.db, f.seasonId, f.clock.now())).toBe(0);
  });

  it('refuses one that has the Core but not the day', async () => {
    for (const id of f.playerIds) await settle(id, 10, ASTEROID_DYNAMIC.supply.coreLevel + 2);
    expect(await countEligibleCommanders(f.db, f.seasonId, f.clock.now())).toBe(0);
  });

  /** Eligible or not, a commander who has not played this hour never counts. */
  it('still asks whether they played at all', async () => {
    for (const id of f.playerIds) {
      await settle(id, ASTEROID_DYNAMIC.supply.graceMinutes + 60, ASTEROID_DYNAMIC.supply.coreLevel);
    }
    expect(await countEligibleCommanders(f.db, f.seasonId, f.clock.now())).toBe(3);
    await f.db.update(players).set({
      lastActiveAt: new Date(f.clock.now().getTime() - (ASTEROID_DYNAMIC.activeWindowMinutes + 5) * 60_000),
    });
    expect(await countEligibleCommanders(f.db, f.seasonId, f.clock.now())).toBe(0);
  });

  /**
   * Retired profiles still identify server commanders, but contribute nothing.
   * A single active bot rounds down to zero additional supply.
   */
  it('excludes retired bots and rounds down a single active bot', async () => {
    for (const id of f.playerIds) {
      await settle(id, ASTEROID_DYNAMIC.supply.graceMinutes + 60, ASTEROID_DYNAMIC.supply.coreLevel);
    }
    const now = f.clock.now();
    await f.db.insert(botProfiles).values([
      { accountId: f.accountIds[1]!, ordinal: 1, persona: 'raider', nextActionAt: now, createdAt: now },
      { accountId: f.accountIds[2]!, ordinal: 2, persona: 'raider', nextActionAt: now, createdAt: now, retiredAt: now },
    ]);
    expect(await countEligibleCommanders(f.db, f.seasonId, now)).toBe(1);
  });

  it('counts half of active bots without letting them bypass human gates at full weight', async () => {
    const now = f.clock.now();
    await settle(f.playerIds[0]!, ASTEROID_DYNAMIC.supply.graceMinutes + 60, ASTEROID_DYNAMIC.supply.coreLevel);
    for (const index of [1, 2]) await settle(f.playerIds[index]!, 0, 1);
    await f.db.insert(botProfiles).values([1, 2].map(index => ({
      accountId: f.accountIds[index]!, ordinal: index, persona: 'raider', nextActionAt: now, createdAt: now,
    })));
    expect(await countEligibleCommanders(f.db, f.seasonId, now)).toBe(2);
    await f.db.update(players).set({ lastActiveAt: new Date(now.getTime() - (ASTEROID_DYNAMIC.activeWindowMinutes + 1) * 60_000) }).where(eq(players.id, f.playerIds[2]!));
    expect(await countEligibleCommanders(f.db, f.seasonId, now)).toBe(1);
  });

  it.each([0, 1, 2, 3, 4])('adds half of %i active bots, rounding odd remainders down', async botCount => {
    f = await seedWorld(6);
    const now = f.clock.now();
    await f.db.insert(botProfiles).values(f.accountIds.slice(1).map((accountId, index) => ({
      accountId, ordinal: index + 1, persona: 'raider', nextActionAt: now, createdAt: now,
    })));
    await f.db.update(players).set({ lastActiveAt: new Date(now.getTime() - (ASTEROID_DYNAMIC.activeWindowMinutes + 1) * 60_000) })
      .where(sql`${players.id} != ${f.playerIds[0]}`);
    for (const id of f.playerIds.slice(1, botCount + 1)) await f.db.update(players).set({ lastActiveAt: now }).where(eq(players.id, id));
    expect(await countEligibleCommanders(f.db, f.seasonId, now)).toBe(1 + Math.floor(botCount / 2));
  });

  it('keeps retired bots out of a larger active population', async () => {
    const now = f.clock.now();
    await settle(f.playerIds[0]!, ASTEROID_DYNAMIC.supply.graceMinutes + 60, ASTEROID_DYNAMIC.supply.coreLevel);
    for (const index of [1, 2]) await settle(f.playerIds[index]!, 0, 1);
    await f.db.insert(botProfiles).values([1, 2].map(index => ({
      accountId: f.accountIds[index]!, ordinal: index, persona: 'raider', nextActionAt: now, createdAt: now,
    })));
    expect(await countEligibleCommanders(f.db, f.seasonId, now)).toBe(2);
    await f.db.update(botProfiles).set({ retiredAt: now }).where(eq(botProfiles.accountId, f.accountIds[2]!));
    expect(await countEligibleCommanders(f.db, f.seasonId, now)).toBe(1);
  });

  /**
   * AN ACCOUNT OLDER THAN THE SEASON IS NOT AN INJECTION EITHER. Owner instruction, 2026-09-27:
   * *"Var olan eski userlar legit sayılmalı."* Sybil is about accounts made to inflate a running
   * galaxy; one that existed before the doors opened was made for some earlier galaxy. So a veteran
   * who comes back on day five counts from the hour they play, without serving the day or the Core.
   */
  it('counts a commander whose account is older than the season, however late they arrived', async () => {
    for (const id of f.playerIds) await settle(id, 10, 1);
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.update(accounts)
      .set({ createdAt: new Date(season!.startsAt.getTime() - 60_000) })
      .where(eq(accounts.id, f.accountIds[0]!));
    expect(await countEligibleCommanders(f.db, f.seasonId, f.clock.now())).toBe(1);

    // Still only while they are playing.
    await f.db.update(players).set({
      lastActiveAt: new Date(f.clock.now().getTime() - (ASTEROID_DYNAMIC.activeWindowMinutes + 5) * 60_000),
    }).where(eq(players.id, f.playerIds[0]!));
    expect(await countEligibleCommanders(f.db, f.seasonId, f.clock.now())).toBe(0);
  });

  it('still gates an account opened after the season did', async () => {
    for (const id of f.playerIds) await settle(id, 10, 1);
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.update(accounts)
      .set({ createdAt: new Date(season!.startsAt.getTime() + 60_000) })
      .where(eq(accounts.id, f.accountIds[0]!));
    expect(await countEligibleCommanders(f.db, f.seasonId, f.clock.now())).toBe(0);
  });

  it('does not wave an old bot account through as a veteran', async () => {
    for (const id of f.playerIds) await settle(id, 10, 1);
    const now = f.clock.now();
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    await f.db.update(accounts).set({ createdAt: new Date(season!.startsAt.getTime() - 60_000) });
    await f.db.insert(botProfiles).values({
      accountId: f.accountIds[0]!, ordinal: 1, persona: 'raider', nextActionAt: now, createdAt: now,
    });
    expect(await countEligibleCommanders(f.db, f.seasonId, now)).toBe(2);
  });

  it('does not wave a bot through as a founder', async () => {
    await f.db.update(seasons)
      .set({ startsAt: new Date(f.clock.now().getTime() - 60 * 60_000) })
      .where(eq(seasons.id, f.seasonId));
    for (const id of f.playerIds) await settle(id, 0, 1);
    const now = f.clock.now();
    await f.db.insert(botProfiles).values({
      accountId: f.accountIds[0]!, ordinal: 1, persona: 'raider', nextActionAt: now, createdAt: now,
    });
    expect(await countEligibleCommanders(f.db, f.seasonId, now)).toBe(2);
  });
});

/**
 * AND THE HOUR RECORDS BOTH FIGURES, because they answer different questions.
 *
 * `eligiblePlayers` is what the galaxy actually held that hour — the input the rolling window
 * averages. `activePlayers` is what the hour SPAWNED against, frozen with the lanes so a rock's
 * identity survives every later balance change. Deriving the window from the second would filter
 * twice and a real rise would never arrive.
 */
describe('what an asteroid hour writes down', () => {
  let f: Fixture;

  beforeEach(async () => {
    f = await seedWorld(3);
    f.clock.advance(60 * 24 * 3);
    for (const id of f.playerIds) {
      await f.db.update(players)
        .set({
          joinedAt: new Date(f.clock.now().getTime() - (ASTEROID_DYNAMIC.supply.graceMinutes + 60) * 60_000),
          lastActiveAt: f.clock.now(),
        })
        .where(eq(players.id, id));
      const [world] = await f.db.select().from(planets).where(eq(planets.controllerPlayerId, id));
      if (world) {
        await f.db.update(buildings)
          .set({ level: ASTEROID_DYNAMIC.supply.coreLevel })
          .where(eq(buildings.planetId, world.id));
      }
    }
  });

  /** The lane only runs on a season that opted into the dynamic field. */
  const armDynamicField = async (): Promise<void> => {
    await f.db.update(seasons)
      .set({ status: 'live', asteroidDynamicFrom: new Date(f.clock.now().getTime() - 60 * 60_000) })
      .where(eq(seasons.id, f.seasonId));
  };

  it('stores the raw eligible count beside the figure it spawned against', async () => {
    await armDynamicField();
    const hourStartsAt = new Date(Math.floor(f.clock.now().getTime() / 3_600_000) * 3_600_000);
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt, now: f.clock.now() });
    const [row] = await f.db.select().from(asteroidSpawnHours)
      .where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    expect(row).toBeTruthy();
    expect(row!.eligiblePlayers).toBeGreaterThan(0);
    expect(row!.activePlayers).toBeGreaterThan(0);
  });

  /** With no history behind it, the first hour spawns against exactly what it counted. */
  it('spawns the first hour against its own count', async () => {
    await armDynamicField();
    const hourStartsAt = new Date(Math.floor(f.clock.now().getTime() / 3_600_000) * 3_600_000);
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt, now: f.clock.now() });
    const [row] = await f.db.select().from(asteroidSpawnHours)
      .where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    expect(row!.activePlayers).toBe(row!.eligiblePlayers);
  });

  /**
   * THE FOUNDING DAY SPAWNS AGAINST WHO IS ACTUALLY THERE. Owner decision, 2026-09-27.
   *
   * A new season's first hour opens before anybody has joined it, so it is written at zero — and
   * the rolling window then averaged that zero into the next five hours, holding back ~40% of the
   * rocks exactly while the galaxy fills. The founders are the baseline population, not a spike
   * to damp, so through the founding day each hour spawns against its own count.
   */
  const hourAfterAnEmptyOne = async (seasonOpenedHoursAgo: number) => {
    await armDynamicField();
    const hour = Math.floor(f.clock.now().getTime() / 3_600_000) * 3_600_000;
    await f.db.update(seasons)
      .set({ startsAt: new Date(hour - seasonOpenedHoursAgo * 3_600_000) })
      .where(eq(seasons.id, f.seasonId));
    await f.db.insert(asteroidSpawnHours).values({
      seasonId: f.seasonId,
      hourStartsAt: new Date(hour - 3_600_000),
      spawnFrom: new Date(hour - 3_600_000),
      activePlayers: 0,
      eligiblePlayers: 0,
      lanes: [],
    });
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: new Date(hour), now: f.clock.now() });
    const [row] = await f.db.select().from(asteroidSpawnHours)
      .where(and(eq(asteroidSpawnHours.seasonId, f.seasonId), eq(asteroidSpawnHours.hourStartsAt, new Date(hour))));
    return row!;
  };

  it('spawns against the raw count through the founding day', async () => {
    const row = await hourAfterAnEmptyOne(2);
    expect(row.eligiblePlayers).toBe(3);
    expect(row.activePlayers).toBe(3);
  });

  it('averages again once the founding day is over', async () => {
    const row = await hourAfterAnEmptyOne(ASTEROID_DYNAMIC.supply.graceMinutes / 60 + 2);
    expect(row.eligiblePlayers).toBe(3);
    expect(row.activePlayers).toBe(2);
  });

  /**
   * AN HOUR WRITTEN BEFORE THE COLUMN EXISTED IS NOT AN EMPTY GALAXY. Self-review 2026-09-23, R3.
   *
   * `eligible_players` arrived with a default of 0, and the rolling window averages it as a real
   * zero — so a mid-season deploy would have spawned the next five hours against a sixth of the
   * galaxy. Migration 0111 backfills those hours from the figure they did spawn against.
   */
  it('backfills the hours written before the column existed, so the window does not collapse', async () => {
    await armDynamicField();
    const hour = Math.floor(f.clock.now().getTime() / 3_600_000) * 3_600_000;
    for (let back = 5; back >= 1; back--) {
      f.clock.set(new Date(hour - back * 3_600_000 + 60_000));
      await openAsteroidHour(f.db, {
        seasonId: f.seasonId, hourStartsAt: new Date(hour - back * 3_600_000), now: f.clock.now(),
      });
    }
    // The pre-migration state: every one of those hours reads 0.
    await f.db.update(asteroidSpawnHours).set({ eligiblePlayers: 0 })
      .where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    const migration = readFileSync(
      new URL('../drizzle/0111_rapid_ezekiel_stane.sql', import.meta.url), 'utf8',
    );
    for (const statement of migration.split('--> statement-breakpoint').slice(1)) {
      await f.db.execute(sql.raw(statement));
    }

    f.clock.set(new Date(hour + 60_000));
    await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: new Date(hour), now: f.clock.now() });
    const rows = await f.db.select().from(asteroidSpawnHours)
      .where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    const current = rows.find((row) => row.hourStartsAt.getTime() === hour)!;
    expect(current.activePlayers).toBe(current.eligiblePlayers);
  });
});
