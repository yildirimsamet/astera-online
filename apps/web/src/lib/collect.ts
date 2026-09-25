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
  /**
   * WHAT EACH VESSEL HOLDS (owner, 2026-09-24). A faulty refinery stops one resource and
   * a nearly full store leaves one behind after a collect; one total says neither.
   */
  each: Triple;
  /** The resources waiting that the store has no room left for, in store order. */
  noRoom: WorksResource[];
  /** The resources whose vessel is full, so their production has stopped, in store order. */
  stopped: WorksResource[];
}

const KEYS = ['alloy', 'crystal', 'deuterium'] as const;
export type WorksResource = (typeof KEYS)[number];
export const WORKS_RESOURCES: readonly WorksResource[] = KEYS;

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
  const stopped = KEYS.filter((key) => caps[key] > 0 && works[key] >= caps[key] * FULL_AT);
  const movable = KEYS.reduce(
    (sum, key) => sum + Math.min(works[key], Math.max(0, storeCaps[key] - store[key])),
    0,
  );
  return {
    waiting,
    ripe: capacity > 0 && waiting >= capacity * COLLECT_THRESHOLD,
    full: stopped.length > 0,
    movable,
    blocked: waiting >= 1 && movable < 1,
    each: { alloy: works.alloy, crystal: works.crystal, deuterium: works.deuterium },
    noRoom: KEYS.filter((key) => works[key] >= 1 && storeCaps[key] - store[key] < 1),
    stopped,
  };
}

/**
 * THE POOL, READ FOR THE REASON TO COME BACK (owner, 2026-09-24). Each vessel's share of
 * what it can hold, and when the first vessel still filling reaches its rim — the moment
 * that resource stops being produced. Null when nothing is flowing into a vessel with room.
 */
export function worksOutlook({ caps, works, rates }: { caps: Triple; works: Triple; rates: Triple }): {
  fill: Triple;
  fullInMinutes: number | null;
} {
  const fill = { alloy: 0, crystal: 0, deuterium: 0 };
  let soonest: number | null = null;
  for (const key of KEYS) {
    if (caps[key] <= 0) continue;
    fill[key] = Math.min(1, Math.max(0, works[key]) / caps[key]);
    if (rates[key] <= 0 || works[key] >= caps[key] * FULL_AT) continue;
    const minutes = ((caps[key] - works[key]) / rates[key]) * 60;
    soonest = soonest === null ? minutes : Math.min(soonest, minutes);
  }
  return { fill, fullInMinutes: soonest };
}
