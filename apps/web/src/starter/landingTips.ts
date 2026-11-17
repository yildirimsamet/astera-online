import { colonyCapacity } from '@astera/rules';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/**
 * One line for the first week: what the ladder taught aboard has no ladder here (plan §3.8). Each line
 * opens when the player meets what it explains (plan 2026-11-13 §4.8); the calendar is only the fallback.
 */
export type LandingTip = 'core' | 'colony' | 'clan' | 'dominion' | 'honor';

const SCHEDULE: readonly { from: number; to: number; id: LandingTip }[] = [
  { from: 0, to: 1, id: 'core' },
  { from: 1, to: 2, id: 'colony' },
  { from: 2, to: 3, id: 'clan' },
  { from: 3, to: 5, id: 'dominion' },
  { from: 5, to: 7, id: 'honor' },
];
/** The order a met line is said in when more than one is waiting. */
const NEED_ORDER: readonly LandingTip[] = ['clan', 'core', 'honor', 'colony'];

export const tipFor = ({ landedAtMs, nowMs, met, dismissed }: {
  landedAtMs: number; nowMs: number; met: ReadonlySet<LandingTip>; dismissed: (id: LandingTip) => boolean;
}): LandingTip | null => {
  if (nowMs - landedAtMs >= WEEK_MS) return null;
  const needed = NEED_ORDER.find(id => met.has(id) && !dismissed(id));
  if (needed) return needed;
  const days = (nowMs - landedAtMs) / DAY_MS;
  const due = SCHEDULE.find(entry => days >= entry.from && days < entry.to)?.id ?? null;
  return due && !dismissed(due) ? due : null;
};

/** The part of a battle report the notes read. */
export interface TipReport {
  at: Date; attacking: boolean; neutral: boolean;
  yourLosses: Readonly<Record<string, number>>;
  lootAlloy: number; lootCrystal: number; lootDeuterium: number;
}

/** What the player has met since landing: a fight with a commander, an attack on one, a loss, a colony slot. */
export const tipTriggers = (reports: readonly TipReport[], capitalCore: number, landedAtMs: number): Set<LandingTip> => {
  const met = new Set<LandingTip>();
  for (const report of reports) {
    if (report.at.getTime() < landedAtMs) continue;
    if (!report.neutral) met.add('core');
    if (!report.neutral && report.attacking) met.add('honor');
    // A defender's loot is what was taken from them, written below zero.
    const raided = report.lootAlloy < 0 || report.lootCrystal < 0 || report.lootDeuterium < 0;
    const lostShips = Object.values(report.yourLosses).some(count => count > 0);
    if (!report.attacking && (raided || lostShips)) met.add('clan');
  }
  if (colonyCapacity(capitalCore) > 0) met.add('colony');
  return met;
};

const keyOf = (id: LandingTip): string => `astera:landing-tip:${id}`;

/** A per-device convenience: at worst a note is read twice. */
export const tipDismissed = (id: LandingTip): boolean => {
  try { return window.localStorage.getItem(keyOf(id)) !== null; } catch { return false; }
};
export const dismissTip = (id: LandingTip): void => {
  try { window.localStorage.setItem(keyOf(id), '1'); } catch { /* Storage may be disabled. */ }
};
