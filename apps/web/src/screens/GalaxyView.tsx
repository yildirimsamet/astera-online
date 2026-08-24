import { SeasonLockProvider } from '../session/seasonLock.js';
import { NextSeason } from '../ui/NextSeason.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useGalaxy,
  useIntel,
  useHarvest,
  useMine,
  useFleetArrivals,
  useMining,
  useMiningArrivals,
  usePending,
  usePlanet,
  useReports,
  useSeason,
  useSetRival,
  useTraffic,
  useContactWindows,
  useLaunchDeathStar,
  useSettlement,
} from '../api/queries.js';
import type { AsteroidView, HistoricalSeasonResult, MiningRun, MiningView } from '../api/schemas.js';
import { GalaxyCanvas } from '../galaxy/GalaxyCanvas.jsx';
import {
  AsteroidFocus,
  DebrisFocus,
  ContactFocus,
  PlanetFocus,
  RunFocus,
  ThreadFocus,
  minutesLeftFor,
  type Focus,
} from '../galaxy/FocusPanel.jsx';
import { threadKey } from '../galaxy/Fleets.jsx';
import type { PlanetGroup } from '../lib/directives.js';
import { HomeworldIcon } from '../ui/icons/index.js';
import { haptic } from '../lib/haptics.js';
import { minutesLeft, useNow } from '../lib/time.js';
import { distance, engagementEndsAt, interceptAsteroid, travelMinutes } from '@astera/rules';
import { LaunchSheet } from './LaunchSheet.jsx';
import { TransferSheet } from './TransferSheet.js';
import { PlanetScreen } from './PlanetScreen.jsx';
import { IntelScreen } from './IntelScreen.jsx';
import { RewardsScreen } from './RewardsScreen.jsx';
import { MenuPanel } from '../shell/MenuPanel.jsx';
import { LeaderboardScreen } from './LeaderboardScreen.jsx';
import { ChatScreen } from './ChatScreen.jsx';
import { ChatLauncher } from './ChatLauncher.jsx';
import { ChronicleLauncher } from './ChronicleLauncher.jsx';
import { ChronicleScreen } from './ChronicleScreen.jsx';
import { Sheet } from '../ui/Sheet.js';
import { describe, useToast } from '../ui/Toast.js';
import { GALAXY_ASSETS, usePreload } from '../lib/preload.js';
import { LoadingScreen } from '../shell/LoadingScreen.js';
import { useArrivals } from '../session/useArrivals.js';
import { DiscReadout } from './DiscReadout.jsx';
import { SeasonRecap, useSeasonRecapOpening } from './SeasonRecap.jsx';
import { ApiError } from '../api/client.js';
import { useWorld } from '../api/world.js';
import { controlledWorldId } from '../galaxy/scene.js';
import { focusTapDecision } from '../galaxy/follow.js';

/**
 * THE GALAXY IS THE GAME. D20.
 *
 * There is no longer anywhere else to be. The canvas is mounted once and never
 * unmounted, it fills everything between the resource header and the in-flight
 * strip, and every other surface in the game — your own planet, its four decision
 * groups, the intel centre, a neighbour's dossier, an asteroid, a squadron in
 * transit — opens over it.
 *
 * The tab bar is gone. It was the last thing insisting the map was a place you
 * VISIT, and D1 has said since the design phase that the information game "makes
 * the 3D galaxy an interface rather than a target list".
 *
 * FOCUS IS THE PRIMITIVE. The first tap selects and frames an object — following,
 * if it moves — while the second tap on that same object opens its detail. A world
 * the commander controls is the exception: it opens management immediately.
 */

export type Panel = 'planet' | 'intel' | 'leaderboard' | 'chat' | 'chronicle' | 'rewards' | 'recap' | 'menu' | null;

