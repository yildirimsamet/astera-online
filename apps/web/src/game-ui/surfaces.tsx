import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RoundButton } from './buttons.js';
import { Glyph, type GlyphId } from './icons.js';
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
  ribbon, tone = 'info', children, actions, rays = false,
}: {
  ribbon: ReactNode;
  tone?: 'good' | 'hostile' | 'info';
  children: ReactNode;
  actions?: ReactNode;
  rays?: boolean;
}) {
  const titleId = useId();
  return (
    <div className="gk gk-scrim">
      {rays && <span className="gk-rays" aria-hidden="true" />}
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={`gk-dialog gk-dialog--${tone} gk-plate gk-bolts`}>
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
  tone = 'info', title, body, action, variant = 'block', glyph,
}: {
  tone?: 'info' | 'good' | 'warn' | 'hostile';
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  variant?: 'block' | 'strip' | 'toast';
  glyph?: GlyphId;
}) {
  return (
    <div
      className={`gk-banner${tone === 'info' ? '' : ` gk-banner--${tone}`} gk-banner--${variant}`}
      {...(variant === 'toast' ? { role: 'status' } : {})}
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
      <div className="gk-coach__bubble" style={{ ...place, left: '-110px' }}>
        {step !== undefined && <span className="gk-coach__step">{step}</span>}
        {text}
      </div>
    </div>
  );
}
