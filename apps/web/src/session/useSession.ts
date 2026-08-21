import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '../api/context.js';
import { ApiError } from '../api/client.js';
import { describeError } from '../i18n/errors.js';
import { keys } from '../api/keys.js';
import type { ClaimIntent, ClaimResult, Me, Preview } from '../api/schemas.js';
import { track } from '../lib/analytics.js';
import { rememberCommander } from '../lib/returning.js';

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
  | { phase: 'landing'; error?: string; open?: 'login' | 'register' }
  /**
   * Playing the real game, on a world that does not exist yet. D56.
   *
   * Between `landing` and `ready`, and it is the only phase a visitor can be in
   * without an account. Nothing has been written on the server — the preview took
   * no seat — so leaving it costs the galaxy nothing.
   */
  | { phase: 'rehearsing'; preview: Preview }
  /** Signed in, no planet. Choose a galaxy. */
  | { phase: 'servers'; me: Me; error?: string }
  /** Signed in, placed, and standing on their planet. */
  | { phase: 'ready'; me: Me; standing: Standing }
  /** Something is wrong that the player cannot fix by pressing again. */
  | { phase: 'blocked'; message: string };

/**
 * The same catalogue every other refusal goes through — a failed sign-in is a
 * refusal like any other, and it lands on the one screen a player who has not
 * chosen a language yet is looking at.
 */
const messageOf = (err: unknown): string => describeError(err);

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
      /**
       * THE DEVICE NOW KNOWS SOMEBODY HAS A COMMANDER HERE. Owner-reported bug.
       *
       * Marked on every route into a real session — a cold-start restore as much
       * as a fresh sign-in — because what the front door needs to know is not "did
       * you just log in", it is "is this a stranger". Without it a player who
       * signs out is offered the rehearsal as the loud control, creates a second
       * account because the dialog asks them to name one, and lands on a second
       * planet in a different galaxy. See `lib/returning.ts`.
       */
      rememberCommander();
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
        /**
         * THE FUNNEL, AND IT IS TWO EVENTS BECAUSE THERE ARE TWO WAYS IN.
         *
         * GA4's own names, not invented ones: `sign_up` and `login` are reported
         * in the console's built-in funnel views, and anything else has to be
         * assembled into a custom report by hand. `method` distinguishes this
         * door from the rehearsal's — a stranger who plays first and claims after
         * (D56) is the single number this project most needs to be able to read,
         * and it cannot be read if both routes report the same event with no
         * qualifier.
         *
         * No username, no id, nothing about the person. See `analytics.ts`.
         */
        track(mode === 'register' ? 'sign_up' : 'login', { method: 'form' });
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

  /**
   * Start the rehearsal: read the frontier galaxy, and play it. D56.
   *
   * ONE PUBLIC REQUEST AND NO ACCOUNT. If every galaxy is full there is nothing to
   * rehearse and the front door says so, rather than opening ninety seconds of a
   * world that cannot be claimed at the end.
   */
  const rehearse = useCallback(async (): Promise<void> => {
    /**
     * THE FRONT DOOR STAYS ON SCREEN WHILE THIS LANDS.
     *
     * It used to drop to the loading frame, and that is a spinner where a decision
     * should be (Principle 10): the visitor pressed one button and the thing they
     * were looking at was replaced by a caption saying "making contact". The page
     * they pressed is a live 3D scene — leaving it up and letting the control say
     * it is working is both calmer and honest, and the disc behind it is already
     * loading its models by then.
     */
    try {
      setSession({ phase: 'rehearsing', preview: await api.preview() });
    } catch (err) {
      setSession({ phase: 'landing', error: messageOf(err) });
      throw err;
    }
  }, [api]);

  /** Out of the rehearsal without an account. Nothing to undo. */
  const leaveRehearsal = useCallback((): void => {
    setSession({ phase: 'landing' });
  }, []);

  /** Out of the rehearsal, to sign in as somebody who already exists. */
  const signInInstead = useCallback((): void => {
    setSession({ phase: 'landing', open: 'login' });
  }, []);

  /**
   * The claim landed. An account, a seat, and the opening — all real.
   *
   * THE PLANET IS SEEDED RATHER THAN REFETCHED. The claim answered with the whole
   * planet view, built in the transaction that made it (D53), so writing it into
   * the cache is what stops the first frame of a player's first session being a
   * loading state for a payload they are already holding.
   */
  const settleClaim = useCallback(
    (result: ClaimResult): void => {
      queries.clear();
      queries.setQueryData(keys.planet, result.planet);
      setSession({
        phase: 'ready',
        me: {
          accountId: result.accountId,
          username: result.username,
          displayName: result.displayName,
          placement: {
            shard: result.placement.shard,
            shardName: result.placement.shardName,
            planetName: result.placement.planetName,
          },
        },
        standing: {
          shard: result.placement.shard,
          shardName: result.placement.shardName,
          planetName: result.placement.planetName,
        },
      });
    },
    [queries],
  );

  /**
   * Turn the rehearsal into a season.
   *
   * IT GOES THROUGH THE APP'S OWN `Api`, and that is the whole reason this lives
   * here rather than inside the rehearsal. The rehearsal's client is one whose
   * `fetch` never leaves the device — it would have answered this call with
   * `REHEARSAL_ONLY` — and even if it had reached the server, the access token
   * would have landed on an instance the game is about to throw away, leaving the
   * first frame of a player's first session to 401 and refresh its way in.
   */
  const claim = useCallback(
    async (
      username: string,
      password: string,
      intents: readonly ClaimIntent[],
    ): Promise<void> => {
      const result = await api.claim(username, password, intents);
      rememberCommander();
      // The other door. A commander who played the rehearsal first and is only now
      // becoming an account — the conversion this whole onboarding exists for.
      track('sign_up', { method: 'rehearsal' });
      settleClaim(result);
    },
    [api, settleClaim],
  );


  /**
   * SIGNING OUT PUTS THE WAY BACK IN FRONT OF THEM, NOT THE REHEARSAL.
   *
   * It used to land on a bare `landing`, whose loud control starts ninety seconds
   * of onboarding and ends in a dialog asking for a NEW commander name. That is
   * the whole of the owner-reported bug: a player signed out, was handed the
   * new-visitor door, typed a new name because that is what the dialog asks for,
   * and received a second account with a second planet in a different galaxy.
   *
   * The form opens directly. Somebody who signed out to switch commanders is
   * exactly where they need to be, and somebody who signed out to leave closes one
   * dialog. `lib/returning.ts` handles the other route to the same screen — a cold
   * start days later — where a modal on arrival would be wrong.
   */
  const signOut = useCallback(async (): Promise<void> => {
    setSession({ phase: 'starting' });
    await api.logout();
    queries.clear();
    setSession({ phase: 'landing', open: 'login' });
  }, [api, queries]);

  /** For the blocked screen: try the whole cold start again. */
  const retry = useCallback((): void => {
    setSession({ phase: 'starting' });
    void coldStart();
  }, [coldStart]);

  return {
    session,
    authenticate,
    chooseServer,
    signOut,
    retry,
    rehearse,
    leaveRehearsal,
    signInInstead,
    claim,
  };
}
