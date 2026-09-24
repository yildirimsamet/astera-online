import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../../lib/haptics.js';
import { useOwnPress } from '../../ui/kit/useOwnPress.js';

/** How long a press has to be held before it commits. Spec B9. */
export const HOLD_MS = 600;
/** How long an unanswered Enter confirm stays armed. */
const CONFIRM_MS = 4_000;
/** How long "hold to confirm" stays on the face after a release that came too soon. */
const NUDGE_MS = 1_600;
/** The face ring: r = 6 on a 16 box. */
const RING = 2 * Math.PI * 6;

const TONE = {
  /** Your move: every launch. */
  self: { frame: 'border-v2-self/60 bg-v2-self/10', fill: 'bg-v2-self/35', bar: 'bg-v2-self', ring: 'stroke-v2-self', track: 'stroke-v2-self/35' },
  /** The strategic weapon: the one launch drawn in the colour of harm. */
  hostile: {
    frame: 'border-v2-hostile/60 bg-v2-hostile/10',
    fill: 'bg-v2-hostile/35',
    bar: 'bg-v2-hostile',
    ring: 'stroke-v2-hostile',
    track: 'stroke-v2-hostile/35',
  },
} as const;

export interface HoldButtonProps {
  /** What pressing sends, as a verb phrase: "Launch 74 ships". */
  label: string;
  onCommit: () => void;
  /** Set when it cannot commit: the reason replaces the label and nothing arms. */
  disabledReason?: string | null;
  tone?: keyof typeof TONE;
}

/**
 * PRESS AND HOLD TO SPEND. Spec B9, decision K4 (docs/ui-v2/gozlemevi.md).
 *
 * A launch spends fuel as it leaves; a hold of 0.6 s is one gesture that cannot
 * happen by accident, and it replaces a second confirmation sheet. Destroying
 * something (cancelling a queue order burns half of it) stays on `Confirm`, which
 * can say what is lost.
 *
 * THE PRESS MUST BEGIN HERE. The hold starts only on this button's own
 * `pointerdown`, so the tail of a gesture that mounted it (D109a, `useOwnPress`)
 * can never arm it; a pointer click on its own does nothing.
 *
 * KEYBOARDS HOLD SPACE; ENTER CONFIRMS TWICE. Someone who cannot hold a key gets an
 * inline second step instead of a timer, and a screen reader is told both ways.
 *
 * A TAP IS NOT A HOLD, AND THE FACE SAYS SO. A ring beside the label says "hold"
 * before anyone presses, and fills with the hold; a release that came too soon
 * puts "hold to confirm" on the face for a moment. Found on the gallery: with the
 * hint only in a screen-reader line, a tap did nothing and said nothing.
 */
export function HoldButton({ label, onCommit, disabledReason = null, tone = 'self' }: HoldButtonProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const timer = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [nudge, setNudge] = useState(false);

  /** Ends a hold. `released` is a finger or key let go: if the hold had not gone through, say how. */
  const stop = (released = false): void => {
    if (released && timer.current !== null) setNudge(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };

  useEffect(() => {
    if (!nudge) return undefined;
    const expiry = window.setTimeout(() => { setNudge(false); }, NUDGE_MS);
    return () => { window.clearTimeout(expiry); };
  }, [nudge]);

  const start = (): void => {
    if (disabledReason !== null || timer.current !== null) return;
    haptic('tap');
    setNudge(false);
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      haptic('commit');
      onCommit();
    }, HOLD_MS);
  };

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!confirming) return undefined;
    const expiry = window.setTimeout(() => { setConfirming(false); }, CONFIRM_MS);
    return () => { window.clearTimeout(expiry); };
  }, [confirming]);

  /** A pointer click only ever answers the inline confirm, and only one that began here. */
  const confirmPress = useOwnPress(() => {
    if (!confirming) return;
    setConfirming(false);
    onCommit();
  });

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) start();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (confirming) {
        setConfirming(false);
        onCommit();
      } else {
        setConfirming(true);
      }
    }
  };

  if (disabledReason !== null) {
    return (
      <button
        type="button"
        disabled
        data-hold-refused=""
        className="flex h-11 w-full items-center justify-center rounded-control border border-v2-line-hi px-3 text-center font-v2-ui text-body text-v2-ink-2"
      >
        {disabledReason}
      </button>
    );
  }

  const tones = TONE[tone];
  return (
    <>
      <button
        type="button"
        data-hold=""
        {...(holding ? { 'data-holding': '' } : {})}
        aria-describedby={hintId}
        onPointerDown={(event) => {
          // Touch, pen and the primary mouse button arm it; the middle and secondary buttons do not.
          if (event.button !== 1 && event.button !== 2) start();
          confirmPress.onPointerDown();
        }}
        onPointerUp={() => { stop(true); }}
        onPointerLeave={() => { stop(); }}
        onPointerCancel={() => { stop(); }}
        onContextMenu={(event) => { event.preventDefault(); }}
        onClick={confirmPress.onClick}
        onKeyDown={onKeyDown}
        onKeyUp={(event) => { if (event.key === ' ') stop(true); }}
        onBlur={() => { stop(); setConfirming(false); }}
        className={`relative flex h-11 w-full touch-manipulation select-none items-center justify-center overflow-hidden rounded-control border px-3 font-v2-ui text-body font-bold text-v2-ink ${tones.frame}`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 ${tones.fill}`}
          style={{
            width: holding ? '100%' : '0%',
            transitionProperty: 'width',
            transitionTimingFunction: 'linear',
            transitionDuration: holding ? `${String(HOLD_MS)}ms` : '0ms',
          }}
        />
        <span
          aria-hidden="true"
          className={`absolute bottom-0 left-0 h-0.5 ${tones.bar}`}
          style={{
            width: holding ? '100%' : '0%',
            transitionProperty: 'width',
            transitionTimingFunction: 'linear',
            transitionDuration: holding ? `${String(HOLD_MS)}ms` : '0ms',
          }}
        />
        <span className="relative flex items-center gap-2">
          <svg data-hold-ring="" viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0 -rotate-90">
            <circle cx="8" cy="8" r="6" fill="none" strokeWidth="2" className={tones.track} />
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={RING}
              className={tones.ring}
              style={{
                strokeDashoffset: holding ? 0 : RING,
                transitionProperty: 'stroke-dashoffset',
                transitionTimingFunction: 'linear',
                transitionDuration: holding ? `${String(HOLD_MS)}ms` : '0ms',
              }}
            />
          </svg>
          {confirming ? t('hold.confirm', { label }) : nudge ? t('hold.release') : (
            // The gesture, named on the face; a reader hears it from the hint, not twice.
            <span><span aria-hidden="true">{`${t('hold.verb')} · `}</span>{label}</span>
          )}
        </span>
      </button>
      <span id={hintId} className="sr-only">{t('hold.hint')}</span>
    </>
  );
}