export function GalaxyView({
  panel,
  onPanel,
  focusRequest,
  commander,
  pastResult,
  onSignOut,
  onPlacementLost,
  onFocused,
  planetGroup,
  openWide,
  allowFocus,
  goHome,
  showChat = true,
}: {
  /** Opened from the header, which is the only chrome left outside the canvas. */
  panel: Panel;
  onPanel: (panel: Panel) => void;
  /** A route from an already-revealed identity back to its world. */
  focusRequest?: { planetId: string; request: number } | null;
  /** Who is signed in. Shown on the one surface that is about you rather than the world. */
  commander: string;
  /** The newest permanent record, still readable after its world was wiped. D87. */
  pastResult?: HistoricalSeasonResult | null;
  onSignOut: () => void;
  /** Safety net when the rollover broadcast was missed while this tab slept. */
  onPlacementLost?: () => void;
  /**
   * What the player just selected, reported to whoever is watching. D56.
   *
   * READ-ONLY, AND ONLY THE ONBOARDING LISTENS. The rehearsal's beats advance on
   * what the player DID — tapping their own world, then a neighbour — rather than
   * on a "next" button, and the honest way to know is to be told. Focus itself
   * stays owned here: a beat that could MOVE the camera would be a tutorial
   * playing itself, which is the thing this whole flow exists not to be.
   */
  onFocused?: (focus: Focus | null) => void;
  /** Which decision group the planet panel opens on, when something else decides. */
  planetGroup?: PlanetGroup;
  /** Open on the whole disc with nothing selected, for the rehearsal. D56. */
  openWide?: boolean;
  /** Which worlds may be selected. Absent means all of them, which is the game. */
  allowFocus?: (planetId: string) => boolean;
  /**
   * Bumped from outside to fly the camera to the player's own world. D56.
   *
   * The same path the header's own control takes, deliberately: the selection is
   * cleared first and then the signal is raised, because a subject still being
   * tracked drags the camera straight back and the flight appears to do nothing.
   */
  goHome?: number;
  /** Hidden in the pre-account rehearsal, where no commander identity exists. */
  showChat?: boolean;
}) {
  const { t } = useTranslation();
  const galaxy = useGalaxy();
  const planet = usePlanet();
  const intel = useIntel();
  const season = useSeason();
  const pending = usePending();
  const traffic = useTraffic();
  const mining = useMining();
  const reports = useReports();
  const setRival = useSetRival();
  const mine = useMine();
  const harvest = useHarvest();
  const settlement = useSettlement();
  const deathStar = useLaunchDeathStar();
  const { activePlanetId, selectPlanet } = useWorld();
  const say = useToast();
  const now = useNow(5_000);
  const [requestedPlanetGroup, setRequestedPlanetGroup] = useState<PlanetGroup | null>(null);

  useEffect(() => {
    if (panel === null) setRequestedPlanetGroup(null);
  }, [panel]);

  /**
   * WAKE UP WHEN SOMETHING LANDS. D48.
   *
   * Both lists are polled on a timer, and a timer is the wrong instrument for an
   * instant the payload already names. Every leg is drawn by an interpolation that
   * CLAMPS, so a craft whose payload is thirty seconds stale is not missing — it is
   * parked on its destination: a squadron hanging over a world it has already
   * finished fighting, a drill sitting at a point its rock left half a minute ago.
   */
  useMiningArrivals(mining.data?.runs);
  useFleetArrivals(pending.data?.pending);
  /**
   * AND ASK FOR THE NEXT BEARING WINDOW WHEN THE CURRENT ONE RUNS OUT.
   *
   * A stranger's craft is drawn inside a published window; when it ends the client
   * has no more motion to interpolate and coasts on a guess. This asks for the next
   * one, and — unlike a real arrival — it refetches `traffic` and nothing else,
   * because nothing else can have changed. See `useContactWindows`.
   */
  useContactWindows(traffic.data?.contacts);

  const [focus, setFocus] = useState<Focus | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  /**
   * Whether the focus rail is expanded. Reset to closed on every new selection —
   * a panel that stayed open as the player swept from world to world would undo
   * the whole point of it opening closed.
   */
  const [detail, setDetail] = useState(false);
  const [attacking, setAttacking] = useState(false);
  const [homeSignal, setHomeSignal] = useState(0);
  const reportedLostPlacement = useRef(false);
  useEffect(() => {
    if (
      reportedLostPlacement.current ||
      !(season.error instanceof ApiError) ||
      season.error.code !== 'NO_PLANET'
    ) return;
    reportedLostPlacement.current = true;
    onPlacementLost?.();
  }, [onPlacementLost, season.error]);

  /**
   * THE ONE ENDING, ONCE. D86.
   *
   * The season event invalidates this existing query through `shard:season`; no
   * second result request and no polling loop is introduced. Local storage only
   * remembers that this person closed this season's ceremony — it never stores an
   * outcome. `shownRecap` also prevents repeated effects before storage settles.
   */
  const openSeasonRecap = useCallback(() => {
    onPanel('recap');
  }, [onPanel]);
  const recapResult = season.data?.result ?? pastResult;
  useSeasonRecapOpening(
    season.data?.result ? season.data.status : pastResult ? 'frozen' : undefined,
    recapResult,
    openSeasonRecap,
  );

  /**
   * FLY HOME WHEN SOMEBODY OUTSIDE ASKS. D56.
   *
   * Skips the very first value so a mount does not count as a request — the rig
   * already frames the opening, and re-triggering it here would fight that with an
   * ease starting from the frame it just set.
   */
  const askedHome = useRef(goHome);
  useEffect(() => {
    if (goHome === undefined || goHome === askedHome.current) return;
    askedHome.current = goHome;
    setFocus(null);
    setHomeSignal((n) => n + 1);
  }, [goHome]);

  /**
   * THE DISC COMES UP UNDER A COVER, NOT AFTER ONE. Owner decision.
   *
   * Eleven models have to arrive and decode before the galaxy is smooth, and on a
   * phone that is a second or two of a half-built scene: worlds without their
   * instruments, rocks popping in, a stutter as each hull lands. The canvas is
   * mounted and working the whole time this is up — the cover hides the jank
   * rather than delaying the work, which is the point of it being an overlay and
   * not a gate.
   */
  const assets = usePreload(GALAXY_ASSETS);

  /**
   * AND THE COVER STAYS UNTIL THERE IS A GALAXY UNDER IT. Owner decision.
   *
   * It used to come off on `assets.ready && !galaxy.isPending`, and both halves
   * were early. `assets.ready` means the BYTES arrived — the models still have to
   * be parsed, compiled and uploaded, which is the part a phone shows as worlds
   * popping in one at a time. And `galaxy` is one of four payloads the first frame
   * is drawn from: without `planet` there is no home to centre on, without
   * `season` the rocks cannot be placed on their orbits at all, and without
   * `mining` there is no rock field and no wreckage. The disc was uncovered and
   * then visibly assembled itself.
   *
   * So three things now have to be true: the files are in, every first-paint
   * payload has SETTLED, and the canvas has painted a frame with all of it in
   * (`onReady` — see `FirstFrame`).
   *
   * SETTLED, NOT SUCCEEDED. A failed request must open the door: the surfaces
   * below degrade on their own, and a loading screen that outlives the network is
   * a game nobody can reach.
   */
  const [drawn, setDrawn] = useState(false);
  const dataSettled =
    !galaxy.isPending && !planet.isPending && !season.isPending && !mining.isPending;
  const covered = !(assets.ready && dataSettled && drawn);


  /**
   * THERE IS ALWAYS A DEADLINE, for the reason `preload.ts` gives: a cover with no
   * way out is a game that cannot be reached. `onReady` needs a working WebGL
   * context and a frame loop, and neither is something a player can fix.
   *
   * ARMED ONLY ONCE EVERYTHING ELSE IS IN, so it measures the thing it is actually
   * a net for. Started at mount it was really a timer on the network — a slow
   * first fetch spent the whole allowance before the canvas had been given
   * anything to draw, and the net fired over an empty disc, which is precisely
   * what it exists to prevent.
   */
  const armed = assets.ready && dataSettled;
  useEffect(() => {
    if (drawn || !armed) return;
    const timer = setTimeout(() => {
      setDrawn(true);
    }, 15_000);
    return () => {
      clearTimeout(timer);
    };
  }, [drawn, armed]);

  const planets = useMemo(() => galaxy.data?.planets ?? [], [galaxy.data]);
  /**
   * CAMERA HOME COMES FROM THE DISC IT MOVES OVER.
   *
   * Multi-world selection made `planet.data` and `galaxy.data` two independently
   * refreshing views of the active world. Using the former to aim at a body drawn
   * from the latter let one stale frame send Home to coordinates with no rendered
   * planet. Resolve the active id inside the exact array the canvas renders.
   */
  const activeWorldPosition = useMemo(
    () => planets.find((world) => world.id === activePlanetId)?.position
      ?? planet.data?.planet.position,
    [activePlanetId, planet.data, planets],
  );
  const asteroids = useMemo(() => mining.data?.asteroids ?? [], [mining.data]);
  const runs = useMemo(() => mining.data?.runs ?? [], [mining.data]);
  const wrecks = useMemo(() => mining.data?.debris ?? [], [mining.data]);
  const threads = useMemo(() => pending.data?.pending ?? [], [pending.data]);

  /**
   * EVERY PROP THE DISC TAKES IS STABLE, AND TWO OF THEM WERE NOT. D53.
   *
   * This component holds a clock, so it re-renders on a timer whether or not
   * anything about the galaxy has changed. That is meant to be free — React
   * reconciles, nothing below it sees a changed prop, nothing is rebuilt.
   *
   * It was not free for these two. `watching` was built with `.map` in the JSX, so
   * it was a NEW ARRAY on every render even when the same worlds were being
   * watched — and it is a dependency of the memo that resolves those worlds to
   * positions, which is in turn the dependency of the memo that builds the watch
   * beams' `BufferGeometry`. A player with telescopes pointed was allocating and
   * uploading a fresh line buffer to the GPU every time this clock ticked, for a
   * set of beams that had not moved. The callbacks are the same story one level up:
   * a new function identity re-runs anything below that depends on it.
   *
   * `contacts` is memoised for the same reason rather than because it churns —
   * React Query's structural sharing keeps it stable while the payload is
   * unchanged, but only while `traffic.data` is DEFINED; the `?? []` fallback
   * before the first fetch was a fresh array each time.
   */
  const contacts = useMemo(() => traffic.data?.contacts ?? [], [traffic.data]);
  const watching = useMemo(
    () => (intel.data?.watching ?? []).map((w) => w.targetPlanetId),
    [intel.data],
  );
  const onReady = useCallback(() => {
    setDrawn(true);
  }, []);
  const onFocus = useCallback(
    (next: Focus | null) => {
      if (next) haptic('tap');
      const ownedId = next?.kind === 'planet' ? controlledWorldId(planets, next.id) : null;
      const decision = focusTapDecision(focus, next, ownedId);
      if (decision.kind === 'manage') {
        // A click on any controlled world means "manage this world". `isSelf`
        // names the immutable capital identity and used to strand colonies in a
        // focus state with no dossier and no planet sheet.
        selectPlanet(decision.planetId);
        setFocus(null);
        setDetail(false);
        setAttacking(false);
        onPanel('planet');
        onFocused?.(next);
        return;
      }
      setFocus(decision.focus);
      setDetail(decision.detail);
      setAttacking(false);
      onFocused?.(next);
    },
    [focus, onFocused, onPanel, planets, selectPlanet],
  );
  const focusPlanet = useCallback(
    (planetId: string) => {
      const target = planets.find((candidate) => candidate.id === planetId);
      if (!target) return;
      const next: Focus = { kind: 'planet', id: planetId };
      const ownedId = controlledWorldId(planets, planetId);
      if (ownedId) {
        selectPlanet(ownedId);
        setFocus(null);
        setDetail(false);
        setAttacking(false);
        onPanel('planet');
        onFocused?.(next);
        return;
      }
      setFocus(next);
      setDetail(false);
      setAttacking(false);
      onFocused?.(next);
    },
    [onFocused, onPanel, planets, selectPlanet],
  );
  const handledFocusRequest = useRef<number | null>(null);
  useEffect(() => {
    if (!focusRequest || handledFocusRequest.current === focusRequest.request) return;
    if (!planets.some((candidate) => candidate.id === focusRequest.planetId)) return;
    handledFocusRequest.current = focusRequest.request;
    focusPlanet(focusRequest.planetId);
  }, [focusPlanet, focusRequest, planets]);

  /**
   * REFETCH THE MOMENT ANYTHING LANDS.
   *
   * Every list here draws its craft by interpolating between two timestamps, and
   * that interpolation clamps — so a craft whose list has gone stale does not turn
   * for home or disappear, it sits on its target. See `useArrivals`; the instants
   * are gathered here because this is the one place that holds all four lists.
   *
   * A mining run's next event is its arrival on the way out and its landing on the
   * way back, so both are offered and the hook takes whichever is sooner.
   */
  useArrivals(
    useMemo(
      () => [
        ...threads.map((t) => t.arriveAt),
        /**
         * AND THE INSTANT THE BATTLE IS ACTUALLY SETTLED. D44, D45.
         *
         * A raid reaches its target at `arriveAt` and is decided ten seconds
         * later, and only `arriveAt` was offered here. So the one refetch an
         * attacker got landed while the mission was still in flight and nothing
         * had happened yet: the strip still counted a fleet that was over its
         * target, the report did not exist, and the next refresh was whenever a
         * poll or a focus event came along. The player watched the bombardment
         * play out and the interface never acknowledged it.
         *
         * A return leg lands at `arriveAt` with no window at all, and a probe has
         * none either — only an outbound fleet is going to fight.
         */
        ...threads
          .filter((t) => t.kind === 'fleet' && t.leg === 'outbound')
          .map((t) => new Date(engagementEndsAt(t.arriveAt.getTime()))),
        ...runs.map((r) => (r.status === 'returning' ? r.homeAt : r.arriveAt)),
        /**
         * AND SOMEBODY ELSE'S BATTLE, WHICH IS NOW EVERYBODY'S. D52.
         *
         * A bystander has no pending thread of their own, so nothing here was ever
         * armed for a raid they are only WATCHING — their traffic list arrived on a
         * poll, which was that many seconds of a squadron hanging over a world with
         * its volley finished. Both edges are offered: the landing, so the
         * bombardment starts on the instant, and the settlement, so the wreck of it
         * clears the moment the server says so.
         *
         * These stay in the FULL refresh while a contact's plain window end does
         * not (D72): a battle resolving really does move the planet, the reports
         * and the debris on `mining`, where a bearing window expiring moves only
         * `traffic`.
         */
        ...(traffic.data?.contacts ?? []).flatMap((c) =>
          c.engagement ? [c.engagement.arriveAt, c.engagement.endsAt] : [],
        ),
      ],
      [threads, runs, traffic.data],
    ),
  );

  const selected = focus?.kind === 'planet' ? planets.find((p) => p.id === focus.id) : undefined;

  const close = (): void => {
    setFocus(null);
    setDetail(false);
    setAttacking(false);
  };

  /**
   * FOLLOW WHAT YOU JUST SENT. Owner decision.
   *
   * Committing a fleet is the biggest thing a player does — it cannot be recalled
   * (Principle 3) — and until now the reward for it was a sheet closing and a line
   * of toast. The camera stayed exactly where it was, and the craft the player had
   * just paid for left without them.
   *
   * IT CANNOT BE FOCUSED IMMEDIATELY, and that is the awkward part. A launch
   * returns before the craft exists in any list the disc draws from: the mutation
   * invalidates `pending` or `mining`, the refetch lands a moment later, and only
   * then is there something to point at. So the intent is REMEMBERED and resolved
   * on the first render that actually has the craft in it.
   *
   * Matched on target rather than on id because a thread's key is positional —
   * `threadKey` includes its index — so there is no id a launch could return that
   * would identify it in a list that does not exist yet. A mining run does have
   * one, and uses it.
   */
  const [awaiting, setAwaiting] = useState<
    { kind: 'outbound'; targetName: string } | { kind: 'run'; id: string } | null
  >(null);

  useEffect(() => {
    if (!awaiting) return;

    if (awaiting.kind === 'run') {
      if (runs.some((r) => r.id === awaiting.id)) {
        setFocus({ kind: 'run', id: awaiting.id });
        setAwaiting(null);
      }
    } else {
      const i = threads.findIndex(
        (t) => t.leg === 'outbound' && t.targetName === awaiting.targetName,
      );
      if (i >= 0) {
        setFocus({ kind: 'thread', key: threadKey(threads[i]!, i) });
        setAwaiting(null);
      }
    }
  }, [awaiting, threads, runs]);

  /**
   * Give up after a few seconds rather than hanging on a craft that never arrives.
   * A refused launch, a dropped refetch or a craft that resolved before the list
   * came back would otherwise leave the intent armed, and the NEXT unrelated
   * refetch would snap the camera onto something the player did not ask for.
   */
  useEffect(() => {
    if (!awaiting) return;
    const timer = setTimeout(() => {
      setAwaiting(null);
    }, 8000);
    return () => {
      clearTimeout(timer);
    };
  }, [awaiting]);

  const toggle = (): void => {
    setDetail((open) => !open);
  };

  return (
    <SeasonLockProvider locked={season.data?.status === 'frozen'}>
    <div className="absolute inset-0 overflow-hidden">
      <GalaxyCanvas
        planets={planets}
        pending={threads}
        contacts={contacts}
        watching={watching}
        asteroids={asteroids}
        runs={runs}

        wrecks={wrecks}
        {...(activeWorldPosition ? { homePosition: activeWorldPosition } : { homePosition: undefined })}
        activePlanetId={activePlanetId}
        aegisLevel={planet.data?.instruments.AEGIS ?? 0}
        {...(season.data ? { seasonStart: season.data.startsAt } : { seasonStart: undefined })}
        rivalPlanetId={season.data?.rivalPlanetId ?? null}
        rivalPlayerId={season.data?.rivalPlayerId ?? null}
        focus={focus}
        onReady={onReady}
        onFocus={onFocus}
        homeSignal={homeSignal}
        openWide={openWide ?? false}
        {...(allowFocus ? { allowFocus } : {})}
      />

      {/* ── the only chrome on the canvas ───────────────────── */}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        {/*
          THE DISC READOUT, TAKEN DOWN A SIZE. Owner decision.

          It is a caption on a map, not a panel: it names what is out there and it
          is read once a session. At `frame px-3 py-2` with a 12px numeral it was
          competing with the worlds for the top-left corner of the only screen the
          game has, on the device the game is aimed at. Smaller box, smaller type,
          and the tracking on the label eased off so it still reads at 9px.
        */}
        <DiscReadout
          shardName={season.data?.shardName}
          shard={season.data?.shard ?? ''}
          online={season.data?.online}
        >
          {/*
            THE NAME ON THE LEFT, WHO IS IN HERE ON THE RIGHT.

            `justify-between` rather than a gap, because the two are not a phrase:
            one names the place and the other counts the people in it. The box is
            already as wide as the line of counts underneath, so pushing the tally
            to the far edge costs no width and gives it its own corner to live in.

            Green is the system's own `opportunity`, which is what the disc already
            uses for a fleet in the air — the colour means "somebody is doing
            something" everywhere else on this screen, and a commander at the
            controls is the same fact.

            HIDDEN, NOT ZEROED, when the figure is absent: `online` is optional on
            the payload so a client ahead of its server still parses, and "0
            online" on a screen you are personally looking at is a lie.
          */}
            {t('galaxy.worlds', { count: planets.length })}
            {windowsOpen(planets) > 0 && (
              <span className="text-opportunity">
                {t('galaxy.fleetAway', { count: windowsOpen(planets) })}
              </span>
            )}
            {asteroids.length > 0 && (
              <span className="text-crystal">{t('galaxy.rocks', { count: asteroids.length })}</span>
            )}
            {/*
              WRECKAGE IS COUNTED HERE BECAUSE IT IS PUBLIC. D32.

              A field is a landmark at a known address with a clock on it, and the
              whole value of the mechanic is that somebody who is not at war notices
              it. Making a player spot amber motes on a dark disc would hide the one
              thing it exists to advertise.
            */}
            {wrecks.length > 0 && (
              <span className="text-alloy">{t('galaxy.wrecks', { count: wrecks.length })}</span>
            )}
        </DiscReadout>

        {/*
          HOME, as a mark rather than a word.
          A labelled button in the corner of a map reads as browser chrome — the
          owner's note was that it "looks like a home page". A glyph at low opacity
          is furniture the eye skips until it is wanted, which is exactly the right
          weight for a control that only recovers the camera.
        */}
        <button
          type="button"
          aria-label={t('galaxy.home')}
          onClick={() => {
            haptic('tap');
            // Going home means letting go of what you were looking at. Leaving the
            // selection in place made the camera ease home and then snap straight
            // back, because a focused subject is followed every frame.
            close();
            setHomeSignal((n) => n + 1);
          }}
          className="pointer-events-auto flex size-10 items-center justify-center rounded-sm border border-line-soft/60 bg-void/35 text-dim transition-colors hover:border-line hover:text-bone active:scale-95"
        >
          <HomeworldIcon className="size-5" />
        </button>
      </div>

      {showChat && (
        <>
          <ChronicleLauncher onOpen={() => { onPanel('chronicle'); }} />
          <ChatLauncher
            onOpen={() => {
              onPanel('chat');
            }}
          />
        </>
      )}

      {/*
        The colour legend that used to sit down here is gone (owner decision). It
        explained the stance colours to a player who had no reason to be reading a
        key — and now that tapping a world says what it is in words, the panel is
        both the explanation and the answer.
      */}

      {/* ── focus ───────────────────────────────────────────── */}

      {focus?.kind === 'planet' && selected && selected.id !== planet.data?.planet.id && planet.data && !attacking && (
        <PlanetFocus
          target={selected}
          planet={planet.data}
          intel={intel.data}
          reports={reports.data?.reports ?? []}
          rival={reports.data?.rivals.find((rival) => rival.planetId === selected.id)}
          isRival={
            (season.data?.rivalPlayerId != null
              && selected.controller?.kind === 'PLAYER'
              && selected.controller.playerId === season.data.rivalPlayerId)
            || (season.data?.rivalPlayerId == null
              && season.data?.rivalPlanetId === selected.id)
          }
          now={now}
          onClose={close}
          onLaunched={(targetName) => {
            close();
            setAwaiting({ kind: 'outbound', targetName });
          }}
          onAttack={() => {
            setAttacking(true);
          }}
          onTransfer={() => {
            setTransferTargetId(selected.id);
          }}
          onSettle={() => {
            settlement.mutate(selected.id, {
              onSuccess: () => {
                say(t('galaxy.settlementAway', { world: selected.name }));
                close();
              },
              onError: (error) => { say(describe(error), 'error'); },
            });
          }}
          onDeathStar={() => {
            deathStar.mutate(selected.id, {
              onSuccess: () => {
                say(t('galaxy.deathStarAway', { world: selected.name }));
                close();
              },
              onError: (error) => { say(describe(error), 'error'); },
            });
          }}
          onInstallTelescope={() => {
            onPanel('planet');
          }}
          open={detail}
          onToggle={toggle}
        />
      )}

      {focus?.kind === 'debris' && (
        <DebrisFocusHost
          field={(mining.data?.debris ?? []).find((d) => d.id === focus.id)}
          planets={galaxy.data?.planets ?? []}
          runs={runs}
          mining={mining.data}
          homePosition={activeWorldPosition}
          busy={harvest.isPending}
          open={detail}
          onToggle={toggle}
          onClose={close}
          onSend={(fieldId, craft) => {
            harvest.mutate(
              { fieldId, craft },
              {
                onSuccess: (r) => {
                  say(
                    t('galaxy.harvestAway', {
                      count: r.craft,
                      minutes: Math.round(r.flightMinutes),
                    }),
                  );
                  close();
                  setAwaiting({ kind: 'run', id: r.runId });
                },
                onError: (err) => {
                  say(describe(err), 'error');
                },
              },
            );
          }}
        />
      )}

      {focus?.kind === 'asteroid' && season.data && (
        <AsteroidFocusHost
          rock={asteroids.find((a) => a.index === focus.index)}
          runs={runs}
          mining={mining.data}
          seasonStart={season.data.startsAt}
          homePosition={activeWorldPosition}
          now={now}
          busy={mine.isPending}
          open={detail}
          onToggle={toggle}
          onClose={close}
          onSend={(index, craft) => {
            mine.mutate(
              { asteroidIndex: index, craft },
              {
                onSuccess: (r) => {
                  say(
                    t('galaxy.miningAway', {
                      count: r.craft,
                      minutes: Math.round(r.flightMinutes),
                    }),
                  );
                  close();
                  setAwaiting({ kind: 'run', id: r.runId });
                },
                onError: (err) => {
                  say(describe(err), 'error');
                },
              },
            );
          }}
        />
      )}

      {focus?.kind === 'run' &&
        (() => {
          const run = runs.find((r) => r.id === focus.id);
          if (!run) return null;
          const target = run.status === 'returning' ? run.homeAt : run.arriveAt;
          /**
           * A HARVEST HAS NO ROCK. D32.
           *
           * `asteroidIndex` is null on a salvage run, so the rock lookup below can
           * only ever miss — and a miss is what `RunFocus` renders as "Rock has
           * passed". The field is the target, and it is in the same payload.
           */
          const field =
            run.debrisFieldId === null
              ? undefined
              : (mining.data?.debris ?? []).find((d) => d.id === run.debrisFieldId);
          return (
            <RunFocus
              run={run}
              rock={asteroids.find((a) => a.index === run.asteroidIndex)}
              wreck={
                run.targetKind === 'debris'
                  ? field && {
                      planetName: planets.find((p) => p.id === field.planetId)?.name,
                      minutesLeft: field.minutesLeft,
                    }
                  : undefined
              }
              minutesRemaining={target ? minutesLeft(target, now) : 0}
              onClose={close}
              open={detail}
              onToggle={toggle}
            />
          );
        })()}

      {focus?.kind === 'thread' &&
        (() => {
          const index = threads.findIndex((t, i) => threadKey(t, i) === focus.key);
          const thread = threads[index];
          // The thread landed between the tap and the render. Dropping the
          // selection is honest — there is nothing there any more.
          if (!thread) return null;
          return (
            <ThreadFocus
              thread={thread}
              /**
               * OFF THE CLOCK, NOT OFF THE PAYLOAD.
               *
               * `minutesRemaining` is computed on the server at request time and
               * rounded to a whole minute, and `pending` refetches once a minute —
               * so this rail sat on a figure that was up to a minute stale and only
               * ever moved in whole minutes, while the pending strip DIRECTLY BELOW
               * IT counted the same craft down in seconds off `arriveAt`. Two clocks
               * for one fleet, stacked, disagreeing, one of them not moving.
               *
               * `arriveAt` is the instant itself and needs no anchor — the same
               * reasoning as `arrivalOf` in the strip, which is the surface this
               * now agrees with.
               */
              minutesRemaining={minutesLeft(thread.arriveAt, now)}
              onClose={close}
              open={detail}
              onToggle={toggle}
            />
          );
        })()}

      {/* Somebody else's craft. D24: selectable, and readable up to a point. */}
      {focus?.kind === 'contact' &&
        (() => {
          const contact = (traffic.data?.contacts ?? []).find((c) => c.id === focus.id);
          if (!contact) return null;
          return (
            <ContactFocus contact={contact} onClose={close} open={detail} onToggle={toggle} />
          );
        })()}

      {season.data?.status === 'frozen' && panel === null && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-30 mx-auto w-full max-w-sm px-4">
          <NextSeason endsAt={season.data.endsAt} />
        </div>
      )}

      {/* ── full surfaces, over the live galaxy ─────────────── */}

      {panel === 'planet' && planet.data && (
        <Sheet
          eyebrow={planet.data.planet.name}
          title={commander}
          onClose={() => {
            onPanel(null);
          }}
        >
          <div className="-mx-4">
            <PlanetScreen
              embedded
              {...(requestedPlanetGroup ?? planetGroup
                ? { focusGroup: requestedPlanetGroup ?? planetGroup }
                : {})}
            />
          </div>
        </Sheet>
      )}

      {panel === 'menu' && (
        <Sheet
          eyebrow={t('galaxy.panelCommanderEyebrow')}
          title={commander}
          onClose={() => {
            onPanel(null);
          }}
        >
          <MenuPanel
            galaxy={season.data?.shardName ?? null}
            shard={season.data?.shard ?? null}
            endsAt={season.data?.endsAt ?? null}
            ended={season.data?.status === 'frozen'}
            hasSeasonResult={recapResult != null}
            rival={planets.find((world) => world.id === season.data?.rivalPlanetId) ?? null}
            rivalLost={season.data?.rivalPlanetId != null && !planets.some((world) => world.id === season.data?.rivalPlanetId)}
            onFocusRival={() => {
              const rival = planets.find((world) => world.id === season.data?.rivalPlanetId);
              if (!rival) return;
              onPanel(null);
              focusPlanet(rival.id);
            }}
            onClearRival={() => {
              setRival.mutate(null, {
                onSuccess: () => { say(t('menu.rivalCleared')); },
                onError: (error) => { say(describe(error), 'error'); },
              });
            }}
            onOpen={onPanel}
            onSignOut={onSignOut}
          />
        </Sheet>
      )}

      {panel === 'rewards' && (
        <Sheet
          eyebrow={t('rewards.eyebrow')}
          title={t('rewards.title')}
          onClose={() => {
            onPanel(null);
          }}
        >
          <div className="-mx-4 px-4">
            <RewardsScreen commander={commander} />
          </div>
        </Sheet>
      )}

      {panel === 'leaderboard' && (
        <Sheet
          eyebrow={t('leaderboard.eyebrow')}
          title={t('leaderboard.title')}
          onClose={() => {
            onPanel(null);
          }}
        >
          <div className="-mx-4">
            <LeaderboardScreen
              onFocusPlanet={(planetId) => {
                onPanel(null);
                focusPlanet(planetId);
              }}
            />
          </div>
        </Sheet>
      )}

      {showChat && panel === 'chat' && (
        <Sheet
          contained
          eyebrow={t('chat.eyebrow')}
          title={t('chat.title')}
          onClose={() => {
            onPanel(null);
          }}
        >
          <div className="-mx-4 h-full">
            <ChatScreen
              onFocusPlanet={(planetId) => {
                onPanel(null);
                focusPlanet(planetId);
              }}
            />
          </div>
        </Sheet>
      )}

      {showChat && panel === 'chronicle' && (
        <Sheet
          eyebrow={t('chronicle.eyebrow')}
          title={t('chronicle.title')}
          onClose={() => { onPanel(null); }}
        >
          <div className="-mx-4 px-4">
            <ChronicleScreen
              focusablePlanetIds={planets.map((candidate) => candidate.id)}
              onFocusPlanet={(planetId) => {
                if (planetId === planet.data?.planet.id) {
                  onPanel('planet');
                  return;
                }
                onPanel(null);
                focusPlanet(planetId);
              }}
            />
          </div>
        </Sheet>
      )}

      {panel === 'intel' && (
        <Sheet
          eyebrow={t('galaxy.panelIntelEyebrow')}
          title={t('galaxy.panelIntelTitle')}
          onClose={() => {
            onPanel(null);
          }}
        >
          <div className="-mx-4">
            <IntelScreen
              onOpenOrbit={() => {
                setRequestedPlanetGroup('orbit');
                onPanel('planet');
              }}
            />
          </div>
        </Sheet>
      )}

      {panel === 'recap' && recapResult && (
        <SeasonRecap
          result={recapResult}
          galaxy={season.data?.result
            ? (season.data.shardName ?? season.data.shard)
            : (pastResult?.shardName ?? '')}
          {...(season.data?.result ? { players: season.data.players } : {})}
          {...(season.data?.endsAt ? { endsAt: season.data.endsAt } : {})}
          onClose={() => {
            onPanel(null);
          }}
        />
      )}


      {panel !== 'recap' && attacking && selected && planet.data && (
        // Marked for the onboarding gate (D56): it is opened BY a gated control,
        // so sealing it would trap the player inside the commitment they were
        // told to make.
        <div data-launch-sheet>
        <LaunchSheet
          target={selected}
          planet={planet.data}
          onClose={() => {
            setAttacking(false);
          }}
          onLaunched={() => {
            close();
            setAwaiting({ kind: 'outbound', targetName: selected.name });
          }}
        />
        </div>
      )}

      {panel !== 'recap' && transferTargetId && planet.data && (() => {
        const target = galaxy.data?.planets.find((world) => world.id === transferTargetId);
        return target ? (
          <TransferSheet
            target={target}
            planet={planet.data}
            onClose={() => { setTransferTargetId(null); }}
            onLaunched={() => {
              setTransferTargetId(null);
              close();
            }}
          />
        ) : null;
      })()}

      {covered && (
        <LoadingScreen
          caption={
            !dataSettled
              ? t('loading.sweeping')
              : !assets.ready
                ? t('loading.charting')
                : t('loading.raising')
          }
          {...(dataSettled && !assets.ready ? { progress: assets.progress } : {})}
        />
      )}
    </div>
    </SeasonLockProvider>
  );
}

