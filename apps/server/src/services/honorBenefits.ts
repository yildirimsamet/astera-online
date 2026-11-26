import { and, eq, sql, type SQL } from 'drizzle-orm';
import {
  HONOR_BENEFIT_PROGRAM_V1, HONOR_BENEFIT_PROGRAM_VERSION,
  HONOR_BENEFIT_THRESHOLDS_V1, HONOR_BENEFIT_THRESHOLDS_V2,
  HONOR_LAUNCH_VERSION, honorBenefits,
  type HonorBenefits, type HonorBenefitTier,
} from '@astera/rules';
import type { Db, Queryable, Tx } from '../db/client.js';
import type { Clock } from '../clock.js';
import { honorQuestTotals, honorSeasons, honorTotals, players, scheduledEvents, seasons } from '../db/schema.js';
import { GameError } from './planet.js';
import { publishShard } from '../stream/bus.js';
import { isSilentSpaceShard } from './waitingRoom.js';
import { schedule } from '../worker/queue.js';

/** Convert Honor benefits production percentage (-25 or 0) to the economy share (-0.25 or 0). */
export const honorProductionShareFrom = (benefits: Pick<HonorBenefits, 'productionPct'> | null | undefined): number =>
  (benefits?.productionPct ?? 0) / 100;

/** Zero-extra-query subselects embedded into the existing shards read during planet writes. */
export function honorProductionColumns(seasonId: SQL | string, playerId: SQL | string | null) {
  return {
    honorBenefitsVersion: sql<number | null>`(select hs.benefits_version from honor_seasons hs
      where hs.season_id = ${seasonId} and hs.mode = 'ACTIVE' limit 1)`,
    honorTotalScore: sql<number>`(coalesce((select ht.score from honor_totals ht
      where ht.season_id = ${seasonId} and ht.player_id = ${playerId} limit 1), 0)
      + coalesce((select hqt.micros from honor_quest_totals hqt
      where hqt.season_id = ${seasonId} and hqt.player_id = ${playerId} limit 1), 0))::double precision`,
  };
}

/** Resolve the frozen planet production share from the embedded shards columns. */
export function honorProductionShareFromColumns(
  columns: { honorBenefitsVersion: number | null; honorTotalScore: number } | undefined,
): number {
  if (columns?.honorBenefitsVersion !== HONOR_BENEFIT_PROGRAM_VERSION) return 0;
  const score = Math.trunc(columns.honorTotalScore);
  if (!Number.isSafeInteger(score)) return 0;
  return honorProductionShareFrom(honorBenefits(score, HONOR_BENEFIT_THRESHOLDS_V2));
}

/** Schedule an idempotent worker sync when a commander crosses the Tier -4 (-200) boundary. */
export async function scheduleHonorPenaltySync(tx: Tx, seasonId: string, playerId: string, at: Date): Promise<void> {
  const [existing] = await tx.select({ id: scheduledEvents.id }).from(scheduledEvents).where(and(
    eq(scheduledEvents.seasonId, seasonId),
    eq(scheduledEvents.kind, 'honor_penalty_sync'),
    eq(scheduledEvents.refId, playerId),
    eq(scheduledEvents.status, 'pending'),
  )).limit(1);
  if (existing) return;
  await schedule(tx, { seasonId, kind: 'honor_penalty_sync', refId: playerId, resolveAt: at });
}

