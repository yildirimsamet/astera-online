import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ACADEMY_STEPS, academyCheckpoint, type AcademyStepId } from '@astera/rules';
import { Api } from '../api/client.js';
import { ApiProvider } from '../api/context.js';
import { keys } from '../api/keys.js';
import { GalaxyView, type Panel, type PanelStop } from '../screens/GalaxyView.jsx';
import { StatusBar } from '../shell/StatusBar.js';
import { Signals } from '../shell/Signals.js';
import { PendingStrip } from '../shell/PendingStrip.js';
import { serverNow } from '../lib/clock.js';
import { track } from '../lib/analytics.js';
import type { PlanetGroup } from '../lib/directives.js';
import { describeError } from '../i18n/errors.js';
import { academyFetch } from './academyFetch.js';
import { advanceAcademy, academyPlanet, completeAcademyLesson, openAcademy, type AcademyWorld } from './academyWorld.js';
import { ACADEMY_ROCK, ACADEMY_TARGET_ID } from './academyViews.js';
import { ClaimDialog } from './ClaimDialog.jsx';
import { TutorialHand } from './TutorialHand.jsx';
import { useSilenceToasts } from '../ui/Toast.js';
import { useGate, useScrollIntoView } from './Gate.jsx';
import { LaunchSheet } from '../screens/LaunchSheet.jsx';
import { usePirates, useGalaxy, useMining, usePlanet } from '../api/queries.js';
import { AsteroidFocus, type Focus } from '../galaxy/FocusPanel.jsx';
import type { PiratesView, GalaxyPlanet } from '../api/schemas.js';
import { academyGroup, AcademyLessonContext } from './lessonScope.js';
import { clearAcademy, restoreAcademy, saveAcademy } from './academyStorage.js';

/** D172. One local cache and API, discarded together on exit. Nothing in this
 * subtree receives the authenticated client or its token, including replay.
 */
export function Academy({ onClaim, onSignIn, onLeave, replay = false }: {
  onClaim: (username: string, password: string, step: number) => Promise<void>;
  onSignIn: () => void;
  onLeave: () => void;
  replay?: boolean;
}) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } }));
  const [world, setWorld] = useState(() => replay ? openAcademy(serverNow()) : restoreAcademy(serverNow()));
  const live = useRef(world);
  const write = useCallback((next: AcademyWorld) => {
    live.current = next;
    setWorld(next);
    if (!replay) saveAcademy(next);
    client.setQueryData(keys.planet, academyPlanet(next));
    void client.invalidateQueries();
  }, [client, replay]);
  const api = useMemo(() => new Api({ fetch: academyFetch(() => live.current, write) }), [write]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const before = live.current;
      const after = advanceAcademy(before, serverNow());
      if (after !== before) write(after);
      else if (after.flight) void client.invalidateQueries();
    }, 500);
    return () => { window.clearInterval(timer); client.clear(); };
  }, [client, write]);
  return <QueryClientProvider client={client}><ApiProvider api={api}>
    <AcademyScreen world={world} write={write} api={api} replay={replay}
      onClaim={async (username, password, step) => { await onClaim(username, password, step); if (!replay) clearAcademy(); }}
      onSignIn={onSignIn} onLeave={onLeave} />
  </ApiProvider></QueryClientProvider>;
}

const rows: Partial<Record<AcademyStepId, string>> = {
  core: 'CORE', refinery: 'REFINERY', extractor: 'EXTRACTOR', deuterium: 'DEUTERIUM_PLANT', foundry: 'FOUNDRY',
  uplink: 'UPLINK', radar: 'RADAR', veil: 'VEIL', vault: 'VAULT', aegis: 'AEGIS', thorn: 'THORN', bastion: 'BASTION',
  shipyard: 'SHIPYARD', hangar: 'HANGAR', darts: 'DART', reinforcements: 'DART', prospector: 'PROSPECTOR', courier: 'COURIER',
};
const menuFrom: Partial<Record<AcademyStepId, PlanetGroup>> = { production: 'grow', intel: 'grow', defend: 'orbit', fleet: 'defend' };

