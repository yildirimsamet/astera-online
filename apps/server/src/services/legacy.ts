import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import {
  LEGACY_CATALOGUE, LEGACY_SHOWCASE_SLOTS, LEGACY_VERSION, cosmeticById,
  legacyLoyalSeason, legacyRankDegree, legacySeasonEligible, legacyAwardRarity, legacyTiers,
  type LegacyDefinition, type LegacyMetric,
} from '@astera/rules';
import type { Db, Queryable, Tx } from '../db/client.js';
import { beforeCommit } from '../db/finalizers.js';
import {
  adminActions, botProfiles, cosmeticEntitlements, legacyActivityDays, legacyAwards, legacyFacts, legacyMonumentIntervals,
  legacyParticipation, legacyProfiles, legacyShowcaseSlots, players, seasonResults, seasons, shards,
} from '../db/schema.js';
import { GameError } from './planet.js';
import { botLegacyPieces } from './bots/legacy.js';

const DAY = 86_400_000;
const deferred = new WeakMap<Tx, Map<string, Date>>();
type Award = typeof legacyAwards.$inferInsert;

/** All gameplay locks precede profile locks; multi-recipient operations finish in account order. */
export function deferLegacyRefresh(tx: Tx, accountId: string, at: Date): void {
  let work = deferred.get(tx);
  if (!work) {
    work = new Map();
    deferred.set(tx, work);
    const accounts = work;
    beforeCommit(tx, 'legacy', async () => {
      try {
        for (const [id, time] of [...accounts].sort(([a], [b]) => a.localeCompare(b))) {
          await refreshLegacyAwards(tx, id, time);
        }
      } finally { deferred.delete(tx); }
    }, 'cosmetic');
  }
  const previous = work.get(accountId);
  if (!previous || previous < at) work.set(accountId, at);
}

async function profileIn(tx: Tx, accountId: string) {
  await tx.insert(legacyProfiles).values({ accountId }).onConflictDoNothing();
  const [profile] = await tx.select().from(legacyProfiles).where(eq(legacyProfiles.accountId, accountId)).for('update');
  if (!profile) throw new GameError('LEGACY_PROFILE_NOT_FOUND', 'Commander profile not found', 404);
  return profile;
}

export const ensureLegacyProfile = (db: Db, accountId: string) => db.transaction(tx => profileIn(tx, accountId));

async function evidenceSeason(tx: Tx, seasonId: string, from: Date, to = from) {
  if (!Number.isSafeInteger(from.getTime()) || !Number.isSafeInteger(to.getTime()) || from > to) {
    throw new GameError('LEGACY_EVIDENCE_INVALID', 'Invalid achievement evidence');
  }
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season || from < season.startsAt || to.getTime() > Math.min(season.endsAt.getTime(), season.closedAt?.getTime() ?? Infinity)) {
    throw new GameError('LEGACY_EVIDENCE_INVALID', 'Achievement evidence is outside its season');
  }
  return season;
}

export async function recordLegacyFact(tx: Tx, input: {
  accountId: string; seasonId: string; metric: LegacyMetric; sourceKey: string;
  amount: number; at: Date; origin?: 'EVENT' | 'RESTORED' | 'ARCHIVE'; dateKnown?: boolean;
}): Promise<boolean> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || !input.sourceKey || input.sourceKey.length > 512
    || !LEGACY_CATALOGUE.some(row => row.metric === input.metric)) {
    throw new GameError('LEGACY_EVIDENCE_INVALID', 'Invalid achievement evidence');
  }
  await evidenceSeason(tx, input.seasonId, input.at);
  if (input.origin === 'ARCHIVE') {
    // A sealed total includes existing event receipts. Newer actions remain additive.
    await tx.update(legacyFacts).set({ origin: 'RESTORED' }).where(and(eq(legacyFacts.accountId, input.accountId),
      eq(legacyFacts.seasonId, input.seasonId), eq(legacyFacts.metric, input.metric), eq(legacyFacts.origin, 'EVENT'),
      lte(legacyFacts.occurredAt, input.at)));
  }
  const inserted = await tx.insert(legacyFacts).values({ ...input, occurredAt: input.at })
    .onConflictDoNothing().returning({ accountId: legacyFacts.accountId });
  if (inserted.length === 0) {
    const [previous] = await tx.select().from(legacyFacts).where(and(eq(legacyFacts.accountId, input.accountId),
      eq(legacyFacts.seasonId, input.seasonId), eq(legacyFacts.metric, input.metric), eq(legacyFacts.sourceKey, input.sourceKey)));
    if (previous?.amount !== input.amount || (previous.origin !== (input.origin ?? 'EVENT')
      && (previous.origin === 'ARCHIVE' || input.origin === 'ARCHIVE'))) {
      throw new GameError('LEGACY_EVIDENCE_CONFLICT', 'Conflicting achievement evidence', 409);
    }
  }
  if (inserted.length > 0 && ((input.origin ?? 'EVENT') !== 'EVENT' || await mayCrossGoal(tx, input))) {
    deferLegacyRefresh(tx, input.accountId, input.at);
  }
  return inserted.length > 0;
}

