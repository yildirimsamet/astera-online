import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { createDb, type Db } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { loadEnv, type Env } from '../src/env.js';
import { FixedClock } from '../src/clock.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import { accounts } from '../src/db/schema.js';
import { engagementEndsAt } from '@astera/rules';

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://astera:astera@localhost:5433/astera_test';

/**
 * A guard, not a convention.
 *
 * `truncateAll` empties every table between tests. Pointed at the development
 * database it deletes the season you were playing — which is exactly what
 * happened the first time the client was playable and `pnpm verify` ran. The
 * suffix is the safety catch: a database this suite is allowed to erase has to
 * say so in its name.
 */
if (!/_test(\?|$)/.test(TEST_DATABASE_URL)) {
  throw new Error(
    `Refusing to run tests against "${TEST_DATABASE_URL}" — this suite truncates every ` +
      'table, and that is not a test database. Its name must end in `_test`.',
  );
}

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
             scheduled_events, missions, mining_runs, asteroid_claims, units, satellites,
             buildings, planets, players, seasons, shards, accounts
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

/**
 * An account, for a test that needs an owner rather than a sign-in.
 *
 * The password hash is a fixed literal and NOT a real one: hashing is deliberately
 * slow — that is what it is for — and a suite that mints a hundred accounts would
 * pay several seconds for a value no assertion ever reads. Tests that are actually
 * about signing in go through `/api/auth/register`, which hashes properly.
 */
export async function makeAccount(
  db: Db,
  name: string,
): Promise<{ id: string; username: string }> {
  const username = `${name.toLowerCase()}_${randomUUID().slice(0, 8)}`;
  const [account] = await db
    .insert(accounts)
    .values({ username, passwordHash: 'not-a-real-hash', displayName: name })
    .returning();
  return { id: account!.id, username };
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
    const account = await makeAccount(db, `Tester${i}`);
    const joined = await joinSeason(db, account.id, season.id, clock);
    accountIds.push(account.id);
    playerIds.push(joined.playerId);
    planetIds.push(joined.planetId);
  }

  /**
   * PUT THE TEST WORLD IN ONE NEIGHBOURHOOD.
   *
   * `pickSpawnSlot` fills the galaxy outward on purpose, so two joined players land
   * on opposite rims — about 1,665 units apart in this seed. That was harmless
   * while distance only decided flight times, and became wrong the moment D18 gave
   * the telescope a RANGE: every clarity-gradient test started failing on
   * `OUT_OF_RANGE`, testing the one thing it was not about.
   *
   * A cluster is also the more faithful arrangement. `game-design.md` says a player
   * has 8-15 planets within twelve minutes' travel and that this set "is their
   * world for the season" — neighbours, not antipodes. Range is covered by its own
   * test, which moves a planet away deliberately.
   */
  await placeInCluster(db, planetIds);

  return { db, clock, seasonId: season.id, planetIds, playerIds, accountIds };
}

/** Spacing between test planets. Inside Telescope L1's reach, outside minSeparation. */
export const TEST_SPACING = 150;

async function placeInCluster(db: Db, planetIds: readonly string[]): Promise<void> {
  const { planets } = await import('../src/db/schema.js');
  const { eq } = await import('drizzle-orm');
  for (const [i, id] of planetIds.entries()) {
    // A line rather than a ring: adjacent planets are exactly TEST_SPACING apart,
    // which makes distances in assertions easy to reason about by hand.
    await db
      .update(planets)
      .set({ x: i * TEST_SPACING, y: 0, z: 0 })
      .where(eq(planets.id, id));
  }
}

/** Move a planet far away, for the tests that are about distance. */
export async function placeAt(
  db: Db,
  planetId: string,
  at: { x: number; y?: number; z?: number },
): Promise<void> {
  const { planets } = await import('../src/db/schema.js');
  const { eq } = await import('drizzle-orm');
  await db
    .update(planets)
    .set({ x: at.x, y: at.y ?? 0, z: at.z ?? 0 })
    .where(eq(planets.id, planetId));
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
  const { alloyRate, crystalRate, storageCap } = await import('@astera/rules');

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

/**
 * PUT EVERY PLANET IN ONE DEVELOPMENT TIER BAND. D49.
 *
 * `canAttack` is a band measured in Core tiers, and `grant` raises a Core to
 * whatever will hold the resources it is asked for — so "make the defender rich"
 * quietly also means "make the defender six tiers taller than its attacker", and
 * every launch in the test is then refused for a reason the test is not about.
 *
 * This levels the whole world up to its tallest Core, so a fixture can arrange
 * whatever wealth it likes and still be a galaxy where people can fight. It only
 * ever RAISES: a level a test set deliberately is never moved down.
 */
export async function levelWorld(db: Db, planetIds: readonly string[]): Promise<void> {
  const { buildings } = await import('../src/db/schema.js');
  const { and, eq } = await import('drizzle-orm');

  let tallest = 1;
  for (const id of planetIds) {
    const [row] = await db
      .select()
      .from(buildings)
      .where(and(eq(buildings.planetId, id), eq(buildings.type, 'CORE')));
    tallest = Math.max(tallest, row?.level ?? 0);
  }
  for (const id of planetIds) await raiseTo(db, id, 'CORE', tallest);
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

/**
 * Install one thing on a planet directly, for arranging a test's preconditions.
 *
 * D25 split installed hardware in two: ground INSTRUMENTS carry a level, orbit
 * SATELLITES are always level 1 because they are bought once. Both live in the same
 * table, so the slot index is drawn from the two lists laid end to end and two calls
 * for different things can never collide on the (planet, slot) unique index. The
 * slot number is storage; what rations orbit is `satelliteSlots`.
 */
export async function giveInstrument(
  db: Db,
  planetId: string,
  type: 'TELESCOPE' | 'RADAR' | 'AEGIS' | 'VEIL',
  level: number,
): Promise<void> {
  const { INSTRUMENT_IDS } = await import('@astera/rules');
  await install(db, planetId, INSTRUMENT_IDS.indexOf(type), type, level);
}

/** Put a satellite in orbit. No level — D25 gives them no ladder. */
export async function giveSatellite(
  db: Db,
  planetId: string,
  type: 'FOUNDRY' | 'UPLINK' | 'DERRICK' | 'BEACON',
): Promise<void> {
  const { INSTRUMENT_IDS, SATELLITE_IDS } = await import('@astera/rules');
  await install(db, planetId, INSTRUMENT_IDS.length + SATELLITE_IDS.indexOf(type), type, 1);
}

async function install(
  db: Db,
  planetId: string,
  slot: number,
  type: string,
  level: number,
): Promise<void> {
  const { satellites } = await import('../src/db/schema.js');
  await db
    .insert(satellites)
    .values({ planetId, slot, type, level })
    .onConflictDoUpdate({ target: [satellites.planetId, satellites.slot], set: { type, level } });
}

/**
 * WHEN A RAID IS ACTUALLY OVER. D44.
 *
 * A fleet reaches its target at `arriveAt` and the battle is settled ten seconds
 * later — the engagement is a real server window, not an animation, so a test that
 * lands a raid has to advance past it before the worker will resolve anything.
 *
 * Exported rather than written out at each call site because `+ 10s` scattered
 * through six suites is six places to miss when the figure moves, and the symptom
 * would be a test that quietly asserts nothing happened.
 *
 * ONLY ATTACKS HAVE ONE. A probe and a mining run resolve at their own `arriveAt`
 * with no window at all, so calling this on one would advance the clock past the
 * moment being tested.
 */
export const settledAt = (arriveAt: Date): Date =>
  new Date(engagementEndsAt(arriveAt.getTime()));

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
