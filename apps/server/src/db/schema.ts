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
import type {
  CombatRound,
  BuildQueueId,
  Fleet,
  Grade,
  HullId,
  ResearchProjectId,
  Resources,
} from '@astera/rules';

/**
 * Seasonal and permanent tables. Nothing here stores a value that can be derived from a formula
 * and a clock — no fleet positions, no asteroid coordinates, no resource ticks.
 *
 * TIME MODEL: everything is `timestamptz`. The rules package works in minutes
 * since season start; conversion happens once, at the service boundary, in
 * src/clock.ts. There is exactly one clock in this system.
 */

export const seasonStatus = pgEnum('season_status', ['pending', 'live', 'frozen', 'wiped']);
export const planetKind = pgEnum('planet_kind', ['CAPITAL', 'COLONY', 'NEUTRAL']);
export const missionKind = pgEnum('mission_kind', [
  'attack', 'probe', 'return', 'transfer', 'settlement', 'death_star', 'clan_transfer',
]);
export const missionStatus = pgEnum('mission_status', ['in_flight', 'resolved', 'cancelled']);
export const eventStatus = pgEnum('event_status', ['pending', 'processing', 'done', 'failed']);
export const strategicAssetStatus = pgEnum('strategic_asset_status', [
  'BUILDING', 'PAUSED', 'READY', 'LAUNCHED', 'CONSUMED',
]);
export const eventKind = pgEnum('event_kind', [
  'mission_arrival',
  'radar_warning',
  'asteroid_impact',
  'season_end',
  'season_rollover',
  /** A Prospector reaching the rock it was aimed at, and getting home again. D19. */
  'mining_arrival',
  'mining_return',
  /** A public season-act boundary. D96. */
  'season_act',
  /** Multi-world ruleset v2. New enum values remain append-only. D97. */
  'neutral_reinforce',
  'death_star_ready',
  'recovery_end',
  'occupation_end',
  /** One ordinary construction or yard order reaching its authoritative instant. D4. */
  'build_complete',
  /**
   * A strategic weapon crossing the defender's timed radar circle. T10.
   *
   * Its own kind rather than a branch inside `radar_warning`, because a
   * NOTIFICATION path and a COMBAT RESOLUTION are two different jobs and one
   * handler that did both would be one handler nobody could reason about. It also
   * has to resolve FIRST: a defender told "incoming" beside the news that it is
   * already wreckage is the interface contradicting itself.
  */
  'strategic_intercept',
  /** The interceptor missile reaching the reserved collision point. */
  'strategic_intercept_impact',
  /** One commander-wide research order reaching its authoritative instant. */
  'research_complete',
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
  /** Multi-world strategic moments. D97. */
  'strategic_incoming',
  'death_star_result',
  'colony_captured',
  'colony_lost',
  'settlement_success',
  'settlement_lost',
  /** You stopped one, or you lost one on somebody's ring. T10. */
  'strategic_intercepted',
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

export type FeedbackKind = 'BUG' | 'SUGGESTION' | 'PRAISE';

/** Global, admin-authored news. The stored body has already crossed the server allow-list. */
export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorAccountId: uuid('author_account_id').notNull().references(() => accounts.id),
  title: text('title').notNull(),
  bodyHtml: text('body_html').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
}, (t) => [index('announcements_published_idx').on(t.publishedAt)]);

/** Per-account read state keeps a new announcement visible without making it an interruption. */
export const announcementReads = pgTable('announcement_reads', {
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  announcementId: uuid('announcement_id').notNull().references(() => announcements.id),
  readAt: timestamp('read_at', { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.accountId, t.announcementId] })]);

/** Player-to-operator messages. Content is always rendered as text, never as HTML. */
export const feedbackEntries = pgTable('feedback_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  kind: text('kind').$type<FeedbackKind>().notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('feedback_entries_created_idx').on(t.createdAt),
  index('feedback_entries_account_idx').on(t.accountId, t.createdAt),
  check('feedback_entries_kind_check', sql`${t.kind} IN ('BUG', 'SUGGESTION', 'PRAISE')`),
]);

/**
 * A galaxy, as an address players can choose between. D21.
 *
 * `ordinal` is the fill order and the whole of the sequential-fill rule: the only
 * shard anyone may join is the lowest-ordinal one that still has a free slot.
 * Storing it rather than sorting by code keeps that rule readable — and keeps
 * a future `EU-10` from sorting between `EU-1` and `EU-2`, which is what happens the moment
 * anyone orders these by name.
 */
export const shards = pgTable('shards', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  /** What the server list calls it. The code is the address; this is the name. */
  name: text('name').notNull().default(''),
  ordinal: integer('ordinal').notNull().default(1),
  region: text('region').notNull().default('eu'),
  playerCap: integer('player_cap').notNull().default(300),
}, (t) => [
  uniqueIndex('shards_code_idx').on(t.code),
  uniqueIndex('shards_ordinal_idx').on(t.ordinal),
]);

export const seasons = pgTable('seasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  shardId: uuid('shard_id').notNull().references(() => shards.id),
  /** The galaxy is regenerated from this — never stored slot by slot. */
  seed: integer('seed').notNull(),
  /** Private keyed asteroid schedule and opaque identities. Never sent to clients. */
  asteroidKey: uuid('asteroid_key').notNull().defaultRandom(),
  status: seasonStatus('status').notNull().default('pending'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  /** Immutable: v1 capitals, v2 multi-world, v3 seasonal clans. */
  rulesetVersion: integer('ruleset_version').notNull().default(1),
}, (t) => [index('seasons_shard_status_idx').on(t.shardId, t.status)]);

export interface SeasonRecap {
  commanderName: string;
  planetName: string;
  battles: number;
  attacks: number;
  defences: number;
  rival: { commanderName: string; battles: number } | null;
  biggestRaid: { value: number; opponentName: string } | null;
  clan?: {
    name: string;
    tag: string;
    finalRank: number;
    dominion: number;
    topThree: boolean;
  } | null;
}

