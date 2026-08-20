import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '../api/context.js';
import { keys } from '../api/queries.js';

/** How long a connection must last before it counts as one that worked. */
const HEALTHY_MS = 5000;

/** Full jitter, capped. A shard restarting must not be hit by 200 synchronised retries. */
const backoffMs = (attempt: number): number =>
  Math.random() * Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));

/**
 * The only realtime surface in the game.
 *
 * It carries no state — just "something happened to you". Everything else is
 * refetched, which keeps the server authoritative and the payload a few hundred
 * bytes an hour. Fleet motion is derived from timestamps, never streamed.
 */
export function useEventStream(enabled: boolean): void {
  const api = useApi();
  const client = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    const refresh = (): void => {
      /**
       * EVERY read that a resolved event can change — and `traffic` and `mining`
       * were missing from it.
       *
       * A craft is drawn from whichever of these carries it: your own fleets from
       * `pending`, your mining and harvest runs from `mining`, and everybody
       * else's from `traffic`. `interpolatePosition` clamps at the end of a
       * flight, so a craft whose list has not been refetched does not vanish or
       * turn round — it SITS on its target, motionless, until something else
       * happens to refresh it. `mining` polls at ninety seconds, so a drill could
       * hang over a rock for a minute and a half after its work was done.
       *
       * An omission here does not fail loudly. It renders a stopped world.
       */
      for (const key of [
        keys.planet,
        keys.galaxy,
        keys.intel,
        keys.notifications,
        keys.pending,
        keys.reports,
        keys.traffic,
        keys.mining,
      ]) {
        void client.invalidateQueries({ queryKey: key });
      }
    };

    /** Resolves early on abort, so a 30-second backoff cannot outlive the tab. */
    const pause = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        controller.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });

    void (async () => {
      let attempt = 0;
      while (!controller.signal.aborted) {
        const openedAt = Date.now();
        try {
          await api.stream(refresh, controller.signal);
        } catch {
          // Fall through: a connection that threw and one that closed instantly
          // are the same problem, and both are counted below.
        }
        /**
         * A CLEAN CLOSE IS NOT PROOF THE CONNECTION WORKED.
         *
         * `attempt` was reset whenever `stream()` returned normally, which is what
         * a proxy closing the socket the moment it is opened also looks like. The
         * backoff then never grew and the client hammered the server roughly twice
         * a second, per tab, forever. Only a connection that actually held for a
         * while has earned a reset.
         */
        attempt = Date.now() - openedAt > HEALTHY_MS ? 0 : attempt + 1;
        await pause(backoffMs(attempt));
      }
    })();

    return () => {
      controller.abort();
    };
  }, [api, client, enabled]);
}