const windowsOpen = (planets: readonly { isSelf: boolean; fleet?: { status: string } }[]): number =>
  planets.filter((p) => !p.isSelf && p.fleet?.status === 'AWAY').length;

/**
 * The asteroid panel needs three things the panel itself should not compute:
 * how long the rock has left, whether your craft could catch it, and how many are
 * free to send. Gathered here so the panel stays a view.
 */
function AsteroidFocusHost({
  rock,
  runs,
  mining,
  seasonStart,
  homePosition,
  now,
  busy,
  open,
  onToggle,
  onClose,
  onSend,
}: {
  rock: AsteroidView | undefined;
  runs: readonly MiningRun[];
  mining: MiningView | undefined;
  seasonStart: Date;
  homePosition: { x: number; y: number; z: number } | undefined;
  now: number;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSend: (index: number, craft: number) => void;
}) {
  const planet = usePlanet();
  if (!rock) return null;

  const minutesLeft = minutesLeftFor(rock, seasonStart, now);
  const speed = mining?.craftSpeed ?? 0;

  /**
   * The real interception, solved with the same function the server uses.
   *
   * It used to be a straight-line guess to where the rock is NOW, which was close
   * enough on a slow one-way path and is badly wrong on a fast orbit — a rock can
   * be on the far side of its circle by the time a craft arrives. Running the
   * actual solver means the flight time shown is the flight time you get, and the
   * button is never offered for a trip the server would refuse.
   */
  /**
   * How much the works can still absorb. D31 — mined ore lands in the buffer, so
   * this is the ceiling that decides how much of a haul survives the trip home.
   */
  const p = planet.data?.planet;
  const worksRoom = p
    ? Math.max(0, p.bufferAlloyCap - p.bufferAlloy)
      + Math.max(0, p.bufferCrystalCap - p.bufferCrystal)
      + Math.max(0, p.bufferDeuteriumCap - p.bufferDeuterium)
    : 0;

  const minutesNow = (now - seasonStart.getTime()) / 60_000;
  const hit =
    homePosition && speed > 0
      ? interceptAsteroid(
          homePosition,
          speed,
          { ...rock, deuteriumShare: rock.deuteriumShare ?? 0 },
          minutesNow,
        )
      : null;
  const reach = hit ? hit.flightMinutes : null;

  return (
    <AsteroidFocus
      rock={rock}
      craftAvailable={planet.data?.fleet.PROSPECTOR ?? 0}
      craftHold={mining?.craftHold ?? 0}
      derrick={mining?.derrick ?? false}
      derrickHold={mining?.derrickHold ?? 0}
      minutesLeft={minutesLeft}
      reachMinutes={reach}
      worksRoom={worksRoom}
      run={runs.find((r) => r.asteroidIndex === rock.index && r.status !== 'done')}
      onClose={onClose}
      busy={busy}
      open={open}
      onToggle={onToggle}
      onSend={(craft) => {
        onSend(rock.index, craft);
      }}
    />
  );
}

