import { HONOR_HISTORY_HOURS, honorInteger } from './honor.js';

export interface HonorObservation {
  /** Effective milliseconds supplied by the server's injected clock. */
  at: number;
  /** Durable journal ordering resolves equal effective instants. */
  order?: number;
  navy: number;
  /** Current maximum across owned worlds at this observation; historical peak is derived. */
  coreTier: number;
}

/**
 * Complete state-change history for this commander/season, including the last
 * observation at/before the window boundary. Merely MAX(last-24h rows) would
 * make an unchanged old fleet disappear, or forget its value just after defeat.
 * Persistence may compact history only if it retains that boundary state and
 * the season Core peak. This function cannot invent a missing initial state.
 */
export function honorReferenceAt(history: readonly HonorObservation[], at: number): { navy: number; tier: number } {
  honorInteger(at);
  const rows = [...history].sort((a, b) => a.at - b.at || (a.order ?? 0) - (b.order ?? 0));
  let previous: HonorObservation | undefined;
  for (const row of rows) {
    honorInteger(row.at); honorInteger(row.order ?? 0); honorInteger(row.navy);
    if (honorInteger(row.coreTier) < 1n) throw new RangeError('Invalid historical Core tier');
    if (previous?.at === row.at && (previous.order ?? 0) === (row.order ?? 0)
      && (previous.navy !== row.navy || previous.coreTier !== row.coreTier)) {
      throw new Error('Ambiguous Honor observation order');
    }
    previous = row;
  }
  const since = at - HONOR_HISTORY_HOURS * 3_600_000;
  let anchor: HonorObservation | undefined;
  let navy = 0, tier = 0;
  for (const row of rows) {
    if (row.at > at) break;
    tier = Math.max(tier, row.coreTier);
    if (row.at <= since) anchor = row;
    else navy = Math.max(navy, row.navy);
  }
  if (tier === 0) throw new Error('Missing Honor reference history');
  return { navy: Math.max(navy, anchor?.navy ?? 0), tier };
}
