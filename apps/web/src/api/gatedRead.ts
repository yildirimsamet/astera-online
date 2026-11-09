import { hashKey, type QueryCache, type QueryKey } from '@tanstack/react-query';

/**
 * A READ THAT CANNOT BE ASKED FOR FASTER THAN ITS GAP. 2026-09-19.
 *
 * For the payloads that are the whole galaxy — `/api/galaxy` (~475 KB in a full
 * thousand-seat galaxy) and the ladder (~194 KB). The owner's second phone
 * recording had fifteen of his flights landing and four separate paths invalidating
 * the galaxy, with TanStack cancelling and restarting the read in flight: up to
 * seven downloads in one second, 33 MB in four minutes, and the stalls to match.
 *
 *   · A read already in the air is SHARED, not restarted — a cancelled query's
 *     next attempt joins the same request.
 *   · A read asked for within `gapMs` of the last one WAITS for the gap to pass and
 *     then happens once, for everybody who asked in between. Nothing is dropped:
 *     the change arrives, at most `gapMs` late.
 *   · A failed read does not hold the gate: the next ask tries again at once.
 *   · Nor does a read whose result left the cache (`forget`).
 */
export type GatedRead<T> = (() => Promise<T>) & {
  /** The last read's result left the cache: the next ask reads at once, sharing nothing older. */
  forget: () => void;
};

export function gatedRead<T>(fetch: () => Promise<T>, gapMs: number): GatedRead<T> {
  let inFlight: Promise<T> | null = null;
  let lastStart = Number.NEGATIVE_INFINITY;
  /** Bumped by `forget`: an older read still settling no longer touches the gate. */
  let era = 0;

  const start = (mine: number): Promise<T> => {
    if (mine === era) lastStart = Date.now();
    const request = fetch().then(
      (value) => {
        if (mine === era) inFlight = null;
        return value;
      },
      (error: unknown) => {
        if (mine === era) {
          inFlight = null;
          lastStart = Number.NEGATIVE_INFINITY;
        }
        throw error;
      },
    );
    return request;
  };

  const read = () => {
    if (inFlight) return inFlight;
    const mine = era;
    const wait = lastStart + gapMs - Date.now();
    inFlight = wait <= 0
      ? start(mine)
      : new Promise<void>((resolve) => { setTimeout(resolve, wait); }).then(() => start(mine));
    return inFlight;
  };
  return Object.assign(read, {
    forget: () => {
      era += 1;
      inFlight = null;
      lastStart = Number.NEGATIVE_INFINITY;
    },
  });
}

/** Forgets `read` whenever the query holding its result is dropped from `cache` (a clear included). */
export function forgetWithQuery(cache: QueryCache, key: QueryKey, read: Pick<GatedRead<unknown>, 'forget'>): () => void {
  const hash = hashKey(key);
  return cache.subscribe((event) => {
    if (event.type === 'removed' && event.query.queryHash === hash) read.forget();
  });
}
