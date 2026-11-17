import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResearchProjectId } from '@astera/rules';
import { Glyph, ProgressBar, type GlyphId } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { AtmosphereImage } from './AtmosphereArt.js';
import type { AtmosphereArt } from './atmosphere.js';
import { useOwnPress } from './kit/useOwnPress.js';

/**
 * A STRATEGIC BAY ON THE GAME KIT (G2-g, 2026-11-14). The Death Star forge, the interception
 * battery and the radiation-bomb forge are one card: the picture of the hardware, its name and
 * its stock as cells, the state, what one does, the rule a tap away, what it still needs as
 * doors, the price, and a hold. Each surface keeps its own rules; this is only how they look.
 */

type Marks = Partial<Record<`data-${string}`, string | number | boolean>>;

/** A slot: lit ready, outlined while it builds, amber while stopped, violet while a weapon flies. */
export type Cell = 'ready' | 'loading' | 'paused' | 'flight' | 'empty';

/** The cells of a pad: what stands fills from the left, in that order; the rest are empty. */
export function stockCells({ ready, loading, paused = 0, inFlight = 0, total }: {
  ready: number; loading: number; paused?: number; inFlight?: number; total: number;
}): Cell[] {
  const runs: [Cell, number][] = [['ready', ready], ['loading', loading], ['paused', paused], ['flight', inFlight]];
  const cells: Cell[] = [];
  for (const [cell, count] of runs) {
    for (let n = 0; n < count && cells.length < total; n += 1) cells.push(cell);
  }
  while (cells.length < total) cells.push('empty');
  return cells;
}

/** The pad as one picture; the words are the label. */
export function Cells({ cells, label }: { cells: readonly Cell[]; label: string }) {
  if (cells.length === 0) return null;
  return (
    <span data-tally="" data-used={cells.filter((cell) => cell !== 'empty').length} data-total={cells.length}
      role="img" aria-label={label} className="gk-cells">
      {cells.map((cell, index) => <span key={index} data-cell={cell} className="gk-cells__cell" aria-hidden="true" />)}
    </span>
  );
}

/**
 * WHAT THE PAD HOLDS: "Stock 1/2" and its cells. The mix ("Ready: 1 · Building: 1") is said only
 * when there is a mix; one state is the status line's to say, once.
 */
export function ArmStock({ ready, loading, paused = 0, inFlight = 0, total, capacity = total, kind = 'stock' }: {
  ready: number;
  loading: number;
  paused?: number;
  inFlight?: number;
  total: number;
  /** A captured world can hold more than its owner may build. */
  capacity?: number;
  kind?: 'stock' | 'charges';
}) {
  const { t } = useTranslation();
  const counter = t(`planet.tacticalStock.${kind}`, { used: ready + loading + paused + inFlight, total: capacity });
  const parts = ([['ready', ready], ['loading', loading], ['paused', paused], ['flight', inFlight]] as const)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => t(`planet.tacticalStock.${key}`, { count }));
  const reading = parts.length > 0 ? parts.join(' · ') : t('planet.tacticalStock.empty');
  return (
    <span className="gk-arm__stock" data-stock-kind={kind}>
      <span className="gk-arm__count">
        <span data-stock-counter className="gk-num">{counter}</span>
        <Cells cells={stockCells({ ready, loading, paused, inFlight, total })} label={`${counter} · ${reading}`} />
      </span>
      {parts.length > 1 && <span className="gk-arm__mix">{reading}</span>}
    </span>
  );
}

export function ArmCard({ art, locked, working, glyph, name, stock, marks, className = '', children }: {
  art: AtmosphereArt;
  locked: boolean;
  /** Something is being built here: the bay's forge light beats. */
  working: boolean;
  glyph: GlyphId;
  name: ReactNode;
  stock: ReactNode;
  marks: Marks;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`gk gk-arm ${className}`} data-locked={locked} {...(working ? { 'data-working': '' } : {})} {...marks}>
      <div className="gk-arm__art"><AtmosphereImage art={art} /></div>
      <div className="gk-arm__body">
        <div className="gk-arm__head">
          <h4 className="gk-arm__name"><Glyph id={glyph} />{name}</h4>
          {stock}
        </div>
        {children}
      </div>
    </section>
  );
}

export type ArmTone = 'good' | 'self' | 'warn' | 'quiet';

/** The state, in a word and a lamp; a build under way draws its bar under it. */
export function ArmStatus({ tone, text, progress }: {
  tone: ArmTone;
  text: ReactNode;
  progress?: { share: number; mark: 'data-strategic-progress' | 'data-charge-progress' | 'data-bomb-progress' };
}) {
  return (
    <>
      <p className="gk-arm__status" data-arm-status="" data-tone={tone}><span className="gk-arm__lamp" aria-hidden="true" />{text}</p>
      {progress && <div {...{ [progress.mark]: '' }} className="gk-arm__bar"><ProgressBar value={progress.share} max={100} /></div>}
    </>
  );
}

/** What one does, as figures: two small wells side by side. */
export function ArmSpecs({ items }: { items: readonly { glyph: GlyphId; label: string; value: ReactNode }[] }) {
  return (
    <dl className="gk-arm__specs">
      {items.map(({ glyph, label, value }) => (
        <div key={label} className="gk-arm__spec gk-well">
          <dt><Glyph id={glyph} />{label}</dt>
          <dd className="gk-num">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface ArmNeed { ok: boolean; text: string; onFix?: () => void }

/** ONE REQUIREMENT PER CHIP: met is a quiet tick; unmet is amber, and a door where it can be closed. */
export function ArmNeeds({ needs }: { needs: readonly ArmNeed[] }) {
  return (
    <ul className="gk-arm__needs">
      {needs.map((need) => <NeedChip key={need.text} need={need} />)}
    </ul>
  );
}

function NeedChip({ need }: { need: ArmNeed }) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); need.onFix?.(); });
  if (need.ok) {
    return <li data-met="true"><span className="gk-need-chip" data-met=""><Glyph id="check" />{need.text}</span></li>;
  }
  if (need.onFix === undefined) {
    return <li data-met="false"><span className="gk-need-chip"><Glyph id="lock" />{need.text}</span></li>;
  }
  return (
    <li data-met="false">
      <button type="button" {...OWN_SOUND} className="gk-need-door" onPointerDown={own.onPointerDown} onClick={own.onClick}>
        <span className="gk-need-chip"><Glyph id="lock" />{need.text}<Glyph id="next" /></span>
      </button>
    </li>
  );
}

/** A FULL PAD, AND THE RESEARCH THAT MAKES IT BIGGER, said where the limit is met. Owner, 2026-10-01. */
export function ArmNext({ project, text, onOpen }: { project: ResearchProjectId; text: string; onOpen: () => void }) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onOpen(); });
  return (
    <button type="button" {...OWN_SOUND} data-capacity-next={project} className="gk-arm__next"
      onPointerDown={own.onPointerDown} onClick={own.onClick}>
      <Glyph id="up" />
      <span>{text}</span>
      <Glyph id="next" />
    </button>
  );
}
