import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '../api/context.js';
import { keys } from '../api/queries.js';

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
      for (const key of [keys.planet, keys.galaxy, keys.intel, keys.notifications, keys.pending]) {
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
        try {
          await api.stream(refresh, controller.signal);
          attempt = 0;
        } catch {
          attempt += 1;
        }
        await pause(backoffMs(attempt));
      }
    })();

    return () => {
      controller.abort();
    };
  }, [api, client, enabled]);
}