/** Permanent identity and story, never permanent power. D85. */
export const seasonResults = pgTable('season_results', {
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  finalRank: integer('final_rank').notNull(),
  dominion: real('dominion').notNull(),
  damageDealt: real('damage_dealt').notNull().default(0),
  damageTaken: real('damage_taken').notNull().default(0),
  rivalName: text('rival_name'),
  biggestRaid: real('biggest_raid').notNull().default(0),
  title: text('title').notNull(),
  recap: jsonb('recap').$type<SeasonRecap>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.seasonId, t.accountId] }),
  index('season_results_account_idx').on(t.accountId, t.createdAt),
]);

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
  /** Durable across devices, but not across a season: the newest chat instant read. D77. */
  lastChatReadAt: timestamp('last_chat_read_at', { withTimezone: true }),
  /** Durable attention anchor for private clan requests, depot and chat. D114. */
  lastClanSeenAt: timestamp('last_clan_seen_at', { withTimezone: true }),
  /** Leave, kick and disband all close recruitment actions for one day. D114. */
  clanLockedUntil: timestamp('clan_locked_until', { withTimezone: true }),
  /** One identity anchor for this season; no power, and no FK so reclaim stays possible. D91. */
  rivalPlanetId: uuid('rival_planet_id'),
  /** Commander identity survives a target colony changing hands. D97. */
  rivalPlayerId: uuid('rival_player_id'),
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
   * ONE ACCOUNT, ONE COMMANDER, ONE GALAXY. D21 + D97.
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

export type ClanMembershipRole = 'LEADER' | 'MEMBER';
export type ClanRequestKind = 'APPLICATION' | 'INVITATION';
export type ClanRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'EXPIRED' | 'CLOSED';

/** One public seasonal identity and its cached, fully audited clan Dominion. D114. */
export const clans = pgTable('clans', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull(),
  tag: text('tag').notNull(),
  description: text('description').notNull().default(''),
  recruiting: boolean('recruiting').notNull().default(true),
  dominionTaken: real('dominion_taken').notNull().default(0),
  dominionLost: real('dominion_lost').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  disbandedAt: timestamp('disbanded_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('clans_season_name_idx').on(t.seasonId, t.nameKey),
  uniqueIndex('clans_season_tag_idx').on(t.seasonId, t.tag),
  index('clans_season_score_idx').on(t.seasonId, t.dominionTaken, t.dominionLost),
  check('clans_name_length_check', sql`char_length(${t.name}) BETWEEN 3 AND 24`),
  check('clans_tag_check', sql`${t.tag} ~ '^[A-Z0-9]{2,5}$'`),
  check('clans_description_length_check', sql`char_length(${t.description}) <= 160`),
]);

/** Active membership is represented by `left_at IS NULL`; old rows remain an audit. */
export const clanMemberships = pgTable('clan_memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  clanId: uuid('clan_id').notNull().references(() => clans.id),
  playerId: uuid('player_id').notNull().references(() => players.id),
  role: text('role').$type<ClanMembershipRole>().notNull().default('MEMBER'),
  slot: integer('slot').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull(),
  matureAt: timestamp('mature_at', { withTimezone: true }).notNull(),
  leftAt: timestamp('left_at', { withTimezone: true }),
  aidEnabled: boolean('aid_enabled').notNull().default(true),
  aidPolicyChangedAt: timestamp('aid_policy_changed_at', { withTimezone: true }).notNull(),
  lastChatReadAt: timestamp('last_chat_read_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('clan_memberships_active_player_idx')
    .on(t.playerId)
    .where(sql`${t.leftAt} IS NULL`),
  uniqueIndex('clan_memberships_active_slot_idx')
    .on(t.clanId, t.slot)
    .where(sql`${t.leftAt} IS NULL`),
  uniqueIndex('clan_memberships_active_leader_idx')
    .on(t.clanId)
    .where(sql`${t.leftAt} IS NULL AND ${t.role} = 'LEADER'`),
  index('clan_memberships_clan_history_idx').on(t.clanId, t.joinedAt),
  index('clan_memberships_player_history_idx').on(t.playerId, t.joinedAt),
  check('clan_memberships_role_check', sql`${t.role} IN ('LEADER', 'MEMBER')`),
  check('clan_memberships_slot_check', sql`${t.slot} BETWEEN 0 AND 4`),
  check('clan_memberships_maturity_check', sql`${t.matureAt} >= ${t.joinedAt}`),
  check('clan_memberships_left_check', sql`${t.leftAt} IS NULL OR ${t.leftAt} >= ${t.joinedAt}`),
]);

/** Applications and invitations share one bounded, expiring state machine. */
export const clanRequests = pgTable('clan_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  clanId: uuid('clan_id').notNull().references(() => clans.id),
  playerId: uuid('player_id').notNull().references(() => players.id),
  kind: text('kind').$type<ClanRequestKind>().notNull(),
  status: text('status').$type<ClanRequestStatus>().notNull().default('PENDING'),
  createdByPlayerId: uuid('created_by_player_id').notNull().references(() => players.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('clan_requests_pending_pair_idx')
    .on(t.clanId, t.playerId)
    .where(sql`${t.status} = 'PENDING'`),
  index('clan_requests_clan_status_idx').on(t.clanId, t.status, t.createdAt),
  index('clan_requests_player_status_idx').on(t.playerId, t.status, t.createdAt),
  index('clan_requests_inviter_rate_idx').on(t.createdByPlayerId, t.kind, t.createdAt),
  check('clan_requests_kind_check', sql`${t.kind} IN ('APPLICATION', 'INVITATION')`),
  check(
    'clan_requests_status_check',
    sql`${t.status} IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'CLOSED')`,
  ),
  check('clan_requests_expiry_check', sql`${t.expiresAt} > ${t.createdAt}`),
]);

/** Canonical unordered player pair; a later separation extends this one row. */
export const clanCeasefires = pgTable('clan_ceasefires', {
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  playerLowId: uuid('player_low_id').notNull().references(() => players.id),
  playerHighId: uuid('player_high_id').notNull().references(() => players.id),
  sourceClanId: uuid('source_clan_id').notNull().references(() => clans.id),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.seasonId, t.playerLowId, t.playerHighId] }),
  index('clan_ceasefires_expiry_idx').on(t.seasonId, t.endsAt),
  check('clan_ceasefires_pair_check', sql`${t.playerLowId} < ${t.playerHighId}`),
  check('clan_ceasefires_window_check', sql`${t.endsAt} > ${t.startsAt}`),
]);

export const clanMessages = pgTable('clan_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  clanId: uuid('clan_id').notNull().references(() => clans.id),
  authorPlayerId: uuid('author_player_id').notNull().references(() => players.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('clan_messages_cursor_idx').on(t.clanId, t.createdAt, t.id),
  index('clan_messages_author_rate_idx').on(t.authorPlayerId, t.createdAt),
  check('clan_messages_content_check', sql`char_length(btrim(${t.content})) BETWEEN 1 AND 280`),
]);