/** One private commander snapshot; never a ranking-derived or client-selected tier. */
export async function readHonorPlayerPolicy(db: Queryable, seasonId: string, playerId: string) {
  const [row] = await db.select({ benefitsVersion: honorSeasons.benefitsVersion, version: honorSeasons.version, score: honorTotals.score, quest: honorQuestTotals.micros })
    .from(honorSeasons).innerJoin(players, and(eq(players.id, playerId), eq(players.seasonId, seasonId)))
    .leftJoin(honorTotals, and(eq(honorTotals.seasonId, seasonId), eq(honorTotals.playerId, playerId)))
    .leftJoin(honorQuestTotals, and(eq(honorQuestTotals.seasonId, seasonId), eq(honorQuestTotals.playerId, playerId)))
    .where(and(eq(honorSeasons.seasonId, seasonId), eq(honorSeasons.mode, 'ACTIVE')));
  const tacticalCredit = row?.version === HONOR_LAUNCH_VERSION;
  if (row?.benefitsVersion === null || row?.benefitsVersion === undefined) return { benefits: null, tacticalCredit };
  if (row.benefitsVersion !== HONOR_BENEFIT_PROGRAM_V1 && row.benefitsVersion !== HONOR_BENEFIT_PROGRAM_VERSION) {
    throw new Error('Unsupported frozen Honor benefit program');
  }
  // The ledger's total plus what the daily quests paid the seat (owner 2026-11-24: ordinary Honor).
  const score = (row.score ?? 0) + (row.quest ?? 0);
  const thresholds = row.benefitsVersion === HONOR_BENEFIT_PROGRAM_V1
    ? HONOR_BENEFIT_THRESHOLDS_V1
    : HONOR_BENEFIT_THRESHOLDS_V2;
  return {
    tacticalCredit,
    benefits: {
      version: row.benefitsVersion,
      score,
      thresholds,
      ...honorBenefits(score, thresholds),
    },
  };
}
export async function readHonorBenefits(db: Queryable, seasonId: string, playerId: string) {
  return (await readHonorPlayerPolicy(db, seasonId, playerId)).benefits;
}
export type HonorBenefitsView = Awaited<ReturnType<typeof readHonorBenefits>>;

/** A stale or older client must see the new bill before committing it. */
export function assertHonorBenefitsQuote(view: HonorBenefitsView, expected: HonorBenefitTier | undefined): void {
  if ((view !== null && expected !== view.tier) || (view === null && expected !== undefined && expected !== 0)) {
    throw new GameError('HONOR_QUOTE_CHANGED', 'Honor benefits changed; refresh the quote before confirming', 409);
  }
}

/** Explicit operational boundary. Season SHARE held by launches ensures that
 * already committed flights retain their snapshots even at the same instant. */
export async function enableHonorBenefits(db: Db, seasonId: string, clock: Clock, apply: boolean) {
  return db.transaction(async tx => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId)).for('update');
    if (season?.status !== 'live' || clock.now() >= season.endsAt) throw new Error('Honor benefits require a live season');
    if (await isSilentSpaceShard(tx, season.shardId)) throw new Error('Honor benefits require a main galaxy');
    const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId)).for('update');
    if (config?.mode !== 'ACTIVE' || config.closedAt !== null) throw new Error('Honor benefits require active Honor');
    if (
      config.benefitsVersion !== null
      && config.benefitsVersion !== HONOR_BENEFIT_PROGRAM_V1
      && config.benefitsVersion !== HONOR_BENEFIT_PROGRAM_VERSION
    ) {
      throw new Error('Honor benefit configuration is immutable');
    }
    if (apply && config.benefitsVersion !== HONOR_BENEFIT_PROGRAM_VERSION) {
      await tx.update(honorSeasons).set({ benefitsVersion: HONOR_BENEFIT_PROGRAM_VERSION }).where(eq(honorSeasons.seasonId, seasonId));
      const threshold = -HONOR_BENEFIT_THRESHOLDS_V2.negative[3]!;
      const affected = await tx.select({ playerId: players.id })
        .from(players)
        .leftJoin(honorTotals, and(eq(honorTotals.seasonId, seasonId), eq(honorTotals.playerId, players.id)))
        .leftJoin(honorQuestTotals, and(eq(honorQuestTotals.seasonId, seasonId), eq(honorQuestTotals.playerId, players.id)))
        .where(and(
          eq(players.seasonId, seasonId),
          sql`coalesce(${honorTotals.score}, 0) + coalesce(${honorQuestTotals.micros}, 0) <= ${threshold}`,
        ));
      const now = clock.now();
      for (const row of affected) {
        await scheduleHonorPenaltySync(tx, seasonId, row.playerId, now);
      }
      await publishShard(tx, seasonId, 'season');
    }
    return { seasonId, applied: apply, version: HONOR_BENEFIT_PROGRAM_VERSION, thresholds: HONOR_BENEFIT_THRESHOLDS_V2 };
  });
}