/**
 * The hot path (a probe launch, a finished build) holds gameplay locks, so a live receipt
 * re-reads the whole journal only when it can cross a goal. The plain sum counts every
 * season and origin, so it is never below the evaluated progress; a crossing it misses is
 * granted by the next profile read, which always evaluates.
 */
async function mayCrossGoal(tx: Tx, input: { accountId: string; metric: LegacyMetric; amount: number }): Promise<boolean> {
  const goals = LEGACY_CATALOGUE.filter(row => row.metric === input.metric).flatMap(row => row.goals);
  const [row] = await tx.select({ total: sql<string>`coalesce(sum(${legacyFacts.amount}), 0)::text` }).from(legacyFacts)
    .where(and(eq(legacyFacts.accountId, input.accountId), eq(legacyFacts.metric, input.metric)));
  const after = Number(row?.total ?? 0);
  const before = after - input.amount;
  return goals.some(goal => before < goal && goal <= after);
}

export async function recordLegacyMonumentInterval(tx: Tx, input: {
  accountId: string; seasonId: string; sourceKey: string; from: Date; to: Date;
}): Promise<void> {
  if (input.from.getTime() === input.to.getTime()) return;
  if (!input.sourceKey || input.sourceKey.length > 512) throw new GameError('LEGACY_EVIDENCE_INVALID', 'Invalid monument evidence');
  await evidenceSeason(tx, input.seasonId, input.from, input.to);
  await tx.insert(legacyMonumentIntervals).values(input).onConflictDoUpdate({
    target: [legacyMonumentIntervals.accountId, legacyMonumentIntervals.seasonId, legacyMonumentIntervals.sourceKey],
    set: { from: sql`least(${legacyMonumentIntervals.from}, ${input.from.toISOString()}::timestamptz)`,
      to: sql`greatest(${legacyMonumentIntervals.to}, ${input.to.toISOString()}::timestamptz)` },
  });
  deferLegacyRefresh(tx, input.accountId, input.to);
}

export async function registerLegacyParticipation(tx: Tx, accountId: string, seasonId: string, joinedAt: Date): Promise<void> {
  await tx.insert(legacyParticipation).values({ accountId, seasonId, joinedAt }).onConflictDoUpdate({
    target: [legacyParticipation.accountId, legacyParticipation.seasonId],
    set: { joinedAt: sql`least(${legacyParticipation.joinedAt}, ${joinedAt.toISOString()}::timestamptz)` },
  });
}

export async function recordLegacyActivity(tx: Tx, playerId: string, at: Date): Promise<void> {
  const [player] = await tx.select({ accountId: players.accountId, seasonId: players.seasonId, joinedAt: players.joinedAt,
    startsAt: seasons.startsAt, endsAt: seasons.endsAt }).from(players).innerJoin(seasons, eq(seasons.id, players.seasonId))
    .innerJoin(shards, eq(shards.id, seasons.shardId)).where(and(eq(players.id, playerId), eq(shards.role, 'MAIN'), eq(seasons.status, 'live')));
  if (!player || at < player.startsAt || at >= player.endsAt) return;
  await registerLegacyParticipation(tx, player.accountId, player.seasonId, player.joinedAt);
  const inserted = await tx.insert(legacyActivityDays).values({ accountId: player.accountId, seasonId: player.seasonId,
    day: Math.floor((at.getTime() - player.startsAt.getTime()) / DAY), firstActionAt: at }).onConflictDoNothing().returning({ day: legacyActivityDays.day });
  if (inserted.length > 0) deferLegacyRefresh(tx, player.accountId, at);
}