/** Private, immutable management history; player ids are snapshots, not foreign keys. */
export const clanEvents = pgTable('clan_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  clanId: uuid('clan_id').notNull().references(() => clans.id),
  kind: text('kind').notNull(),
  actorPlayerId: uuid('actor_player_id'),
  actorName: text('actor_name'),
  subjectPlayerId: uuid('subject_player_id'),
  subjectName: text('subject_name'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
}, (t) => [index('clan_events_cursor_idx').on(t.clanId, t.occurredAt, t.id)]);

/**
 * THE GALAXY'S CONVERSATION. D77.
 *
 * Seasonal by construction: authors and readers are season players, and wipe removes
 * these rows before either parent. The account display name is joined when reading so a
 * message cannot preserve stale `players.name` identity and cannot accept a client name.
 */
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  authorPlayerId: uuid('author_player_id').notNull().references(() => players.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('chat_messages_season_cursor_idx').on(t.seasonId, t.createdAt, t.id),
  index('chat_messages_author_rate_idx').on(t.authorPlayerId, t.createdAt),
]);

export type GalaxyEventPayload =
  | { planetName: string; commanderName: string }
  | { planetName: string; commanderName: string; tier: number }
  | { planetName: string; tier: number; claimUntil: string }
  | {
      planetName: string;
      outcome: 'FIRST_STRIKE' | 'CAPTURED' | 'INEFFECTIVE';
      /** Missing only on pre-D98 events, all of which were non-capital. */
      capturable?: boolean;
    }
  | Record<string, never>
  | { act: 'war' | 'consolidation' | 'sunset' };

/** Public history, not intel. Its intentionally small contract is locked by D89. */
export const galaxyEvents = pgTable('galaxy_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  kind: text('kind').notNull(),
  refId: text('ref_id').notNull(),
  /** No FK: the public snapshot survives an idle seat being reclaimed. */
  subjectPlanetId: uuid('subject_planet_id'),
  payload: jsonb('payload').$type<GalaxyEventPayload>().notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
}, (t) => [
  uniqueIndex('galaxy_events_source_idx').on(t.seasonId, t.kind, t.refId),
  index('galaxy_events_season_cursor_idx').on(t.seasonId, t.occurredAt, t.id),
]);

export const planets = pgTable('planets', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Physical name retained for expand/backfill compatibility. Neutral is NULL. */
  controllerPlayerId: uuid('player_id').references(() => players.id),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  kind: planetKind('kind').notNull().default('CAPITAL'),
  name: text('name').notNull(),
  /** Index into the generated slot list — coordinates are derived, not stored. */
  slotIndex: integer('slot_index').notNull(),
  x: real('x').notNull(),
  y: real('y').notNull(),
  z: real('z').notNull(),
  alloy: real('alloy').notNull().default(500),
  crystal: real('crystal').notNull().default(120),
  deuterium: real('deuterium').notNull().default(0),
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
  bufferDeuterium: real('buffer_deuterium').notNull().default(0),
  shield: real('shield').notNull().default(0),
  /** Lazy economy anchor. Advanced inside the row lock, never on a timer. */
  lastTickAt: timestamp('last_tick_at', { withTimezone: true }).notNull().defaultNow(),
  disruptedUntil: timestamp('disrupted_until', { withTimezone: true }),
  recoveryUntil: timestamp('recovery_until', { withTimezone: true }),
  protectedUntil: timestamp('protected_until', { withTimezone: true }),
  /**
   * HOW MANY OF EACH HULL THIS PLANET HAS EVER BUILT. Cumulative, never reduced.
   *
   * THE ONE TALLY IN THIS FEATURE THAT IS NOT DERIVED, and it earns the exception.
   * Every other reward metric is counted off rows that survive the thing they
   * describe — a mission is still in the table when it lands, a building level
   * does not fall. A SHIP does not survive: it dies in combat and its `units` row
   * goes down with it, so "how many have you ever built" cannot be reconstructed
   * from the world at any later moment. It is written inside the same row lock
   * `buildUnits` already holds, so it costs no query and cannot race the spend it
   * is counting.
   *
   * Deliberately keyed by hull rather than being a single total: 50 Bulwarks and
   * 50 Wasps differ by an order of magnitude in what they cost, and one number
   * could not have meant both.
   */
  builtEver: jsonb('built_ever').$type<Fleet>().notNull().default({}),
}, (t) => [
  uniqueIndex('planets_capital_player_idx')
    .on(t.controllerPlayerId)
    .where(sql`${t.kind} = 'CAPITAL'`),
  uniqueIndex('planets_season_slot_idx').on(t.seasonId, t.slotIndex),
  index('planets_season_idx').on(t.seasonId),
  index('planets_controller_idx').on(t.controllerPlayerId),
  check(
    'planets_controller_kind_check',
    sql`(${t.kind} = 'NEUTRAL' AND ${t.controllerPlayerId} IS NULL)
      OR (${t.kind} <> 'NEUTRAL' AND ${t.controllerPlayerId} IS NOT NULL)`,
  ),
]);

/** Shared stock/profile state for one deterministic neutral world. D97. */
export const neutralPlanetState = pgTable('neutral_planet_state', {
  planetId: uuid('planet_id').primaryKey().references(() => planets.id),
  tier: integer('tier').notNull(),
  profileSeed: integer('profile_seed').notNull(),
  claimUntil: timestamp('claim_until', { withTimezone: true }),
  nextReinforcementAt: timestamp('next_reinforcement_at', { withTimezone: true }),
  economyAnchorAt: timestamp('economy_anchor_at', { withTimezone: true }).notNull(),
}, (t) => [check('neutral_planet_tier_check', sql`${t.tier} BETWEEN 1 AND 3`)]);

export const buildings = pgTable('buildings', {
  planetId: uuid('planet_id').notNull().references(() => planets.id),
  type: text('type').notNull(),
  level: integer('level').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.planetId, t.type] })]);

/**
 * THE SMALL SEASONAL FRONTIER, NOT A TECH TREE. D93.
 *
 * A completed project is the only durable fact. Discovery and availability are
 * derived from the season clock, combat history and prerequisites, so they can
 * never drift out of sync with what the player has actually done. The composite
 * key is also the concurrency guard: two taps cannot buy the same project twice.
 */
