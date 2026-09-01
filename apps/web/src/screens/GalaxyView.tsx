import { SeasonLockProvider } from '../session/seasonLock.js';
import { NextSeason } from '../ui/NextSeason.js';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  miningSceneData,
  useGalaxy,
  useIntel,
  useHarvest,
  useMine,
  useFleetArrivals,
  useMining,
  useMiningArrivals,
  usePending,
  usePlanet,
  useClanBadge,
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
import { threadKey } from '../galaxy/threadKey.js';
import type { PlanetGroup } from '../lib/directives.js';
import { haptic } from '../lib/haptics.js';
import { serverNow } from '../lib/clock.js';
import { minutesLeft, useNow } from '../lib/time.js';
import { distance, engagementEndsAt, interceptAsteroid, travelMinutes } from '@astera/rules';
import { LaunchSheet } from './LaunchSheet.jsx';
import { SettlementSheet } from './SettlementSheet.js';
import { TransferSheet } from './TransferSheet.js';
import { WorldsPanel } from './WorldsPanel.js';
import { DiscControls } from '../galaxy/DiscControls.js';
import { PlanetScreen, TAB_OF } from './PlanetScreen.jsx';
import { ResearchPanel } from './ResearchPanel.js';
import { IntelScreen } from './IntelScreen.jsx';
import { RewardsScreen } from './RewardsScreen.jsx';
import { AnnouncementsScreen } from './AnnouncementsScreen.js';
import { FeedbackScreen } from './FeedbackScreen.js';
import { MenuPanel } from '../shell/MenuPanel.jsx';
import { LeaderboardScreen } from './LeaderboardScreen.jsx';
import { ChatScreen } from './ChatScreen.jsx';
import { ChatLauncher, type ChatChannel } from './ChatLauncher.jsx';
import { ChronicleLauncher } from './ChronicleLauncher.jsx';
import { ChronicleScreen } from './ChronicleScreen.jsx';
import { Sheet, Waiting } from '../ui/kit/index.js';
import { describe, useToast } from '../ui/Toast.js';
import { GALAXY_ASSETS, usePreload } from '../lib/preload.js';
import { LoadingScreen } from '../shell/LoadingScreen.js';
import { useArrivals } from '../session/useArrivals.js';
import { DiscReadout } from './DiscReadout.jsx';
import { SensorToggles } from '../galaxy/SensorToggles.jsx';
import {
  SeasonRecap,
  seasonRecapShowsPrimaryAction,
  useSeasonRecapOpening,
} from './SeasonRecap.jsx';
import { ApiError } from '../api/client.js';
import { useWorld } from '../api/world.js';
import {
  asteroidVisualSeed,
  controlledWorldId,
  runForPlanetTarget,
} from '../galaxy/scene.js';
import {
  focusTapDecision,
  planetFocusRailVisible,
  transferOriginForFocus,
} from '../galaxy/follow.js';
import {
  reconcileOwnCraft,
  reconcileOwnInterceptionImpacts,
  reconcileOwnInterceptions,
  type CraftFocus,
} from '../galaxy/ownCraft.js';
import type { ReachRing } from '../galaxy/SensorRings.jsx';
import { planetsWithClanPresence } from '../galaxy/clanPresence.js';

/** Clan command is a large, infrequent room; keep it out of the first galaxy bundle. */
/**
 * The empty sensor list, once. See the note at its use: this screen rerenders on a
 * clock, so a literal `[]` in the render body is a new prop every second.
 */
const NO_SENSORS: readonly ReachRing[] = [];

const ClanScreen = lazy(async () => {
  const module = await import('./ClanScreen.jsx');
  return { default: module.ClanScreen };
});

/** Tiptap is admin-only and must not enter every commander's first galaxy bundle. */
const AdminPanel = lazy(async () => import('./AdminPanel.js'));

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
 * if it moves — while the second tap on that same object opens its detail. For a
 * world the commander controls, that second tap opens management instead.
 */