/**
 * WHERE THE HAND POINTS INSIDE A LAUNCH SHEET, IN ORDER. Owner instruction.
 *
 * FILL EVERY ROW, THEN COMMIT — and Max is the only gesture taught, because it is
 * the only one guaranteed to produce the fleet the lesson expects
 * (`academyLessonFleet`). Stepping a row by hand can land one ship short, and a
 * short fleet is refused by the Academy's own API with no toast to say so.
 *
 * `:not(:disabled)` IS THE SEQUENCER, and it costs nothing: `QuantityStepper`
 * disables Max the moment its row is full, so a filled row drops out of this
 * selector on its own and the hand walks to the next one. When every row is full
 * no Max matches at all and the list falls through to the commit button. There is
 * no counter and no state — the picker's own disabled flags are the progress.
 */
/**
 * WHAT IS PRESSABLE DURING A LESSON — AND THE CAMERA ALWAYS IS.
 *
 * `useGate` refuses a press by calling `stopPropagation` in a CAPTURE listener on
 * `document`, over a list that includes `pointerdown`. Its own docblock claims
 * orbiting still works. It does not: `OrbitControls` begins a drag on
 * `pointerdown` at the canvas, and a capture-phase stop means that listener is
 * never reached. So for every lesson where the canvas was not itself a target,
 * the galaxy was frozen — you could look at it and not turn it.
 *
 * THE CAMERA IS OPENED AND CLOSED DELIBERATELY, not left open. Owner instruction:
 * free when the ships leave, shut again the moment it would get in the way.
 *
 *   · WHILE A FLEET IS IN THE AIR (`busy`) it is free. The lesson is WAITING —
 *     nothing to press, no hand on screen — and the one thing a commander wants is
 *     to watch their ships go. The gate had nothing to protect there and was
 *     taking the whole galaxy away to protect it.
 *   · WHILE AIMING IT IS SHUT, and that is what makes the tap target work at all.
 *     The camera is flown onto the pirate, the rock or the world, which leaves the
 *     subject in the middle of the screen; `data-academy-tap-target` sits over
 *     that middle. A camera the player could turn would slide the subject out from
 *     under the very thing the hand is pointing at.
 *   · EVERYWHERE ELSE it stays shut, as it always was.
 */
export function academyGateSelectors(state: {
  claiming: boolean;
  intro: boolean;
  telescope: boolean;
  id: AcademyStepId;
  busy: boolean;
  isMenu: boolean;
  row: string | undefined;
}): readonly string[] {
  if (state.claiming || state.intro || state.telescope) return [];
  if (state.id === 'welcome') return ['canvas', '[data-academy-home]'];
  if (state.busy) return ['canvas'];
  if (state.isMenu) return [`[data-tab="${academyGroup(state.id)}"]`];
  if (state.id === 'telescope') return ['[data-sensor-toggle="telescope"]'];
  if (state.row) {
    return [`#row-${state.row}`, '[data-item-sheet]', '[data-build-sheet]',
      '[data-sheet-panel] [data-commit]', '[data-academy-launch]'];
  }
  return ['[data-academy-tap-target]', '[data-academy-launch]', '[data-academy-mining]',
    '[data-academy-signals]', '[data-sheet-panel]', '[data-signal-id]', '[data-battle-verdict]'];
}

/**
 * WHICH OF A SELECTOR'S MATCHES THE HAND POINTS AT.
 *
 * DRAWN AT ALL, AND THEN PREFERABLY ON SCREEN — in that order, and the order is
 * the fix. This used to require BOTH, and the second requirement quietly cancelled
 * the scroll that exists to satisfy it: the launch picker is taller than a phone,
 * the Courier's Max button sits below the fold, so it failed the on-screen test,
 * so it was never chosen as the hand's target, so `TutorialHand` never scrolled it
 * into view. The one control the lesson could not reach was the one control it
 * refused to point at.
 *
 * Size is still required — a `display:none` row has no business being a target.
 * Position is now only a PREFERENCE: among several live matches the one already on
 * screen wins, and when none is, the hand takes the first real one and the sheet is
 * scrolled to it.
 */