/**
 * RESEARCH BELONGS TO THE COMMANDER. T7.
 *
 * `planet_research` below is keyed on the world, which was tolerable while every
 * project was a one-off PERMISSION — buying Dense Fuel Cells twice bought nothing,
 * so the duplication cost nothing and showed nowhere. It stops being invisible the
 * moment a project is a MULTIPLIER: a commander with three colonies would buy the
 * same ladder four times, which is "micromanagement grows" stated outright.
 *
 * `level` is stored from the first day even though every project currently tops out
 * at one, so that adding a ladder is a table entry rather than a second migration
 * against live rows.
 *
 * THE OLD TABLE IS LEFT IN PLACE AND UNREAD for one release. The backfill is
 * one-way and idempotent; keeping the source means a bad deploy can be rolled back
 * without having destroyed what it was copying from.
 */
export const playerResearch = pgTable('player_research', {
  playerId: uuid('player_id').notNull().references(() => players.id),
  projectId: text('project_id').$type<ResearchProjectId>().notNull(),
  level: integer('level').notNull().default(1),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.playerId, t.projectId] })]);

export const planetResearch = pgTable('planet_research', {
  planetId: uuid('planet_id').notNull().references(() => planets.id),
  projectId: text('project_id').$type<ResearchProjectId>().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.planetId, t.projectId] })]);

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

/** Immutable sensor-post history used to award asteroid discoveries exactly once. */
export const sensorEpochs = pgTable('sensor_epochs', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  playerId: uuid('player_id').notNull().references(() => players.id),
  planetId: uuid('planet_id').notNull().references(() => planets.id),
  x: real('x').notNull(),
  y: real('y').notNull(),
  z: real('z').notNull(),
  reach: real('reach').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('sensor_epochs_open_planet_idx').on(t.planetId).where(sql`${t.endsAt} is null`),
  index('sensor_epochs_player_time_idx').on(t.playerId, t.startsAt, t.endsAt),
  index('sensor_epochs_season_idx').on(t.seasonId),
  check('sensor_epochs_reach_check', sql`${t.reach} > 0`),
  check('sensor_epochs_window_check', sql`${t.endsAt} is null or ${t.endsAt} > ${t.startsAt}`),
]);

/** One table for ships and turrets. `location` is 'home' or a mission id. */
export const units = pgTable('units', {
  planetId: uuid('planet_id').notNull().references(() => planets.id),
  /** Null only for a neutral system garrison. */
  ownerPlayerId: uuid('owner_player_id').references(() => players.id),
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
  ownerPlayerId: uuid('owner_player_id').notNull().references(() => players.id),
  originPlanetId: uuid('origin_planet_id').notNull().references(() => planets.id),
  targetPlanetId: uuid('target_planet_id').notNull().references(() => planets.id),
  fleet: jsonb('fleet').$type<Fleet>().notNull(),
  loot: jsonb('loot').$type<Resources>(),
  cargo: jsonb('cargo').$type<Resources>(),
  distance: real('distance').notNull(),
  departAt: timestamp('depart_at', { withTimezone: true }).notNull(),
  arriveAt: timestamp('arrive_at', { withTimezone: true }).notNull(),
  /** Frozen at launch: destructive rockets may never become accidental captures. D97. */
  deathStarCapture: boolean('death_star_capture').notNull().default(false),
  /**
   * The outbound leg this one is coming home from.
   *
   * Set on a probe's return trip so the handler knows which report to deliver,
   * and on an attack return so safely docked loot can use the immutable D114
   * roster snapshotted on its outbound mission.
   */
  parentMissionId: uuid('parent_mission_id'),
  /**
   * THE ATTACKER'S DOCTRINES, FROZEN AT LAUNCH. T9.
   *
   * A raid is decided by what its commander had researched when they COMMITTED it,
   * never by what they finished while it was in the air. That is the mirror of the
   * rule the radar already obeys from the other side — "read the defender's radar
   * level when the warning fires" — and between them the two say the same thing:
   * every figure is read at the moment the decision it belongs to was made.
   *
   * Null on every mission written before this existed, which resolves as no
   * research at all — exactly what those commanders had.
   */
  tech: jsonb('tech').$type<Partial<Record<ResearchProjectId, number>>>(),
}, (t) => [
  index('missions_status_arrive_idx').on(t.status, t.arriveAt),
  index('missions_origin_idx').on(t.originPlanetId),
  index('missions_target_idx').on(t.targetPlanetId),
]);

/** Counted at attack launch, never inferred from a later report. D114. */
export const attackCommitments = pgTable('attack_commitments', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  missionId: uuid('mission_id').notNull().references(() => missions.id),
  attackerPlayerId: uuid('attacker_player_id').notNull().references(() => players.id),
  targetPlayerId: uuid('target_player_id').notNull().references(() => players.id),
  /**
   * Immediate membership snapshot used for the five-launch clan quota, and the ONE
   * column here that is deliberately MUTABLE: `bindOpenAttacksToClan` adopts a
   * still-live clanless launch when its attacker first joins, so pre-attacking and
   * then joining cannot reset the aggregate ceiling. Nothing that describes what
   * happened may read it — see `attackerClanId` below.
   */
  quotaClanId: uuid('quota_clan_id').references(() => clans.id),
  /**
   * Immediate identity snapshots used by battle-report tags, and immutable.
   *
   * The attacker's used to be read off `quotaClanId`, which the quota rebinds for
   * twelve hours after launch — so a raid that had already resolved with no clan
   * grew one the moment its attacker joined, and both sides' reports said the
   * attacker had flown under a tag that did not exist when they left. D114 is
   * explicit that leaving later must not rewrite a historical event; joining later
   * must not either.
   */
  attackerClanId: uuid('attacker_clan_id').references(() => clans.id),
  defenderClanId: uuid('defender_clan_id').references(() => clans.id),
  /** Mature launch snapshots used only for clan Dominion attribution. */
  attackerScoreClanId: uuid('attacker_score_clan_id').references(() => clans.id),
  defenderScoreClanId: uuid('defender_score_clan_id').references(() => clans.id),
  launchedAt: timestamp('launched_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [
  uniqueIndex('attack_commitments_mission_idx').on(t.missionId),
  index('attack_commitments_personal_idx')
    .on(t.attackerPlayerId, t.targetPlayerId, t.expiresAt),
  index('attack_commitments_clan_idx').on(t.quotaClanId, t.targetPlayerId, t.expiresAt),
  check('attack_commitments_window_check', sql`${t.expiresAt} > ${t.launchedAt}`),
]);

export type ClanAidStatus = 'OUTBOUND' | 'RETURNING' | 'DELIVERED' | 'RETURNED';

