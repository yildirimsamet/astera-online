import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  check,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { CombatRound, Fleet, Grade, HullId } from '@astera/rules';

/**
 * Eighteen tables. Nothing here stores a value that can be derived from a formula
 * and a clock — no fleet positions, no asteroid coordinates, no resource ticks.
 *
 * TIME MODEL: everything is `timestamptz`. The rules package works in minutes
 * since season start; conversion happens once, at the service boundary, in
 * src/clock.ts. There is exactly one clock in this system.
 */

export const seasonStatus = pgEnum('season_status', ['pending', 'live', 'frozen', 'wiped']);
export const missionKind = pgEnum('mission_kind', ['attack', 'probe', 'return']);
export const missionStatus = pgEnum('mission_status', ['in_flight', 'resolved', 'cancelled']);
export const eventStatus = pgEnum('event_status', ['pending', 'processing', 'done', 'failed']);
export const eventKind = pgEnum('event_kind', [
  'mission_arrival',
  'radar_warning',
  'asteroid_impact',
  'season_end',
  /** A Prospector reaching the rock it was aimed at, and getting home again. D19. */
  'mining_arrival',
  'mining_return',
]);
/**
 * WHAT THE GAME TELLS YOU, AND NOTHING ELSE. D45.
 *
 * Seven kinds, and the list is closed: each one is a moment the player could not
 * have predicted and can act on. `game-design.md` said four, and it said so while
 * the "while you were gone" overlay carried the other three — deleting that
 * overlay (D23) orphaned them rather than moving them, which is how a player came
 * to be told when they were raided and never told what their own raid did.
 *
 * Still excluded, permanently: "your storage is full", "we miss you", streaks and
 * login bonuses. Every one of those exists to manufacture a reason to open the
 * app rather than to report something that happened.
 *
 * NEW VALUES GO ON THE END. `ALTER TYPE ... ADD VALUE` appends, and a reordered
 * list makes drizzle generate a migration that rebuilds the type.
 */
export const notificationKind = pgEnum('notification_kind', [
  'incoming_fleet',
  'fleet_returned',
  'raided',
  'scan_detected',
  /** Your own raid resolved — the outcome step of the core loop. D45. */
  'raid_result',
  /** A probe you sent is home and its report is readable. D45. */
  'probe_report',
  /** A system opened up. Design Law #2, which had no delivery mechanism at all. D45. */
  'unlock',
]);
export type NotificationKind = (typeof notificationKind.enumValues)[number];

/* ── identity ───────────────────────────────────────────────── */

/**
 * Global and permanent. Survives every wipe; carries record, never power.
 *
 * IDENTITY IS A NAME AND A PASSWORD (D21). `username` is stored already folded to
 * lower case and is what the unique index guards, so "Vantage" and "vantage" are
 * the same commander and cannot both be registered. `displayName` keeps whatever
 * casing the player typed, because that is the name other people read.
 *
 * `email` stays nullable and unused. Recovery is a later feature; a column that is
 * already there costs nothing, and dropping it would take the unique index with it.
 */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),
  username: text('username').notNull(),
  /** `scrypt$N$r$p$salt$hash`, all base64url. Never a bare digest. See auth/password.ts. */
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  lifetime: jsonb('lifetime').$type<Record<string, number>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('accounts_email_idx').on(t.email),
  uniqueIndex('accounts_username_idx').on(t.username),
]);

/**
 * A galaxy, as an address players can choose between. D21.
 *
 * `ordinal` is the fill order and the whole of the sequential-fill rule: the only
 * shard anyone may join is the lowest-ordinal one that still has a free slot.
 * Storing it rather than sorting by code keeps that rule readable — and keeps
 * `EU-10` from sorting between `EU-1` and `EU-2`, which is what happens the moment
 * anyone orders these by name.
 */
export const shards = pgTable('shards', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  /** What the server list calls it. The code is the address; this is the name. */
  name: text('name').notNull().default(''),
  ordinal: integer('ordinal').notNull().default(1),
  region: text('region').notNull().default('eu'),
  playerCap: integer('player_cap').notNull().default(50),
}, (t) => [
  uniqueIndex('shards_code_idx').on(t.code),
  uniqueIndex('shards_ordinal_idx').on(t.ordinal),
]);

export const seasons = pgTable('seasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  shardId: uuid('shard_id').notNull().references(() => shards.id),
  /** The galaxy is regenerated from this — never stored slot by slot. */
  seed: integer('seed').notNull(),
  status: seasonStatus('status').notNull().default('pending'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
}, (t) => [index('seasons_shard_status_idx').on(t.shardId, t.status)]);

