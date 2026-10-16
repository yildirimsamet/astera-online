import { coreTier, pvpBalanceForTier } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { peakCoreLevels } from './player.js';

/** The controller's whole holding matters, never the struck world's local Core. */
export async function commanderPvpBalance(db: Queryable, playerId: string) {
  const peaks = await peakCoreLevels(db, [playerId]);
  return pvpBalanceForTier(coreTier(peaks.get(playerId) ?? 1));
}
