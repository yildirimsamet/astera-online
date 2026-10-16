import { and, eq } from 'drizzle-orm';
import { HONOR_BENEFIT_PROGRAM_VERSION, HONOR_BENEFIT_THRESHOLDS_V1, HONOR_LAUNCH_VERSION, honorBenefits,
  type HonorBenefitTier } from '@astera/rules';
import type { Db, Queryable } from '../db/client.js';
import type { Clock } from '../clock.js';
import { honorSeasons, honorTotals, players, seasons } from '../db/schema.js';
import { GameError } from './planet.js';
import { publishShard } from '../stream/bus.js';
import { isSilentSpaceShard } from './waitingRoom.js';

/** One private commander snapshot; never a ranking-derived or client-selected tier. */
export async function readHonorPlayerPolicy(db: Queryable, seasonId: string, playerId: string) {
  const [row] = await db.select({ benefitsVersion: honorSeasons.benefitsVersion, version: honorSeasons.version, score: honorTotals.score })
    .from(honorSeasons).innerJoin(players, and(eq(players.id, playerId), eq(players.seasonId, seasonId)))
    .leftJoin(honorTotals, and(eq(honorTotals.seasonId, seasonId), eq(honorTotals.playerId, playerId)))
    .where(and(eq(honorSeasons.seasonId, seasonId), eq(honorSeasons.mode, 'ACTIVE')));
  const tacticalCredit = row?.version === HONOR_LAUNCH_VERSION;
  if (row?.benefitsVersion === null || row?.benefitsVersion === undefined) return { benefits: null, tacticalCredit };
  if (row.benefitsVersion !== HONOR_BENEFIT_PROGRAM_VERSION) throw new Error('Unsupported frozen Honor benefit program');
  const score = row.score ?? 0;
  return { tacticalCredit, benefits: { version: HONOR_BENEFIT_PROGRAM_VERSION, score, thresholds: HONOR_BENEFIT_THRESHOLDS_V1,
    ...honorBenefits(score, HONOR_BENEFIT_THRESHOLDS_V1) } };
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
    if (config.benefitsVersion !== null && config.benefitsVersion !== HONOR_BENEFIT_PROGRAM_VERSION) {
      throw new Error('Honor benefit configuration is immutable');
    }
    if (apply && config.benefitsVersion === null) {
      await tx.update(honorSeasons).set({ benefitsVersion: HONOR_BENEFIT_PROGRAM_VERSION }).where(eq(honorSeasons.seasonId, seasonId));
      await publishShard(tx, seasonId, 'season');
    }
    return { seasonId, applied: apply, version: HONOR_BENEFIT_PROGRAM_VERSION, thresholds: HONOR_BENEFIT_THRESHOLDS_V1 };
  });
}