interface EligibleSeason {
  id: string; cycleId: string; startsAt: Date; endsAt: Date; status: string; through: Date;
}

async function eligibleSeasons(db: Queryable, accountId: string, at: Date): Promise<EligibleSeason[]> {
  const rows = await db.execute<{
    id: string; cycleId: string; startsAt: string; endsAt: string; closedAt: string | null;
    firstResultAt: string | null; status: string;
  }>(sql`
    SELECT s.id, s.cycle_id AS "cycleId", s.starts_at AS "startsAt", s.ends_at AS "endsAt",
      s.closed_at AS "closedAt", s.status,
      (SELECT min(r.created_at) FROM season_results r WHERE r.season_id = s.id) AS "firstResultAt"
    FROM seasons s JOIN shards sh ON sh.id = s.shard_id
    WHERE sh.role = 'MAIN' AND s.status <> 'pending' AND s.id IN (
      SELECT season_id FROM legacy_facts WHERE account_id = ${accountId}
      UNION SELECT season_id FROM legacy_participation WHERE account_id = ${accountId}
      UNION SELECT season_id FROM legacy_activity_days WHERE account_id = ${accountId}
      UNION SELECT season_id FROM legacy_monument_intervals WHERE account_id = ${accountId}
      UNION SELECT season_id FROM season_results WHERE account_id = ${accountId})
  `);
  return rows.flatMap(raw => {
    const row = { ...raw, startsAt: new Date(raw.startsAt), endsAt: new Date(raw.endsAt),
      closedAt: raw.closedAt === null ? null : new Date(raw.closedAt),
      firstResultAt: raw.firstResultAt === null ? null : new Date(raw.firstResultAt) };
    // Old forced wipes predate closed_at. The receipt date is evidence; the planned end is not.
    const boundary = row.status === 'live' ? at : row.closedAt ?? row.firstResultAt ?? row.startsAt;
    const through = new Date(Math.min(boundary.getTime(), row.endsAt.getTime(), at.getTime()));
    const qualifies = row.status === 'live' ? through >= row.startsAt
      : legacySeasonEligible(row.startsAt.getTime(), through.getTime());
    return qualifies ? [{ ...row, through }] : [];
  });
}