/* ── the season world ───────────────────────────────────────── */

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  name: text('name').notNull(),
  /** Dominion is the ladder: taken − lost. Stored as two counters. */
  dominionTaken: real('dominion_taken').notNull().default(0),
  dominionLost: real('dominion_lost').notNull().default(0),
  /** Denormalised for the rank floor check and the Wealth display. */
  wealth: real('wealth').notNull().default(0),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  /** Anchors the "while you were gone" window. Advanced only by the return endpoint. */
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * Last authenticated request, for the population figure on the server list. D21.
   *
   * Deliberately NOT `lastSeenAt`, which anchors the return payload and may be
   * advanced exactly once a session — reusing it for presence would consume the
   * news a returning player came back for. Written at most once a minute per
   * player (see services/presence.ts), so a live shard costs one small update per
   * commander per minute and never a read.
   */
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * Which unlocks this player has already been SHOWN.
   *
   * What is unlocked is derived from history, not stored — that cannot drift. This
   * only records what has already been announced, so the return overlay can say
   * "new" exactly once.
   */
  unlocksSeen: jsonb('unlocks_seen').$type<string[]>().notNull().default([]),
}, (t) => [
  /**
   * ONE ACCOUNT, ONE PLANET, ONE GALAXY. D21.
   *
   * Unique on the account ALONE, not on (account, season) as it was while a single
   * shard existed. That older index permitted exactly the thing D21 forbids: one
   * player row per season, and ten seasons means ten planets.
   *
   * Enforced here rather than only in the service because the check and the insert
   * cannot be made atomic in application code — two simultaneous joins to two
   * different galaxies both read "no existing player" and both proceed. The index
   * is what makes the loser fail instead of succeeding. `joinServer` reads the
   * violation and turns it into ALREADY_PLACED.
   *
   * A wipe deletes these rows, which is what releases the constraint for the next
   * season. Nothing about a player is lost by that: what survives a season is the
   * account record, and the wipe folds it into `accounts.lifetime` first.
   */
  uniqueIndex('players_account_idx').on(t.accountId),
  index('players_ladder_idx').on(t.seasonId, t.dominionTaken, t.dominionLost),
  index('players_active_idx').on(t.seasonId, t.lastActiveAt),
]);

export const planets = pgTable('planets', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  name: text('name').notNull(),
  /** Index into the generated slot list — coordinates are derived, not stored. */
  slotIndex: integer('slot_index').notNull(),
  x: real('x').notNull(),
  y: real('y').notNull(),
  z: real('z').notNull(),
  alloy: real('alloy').notNull().default(500),
  crystal: real('crystal').notNull().default(120),
  /**
   * Production that has not been collected yet. D16.
   *
   * Separate columns rather than folded into `alloy`/`crystal` because the two
   * piles are governed by different rules: only storage is spendable, only storage
   * is covered by the vault floor, and a raid takes the buffer at
   * `COMBAT.lootBufferShare`. Merging them would make every one of those a
   * conditional on a flag instead of a fact about which column you are reading.
   */
  bufferAlloy: real('buffer_alloy').notNull().default(0),
  bufferCrystal: real('buffer_crystal').notNull().default(0),
  shield: real('shield').notNull().default(0),
  /** Lazy economy anchor. Advanced inside the row lock, never on a timer. */
  lastTickAt: timestamp('last_tick_at', { withTimezone: true }).notNull().defaultNow(),
  disruptedUntil: timestamp('disrupted_until', { withTimezone: true }),
}, (t) => [
  uniqueIndex('planets_player_idx').on(t.playerId),
  uniqueIndex('planets_season_slot_idx').on(t.seasonId, t.slotIndex),
  index('planets_season_idx').on(t.seasonId),
]);

export const buildings = pgTable('buildings', {
  planetId: uuid('planet_id').notNull().references(() => planets.id),
  type: text('type').notNull(),
  level: integer('level').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.planetId, t.type] })]);

/**
 * EVERYTHING A PLANET HAS INSTALLED — instruments and satellites alike. D25.
 *
 * One table for two kinds of thing, because they are stored identically and told
 * apart by their id: an INSTRUMENT is on the ground and carries a real level, a
 * SATELLITE is in orbit and is always level 1 because it is bought once and never
 * raised. Splitting them into two tables would buy nothing and cost a migration.
 *
 * `type` is plain text rather than a narrowed union: the column holds ids from both
 * lists, and rows naming something retired — the DRILL satellite, before D25 made
 * it a craft — are skipped on read rather than migrated away.
 */
