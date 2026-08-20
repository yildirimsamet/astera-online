import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '../api/context.js';
import { ApiError } from '../api/client.js';
import type { Me } from '../api/schemas.js';

/** Where the player is standing, as one word. */
export type Phase = Session['phase'];

export interface Standing {
  shard: string;
  shardName: string;
  planetName: string;
}

export type Session =
  /** Asking the cookie whether there is a session to come back to. */
  | { phase: 'starting' }
  /** No session. The front door: the premise, and a way in. */
  | { phase: 'landing'; error?: string }
  /** Signed in, no planet. Choose a galaxy. */
  | { phase: 'servers'; me: Me; error?: string }
  /** Signed in, placed, and standing on their planet. */
  | { phase: 'ready'; me: Me; standing: Standing }
  /** Something is wrong that the player cannot fix by pressing again. */
  | { phase: 'blocked'; message: string };

const messageOf = (err: unknown): string =>
  err instanceof Error ? err.message : 'Could not reach the server';

/**
 * THE THREE SCREENS THIS GAME HAS, AND HOW YOU GET BETWEEN THEM. D21.
 *
 *   landing  →  servers  →  ready
 *      ↑___________|__________|      (sign out)
 *
 * One state machine rather than a router. The transitions are decided by two facts
 * — is there a session, and does it own a planet — and both come from the server on
 * a single `/api/auth/me`. A URL-driven router would let the browser assert a
 * fourth answer (whatever is in the address bar) and then need reconciling with the
 * other two.
 *
 * NOTHING IS FETCHED ON THE WAY IN BEYOND IDENTITY. D23.
 *
 * `/api/session/return` used to be read here, once, to feed the "while you were
 * gone" overlay. That overlay is gone — a phone that evicts a backgrounded tab
 * remounts this hook, so it fired on nearly every return to the app rather than on
 * a real absence — and with it went a blocking round trip on the one path a player
 * is impatient about. The news it carried is in Signals, which is read when the
 * player asks rather than before they are let in.
 */
export function useSession() {
  const api = useApi();
  const queries = useQueryClient();
  const [session, setSession] = useState<Session>({ phase: 'starting' });
  // StrictMode mounts effects twice in development. One restore, not two.
  const started = useRef(false);

  /**
   * Route a signed-in commander by whether they already hold a planet.
   *
   * Everything cached from a previous identity is dropped first. Without that, a
   * second commander signing in on the same tab reads the first one's planet,
   * fleet and intel out of the query cache before the network answers — which is
   * the single worst bug this screen could have.
   */
  const settle = useCallback(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (me: Me): Promise<void> => {
      queries.clear();
      if (!me.placement) {
        setSession({ phase: 'servers', me });
        return;
      }
      setSession({
        phase: 'ready',
        me,
        standing: {
          shard: me.placement.shard,
          shardName: me.placement.shardName,
          planetName: me.placement.planetName,
        },
      });
    },
    [api, queries],
  );

  /** Cookie → session → screen. The whole of what happens when a tab opens cold. */
  const coldStart = useCallback(async (): Promise<void> => {
    try {
      if (!(await api.restore())) {
        setSession({ phase: 'landing' });
        return;
      }
      await settle(await api.me());
    } catch (err) {
      // A cold start that cannot reach the API is not a signed-out player, and
      // showing them the login form would teach them their account was lost.
      if (err instanceof ApiError && err.code === 'UNREACHABLE') {
        setSession({ phase: 'blocked', message: err.message });
        return;
      }
      setSession({ phase: 'landing', error: messageOf(err) });
    }
  }, [api, settle]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void coldStart();
  }, [coldStart]);

  const authenticate = useCallback(
    async (mode: 'login' | 'register', username: string, password: string): Promise<void> => {
      setSession({ phase: 'starting' });
      try {
        if (mode === 'register') await api.register(username, password);
        else await api.login(username, password);
        await settle(await api.me());
      } catch (err) {
        setSession({ phase: 'landing', error: messageOf(err) });
        // Rethrown so the form can keep what was typed and put focus back in the
        // right field. The phase above is what the rest of the app reads.
        throw err;
      }
    },
    [api, settle],
  );

  /**
   * Take a planet in the chosen galaxy.
   *
   * A refusal — the galaxy filled up while the list was on screen, or this account
   * is already placed elsewhere — comes back to the SERVER LIST with the reason,
   * not to the landing page. The player is still signed in and the next thing they
   * need is the list, refreshed.
   */
  const chooseServer = useCallback(
    async (code: string): Promise<void> => {
      const current = session;
      if (current.phase !== 'servers') return;
      setSession({ phase: 'starting' });
      try {
        await api.joinServer(code);
        await settle(await api.me());
      } catch (err) {
        setSession({ phase: 'servers', me: current.me, error: messageOf(err) });
      }
    },
    [api, session, settle],
  );

  const signOut = useCallback(async (): Promise<void> => {
    setSession({ phase: 'starting' });
    await api.logout();
    queries.clear();
    setSession({ phase: 'landing' });
  }, [api, queries]);

  /** For the blocked screen: try the whole cold start again. */
  const retry = useCallback((): void => {
    setSession({ phase: 'starting' });
    void coldStart();
  }, [coldStart]);

  return { session, authenticate, chooseServer, signOut, retry };
}