/** One receiver-limit reservation and the metadata needed for a safe return. */
export const clanAidCommitments = pgTable('clan_aid_commitments', {
  missionId: uuid('mission_id').primaryKey().references(() => missions.id),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  clanId: uuid('clan_id').notNull().references(() => clans.id),
  senderPlayerId: uuid('sender_player_id').notNull().references(() => players.id),
  recipientPlayerId: uuid('recipient_player_id').notNull().references(() => players.id),
  senderHomePlanetId: uuid('sender_home_planet_id').notNull().references(() => planets.id),
  value: jsonb('value').$type<Resources>().notNull(),
  returnTravelSeconds: real('return_travel_seconds').notNull(),
  status: text('status').$type<ClanAidStatus>().notNull().default('OUTBOUND'),
  committedAt: timestamp('committed_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => [
  index('clan_aid_recipient_window_idx').on(t.recipientPlayerId, t.expiresAt),
  index('clan_aid_sender_idx').on(t.senderPlayerId, t.committedAt),
  check('clan_aid_status_check', sql`${t.status} IN ('OUTBOUND', 'RETURNING', 'DELIVERED', 'RETURNED')`),
  check('clan_aid_window_check', sql`${t.expiresAt} > ${t.committedAt}`),
  check('clan_aid_return_time_check', sql`${t.returnTravelSeconds} > 0`),
]);

/** Mature attacker roster frozen at launch. Player ids intentionally survive only as snapshots. */
export const clanRaidRoster = pgTable('clan_raid_roster', {
  missionId: uuid('mission_id').notNull().references(() => missions.id),
  clanId: uuid('clan_id').notNull().references(() => clans.id),
  playerId: uuid('player_id').notNull(),
  slot: integer('slot').notNull(),
}, (t) => [
  primaryKey({ columns: [t.missionId, t.playerId] }),
  uniqueIndex('clan_raid_roster_slot_idx').on(t.missionId, t.slot),
  check('clan_raid_roster_slot_check', sql`${t.slot} BETWEEN 0 AND 4`),
]);

/** A personal share, claimable after leave/disband and never leader-owned. */
export const clanLootShares = pgTable('clan_loot_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  /** Immutable source snapshot. The share must outlive an idle target's reclaimed mission. */
  sourceMissionId: uuid('source_mission_id').notNull(),
  clanId: uuid('clan_id').notNull().references(() => clans.id),
  playerId: uuid('player_id').notNull().references(() => players.id),
  alloy: real('alloy').notNull().default(0),
  crystal: real('crystal').notNull().default(0),
  deuterium: real('deuterium').notNull().default(0),
  remainingAlloy: real('remaining_alloy').notNull().default(0),
  remainingCrystal: real('remaining_crystal').notNull().default(0),
  remainingDeuterium: real('remaining_deuterium').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  lastClaimedAt: timestamp('last_claimed_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('clan_loot_shares_source_player_idx').on(t.sourceMissionId, t.playerId),
  index('clan_loot_shares_player_idx').on(t.playerId, t.createdAt),
  check(
    'clan_loot_shares_remaining_check',
    sql`${t.remainingAlloy} BETWEEN 0 AND ${t.alloy}
      AND ${t.remainingCrystal} BETWEEN 0 AND ${t.crystal}
      AND ${t.remainingDeuterium} BETWEEN 0 AND ${t.deuterium}`,
  ),
]);

/** Immutable audit behind the clan ladder cache. */
export const clanScoreEvents = pgTable('clan_score_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  /** Immutable audit source. Clan score already earned never disappears on seat reclaim. */
  missionId: uuid('mission_id').notNull(),
  clanId: uuid('clan_id').notNull().references(() => clans.id),
  side: text('side').$type<'ATTACK' | 'DEFENCE'>().notNull(),
  dominionDelta: real('dominion_delta').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
}, (t) => [
  uniqueIndex('clan_score_events_source_idx').on(t.missionId, t.clanId, t.side),
  index('clan_score_events_clan_idx').on(t.clanId, t.createdAt),
  check('clan_score_events_side_check', sql`${t.side} IN ('ATTACK', 'DEFENCE')`),
]);

/** A strategic asset belongs to its current planet and transfers with it. D97. */
export const strategicAssets = pgTable('strategic_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  planetId: uuid('planet_id').notNull().references(() => planets.id),
  /** `DEATH_STAR` or `INTERCEPTOR`: one lifecycle, two kinds of strategic hardware. T10. */
  type: text('type').notNull().default('DEATH_STAR'),
  status: strategicAssetStatus('status').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  remainingSeconds: integer('remaining_seconds'),
  missionId: uuid('mission_id').references(() => missions.id),
}, (t) => [
  /**
   * PLAIN, NOT UNIQUE, SINCE T11.
   *
   * This was a partial UNIQUE index enforcing one live asset per world — belt and
   * braces beside the count check in `buildDeathStar`. A commander may now keep two
   * weapons and, separately, an interception charge, and Postgres cannot express
   * "at most two" as a unique index. The guard is the PLANET ROW LOCK, which every
   * one of these paths already takes through `loadLocked` before it counts: the
   * count-then-insert is serialised by it, and `concurrency.test.ts` proves the
   * two-simultaneous-builds case still resolves to exactly one.
   */
  index('strategic_assets_planet_active_idx').on(t.planetId, t.status),
  index('strategic_assets_mission_idx').on(t.missionId),
  check('strategic_assets_type_check', sql`${t.type} IN ('DEATH_STAR', 'INTERCEPTOR')`),
]);

export type BuildOrderKind = 'BUILDING' | 'HULL' | 'INSTRUMENT' | 'SATELLITE' | 'RESEARCH';
export type BuildOrderStatus = 'BUILDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

/**
 * One committed ordinary build. D4.
 *
 * The row stores work, not its outcome: the building level, unit stack or research
 * row is written only when `readyAt` arrives. `slot` is deliberately constrained
 * in the database. Together with the partial unique index it makes a queue deeper
 * than `BUILD.queueDepth` impossible even if a future caller forgets the service
 * guard.
 */
