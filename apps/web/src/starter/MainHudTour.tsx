import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CutPlate, GameButton, Glyph, type GlyphId } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';

const TOUR_STORAGE_KEY = 'astera:main-hud-tour:v1';

export type HudTourStep = 0 | 1 | 2 | 3;

const NEXT_STEP: Readonly<Record<HudTourStep, HudTourStep | null>> = { 0: 1, 1: 2, 2: 3, 3: null };
/** The tour's next step, or null after the last. */
export const nextHudTourStep = (step: HudTourStep): HudTourStep | null => NEXT_STEP[step];

type TourTitleKey =
  | 'starter.scenario.tourStatusTitle'
  | 'starter.scenario.tourReadoutTitle'
  | 'starter.scenario.tourToolsTitle'
  | 'starter.scenario.tourDockTitle';

type TourBodyKey =
  | 'starter.scenario.tourStatusBody'
  | 'starter.scenario.tourReadoutBody'
  | 'starter.scenario.tourToolsBody'
  | 'starter.scenario.tourDockBody';

interface StepSpec {
  readonly id: 'status' | 'readout' | 'tools' | 'dock';
  readonly selector: string;
  readonly glyph: GlyphId;
  readonly titleKey: TourTitleKey;
  readonly bodyKey: TourBodyKey;
  readonly place: 'below' | 'above';
}

const STEPS: readonly [StepSpec, StepSpec, StepSpec, StepSpec] = [
  {
    id: 'status',
    selector: '[data-hud-badges], [data-hud-tour="status"]',
    glyph: 'shield',
    titleKey: 'starter.scenario.tourStatusTitle',
    bodyKey: 'starter.scenario.tourStatusBody',
    place: 'below',
  },
  {
    id: 'readout',
    selector: '[data-galaxy-readout]',
    glyph: 'target',
    titleKey: 'starter.scenario.tourReadoutTitle',
    bodyKey: 'starter.scenario.tourReadoutBody',
    place: 'below',
  },
  {
    id: 'tools',
    selector: '[data-hud-tour="tools"]',
    glyph: 'eye',
    titleKey: 'starter.scenario.tourToolsTitle',
    bodyKey: 'starter.scenario.tourToolsBody',
    place: 'below',
  },
  {
    id: 'dock',
    selector: '[data-dock], [data-hud-tour="dock"]',
    glyph: 'rocket',
    titleKey: 'starter.scenario.tourDockTitle',
    bodyKey: 'starter.scenario.tourDockBody',
    place: 'above',
  },
];

export function hasSeenMainHudTour(): boolean {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === 'done';
  } catch {
    return false;
  }
}

export function markMainHudTourSeen(): void {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, 'done');
  } catch {
    /* ignore storage errors */
  }
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Step-by-step spotlight tour that progressively reveals and introduces the main galaxy HUD icons
 * right after the Founding Hour modal closes (playtest 2026-11-23, item 5).
 */
export function MainHudTour({
  step,
  onNext,
  onSkip,
}: {
  step: HudTourStep;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const spec = STEPS[step];
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const measure = () => {
      const nodes = Array.from(document.querySelectorAll(spec.selector));
      const boxes = nodes
        .map((node) => node.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      if (boxes.length === 0) {
        setRect(null);
        return;
      }
      const minTop = Math.min(...boxes.map((r) => r.top));
      const minLeft = Math.min(...boxes.map((r) => r.left));
      const maxBottom = Math.max(...boxes.map((r) => r.bottom));
      const maxRight = Math.max(...boxes.map((r) => r.right));
      const next = {
        top: Math.max(4, minTop - 6),
        left: Math.max(4, minLeft - 6),
        width: Math.min(window.innerWidth - 8, maxRight - minLeft + 12),
        height: Math.min(window.innerHeight - 8, maxBottom - minTop + 12),
      };
      // Measured every 150 ms: a box that did not move is not a new render.
      setRect(prev => (prev?.top === next.top && prev.left === next.left && prev.width === next.width
        && prev.height === next.height ? prev : next));
    };
    measure();
    const timer = window.setInterval(measure, 150);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', measure);
    };
  }, [spec.selector]);

  const isLast = step === STEPS.length - 1;
  const cardTop = rect
    ? (spec.place === 'below'
        ? Math.min(window.innerHeight - 190, rect.top + rect.height + 12)
        : Math.max(76, rect.top - 156))
    : undefined;

  return (
    <div
      data-testid="main-hud-tour"
      data-tour-step={spec.id}
      className="gk pointer-events-auto fixed inset-0 z-[65]"
    >
      {rect ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-plate border-2 border-v2-self transition-all duration-200"
          style={{
            top: `${String(rect.top)}px`,
            left: `${String(rect.left)}px`,
            width: `${String(rect.width)}px`,
            height: `${String(rect.height)}px`,
            boxShadow: '0 0 0 9999px rgba(3, 6, 14, 0.74), 0 0 22px 2px rgba(56, 232, 198, 0.45)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-v2-void/75" />
      )}

      <div
        className="fixed inset-x-3 mx-auto max-w-[360px] transition-all duration-200"
        style={cardTop !== undefined ? { top: `${String(cardTop)}px` } : { bottom: '104px' }}
      >
        <CutPlate tone="self" className="grid gap-2.5 p-3.5 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-body font-bold uppercase tracking-wider text-v2-self">
              <Glyph id={spec.glyph} className="size-3.5" />
              {t('starter.scenario.tourStep', { current: step + 1, total: STEPS.length })}
            </span>
            <button
              type="button"
              data-testid="hud-tour-skip"
              onClick={() => { playSound('tap'); haptic('tap'); onSkip(); }}
              className="text-body font-semibold text-v2-ink-2 hover:text-v2-ink"
            >
              {t('starter.scenario.tourSkip')}
            </button>
          </div>
          <div className="grid gap-1">
            <h3 className="gk-display m-0 text-figure font-bold text-v2-ink">{t(spec.titleKey)}</h3>
            <p className="m-0 text-body leading-relaxed text-v2-ink-2">{t(spec.bodyKey)}</p>
          </div>
          <div className="flex justify-end pt-0.5">
            <GameButton
              tone="action"
              size="sm"
              glyph={isLast ? 'check' : 'next'}
              onPress={() => { playSound('tap'); haptic('tap'); onNext(); }}
            >
              {t(isLast ? 'starter.scenario.tourDone' : 'starter.scenario.tourNext')}
            </GameButton>
          </div>
        </CutPlate>
      </div>
    </div>
  );
}
