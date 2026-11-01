import { and, asc, count, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { LEGACY_SHOWCASE_SLOTS, legacyDefinition, legacyAwardRarity } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { accounts, legacyAwards, legacyProfiles, legacyShowcaseSlots, players, seasonCycles, seasonResults, seasons, shards } from '../db/schema.js';
import { GameError } from './planet.js';

export async function legacyIdentity(db: Queryable, publicId: string) {
  const [row] = await db.select({ accountId: accounts.id, name: accounts.displayName, country: accounts.countryCode,
    createdAt: accounts.createdAt, profile: legacyProfiles }).from(legacyProfiles)
    .innerJoin(accounts, eq(accounts.id, legacyProfiles.accountId)).where(eq(legacyProfiles.publicId, publicId));
  if (!row) throw new GameError('LEGACY_PROFILE_NOT_FOUND', 'Commander profile not found', 404);
  return row;
}

/** A podium's place is public on the archived ladder; the rest of the evidence stays private. */
function podiumRank(row: typeof legacyAwards.$inferSelect): number | null {
  const metric = legacyDefinition(row.definitionId)?.metric;
  if (metric !== 'HONOR_RANK' && metric !== 'DOMINION_RANK') return null;
  const rank = (row.evidence as { rank?: unknown }).rank;
  return typeof rank === 'number' && Number.isSafeInteger(rank) && rank > 0 ? rank : null;
}

function awardView(row: typeof legacyAwards.$inferSelect, seasonOrdinal: number | null) {
  const definition = legacyDefinition(row.definitionId);
  if (!definition) throw new Error(`Unknown legacy definition ${row.definitionId}`);
  return { id: row.id, definitionId: row.definitionId, tier: row.tier, edition: row.edition,
    category: definition.category, form: definition.form, rarity: legacyAwardRarity(row.definitionId, row.tier),
    sourceSeasonId: row.sourceSeasonId, earnedAt: row.earnedAt, grantedAt: row.grantedAt,
    seasonOrdinal, rank: podiumRank(row) };
}

/** Players count seasons by the cycle ordinal; a null source season has none. */
const seasonOrdinal = sql<number | null>`(SELECT c.ordinal FROM seasons s JOIN season_cycles c ON c.id = s.cycle_id
  WHERE s.id = ${legacyAwards.sourceSeasonId})`;

/** Seasons in the public history, and the best place on each ladder with a positive score. */
async function careerOf(db: Queryable, accountId: string) {
  const [row] = await db.select({
    seasons: sql<number>`count(*)::int`,
    bestHonorRank: sql<number | null>`min(${seasonResults.honorRank}) FILTER (WHERE ${seasonResults.honorScore} > 0)`,
    bestDominionRank: sql<number | null>`min(${seasonResults.finalRank}) FILTER (WHERE ${seasonResults.dominion} > 0)`,
  }).from(seasonResults).innerJoin(seasons, eq(seasons.id, seasonResults.seasonId)).innerJoin(shards, eq(shards.id, seasons.shardId))
    .where(and(eq(seasonResults.accountId, accountId), eq(shards.role, 'MAIN'), sql`${seasons.status} IN ('frozen', 'wiped')`));
  return { seasons: row?.seasons ?? 0, bestHonorRank: row?.bestHonorRank ?? null, bestDominionRank: row?.bestDominionRank ?? null };
}

const awardOwners = sql<number>`(SELECT count(DISTINCT owner.account_id)::int FROM legacy_awards owner
  WHERE owner.definition_id = ${legacyAwards.definitionId} AND owner.tier = ${legacyAwards.tier}
    AND owner.edition = ${legacyAwards.edition} AND owner.revoked_at IS NULL)`;

export async function legacyProfileView(db: Queryable, publicId: string, viewerId: string) {
  const identity = await legacyIdentity(db, publicId);
  const [slots, title, [collection], career] = await Promise.all([
    db.select({ slot: legacyShowcaseSlots.slot, award: legacyAwards, ordinal: seasonOrdinal }).from(legacyShowcaseSlots)
      .innerJoin(legacyAwards, eq(legacyAwards.id, legacyShowcaseSlots.awardId))
      .where(and(eq(legacyShowcaseSlots.accountId, identity.accountId), isNull(legacyAwards.revokedAt)))
      .orderBy(asc(legacyShowcaseSlots.slot)).limit(LEGACY_SHOWCASE_SLOTS),
    identity.profile.activeTitleAwardId === null ? Promise.resolve([]) : db.select({ award: legacyAwards, ordinal: seasonOrdinal }).from(legacyAwards)
      .where(and(eq(legacyAwards.id, identity.profile.activeTitleAwardId), isNull(legacyAwards.revokedAt))).limit(1),
    db.select({ count: count() }).from(legacyAwards).where(and(eq(legacyAwards.accountId, identity.accountId), isNull(legacyAwards.revokedAt))),
    careerOf(db, identity.accountId),
  ]);
  return { publicId, commanderName: identity.name, country: identity.country,
    joinedAt: identity.createdAt, portrait: identity.profile.portrait, backdrop: identity.profile.backdrop,
    self: identity.accountId === viewerId, activeTitle: title[0] ? awardView(title[0].award, title[0].ordinal) : null,
    collection: { count: collection?.count ?? 0 }, career,
    showcase: slots.map(row => ({ slot: row.slot, awardId: row.award.id, award: awardView(row.award, row.ordinal) })) };
}

export async function legacyCollectionView(db: Queryable, publicId: string, limit: number, cursor?: string) {
  const identity = await legacyIdentity(db, publicId);
  const rows = await db.select({ award: legacyAwards, owners: awardOwners, ordinal: seasonOrdinal }).from(legacyAwards)
    .where(and(eq(legacyAwards.accountId, identity.accountId), isNull(legacyAwards.revokedAt),
    cursor ? gt(legacyAwards.id, cursor) : undefined)).orderBy(asc(legacyAwards.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  return { awards: page.map(row => ({ ...awardView(row.award, row.ordinal), owners: row.owners })),
    nextCursor: rows.length > limit ? page.at(-1)?.award.id ?? null : null };
}

export async function legacyAwardView(db: Queryable, publicId: string, awardId: string) {
  const identity = await legacyIdentity(db, publicId);
  const [row] = await db.select({ award: legacyAwards, owners: awardOwners, ordinal: seasonOrdinal }).from(legacyAwards).where(and(eq(legacyAwards.accountId, identity.accountId),
    eq(legacyAwards.id, awardId), isNull(legacyAwards.revokedAt)));
  if (!row) throw new GameError('LEGACY_AWARD_NOT_FOUND', 'Award not found', 404);
  const { award, owners, ordinal } = row;
  const definition = legacyDefinition(award.definitionId);
  if (!definition) throw new Error(`Unknown legacy definition ${award.definitionId}`);
  const source = award.sourceSeasonId === null ? [] : await db.select({ seasonId: seasons.id, ordinal: seasonCycles.ordinal,
    galaxy: sql<string>`coalesce(nullif(${shards.name}, ''), ${shards.code})`, startsAt: seasons.startsAt, closedAt: seasons.closedAt }).from(seasons)
    .innerJoin(shards, eq(shards.id, seasons.shardId)).innerJoin(seasonCycles, eq(seasonCycles.id, seasons.cycleId))
    .where(eq(seasons.id, award.sourceSeasonId)).limit(1);
  return { award: awardView(award, ordinal), owners,
    condition: { metric: definition.metric, goal: definition.goals[award.tier - 1]!, scope: definition.scope },
    season: source[0] ?? null };
}

export async function legacySeasonsView(db: Queryable, publicId: string, limit: number, before?: number) {
  const identity = await legacyIdentity(db, publicId);
  const rows = await db.select({ result: seasonResults, season: seasons, cycle: seasonCycles, shard: shards }).from(seasonResults)
    .innerJoin(seasons, eq(seasons.id, seasonResults.seasonId)).innerJoin(shards, eq(shards.id, seasons.shardId))
    .innerJoin(seasonCycles, eq(seasonCycles.id, seasonResults.cycleId))
    .where(and(eq(seasonResults.accountId, identity.accountId), eq(shards.role, 'MAIN'),
      sql`${seasons.status} IN ('frozen', 'wiped')`, before === undefined ? undefined : sql`${seasonCycles.ordinal} < ${before}`))
    .orderBy(desc(seasonCycles.ordinal)).limit(limit + 1);
  const page = rows.slice(0, limit);
  return { seasons: page.map(({ result, season, cycle, shard }) => ({ resultId: result.publicId,
    seasonId: season.id, ordinal: cycle.ordinal, galaxy: shard.name || shard.code,
    startsAt: season.startsAt, closedAt: season.closedAt, endReason: season.endReason,
    honorRank: result.honorRank, honorScore: result.honorScore, dominionRank: result.finalRank,
    dominion: result.dominion, stats: result.stats })),
  nextCursor: rows.length > limit ? page.at(-1)?.cycle.ordinal ?? null : null };
}

/** Pieces a reveal can show at once; the rest wait for the next read. */
const REVEAL_PAGE = 50;

/** Won and not watched yet, oldest first, so a reveal tells the story in the order it happened. */
export async function legacyRevealsView(db: Queryable, accountId: string) {
  const waiting = and(eq(legacyAwards.accountId, accountId), isNull(legacyAwards.revealedAt), isNull(legacyAwards.revokedAt));
  const [rows, [total]] = await Promise.all([
    db.select({ award: legacyAwards, ordinal: seasonOrdinal }).from(legacyAwards).where(waiting)
      .orderBy(sql`coalesce(${legacyAwards.earnedAt}, ${legacyAwards.grantedAt})`, asc(legacyAwards.definitionId),
        asc(legacyAwards.tier), asc(legacyAwards.id)).limit(REVEAL_PAGE),
    db.select({ count: count() }).from(legacyAwards).where(waiting),
  ]);
  return { awards: rows.map(row => awardView(row.award, row.ordinal)), total: total?.count ?? 0 };
}

export async function legacyPlayerAccount(db: Queryable, playerId: string): Promise<string> {
  const [row] = await db.select({ accountId: players.accountId }).from(players).where(eq(players.id, playerId));
  if (!row) throw new GameError('LEGACY_PROFILE_NOT_FOUND', 'Commander profile not found', 404);
  return row.accountId;
}

export async function legacyResultAccount(db: Queryable, resultId: string): Promise<string> {
  const [row] = await db.select({ accountId: seasonResults.accountId }).from(seasonResults)
    .innerJoin(seasons, eq(seasons.id, seasonResults.seasonId)).innerJoin(shards, eq(shards.id, seasons.shardId))
    .where(and(eq(seasonResults.publicId, resultId), eq(shards.role, 'MAIN'), sql`${seasons.status} IN ('frozen', 'wiped')`));
  if (!row) throw new GameError('LEGACY_PROFILE_NOT_FOUND', 'Commander profile not found', 404);
  return row.accountId;
}

/** Operator-only receipts, including reversals. Never reused by a public projection. */
export async function legacyAwardAudit(db: Queryable, publicId: string, limit: number, cursor?: string) {
  const identity = await legacyIdentity(db, publicId);
  const rows = await db.select().from(legacyAwards).where(and(eq(legacyAwards.accountId, identity.accountId),
    cursor ? gt(legacyAwards.id, cursor) : undefined)).orderBy(asc(legacyAwards.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  return { awards: page, nextCursor: rows.length > limit ? page.at(-1)?.id ?? null : null };
}
