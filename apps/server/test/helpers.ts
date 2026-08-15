import { sql } from 'drizzle-orm';
import { createDb, type Db } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { loadEnv, type Env } from '../src/env.js';
import { FixedClock } from '../src/clock.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import { accounts } from '../src/db/schema.js';

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://blindspace:blindspace@localhost:5433/blindspace';

export const testEnv = (over: Record<string, string> = {}): Env =>
  loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    JWT_SECRET: 'test-secret-that-is-long-enough',
    WORKER_POLL_MS: '50',
    ...over,
  });

let shared: ReturnType<typeof createDb> | null = null;
let migrated = false;

export async function testDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  shared ??= createDb(TEST_DATABASE_URL, { max: 20 });
  if (!migrated) {
    await runMigrations(shared.db);
    migrated = true;
  }
  return { db: shared.db, close: shared.close };
}

/** Wipe everything between tests. CASCADE handles the foreign-key order. */
export async function truncateAll(db: Db): Promise<void> {
  await db.execute(sql`
    TRUNCATE request_log, notifications, scan_events, probe_reports, watches, battle_reports,
             scheduled_events, missions, units, satellites, buildings,
             asteroids, planets, players, seasons, shards, accounts
    RESTART IDENTITY CASCADE
  `);
}

export interface Fixture {
  db: Db;
  clock: FixedClock;
  seasonId: string;
  planetIds: string[];
  playerIds: string[];
  accountIds: string[];
}

/** A live season with `count` commanders already placed on it. */
export async function seedWorld(count = 2, seed = 4242): Promise<Fixture> {
  const { db } = await testDb();
  await truncateAll(db);

  const start = new Date('2026-01-01T00:00:00.000Z');
  const clock = new FixedClock(start);
  const { season } = await createSeason(db, {
    shardCode: `EU-TEST-${seed}`,
    seed,
    startsAt: start,
    playerCap: 60,
  });

  const accountIds: string[] = [];
  const playerIds: string[] = [];
  const planetIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const [account] = await db
      .insert(accounts)
      .values({ displayName: `Tester ${i}` })
      .returning();
    const joined = await joinSeason(db, account!.id, season.id, clock);
    accountIds.push(account!.id);
    playerIds.push(joined.playerId);
    planetIds.push(joined.planetId);
  }

  return { db, clock, seasonId: season.id, planetIds, playerIds, accountIds };
}

/**
 * Give a planet resources without going through the economy.
 *
 * Raises the production buildings far enough that the storage cap can actually
 * hold the amount. Without this the next lazy tick silently clamps the grant back
 * down to the cap, and the test fails with "not enough resources" while appearing
 * to have plenty — the helper would be lying to the test.
 */
export async function grant(
  db: Db,
  planetId: string,
  alloy: number,
  crystal = alloy / 4,
): Promise<void> {
  const { planets } = await import('../src/db/schema.js');
  const { eq } = await import('drizzle-orm');
  const { alloyRate, crystalRate, storageCap } = await import('@blindspace/rules');

  const levelFor = (amount: number, rate: (l: number) => number): number => {
    let level = 1;
    while (level < 40 && storageCap(rate(level)) < amount) level++;
    return level;
  };
  const refinery = levelFor(alloy, alloyRate);
  const extractor = levelFor(crystal, crystalRate);
  const core = Math.max(refinery, extractor);

  // Only ever RAISE. Lowering a level the test deliberately set would move the
  // thing under test, and a helper must never do that.
  await raiseTo(db, planetId, 'REFINERY', refinery);
  await raiseTo(db, planetId, 'EXTRACTOR', extractor);
  await raiseTo(db, planetId, 'CORE', core);
  await db.update(planets).set({ alloy, crystal }).where(eq(planets.id, planetId));
}

/** Raise a building to at least `level`, never lower it. */
async function raiseTo(db: Db, planetId: string, type: string, level: number): Promise<void> {
  const { buildings } = await import('../src/db/schema.js');
  const { and, eq } = await import('drizzle-orm');
  const [row] = await db
    .select()
    .from(buildings)
    .where(and(eq(buildings.planetId, planetId), eq(buildings.type, type)));
  if ((row?.level ?? 0) < level) await setLevel(db, planetId, type, level);
}

/** Set a building level directly, for arranging a test's preconditions. */
export async function setLevel(
  db: Db,
  planetId: string,
  type: string,
  level: number,
): Promise<void> {
  const { buildings } = await import('../src/db/schema.js');
  await db
    .insert(buildings)
    .values({ planetId, type, level })
    .onConflictDoUpdate({ target: [buildings.planetId, buildings.type], set: { level } });
}

/** Put units on a planet directly. */
export async function giveUnits(
  db: Db,
  planetId: string,
  fleet: Record<string, number>,
  location = 'home',
): Promise<void> {
  const { units } = await import('../src/db/schema.js');
  for (const [hull, count] of Object.entries(fleet)) {
    await db
      .insert(units)
      .values({ planetId, hull: hull as 'WASP', location, count })
      .onConflictDoUpdate({
        target: [units.planetId, units.hull, units.location],
        set: { count },
      });
  }
}