async function legacyState(db: Queryable, accountId: string, at: Date) {
  const eligible = await eligibleSeasons(db, accountId, at);
  const ids = eligible.map(row => row.id);
  const totals = new Map<LegacyMetric, number>();
  const perSeason = new Map<string, Map<LegacyMetric, number>>();
  const years = new Map<number, Date | null>();
  const earnedDates = new Map<string, Date>();
  const earnedSources = new Map<string, string>();
  const loyal: EligibleSeason[] = [];
  let activity: typeof legacyActivityDays.$inferSelect[] = [];
  if (ids.length > 0) {
    const rows = await db.execute<{ seasonId: string; metric: LegacyMetric; amount: string }>(sql`
      WITH receipts AS (
        SELECT *, max(occurred_at) FILTER (WHERE origin = 'ARCHIVE')
          OVER (PARTITION BY season_id, metric) AS sealed_at
        FROM legacy_facts WHERE account_id = ${accountId} AND season_id IN ${ids}
          AND occurred_at <= ${at.toISOString()}::timestamptz
      )
      SELECT season_id AS "seasonId", metric,
        (greatest(coalesce(sum(amount) FILTER (WHERE origin = 'RESTORED'
          OR (origin = 'EVENT' AND occurred_at <= sealed_at)), 0),
          coalesce(max(amount) FILTER (WHERE origin = 'ARCHIVE'), 0))
          + coalesce(sum(amount) FILTER (WHERE origin = 'EVENT' AND (sealed_at IS NULL OR occurred_at > sealed_at)), 0))::text AS amount
      FROM receipts GROUP BY season_id, metric
    `);
    for (const row of rows) {
      const amount = Number(row.amount);
      const total = (totals.get(row.metric) ?? 0) + amount;
      if (!Number.isSafeInteger(total)) throw new Error('Legacy progress exceeds the safe integer range');
      totals.set(row.metric, total);
      const metrics = perSeason.get(row.seasonId) ?? new Map<LegacyMetric, number>();
      metrics.set(row.metric, amount);
      perSeason.set(row.seasonId, metrics);
    }
    // A timestamp is claimable only when the whole metric has an exact event history.
    // An unrelated, undated archive must not erase another award's proven date.
    const goals = LEGACY_CATALOGUE.filter(row => row.scope === 'CAREER').flatMap(row =>
      row.goals.map(goal => sql`(${row.metric}::text, ${goal}::bigint)`));
    const dates = await db.execute<{ metric: string; goal: string; at: string; seasonId: string }>(sql`
      WITH progress AS (
        SELECT metric, occurred_at, season_id,
          sum(amount) OVER (PARTITION BY metric ORDER BY occurred_at, source_key) AS running,
          bool_and(date_known AND origin <> 'ARCHIVE') OVER (PARTITION BY metric) AS exact
        FROM legacy_facts WHERE account_id = ${accountId} AND season_id IN ${ids}
          AND occurred_at <= ${at.toISOString()}::timestamptz
      ), goals(metric, goal) AS (VALUES ${sql.join(goals, sql`, `)})
      SELECT DISTINCT ON (g.metric, g.goal) g.metric, g.goal::text, p.occurred_at AS at, p.season_id AS "seasonId" FROM goals g
        JOIN progress p ON p.metric = g.metric AND p.exact AND p.running >= g.goal
        ORDER BY g.metric, g.goal, p.occurred_at, p.season_id
    `);
    for (const row of dates) {
      earnedDates.set(`${row.metric}:${row.goal}`, new Date(row.at));
      earnedSources.set(`${row.metric}:${row.goal}`, row.seasonId);
    }
    const yearRows = await db.execute<{ year: number; at: string }>(sql`
      SELECT extract(year FROM d.first_action_at AT TIME ZONE 'UTC')::int AS year, min(d.first_action_at) AS at
      FROM legacy_activity_days d WHERE d.account_id = ${accountId} AND d.season_id IN ${ids}
        AND d.first_action_at <= ${at.toISOString()}::timestamptz
      GROUP BY year
    `);
    for (const row of yearRows) years.set(row.year, new Date(row.at));
    for (const season of eligible) {
      if ((perSeason.get(season.id)?.size ?? 0) > 0 && season.startsAt.getUTCFullYear() === season.through.getUTCFullYear()) {
        if (!years.has(season.startsAt.getUTCFullYear())) years.set(season.startsAt.getUTCFullYear(), null);
      }
    }
    const duty = await db.execute<{ from: string; to: string }>(sql`
      SELECT lower(span) AS "from", upper(span) AS "to"
      FROM (SELECT unnest(range_agg(tstzrange(from_at, least(to_at, ${at.toISOString()}::timestamptz), '[)'))) AS span
        FROM legacy_monument_intervals WHERE account_id = ${accountId} AND season_id IN ${ids}
          AND from_at < ${at.toISOString()}::timestamptz) duty
      ORDER BY lower(span)
    `);
    let heldMs = 0;
    for (const span of duty) {
      const from = new Date(span.from).getTime(), to = new Date(span.to).getTime();
      for (const goal of LEGACY_CATALOGUE.find(row => row.metric === 'MONUMENT_SECONDS')!.goals) {
        if (heldMs < goal * 1000 && heldMs + to - from >= goal * 1000) {
          earnedDates.set(`MONUMENT_SECONDS:${String(goal)}`, new Date(from + goal * 1000 - heldMs));
        }
      }
      heldMs += to - from;
    }
    totals.set('MONUMENT_SECONDS', Math.floor(heldMs / 1000));
    const participation = await db.select().from(legacyParticipation)
      .where(and(eq(legacyParticipation.accountId, accountId), inArray(legacyParticipation.seasonId, ids)));
    activity = await db.select().from(legacyActivityDays).where(and(eq(legacyActivityDays.accountId, accountId),
      inArray(legacyActivityDays.seasonId, ids), lte(legacyActivityDays.firstActionAt, at)));
    for (const cycleId of new Set(eligible.map(row => row.cycleId))) {
      const members = eligible.filter(row => row.cycleId === cycleId);
      if (members.some(row => row.status === 'live')) continue;
      const memberIds = new Set(members.map(row => row.id));
      const source = members[0]!;
      const joinedAt = Math.min(...participation.filter(row => memberIds.has(row.seasonId)).map(row => row.joinedAt.getTime()));
      if (Number.isFinite(joinedAt) && legacyLoyalSeason({ startsAt: source.startsAt.getTime(),
        closesAt: source.through.getTime(), joinedAt,
        activeDays: activity.filter(row => memberIds.has(row.seasonId)).map(row => row.day) })) loyal.push(source);
    }
  }
  const rights = await db.select().from(cosmeticEntitlements)
    .where(and(eq(cosmeticEntitlements.accountId, accountId), isNull(cosmeticEntitlements.revokedAt)));
  totals.set('SUPPORTER', rights.some(right => right.cosmeticId === 'badge-supporter') ? 1 : 0);
  totals.set('PAID_COSMETICS', new Set(rights.filter(right => ['PADDLE', 'POLAR', 'SHOPIER'].includes(right.source)
    && cosmeticById(right.cosmeticId) !== null).map(right => right.cosmeticId)).size);
  totals.set('LOYAL_SEASONS', loyal.length);
  const firstLoyal = [...loyal].sort((a, b) => a.through.getTime() - b.through.getTime())[0];
  if (firstLoyal) {
    earnedDates.set('LOYAL_SEASONS:1', firstLoyal.through);
    earnedSources.set('LOYAL_SEASONS:1', firstLoyal.id);
  }
  const supporter = rights.filter(right => right.cosmeticId === 'badge-supporter').sort((a, b) => a.grantedAt.getTime() - b.grantedAt.getTime())[0];
  if (supporter) earnedDates.set('SUPPORTER:1', supporter.grantedAt);
  const paid = new Map<string, Date>();
  for (const right of rights.filter(right => ['PADDLE', 'POLAR', 'SHOPIER'].includes(right.source) && cosmeticById(right.cosmeticId) !== null)) {
    const previous = paid.get(right.cosmeticId);
    if (!previous || right.grantedAt < previous) paid.set(right.cosmeticId, right.grantedAt);
  }
  const purchaseDates = [...paid.values()].sort((a, b) => a.getTime() - b.getTime());
  for (const goal of LEGACY_CATALOGUE.find(row => row.metric === 'PAID_COSMETICS')!.goals) {
    const date = purchaseDates[goal - 1];
    if (date) earnedDates.set(`PAID_COSMETICS:${String(goal)}`, date);
  }
  const [roster] = await db.select({ createdAt: botProfiles.createdAt,
    initialized: sql<boolean>`exists(select 1 from ${legacyAwards} where ${legacyAwards.accountId} = ${accountId}
      and ${legacyAwards.evidence}->>'showcaseInitialized' = 'true')`,
  }).from(botProfiles)
    .where(and(eq(botProfiles.accountId, accountId), lte(botProfiles.createdAt, at)));
  const initialPieces = roster && (process.env.BOT_LEGACY_ENABLED !== 'false' || roster.initialized) ? botLegacyPieces(accountId) : [];
  if (roster) for (const definition of initialPieces) {
    if (definition.scope === 'YEAR') {
      const year = roster.createdAt.getUTCFullYear();
      if (!years.has(year)) years.set(year, roster.createdAt);
    } else {
      const goal = definition.goals[0]!;
      totals.set(definition.metric, Math.max(totals.get(definition.metric) ?? 0, goal));
      const key = `${definition.metric}:${String(goal)}`;
      if (!earnedDates.has(key)) earnedDates.set(key, roster.createdAt);
    }
  }
  return { eligible, totals, perSeason, years, earnedDates, earnedSources, loyal, activity, initialPieces };
}

