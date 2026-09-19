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
 */
export function gatedRead<T>(fetch: () => Promise<T>, gapMs: number): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  let lastStart = Number.NEGATIVE_INFINITY;

  const start = (): Promise<T> => {
    lastStart = Date.now();
    const request = fetch().then(
      (value) => {
        inFlight = null;
        return value;
      },
      (error: unknown) => {
        inFlight = null;
        lastStart = Number.NEGATIVE_INFINITY;
        throw error;
      },
    );
    return request;
  };

  return () => {
    if (inFlight) return inFlight;
    const wait = lastStart + gapMs - Date.now();
    inFlight = wait <= 0
      ? start()
      : new Promise<void>((resolve) => { setTimeout(resolve, wait); }).then(start);
    return inFlight;
  };
}