export const satellites = pgTable('satellites', {
  planetId: uuid('planet_id').notNull().references(() => planets.id),
  slot: integer('slot').notNull(),
  type: text('type').notNull(),
  level: integer('level').notNull().default(1),
}, (t) => [primaryKey({ columns: [t.planetId, t.slot] })]);

/** One table for ships and turrets. `location` is 'home' or a mission id. */
export const units = pgTable('units', {
  planetId: uuid('planet_id').notNull().references(() => planets.id),
  hull: text('hull').$type<HullId>().notNull(),
  location: text('location').notNull().default('home'),
  count: integer('count').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.planetId, t.hull, t.location] })]);

/* ── movement ───────────────────────────────────────────────── */

/**
 * A fleet in flight. Position is NEVER stored — the client interpolates it from
 * departAt and arriveAt, which is what lets the galaxy show dozens of moving
 * objects with zero realtime traffic.
 */
export const missions = pgTable('missions', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  kind: missionKind('kind').notNull(),
  status: missionStatus('status').notNull().default('in_flight'),
  originPlanetId: uuid('origin_planet_id').notNull().references(() => planets.id),
  targetPlanetId: uuid('target_planet_id').notNull().references(() => planets.id),
  fleet: jsonb('fleet').$type<Fleet>().notNull(),
  loot: jsonb('loot').$type<{ alloy: number; crystal: number }>(),
  distance: real('distance').notNull(),
  departAt: timestamp('depart_at', { withTimezone: true }).notNull(),
  arriveAt: timestamp('arrive_at', { withTimezone: true }).notNull(),
  /**
   * The outbound leg this one is coming home from.
   *
   * Set on a probe's return trip, so the arrival handler knows which report to
   * deliver. An attack's return leg carries its survivors and its loot in its own
   * columns and needs no link; a probe carries nothing but the answer, and the
   * answer lives in `probe_reports`.
   */
  parentMissionId: uuid('parent_mission_id'),
}, (t) => [
  index('missions_status_arrive_idx').on(t.status, t.arriveAt),
  index('missions_origin_idx').on(t.originPlanetId),
  index('missions_target_idx').on(t.targetPlanetId),
]);

/**
 * THE HEARTBEAT. Anything that must happen at a moment even if nobody is
 * watching. Written in the same transaction as the thing it will resolve, so a
 * fleet can never exist without its arrival being scheduled.
 */
export const scheduledEvents = pgTable('scheduled_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  kind: eventKind('kind').notNull(),
  refId: uuid('ref_id'),
  payload: jsonb('payload').$type<Record<string, unknown>>(),
  resolveAt: timestamp('resolve_at', { withTimezone: true }).notNull(),
  status: eventStatus('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  lastError: text('last_error'),
}, (t) => [
  index('events_due_idx').on(t.status, t.resolveAt),
  index('events_claimed_idx').on(t.status, t.claimedAt),
]);

/* ── outcomes and intel ─────────────────────────────────────── */

export const battleReports = pgTable('battle_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  missionId: uuid('mission_id').notNull().references(() => missions.id),
  attackerPlayerId: uuid('attacker_player_id').notNull().references(() => players.id),
  defenderPlayerId: uuid('defender_player_id').notNull().references(() => players.id),
  grade: text('grade').$type<Grade>().notNull(),
  rounds: jsonb('rounds').$type<CombatRound[]>().notNull(),
  loot: jsonb('loot').$type<{ alloy: number; crystal: number }>().notNull(),
  attackerLosses: jsonb('attacker_losses').$type<Fleet>().notNull(),
  defenderLosses: jsonb('defender_losses').$type<Fleet>().notNull(),
  /**
   * The attacker's Dominion movement, exactly as the ledger recorded it.
   *
   * Stored rather than recomputed. `defenderLossValue` is NET OF SALVAGE — 60% of
   * destroyed ground defence rebuilds free — so deriving the swing from
   * `defenderLosses` alone overstates it whenever Bastions died, and the report
   * would quietly disagree with the ladder. Nullable because reports written
   * before this column existed cannot be reconstructed; the client omits the line
   * rather than inventing a figure.
   */
  dominionSwing: real('dominion_swing'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('reports_defender_idx').on(t.defenderPlayerId, t.createdAt),
  index('reports_attacker_idx').on(t.attackerPlayerId, t.createdAt),
  uniqueIndex('reports_mission_idx').on(t.missionId),
]);

/** `originPlanetId` is never exposed below Radar L5. Watching is silent; probing is loud. */
export const scanEvents = pgTable('scan_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  targetPlanetId: uuid('target_planet_id').notNull().references(() => planets.id),
  originPlanetId: uuid('origin_planet_id').notNull().references(() => planets.id),
  detected: boolean('detected').notNull(),
  bearing: text('bearing'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('scans_target_idx').on(t.targetPlanetId, t.createdAt)]);

