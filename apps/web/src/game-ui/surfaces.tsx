import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound, type SoundCue } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { RoundButton } from './buttons.js';
import { Glyph, type GlyphId } from './icons.js';
import { Timer, type TimerTone } from './readouts.js';
import type { CssVars } from './style.js';

type Edge = 'self' | 'hostile' | 'warn';

/** A metal plate. `bolts` adds the four corner bolts; `edge` lights the rim in a role colour. */
export function Plate({
  children, bolts = false, edge, className = '', as: Tag = 'div',
}: {
  children: ReactNode;
  bolts?: boolean;
  edge?: Edge;
  className?: string;
  as?: 'div' | 'section';
}) {
  return <Tag className={`gk-plate${bolts ? ' gk-bolts' : ''}${edge ? ` gk-edge-${edge}` : ''} ${className}`}>{children}</Tag>;
}

/** A glass screen set into a plate: numbers and bars live here. */
export function Well({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`gk-well ${className}`}>{children}</div>;
}

/** A plate with cut corners; `tone` lights the edge and washes the face from the left. */
export function CutPlate({
  children, tone, cut, className = '',
}: {
  children: ReactNode;
  tone?: 'self' | 'hostile';
  cut?: number;
  className?: string;
}) {
  const style: CssVars | undefined = cut === undefined ? undefined : { '--cut': `${String(cut)}px` };
  return <div className={`gk-cut${tone ? ` gk-cut--${tone}` : ''} ${className}`} style={style}>{children}</div>;
}

/** A stencil tag naming a section, with a rule out to the edge and an optional note at the end. */
export function SectionTag({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="gk-tag">
      <span className="gk-tag__name">{children}</span>
      <span className="gk-tag__rule" aria-hidden="true" />
      {aside !== undefined && <span className="gk-tag__aside">{aside}</span>}
    </div>
  );
}

/**
 * THE SHEET AS A GAME DRAWS IT: a grab bar, a header plate with the subject's art,
 * a scrolling body, and a footer plate the primary move lives on (thumb reach).
 * Presentational: the v2 `Sheet` keeps its drag and detent behaviour.
 */
export function SheetFrame({
  art, eyebrow, title, meta, tone, onClose, children, footer, className = '',
}: {
  art?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  tone?: 'self' | 'hostile';
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section className={`gk gk-sheet ${className}`} aria-labelledby={titleId}>
      <div className="gk-sheet__grab" aria-hidden="true" />
      <CutPlate tone={tone} className="gk-sheet__head">
        {art ? <img className="gk-sheet__art" src={art} alt="" /> : <span />}
        <div className="min-w-0">
          {eyebrow !== undefined && <div className="gk-sheet__eyebrow">{eyebrow}</div>}
          <h2 id={titleId} className="gk-sheet__title gk-display gk-outlined">{title}</h2>
          {meta !== undefined && <div className="gk-sheet__meta">{meta}</div>}
        </div>
        {onClose ? <RoundButton glyph="close" label={t('sheet.close')} onPress={onClose} /> : <span />}
      </CutPlate>
      <div className="gk-sheet__body">{children}</div>
      {footer !== undefined && <div className="gk-sheet__foot">{footer}</div>}
    </section>
  );
}

/** A centred window over a scrim, with a ribbon title. `rays` turns slow light behind a reward. */
export function Dialog({
  ribbon, tone = 'info', children, actions, rays = false, sound,
}: {
  ribbon: ReactNode;
  tone?: 'good' | 'hostile' | 'info';
  children: ReactNode;
  actions?: ReactNode;
  rays?: boolean;
  /** The moment's own sound, once as it opens: `rankup` for a new rank, clan level or medal. */
  sound?: SoundCue;
}) {
  const titleId = useId();
  const rang = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  // Focus starts inside, so a keyboard or a reader is in the dialog it was shown.
  useEffect(() => { box.current?.focus(); }, []);
  useEffect(() => {
    if (sound === undefined || rang.current) return;
    rang.current = true;
    playSound(sound);
  }, [sound]);
  return (
    <div className="gk gk-scrim">
      {rays && <span className="gk-rays" aria-hidden="true" />}
      <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`gk-dialog gk-dialog--${tone} gk-plate gk-bolts`}>
        <div id={titleId} className="gk-dialog__ribbon gk-display gk-outlined">{ribbon}</div>
        {children}
        {actions !== undefined && <div className="mt-3 grid gap-1">{actions}</div>}
      </div>
    </div>
  );
}

const BANNER_GLYPH: Record<'info' | 'good' | 'warn' | 'hostile', GlyphId> = {
  info: 'help', good: 'check', warn: 'warn', hostile: 'attack',
};

/**
 * A LINE THAT TELLS: a risk under the launch, a toast after an action. The tone
 * colours the rim and the icon, never the words, so it stays readable.
 */
export function Banner({
  tone = 'info', title, body, action, variant = 'block', glyph, role = variant === 'toast' ? 'status' : null,
}: {
  tone?: 'info' | 'good' | 'warn' | 'hostile';
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  variant?: 'block' | 'strip' | 'toast';
  glyph?: GlyphId;
  /** How it is read out: a toast speaks as a status; `null` where the place it sits in already speaks for it. */
  role?: 'status' | 'alert' | null;
}) {
  return (
    <div
      className={`gk-banner${tone === 'info' ? '' : ` gk-banner--${tone}`} gk-banner--${variant}`}
      {...(role === null ? {} : { role })}
    >
      <span className="gk-banner__icon" aria-hidden="true"><Glyph id={glyph ?? BANNER_GLYPH[tone]} /></span>
      <span className="min-w-0">
        <span className="gk-banner__title block">{title}</span>
        {body !== undefined && <span className="gk-banner__body block">{body}</span>}
      </span>
      {action ?? <span />}
    </div>
  );
}

