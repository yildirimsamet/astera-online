import i18n from '../i18n/index.js';
import { Glyph } from '../game-ui/index.js';
import type { ArenaCopy } from './copy.js';
import { teamCopy } from './teamCopy.js';
import { FARM_ART, FARM_TONE } from './farmColors.js';
import { ARENA_PROGRESSION, type ShipClass } from '@astera/rules/arena';
import { classStatRows } from './ClassPicker.js';
import { amount, clockText, launchBlock, type Hangar, type LaunchBlock, type SortieReport } from './hangarDesk.js';

const KINDS = ['alloy', 'crystal', 'deuterium'] as const;
const tone = (kind: number): React.CSSProperties => ({ '--tone': FARM_TONE[kind] } as React.CSSProperties);

/** One resource of a haul: its picture, then the figure and the words the caller gives it. */
export function HaulChip({ kind, children }: { kind: number; children: React.ReactNode }) {
  return <li className="gk-haulchip" style={tone(kind)}><img src={FARM_ART[kind]} alt="" draggable={false} />{children}</li>;
}

/** What the next level adds to the class, stat by stat (Y6b): only what grows. */
export function levelGains(ship: ShipClass, level: number, c: ArenaCopy): { key: string; name: string; text: string }[] {
  if (level >= ARENA_PROGRESSION.maxLevel) return [];
  const one = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 });
  const before = classStatRows(c, level);
  return classStatRows(c, level + 1).flatMap((row, i) => {
    const gain = row.value(ship) - (before[i]?.value(ship) ?? row.value(ship));
    if (gain < 0.05) return [];
    const unit = row.key === 'speed' ? ' m/s' : row.key === 'fire' ? c.perSecond : '';
    const text = row.key === 'accuracy' ? c.percentGain(one.format(gain)) : `+${one.format(gain)}${unit}`;
    return [{ key: row.key, name: c.classStats[row.key], text }];
  });
}

/**
 * How a real flight ended, in resources: what reached the capital (or a team's pool), what the day's
 * limit kept out, what fell with the wreck, and how long the ship rests before the next one. `hold`
 * is what the ship carried when the flight ended; a recalled hold stays in the ship, so it is not lost.
 */
export function SortieSummary({ c, report, hold, now }: { c: ArenaCopy; report: SortieReport | null; hold: readonly number[]; now: number }) {
  // Asteryum (kind 3) is credited to the pilot alone, team or not (plan G3): it lands beside the deposit.
  const asterium = report?.outcome === 'extracted' ? report.asterium ?? 0 : 0;
  const landed = report?.outcome === 'extracted' ? [...KINDS.map(key => report.deposit[key]), asterium] : null;
  const over = report ? KINDS.map(key => report.overflow[key]) : [];
  const until = report?.readyAt ? Date.parse(report.readyAt) : 0;
  const carried = hold.map(n => Math.floor(n));
  const dropped = report?.outcome === 'recalled' ? [] : carried;
  const t = teamCopy();
  const chips = (values: readonly number[], sign: '+' | '−', part: 'pooled' | 'landed' | 'lost') => <ul className="gk-arenahaul" data-haul={part}>{values.map((n, kind) => n > 0 && <HaulChip key={kind} kind={kind}>
    <b className="gk-num">{sign}{amount(n)}</b> <small>{c.kinds[kind]}</small></HaulChip>)}</ul>;
  return <div className="gk-sortie">
    {landed && (report?.teamId ? <>
      {carried.slice(0, 3).some(n => n > 0) && <><p className="gk-label">{t.pooled}</p>{chips(carried.slice(0, 3), '+', 'pooled')}</>}
      <p className="gk-inote" data-tone="self"><Glyph id="support" /><span>{t.pool}</span></p>
      {asterium > 0 && <><p className="gk-label">{c.landedTitle}</p>{chips([0, 0, 0, asterium], '+', 'landed')}</>}
    </> : landed.some(n => n > 0) ? <>
      <p className="gk-label">{c.landedTitle}</p>{chips(landed, '+', 'landed')}
    </> : <p className="gk-sub">{c.nothingLanded}</p>)}
    {!landed && dropped.some(n => n > 0) && <><p className="gk-label" data-tone="hostile">{c.lostTitle}</p>{chips(dropped, '−', 'lost')}</>}
    {over.some(n => n > 0) && <p className="gk-inote" data-tone="warn" data-overflow=""><Glyph id="warn" /><span>{c.overflow} {over.flatMap((n, kind) => n > 0 ? [`${amount(n)} ${c.kinds[kind] ?? ''}`] : []).join(' · ')}</span></p>}
    {report && report.outcome !== 'test' && <p className="gk-sortie__xp" data-xp=""><b className="gk-num">+{report.xp.banked} XP</b>
      {report.xp.kept < report.xp.earned && <small>{c.xpKept(report.xp.earned)}</small>}
      {report.xp.banked < report.xp.kept && <small>{c.xpUnbanked(report.xp.kept - report.xp.banked)}</small>}</p>}
    {report && until > now && <p className="gk-inote" data-tone="warn" data-ready="" data-reason={report.readyReason}><Glyph id="repair" />
      <span>{report.readyReason === 'repair' ? c.repairing : c.servicing} · <span className="gk-num">{clockText(until - now)}</span></span></p>}
  </div>;
}

/** The launch button's words when the ship cannot go: the reason, with its clock when it has one. */
export function blockLine(block: LaunchBlock, now: number, c: ArenaCopy): string {
  switch (block.kind) {
    case 'ready': return `${block.reason === 'repair' ? c.repairing : c.servicing} · ${clockText(block.until - now)}`;
    case 'deuterium': return c.shortOf(block.have, block.need);
    case 'homeward': return c.homeward(clockText(block.until - now));
    default: return c.blocked[block.kind];
  }
}

/**
 * The launch button: what the flight takes from the capital's deuterium, with what the capital holds
 * under it to weigh it against; or, when the ship cannot go, why.
 */
export function launchText(h: Hangar, now: number, c: ArenaCopy): { line: string; note: string | null } {
  const block = launchBlock(h, now);
  if (block) return { line: blockLine(block, now, c), note: null };
  return { line: c.enter(h.refill.total), note: h.refill.total > 0 ? c.refillNote(h.refill.fuel, h.refill.ammo, amount(h.deuterium)) : null };
}