export const buildOrders = pgTable('build_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  planetId: uuid('planet_id').notNull().references(() => planets.id),
  queue: text('queue').$type<BuildQueueId>().notNull(),
  slot: integer('slot').notNull(),
  kind: text('kind').$type<BuildOrderKind>().notNull(),
  subject: text('subject').notNull(),
  count: integer('count').notNull().default(1),
  status: text('status').$type<BuildOrderStatus>().notNull().default('BUILDING'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  readyAt: timestamp('ready_at', { withTimezone: true }).notNull(),
  /** Full work duration; later orders can be re-timed after a cancellation. */
  remainingSeconds: integer('remaining_seconds').notNull(),
  /** Still Wealth while committed; returned in full only when the system abandons it. */
  cost: jsonb('cost').$type<Resources>().notNull(),
}, (t) => [
  uniqueIndex('build_orders_planet_queue_slot_active_idx')
    .on(t.planetId, t.queue, t.slot)
    .where(sql`${t.status} = 'BUILDING'`),
  index('build_orders_planet_status_idx').on(t.planetId, t.status),
  check('build_orders_queue_check', sql`${t.queue} IN ('CONSTRUCTION', 'YARD')`),
  check(
    'build_orders_kind_check',
    sql`${t.kind} IN ('BUILDING', 'HULL', 'INSTRUMENT', 'SATELLITE', 'RESEARCH')`,
  ),
  check(
    'build_orders_status_check',
    sql`${t.status} IN ('BUILDING', 'COMPLETED', 'CANCELLED', 'FAILED')`,
  ),
  check('build_orders_slot_check', sql`${t.slot} BETWEEN 0 AND 2`),
  check('build_orders_count_check', sql`${t.count} > 0`),
  check('build_orders_remaining_check', sql`${t.remainingSeconds} >= 0`),
]);

/**
 * Commander-wide research work.
 *
 * A planet only funds the order; it does not own the lane or the result. Keeping
 * this separate from `build_orders` prevents a colony from granting extra
 * research throughput and prevents construction from blocking research (or the
 * reverse). The player row is the queue's serialisation lock.
 */
export const researchOrders = pgTable('research_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  fundingPlanetId: uuid('funding_planet_id').notNull().references(() => planets.id),
  slot: integer('slot').notNull(),
  projectId: text('project_id').$type<ResearchProjectId>().notNull(),
  /** Target ladder level, mirroring `player_research.level`. */
  level: integer('level').notNull(),
  status: text('status').$type<BuildOrderStatus>().notNull().default('BUILDING'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  readyAt: timestamp('ready_at', { withTimezone: true }).notNull(),
  remainingSeconds: integer('remaining_seconds').notNull(),
  cost: jsonb('cost').$type<Resources>().notNull(),
}, (t) => [
  uniqueIndex('research_orders_player_slot_active_idx')
    .on(t.playerId, t.slot)
    .where(sql`${t.status} = 'BUILDING'`),
  index('research_orders_player_status_idx').on(t.playerId, t.status),
  index('research_orders_funding_planet_idx').on(t.fundingPlanetId),
  check(
    'research_orders_status_check',
    sql`${t.status} IN ('BUILDING', 'COMPLETED', 'CANCELLED', 'FAILED')`,
  ),
  check('research_orders_slot_check', sql`${t.slot} BETWEEN 0 AND 2`),
  check('research_orders_level_check', sql`${t.level} > 0`),
  check('research_orders_remaining_check', sql`${t.remainingSeconds} >= 0`),
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
  uniqueIndex('events_one_season_end_idx')
    .on(t.seasonId, t.kind)
    .where(sql`${t.kind} = 'season_end'`),
]);

/* ── outcomes and intel ─────────────────────────────────────── */

export const battleReports = pgTable('battle_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  missionId: uuid('mission_id').notNull().references(() => missions.id),
  attackerPlayerId: uuid('attacker_player_id').notNull().references(() => players.id),
  defenderPlayerId: uuid('defender_player_id').references(() => players.id),
  targetPlanetId: uuid('target_planet_id').notNull().references(() => planets.id),
  targetKind: text('target_kind').$type<'PLAYER' | 'NEUTRAL'>().notNull().default('PLAYER'),
  grade: text('grade').$type<Grade>().notNull(),
  rounds: jsonb('rounds').$type<CombatRound[]>().notNull(),
  loot: jsonb('loot').$type<Resources>().notNull(),
  attackerLosses: jsonb('attacker_losses').$type<Fleet>().notNull(),
  defenderLosses: jsonb('defender_losses').$type<Fleet>().notNull(),
  /**
   * WHAT EACH SIDE HAD ON THE BOARD WHEN THE SHOOTING STARTED. D120.
   *
   * A report used to carry losses and nothing else, so "you lost 12 Wasp" had no
   * denominator: twelve of fifteen is a disaster and twelve of eighty is the cost
   * of doing business, and the report could not tell them apart. Both rosters are
   * stored, and `readBattleReports` hands each side ONLY ITS OWN — the caller's
   * roster minus the caller's losses is the caller's survivors, which they are
   * entitled to, while the same subtraction on the opponent's roster is exactly
   * the disclosure the fog forbids. The fog is enforced in the query.
   *
   * Defaults are empty so every report written before this existed still reads;
   * the client omits the section rather than drawing an empty roster.
   */
  attackerFleet: jsonb('attacker_fleet').$type<Fleet>().notNull().default({}),
  /** The defender's home fleet AND ground guns, as one board. Defender's eyes only. */
  defenderFleet: jsonb('defender_fleet').$type<Fleet>().notNull().default({}),
  /**
   * Ground units rebuilt free from their own wreckage. Defender's eyes only.
   *
   * Without it a defender reads "you lost 7 Bastions" and concludes ground defence
   * is consumable — which is the opposite of the rule it is priced on (60% salvage,
   * and consumable defence made 95% of attacks DECISIVE). The number that makes
   * the loss legible was computed, applied and thrown away.
   */
  defenceSalvage: jsonb('defence_salvage').$type<Fleet>().notNull().default({}),
  /**
   * Minutes the defender's works stand offline AFTER this battle, from its instant.
   *
   * Zero whenever the grade caused no disruption at all, which is what stops a
   * REPELLED raid inheriting a deadline an earlier raid had already set.
   */
  disruptedMinutes: real('disrupted_minutes').notNull().default(0),
  /** Value of the wreckage this fight left in orbit, before anyone harvested it. */
  wreckValue: real('wreck_value').notNull().default(0),
  /** True only when surviving cargo, rather than exposed stock, capped the haul. D94. */
  cargoLimited: boolean('cargo_limited').notNull().default(false),
  /** Auditable combat telemetry; reserved for the Breacher decision, not an unlock yet. */
  shieldAbsorbed: real('shield_absorbed').notNull().default(0),
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

export interface StrategicLevelChange {
  kind: 'BUILDING' | 'INSTRUMENT';
  id: string;
  before: number;
  after: number;
}

export interface StrategicDestroyedOrder {
  kind: BuildOrderKind;
  subject: string;
  count: number;
  cost: Resources;
}

/** A Death Star's durable private history and season damage ledger. D103. */
export const strategicImpacts = pgTable('strategic_impacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  missionId: uuid('mission_id').notNull().references(() => missions.id),
  attackerPlayerId: uuid('attacker_player_id').notNull().references(() => players.id),
  defenderPlayerId: uuid('defender_player_id').references(() => players.id),
  targetPlanetId: uuid('target_planet_id').notNull().references(() => planets.id),
  outcome: text('outcome')
    .$type<'FIRST_STRIKE' | 'CAPTURED' | 'INEFFECTIVE' | 'INTERCEPTED'>()
    .notNull(),
  damage: real('damage').notNull().default(0),
  destroyedFleet: jsonb('destroyed_fleet').$type<Fleet>().notNull().default({}),
  /** Exact losses, stored at resolution because none can be reconstructed later. */
  destroyedResources: jsonb('destroyed_resources').$type<Resources>().notNull().default({
    alloy: 0,
    crystal: 0,
    deuterium: 0,
  }),
  levelChanges: jsonb('level_changes').$type<StrategicLevelChange[]>().notNull().default([]),
  destroyedOrders: jsonb('destroyed_orders').$type<StrategicDestroyedOrder[]>().notNull().default([]),
  shieldDestroyed: real('shield_destroyed').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('strategic_impacts_mission_idx').on(t.missionId),
  index('strategic_impacts_attacker_idx').on(t.attackerPlayerId, t.createdAt),
  index('strategic_impacts_defender_idx').on(t.defenderPlayerId, t.createdAt),
]);

