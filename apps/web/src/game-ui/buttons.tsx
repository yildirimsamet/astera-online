import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, holdSound, playSound, type SoundCue } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { HOLD_MS, useHoldPress } from '../v2/kit/useHoldPress.js';
import { artIconSrc } from './art.js';
import { Glyph, type GlyphId } from './icons.js';
import { Dot } from './readouts.js';
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
  /**
   * A one-press commitment that spends (owner 2026-11-12, 4.1: Upgrade): it answers with
   * the commit cue and buzz instead of a tap, so the press lands with its weight.
   */
  heavy?: boolean;
}

/**
 * A PRESSABLE MATERIAL. A lit face over a darker lip; pressing sinks the face onto
 * the lip. `action` is the one primary move on a screen; `steel` the ordinary one;
 * `danger` spends or loses something.
 */
export function GameButton({
  children, onPress, tone: look = 'steel', size = 'md', wide = false, glyph, cost, detail,
  disabledReason = null, pending = false, className = '', heavy = false,
}: GameButtonProps) {
  const own = useOwnPress(() => {
    if (pending || disabledReason !== null) return;
    if (heavy) {
      playSound('confirm');
      haptic('commit');
    } else answer();
    onPress();
  });
  const sizing = size === 'md' ? '' : ` gk-btn--${size}`;
  return (
    <button
      type="button"
      {...OWN_SOUND}
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

/** What a round button wears: a glyph, letters (a commander's initials) or a painting at its full 40 px. */
type RoundFace =
  | { glyph: GlyphId; face?: undefined; art?: undefined }
  | { face: string; glyph?: undefined; art?: undefined }
  | { art: string; glyph?: undefined; face?: undefined };

/** A round button: close, back, help. The face is 36 px, the hit area 44. */
export function RoundButton({
  glyph, face, art, label, onPress, tone: look = 'steel', small = false, count = 0, urgent = false, lit = false,
}: RoundFace & {
  label: string;
  onPress: () => void;
  tone?: 'steel' | 'danger' | 'self';
  small?: boolean;
  /** News behind it, in the red of news; nothing at zero. */
  count?: number;
  /** Something that cannot wait: the button beats. A count alone never does — a bar that always moves is not read. */
  urgent?: boolean;
  /** A state of its own is on (a sensor's reach drawn on the map): a light at its foot. */
  lit?: boolean;
}) {
  const own = useOwnPress(() => { answer(); onPress(); });
  /*
    A count that rises is news arriving: the face swings once (its key restarts the swing),
    a falling count is quiet. Adjusted while rendering, so the swing lands with the number.
  */
  const [news, setNews] = useState({ seen: 0, rang: 0 });
  if (count !== news.seen) setNews({ seen: count, rang: count > news.seen ? news.rang + 1 : news.rang });
  return (
    <button
      type="button"
      {...OWN_SOUND}
      aria-label={label}
      className={`gk-round${look === 'steel' ? '' : ` gk-round--${look}`}${small ? ' gk-round--small' : ''}${art === undefined ? '' : ' gk-round--art'}`}
      {...(urgent ? { 'data-urgent': '' } : {})}
      {...(lit ? { 'data-lit': '' } : {})}
      {...(news.rang > 0 ? { 'data-rang': String(news.rang) } : {})}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      {art === undefined
        ? <span key={news.rang} className="gk-round__face">{glyph === undefined ? <span className="gk-round__letters gk-display">{face}</span> : <Glyph id={glyph} />}</span>
        : <img key={news.rang} className="gk-round__art" src={art} alt="" draggable={false} />}
      {count > 0 && <span className="gk-round__count" aria-hidden="true"><Dot count={count} /></span>}
    </button>
  );
}

/**
 * THE COMMANDER'S MEDALLION (G1-b, 2026-11-14): their initials inside a painted ring at the
 * end of the top bar. It is the menu — the one door to everything that is not the galaxy.
 */
export function Medallion({ initials, label, onPress }: { initials: string; label: string; onPress: () => void }) {
  const own = useOwnPress(() => { answer(); onPress(); });
  return (
    <button type="button" {...OWN_SOUND} aria-label={label} className="gk-medal" onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-medal__face gk-display" aria-hidden="true">{initials}</span>
      <img className="gk-medal__ring" src={artIconSrc('hud-medallion')} alt="" draggable={false} />
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
      {...OWN_SOUND}
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
  /** How heavy the action is; a heavier one holds longer. No default: each action picks its own (stage 4). */
  weight: HoldWeight;
}

/**
 * THREE WEIGHTS OF HOLD (owner 2026-11-12, standard 2.6): what can be undone holds 0.6 s,
 * what spends 1 s, what is final 1.5 s — so leaving a clan never feels like a launch.
 */
export type HoldWeight = 'reversible' | 'spends' | 'final';
const HOLD_WEIGHT_MS: Record<HoldWeight, number> = { reversible: HOLD_MS, spends: 1000, final: 1500 };

/**
 * HOLD TO COMMIT, AS A GAME DRAWS IT. The same gesture and rules as the v2
 * `HoldButton` (`useHoldPress`): a dial at the left fills while the finger stays
 * down, the face rumbles, and the commit flashes. A tap says how to do it.
 */
export function GameHold({
  label, detail, onCommit, disabledReason = null, tone: look = 'action', glyph = 'rocket', commitSound = 'confirm', weight,
}: GameHoldProps) {
  const holdMs = HOLD_WEIGHT_MS[weight];
  const { t } = useTranslation();
  const hintId = useId();
  const [committed, setCommitted] = useState(0);
  const commit = (): void => {
    playSound(commitSound);
    setCommitted((n) => n + 1);
    onCommit();
  };
  const { holding, confirming, nudge, handlers } = useHoldPress(commit, disabledReason !== null, holdMs);
  // the charge lasts the whole hold, quickening with the dial, and stops the moment the hold ends
  useEffect(() => {
    if (!holding) return undefined;
    return holdSound('charge', holdMs / 1000);
  }, [holding, holdMs]);

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

  const style: CssVars = { '--gk-hold-ms': `${String(holdMs)}ms` };
  // the verb keeps one line: a long one (German, at 320 px) shrinks to fit it, never cut
  const labelLength: CssVars = { '--gk-len': label.length };
  const hint = confirming ? t('hold.confirm', { label }) : nudge ? t('hold.release') : t('hold.verb');
  return (
    <>
      <button
        type="button"
        {...OWN_SOUND}
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
          <span className="gk-hold__label" style={labelLength}>{label}</span>
          <span className="gk-btn__detail">{hint}</span>
        </span>
        {detail !== undefined && <span className="gk-hold__aside">{detail}</span>}
      </button>
      <span id={hintId} className="sr-only">{t('hold.hint')}</span>
    </>
  );
}