/**
 * What a probe brought back, for the OBSERVER's eyes only.
 *
 * Deliberately a separate table from `scan_events`. Those two rows describe the
 * same event from opposite sides — this one names the target and its contents,
 * that one names the origin. Merging them would put the fog enforcement one
 * mistaken `select *` away from telling a defender exactly who scanned them.
 *
 * Values are stored as bands, already fuzzed by probe accuracy. The true numbers
 * are never persisted here, so even a leak of this table reveals only what the
 * observer was entitled to see.
 */
export const probeReports = pgTable('probe_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  observerPlayerId: uuid('observer_player_id').notNull().references(() => players.id),
  targetPlanetId: uuid('target_planet_id').notNull().references(() => planets.id),
  missionId: uuid('mission_id').notNull().references(() => missions.id),
  /** 0.30–1.00. Shown to the player so they know how much to trust the bands. */
  accuracy: real('accuracy').notNull(),
  stock: jsonb('stock').$type<{ low: number; high: number }>().notNull(),
  defence: jsonb('defence').$type<{ low: number; high: number }>().notNull(),
  fleetSize: jsonb('fleet_size').$type<{ low: number; high: number }>().notNull(),
  fleetHome: boolean('fleet_home').notNull(),
  /** Whether the target's radar caught it — the observer learns this too. */
  detected: boolean('detected').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * When the probe got home with it. NULL means still in the air.
   *
   * The snapshot is taken on arrival — that is the moment being measured, and it
   * is also when the target's radar has its chance — but the observer cannot read
   * any of it until the craft is back. Intel that teleports home is not a journey
   * anyone has to plan around.
   */
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
}, (t) => [
  index('probe_reports_observer_idx').on(t.observerPlayerId, t.createdAt),
  uniqueIndex('probe_reports_mission_idx').on(t.missionId),
]);

/** Telescope assignments. The target is NEVER told this row exists. */
export const watches = pgTable('watches', {
  observerPlayerId: uuid('observer_player_id').notNull().references(() => players.id),
  slot: integer('slot').notNull(),
  targetPlanetId: uuid('target_planet_id').notNull().references(() => planets.id),
  lastStatus: text('last_status'),
  lastConfirmedAt: timestamp('last_confirmed_at', { withTimezone: true }),
  /**
   * When this slot may be pointed somewhere new. D18.
   *
   * NULL means free. Set only when a slot that already held a target is
   * re-pointed — filling an empty slot costs nothing, because the price is
   * changing your mind rather than looking.
   *
   * The target is still never told anything: a cooldown is a cost the OBSERVER
   * pays, and nothing about it is readable from the watched planet's side.
   */
  cooldownUntil: timestamp('cooldown_until', { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.observerPlayerId, t.slot] })]);

/**
 * How much ore has been taken out of a rock. D19.
 *
 * THE ONLY THING STORED ABOUT AN ASTEROID. The field itself — where every rock
 * enters, how fast it crosses, how much it carries, when it leaves — is a pure
 * function of the season seed and is regenerated identically on the server, in the
 * simulator and on the client (A5). What a formula and a clock cannot derive is how
 * much somebody else already mined, so that is the one fact with a row.
 *
 * A row appears the first time anyone reaches that rock; no row means untouched.
 */
export const asteroidClaims = pgTable('asteroid_claims', {
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  /** Index into the generated field for this season's seed. */
  index: integer('index').notNull(),
  oreTaken: real('ore_taken').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.seasonId, t.index] })]);

/**
 * WRECKAGE LEFT BY A BATTLE. D32.
 *
 * Sits at the DEFENDER's planet — that is what makes it a landmark at a known
 * address, and what makes it public information about who was fought.
 *
 * NOTHING ABOUT ITS CURRENT VALUE IS STORED (A5). The initial piles and the clock
 * give the decay; `takenAlloy`/`takenCrystal` give what has already been carried
 * off. `debrisRemaining()` in `@astera/rules` is the only thing that combines
 * them, so the server, the client and any test all read the same number.
 *
 * There is no `expiresAt` and no scheduled event to expire one. A field that
 * nobody harvests simply stops being worth anything, and the row is swept with the
 * season.
 */
export const debrisFields = pgTable('debris_fields', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  /** Where it is. The battle happened here, so the coordinates are this planet's. */
  planetId: uuid('planet_id').notNull().references(() => planets.id),
  /** The battle that made it, so a report can point at its own wreckage. */
  missionId: uuid('mission_id').references(() => missions.id),
  alloy: real('alloy').notNull(),
  crystal: real('crystal').notNull(),
  takenAlloy: real('taken_alloy').notNull().default(0),
  takenCrystal: real('taken_crystal').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('debris_season_idx').on(t.seasonId, t.createdAt),
  index('debris_planet_idx').on(t.planetId),
]);

