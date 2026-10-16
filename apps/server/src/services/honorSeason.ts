import { and, eq, inArray } from 'drizzle-orm';
import { isHonorCandidate, isSupportedHonorVersion, honorRankRewards, type HonorRankReward } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { flushBeforeCommit } from '../db/finalizers.js';
import { honorSeasons, honorTotals, seasons } from '../db/schema.js';

/** Closing owns the exclusive season lock, so queued battles can flush before rank/rewards freeze. */
export async function sealHonor(tx: Tx, input: {
  seasonId: string; at: Date; humanPlayerIds: readonly string[];
}): Promise<HonorRankReward[] | null> {
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId)).for('update');
  if (!season) throw new Error('Missing Honor season');
  await flushBeforeCommit(tx);
  const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, input.seasonId)).for('update');
  if (!config) return null;
  if (!isSupportedHonorVersion(config.version)) throw new Error('Unsupported frozen Honor version');
  if (isHonorCandidate(config.version) && config.mode !== 'SHADOW') throw new Error('Candidate Honor requires shadow mode');
  if (!Number.isSafeInteger(input.at.getTime()) || input.at < config.createdAt || input.at > season.endsAt
    || (config.mode === 'ACTIVE' && (!config.rankedAt || input.at < config.rankedAt))) {
    throw new Error('Invalid Honor season boundary');
  }
  if (config.closedAt !== null && config.closedAt.getTime() !== input.at.getTime()) throw new Error('Honor boundary is immutable');
  await tx.update(honorSeasons).set({ closedAt: input.at }).where(eq(honorSeasons.seasonId, input.seasonId));
  if (config.mode !== 'ACTIVE') return null;
  const ids = [...new Set(input.humanPlayerIds)];
  const totals = ids.length === 0 ? [] : await tx.select().from(honorTotals)
    .where(and(eq(honorTotals.seasonId, input.seasonId), inArray(honorTotals.playerId, ids)));
  const scores = new Map(totals.map(row => [row.playerId, row.score]));
  return honorRankRewards(ids.map(actor => ({ actor, honor: scores.get(actor) ?? 0 })));
}