export async function legacyProgress(db: Queryable, accountId: string, at: Date) {
  const state = await legacyState(db, accountId, at);
  return LEGACY_CATALOGUE.filter(row => row.scope === 'CAREER').map(row => ({
    ...row, progress: state.totals.get(row.metric) ?? 0,
  }));
}

const awardKey = (award: Pick<Award, 'definitionId' | 'tier' | 'edition'>) => `${award.definitionId}:${String(award.tier)}:${award.edition}`;

export async function refreshLegacyAwards(tx: Tx, accountId: string, at: Date): Promise<void> {
  await profileIn(tx, accountId);
  const existing = await tx.select().from(legacyAwards).where(eq(legacyAwards.accountId, accountId));
  // A delayed worker carries the event's original timestamp, not a new observation clock.
  const lastGrant = Math.max(...existing.map(row => row.grantedAt.getTime()));
  if (lastGrant > at.getTime()) at = new Date(lastGrant);
  const state = await legacyState(tx, accountId, at);
  const candidates: Award[] = [];
  const closedResults = state.eligible.length === 0 ? [] : await tx.select().from(seasonResults)
    .where(and(eq(seasonResults.accountId, accountId), inArray(seasonResults.seasonId, state.eligible.map(row => row.id))));
  for (const season of state.eligible) {
    const year = season.startsAt.getUTCFullYear();
    if (season.status !== 'live' && year === season.through.getUTCFullYear() && !state.years.has(year)
      && closedResults.some(row => row.seasonId === season.id)) state.years.set(year, null);
  }
  const sourceFor = (metric: LegacyMetric, goal: number): string | null => {
    const key = `${metric}:${String(goal)}`;
    const exact = state.earnedSources.get(key);
    if (exact) return exact;
    const date = state.earnedDates.get(key);
    const datedSeasons = date ? state.eligible.filter(row => row.startsAt <= date && row.through >= date) : [];
    if (metric === 'MONUMENT_SECONDS') return datedSeasons.length === 1 ? datedSeasons[0]!.id : null;
    const contributors = state.eligible.filter(row => (state.perSeason.get(row.id)?.get(metric) ?? 0) > 0)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    // An undated total cannot choose between simultaneous galaxies in the same cycle.
    if (new Set(contributors.map(row => row.cycleId)).size !== contributors.length) return null;
    let total = 0;
    return contributors.find(row => { total += state.perSeason.get(row.id)?.get(metric) ?? 0; return total >= goal; })?.id ?? null;
  };
  const add = (definition: LegacyDefinition, tier: number, edition: string, sourceSeasonId: string | null,
    evidence: Record<string, unknown>, earnedAt: Date | null,
    rarity = legacyAwardRarity(definition.id, tier)) => {
    candidates.push({ accountId, definitionId: definition.id, tier, edition, sourceSeasonId,
      rarity, ruleVersion: LEGACY_VERSION, earnedAt, grantedAt: at, evidence });
  };
  for (const definition of LEGACY_CATALOGUE) {
    if (definition.scope !== 'CAREER') continue;
    const progress = state.totals.get(definition.metric) ?? 0;
    for (const tier of legacyTiers(definition.goals, progress)) {
      const goal = definition.goals[tier - 1]!;
      add(definition, tier, 'career', sourceFor(definition.metric, goal), { metric: definition.metric, progress, goal },
        state.earnedDates.get(`${definition.metric}:${String(goal)}`) ?? null);
    }
  }
  const pin = LEGACY_CATALOGUE.find(row => row.metric === 'YEAR_PLAYED')!;
  for (const [year, earnedAt] of state.years) add(pin, 1, `year:${String(year)}`, null, { year }, earnedAt);
  const ids = state.eligible.map(row => row.id);
  if (ids.length > 0) {
    const results = closedResults;
    const commemorated = new Set<string>();
    for (const season of state.eligible) {
      if (season.status === 'live') continue;
      const result = results.find(row => row.seasonId === season.id);
      for (const metric of ['HONOR_RANK', 'DOMINION_RANK'] as const) {
        const rank = metric === 'HONOR_RANK' ? result?.honorRank : result?.finalRank;
        const score = metric === 'HONOR_RANK' ? result?.honorScore : result?.dominion;
        const degree = rank == null || score == null ? null : legacyRankDegree(rank, score);
        if (degree === null) continue;
        const definition = LEGACY_CATALOGUE.find(row => row.metric === metric)!;
        const tier = degree === 'CHAMPION' ? 1 : degree === 'SILVER' ? 2 : degree === 'BRONZE' ? 3 : 4;
        add(definition, tier, `season:${season.id}`, season.id, { rank, score, degree }, season.through);
      }
      const days = state.activity.filter(row => row.seasonId === season.id);
      if (!commemorated.has(season.cycleId)
        && (days.length > 0 || (state.perSeason.get(season.id)?.size ?? 0) > 0 || result !== undefined)) {
        commemorated.add(season.cycleId);
        add(LEGACY_CATALOGUE.find(row => row.id === 'season-memento')!, 1, `cycle:${season.cycleId}`, season.id, { participation: true }, season.through);
      }
    }
  }
  const wanted = new Set(candidates.map(awardKey));
  for (const previous of existing) {
    if (previous.revokedAt === null && !wanted.has(awardKey(previous))) {
      await tx.update(legacyAwards).set({ revokedAt: at, revocationReason: 'INELIGIBLE' }).where(eq(legacyAwards.id, previous.id));
      await tx.delete(legacyShowcaseSlots).where(eq(legacyShowcaseSlots.awardId, previous.id));
      await tx.update(legacyProfiles).set({ activeTitleAwardId: null }).where(eq(legacyProfiles.activeTitleAwardId, previous.id));
    }
  }
  const previousByKey = new Map(existing.map(row => [awardKey(row), row]));
  // Reclassify in place: identities, dates, evidence, equipped pieces and reveals stay intact.
  for (const candidate of candidates) {
    const previous = previousByKey.get(awardKey(candidate));
    if (previous && previous.rarity !== candidate.rarity) {
      await tx.update(legacyAwards).set({ rarity: candidate.rarity }).where(eq(legacyAwards.id, previous.id));
    }
  }
  const missing = candidates.filter(row => !previousByKey.has(awardKey(row)));
  if (missing.length > 0) await tx.insert(legacyAwards).values(missing).onConflictDoNothing();
  const restored = candidates.flatMap(row => {
    const previous = previousByKey.get(awardKey(row));
    return previous?.revocationReason === 'INELIGIBLE' ? [previous.id] : [];
  });
  if (restored.length > 0) await tx.update(legacyAwards).set({ revokedAt: null, revocationReason: null }).where(inArray(legacyAwards.id, restored));
  // Record initialization even when the pieces were already earned, so an intentional empty shelf stays empty.
  const starterIds = state.initialPieces.map(row => row.id);
  if (starterIds.length > 0 && !existing.some(row => row.evidence.showcaseInitialized === true)) {
    const pieces = await tx.select({ id: legacyAwards.id, definitionId: legacyAwards.definitionId }).from(legacyAwards)
      .where(and(eq(legacyAwards.accountId, accountId), inArray(legacyAwards.definitionId, starterIds),
        eq(legacyAwards.tier, 1), isNull(legacyAwards.revokedAt)));
    const chosen = starterIds.flatMap(id => pieces.find(row => row.definitionId === id) ?? []);
    if (chosen[0]) {
      await tx.update(legacyAwards).set({ evidence: sql`${legacyAwards.evidence} || '{"showcaseInitialized":true}'::jsonb` })
        .where(eq(legacyAwards.id, chosen[0].id));
      const slots = await tx.select({ slot: legacyShowcaseSlots.slot }).from(legacyShowcaseSlots)
        .where(eq(legacyShowcaseSlots.accountId, accountId)).limit(1);
      if (slots.length === 0) await tx.insert(legacyShowcaseSlots).values(chosen.map((row, slot) => ({ accountId, slot, awardId: row.id })));
    }
  }
}

