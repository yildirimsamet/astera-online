import type { HullClass } from '@astera/rules';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { combatClassLabel } from '../i18n/names.js';
import { factor } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { Glyph, type GlyphId } from './icons.js';
import { cargoFit, rangeGeometry, ringFraction, type Span } from './logic.js';
import type { CssVars } from './style.js';

const pct = (value: number): string => `${String(value)}%`;

/** A chosen count: teal, outlined, and it bumps when it changes. Zero shows a quiet plus. */
export function CountBadge({ value }: { value: number }) {
  if (value <= 0) return <span className="gk-count gk-count--idle" aria-hidden="true"><Glyph id="plus" /></span>;
  return <span key={value} className="gk-count gk-num">{value}</span>;
}

/** How a ship meets the target's main class: ×1,6 green, ×0,625 red, ×1 steel — every digit the rules have. */
export function MultiplierBadge({ value }: { value: number }) {
  useTranslation(); // draws again in a new language: `factor` writes the locale's decimal mark
  const look = value > 1 ? ' gk-mult--good' : value < 1 ? ' gk-mult--hostile' : '';
  return (
    <span className={`gk-mult${look}`}>
      {value !== 1 && <Glyph id={value > 1 ? 'up' : 'down'} />}
      <span>{factor(value)}</span>
    </span>
  );
}

export function LevelBadge({ level }: { level: number }) {
  return <span className="gk-level gk-num gk-outlined">{level}</span>;
}

export function LockBadge({ reason }: { reason: string }) {
  return <span className="gk-lock"><Glyph id="lock" />{reason}</span>;
}

export function Dot({ count }: { count: number }) {
  return <span className="gk-dot gk-num">{count > 99 ? '99+' : count}</span>;
}

const CLASS_MARK: Record<HullClass, { glyph: GlyphId; plate: string }> = {
  SKIRMISHER: { glyph: 'class_skirmisher', plate: ' gk-emblem--skirmisher' },
  LANCE: { glyph: 'class_lance', plate: ' gk-emblem--lance' },
  BULWARK: { glyph: 'class_bulwark', plate: ' gk-emblem--bulwark' },
  SUPPORT: { glyph: 'class_support', plate: '' },
};

/**
 * A combat class as its mark on a plate of its own colour (owner 2026-11-12, "A · Evrim" on
 * "R1b"): Akıncı pink, Mızrak violet, Sur blue; Destek, which does not fight, steel. An
 * enemy's class keeps its colour inside a red frame. The live game still draws v2's
 * colourless ClassEmblem until its screens move to the kit (stage 4).
 */
export function Emblem({ cls, hostile = false }: { cls: HullClass; hostile?: boolean }) {
  const mark = CLASS_MARK[cls];
  return (
    <span role="img" aria-label={combatClassLabel(cls)} className={`gk-emblem${mark.plate}${hostile ? ' gk-emblem--hostile' : ''}`}>
      <Glyph id={mark.glyph} />
    </span>
  );
}

export type BarTone = 'self' | 'good' | 'hostile' | 'warn' | 'deut' | 'alloy' | 'crystal';

/** A filled bar in a glass groove. `segments` cuts it into steps; words make it thick enough to hold them. */
export function ProgressBar({
  value, max, tone = 'self', segments, text, label,
}: {
  value: number;
  max: number;
  tone?: BarTone;
  segments?: number;
  text?: ReactNode;
  label?: string;
}) {
  const share = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  const style: CssVars | undefined = segments ? { '--seg': `calc(100% / ${String(segments)})` } : undefined;
  return (
    <div
      className={`gk-bar${tone === 'self' ? '' : ` gk-fill-${tone}`}${segments ? ' gk-bar--segments' : ''}${text === undefined ? '' : ' gk-bar--thick'}`}
      style={style}
      {...(label === undefined ? { 'aria-hidden': true } : {
        role: 'progressbar', 'aria-label': label, 'aria-valuenow': value, 'aria-valuemin': 0, 'aria-valuemax': max,
      })}
    >
      <span className="gk-bar__fill" style={{ width: pct(share * 100) }} />
      {text !== undefined && <span className="gk-bar__text gk-outlined">{text}</span>}
    </div>
  );
}

