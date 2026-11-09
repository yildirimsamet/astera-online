import type { VesselModule, VesselSystem } from '@astera/rules';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playSound } from '../../lib/sound.js';
import { haptic } from '../../lib/haptics.js';
import { observe } from '../../lib/playerAnalytics/runtime.js';
import { clockTime } from '../../lib/time.js';
import { useGate } from '../../onboarding/Gate.js';
import { SchoolCoach } from '../../onboarding/flightSchool/SchoolCoach.js';
import { SchoolPointer } from '../../onboarding/flightSchool/SchoolPointer.js';
import { moduleName } from '../shipCopy.js';
import { CORE_CHAPTERS, waitMode, type TutorialStepId } from './script.js';

const CHAPTER = {
  1: 'starter.tutorial.chapter.1', 2: 'starter.tutorial.chapter.2', 3: 'starter.tutorial.chapter.3', 4: 'starter.tutorial.chapter.4',
  5: 'starter.tutorial.chapter.5', 6: 'starter.tutorial.chapter.6', 7: 'starter.tutorial.chapter.7', 8: 'starter.tutorial.chapter.8',
  9: 'starter.tutorial.chapter.9',
} as const;
/** The funnel counts these steps under this version (the server's `starterFunnel`). */
const TRAINING = 'starter-tutorial.v2';
import { Sheet } from '../../ui/kit/Sheet.js';
import { Button } from '../../ui/kit/Button.js';
import { AwayChip } from './AwayChip.js';
import { DragHint } from './DragHint.js';
import { PinchHint } from './PinchHint.js';
import { useRockReach } from './rockReach.js';
import { useSilenceToasts } from '../../ui/Toast.js';
import { holdUnlock } from './unlockHold.js';
import { CARD_AFTER_REVEAL_MS } from './sightLesson.js';
import { ACK_ON_PRESS, ackAfterPress, type StarterTutorial } from './useStarterTutorial.js';

/** No news over the NPC's card (owner playtest 2026-11-06); a refusal still shows, as in FlightSchool. */
function Hush() {
  useSilenceToasts(true);
  return null;
}

/** The repair a line names, and the tab it sits under. */
const SUBJECT: Partial<Record<TutorialStepId, { module: VesselModule; tab: VesselSystem }>> = {
  orderRefinery: { module: 'REFINERY', tab: 'REFINERY' },
  orderExtractor: { module: 'EXTRACTOR', tab: 'REFINERY' },
  orderTelescope: { module: 'TELESCOPE', tab: 'DEFENCE' },
  orderRadar: { module: 'RADAR', tab: 'DEFENCE' },
  orderSurvey: { module: 'SURVEY', tab: 'SURVEY' },
  orderShipyard: { module: 'SHIPYARD', tab: 'CARGO' },
};
const NONE: readonly string[] = [];
/** A marked control missing this long is not coming: the gate opens rather than hold the player forever. */
const MARK_MISSING_MS = 4_000;
/** A wait that cannot be timed is stuck past this; a timed one, this far past its end. */
const WAIT_LONG_MS = 90_000;
const WAIT_LATE_MS = 30_000;
/** What spends the store: held while the player roams a wait of the core, so its next price is still there. */
const SPEND = '[data-guide="repair-order"], [data-guide="probe"], [data-guide="mine"], [data-guide="unlock-try"]';
const ACTIVATIONS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'] as const;
const THUMB = '[data-guide="repair-show"]';
/** Never held: the scene, a ready crate, and the way out of what a tap on the scene opened. */
const ALWAYS_FREE = 'canvas, [data-guide="crate"], [data-focus-close], [data-universe-chip]';
/** A control the screen hides is not there to press: a focus panel hides the card under it. */
const shown = (element: Element): boolean => !('checkVisibility' in element) || element.checkVisibility();
/** A drag this far over the scene is a look around; a tap is not. */
const LOOK_PX = 40;
/** The first look never strands anyone: the hand comes anyway after this long. */
const LOOK_FALLBACK_MS = 12_000;

/** The coach waits for the loading cover to lift: nothing it points at is there yet. */
function useLoadingCover(): boolean {
  const [covered, setCovered] = useState(() => document.querySelector('[data-loading-screen]') !== null);
  useEffect(() => {
    if (!covered) return undefined;
    const timer = window.setInterval(() => { if (!document.querySelector('[data-loading-screen]')) setCovered(false); }, 250);
    return () => { window.clearInterval(timer); };
  }, [covered]);
  return covered;
}