async function assertOwnedAwards(tx: Tx, accountId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const owned = await tx.select({ id: legacyAwards.id }).from(legacyAwards)
    .where(and(eq(legacyAwards.accountId, accountId), inArray(legacyAwards.id, [...ids]), isNull(legacyAwards.revokedAt)));
  if (owned.length !== ids.length) throw new GameError('LEGACY_AWARD_NOT_OWNED', 'Choose an award in your collection', 403);
}

export async function equipLegacyShowcase(db: Db, accountId: string, ids: readonly string[]): Promise<void> {
  if (ids.length > LEGACY_SHOWCASE_SLOTS || new Set(ids).size !== ids.length) {
    throw new GameError('LEGACY_SHOWCASE_INVALID', 'Choose up to six different awards');
  }
  await db.transaction(async tx => {
    await profileIn(tx, accountId);
    await assertOwnedAwards(tx, accountId, ids);
    await tx.delete(legacyShowcaseSlots).where(eq(legacyShowcaseSlots.accountId, accountId));
    if (ids.length > 0) await tx.insert(legacyShowcaseSlots).values(ids.map((awardId, slot) => ({ accountId, awardId, slot })));
  });
}

export async function equipLegacyTitle(db: Db, accountId: string, awardId: string | null): Promise<void> {
  await db.transaction(async tx => {
    await profileIn(tx, accountId);
    await assertOwnedAwards(tx, accountId, awardId === null ? [] : [awardId]);
    await tx.update(legacyProfiles).set({ activeTitleAwardId: awardId }).where(eq(legacyProfiles.accountId, accountId));
  });
}