export const miningStatus = pgEnum('mining_status', ['outbound', 'returning', 'done']);

/**
 * A Prospector run at a passing rock. D19.
 *
 * Deliberately NOT a `missions` row. A mission flies between two planets and every
 * query over that table assumes it; a mining run has one planet and one moving
 * target, carries no combat fleet, and must never make its origin read `AWAY`.
 * Bolting a nullable target planet onto `missions` would have put that assumption
 * one forgotten `WHERE` clause away from being wrong in the fog layer.
 *
 * `interceptX/Y/Z` is the point the craft was aimed at, stored rather than
 * re-derived: the aim depends on the Drill level AT LAUNCH, and a player who
 * upgrades mid-flight must not have their craft silently teleport onto a new
 * course.
 */
export const miningRuns = pgTable('mining_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  planetId: uuid('planet_id').notNull().references(() => planets.id),
  /**
   * WHAT THIS RUN IS AIMED AT. D32.
   *
   * A harvest is the same shape as a mining run — craft leave, arrive, claim what
   * is left, come home — so it reuses this table rather than duplicating the
   * resolution path, the claim race, the traffic contact and the flight rendering.
   * Exactly one of `asteroidIndex` and `debrisFieldId` is set; the CHECK below is
   * what stops that from being a convention people forget.
   */
  targetKind: text('target_kind').notNull().default('asteroid').$type<'asteroid' | 'debris'>(),
  asteroidIndex: integer('asteroid_index'),
  debrisFieldId: uuid('debris_field_id').references(() => debrisFields.id),
  status: miningStatus('status').notNull().default('outbound'),
  /** How many craft went, and what one of them could carry when it left. */
  craft: integer('craft').notNull(),
  holdEach: real('hold_each').notNull(),
  interceptX: real('intercept_x').notNull(),
  interceptY: real('intercept_y').notNull(),
  interceptZ: real('intercept_z').notNull(),
  departAt: timestamp('depart_at', { withTimezone: true }).notNull(),
  arriveAt: timestamp('arrive_at', { withTimezone: true }).notNull(),
  /** NULL until it turns for home. */
  homeAt: timestamp('home_at', { withTimezone: true }),
  /** What it actually got. Zero means it arrived to find the rock stripped. */
  minedAlloy: real('mined_alloy').notNull().default(0),
  minedCrystal: real('mined_crystal').notNull().default(0),
}, (t) => [
  index('mining_planet_idx').on(t.planetId, t.status),
  index('mining_season_idx').on(t.seasonId, t.status),
  uniqueIndex('mining_planet_rock_idx')
    .on(t.planetId, t.asteroidIndex)
    .where(sql`status <> 'done'`),
  /** One harvest per field per planet, the same rule the rocks have. */
  uniqueIndex('mining_planet_debris_idx')
    .on(t.planetId, t.debrisFieldId)
    .where(sql`status <> 'done'`),
  check(
    'mining_one_target',
    sql`(asteroid_index is not null and debris_field_id is null)
     or (asteroid_index is null and debris_field_id is not null)`,
  ),
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  kind: notificationKind('kind').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  seen: boolean('seen').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * WHAT THIS IS ABOUT — a mission id, a mining run id, or nothing. D45.
   *
   * It exists to make a notification IDEMPOTENT, which nothing here was. A worker
   * that commits its transaction and is killed before `complete()` has its event
   * returned to the queue by the reaper and handled again; `mission_arrival`
   * survives that because `claimMission` flips a status, but the radar warning had
   * no such guard and a redelivery wrote a second "incoming fleet" with a fresh
   * ETA. Measured, not theorised.
   *
   * No foreign key: the id names a row in one of several tables, and no column can
   * reference two. Nullable, because an unlock is about nothing but the player —
   * and PostgreSQL treats NULLs as distinct, so those rows are simply outside the
   * unique index rather than colliding with each other.
   */
  refId: uuid('ref_id'),
}, (t) => [
  index('notifications_player_idx').on(t.playerId, t.seen, t.createdAt),
  uniqueIndex('notifications_ref_idx').on(t.playerId, t.kind, t.refId),
]);

/** Dedupes retried actions — a flaky mobile connection must not double-launch. */
export const requestLog = pgTable('request_log', {
  idempotencyKey: text('idempotency_key').primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  response: jsonb('response').$type<unknown>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
