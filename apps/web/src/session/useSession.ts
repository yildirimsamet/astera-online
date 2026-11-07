import type { CommunityPolicyConsent } from '../api/communityPolicySchemas.js';
import { refreshQueries } from '../api/refreshQueries.js';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '../api/context.js';
import { ApiError, type Api } from '../api/client.js';
import { describeError } from '../i18n/errors.js';
import { keys } from '../api/keys.js';
import { meSchema, type ClaimIntent, type ClaimResult, type Me, type Preview } from '../api/schemas.js';
import type { CountryCode, VesselHull } from '@astera/rules';
import { track } from '../lib/analytics.js';
import { rememberCommander } from '../lib/returning.js';
import { consumeTrainingIntent, dismissFirstVisitTraining, wantsFirstVisitTraining } from '../lib/firstVisit.js';
import { academyPreview } from '../onboarding/academyWorld.js';
import { serverNow } from '../lib/clock.js';
import { clearLocalAlerts } from '../platform/localNotifications.js';
import { disconnectPush } from '../platform/push.js';
import { isAppActive, isAppActivityKnown, watchAppActivity } from '../platform/activity.js';
import { isNetworkOnline, watchNetworkStatus } from '../platform/network.js';
import { setStarterMode } from '../starter/transport.js';
import { vesselToPlanetView } from '../starter/adapter.js';

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
  | { phase: 'landing'; error?: string; open?: 'login'; securityNotice?: 'email' | 'password' | 'expired'; loginEmail?: string }
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

const READY_SESSION_KEY = 'astera:ready-session';

/**
 * WHERE A SIGNED-IN COMMANDER STANDS, which a planet decides first and a ship otherwise. Turns the
 * transport to match, so that it is right before the first read of the session goes out. The ship's
 * name stands where a planet's would, and the shard is the ship's galaxy (plan §5.7).
 */
function standingOf(me: Me): Standing | null {
  setStarterMode(me.placement === null && Boolean(me.vessel));
  if (me.placement) return { shard: me.placement.shard, shardName: me.placement.shardName, planetName: me.placement.planetName };
  if (me.vessel) return { shard: me.vessel.starterGalaxyId, shardName: '', planetName: me.vessel.name };
  return null;
}

function rememberReady(me: Me): void {
  try { window.sessionStorage.setItem(READY_SESSION_KEY, JSON.stringify(me)); } catch { /* Storage may be disabled. */ }
}

function forgetReady(): void {
  try { window.sessionStorage.removeItem(READY_SESSION_KEY); } catch { /* Storage may be disabled. */ }
}

function readReady(): Session {
  try {
    const stored = window.sessionStorage.getItem(READY_SESSION_KEY);
    if (stored) {
      const parsed = meSchema.safeParse(JSON.parse(stored));
      const standing = parsed.success ? standingOf(parsed.data) : null;
      if (parsed.success && standing) return { phase: 'ready', me: parsed.data, standing };
    }
  } catch { /* A corrupt or unavailable store is simply a cold start. */ }
  return { phase: 'starting' };
}

/**
 * A NEW ACCOUNT BOARDS WITHOUT BEING ASKED: a ship is where the game starts for them. A refusal means
 * the door closed since `/me` was read, so they carry on to the galaxy list, which is what `/me`
 * would now say. A failure of the server is not an answer, and goes to the caller to report.
 */
