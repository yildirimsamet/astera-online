import i18n from '../i18n/index.js';
import type { ArenaCopy } from './copy.js';
import { teamCopy } from './teamCopy.js';
import { FARM_TONE } from './farmColors.js';
import { ARENA_PROGRESSION, type ShipClass } from '@astera/rules/arena';
import { classStatRows } from './ClassPicker.js';
import { amount, clockText, launchBlock, type Hangar, type LaunchBlock, type SortieReport } from './hangarDesk.js';

const KINDS = ['alloy', 'crystal', 'deuterium'] as const;
const tone = (kind: number): React.CSSProperties => ({ '--tone': FARM_TONE[kind] } as React.CSSProperties);

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
  const landed = report?.outcome === 'extracted' ? KINDS.map(key => report.deposit[key]) : null;
  const over = report ? KINDS.map(key => report.overflow[key]) : [];
  const until = report?.readyAt ? Date.parse(report.readyAt) : 0;
  const carried = hold.map(n => Math.floor(n));
  const dropped = report?.outcome === 'recalled' ? [] : carried;
  const t = teamCopy();
  return <div className="ss">
    {landed && (report?.teamId ? <>
      {carried.some(n => n > 0) && <><p className="ap-eyebrow">{t.pooled}</p>
        <ul className="ss-landed ss-pooled">{carried.map((n, kind) => n > 0 && <li key={kind} style={tone(kind)}><i aria-hidden /><b>+{amount(n)}</b> <small>{c.kinds[kind]}</small></li>)}</ul></>}
      <p className="ss-pool">{t.pool}</p>
    </> : landed.some(n => n > 0) ? <>
      <p className="ap-eyebrow">{c.landedTitle}</p>
      <ul className="ss-landed">{landed.map((n, kind) => n > 0 && <li key={kind} style={tone(kind)}><i aria-hidden /><b>+{amount(n)}</b> <small>{c.kinds[kind]}</small></li>)}</ul>
    </> : <p className="ss-empty">{c.nothingLanded}</p>)}
    {!landed && dropped.some(n => n > 0) && <>
      <p className="ap-eyebrow">{c.lostTitle}</p>
      <ul className="ss-lost">{dropped.map((n, kind) => n > 0 && <li key={kind} style={tone(kind)}><i aria-hidden /><b>−{amount(n)}</b> <small>{c.kinds[kind]}</small></li>)}</ul>
    </>}
    {over.some(n => n > 0) && <p className="ss-overflow">{c.overflow} {over.flatMap((n, kind) => n > 0 ? [`${amount(n)} ${c.kinds[kind] ?? ''}`] : []).join(' · ')}</p>}
    {report && report.outcome !== 'test' && <p className="ss-xp"><b>+{report.xp.banked} XP</b>
      {report.xp.kept < report.xp.earned && <small>{c.xpKept(report.xp.earned)}</small>}
      {report.xp.banked < report.xp.kept && <small>{c.xpUnbanked(report.xp.kept - report.xp.banked)}</small>}</p>}
    {report && until > now && <p className="ss-ready" data-reason={report.readyReason}>
      {report.readyReason === 'repair' ? c.repairing : c.servicing} · {clockText(until - now)}</p>}
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

/** The button's two lines: the action with its price, and what pays it. */
export function LaunchLabel({ line, note }: { line: string; note: string | null }) {
  return <span className="ap-launch-text">{line}{note && <small>{note}</small>}</span>;
}