/**
 * A wreck field, and what it would take to go and get it. D32.
 *
 * A field does not move, so this is a plain flight to a fixed point — no
 * interception solve, unlike a rock. Everything else is the asteroid host's shape,
 * because to the player it is the same kind of decision.
 */
function DebrisFocusHost({
  field,
  planets,
  runs,
  mining,
  homePosition,
  busy,
  open,
  onToggle,
  onClose,
  onSend,
}: {
  field: {
    id: string;
    planetId: string;
    alloy: number;
    crystal: number;
    deuterium: number;
    minutesLeft: number;
  } | undefined;
  planets: readonly { id: string; name: string; position: { x: number; y: number; z: number } }[];
  runs: readonly MiningRun[];
  mining: MiningView | undefined;
  homePosition: { x: number; y: number; z: number } | undefined;
  busy: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSend: (fieldId: string, craft: number) => void;
}) {
  const planetQuery = usePlanet();
  if (!field) return null;

  const at = planets.find((p) => p.id === field.planetId);
  const speed = mining?.craftSpeed ?? 0;
  const reach =
    homePosition && at && speed > 0
      ? travelMinutes(distance(homePosition, at.position), speed)
      : null;

  const p = planetQuery.data?.planet;
  const worksRoom = p
    ? Math.max(0, p.bufferAlloyCap - p.bufferAlloy)
      + Math.max(0, p.bufferCrystalCap - p.bufferCrystal)
      + Math.max(0, p.bufferDeuteriumCap - p.bufferDeuterium)
    : 0;

  return (
    <DebrisFocus
      field={field}
      planetName={at?.name}
      craftAvailable={planetQuery.data?.fleet.PROSPECTOR ?? 0}
      craftHold={mining?.craftHold ?? 0}
      reachMinutes={reach}
      worksRoom={worksRoom}
      run={runs.find((r) => r.debrisFieldId === field.id && r.status !== 'done')}
      busy={busy}
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      onSend={(craft) => {
        onSend(field.id, craft);
      }}
    />
  );
}
