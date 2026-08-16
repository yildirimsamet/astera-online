import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { CombatRound, Fleet, Grade, HullId } from '@blindspace/rules';

/**
 * Sixteen tables. Nothing here stores a value that can be derived from a formula
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
]);
export const notificationKind = pgEnum('notification_kind', [
  'incoming_fleet',
  'fleet_returned',
  'raided',
  'scan_detected',
]);

/* ── identity ───────────────────────────────────────────────── */

/** Global and permanent. Survives every wipe; carries record, never power. */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),
  /** Guest accounts have no email until they upgrade. */
  displayName: text('display_name').notNull(),
  lifetime: jsonb('lifetime').$type<Record<string, number>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('accounts_email_idx').on(t.email)]);

export const shards = pgTable('shards', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  region: text('region').notNull().default('eu'),
  playerCap: integer('player_cap').notNull().default(200),
}, (t) => [uniqueIndex('shards_code_idx').on(t.code)]);

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
   * Which unlocks this player has already been SHOWN.
   *
   * What is unlocked is derived from history, not stored — that cannot drift. This
   * only records what has already been announced, so the return overlay can say
   * "new" exactly once.
   */
  unlocksSeen: jsonb('unlocks_seen').$type<string[]>().notNull().default([]),
}, (t) => [
  uniqueIndex('players_account_season_idx').on(t.accountId, t.seasonId),
  index('players_ladder_idx').on(t.seasonId, t.dominionTaken, t.dominionLost),
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
}, (t) => [primaryKey({ columns: [t.observerPlayerId, t.slot] })]);

/** Static for the season. Position is computed from the clock, never stored. */
export const asteroids = pgTable('asteroids', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  index: integer('index').notNull(),
  radius: real('radius').notNull(),
  period: real('period').notNull(),
  phase: real('phase').notNull(),
  y: real('y').notNull(),
  mass: real('mass').notNull(),
}, (t) => [index('asteroids_season_idx').on(t.seasonId)]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  kind: notificationKind('kind').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  seen: boolean('seen').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('notifications_player_idx').on(t.playerId, t.seen, t.createdAt)]);

/** Dedupes retried actions — a flaky mobile connection must not double-launch. */
export const requestLog = pgTable('request_log', {
  idempotencyKey: text('idempotency_key').primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  response: jsonb('response').$type<unknown>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