export function handPick(nodes: readonly Element[], viewportHeight: number): Element | null {
  const drawn = nodes.filter((candidate) => {
    const box = candidate.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
  const onScreen = drawn.findLast((candidate) => {
    const box = candidate.getBoundingClientRect();
    return box.bottom > 0 && box.top < viewportHeight;
  });
  return onScreen ?? drawn[0] ?? null;
}

export const LAUNCH_HAND_SELECTORS = [
  '[data-academy-launch] [data-count-max] button:not(:disabled)',
  '[data-academy-launch] [data-sheet-panel] > div:last-child button:last-child',
] as const;
const exercise = new Set<AcademyStepId>(['welcome', 'core', 'refinery', 'extractor', 'vault', 'aegis', 'shipyard', 'darts', 'prospector', 'reinforcements', 'courier', 'pirate', 'mine', 'raid', 'telescope']);

export function AcademyScreen({ world, write, api, onClaim, onSignIn, onLeave, replay }: {
  world: AcademyWorld; write: (world: AcademyWorld) => void; api: Api;
  onClaim: (username: string, password: string, step: number) => Promise<void>;
  onSignIn: () => void; onLeave: () => void; replay: boolean;
}) {
  useSilenceToasts();
  const { t } = useTranslation();
  const [panel, setPanel] = useState<Panel>(null);
  const [stop, setStop] = useState<{ stop: PanelStop; request: number; reportMissionId?: string } | null>(null);
  const [claiming, setClaiming] = useState(world.step === ACADEMY_STEPS.length && !replay);
  const [problem, setProblem] = useState<string>();
  const [nudge, setNudge] = useState(0);
  const [telescope, setTelescope] = useState(false);
  const [launch, setLaunch] = useState(false);
  /**
   * THE LESSON LOOKS AT THE TARGET BEFORE IT ASKS FOR A FLEET. Owner instruction.
   *
   * "Show the target" used to open the launch sheet outright, so the commander was
   * asked to commit ships at a world, a rock or a pirate they had never actually
   * SEEN. Now it flies the camera onto the subject with no rail over it
   * (`coachFocus`), the hand points at what is now in the middle of the screen, and
   * the sheet opens when they tap it.
   */
  const [aim, setAim] = useState(0);
  /**
   * WHETHER THIS LESSON IS CURRENTLY AIMED — kept apart from the counter above,
   * and that separation IS the fix.
   *
   * `aim` was doing both jobs and was reset to zero on every step change, so the
   * first "Show the target" of every lesson issued request 1. `GalaxyView` guards
   * its coach focus with `handled === request`, had already spent request 1 on the
   * pirate, and silently declined to move the camera for the asteroid. The beat
   * asked for a move the disc believed it had already made.
   *
   * `aim` is now monotonic for the life of the Academy — the same shape as
   * `homeSignal` and `focusRequest` — and this boolean carries the per-step state.
   */
  const [aimed, setAimed] = useState(false);
  const bubble = useRef<HTMLElement>(null);
  const step = ACADEMY_STEPS[world.step] ?? ACADEMY_STEPS[ACADEMY_STEPS.length - 1]!;
  const id = step.id;
  const row = rows[id];
  const busy = world.pending !== null || world.flight !== null;
  const isReport = id === 'pirateReport' || id === 'raidReport';
  const isMenu = id in menuFrom;
  const intro = !exercise.has(id) && !isMenu && !isReport && !('reward' in step);
  const latest = useRef({ world, id, busy, row, claiming, intro, isMenu, telescope, panel, isReport });
  latest.current = { world, id, busy, row, claiming, intro, isMenu, telescope, panel, isReport };
  const targets = useCallback((): Element[] => {
    const selectors = academyGateSelectors(latest.current);
    return selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
  }, []);
  const handTargets = useCallback((): Element[] => {
    const state = latest.current;
    if (state.busy || state.claiming || state.telescope) return [];
    const selectors = [
      '[data-academy-tap-target]',
      ...(state.id === 'welcome' ? ['[data-academy-home]'] : []),
      ...(state.isReport && state.panel === 'report' ? ['[data-sheet-panel] > header > button'] : []),
      ...(state.isMenu ? [`[data-tab="${academyGroup(state.id)}"]`] : []),
      '[data-reward-claim] button',
      '[data-build-sheet] [data-commit] button', '[data-item-sheet] [data-act] button',
      ...LAUNCH_HAND_SELECTORS,
      '[data-academy-mining] [data-focus-rail] button', '[data-signal-id] button',
      ...(state.id === 'telescope' ? ['[data-sensor-toggle="telescope"]'] : []),
      ...(state.row ? [`#row-${state.row}`] : []),
      '[data-academy-target]', '[data-academy-signals] > button',
      ...(state.id === 'research' ? ['[data-sheet-panel]'] : []),
    ];
    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      /**
       * DRAWN AT ALL, AND THEN PREFERABLY ON SCREEN — in that order.
       *
       * This used to require BOTH, and the second requirement quietly cancelled
       * the scroll that exists to satisfy it. The launch picker is taller than a
       * phone: the Courier's Max button sits below the fold, so it failed
       * `box.top < innerHeight`, so it was never chosen as the hand's target, so
       * `TutorialHand` never scrolled it into view. The one control the lesson
       * could not reach was the one control it refused to point at.
       *
       * Size is still required — a display:none row has no business being a
       * target. Position is now only a PREFERENCE: among several live matches the
       * one already on screen wins, and when none is, the hand takes the first
       * real one and scrolls the sheet to it.
       */
      const node = handPick(nodes, window.innerHeight);
      if (node) return [node];
    }
    return [];
  }, []);
  const refuse = useCallback(() => { setNudge((value) => value + 1); }, []);
  useGate(targets, !claiming, refuse);
  const subject = useCallback(() => !busy && row ? document.getElementById(`row-${row}`) : null, [row, busy]);
  useScrollIntoView(subject, `${id}:${String(busy)}`);
  useEffect(() => {
    if (!world.pending) return;
    // Wait for the commit sheet to close and the paid queue to render, then show
    // the queue at the menu's top. Never pull it back on a clock tick.
    const frame = requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>('[data-academy] [data-sheet-scroll]').forEach((body) => {
        body.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    return () => { cancelAnimationFrame(frame); };
  }, [world.pending?.order.id]);
  useEffect(() => {
    setLaunch(false);
    setAimed(false);
    setPanel('reward' in step ? 'rewards' : row || isMenu ? 'planet' : id === 'research' ? 'research' : null);
    setTelescope(false);
    setStop(null);
  }, [id]);
  useEffect(() => {
    if (id !== 'telescope' && !isMenu) return;
    const clicked = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (id === 'telescope' && event.target.closest('[data-sensor-toggle="telescope"]')) setTelescope(true);
      else if (isMenu && event.target.closest(`[data-tab="${academyGroup(id)}"]`)) write(completeAcademyLesson(latest.current.world, id));
    };
    document.addEventListener('click', clicked);
    return () => { document.removeEventListener('click', clicked); };
  }, [id]);
  /**
   * THE SPHERE, THEN SOMETHING INSIDE IT, THEN ON. Owner instruction.
   *
   * A radius on its own is a fact and not a reason. One second after the switch
   * frames the sphere, a world appears inside it — off to the left, unreachable,
   * uninvolved — and the beat finally says what it was reaching for: this is what
   * sight is FOR. The world is scenery and nothing else; the gate withholds the
   * canvas for this whole beat, so it cannot be tapped, and it is published only
   * while the beat runs.
   *
   * SIX SECONDS, NOT FOUR. The advance had to move with this: at four the
   * demonstration was on screen for three, most of which is the sphere still
   * opening. The beat now has a shape — sphere, arrival, a moment to read it.
   */
  useEffect(() => {
    if (!telescope || id !== 'telescope' || claiming) return;
    const show = window.setTimeout(() => {
      write({ ...latest.current.world, sightDemo: true });
    }, 1000);
    const advance = window.setTimeout(() => {
      const current = latest.current.world;
      write({
        ...current, step: current.step + 1,
        checkpoint: academyCheckpoint(current.step + 1), sightDemo: false,
      });
    }, 6000);
    return () => { window.clearTimeout(show); window.clearTimeout(advance); };
  }, [telescope, id, claiming, write]);
  const openPanel = (next: Panel, shelf?: PanelStop, reportMissionId?: string) => {
    if (isReport && panel === 'report' && next === null) write(completeAcademyLesson(world, id));
    setPanel(next);
    if (shelf) setStop((old) => ({ stop: shelf, request: (old?.request ?? 0) + 1, ...(reportMissionId ? { reportMissionId } : {}) }));
  };
  const next = () => {
    if (id === 'departure') {
      if (replay) onLeave();
      else { write(completeAcademyLesson(world, id)); setClaiming(true); }
    } else write(completeAcademyLesson(world, id));
  };
  const skip = () => {
    if (replay) onLeave();
    else { track('tutorial_skip', { step: world.step, lesson: id }); setClaiming(true); }
  };
  /** What each mission lesson flies the camera onto, and then points a hand at. */
  const aimSubject: Focus | null = id === 'pirate' ? { kind: 'contact', id: 'academy-pirate' }
    : id === 'mine' ? { kind: 'asteroid', id: ACADEMY_ROCK }
    : id === 'raid' ? { kind: 'planet', id: ACADEMY_TARGET_ID }
    : null;
  /**
   * Held through the sheet as well, so no rail flashes up behind it on the way.
   * Memoised because every prop the disc takes is stable (D53).
   */
  const coachFocus = useMemo(
    () => ((aimed || launch) && aimSubject ? { focus: aimSubject, request: aim } : null),
    [aimed, launch, aimSubject?.kind, aimSubject && 'id' in aimSubject ? aimSubject.id : null, aim],
  );
  const aiming = coachFocus !== null && !launch;
  /**
   * THE HIT AREA GOES ON THE SUBJECT, NOT ON THE MIDDLE OF THE SCREEN.
   *
   * It used to be a button centred over the canvas, on the argument that focusing
   * centres the subject. It does — unless the disc was turned by hand in the
   * previous beat, or the subject's payload has not arrived so the rig never
   * moved. Then the hand pointed at empty space, which is exactly what was
   * reported after rotating during the pirate fight. `GalaxyCanvas` now pins it to
   * the same live subject the camera follows.
   *
   * MEMOISED because every prop the disc takes is stable (D53); a fresh object
   * each render would re-render the whole galaxy on every tick of the beat.
   */
  const coachTap = useMemo(
    () => (aiming ? { label: t('academy.tapTarget'), onTap: () => { setLaunch(true); } } : null),
    [aiming, t],
  );

  const showNext = !busy && intro;
  const group = menuFrom[id] ?? academyGroup(id);
  const exposedRows = ACADEMY_STEPS.slice(0, world.step + 1).flatMap((s) => rows[s.id] ? [rows[s.id]!] : []);
  const rowRule = exposedRows.map((r) => `:not(#row-${r})`).join('');
  return <AcademyLessonContext.Provider value={id}><div data-academy data-academy-step={id} className="relative z-10 flex h-dvh flex-col overflow-hidden">
    <style>{`
      [data-academy] [data-disc-controls]{display:none}
      ${world.step < 12 ? '[data-academy] [data-sensor-toggles]{display:none}' : ''}
      ${id === 'research' ? '' : `[data-academy] [id^="row-"]${rowRule}{display:none}`}
      [data-academy] [data-sheet-panel]{max-height:calc(100dvh - 160px)}
      [data-academy] [id^="planet-panel-"] ~ *{scroll-margin-top:8px}
      @keyframes academy-continue {0%,100%{transform:scale(1)} 50%{transform:scale(1.12)}}
      [data-academy] [data-hull-family-group]{content-visibility:visible!important;contain-intrinsic-size:none!important}
      [data-academy] [data-hull-family-group]:not(:has([id^="row-"])){display:none}
    `}</style>
    <StatusBar commander={t('academy.title')} onOpen={openPanel} onFocusPlanet={() => { setPanel('planet'); }} />
    <main className="relative flex-1">
      <GalaxyView panel={panel} onPanel={openPanel} panelStop={stop} commander={t('academy.title')}
        frameTelescope={telescope}
        coachFocus={coachFocus}
        coachTap={coachTap}
        openingHome={id === 'welcome'}
        onFocused={(focus) => {
          if (id === 'welcome' && focus?.kind === 'planet' && focus.id === world.preview.reserved.id) {
            write(completeAcademyLesson(world, id));
            setPanel('planet');
          }
        }}
        planetGroup={group} showChat={false} showGuidance={false} onSignOut={onLeave} />
    </main>
    <PendingStrip />
    {launch && (id === 'pirate' || id === 'raid') && <AcademyLaunch kind={id} onClose={() => { setLaunch(false); setAimed(false); }} />}
    {launch && id === 'mine' && !busy && <AcademyMining
      onClose={() => { setLaunch(false); setAimed(false); }}
      onSend={(craft) => { void api.mine(ACADEMY_ROCK, craft).catch((e: unknown) => { setProblem(describeError(e)); }); }} />}
    {!claiming && <>
      <TutorialHand kind={intro ? 'intro' : 'action'} targets={handTargets} bubble={bubble} />
      <section ref={bubble} data-beat-card key={nudge} className="plate pointer-events-auto fixed inset-x-2 top-2 z-50 rounded-control p-3 animate-[nudge_360ms_ease-out]" aria-live="polite">
        <div className="flex items-center justify-between gap-2 text-label"><span className="text-crystal">{t('academy.title')}</span><span className="num text-faint">{world.step + 1}/{ACADEMY_STEPS.length}</span></div>
        <p className="my-2 text-caption text-bone">{busy ? t('academy.wait') : aiming ? t('academy.aim') : telescope ? t('academy.sight') : replay && id === 'departure' ? t('academy.replayComplete') : t(`academy.steps.${id}`)}{intro && row ? ` ${t('academy.introOnly')}` : ''}</p>
        {problem && <p role="alert" className="text-caption text-alloy">{problem}</p>}
        <div className="flex items-center justify-between gap-2">
          <button className="text-label text-faint" onClick={replay ? onLeave : onSignIn}>{t(replay ? 'academy.leave' : 'academy.signin')}</button>
          {!busy && !aiming && !launch && (id === 'pirate' || id === 'raid' || id === 'mine') && <button data-academy-target className="text-label text-crystal" onClick={() => { setAim((n) => n + 1); setAimed(true); }}>{t('academy.target')}</button>}
          {isReport && panel !== 'report' && <div data-academy-signals><Signals onOpen={openPanel} onFocusPlanet={() => { setPanel('planet'); }} /></div>}
          {showNext && <button className="text-label text-crystal animate-[academy-continue_1400ms_ease-in-out_infinite]" onClick={next}>{t(id === 'departure' ? 'academy.finish' : 'academy.next')}</button>}
          {!replay && <button className="text-micro text-faint" onClick={skip}>{t('academy.skip')}</button>}
        </div>
      </section>
    </>}
    {claiming && <ClaimDialog planetName={world.preview.reserved.name} onSignIn={onSignIn} introduction={t('academy.claim')}
      onClaim={async (username, password) => { try { await onClaim(username, password, world.step); } catch (e) { setProblem(describeError(e)); throw e; } }}
      {...(problem ? { error: problem } : {})} />}
  </div></AcademyLessonContext.Provider>;
}

function AcademyLaunch({ kind, onClose }: { kind: 'pirate' | 'raid'; onClose: () => void }) {
  const pirates = usePirates();
  const galaxy = useGalaxy();
  // The real sheet reads the same world and performs the ordinary API mutation.
  return <AcademyLaunchBody kind={kind} pirate={pirates.data?.pirates[0]} world={galaxy.data?.planets.find((p) => !p.isSelf)} onClose={onClose} />;
}

function AcademyLaunchBody({ kind, pirate, world, onClose }: {
  kind: 'pirate' | 'raid'; pirate: PiratesView['pirates'][number] | undefined; world: GalaxyPlanet | undefined; onClose: () => void;
}) {
  const planet = usePlanet();
  if (!planet.data || (kind === 'pirate' ? !pirate : !world)) return null;
  return <div data-academy-launch><LaunchSheet planet={planet.data}
    target={kind === 'pirate' && pirate ? { kind: 'pirate', pirate } : { kind: 'world', world: world! }}
    onClose={onClose} onLaunched={onClose} /></div>;
}

function AcademyMining({ onClose, onSend }: { onClose: () => void; onSend: (craft: number) => void }) {
  const mining = useMining();
  const planet = usePlanet();
  const data = mining.data;
  const rock = data?.asteroids[0];
  if (!rock || !planet.data) return null;
  const p = planet.data.planet;
  const room = Math.max(0, p.bufferAlloyCap - p.bufferAlloy) + Math.max(0, p.bufferCrystalCap - p.bufferCrystal);
  return <div data-academy-mining data-testid="academy-mining-target"><AsteroidFocus rock={rock}
    isotopeAccess={false} craftAvailable={planet.data.fleet.PROSPECTOR ?? 0} craftHold={data.craftHold}
    derrick={data.derrick} derrickHold={data.derrickHold} minutesLeft={60} reachMinutes={0.1}
    worksRoom={room} run={undefined} onClose={onClose} onSend={onSend} busy={false} open onToggle={onClose} /></div>;
}