/** Nothing here yet — said with the art of what will be here, and the step that brings it. */
export function EmptyState({ art, title, body, action }: { art: string; title: ReactNode; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="gk-empty">
      <img className="gk-empty__art" src={art} alt="" />
      <div className="gk-empty__title gk-display gk-outlined">{title}</div>
      <p className="gk-empty__body">{body}</p>
      {action}
    </div>
  );
}

/**
 * THE GUIDING HAND: a ring pulsing on the thing to press, a hand tapping it, and one
 * short line. Placed in percent of its positioned parent; it never takes the tap.
 */
export function CoachMark({
  x, y, text, step, hand, bubble = 'above',
}: {
  x: number;
  y: number;
  text: ReactNode;
  step?: ReactNode;
  hand: string;
  bubble?: 'above' | 'below';
}) {
  const place = bubble === 'above' ? { bottom: '42px' } : { top: '48px' };
  return (
    <div className="gk-coach" style={{ left: `${String(x)}%`, top: `${String(y)}%` }}>
      <span className="gk-coach__ring" aria-hidden="true" />
      <img className="gk-coach__hand" src={hand} alt="" />
      {/* Shifted by its own width at the share the point sits at: inside the frame at either edge. */}
      <div className="gk-coach__bubble" style={{ ...place, left: 0, translate: `-${String(x)}% 0` }}>
        {step !== undefined && <span className="gk-coach__step">{step}</span>}
        {text}
      </div>
    </div>
  );
}

/**
 * THE CARD AT THE FOOT OF THE GALAXY (G1-d, 2026-11-14): the one thing that matters now — an
 * attack coming, a galaxy event, a suggestion. A cut plate in the colour of whose it is, the
 * thing's mark in a ring that drains over its clock (only the track when its whole is not
 * known), the time large beside what it is, a line of what, a clause of why, and what to do on
 * its own row. It beats only for an enemy: a card that always moves is a card nobody reads.
 */
export function ContextCard({
  tone, glyph, eyebrow, title, timer, children, actions, tools, onDismiss, dismissLabel, onFold, foldLabel,
}: {
  tone: TimerTone;
  glyph: GlyphId;
  /** What it is ("Incoming attack"); it names the region. */
  eyebrow: string;
  title?: string;
  /** Its clock: the ring's reading, and the words beside it when the body does not already say them. */
  timer?: { remaining: number; total: number; text?: string };
  /** Why: one clause, or the rows of what it holds. */
  children?: ReactNode;
  actions?: ReactNode;
  /** Round presses in the head beside the close (look at it): a second press that keeps the actions on one row. */
  tools?: ReactNode;
  onDismiss: () => void;
  dismissLabel: string;
  /** Fold it to one line (a suggestion, at the size the player chose). */
  onFold?: () => void;
  foldLabel?: string;
}) {
  return (
    <section aria-label={eyebrow} data-tone={tone} className={`gk-ccard gk-cut gk-cut--${tone}`}>
      <div className="gk-ccard__head">
        <Timer remaining={timer?.remaining ?? 0} total={timer?.total ?? 0} glyph={glyph} tone={tone} beat={tone === 'hostile'} />
        <span className="gk-ccard__heading">
          <span className="gk-label gk-ccard__eyebrow">{eyebrow}</span>
          {timer?.text !== undefined && <span className="gk-ccard__time gk-display gk-num">{timer.text}</span>}
        </span>
        {tools}
        {onFold !== undefined && <RoundButton small glyph="down" label={foldLabel ?? ''} onPress={onFold} />}
        <RoundButton small glyph="close" label={dismissLabel} onPress={onDismiss} />
      </div>
      {title !== undefined && title !== '' && <p className="gk-ccard__title">{title}</p>}
      {children !== undefined && <div className="gk-ccard__body">{children}</div>}
      {actions !== undefined && <div className="gk-ccard__actions">{actions}</div>}
    </section>
  );
}

/** A folded card: one line, one press — what it is and its title, in its colour — that opens it again. */
export function ContextStrip({ tone, glyph, eyebrow, title, label, onPress }: {
  tone: TimerTone;
  glyph: GlyphId;
  eyebrow: string;
  title: string;
  /** What the press does ("Show"). */
  label: string;
  onPress: () => void;
}) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onPress(); });
  return (
    <button type="button" {...OWN_SOUND} aria-label={label} data-tone={tone} className="gk-cstrip" onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className={`gk-cut gk-cut--${tone} gk-cstrip__plate`}>
        <span className="gk-cstrip__coin" aria-hidden="true"><Glyph id={glyph} /></span>
        <span className="gk-label gk-cstrip__eyebrow">{eyebrow}</span>
        <span className="gk-cstrip__title">{title}</span>
        <span className="gk-cstrip__open" aria-hidden="true"><Glyph id="next" /></span>
      </span>
    </button>
  );
}
