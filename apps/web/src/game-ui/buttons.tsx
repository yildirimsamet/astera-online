import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { playSound, type SoundCue } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { HOLD_MS, useHoldPress } from '../v2/kit/useHoldPress.js';
import { Glyph, type GlyphId } from './icons.js';
import type { CssVars } from './style.js';

export type ButtonTone = 'action' | 'steel' | 'self' | 'danger' | 'ghost';

const tone = (value: ButtonTone): string => (value === 'steel' ? '' : ` gk-btn--${value}`);

/** Every press in the kit answers at once: a click and a light tick, before the game does. */
const answer = (): void => {
  playSound('tap');
  haptic('tap');
};

export interface GameButtonProps {
  children: ReactNode;
  onPress: () => void;
  tone?: ButtonTone;
  size?: 'lg' | 'md' | 'sm';
  wide?: boolean;
  glyph?: GlyphId;
  /** A price drawn on the face: resource art and amount. */
  cost?: ReactNode;
  /** A second, smaller line on the face. */
  detail?: ReactNode;
  /** Set when it cannot be pressed: the reason replaces the label, so a dead button still speaks. */
  disabledReason?: string | null;
  pending?: boolean;
  className?: string;
}

/**
 * A PRESSABLE MATERIAL. A lit face over a darker lip; pressing sinks the face onto
 * the lip. `action` is the one primary move on a screen; `steel` the ordinary one;
 * `danger` spends or loses something.
 */
export function GameButton({
  children, onPress, tone: look = 'steel', size = 'md', wide = false, glyph, cost, detail,
  disabledReason = null, pending = false, className = '',
}: GameButtonProps) {
  const own = useOwnPress(() => {
    if (pending || disabledReason !== null) return;
    answer();
    onPress();
  });
  const sizing = size === 'md' ? '' : ` gk-btn--${size}`;
  return (
    <button
      type="button"
      className={`gk-btn${tone(look)}${sizing}${wide ? ' gk-btn--wide' : ''} ${className}`}
      disabled={disabledReason !== null}
      aria-busy={pending || undefined}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      {pending ? <span className="gk-spin" aria-hidden="true" /> : glyph ? <span className="gk-btn__glyph"><Glyph id={glyph} /></span> : null}
      {disabledReason ?? (
        detail === undefined ? <span>{children}</span> : (
          <span className="grid justify-items-center gap-0.5">
            <span>{children}</span>
            <span className="gk-btn__detail">{detail}</span>
          </span>
        )
      )}
      {cost !== undefined && disabledReason === null && <span className="gk-btn__cost">{cost}</span>}
    </button>
  );
}

/** A round button: close, back, help. The face is 36 px, the hit area 44. */
export function RoundButton({
  glyph, label, onPress, tone: look = 'steel', small = false,
}: {
  glyph: GlyphId;
  label: string;
  onPress: () => void;
  tone?: 'steel' | 'danger' | 'self';
  small?: boolean;
}) {
  const own = useOwnPress(() => { answer(); onPress(); });
  return (
    <button
      type="button"
      aria-label={label}
      className={`gk-round${look === 'steel' ? '' : ` gk-round--${look}`}${small ? ' gk-round--small' : ''}`}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      <span className="gk-round__face"><Glyph id={glyph} /></span>
    </button>
  );
}

/** A small pill — MAX, a filter — that is still a 44 px target. */
export function Chip({
  children, onPress, on = false, label, disabled = false,
}: {
  children: ReactNode;
  onPress: () => void;
  on?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const own = useOwnPress(() => { answer(); onPress(); });
  return (
    <button
      type="button"
      className="gk-hit"
      disabled={disabled}
      {...(label === undefined ? {} : { 'aria-label': label })}
      {...(on ? { 'aria-pressed': true } : {})}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      <span className="gk-chip" {...(on ? { 'data-on': '' } : {})}>{children}</span>
    </button>
  );
}

export interface GameHoldProps {
  /** The verb, short: "Saldır". */
  label: string;
  /** What it spends, beside the verb: "39 gemi". */
  detail?: ReactNode;
  onCommit: () => void;
  disabledReason?: string | null;
  tone?: 'action' | 'danger';
  glyph?: GlyphId;
  commitSound?: SoundCue;
}

/**
 * HOLD TO COMMIT, AS A GAME DRAWS IT. The same gesture and rules as the v2
 * `HoldButton` (`useHoldPress`): a dial at the left fills while the finger stays
 * down, the face rumbles, and the commit flashes. A tap says how to do it.
 */
export function GameHold({
  label, detail, onCommit, disabledReason = null, tone: look = 'action', glyph = 'rocket', commitSound = 'confirm',
}: GameHoldProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const [committed, setCommitted] = useState(0);
  const commit = (): void => {
    playSound(commitSound);
    setCommitted((n) => n + 1);
    onCommit();
  };
  const { holding, confirming, nudge, handlers } = useHoldPress(commit, disabledReason !== null);

  useEffect(() => {
    if (committed === 0) return undefined;
    const done = window.setTimeout(() => { setCommitted(0); }, 420);
    return () => { window.clearTimeout(done); };
  }, [committed]);

  const face = `gk-btn gk-btn--${look} gk-btn--lg gk-hold`;
  if (disabledReason !== null) {
    return (
      <button type="button" disabled className={face}>
        <span className="gk-hold__dial"><Glyph id="lock" /></span>
        <span className="gk-hold__words"><span className="gk-btn__detail">{disabledReason}</span></span>
      </button>
    );
  }

  const style: CssVars = { '--gk-hold-ms': `${String(HOLD_MS)}ms` };
  const hint = confirming ? t('hold.confirm', { label }) : nudge ? t('hold.release') : t('hold.verb');
  return (
    <>
      <button
        type="button"
        className={face}
        style={style}
        aria-describedby={hintId}
        {...(holding ? { 'data-holding': '' } : {})}
        {...(committed > 0 ? { 'data-committed': '' } : {})}
        {...handlers}
      >
        <span className="gk-hold__fill" aria-hidden="true" />
        <span className="gk-hold__dial" aria-hidden="true">
          <svg className="gk-hold__ring" viewBox="0 0 48 48">
            <circle className="gk-hold__track" cx="24" cy="24" r="21" />
            <circle className="gk-hold__arc" cx="24" cy="24" r="21" />
          </svg>
          <Glyph id={glyph} />
        </span>
        <span className="gk-hold__words">
          <span className="gk-hold__label">{label}</span>
          <span className="gk-btn__detail">{hint}</span>
        </span>
        {detail !== undefined && <span className="gk-hold__aside">{detail}</span>}
      </button>
      <span id={hintId} className="sr-only">{t('hold.hint')}</span>
    </>
  );
}
