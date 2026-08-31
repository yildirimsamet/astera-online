import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import { createDb, type Db } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { loadEnv, type Env } from '../src/env.js';
import { FixedClock } from '../src/clock.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import { accounts, buildOrders, researchOrders, scheduledEvents } from '../src/db/schema.js';
import { engagementEndsAt, type AsteroidSpec } from '@astera/rules';
import { applyBuildCompletion } from '../src/services/buildQueue.js';
import { privateAsteroidField } from '../src/services/asteroidField.js';
import { refreshSensorEpoch } from '../src/services/sensorHistory.js';

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

/**
 * THE SUITE OPTS OUT OF THE RATE LIMIT, AND SAYS SO OUT LOUD.
 *
 * Every request in this suite arrives from the same address, because `inject`
 * has only one. Under the production ceilings a single test file would exhaust
 * the login bucket in its third case and the rest of the run would fail on 429s
 * that have nothing to do with what is being tested.
 *
 * Raised rather than switched off, so the plugin is still in the stack for every
 * test — the counting, the store and the rebuilt error body are all live, and
 * anything that would break under them breaks here too. `ratelimit.test.ts`
 * lowers them back down to real numbers and asserts the behaviour directly.
 */
export const testEnv = (over: Record<string, string> = {}): Env =>
  loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    JWT_SECRET: 'test-secret-that-is-long-enough',
    WORKER_POLL_MS: '50',
    RATE_LIMIT_MAX: '100000',
    RATE_LIMIT_AUTH_MAX: '100000',
    RATE_LIMIT_SIGNUP_MAX: '100000',
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
    TRUNCATE announcement_reads, announcements, feedback_entries,
             account_rewards, reward_grants, request_log, notifications, scan_events,
             probe_world_memories, probe_reports, watches,
             clan_loot_shares, clan_score_events, clan_raid_roster, attack_commitments,
             clan_aid_commitments, clan_messages, clan_events, clan_requests,
             clan_ceasefires, clan_memberships, clans,
             strategic_interceptions, strategic_impacts, battle_reports,
             scheduled_events, research_orders, build_orders, strategic_assets, missions, mining_runs,
             asteroid_claims, units,
             sensor_epochs, satellites, buildings, planet_research, player_research,
             neutral_planet_state, planets, players,
             seasons, shards, accounts
    RESTART IDENTITY CASCADE
  `);
}

export interface Fixture {
  db: Db;
  clock: FixedClock;
  seasonId: string;
  /** The season seed, so a test can ask the field which rocks are actually up. */
  seed: number;
  /** The server-private schedule; tests must not mistake the decorative public seed for authority. */
  asteroids: AsteroidSpec[];
  planetIds: string[];
  playerIds: string[];
  accountIds: string[];
}

/**
 * Finish queued construction while arranging a test that is about something else.
 *
 * Queue/worker behaviour has its own suite. Older service tests need the same
 * explicit boundary a real player crosses: place the order, advance to the named
 * instant, apply the event. Keeping that in one helper makes an accidental return
 * to instant construction impossible to hide in test setup.
 */
export async function settleBuilds(fixture: Fixture, planetId?: string): Promise<void> {
  for (let guard = 0; guard < 100; guard += 1) {
    const [order] = await fixture.db
      .select()
      .from(buildOrders)
      .where(and(
        eq(buildOrders.status, 'BUILDING'),
        ...(planetId ? [eq(buildOrders.planetId, planetId)] : []),
      ))
      .orderBy(asc(buildOrders.readyAt))
      .limit(1);
    if (!order) {
      const [research] = await fixture.db
        .select()
        .from(researchOrders)
        .where(and(
          eq(researchOrders.status, 'BUILDING'),
          ...(planetId ? [eq(researchOrders.fundingPlanetId, planetId)] : []),
        ))
        .orderBy(asc(researchOrders.readyAt))
        .limit(1);
      if (!research) return;
      if (research.readyAt > fixture.clock.now()) fixture.clock.set(research.readyAt);
      const { applyResearchCompletion } = await import('../src/services/research.js');
      await fixture.db.transaction(async (tx) => {
        await applyResearchCompletion(
          tx,
          research.id,
          research.readyAt.toISOString(),
          fixture.clock,
        );
        await tx
          .update(scheduledEvents)
          .set({ status: 'done', claimedAt: null })
          .where(and(
            eq(scheduledEvents.kind, 'research_complete'),
            eq(scheduledEvents.refId, research.id),
          ));
      });
      continue;
    }
    if (order.readyAt > fixture.clock.now()) fixture.clock.set(order.readyAt);
    await fixture.db.transaction(async (tx) => {
      await applyBuildCompletion(tx, order.id, order.readyAt.toISOString(), fixture.clock);
      await tx
        .update(scheduledEvents)
        .set({ status: 'done', claimedAt: null })
        .where(and(
          eq(scheduledEvents.kind, 'build_complete'),
          eq(scheduledEvents.refId, order.id),
        ));
    });
  }
  throw new Error('settleBuilds exceeded 100 orders');
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
    rulesetVersion: 1,
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

  // Joining opens the initial sensor epoch before this fixture moves its worlds.
  // Refresh at the same instant so asteroid discovery tests record the arranged
  // coordinates, not the spawn coordinates that only existed during setup.
  for (const planetId of planetIds) await refreshSensorEpoch(db, planetId, clock.now());

  return {
    db,
    clock,
    seasonId: season.id,
    seed,
    asteroids: privateAsteroidField(season.asteroidKey),
    planetIds,
    playerIds,
    accountIds,
  };
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
  const { PLANET_START, alloyRate, crystalRate, storageCap } = await import('@astera/rules');

  /**
   * Sized against the VAULT-0 ceiling, deliberately.
   *
   * The store grows with the Vault now, so a level chosen against a tall store
   * would not actually hold the grant on a planet with no Vault — and this helper
   * never raises the Vault. Choosing the conservative level means the grant always
   * fits, whatever the test has done to the planet.
   */
  const levelFor = (amount: number, rate: (l: number) => number): number => {
    let level = 1;
    while (level < 40 && storageCap(rate(level), 0) < amount) level++;
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
  /*
    FUEL AS WELL, SINCE T6. `grant` exists so a test can arrange wealth and get on
    with what it is actually about, and after fuel a rich world that cannot launch
    is not a rich world. Sized off the grant rather than fixed, so a test that asks
    for a big purse gets a fleet it can actually fly.
  */
  await db
    .update(planets)
    .set({ alloy, crystal, deuterium: Math.max(PLANET_START.deuterium, alloy / 10) })
    .where(eq(planets.id, planetId));
}

/**
 * Fill a world's tank, for a test that is about something other than fuel.
 *
 * Since T6 every launch burns deuterium, so a suite about silhouettes, windows or
 * arrivals still has to be able to get a fleet off the ground. Deliberately
 * generous and deliberately separate from `grant`: a test that IS about fuel wants
 * to set the figure itself.
 */
export async function fuelUp(db: Db, planetId: string, deuterium = 100_000): Promise<void> {
  const { planets } = await import('../src/db/schema.js');
  const { eq } = await import('drizzle-orm');
  await db.update(planets).set({ deuterium }).where(eq(planets.id, planetId));
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
  const { planets, units } = await import('../src/db/schema.js');
  const { eq } = await import('drizzle-orm');
  const [world] = await db
    .select({ ownerPlayerId: planets.controllerPlayerId })
    .from(planets)
    .where(eq(planets.id, planetId));
  if (!world?.ownerPlayerId) throw new Error('giveUnits needs a controlled planet');
  for (const [hull, count] of Object.entries(fleet)) {
    await db
      .insert(units)
      .values({ planetId, ownerPlayerId: world.ownerPlayerId, hull: hull as 'WASP', location, count })
      .onConflictDoUpdate({
        target: [units.planetId, units.hull, units.location],
        set: { ownerPlayerId: world.ownerPlayerId, count },
      });
  }
}

/**
 * Hand a commander a completed project, for a test that is about something else.
 *
 * T7 moved research off the planet, so a fixture that reaches into storage has to
 * reach into the COMMANDER's. Takes a planet id because that is what every caller
 * already has, and resolves the owner itself — a test that had to look up a player
 * id first would be a test about plumbing.
 */
export async function giveResearch(
  db: Db,
  planetId: string,
  projectId: string,
  level = 1,
): Promise<void> {
  const { planets, playerResearch } = await import('../src/db/schema.js');
  const { eq } = await import('drizzle-orm');
  const [world] = await db
    .select({ playerId: planets.controllerPlayerId })
    .from(planets)
    .where(eq(planets.id, planetId));
  if (!world?.playerId) throw new Error('giveResearch needs a controlled planet');
  await db
    .insert(playerResearch)
    .values({
      playerId: world.playerId,
      projectId: projectId as never,
      level,
      completedAt: new Date(),
    })
    // Upsert the LEVEL: a fixture that hands out rung two after rung one is
    // arranging a ladder, and `do nothing` would silently leave it on rung one.
    .onConflictDoUpdate({
      target: [playerResearch.playerId, playerResearch.projectId],
      set: { level },
    });
}