/** The owner watched these pieces revealed. Someone else's id, a revoked piece or a repeat changes nothing. */
export async function revealLegacyAwards(db: Db, accountId: string, ids: readonly string[], at: Date): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db.update(legacyAwards).set({ revealedAt: at }).where(and(eq(legacyAwards.accountId, accountId),
    inArray(legacyAwards.id, [...ids]), isNull(legacyAwards.revealedAt), isNull(legacyAwards.revokedAt)))
    .returning({ id: legacyAwards.id });
  return rows.length;
}

/** Auth is enforced by the admin route. The durable reason is operator-only evidence. */
export async function revokeLegacyAward(db: Db, operatorId: string, awardId: string, reason: string, at: Date): Promise<void> {
  await db.transaction(async tx => {
    const [initial] = await tx.select({ accountId: legacyAwards.accountId }).from(legacyAwards).where(eq(legacyAwards.id, awardId));
    if (!initial) throw new GameError('LEGACY_AWARD_NOT_FOUND', 'Award not found', 404);
    await profileIn(tx, initial.accountId);
    const [award] = await tx.select().from(legacyAwards).where(eq(legacyAwards.id, awardId)).for('update');
    if (!award) throw new GameError('LEGACY_AWARD_NOT_FOUND', 'Award not found', 404);
    if (award.revocationReason === 'ADMIN') return;
    await tx.update(legacyAwards).set({ revokedAt: at, revocationReason: 'ADMIN' }).where(eq(legacyAwards.id, awardId));
    await tx.delete(legacyShowcaseSlots).where(eq(legacyShowcaseSlots.awardId, awardId));
    await tx.update(legacyProfiles).set({ activeTitleAwardId: null }).where(eq(legacyProfiles.activeTitleAwardId, awardId));
    await tx.insert(adminActions).values({ actorAccountId: operatorId, targetAccountId: initial.accountId,
      action: 'LEGACY_AWARD_REVOKED', details: { awardId, reason }, createdAt: at });
  });
}

