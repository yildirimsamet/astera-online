import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '../api/context.js';
import { ApiError } from '../api/client.js';
import type { Placement, ReturnPayload } from '../api/schemas.js';

export type Boot =
  | { phase: 'starting' }
  | { phase: 'entry'; error?: string }
  | { phase: 'blocked'; message: string }
  | { phase: 'ready'; placement: Placement; arrival: ReturnPayload };

/**
 * Getting from a cold tab to standing on your planet.
 *
 * `/api/session/return` is fetched exactly once, here, and never as a query:
 * reading it advances `lastSeenAt` server-side, so a refetch on window focus
 * would silently consume the news the player came back for.
 */
export function useBootstrap() {
  const api = useApi();
  const [boot, setBoot] = useState<Boot>({ phase: 'starting' });
  // StrictMode mounts effects twice in development; minting two guest accounts
  // for one visitor is not something to discover in production.
  const started = useRef(false);

  const enter = useCallback(async () => {
    try {
      const placement = await api.join();
      const arrival = await api.returnPayload();
      setBoot({ phase: 'ready', placement, arrival });
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'NO_SEASON' || err.code === 'SHARD_FULL')) {
        setBoot({ phase: 'blocked', message: err.message });
        return;
      }
      setBoot({ phase: 'entry', error: err instanceof Error ? err.message : 'Could not connect' });
    }
  }, [api]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      if (await api.restore()) {
        await enter();
      } else {
        setBoot({ phase: 'entry' });
      }
    })();
  }, [api, enter]);

  /** One tap, no form. The account is created at the moment it is wanted. */
  const takeAPlanet = useCallback(async () => {
    setBoot({ phase: 'starting' });
    try {
      await api.signInAsGuest();
    } catch (err) {
      setBoot({ phase: 'entry', error: err instanceof Error ? err.message : 'Could not connect' });
      return;
    }
    await enter();
  }, [api, enter]);

  const retry = useCallback(() => {
    setBoot({ phase: 'starting' });
    void enter();
  }, [enter]);

  return { boot, takeAPlanet, retry };
}