export type Panel = 'planet' | 'research' | 'intel' | 'leaderboard' | 'clan' | 'chat' | 'chronicle' | 'rewards' | 'announcements' | 'feedback' | 'admin' | 'recap' | 'menu' | null;

/**
 * WHICH SHELF INSIDE A PANEL, WHEN THE PANEL ALONE IS NOT AN ANSWER. D121.
 *
 * A panel is a place; the Intel centre holds two lists in it, and "a battle
 * report arrived" pointed at the place and dropped the reader on the other one.
 * Only `intel` has shelves today, so this is deliberately its two tabs and not a
 * general routing scheme nobody has asked for.
 */
export type PanelStop = 'probes' | 'battles';

export function GalaxyView({
  panel,
  onPanel,
  panelStop,
  focusRequest,
  craftFocusRequest,
  commander,
  isAdmin = false,
  pastResult,
  onSignOut,
  onPlacementLost,
  onFocused,
  planetGroup,
  openWide,
  wideDistance,
  allowFocus,
  goHome,
  showChat = true,
}: {
  /** Opened from the header, which is the only chrome left outside the canvas. */
  panel: Panel;
  onPanel: (panel: Panel) => void;
  /**
   * Which shelf the panel should open on, with a counter so the same one twice
   * still lands — a second battle notification must not be swallowed because the
   * Intel centre is already showing battles and the reader has since moved off it.
   */
  panelStop?: { stop: PanelStop; request: number; reportMissionId?: string } | null;
  /** A route from an already-revealed identity back to its world. */
  focusRequest?: { planetId: string; request: number } | null;
  /** A route from the permanent in-flight sheet to a craft already on the disc. */
  craftFocusRequest?: { focus: CraftFocus; request: number } | null;
  /** Who is signed in. Shown on the one surface that is about you rather than the world. */
  commander: string;
  /** Operations access comes from the server's out-of-band username allow-list. */
  isAdmin?: boolean;
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
  /** Exact range for a scripted wide re-frame; used by the rehearsal's neighbourhood beat. */
  wideDistance?: number;
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
  const { activePlanetId, capitalPlanetId, worlds, selectPlanet } = useWorld();
  // The clan mark on the disc needs to know whether there is a clan layer at all,
  // and whether anything is waiting inside it. Same read the menu row used.
  const clanBadge = useClanBadge();
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
  useMiningArrivals(mining.statusData?.runs);
  useFleetArrivals(pending.data?.pending);
  /**
   * AND ASK FOR THE NEXT BEARING WINDOW WHEN THE CURRENT ONE RUNS OUT.
   *
   * A stranger's craft is drawn inside a published window; when it ends the client
   * has no more motion to interpolate and coasts on a guess. This asks for the next
   * one, and — unlike a real arrival — it refetches `traffic` and nothing else,
   * because nothing else can have changed. See `useContactWindows`.
   */
  /**
   * ONE ARRAY IDENTITY, BECAUSE THIS SCREEN RERENDERS ON A CLOCK. D53.
   *
   * `?? []` here minted a fresh empty array every render whenever the server had
   * not sent any — which re-ran the crossing solve and handed `GalaxyCanvas` a new
   * prop each tick, the exact rebuild the stable-prop rule exists to stop. A
   * module-level empty is the same array for ever.
   */
  const sensors = galaxy.data?.sensors ?? NO_SENSORS;
  useContactWindows(traffic.data?.contacts, sensors);

  const [focus, setFocus] = useState<Focus | null>(null);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  /** The world that was active before focusing another controlled world. */
  const [transferOriginId, setTransferOriginId] = useState<string | null>(null);
  const [worldsOpen, setWorldsOpen] = useState(false);
  /**
   * WHETHER THE BOUNDARIES ARE DRAWN AT ALL. Owner instruction, third version.
   *
   * IT WAS A SET OF WORLDS AND IT IS NOW ONE FLAG EACH, and the history is worth
   * the paragraph because both earlier versions were reported as bugs.
   *
   *   1. ONE FLAG FOR THE WHOLE GALAXY, when only the ACTIVE world's radar was
   *      ever drawn. Pressing the telescope hid four shells and pressing the radar
   *      hid one — two adjacent switches with two different reaches.
   *   2. A SET KEYED BY WORLD, which fixed that by making each switch act on the
   *      active world alone. It was consistent and it was not what anybody wanted:
   *      a player who takes the glass off does not mean "off here", they mean off.
   *
   * So the switch is global again, and the thing that made version 1 wrong is
   * fixed at the other end instead — the radar now draws for EVERY world that has
   * one, so both switches cover the same ground. One press, every world.
   *
   * BOTH START OFF. They used to start drawn, on the reasoning that nobody should
   * have to discover the boundaries by finding a switch. The owner's call is the
   * other way: the galaxy is the subject, and the instruments are something you
   * ask for. `SensorToggles` keeps its struck-through glyph precisely so an unlit
   * switch reads as "off", not as "missing".
   *
   * SESSION STATE, NOT STORAGE. Reloading starts clean, which is the same answer
   * as "both start off" — there is no remembered preference to be surprised by.
   */
  const [showTelescopeReach, setShowTelescopeReach] = useState(false);
  const [showRadarReach, setShowRadarReach] = useState(false);
  /**
   * THE RADAR SWITCH ONLY EXISTS IF THERE IS A RADAR. Owner instruction.
   *
   * A telescope switch is always meaningful — the naked-eye neighbourhood is free
   * and every commander has one — but a radar circle is hardware, and a control
   * that draws nothing when pressed teaches that the pair is decorative. `detect`
   * is above zero exactly when a world is running a working, Uplink-gated Radar,
   * so this asks the same question the drawing does.
   */
  const hasRadar = sensors.some((post) => post.detect > 0);

  /**
   * Whether the focus rail is expanded. Reset to closed on every new selection —
   * a panel that stayed open as the player swept from world to world would undo
   * the whole point of it opening closed.
   */
  const [detail, setDetail] = useState(false);
  const [attacking, setAttacking] = useState(false);
  const [settlingTargetId, setSettlingTargetId] = useState<string | null>(null);
  const [homeSignal, setHomeSignal] = useState(0);
  const [chatChannel, setChatChannel] = useState<ChatChannel>('general');
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
    setTransferOriginId(null);
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

  const planets = useMemo(() => planetsWithClanPresence(galaxy.data), [galaxy.data]);
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
  const miningScene = useMemo(
    () => miningSceneData(mining.fieldData, mining.statusData),
    [mining.fieldData, mining.statusData],
  );
  const asteroids = miningScene.asteroids;
  const runs = miningScene.runs;
  const wrecks = miningScene.debris;
  const threads = useMemo(() => pending.data?.pending ?? [], [pending.data]);
  const contacts = useMemo(() => traffic.data?.contacts ?? [], [traffic.data]);
  const interceptions = useMemo(() => traffic.data?.interceptions ?? [], [traffic.data]);
  const interceptionImpacts = useMemo(
    () => traffic.data?.interceptionImpacts ?? [],
    [traffic.data],
  );
  const controlledPlanetIds = useMemo(
    () => new Set(planets.filter((world) => world.isOwned).map((world) => world.id)),
    [planets],
  );

  /**
   * FOLLOW EVERY NEW OWNED CRAFT, not a list of launch buttons.
   *
   * `reconcileOwnCraft` recognises payload capabilities — a pending row with a
   * path, or a live mining run — so Death Stars, probes and future vehicle kinds
   * all take the same route. The first complete payload is only a baseline: opening
   * the game must never snap the camera onto something launched yesterday.
   */
  const seenOwnCraft = useRef<ReadonlySet<string> | null>(null);
  const ownCraftReady = pending.data !== undefined && mining.statusData !== undefined;
  useEffect(() => {
    if (!ownCraftReady) return;
    const result = reconcileOwnCraft(seenOwnCraft.current, threads, runs);
    seenOwnCraft.current = result.seen;
    if (!result.focus) return;
    setFocus(result.focus);
    setTransferOriginId(null);
    setDetail(false);
    setAttacking(false);
  }, [ownCraftReady, runs, threads]);

  /**
   * An interceptor is not a pending mission: it lives for eight seconds in the
   * participant/Telescope traffic projection. Focus a newly appearing one only
   * when its defended target is one of this commander's worlds. That includes a
   * colony without changing the active management world, and excludes the enemy
   * battery that happens to destroy this commander's outgoing Death Star.
   */
  const seenOwnInterceptions = useRef<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (traffic.data === undefined || galaxy.data === undefined) return;
    const result = reconcileOwnInterceptions(
      seenOwnInterceptions.current,
      interceptions,
      controlledPlanetIds,
      serverNow(),
    );
    seenOwnInterceptions.current = result.seen;
    if (!result.focus) return;
    setFocus(result.focus);
    setTransferOriginId(null);
    setDetail(false);
    setAttacking(false);
  }, [controlledPlanetIds, galaxy.data, interceptions, traffic.data]);

  /**
   * If the short launch scene was missed, centre the defending commander on the
   * collision when its public effect arrives. Attackers and witnesses retain
   * their camera. The distinct collision focus also closes the race where launch
   * focus was recorded but its short traffic row vanished before the rig read it.
   */
  const seenOwnInterceptionImpacts = useRef<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (traffic.data === undefined) return;
    const result = reconcileOwnInterceptionImpacts(
      seenOwnInterceptionImpacts.current,
      interceptionImpacts,
    );
    seenOwnInterceptionImpacts.current = result.seen;
    if (!result.focus) return;
    setFocus(result.focus);
    setTransferOriginId(null);
    setDetail(false);
    setAttacking(false);
  }, [interceptionImpacts, traffic.data]);

  const handledCraftFocusRequest = useRef<number | null>(null);
  useEffect(() => {
    if (
      !craftFocusRequest
      || handledCraftFocusRequest.current === craftFocusRequest.request
    ) return;
    const requested = craftFocusRequest.focus;
    const exists = requested.kind === 'run'
      ? runs.some((run) => run.id === requested.id && run.status !== 'done')
      : threads.some((thread, index) => threadKey(thread, index) === requested.key && thread.path);
    if (!exists) return;
    handledCraftFocusRequest.current = craftFocusRequest.request;
    setFocus(requested);
    setTransferOriginId(null);
    setDetail(false);
    setAttacking(false);
  }, [craftFocusRequest, runs, threads]);

  /**
   * EVERY PROP THE DISC TAKES IS STABLE. D53.
   *
   * This component holds a clock, so it re-renders on a timer whether or not
   * anything about the galaxy has changed. That is meant to be free — React
   * reconciles, nothing below it sees a changed prop, nothing is rebuilt.
   *
   * `contacts` is memoised for the same reason rather than because it churns —
   * React Query's structural sharing keeps it stable while the payload is
   * unchanged, but only while `traffic.data` is DEFINED; the `?? []` fallback
   * before the first fetch was a fresh array each time.
   */
  const onReady = useCallback(() => {
    setDrawn(true);
  }, []);
  const onFocus = useCallback(
    (next: Focus | null) => {
      if (next) haptic('tap');
      const ownedId = next?.kind === 'planet' ? controlledWorldId(planets, next.id) : null;
      const decision = focusTapDecision(focus, next, ownedId);
      if (decision.kind === 'manage') {
        selectPlanet(decision.planetId);
        setFocus(null);
        setTransferOriginId(null);
        setDetail(false);
        setAttacking(false);
        onPanel('planet');
        onFocused?.(next);
        return;
      }
      if (ownedId !== null) {
        // Selecting the target as active is immediate, but "transfer here" still
        // originates at the world that was active when this focus began.
        setTransferOriginId(transferOriginForFocus(activePlanetId, ownedId));
        selectPlanet(ownedId);
      } else {
        setTransferOriginId(null);
      }
      setFocus(decision.focus);
      setDetail(decision.detail);
      setAttacking(false);
      onFocused?.(next);
    },
    [activePlanetId, focus, onFocused, onPanel, planets, selectPlanet],
  );
  const focusPlanet = useCallback(
    (planetId: string) => {
      const target = planets.find((candidate) => candidate.id === planetId);
      if (!target) return;
      const next: Focus = { kind: 'planet', id: planetId };
      const ownedId = controlledWorldId(planets, planetId);
      if (ownedId !== null) {
        setTransferOriginId(transferOriginForFocus(activePlanetId, ownedId));
        selectPlanet(ownedId);
      } else {
        setTransferOriginId(null);
      }
      setFocus(next);
      setDetail(false);
      setAttacking(false);
      onFocused?.(next);
    },
    [activePlanetId, onFocused, planets, selectPlanet],
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
  const transferOrigin = transferOriginId === null
    ? undefined
    : worlds.find((world) => world.planet.id === transferOriginId);
  const focusedPlanet = selected?.isOwned && transferOrigin ? transferOrigin : planet.data;
  const showPlanetFocus = selected
    ? planetFocusRailVisible(selected.isOwned === true, transferOriginId)
    : false;
  const settlementInFlight = selected !== undefined && threads.some((thread) =>
    thread.kind === 'settlement'
    && thread.leg === 'outbound'
    && thread.targetPlanetId === selected.id);

  const close = (): void => {
    setFocus(null);
    setTransferOriginId(null);
    setDetail(false);
    setAttacking(false);
    setSettlingTargetId(null);
  };

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
        interceptions={interceptions}
        interceptionImpacts={interceptionImpacts}
        asteroids={asteroids}
        runs={runs}

        wrecks={wrecks}
        sensors={sensors}
        showTelescopeReach={showTelescopeReach}
        showRadarReach={showRadarReach}
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
        {...(wideDistance !== undefined ? { wideDistance } : {})}
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
        <div className="pointer-events-none flex min-w-0 flex-col items-start">
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
          THE TWO INSTRUMENTS' OWN SWITCHES, UNDER THE CAPTION THAT NAMES THE DISC.
          Owner instruction. They are wrapped with the readout rather than dropped
          into the `DiscControls` grid opposite, because that grid is four ways OFF
          the disc and these two go nowhere — see `SensorToggles`.
        */}
        {/*
          NO ACTIVE WORLD, NO SWITCHES. Both act on the active world alone, so
          without one they would be two controls that do nothing when pressed —
          which teaches that the pair is decorative.
        */}
        <SensorToggles
          telescope={showTelescopeReach}
          onToggleTelescope={() => { setShowTelescopeReach((on) => !on); }}
          {...(hasRadar
            ? {
                radar: showRadarReach,
                onToggleRadar: () => { setShowRadarReach((on) => !on); },
              }
            : {})}
        />
        </div>

        {/*
          THREE MARKS RATHER THAN A WORD, and two of them came out of the menu.

          A labelled button in the corner of a map reads as browser chrome — the
          owner's note was that it "looks like a home page" — so the worlds glyph
          has been a mark at low opacity since D132. Research and the clan are two
          more things a commander DOES rather than looks up, and behind a hamburger
          a player who never opened that sheet never learned the game had them.

          See `DiscControls` for why the order is fixed and why nothing is painted.
        */}
        <DiscControls
          onOpenResearch={() => { onPanel('research'); }}
          onOpenClan={() => { onPanel('clan'); }}
          onOpenIntel={() => { onPanel('intel'); }}
          onOpenWorlds={() => { setWorldsOpen(true); }}
          clanAvailable={clanBadge.data?.available ?? false}
          clanWaiting={clanBadge.data?.attentionCount ?? 0}
        />
      </div>

      {showChat && (
        <>
          <ChronicleLauncher onOpen={() => { onPanel('chronicle'); }} />
          <ChatLauncher
            onOpen={(channel) => {
              setChatChannel(channel);
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

      {focus?.kind === 'planet' && selected && focusedPlanet && showPlanetFocus && !attacking && (
        <PlanetFocus
          target={selected}
          planet={focusedPlanet}
          intel={intel.data}
          reports={reports.data?.reports ?? []}
          rival={reports.data?.rivals.find((rival) =>
            selected.controller?.kind === 'PLAYER'
              ? rival.playerId === selected.controller.playerId
              : rival.planetId === selected.id)}
          isRival={
            (season.data?.rivalPlayerId != null
              && selected.controller?.kind === 'PLAYER'
              && selected.controller.playerId === season.data.rivalPlayerId)
            || (season.data?.rivalPlayerId == null
              && season.data?.rivalPlanetId === selected.id)
          }
          rivalCommitted={season.data?.rivalCommitted ?? false}
          now={now}
          settlementInFlight={settlementInFlight}
          onClose={close}
          onLaunched={() => {
            close();
          }}
          onAttack={() => {
            setAttacking(true);
          }}
          {...(transferOrigin ? {
            onTransfer: () => {
              setTransferTargetId(selected.id);
            },
          } : {})}
          /*
            A DISPATCH TOAST NAMES ITS DESTINATION, AND AN UNSURVEYED WORLD HAS NO
            NAME TO GIVE IT. D127. Both of these controls can now be reached on a
            world the caller cannot see — the settlement because a live claim
            window survives the fog (D112), the strike because there is no
            development gate left to stop it — so both had to stop assuming the
            payload carried a name.
          */
          onSettle={() => {
            setSettlingTargetId(selected.id);
          }}
          onDeathStar={() => {
            deathStar.mutate(selected.id, {
              onSuccess: () => {
                say(t('galaxy.deathStarAway', {
                  world: selected.intel === 'UNKNOWN'
                    ? t('focus.planet.unsurveyedTitle')
                    : selected.name,
                }));
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
          field={wrecks.find((d) => d.id === focus.id)}
          planets={planets}
          runs={runs}
          mining={miningScene.mining}
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
          rock={asteroids.find((a) => a.id === focus.id)}
          runs={runs}
          mining={miningScene.mining}
          seasonStart={season.data.startsAt}
          homePosition={activeWorldPosition}
          now={now}
          busy={mine.isPending}
          open={detail}
          onToggle={toggle}
          onClose={close}
          onSend={(id, craft) => {
            mine.mutate(
              { asteroidId: id, craft },
              {
                onSuccess: (r) => {
                  say(
                    t('galaxy.miningAway', {
                      count: r.craft,
                      minutes: Math.round(r.flightMinutes),
                    }),
                  );
                  close();
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
           * `asteroidId` is null on a salvage run, so the rock lookup below can
           * only ever miss — and a miss is what `RunFocus` renders as "Rock has
           * passed". The field is the target, and it is in the same payload.
           */
          const field =
            run.debrisFieldId === null
              ? undefined
              : wrecks.find((d) => d.id === run.debrisFieldId);
          return (
            <RunFocus
              run={run}
              rock={asteroids.find((a) => a.id === run.asteroidId)}
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
          // A public effect outside sensor reach is not a contact the commander
          // can inspect; a stale focus may survive the boundary-crossing refetch.
          if (!contact || contact.effectOnly === true) return null;
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
          bleed
          eyebrow={planet.data.planet.name}
          title={commander}
          onClose={() => {
            onPanel(null);
          }}
        >
          <PlanetScreen
            embedded
            onOpenResearch={() => {
              onPanel('research');
            }}
            {...(requestedPlanetGroup ?? planetGroup
              ? { focusGroup: requestedPlanetGroup ?? planetGroup }
              : {})}
          />
        </Sheet>
      )}

      {/*
        RESEARCH. Its own panel because the levels are the COMMANDER's since T7, and
        `PlanetScreen` is about one world. `onNeed` is what carries a refusal back
        to the surface that can answer it: the only build gate research has is the
        Command Core, and the Core is on the planet sheet.
      */}
      {panel === 'research' && (
        <Sheet
          eyebrow={t('research.eyebrow')}
          title={t('research.title')}
          onClose={() => {
            onPanel(null);
          }}
        >
          <ResearchPanel
            onNeed={(id) => {
              onPanel('planet');
              setRequestedPlanetGroup(TAB_OF[id] ?? 'grow');
            }}
          />
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
            isAdmin={isAdmin}
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
          <RewardsScreen commander={commander} />
        </Sheet>
      )}

      {panel === 'leaderboard' && (
        <Sheet
          bleed
          eyebrow={t('leaderboard.eyebrow')}
          title={t('leaderboard.title')}
          onClose={() => {
            onPanel(null);
          }}
        >
          <LeaderboardScreen
            onFocusPlanet={(planetId) => {
              onPanel(null);
              focusPlanet(planetId);
            }}
          />
        </Sheet>
      )}

      {panel === 'announcements' && (
        <Sheet
          eyebrow={t('community.announcements.eyebrow')}
          title={t('community.announcements.title')}
          onClose={() => { onPanel(null); }}
        >
          <AnnouncementsScreen />
        </Sheet>
      )}

      {panel === 'feedback' && (
        <Sheet
          eyebrow={t('community.feedback.eyebrow')}
          title={t('community.feedback.title')}
          onClose={() => { onPanel(null); }}
        >
          <FeedbackScreen />
        </Sheet>
      )}

      {isAdmin && panel === 'admin' && (
        <Sheet
          contained
          bleed
          eyebrow={t('community.admin.eyebrow')}
          title={t('community.admin.title')}
          onClose={() => { onPanel(null); }}
        >
          <Suspense fallback={<Waiting>{t('community.admin.title')}</Waiting>}>
            <AdminPanel />
          </Suspense>
        </Sheet>
      )}

      {panel === 'clan' && (
        <Sheet
          contained
          bleed
          eyebrow={t('clan.outside.eyebrow')}
          title={t('clan.tabs.label')}
          onClose={() => { onPanel(null); }}
        >
          <div className="h-full overflow-y-auto overscroll-contain">
            <Suspense fallback={<Waiting>{t('clan.waiting')}</Waiting>}>
              <ClanScreen />
            </Suspense>
          </div>
        </Sheet>
      )}

      {showChat && panel === 'chat' && (
        <Sheet
          contained
          bleed
          eyebrow={t('chat.eyebrow')}
          title={t('chat.title')}
          onClose={() => {
            onPanel(null);
          }}
        >
          <ChatScreen
            initialChannel={chatChannel}
            onFocusPlanet={(planetId) => {
              onPanel(null);
              focusPlanet(planetId);
            }}
          />
        </Sheet>
      )}

      {showChat && panel === 'chronicle' && (
        <Sheet
          eyebrow={t('chronicle.eyebrow')}
          title={t('chronicle.title')}
          onClose={() => { onPanel(null); }}
        >
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
        </Sheet>
      )}

      {panel === 'intel' && (
        <Sheet
          bleed
          eyebrow={t('galaxy.panelIntelEyebrow')}
          title={t('galaxy.panelIntelTitle')}
          onClose={() => {
            onPanel(null);
          }}
        >
          <IntelScreen
            {...(panelStop ? { open: panelStop } : {})}
            onOpenOrbit={() => {
              setRequestedPlanetGroup('orbit');
              onPanel('planet');
            }}
          />
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
          showPrimaryAction={seasonRecapShowsPrimaryAction(season.data)}
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
          }}
        />
        </div>
      )}

      {panel !== 'recap'
        && settlingTargetId !== null
        && selected?.id === settlingTargetId
        && focusedPlanet && (
        <SettlementSheet
          target={selected}
          planet={focusedPlanet}
          now={now}
          pending={settlement.isPending}
          onClose={() => { setSettlingTargetId(null); }}
          onConfirm={() => {
            settlement.mutate(selected.id, {
              onSuccess: () => {
                say(t('galaxy.settlementAway', {
                  world: selected.intel === 'UNKNOWN'
                    ? t('focus.planet.unsurveyedTitle')
                    : selected.name,
                }));
                close();
              },
              onError: (error) => { say(describe(error), 'error'); },
            });
          }}
        />
      )}

      {panel !== 'recap' && worldsOpen && (
        <WorldsPanel
          worlds={worlds}
          activePlanetId={activePlanetId}
          capitalPlanetId={capitalPlanetId}
          onSelect={focusPlanet}
          onTransfer={(originPlanetId, targetPlanetId) => {
            /*
              THE ACTIVE WORLD DOES NOT MOVE, and neither does the camera subject
              acquire a new one. `close()` first because a focus rail left standing
              would keep reading its own origin out of the state this is about to
              overwrite; the later setters win in the same batch.
            */
            close();
            setTransferOriginId(originPlanetId);
            setTransferTargetId(targetPlanetId);
            setWorldsOpen(false);
          }}
          onCentre={(planetId) => {
            // Home is also the first semantic tap on the active world. The camera
            // instruction still wins this render, while keeping this focus means
            // the next direct world tap opens management instead of focusing it
            // for a second time.
            close();
            focusPlanet(planetId);
            setHomeSignal((n) => n + 1);
            setWorldsOpen(false);
          }}
          onClose={() => { setWorldsOpen(false); }}
        />
      )}

      {panel !== 'recap' && transferTargetId && transferOrigin && (() => {
        /**
         * YOUR OWN WORLD ANSWERS FOR ITSELF. Owner report: pressing "send here" on
         * a freshly settled colony closed the worlds sheet and opened nothing.
         *
         * The destination used to be looked up in `galaxy.data` — the PUBLIC disc
         * projection, which is fogged, shared across every commander on the shard,
         * and served from a replica-local cache invalidated by bus events. A world
         * that cache has not heard about yet is simply missing from it, and this
         * gate then rendered `null`: a button that does nothing, with nothing on
         * screen to say why, which is the failure D141 exists to stop.
         *
         * `worlds` comes from `/api/planets`, which takes an UPDATE lock and reads
         * the database inside the request. For a world the commander controls it
         * cannot be stale, and it already carries the id, the name and the position
         * this sheet needs. The disc payload stays as the fallback for a
         * destination that is not yours.
         */
        const owned = worlds.find((world) => world.planet.id === transferTargetId);
        const contact = planets.find((world) => world.id === transferTargetId);
        const target = owned
          ? {
              id: owned.planet.id,
              name: owned.planet.name,
              position: owned.planet.position,
            }
          : contact;
        return target ? (
          <TransferSheet
            target={target}
            targetPlanet={owned}
            planet={transferOrigin}
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
  onSend: (id: string, craft: number) => void;
}) {
  const planet = usePlanet();
  if (!rock) return null;

  const isotopeProject = planet.data?.research.find(
    (project) => project.id === 'ISOTOPE_SPECTROMETRY',
  );
  // Research is commander-wide. Prefer its explicit project state, while a
  // research-gated composition reading is also positive proof during a rolling
  // deploy or split-query refresh. Either proof is monotonic; absence of target
  // detail must not revoke a project the commander already completed.
  const isotopeAccess = (isotopeProject?.level ?? (isotopeProject?.completed ? 1 : 0)) > 0
    || rock.deuteriumShare !== null;

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
          {
            ...rock,
            index: asteroidVisualSeed(rock.id),
            deuteriumShare: rock.deuteriumShare ?? 0,
          },
          minutesNow,
        )
      : null;
  const reach = hit ? hit.flightMinutes : null;

  return (
    <AsteroidFocus
      rock={rock}
      isotopeAccess={isotopeAccess}
      craftAvailable={planet.data?.fleet.PROSPECTOR ?? 0}
      craftHold={mining?.craftHold ?? 0}
      derrick={mining?.derrick ?? false}
      derrickHold={mining?.derrickHold ?? 0}
      minutesLeft={minutesLeft}
      reachMinutes={reach}
      worksRoom={worksRoom}
      run={runForPlanetTarget(runs, p?.id, { kind: 'asteroid', id: rock.id })}
      onClose={onClose}
      busy={busy}
      open={open}
      onToggle={onToggle}
      onSend={(craft) => {
        onSend(rock.id, craft);
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
      run={runForPlanetTarget(runs, p?.id, { kind: 'debris', id: field.id })}
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
