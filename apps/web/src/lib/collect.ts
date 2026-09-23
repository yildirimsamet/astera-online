interface Triple { alloy: number; crystal: number; deuterium: number }

/** The bubble rises once the works hold this share of what they can. Spec B13. */
export const COLLECT_THRESHOLD = 0.1;
/** A vessel this close to its rim has stopped filling. */
const FULL_AT = 0.995;

export interface CollectInput {
  /** What each vessel in the works can hold (`bufferAlloyCap`…). */
  caps: Triple;
  /** What is in the works now — projected, not the last fetch. */
  works: Triple;
  /** What is in storage. */
  store: Triple;
  storeCaps: Triple;
}

export interface CollectState {
  /** Everything waiting in the works. */
  waiting: number;
  /** Enough is waiting to be worth a tap. */
  ripe: boolean;
  /** A vessel is full: that resource has stopped being produced. */
  full: boolean;
  /** What storage can actually take. */
  movable: number;
  /** Something is waiting and storage can take none of it. */
  blocked: boolean;
}

const KEYS = ['alloy', 'crystal', 'deuterium'] as const;

/**
 * THE WORKS, READ FOR THE ONE DECISION THEY ASK FOR: COLLECT NOW OR NOT.
 *
 * Moved out of `StatusBar`'s `Works` so the v2 bubble (B13) and the Base badge
 * read the same answer. Collecting into a full store moves nothing and holds the
 * rest back, so `blocked` is said before the tap rather than after it.
 */
export function collectState({ caps, works, store, storeCaps }: CollectInput): CollectState {
  const waiting = KEYS.reduce((sum, key) => sum + works[key], 0);
  const capacity = KEYS.reduce((sum, key) => sum + caps[key], 0);
  const full = KEYS.some((key) => caps[key] > 0 && works[key] >= caps[key] * FULL_AT);
  const movable = KEYS.reduce(
    (sum, key) => sum + Math.min(works[key], Math.max(0, storeCaps[key] - store[key])),
    0,
  );
  return {
    waiting,
    ripe: capacity > 0 && waiting >= capacity * COLLECT_THRESHOLD,
    full,
    movable,
    blocked: waiting >= 1 && movable < 1,
  };
}