/**
 * One anti-strategic launch, including the exact eight-second scene clients replay.
 * The mission is already prevented from landing when this row is written; the
 * scheduled impact closes the visual event and delivers its reports exactly once.
 */
export const strategicInterceptions = pgTable('strategic_interceptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  missionId: uuid('mission_id').notNull().references(() => missions.id),
  attackerPlayerId: uuid('attacker_player_id').notNull().references(() => players.id),
  defenderPlayerId: uuid('defender_player_id').notNull().references(() => players.id),
  targetPlanetId: uuid('target_planet_id').notNull().references(() => planets.id),
  chargeId: uuid('charge_id').notNull().references(() => strategicAssets.id),
  trigger: text('trigger').$type<'RADAR' | 'TELESCOPE'>().notNull(),
  launchAt: timestamp('launch_at', { withTimezone: true }).notNull(),
  impactAt: timestamp('impact_at', { withTimezone: true }).notNull(),
  launchX: real('launch_x').notNull(),
  launchY: real('launch_y').notNull(),
  launchZ: real('launch_z').notNull(),
  deathStarFromX: real('death_star_from_x').notNull(),
  deathStarFromY: real('death_star_from_y').notNull(),
  deathStarFromZ: real('death_star_from_z').notNull(),
  collisionX: real('collision_x').notNull(),
  collisionY: real('collision_y').notNull(),
  collisionZ: real('collision_z').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('strategic_interceptions_mission_idx').on(t.missionId),
  index('strategic_interceptions_season_time_idx').on(t.seasonId, t.launchAt, t.impactAt),
  index('strategic_interceptions_defender_idx').on(t.defenderPlayerId, t.launchAt),
  check('strategic_interceptions_trigger_check', sql`${t.trigger} IN ('RADAR', 'TELESCOPE')`),
  check('strategic_interceptions_window_check', sql`${t.impactAt} > ${t.launchAt}`),
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
  /** Null until the observer has earned isotope spectroscopy. */
  deuteriumStock: jsonb('deuterium_stock').$type<{ low: number; high: number }>(),
  defence: jsonb('defence').$type<{ low: number; high: number }>().notNull(),
  fleetSize: jsonb('fleet_size').$type<{ low: number; high: number }>().notNull(),
  fleetHome: boolean('fleet_home').notNull(),
  strategicStatus: text('strategic_status').$type<'READY' | 'BUILDING' | 'NONE' | 'UNKNOWN'>(),
  /** Whether the target's radar caught it — the observer learns this too. */
  detected: boolean('detected').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  /**
   * WHAT THE WORLD LOOKED LIKE FROM OUTSIDE, AT THE MOMENT OF THE PROBE. D127.
   *
   * Everything above is a BAND — stock, defence, fleet size, fuzzed by accuracy.
   * This is the other half, and it is exact rather than fuzzed because it is what
   * a craft in orbit can simply SEE: whose flag is on the world, how developed it
   * is, what is in orbit, whether a dome is up.
   *
   * It exists because D127 made all of that private. It used to be on
   * `/api/galaxy` for every world in the disc, so there was nothing to record; now
   * a world outside a commander's Telescope reach is an unmarked point until a
   * probe has been there, and this is what the probe brings home.
   *
   * FROZEN, AND THAT IS THE FEATURE. The observer goes on seeing these values
   * until they probe again, however much the target builds in the meantime — the
   * city you visited once and never returned to. It needs no expiry for the same
   * reason: an old record decays in value on its own as its subject grows past it,
   * which punishes exactly the commander who stopped looking.
   *
   * Null on reports written before D127, which render as they always did.
   */
  silhouette: jsonb('silhouette').$type<{
    owner: string;
    controllerPlayerId: string | null;
    clan: { id: string; name: string; tag: string } | null;
    kind: 'CAPITAL' | 'COLONY' | 'NEUTRAL';
    coreLevel: number;
    satellites: string[];
    shielded: boolean;
    /**
     * WHAT THIS COMMANDER HAS RESEARCHED INTO THEIR HULLS. T9 · D124.
     *
     * A 25% multiplier nobody can see would silently eat the value of every
     * scouting flight, and D124 is blunt: a rule the player cannot SEE is not a
     * rule. So the doctrines are a PROBE product — earned, never public — and
     * they freeze at the look like everything else here. Absent on reports
     * written before this existed, which read as no research at all.
     */
    doctrines?: Partial<Record<ResearchProjectId, number>>;
    /**
     * WHETHER THIS WORLD CAN SHOOT A DEATH STAR DOWN. T10.
     *
     * The single most valuable thing a probe can bring home once the war act
     * opens, and it is what turns a strategic strike from a pure resource decision
     * into an INTELLIGENCE one: 33,000 resources and an hour, spent on a world
     * that may simply delete them. Never public — `/api/galaxy` says nothing about
     * it — so the only way to know is to have looked, which is the whole argument
     * for the feature.
     */
    interceptor?: boolean;
  }>(),
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
  /**
   * THE GALAXY READ'S OWN INDEX. D127.
   *
   * `rememberedWorlds` runs on every `/api/galaxy` and asks for one commander's
   * reports newest-delivered first. The index above is on `createdAt`, so it
   * cannot serve that ordering — a season's worth of probes would be sorted from
   * scratch on the hottest read in the game.
   */
  index('probe_reports_memory_idx').on(t.observerPlayerId, t.deliveredAt),
  uniqueIndex('probe_reports_mission_idx').on(t.missionId),
]);