/** What the card needs of the tutorial: the step, its clocks, and the way to record a line read. */
type CoachTutorial = Pick<StarterTutorial, 'answer' | 'ack' | 'backIn' | 'wait' | 'repaired'>;

/**
 * The guide is optional; unmounting it releases every effect that owns a control. Declining it goes
 * at once here, and `onSkip` keeps it declined on the account (plan F3).
 */
export function StarterTutorialCoach({ tutorial, onSkip }: { tutorial: CoachTutorial; onSkip?: () => void }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return <LiveCoach tutorial={tutorial} onSkip={() => { onSkip?.(); setClosed(true); }} />;
}

function LiveCoach({ tutorial, onSkip }: { tutorial: CoachTutorial; onSkip: () => void }) {
  const { t } = useTranslation();
  const { answer, ack } = tutorial;
  const [confirmSkip, setConfirmSkip] = useState(false);
  const step = answer.kind === 'step' ? answer : null;
  const covered = useLoadingCover();
  const live = step !== null && !covered;
  const key = step?.marks.join('|') ?? '';
  const marks = useMemo(() => (key === '' ? NONE : key.split('|')), [key]);
  const targets = useCallback((): Element[] => {
    for (const selector of marks) {
      const found = [...document.querySelectorAll(selector)].find(shown);
      if (found) return [found];
    }
    return [];
  }, [marks]);
  const refuse = useCallback(() => { haptic('warn'); }, []);

  // THE FAIL-SAFE (review 2026-11-06). Strict is not a trap: a press whose mark the screen never draws,
  // or a wait far past its time, lets go of the controls and says where it stuck. The line stays up.
  const [stuck, setStuck] = useState(false);
  const stepId = step?.id;
  const kind = step?.step;
  // A long wait lets the player go (owner playtest 2026-11-07): roaming past ten seconds, and past a
  // minute the NPC steps aside, says when it will be back, and returns when the work is done.
  const mode = kind === 'wait' ? waitMode(tutorial.wait) : null;
  const roaming = mode === 'roam' || mode === 'away';
  // THE CORE HOLDS, A MOMENT POINTS (owner 2026-11-08, N1): power, the first collect and the first
  // repair hold every other control; after them nothing holds a control or a spend.
  const strict = step?.strict === true;
  const untilMs = tutorial.wait?.until.getTime() ?? null;
  const [steppedAside, setSteppedAside] = useState<string | null>(null);
  const aside = mode === 'away' && stepId !== undefined && steppedAside === stepId;
  useEffect(() => {
    if (!live || !stepId) return;
    observe('training_scene_visible', { trainingVersion: TRAINING, scene: stepId }, 'live');
  }, [live, stepId]);
  useEffect(() => {
    setStuck(false);
    if (!live || !stepId || kind === 'read' || kind === 'gesture') return undefined;
    const began = Date.now();
    let missingSince: number | null = null;
    let told = false;
    const tell = (code: string): void => {
      if (told) return;
      told = true;
      observe('blocker_visible', { surface: 'starter_tutorial', subject: stepId, code });
    };
    const timer = window.setInterval(() => {
      if (kind === 'wait') {
        if (untilMs !== null ? Date.now() >= untilMs + WAIT_LATE_MS : Date.now() - began >= WAIT_LONG_MS) { setStuck(true); tell('wait_long'); }
        return;
      }
      const found = targets()[0];
      if (found) {
        missingSince = null;
        setStuck(false);
        // A thumbnail can sit past the strip's edge: bring it into the strip's view.
        if (found.matches(THUMB)) found.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        return;
      }
      missingSince ??= Date.now();
      if (Date.now() - missingSince >= MARK_MISSING_MS) { setStuck(true); tell('mark_missing'); }
    }, 500);
    return () => { window.clearInterval(timer); };
  }, [live, stepId, kind, targets, untilMs]);
  // Reading starts with its subject visible, even when the dossier mounts after the line.
  useEffect(() => {
    if (!live || kind !== 'read' || marks.length === 0) return undefined;
    let attempts = 0;
    const timer = window.setInterval(() => {
      const target = targets()[0];
      if (target && !target.closest('[data-scene-mark]')) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      if (target || ++attempts >= 16) window.clearInterval(timer);
    }, 250);
    return () => { window.clearInterval(timer); };
  }, [live, stepId, kind, targets]);
  // Never held while the NPC speaks (owner playtest 2026-11-06): looking around the scene, which is
  // dragged on its canvas, and a ready crate, which is safe to open at any moment.
  const allowed = useCallback((): Element[] => [...targets(), ...document.querySelectorAll(ALWAYS_FREE)], [targets]);
  useGate(allowed, live && strict && !stuck && !roaming, refuse);
  // Free to roam a wait of the core, not to spend.
  const free = live && strict && roaming;
  useEffect(() => {
    if (!free) return undefined;
    const guard = (event: Event): void => {
      const node = event.target;
      const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null;
      const spend = element?.closest(SPEND);
      if (!spend) return;
      event.stopPropagation();
      if (event.type === 'click') { event.preventDefault(); refuse(); }
    };
    for (const type of ACTIVATIONS) document.addEventListener(type, guard, true);
    return () => { for (const type of ACTIVATIONS) document.removeEventListener(type, guard, true); };
  }, [free, refuse]);
  // Back from a long wait: the NPC returns with a sound, as something that came to call.
  const wasAside = useRef(false);
  useEffect(() => {
    if (aside) { wasAside.current = true; return; }
    if (!wasAside.current || !live || kind === 'wait') return;
    wasAside.current = false;
    playSound('confirm');
    haptic('commit');
  }, [aside, live, kind]);

  // A mark the ship keeps no record of: pressing it is the step. Only the first mark is the step; the
  // rest are the way to it.
  const pressId = step && !step.nav && ACK_ON_PRESS.includes(step.id) ? step.id : null;
  const first = marks[0];
  useEffect(() => {
    if (!pressId || first === undefined) return undefined;
    const press = (event: MouseEvent): void => {
      const node = event.target;
      const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null;
      if (element?.closest(first)) ackAfterPress(ack, pressId);
    };
    document.addEventListener('click', press, true);
    return () => { document.removeEventListener('click', press, true); };
  }, [pressId, first, ack]);

  // THE FIRST LOOK (owner playtest 2026-11-07), now over the power card (N1): the drag shows until the
  // view is turned, and only then does the hand go to the card. The card can be pressed all along.
  // The telescope's field is the same gesture, and turning the view is what passes that step (owner 2026-11-08).
  // The telescope's sky fills first: the officer waits for it, and a drag before that is only a look.
  const telescope = step?.id === 'telescopeLook' && !step.nav;
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (!telescope) return undefined;
    const timer = window.setTimeout(() => { setFilled(true); }, CARD_AFTER_REVEAL_MS);
    return () => { window.clearTimeout(timer); };
  }, [telescope]);
  const revealing = telescope && !filled;
  const lookId = step && !step.nav && !revealing && (step.id === 'online' || step.id === 'telescopeLook') ? step.id : null;
  const looking = lookId !== null;
  const [lookedOn, setLookedOn] = useState<TutorialStepId | null>(null);
  const looked = lookedOn === lookId;
  useEffect(() => {
    if (lookId === null) return undefined;
    let from: { x: number; y: number } | null = null, turned = false;
    const down = (event: PointerEvent): void => { from = event.target instanceof HTMLCanvasElement ? { x: event.clientX, y: event.clientY } : null; };
    const move = (event: PointerEvent): void => {
      if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) >= LOOK_PX) { turned = true; setLookedOn(lookId); }
    };
    const up = (): void => {
      from = null;
      if (!turned || lookId !== 'telescopeLook') return;
      turned = false;
      playSound('confirm');
      haptic('tap');
      ack(lookId);
    };
    // The power card must not wait on a look; on the telescope's field the drag is the whole lesson.
    const fallback = lookId === 'online' ? window.setTimeout(() => { setLookedOn(lookId); }, LOOK_FALLBACK_MS) : undefined;
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    return () => {
      window.clearTimeout(fallback);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
    };
  }, [lookId, ack]);

  // THE ZOOM (owner playtest 2026-11-09): the camera is the answer. Already close, it passes without a word.
  const zooming = live && kind === 'gesture' && stepId === 'zoomRock';
  const reach = useRockReach();
  const wasFar = useRef(false);
  useEffect(() => {
    if (!zooming) { wasFar.current = false; return; }
    if (reach === null) { wasFar.current = true; return; }
    if (wasFar.current) { playSound('confirm'); haptic('commit'); }
    ack('zoomRock');
  }, [zooming, reach, ack]);

  // A system's "online" card shows only when a line points at it (owner playtest 2026-11-07).
  const aboutUnlock = marks.some(mark => mark.includes('unlock-'));
  useEffect(() => {
    holdUnlock(live && !aboutUnlock);
    return () => { holdUnlock(false); };
  }, [live, aboutUnlock]);

  // While it speaks, a sheet leaves room above it for the card, as in FlightSchool.
  const speaking = live && !aside;
  useEffect(() => {
    if (!speaking) return undefined;
    document.body.classList.add('school-root');
    document.body.setAttribute('data-school-scene', 'starter');
    return () => {
      document.body.classList.remove('school-root');
      document.body.removeAttribute('data-school-scene');
    };
  }, [speaking]);

  if (!step || covered || revealing) return null;
  if (aside && tutorial.wait) return <AwayChip until={tutorial.wait.until} onOpen={() => { setSteppedAside(null); }} />;
  const subject = SUBJECT[step.id];
  const text = step.nav
    ? t(`starter.tutorial.nav.${step.nav}`, { base: t('dock.base') })
    : t(`starter.tutorial.line.${step.id}`, {
      name: subject ? moduleName(subject.module) : '',
      tab: subject ? t(`starter.systemShort.${subject.tab}`) : '',
      try: t('starter.unlock.try'),
      repair: t('starter.repair'),
      intel: t('dock.intel'),
      percent: tutorial.repaired ?? 0,
    });
  const away = mode === 'away' && tutorial.wait && !step.nav ? tutorial.wait : null;
  const line = away ? `${text} ${t('starter.tutorial.away', { clock: clockTime(away.until) })}` : text;
  // A mark up in the top bar takes the card to the foot of the screen.
  const dock = marks.includes('[data-guide="works"]') ? 'bottom' : 'top';
  const reading = step.step === 'read';
  const action = reading
    ? { actionLabel: t('starter.tutorial.next'), onAction: () => { playSound('confirm'); haptic('tap'); ack(step.id); } }
    : away ? { actionLabel: t('starter.tutorial.ok'), onAction: () => { haptic('tap'); setSteppedAside(step.id); } } : {};
  // The hand comes after the card, so one pointing into the card is drawn over it (owner playtest 2026-11-07).
  return (
    <>
      <Hush />
      {looking && !looked && <DragHint />}
      {zooming && <PinchHint />}
      {/* The question takes the card's place: docked at the bottom, the card covered its buttons. */}
      {!confirmSkip && <SchoolCoach
        title={t(CHAPTER[step.chapter])}
        text={line}
        {...(step.strict ? { progress: step.chapter, total: CORE_CHAPTERS } : {})}
        dock={dock}
        busy={step.step === 'wait' && !away}
        revealLabel={t('starter.tutorial.reveal')}
        onExit={() => { playSound('confirm'); haptic('tap'); setConfirmSkip(true); }}
        exitLabel={t('starter.tutorial.skip.link')}
        {...action}
      />}
      {confirmSkip && <div data-guide-exit>
        <Sheet title={t('starter.tutorial.skip.title')} onClose={() => { setConfirmSkip(false); }} footer={
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={() => { playSound('confirm'); haptic('tap'); setConfirmSkip(false); }}>{t('starter.tutorial.skip.keep')}</Button>
            <Button variant="ghost" className="text-v2-warn" onClick={() => {
              observe('training_exit_requested', { trainingVersion: TRAINING, scene: step.id, code: 'skipped' }, 'live');
              playSound('confirm'); haptic('commit'); onSkip();
            }}>{t('starter.tutorial.skip.close')}</Button>
          </div>
        }><p className="text-caption text-v2-ink-2">{t('starter.tutorial.skip.body')}</p></Sheet>
      </div>}
      {step.step === 'press' && !(looking && !looked) && <SchoolPointer targets={targets} />}
      {/* A line about something on screen lights it and brings it into view; the hand is for presses. */}
      {step.step === 'read' && marks.length > 0 && <SchoolPointer targets={targets} showHand={false} />}
    </>
  );
}
