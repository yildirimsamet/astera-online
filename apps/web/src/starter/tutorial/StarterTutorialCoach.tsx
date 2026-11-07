import { REPAIR_LADDER, type VesselModule, type VesselSystem } from '@astera/rules';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { playSound } from '../../lib/sound.js';
import { haptic } from '../../lib/haptics.js';
import { observe } from '../../lib/playerAnalytics/runtime.js';
import { clockTime, duration, durationPrecise } from '../../lib/time.js';
import { useGate } from '../../onboarding/Gate.js';
import { SchoolCoach } from '../../onboarding/flightSchool/SchoolCoach.js';
import { SchoolPointer } from '../../onboarding/flightSchool/SchoolPointer.js';
import { moduleName } from '../shipCopy.js';
import { TUTORIAL_CHAPTERS, waitMode, type TutorialStepId } from './script.js';

const CHAPTER = {
  1: 'starter.tutorial.chapter.1', 2: 'starter.tutorial.chapter.2', 3: 'starter.tutorial.chapter.3',
  4: 'starter.tutorial.chapter.4', 5: 'starter.tutorial.chapter.5', 6: 'starter.tutorial.chapter.6',
  7: 'starter.tutorial.chapter.7', 8: 'starter.tutorial.chapter.8',
} as const;
import { Sheet } from '../../ui/kit/Sheet.js';
import { Button } from '../../ui/kit/Button.js';
import { useGuidePreference } from './guidePreference.js';
import { AwayChip } from './AwayChip.js';
import { DragHint } from './DragHint.js';
import { useSilenceToasts } from '../../ui/Toast.js';
import { holdUnlock } from './unlockHold.js';
import { ACK_ON_PRESS, type StarterTutorial } from './useStarterTutorial.js';

/** No news over the NPC's card (owner playtest 2026-11-06); a refusal still shows, as in FlightSchool. */
function Hush() {
  useSilenceToasts(true);
  return null;
}

/** The repair a line names, and the tab it sits under. */
const SUBJECT: Partial<Record<TutorialStepId, { module: VesselModule; tab: VesselSystem }>> = {
  orderRefinery: { module: 'REFINERY', tab: 'REFINERY' },
  orderExtractor: { module: 'EXTRACTOR', tab: 'REFINERY' },
  orderAntenna: { module: 'SURVEY', tab: 'SURVEY' },
  orderExtractor2: { module: 'EXTRACTOR', tab: 'REFINERY' },
  orderRefinery3: { module: 'REFINERY', tab: 'REFINERY' },
  orderVault: { module: 'VAULT', tab: 'REFINERY' },
  orderShipyard: { module: 'SHIPYARD', tab: 'CARGO' },
  orderExtractor3: { module: 'EXTRACTOR', tab: 'REFINERY' },
};
const REFINERY_3 = REPAIR_LADDER.find(step => step.module === 'REFINERY' && step.stage === 3);
const NONE: readonly string[] = [];
/** A marked control missing this long is not coming: the gate opens rather than hold the player forever. */
const MARK_MISSING_MS = 4_000;
/** A wait that cannot be timed is stuck past this; a timed one, this far past its end. */
const WAIT_LONG_MS = 90_000;
const WAIT_LATE_MS = 30_000;
/** What spends the store: held while the player roams a wait, so the road's next price is still there. */
const SPEND = '[data-guide="repair-order"], [data-guide="probe"], [data-guide="mine"], [data-guide="unlock-try"]';
const ACTIVATIONS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'] as const;
const THUMB = '[data-guide="repair-show"]';
/** Never held: the scene, a ready crate, and the way out of what a tap on the scene opened. */
const ALWAYS_FREE = 'canvas, [data-guide="crate"], [data-focus-close], [data-universe-chip]';
/**
 * THE NPC LETS GO BY DEGREES (owner playtest 2026-11-07: "3-5 dk'dan sonra serbest bırakmaya
 * başlamalıyız"). The first chapters, the first few minutes, hold every other control; from the first
 * probe on it points the way and holds only the store, so the road's next price is still there.
 */
