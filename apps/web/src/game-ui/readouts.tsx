import type { HullClass } from '@astera/rules';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { combatClassLabel } from '../i18n/names.js';
import { compact, factor } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { RESOURCE_ART } from '../ui/assets.js';
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
  /** Production per hour, already formatted ("+2,2K"); a pool, when given, takes its line. */
  rate?: string;
  /** How full the store is, 0…1; full turns the amount yellow. */
  store?: number;
  /** The share of the store a raid cannot take, 0…1: a tick on the store bar. */
  safe?: number;
  /**
   * What waits in the works for this store, already formatted, in the colour of what a
   * press does: green worth collecting, yellow a gap to close (the vessel is full and has
   * stopped, or the store has no room for it), quiet while there is little.
   */
  pool?: { text: string; tone: 'good' | 'warn' | 'quiet' };
  /** A press is worth it now: the pill breathes until it is pressed. */
  ripe?: boolean;
  /** Not in use yet (a colony ship): the place stays and holds nothing, so the others never move. */
  hidden?: boolean;
  /** A new value for each collection that lands: the art flies in and the figure bumps. */
  flight?: number;
  tone: 'alloy' | 'crystal' | 'deut';
  /** The whole name: what it holds — and, on a press, what the press does. */
  label: string;
  /** Makes the pill one press. */
  onPress?: () => void;
}

const FLIGHT = [0, 1, 2] as const;

function HudPill({ item }: { item: HudResource }) {
  const own = useOwnPress(() => {
    playSound('tap');
    haptic('tap');
    item.onPress?.();
  });
  const safe = item.safe ?? 0;
  const body = (
    <>
      <img className="gk-res__art" src={item.art} alt="" draggable={false} />
      <span key={item.flight} className="gk-res__amount gk-display gk-num gk-outlined" {...(item.flight === undefined ? {} : { 'data-bump': '' })}>{item.amount}</span>
      {item.pool !== undefined
        ? <span data-pool="" data-tone={item.pool.tone} className="gk-res__pool gk-num">{item.pool.text}</span>
        : item.rate !== undefined && <span className="gk-res__rate">{item.rate}</span>}
      {item.store !== undefined && (
        <span className="gk-res__store" aria-hidden="true">
          <span className="gk-res__fill" style={{ width: pct(Math.round(Math.min(1, item.store) * 1000) / 10) }} />
          {safe > 0 && <span data-safe="" className="gk-res__safe" style={{ left: pct(Math.round(Math.min(1, safe) * 1000) / 10) }} />}
        </span>
      )}
      {item.flight !== undefined && FLIGHT.map((index) => {
        const place: CssVars = { '--i': index };
        return <img key={`${String(item.flight)}:${String(index)}`} data-collect-particle="" className="gk-res__fly" src={item.art} alt="" aria-hidden="true" style={place} />;
      })}
    </>
  );
  const look = `gk-res${(item.store ?? 0) >= 1 ? ' gk-res--full' : ''}`;
  const colour = { color: `var(--gk-${item.tone})` };
  return item.onPress === undefined
    ? <div className={look} style={colour} data-pill={item.id} aria-label={item.label} role="group">{body}</div>
    : (
      <button
        type="button"
        {...OWN_SOUND}
        className={`${look} gk-res--press`}
        style={colour}
        data-pill={item.id}
        aria-label={item.label}
        {...(item.ripe ? { 'data-ripe': '' } : {})}
        onPointerDown={own.onPointerDown}
        onClick={own.onClick}
      >
        {body}
      </button>
    );
}

/**
 * The resource bar across the top: art overlapping a dark pill, as games draw it. A pill
 * given a press is the one press that deals with its resource; one left out keeps its place.
 */
export function ResourceHud({ items, end }: { items: readonly HudResource[]; end?: ReactNode }) {
  return (
    <div className="gk-hud">
      {items.map((item) => (item.hidden
        ? <span key={item.id} className="gk-res" data-pill={item.id} data-hidden="" aria-hidden="true" />
        : <HudPill key={item.id} item={item} />))}
      {end}
    </div>
  );
}

/**
 * A STORE ON A WORLD: what it holds against what it can hold, the share a raid cannot
 * take boxed in at the start (with its shield), and what flows in each hour. A full
 * store is a gap you can close (H2, K2): the figure turns to the warning colour and the
 * bar ends in a warning cap — never the red of something done to you. Zero is a reading.
 */