/**
 * MY POWER AND THEIRS ON ONE AXIS. Each side is a range: solid to what is certain,
 * striped to how far it may reach. A side not fully scouted hatches to the end with
 * a "?" — never a verdict.
 */
export function RangeBars({
  mine, theirs, mineLabel, theirsLabel, mineText, theirsText,
}: {
  mine: Span;
  theirs: { low: number; high: number | null };
  mineLabel: string;
  theirsLabel: string;
  mineText: string;
  theirsText: string;
}) {
  const g = rangeGeometry(mine, theirs);
  return (
    <div className="gk-range">
      <span className="gk-range__side gk-tone-self">{mineLabel}</span>
      <div className="gk-bar" aria-hidden="true">
        <span className="gk-bar__reach" style={{ width: pct(g.mine.reach) }} />
        <span className="gk-bar__fill" style={{ width: pct(g.mine.solid) }} />
      </div>
      <span className="gk-range__value gk-display gk-num gk-outlined gk-tone-self">{mineText}</span>
      <span className="gk-range__side gk-tone-hostile">{theirsLabel}</span>
      <div className="gk-bar gk-fill-hostile" aria-hidden="true">
        {g.theirs.unknown
          ? <span className="gk-bar__unknown" style={{ width: pct(100 - g.theirs.solid) }} />
          : <span className="gk-bar__reach" style={{ width: pct(g.theirs.reach) }} />}
        <span className="gk-bar__fill" style={{ width: pct(g.theirs.solid) }} />
        {g.theirs.unknown && <span className="gk-bar__text gk-outlined" style={{ left: pct(g.theirs.solid) }}>?</span>}
      </div>
      <span className="gk-range__value gk-display gk-num gk-outlined gk-tone-hostile">{theirsText}</span>
    </div>
  );
}

/** What a trip burns out of a stock: the bar is the stock, the striped end is the spend. */
export function SpendBar({ spend, stock, label, art, text }: { spend: number; stock: number; label: string; art: string; text: string }) {
  const short = spend > stock;
  const left = stock <= 0 ? 0 : Math.max(0, (stock - spend) / stock) * 100;
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2" role="group" aria-label={`${label} ${text}`}>
      <img src={art} alt="" className="size-6 object-contain" />
      <div className="grid gap-1">
        <span className="gk-label">{label}</span>
        <div className={`gk-bar ${short ? 'gk-fill-hostile' : 'gk-fill-deut'}`} aria-hidden="true">
          <span className="gk-bar__reach" style={{ width: '100%' }} />
          <span className="gk-bar__fill" style={{ width: pct(left) }} />
        </div>
      </div>
      <span className={`gk-spend__value gk-display gk-num gk-outlined${short ? ' gk-tone-hostile' : ''}`}>{text}</span>
    </div>
  );
}

/** Whether the hold carries the loot: the hold fills, the loot band is bracketed. */
export function CargoBar({ capacity, loot }: { capacity: number; loot: Span }) {
  const g = cargoFit(capacity, loot);
  const fill = g.fit === 'covers' ? 'gk-fill-good' : g.fit === 'partial' ? 'gk-fill-warn' : 'gk-fill-hostile';
  return (
    <div className={`gk-bar ${fill}`} aria-hidden="true">
      <span className="gk-bar__fill" style={{ width: pct(g.capacity) }} />
      <span className="gk-bar__band" style={{ left: pct(g.low), width: pct(g.high - g.low) }} />
    </div>
  );
}

export type StatTone = 'neutral' | 'warn' | 'hostile' | 'good';

/** A figure in a glass well: what it is, the value, and one line under it. */
export function StatPlaque({
  glyph, art, label, value, sub, tone = 'neutral', children,
}: {
  glyph?: GlyphId;
  art?: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: StatTone;
  children?: ReactNode;
}) {
  return (
    <div className={`gk-stat gk-well${tone === 'neutral' ? '' : ` gk-stat--${tone}`}`}>
      <span className="gk-stat__icon" aria-hidden="true">
        {art ? <img src={art} alt="" /> : glyph ? <Glyph id={glyph} /> : null}
      </span>
      <span className="gk-stat__body">
        <span className="gk-label">{label}</span>
        <span className="gk-stat__value gk-display gk-num gk-outlined">{value}</span>
        {sub !== undefined && <span className="gk-stat__sub">{sub}</span>}
        {children}
      </span>
    </div>
  );
}

