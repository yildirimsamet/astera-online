import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { keys } from '../api/queries.js';
import { serverNow } from '../lib/clock.js';

/**
 * REFETCH AT THE MOMENT SOMETHING LANDS, RATHER THAN SOON AFTER.
 *
 * Every craft on the disc is drawn by interpolating between two timestamps, and
 * `interpolatePosition` clamps at the end of the flight. That is exactly right
 * while a craft is flying and exactly wrong the instant it arrives: the craft does
 * not disappear, does not turn for home, and does not shrink to the survivors — it
 * SITS on its target, motionless, until the list it came from is fetched again.
 *
 * Before this, "again" meant one of three things: an event stream message, a
 * window focus, or a poll — and the polls are twenty seconds for your own fleets,
 * sixty for everybody else's and ninety for mining. So a drill really could hang
 * over a rock for a minute and a half with its work finished, and the honest
 * conclusion a player draws from that is that the game is stuck.
 *
 * THE CLIENT ALREADY KNOWS WHEN. Every one of those payloads carries the arrival
 * instant, because the whole rendering model is built on it. So there is nothing
 * to poll for: set one timer for the soonest arrival, refetch when it fires, and
 * the world updates on the frame the craft lands.
 *
 * ONE TIMER, NOT ONE PER CRAFT. A busy galaxy has dozens of contacts in the air;
 * arming a timeout for each would be dozens of timers rewritten on every refetch.
 * The soonest is enough — refetching re-runs this hook with the next one.
 *
 * It never decides anything. The server remains the only authority on what
 * actually happened; this only decides WHEN to go and ask.
 */
/**
 * How long after an instant the first ask goes out.
 *
 * Enough to lose the race against the worker's own commit and no more. It used to
 * absorb clock skew as well; `serverNow` does that properly now, so this is only
 * the commit.
 */
const SETTLE_MARGIN_MS = 400;

/** How often the chase asks again while the world has not caught up yet. */
const CHASE_MS = 900;

/** And how many times. `WORKER_POLL_MS` is a second; this is generous cover for it. */
const MAX_CHASES = 12;

export function useArrivals(instants: readonly (Date | null | undefined)[]): void {
  const client = useQueryClient();

  /**
   * Every instant still ahead of us, in order, keyed by value.
   *
   * Depending on the ARRAY would re-arm on every render, because the caller builds
   * it fresh each time; depending on a joined key of its values re-arms only when
   * the arrivals themselves change, in any order.
   */
  const key = instants
    .filter((d): d is Date => d instanceof Date && Number.isFinite(d.getTime()))
    .map((d) => d.getTime())
    .filter((t) => t > serverNow())
    .sort((a, b) => a - b)
    .join(',');

  const upcoming = useMemo(
    () => (key === '' ? [] : key.split(',').map(Number)),
    [key],
  );

  useEffect(() => {
    if (upcoming.length === 0) return;
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    /**
     * ONE TIMER AT A TIME, CHAINED — not one per craft, and not one and then hope.
     *
     * A busy galaxy has dozens of contacts in the air; arming a timeout for each
     * would be dozens of timers rewritten on every refetch. Arming only the
     * soonest and relying on the refetch to bring the next one round is what this
     * used to do, and it has a hole in it: a refetch that reads back exactly what
     * it already had returns the same object (React Query's structural sharing),
     * so nothing re-renders and nothing re-arms.
     *
     * That is the NORMAL case for a raid. The refetch a second after `arriveAt`
     * finds the mission still in flight — because it is, the engagement is a real
     * ten-second window and nothing has been decided — so the payload is
     * unchanged, and the settlement instant behind it was never armed at all. The
     * attacker sat on a stale world until a poll or a focus event rescued them.
     *
     * Chaining through the list inside the effect needs no re-render to continue.
     */
    const refresh = (): void => {
      for (const queryKey of [
        keys.pending,
        keys.mining,
        keys.traffic,
        keys.planet,
        keys.galaxy,
        /**
         * AND THE TWO THAT SAY WHAT HAPPENED.
         *
         * A raid of your own resolving writes a battle report and a notification,
         * and neither list was in here — so an attacker watching their own
         * bombardment land got a refreshed planet and a refreshed map, and no
         * outcome at all. Both are cheap, and both are exactly what the player is
         * waiting for at this instant.
         */
        keys.reports,
        keys.notifications,
      ]) {
        void client.invalidateQueries({ queryKey });
      }
    };

    /**
     * AND THEN KEEP ASKING UNTIL THE WORLD HAS ACTUALLY MOVED ON. D52.
     *
     * The one-shot fired once and gave up, and the case it gave up on is the common
     * one: the resolving event is scheduled for the same instant, the worker picks
     * it up on its next tick, and a refetch that lands first reads back a mission
     * that is still `in_flight`. React Query's structural sharing then returns the
     * SAME object, nothing re-renders, this effect does not re-run — and the
     * squadron hangs over a world it has finished bombarding until an unrelated
     * poll or a stream event happens along. That is the "boş boş bekleme".
     *
     * So the last instant chases: ask again a beat later, and again, until the
     * payload changes — which unmounts this timer by re-running the effect. The
     * chase is short and it is bounded; it exists to cover a worker tick and a
     * commit, not to become a poll.
     */
    let chases = 0;

    const arm = (): void => {
      const at = upcoming[index++];
      if (at === undefined) {
        if (chases++ >= MAX_CHASES) return;
        timer = setTimeout(() => {
          refresh();
          arm();
        }, CHASE_MS);
        return;
      }
      /**
       * A beat past the arrival, not exactly on it.
       *
       * The event that resolves a flight is scheduled for the same instant on the
       * server, and a refetch that wins the race reads the world one moment before
       * it changes — which is the stale render this hook exists to prevent,
       * arrived at by a different route.
       */
      timer = setTimeout(
        () => {
          refresh();
          arm();
        },
        Math.max(0, at - serverNow()) + SETTLE_MARGIN_MS,
      );
    };

    arm();
    return () => {
      clearTimeout(timer);
    };
  }, [upcoming, client]);
}
