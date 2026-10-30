/**
 * WHEN A CLIENT ASKS AGAIN AFTER SOMETHING LANDS. `useArrivals` arms these; the capacity
 * runner (scaling plan F0.1) follows arrivals on the same clock so it loads the server
 * as the game does.
 */

/**
 * How long after an instant the first ask goes out.
 *
 * Enough to lose the race against the worker's own commit and no more. It used to
 * absorb clock skew as well; `serverNow` does that properly now, so this is only
 * the commit.
 */
export const SETTLE_MARGIN_MS = 400;

/** How often the chase asks again while the world has not caught up yet. */
export const CHASE_MS = 900;

/** And how many times. `WORKER_POLL_MS` is a second; this is generous cover for it. */
export const MAX_CHASES = 12;