export function StoreGauge({ resource, held, cap, safe, rate, label }: {
  resource: 'alloy' | 'crystal' | 'deuterium';
  held: number;
  cap: number;
  safe: number;
  rate: number;
  label: string;
}) {
  const { t } = useTranslation();
  const share = (value: number): string => pct(cap <= 0 ? 0 : Math.round(Math.min(1, Math.max(0, value / cap)) * 100));
  const full = cap > 0 && held >= cap;
  const tone = resource === 'deuterium' ? 'deut' : resource;
  const cells: CssVars = { '--seg': 'calc(100% / 12)' };
  return (
    <div role="group" aria-label={label} className="gk-store" style={{ color: `var(--gk-${tone})` }} {...(full ? { 'data-full': '' } : {})}>
      <img className="gk-store__art" src={RESOURCE_ART[resource]} alt="" />
      <span className="gk-store__held gk-num">
        {compact(Math.floor(held))}<span className="gk-store__cap">/{compact(cap)}</span>
      </span>
      <span className="gk-store__track" aria-hidden="true">
        <span className={`gk-bar gk-bar--segments gk-fill-${tone}`} style={cells}>
          <span className="gk-bar__fill" style={{ width: share(held) }} />
        </span>
        {safe > 0 && <span className="gk-store__safe" style={{ width: share(safe) }}><Glyph id="shield" /></span>}
      </span>
      <span className="gk-store__rate gk-num">
        {rate > 0 ? `+${compact(rate)}` : compact(rate)}<span className="gk-store__unit">{t('planetHero.perHourSuffix')}</span>
      </span>
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
export function StatusChip({ glyph, tone, label, value, until, onPress }: {
  glyph: GlyphId;
  tone: StatusTone;
  label: string;
  value: string;
  until?: string;
  /** Makes the chip a question: a press says what the effect does (a 44 px target round the chip). */
  onPress?: () => void;
}) {
  const own = useOwnPress(() => {
    playSound('tap');
    haptic('tap');
    onPress?.();
  });
  const chip = (
    <span className="gk-status" data-tone={tone}>
      <span className="gk-status__coin"><Glyph id={glyph} /></span>
      {onPress === undefined && <span className="sr-only">{label}</span>}
      <span className="gk-status__value gk-num">{value}</span>
      {until !== undefined && <span className="gk-status__until gk-num">{until}</span>}
    </span>
  );
  if (onPress === undefined) return chip;
  return (
    <button
      type="button"
      {...OWN_SOUND}
      className="gk-hit"
      aria-label={[label, value, ...(until === undefined ? [] : [until])].join(' · ')}
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      {chip}
    </button>
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

interface Cost { alloy: number; crystal: number; deuterium?: number }

const COST_PARTS = ['alloy', 'crystal', 'deuterium'] as const;

/**
 * WHAT A THING COSTS, in one line: each resource as its picture and a short figure. What
 * the store cannot pay yet wears the warning colour and a dotted underline (never colour
 * alone); the time the order takes rides at the end as the fourth currency.
 */
export function CostLine({ cost, held, time }: { cost: Cost; held?: Cost; time?: ReactNode }) {
  return (
    <span className="gk-cost">
      {COST_PARTS.map((resource) => {
        const amount = cost[resource] ?? 0;
        if (amount <= 0) return null;
        const short = held !== undefined && amount > (held[resource] ?? 0);
        return (
          <span key={resource} className="gk-cost__part gk-num" {...(short ? { 'data-short': '' } : {})}>
            <img src={RESOURCE_ART[resource]} alt="" draggable={false} />
            {compact(amount)}
          </span>
        );
      })}
      {time}
    </span>
  );
}

/** Where an order stands: the head builds, the rest wait their turn; a vacation stops all. */
export type SlotState = 'running' | 'waiting' | 'paused' | 'staged';

const SLOT_MARK: Partial<Record<SlotState, GlyphId>> = { waiting: 'timed', paused: 'lock' };

/**
 * A SLOT OF WORK: a ring around the order's picture that fills as it builds, its name and
 * the time left beside it. A slot is a glance, not a control: a press opens the sheet where
 * an order is cancelled, which states the half that burns before it happens.
 */
export function QueueSlot({ art, name, count = 1, progress, left, state, label, onPress }: {
  art: string | null;
  name: string;
  count?: number;
  /** How far the order has built, 0 to 1. */
  progress: number;
  /** The time until it is done, or the word for why no clock runs. */
  left: string;
  state: SlotState;
  label: string;
  onPress: () => void;
}) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onPress(); });
  const length = 2 * Math.PI * 16;
  const built = Math.min(1, Math.max(0, progress));
  const mark = SLOT_MARK[state];
  return (
    <button type="button" className="gk-qslot" data-state={state} aria-label={label} onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <span className="gk-qslot__ring" aria-hidden="true">
        <svg viewBox="0 0 38 38">
          <circle className="gk-qslot__track" cx="19" cy="19" r="16" />
          <circle className="gk-qslot__arc" cx="19" cy="19" r="16" strokeDasharray={length} strokeDashoffset={length * (1 - built)} />
        </svg>
        {art !== null && <img className="gk-qslot__art" src={art} alt="" draggable={false} />}
        {count > 1 && <span className="gk-qslot__count gk-num">×{count}</span>}
      </span>
      <span className="gk-qslot__text">
        <span className="gk-qslot__name">{name}</span>
        <span className="gk-qslot__left gk-num">
          {mark !== undefined && <Glyph id={mark} />}
          <span className="gk-qslot__time">{left}</span>
        </span>
      </span>
    </button>
  );
}

/** An empty slot, said in words: the room left must be seen without counting. */
export function FreeSlot({ text }: { text: string }) {
  return <span className="gk-qslot gk-qslot--free" data-free-slot="">{text}</span>;
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