/**
 * The one delivered probe report currently used to draw each remembered world.
 *
 * `probe_reports` remains the complete Intel-centre history. This bounded read
 * model prevents `/api/galaxy` from walking that history on every request just to
 * rediscover the newest report for each target. `seenAt` duplicates the report's
 * observation instant deliberately: it is the age of the frozen facts, while
 * `deliveredAt` remains only the gate that says when the observer may read them.
 * It also lets concurrent returns replace this pointer atomically only when the
 * candidate observation is newer.
 *
 * No foreign key cascades. Seasonal wipes and seat reclamation delete this child
 * explicitly, like the rest of this schema's audit-facing graph.
 */
export const probeWorldMemories = pgTable('probe_world_memories', {
  observerPlayerId: uuid('observer_player_id').notNull().references(() => players.id),
  targetPlanetId: uuid('target_planet_id').notNull().references(() => planets.id),
  reportId: uuid('report_id').notNull().references(() => probeReports.id),
  seenAt: timestamp('seen_at', { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.observerPlayerId, t.targetPlanetId] }),
  uniqueIndex('probe_world_memories_report_idx').on(t.reportId),
]);

/** Telescope assignments. The target is NEVER told this row exists. */
export const watches = pgTable('watches', {
  observerPlayerId: uuid('observer_player_id').notNull().references(() => players.id),
  observerPlanetId: uuid('observer_planet_id').notNull().references(() => planets.id),
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
}, (t) => [
  primaryKey({ columns: [t.observerPlanetId, t.slot] }),
  index('watches_observer_player_idx').on(t.observerPlayerId),
]);

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
  deuterium: real('deuterium').notNull().default(0),
  takenAlloy: real('taken_alloy').notNull().default(0),
  takenCrystal: real('taken_crystal').notNull().default(0),
  takenDeuterium: real('taken_deuterium').notNull().default(0),
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
  minedDeuterium: real('mined_deuterium').notNull().default(0),
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
  id: uuid('id').primaryKey().defaultRandom(),
  idempotencyKey: text('idempotency_key').notNull(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  operation: text('operation').notNull(),
  requestHash: text('request_hash').notNull(),
  response: jsonb('response').$type<unknown>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('request_log_scope_idx').on(t.playerId, t.operation, t.idempotencyKey),
  index('request_log_created_idx').on(t.createdAt),
]);

/**
 * A REWARD THAT HAS BEEN UNLOCKED, AND WHETHER IT HAS BEEN TAKEN.
 *
 * One row per (player, tier), and the primary key is the whole of the
 * once-only rule: a second claim is a duplicate-key violation rather than an
 * application check that two concurrent taps could both pass.
 *
 * THE TABLE DOES TWO JOBS BECAUSE THEY ARE THE SAME JOB SEEN FROM TWO ENDS.
 *
 *   · For the ten EARNED chains a row is written at the moment of claiming, with
 *     `claimedAt` set. Eligibility itself is never stored — it is counted from
 *     missions, runs and levels every time the panel is read — so a row here
 *     means "paid", full stop.
 *   · `SOCIAL` NO LONGER LIVES HERE — see `accountRewards` directly below. It is
 *     the one reward that is paid once per PERSON rather than once per season,
 *     and a row keyed on `players` cannot express that: the player row is deleted
 *     by a wipe and by the idle-seat reclaim, so the grant went with it and the
 *     same commander could be paid again every fortnight for one follow.
 *
 * The amounts are stored rather than re-read from `@astera/rules` at display
 * time, for the reason every ledger stores them: what a tier pays may be retuned,
 * and a receipt that changes retroactively is not a receipt.
 */
export const rewardGrants = pgTable('reward_grants', {
  playerId: uuid('player_id').notNull().references(() => players.id),
  /** `CHAIN:GOAL`, built by `rewardId()` in @astera/rules. Text, so retiring a
   *  chain leaves old rows readable instead of failing an enum cast. */
  rewardId: text('reward_id').notNull(),
  alloy: real('alloy').notNull().default(0),
  crystal: real('crystal').notNull().default(0),
  deuterium: real('deuterium').notNull().default(0),
  /** NULL means unlocked and waiting. Season-scoped tiers are only ever written claimed. */
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.playerId, t.rewardId] })]);

/**
 * A REWARD THAT IS PAID ONCE PER PERSON, FOR EVER. Owner instruction: *"twitter
 * takip bonusu kişiye 1 kez verilebilmeli. her sezon her sezon alamaz."*
 *
 * IT IS THE SAME SHAPE AS `reward_grants` KEYED ONE LEVEL UP, and that is the
 * whole feature. The account is the only identity in this database that outlives
 * a galaxy: `players` is deleted by `wipeAllServers` and by the idle-seat reclaim
 * (D70), which is exactly right for progress counted off a world that no longer
 * exists, and exactly wrong for an act performed on Twitter by a human being.
 *
 * SO NOTHING MAY DELETE FROM THIS TABLE. Not the wipe, not the reclaim, not the
 * season rollover. A row here is the sentence "this person has already been paid
 * for following us", and it is only true for as long as it is kept — which is why
 * the wipe's `delete(rewardGrants)` is deliberately NOT mirrored here, and why
 * that omission is stated at both sites rather than left to be noticed.
 *
 * `claimedAt` NULL means the operator has confirmed the follow and the commander
 * has not yet pressed the button. It stays NULL across a rollover, so somebody who
 * was granted the bonus on the last day of a season can still take it on the first
 * day of the next — paid once, but not lost.
 */
export const accountRewards = pgTable('account_rewards', {
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  /** `CHAIN:GOAL`, built by `rewardId()`. Only chains with `scope: 'account'` land here. */
  rewardId: text('reward_id').notNull(),
  alloy: real('alloy').notNull().default(0),
  crystal: real('crystal').notNull().default(0),
  deuterium: real('deuterium').notNull().default(0),
  /** NULL means granted and waiting to be taken. */
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.accountId, t.rewardId] })]);
