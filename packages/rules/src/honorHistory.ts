import { HONOR_HISTORY_HOURS, honorInteger } from './honor.js';

export interface HonorObservation {
  /** Effective milliseconds supplied by the server's injected clock. */
  at: number;
  /** Durable journal ordering resolves equal effective instants. */
  order?: number;
  navy: number;
  /** Current maximum across owned worlds at this observation; historical peak is derived. */
  coreTier: number;
  /** Armed value destroyed in battle between the previous observation and this one. */
  combatLoss?: number;
}

/**
 * Complete state-change history for this commander/season, including the last
 * observation at/before the window boundary. Merely MAX(last-24h rows) would
 * make an unchanged old fleet disappear, or forget its value just after defeat.
 * Persistence may compact history only if it retains that boundary state and
 * the season Core peak. This function cannot invent a missing initial state.
 *
 * Owner 2026-11-12: ships destroyed in battle leave the peak at once, so a fresh
 * defeat no longer makes a commander look as strong as before it. Ships that left
 * any other way stay for the whole day, which is what the peak is for.
 */
export function honorReferenceAt(history: readonly HonorObservation[], at: number): { navy: number; tier: number } {
  honorInteger(at);
  const rows = [...history].sort((a, b) => a.at - b.at || (a.order ?? 0) - (b.order ?? 0));
  let previous: HonorObservation | undefined;
  for (const row of rows) {
    honorInteger(row.at); honorInteger(row.order ?? 0); honorInteger(row.navy); honorInteger(row.combatLoss ?? 0);
    if (honorInteger(row.coreTier) < 1n) throw new RangeError('Invalid historical Core tier');
    if (previous?.at === row.at && (previous.order ?? 0) === (row.order ?? 0)
      && (previous.navy !== row.navy || previous.coreTier !== row.coreTier)) {
      throw new Error('Ambiguous Honor observation order');
    }
    previous = row;
  }
  const since = at - HONOR_HISTORY_HOURS * 3_600_000;
  const known = rows.filter(row => row.at <= at);
  let navy = 0, tier = 0, destroyedSince = 0;
  // Newest first: a row is worth its navy less everything destroyed after it. Older
  // than the row held from before the window, nothing can count any more.
  for (const row of known.reverse()) {
    tier = Math.max(tier, row.coreTier);
    if (destroyedSince >= 0) navy = Math.max(navy, row.navy - destroyedSince);
    destroyedSince = row.at <= since ? -1 : destroyedSince + (row.combatLoss ?? 0);
  }
  if (tier === 0) throw new Error('Missing Honor reference history');
  return { navy, tier };
}