export interface HudResource {
  id: string;
  art: string;
  amount: string;
  /** Production per hour, already formatted ("+2,2K"). */
  rate?: string;
  /** How full the store is, 0…1; full turns the amount yellow. */
  store?: number;
  tone: 'alloy' | 'crystal' | 'deut';
  label: string;
}

/** The resource bar across the top: art overlapping a dark pill, as games draw it. */
export function ResourceHud({ items, end }: { items: readonly HudResource[]; end?: ReactNode }) {
  return (
    <div className="gk-hud">
      {items.map((item) => (
        <div
          key={item.id}
          className={`gk-res${(item.store ?? 0) >= 1 ? ' gk-res--full' : ''}`}
          style={{ color: `var(--gk-${item.tone})` }}
          aria-label={`${item.label} ${item.amount}`}
          role="group"
        >
          <img className="gk-res__art" src={item.art} alt="" />
          <span className="gk-res__amount gk-display gk-num gk-outlined">{item.amount}</span>
          {item.rate !== undefined && <span className="gk-res__rate">{item.rate}</span>}
          {item.store !== undefined && <span className="gk-res__store"><span style={{ width: pct(Math.min(1, item.store) * 100) }} /></span>}
        </div>
      ))}
      {end}
    </div>
  );
}

/** A countdown ring with the time beside it. */
export type StatusTone = 'good' | 'hostile' | 'warn' | 'info';

/**
 * AN EFFECT ON A FLEET OR A WORLD: a coin of its colour holding its mark, the size of the
 * change, and the time it has left. Green helps you, red hurts you, yellow is a risk you can
 * still dodge. The name is for a screen reader; on screen the mark carries it.
 */
export function StatusChip({ glyph, tone, label, value, until }: { glyph: GlyphId; tone: StatusTone; label: string; value: string; until?: string }) {
  return (
    <span className="gk-status" data-tone={tone}>
      <span className="gk-status__coin"><Glyph id={glyph} /></span>
      <span className="sr-only">{label}</span>
      <span className="gk-status__value gk-num">{value}</span>
      {until !== undefined && <span className="gk-status__until gk-num">{until}</span>}
    </span>
  );
}

export function Timer({ remaining, total, text, glyph = 'clock' }: { remaining: number; total: number; text: string; glyph?: GlyphId }) {
  const left = ringFraction(remaining, total);
  const length = 2 * Math.PI * 14;
  return (
    <span className="gk-timer">
      <span className="gk-timer__ring" aria-hidden="true">
        <svg viewBox="0 0 34 34">
          <circle className="gk-timer__track" cx="17" cy="17" r="14" />
          <circle className="gk-timer__arc" cx="17" cy="17" r="14" strokeDasharray={length} strokeDashoffset={length * (1 - left)} />
        </svg>
        <Glyph id={glyph} />
      </span>
      <span className="gk-timer__time gk-display gk-num gk-outlined">{text}</span>
    </span>
  );
}

/** One line of a ranked list: medal, crest, name, the number it is ranked by. */
export function ListRow({
  rank, crest, name, sub, value, me = false, onPress,
}: {
  rank: number;
  crest: string;
  name: string;
  sub?: string;
  value: string;
  me?: boolean;
  onPress: () => void;
}) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onPress(); });
  const medal = rank <= 3 ? ` gk-rank--medal gk-rank--${String(rank)}` : '';
  return (
    <button type="button" className="gk-row" {...(me ? { 'data-me': '' } : {})} onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className={`gk-rank gk-display gk-num${medal}`}>{rank}</span>
      <span className="gk-avatar gk-display gk-outlined">{crest}</span>
      <span className="min-w-0">
        <span className="gk-row__name">{name}</span>
        {sub !== undefined && <span className="gk-sub block truncate">{sub}</span>}
      </span>
      <span className="gk-row__value gk-display gk-num gk-outlined">{value}</span>
    </button>
  );
}