const LAST_STRICT_CHAPTER = 3;
/** A control the screen hides is not there to press: a focus panel hides the card under it. */
const shown = (element: Element): boolean => !('checkVisibility' in element) || element.checkVisibility();
/** A drag this far over the scene is a look around; a tap is not. */
const LOOK_PX = 40;
/** The first look never strands anyone: Next comes anyway after this long. */
const LOOK_FALLBACK_MS = 12_000;
const NEXT = (): Element[] => [...document.querySelectorAll('[data-school-next]')];

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

/** The guide is optional; unmounting it releases every effect that owns a control. */
export function StarterTutorialCoach({ tutorial, accountId }: { tutorial: StarterTutorial; accountId?: string }) {
  const { skipped, skip } = useGuidePreference(accountId);
  const [closed, setClosed] = useState(false);
  if (skipped || closed) return null;
  return <LiveCoach tutorial={tutorial} onSkip={() => { skip(); setClosed(true); }} />;
}

function LiveCoach({ tutorial, onSkip }: { tutorial: StarterTutorial; onSkip: () => void }) {
  const { t } = useTranslation();
  const { answer, ack, backIn } = tutorial;
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
  const strict = step !== null && step.chapter <= LAST_STRICT_CHAPTER;
  const goalKey = step?.goal?.join('|') ?? '';
  const untilMs = tutorial.wait?.until.getTime() ?? null;
  const [steppedAside, setSteppedAside] = useState<string | null>(null);
  const aside = mode === 'away' && stepId !== undefined && steppedAside === stepId;
  useEffect(() => {
    if (!live || !stepId) return;
    observe('training_scene_visible', { trainingVersion: 'starter-tutorial.v1', scene: stepId }, 'live');
  }, [live, stepId]);
  useEffect(() => {
    setStuck(false);
    if (!live || !stepId || kind === 'read') return undefined;
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
  // Free to roam, not to spend: a store control answers only when it is the step's own.
  const free = live && step.chapter < 7 && (!strict || roaming);
  useEffect(() => {
    if (!free) return undefined;
    const wanted = [...marks, ...(goalKey === '' ? [] : goalKey.split('|'))].join(', ');
    const guard = (event: Event): void => {
      const node = event.target;
      const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null;
      const spend = element?.closest(SPEND);
      if (!spend || (!roaming && wanted !== '' && spend.matches(wanted))) return;
      event.stopPropagation();
      if (event.type === 'click') { event.preventDefault(); refuse(); }
    };
    for (const type of ACTIVATIONS) document.addEventListener(type, guard, true);
    return () => { for (const type of ACTIVATIONS) document.removeEventListener(type, guard, true); };
  }, [free, roaming, marks, goalKey, refuse]);
  // Back from a long wait: the NPC returns with a sound, as something that came to call.
  const wasAside = useRef(false);
  useEffect(() => {
    if (aside) { wasAside.current = true; return; }
    if (!wasAside.current || !live || kind === 'wait') return;
    wasAside.current = false;
    playSound('confirm');
    haptic('commit');
  }, [aside, live, kind]);

  // The goodbye names the time as it stood when it began; it does not slide while being read.
  const farewellAt = useRef<number | null>(null);
  if (stepId !== 'farewell') farewellAt.current = null;
  else farewellAt.current ??= backIn;

  // A mark the ship keeps no record of: pressing it is the step. Only the first mark is the step; the
  // rest are the way to it.
  const pressId = step && !step.nav && ACK_ON_PRESS.includes(step.id) ? step.id : null;
  const first = marks[0];
  useEffect(() => {
    if (!pressId || first === undefined) return undefined;
    const press = (event: MouseEvent): void => {
      const node = event.target;
      const element = node instanceof Element ? node : node instanceof Node ? node.parentElement : null;
      if (element?.closest(first)) ack(pressId);
    };
    document.addEventListener('click', press, true);
    return () => { document.removeEventListener('click', press, true); };
  }, [pressId, first, ack]);

  // THE FIRST LOOK (owner playtest 2026-11-07): the hand shows the drag until the view is turned; only
  // then is Next offered, and pointed at.
  const looking = step?.id === 'lookAround' && !step.nav;
  const [looked, setLooked] = useState(false);
  useEffect(() => {
    if (!looking) return undefined;
    let from: { x: number; y: number } | null = null;
    const down = (event: PointerEvent): void => { from = event.target instanceof HTMLCanvasElement ? { x: event.clientX, y: event.clientY } : null; };
    const move = (event: PointerEvent): void => {
      if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) >= LOOK_PX) setLooked(true);
    };
    const up = (): void => { from = null; };
    const fallback = window.setTimeout(() => { setLooked(true); }, LOOK_FALLBACK_MS);
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
  }, [looking]);

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

  if (!step || covered) return null;
  if (aside && tutorial.wait) return <AwayChip until={tutorial.wait.until} onOpen={() => { setSteppedAside(null); }} />;
  const subject = SUBJECT[step.id];
  const text = step.nav
    ? t(`starter.tutorial.nav.${step.nav}`, { base: t('dock.base') })
    : t(`starter.tutorial.line.${step.id}`, {
      clock: tutorial.homeAt ? clockTime(tutorial.homeAt) : '…',
      underway: tutorial.homeAt ? t('starter.tutorial.flight', { clock: clockTime(tutorial.homeAt) }) : t('starter.tutorial.noneFlying'),
      name: subject ? moduleName(subject.module) : '',
      tab: subject ? t(`starter.systemShort.${subject.tab}`) : '',
      try: t('starter.unlock.try'),
      repair: t('starter.repair'),
      intel: t('dock.intel'),
      time: step.id === 'farewell' ? duration(farewellAt.current ?? 60) : durationPrecise(REFINERY_3?.minutes ?? 1.5),
    });
  const away = mode === 'away' && tutorial.wait && !step.nav ? tutorial.wait : null;
  const line = away ? `${text} ${t('starter.tutorial.away', { clock: clockTime(away.until) })}` : text;
  // A mark up in the top bar takes the card to the foot of the screen.
  const dock = marks.includes('[data-guide="works"]') ? 'bottom' : 'top';
  const reading = step.step === 'read' && !(looking && !looked);
  const action = reading
    ? { actionLabel: t('starter.tutorial.next'), onAction: () => { playSound('confirm'); haptic('tap'); ack(step.id); } }
    : away ? { actionLabel: t('starter.tutorial.ok'), onAction: () => { haptic('tap'); setSteppedAside(step.id); } } : {};
  // The hand comes after the card, so one pointing into the card is drawn over it (owner playtest 2026-11-07).
  return (
    <>
      <Hush />
      {looking && !looked && <DragHint />}
      <SchoolCoach
        title={t(CHAPTER[step.chapter])}
        text={line}
        progress={step.chapter}
        total={TUTORIAL_CHAPTERS}
        dock={dock}
        busy={step.step === 'wait' && !away}
        revealLabel={t('starter.tutorial.reveal')}
        onExit={() => { playSound('confirm'); haptic('tap'); setConfirmSkip(true); }}
        exitLabel={t('starter.tutorial.skip.link')}
        {...action}
      />
      {confirmSkip && <div data-guide-exit>
        <Sheet title={t('starter.tutorial.skip.title')} onClose={() => { setConfirmSkip(false); }} footer={
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={() => { playSound('confirm'); haptic('tap'); setConfirmSkip(false); }}>{t('starter.tutorial.skip.keep')}</Button>
            <Button variant="ghost" className="text-v2-warn" onClick={() => {
              observe('training_exit_requested', { trainingVersion: 'starter-tutorial.v1', scene: step.id, code: 'skipped' }, 'live');
              playSound('confirm'); haptic('commit'); onSkip();
            }}>{t('starter.tutorial.skip.close')}</Button>
          </div>
        }><p className="text-caption text-v2-ink-2">{t('starter.tutorial.skip.body')}</p></Sheet>
      </div>}
      {step.step === 'press' && <SchoolPointer targets={targets} />}
      {/* A line about something on screen lights it and brings it into view; the hand is for presses. */}
      {step.step === 'read' && marks.length > 0 && <SchoolPointer targets={targets} showHand={false} />}
      {looking && looked && <SchoolPointer targets={NEXT} />}
    </>
  );
}