/** Undo an operator reversal only if the original, server-proven condition still holds. */
export async function restoreLegacyAward(db: Db, operatorId: string, awardId: string, reason: string, at: Date): Promise<void> {
  await db.transaction(async tx => {
    const [initial] = await tx.select({ accountId: legacyAwards.accountId }).from(legacyAwards).where(eq(legacyAwards.id, awardId));
    if (!initial) throw new GameError('LEGACY_AWARD_NOT_FOUND', 'Award not found', 404);
    await profileIn(tx, initial.accountId);
    const [award] = await tx.select().from(legacyAwards).where(eq(legacyAwards.id, awardId)).for('update');
    if (award?.revocationReason !== 'ADMIN') {
      if (award?.revokedAt) throw new GameError('LEGACY_CONDITION_NOT_MET', 'The original achievement condition is not met', 409);
      return;
    }
    await tx.update(legacyAwards).set({ revocationReason: 'INELIGIBLE' }).where(eq(legacyAwards.id, awardId));
    await refreshLegacyAwards(tx, initial.accountId, at);
    const [restored] = await tx.select({ revokedAt: legacyAwards.revokedAt }).from(legacyAwards).where(eq(legacyAwards.id, awardId));
    if (restored?.revokedAt) throw new GameError('LEGACY_CONDITION_NOT_MET', 'The original achievement condition is not met', 409);
    await tx.insert(adminActions).values({ actorAccountId: operatorId, targetAccountId: initial.accountId,
      action: 'LEGACY_AWARD_RESTORED', details: { awardId, reason }, createdAt: at });
  });
}