async function takeShip(api: Api, me: Me): Promise<Me> {
  try {
    await api.enlistVessel();
    return await api.me();
  } catch (err) {
    if (err instanceof ApiError && err.status < 500) return { ...me, starterEligible: false };
    throw err;
  }
}

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
export function useSession({ autoTraining = false }: { autoTraining?: boolean } = {}) {
  const api = useApi();
  const queries = useQueryClient();
  const [session, setSession] = useState<Session>(() => {
    const restored = readReady();
    return restored.phase === 'starting' && autoTraining && wantsFirstVisitTraining()
      ? { phase: 'rehearsing', preview: academyPreview(serverNow()) } : restored;
  });
  const [resumed, setResumed] = useState(() => session.phase === 'ready');
  // Async transitions from the previous identity must never replace its exit screen.
  const revision = useRef(0);
  const mounted = useRef(false);
  const currentSession = useRef(session);
  const recoverableCold = useRef<number | null>(null);
  const coldPromise = useRef<Promise<void> | null>(null);
  const coldFlight = useRef<{ revision: number; canQueue: boolean; requested: boolean } | null>(null);
  useEffect(() => { currentSession.current = session; }, [session]);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => api.onSessionEnded((reason, loginEmail) => {
    revision.current++;
    forgetReady();
    setStarterMode(false);
    queries.clear();
    setResumed(false);
    setSession({ phase: 'landing', open: 'login', securityNotice: reason, ...(loginEmail ? { loginEmail } : {}) });
  }), [api, queries]);

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
    async (arrived: Me): Promise<void> => {
      queries.clear();
      const me = arrived.starterEligible ? await takeShip(api, arrived) : arrived;
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
      const standing = standingOf(me);
      if (!standing) {
        forgetReady();
        setResumed(false);
        setSession({ phase: 'servers', me });
        return;
      }
      rememberReady(me);
      setSession({ phase: 'ready', me, standing });
    },
    [api, queries],
  );

  /** Cookie → session → screen. The whole of what happens when a tab opens cold. */
  const coldStart = useCallback((queueInitialReturn = false): Promise<void> => {
    if (coldPromise.current && coldFlight.current?.revision === revision.current) return coldPromise.current;
    const startedAt = revision.current;
    const stillCurrent = () => mounted.current && startedAt === revision.current;
    const flight = { revision: startedAt, canQueue: queueInitialReturn, requested: false };
    coldFlight.current = flight;
    const attempt = async (): Promise<void> => {
      recoverableCold.current = null;
      try {
        const restored = await api.restore();
        if (!stillCurrent()) return;
        if (!restored) {
          queries.clear();
          forgetReady();
          setStarterMode(false);
          setResumed(false);
          setSession(current => current.phase === 'rehearsing' ? current : { phase: 'landing' });
          return;
        }
        const me = await api.me();
        if (!stillCurrent()) return;
        await settle(me);
      } catch (err) {
        if (!stillCurrent()) return;
        // The private local lesson remains playable through an optional restore failure.
        if (currentSession.current.phase === 'rehearsing') return;
        if (err instanceof ApiError && err.status === 401) {
          forgetReady();
          setStarterMode(false);
          setResumed(false);
          setSession({ phase: 'landing', error: messageOf(err) });
          return;
        }
        // Temporary refresh/profile failures must not eject a resumed commander
        // or discard their world. Existing queries can recover on their next read;
        // a cold visitor gets the localized failure and the existing retry action.
        if (currentSession.current.phase !== 'ready' && err instanceof ApiError && err.status >= 500 && err.status < 600) {
          recoverableCold.current = startedAt;
        }
        setSession((current) => current.phase === 'ready'
          ? current : { phase: 'blocked', message: messageOf(err) });
      }
    };
    const task = (async () => {
      await attempt();
      // A return can race the first failed read. Retain one fresh pass, not a loop.
      flight.canQueue = false;
      if (flight.requested && recoverableCold.current === startedAt
        && stillCurrent() && isAppActive() && isNetworkOnline()) await attempt();
    })().finally(() => {
      if (coldFlight.current === flight) {
        coldFlight.current = null;
        coldPromise.current = null;
      }
    });
    coldPromise.current = task;
    return task;
  }, [api, queries, settle]);

  // A layout effect, so the cookie exchange is under way before a resumed galaxy's screens read
  // (their effects run first otherwise); the reads then wait for it instead of drawing 401s.
  useLayoutEffect(() => {
    if (started.current) return;
    started.current = true;
    if (autoTraining) consumeTrainingIntent();
    void coldStart(true);
  }, [autoTraining, coldStart]);

  useEffect(() => {
    let wasActive = isAppActive();
    let known = isAppActivityKnown();
    const recover = (): void => {
      if (!mounted.current || !isAppActive() || !isNetworkOnline()) return;
      const flight = coldFlight.current;
      if (flight?.revision === revision.current) {
        if (flight.canQueue) flight.requested = true;
        return;
      }
      if (recoverableCold.current === revision.current && currentSession.current.phase === 'blocked') void coldStart();
    };
    const activity = (): void => {
      const active = isAppActive();
      // The first native getState result establishes a baseline, not a resume.
      const returned = active && known && !wasActive;
      wasActive = active;
      known = isAppActivityKnown();
      if (returned) recover();
    };
    const stopActivity = watchAppActivity(activity);
    const stopNetwork = watchNetworkStatus(recover);
    return () => { stopActivity(); stopNetwork(); };
  }, [coldStart]);

  const authenticate = useCallback(
    async (mode: 'login' | 'register', username: string, password: string, countryCode?: CountryCode, policy?: CommunityPolicyConsent): Promise<void> => {
      const startedAt = ++revision.current;
      setResumed(false);
      setSession({ phase: 'starting' });
      try {
        if (mode === 'register') await api.register(username, password, countryCode, policy);
        else await api.login(username, password);
        if (startedAt !== revision.current) return;
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
        const me = await api.me();
        if (startedAt !== revision.current) return;
        await settle(me);
      } catch (err) {
        if (startedAt !== revision.current) return;
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
      const startedAt = revision.current;
      setResumed(false);
      setSession({ phase: 'starting' });
      try {
        await api.joinServer(code);
        if (startedAt !== revision.current) return;
        const me = await api.me();
        if (startedAt !== revision.current) return;
        await settle(me);
      } catch (err) {
        if (startedAt !== revision.current) return;
        setSession({ phase: 'servers', me: current.me, error: messageOf(err) });
      }
    },
    [api, session, settle],
  );

  /**
   * D172: enter a private Academy without a frontier request or an account.
   */
  const rehearse = useCallback((): Promise<void> => {
    revision.current++;
    setSession({ phase: 'rehearsing', preview: academyPreview(serverNow()) });
    return Promise.resolve();
  }, []);

  /** Out of the rehearsal without an account. Nothing to undo. */
  const leaveRehearsal = useCallback((): void => {
    revision.current++;
    dismissFirstVisitTraining();
    setSession({ phase: 'landing' });
  }, []);

  /** Out of the rehearsal, to sign in as somebody who already exists. */
  const signInInstead = useCallback((): void => {
    revision.current++;
    dismissFirstVisitTraining();
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
      const account = {
        accountId: result.accountId,
        username: result.username,
        displayName: result.displayName,
        isAdmin: false,
        country: result.country,
      };
      if (result.vessel) {
        const { id, name, status, galaxy } = result.vessel;
        queries.setQueryData(keys.planet, vesselToPlanetView(result.vessel));
        const aboard: Me = { ...account, placement: null, vessel: { id, name, status, starterGalaxyId: galaxy.id }, starterEligible: false };
        setStarterMode(true);
        rememberReady(aboard);
        setSession({ phase: 'ready', me: aboard, standing: { shard: galaxy.id, shardName: '', planetName: name } });
        return;
      }
      queries.setQueryData(keys.planet, result.planet);
      const me: Me = {
        ...account,
        placement: {
          shard: result.placement.shard,
          shardName: result.placement.shardName,
          planetName: result.placement.planetName,
        },
      };
      rememberReady(me);
      setSession({
        phase: 'ready',
        me,
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
      intents: readonly ClaimIntent[] | number,
      countryCode?: CountryCode,
      policy?: CommunityPolicyConsent,
      vesselHull?: VesselHull,
    ): Promise<void> => {
      const startedAt = ++revision.current;
      const result = await api.claim(username, password, intents, countryCode, policy, vesselHull);
      if (startedAt !== revision.current) return;
      rememberCommander();
      // The other door. A commander who played the rehearsal first and is only now
      // becoming an account — the conversion this whole onboarding exists for.
      track('sign_up', { method: 'rehearsal' });
      settleClaim(result);
    },
    [api, settleClaim],
  );

  const updateCountry = useCallback(async (country: CountryCode): Promise<void> => {
    const updated = await api.updateCountry(country);
    setSession((current) => {
      if (current.phase === 'ready' || current.phase === 'servers') {
        return { ...current, me: { ...current.me, country: updated.country } };
      }
      return current;
    });
    void refreshQueries(queries, { queryKey: keys.leaderboard });
  }, [api, queries]);


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
    const startedAt = ++revision.current;
    const loginEmail = api.verifiedEmail;
    void clearLocalAlerts();
    // While the session still stands: the server forgets this phone only for its owner. Bounded,
    // so a dead network never holds the sign-out; the next sign-in moves the token anyway.
    await Promise.race([disconnectPush(api), new Promise(resolve => setTimeout(resolve, 1_500))]);
    forgetReady();
    setStarterMode(false);
    setResumed(false);
    setSession({ phase: 'starting' });
    try {
      await api.logout();
      if (startedAt !== revision.current) return;
      queries.clear();
      setSession({ phase: 'landing', open: 'login', ...(loginEmail ? { loginEmail } : {}) });
    } catch (err) {
      if (startedAt !== revision.current) return;
      setSession({ phase: 'blocked', message: messageOf(err) });
    }
  }, [api, queries]);

  /** For the blocked screen: try the whole cold start again. */
  const retry = useCallback((): void => {
    setSession({ phase: 'starting' });
    void coldStart();
  }, [coldStart]);

  /** The old planet vanished at the public rollover instant. D88. */
  const rollover = useCallback((): void => {
    const current = session;
    if (current.phase !== 'ready') return;
    const startedAt = revision.current;
    queries.clear();
    forgetReady();
    setResumed(false);
    // The world already committed its successor. Move immediately; `/me` then
    // reconciles the permanent result without putting a loading door in the way.
    // A ship that landed has a planet to go to, and no galaxy list belongs in between.
    if (!current.me.vessel) setSession({ phase: 'servers', me: { ...current.me, placement: null } });
    void api.me().then(me => {
      if (startedAt === revision.current) return settle(me);
    }).catch((err: unknown) => {
      if (startedAt !== revision.current) return;
      setSession({ phase: 'blocked', message: messageOf(err) });
    });
  }, [api, queries, session, settle]);

  return {
    session,
    resumed,
    authenticate,
    chooseServer,
    signOut,
    retry,
    rehearse,
    leaveRehearsal,
    signInInstead,
    claim,
    updateCountry,
    rollover,
  };
}
