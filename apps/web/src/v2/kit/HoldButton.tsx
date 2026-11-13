import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { HOLD_MS, useHoldPress } from './useHoldPress.js';

export { HOLD_MS };
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
  /** A `data-*` name for the control, so a surface can find its own hold among several. */
  marker?: string;
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
export function HoldButton({ label, onCommit, disabledReason = null, tone = 'self', marker }: HoldButtonProps) {
  const mark = marker ? { [`data-${marker}`]: '' } : {};
  const { t } = useTranslation();
  const hintId = useId();
  const { holding, confirming, nudge, handlers } = useHoldPress(onCommit, disabledReason !== null);

  if (disabledReason !== null) {
    return (
      <button
        type="button"
        disabled
        data-hold-refused=""
        {...mark}
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
        {...mark}
        {...(holding ? { 'data-holding': '' } : {})}
        aria-describedby={hintId}
        {...handlers}
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
