import { HONOR_MICROS } from './honor.js';

/**
 * GÜNLÜK GÖREVLER (owner, 2026-11-24). Four acts the loop already has, each paying a small
 * purse once a UTC day:
 *
 *   PROBES    three probes sent
 *   RIFT      one Yarık sortie flown
 *   PIRATE    one pirate fleet beaten, with ships left
 *   ASTEROID  one asteroid run that reached its rock
 *
 * THE DESIGN RULE IS `rewards.ts`'S: progress is COUNTED from rows the game keeps anyway, inside
 * the day's two instants, and never accumulated. Nothing here is a login reward or a streak: a
 * quest pays for an act, a missed day loses nothing, and a player who leaves the tab open
 * completes none of it.
 *
 * WHAT IT PAYS. Hours of what the capital makes, like the welcome boxes, so the purse grows with
 * the commander and stays small beside them: 1.4 hours across all four, about 6% of a day's
 * output. Resources land in the capital's store, where they can be raided like every other reward.
 *
 * AND HONOR. Each quest also pays a quarter of one Honor (owner 2026-11-24), taken with its purse:
 * a day with all four done is one Honor. It is filed on the claim row, so a later change of this
 * amount never rewrites what a day already paid.
 */
export const DAILY_QUESTS = [
  { id: 'PROBES', goal: 3, hours: 0.25 },
  { id: 'RIFT', goal: 1, hours: 0.4 },
  { id: 'PIRATE', goal: 1, hours: 0.5 },
  { id: 'ASTEROID', goal: 1, hours: 0.25 },
] as const;

export type DailyQuestId = (typeof DAILY_QUESTS)[number]['id'];

/** What one finished quest pays in Honor, in the ledger's micro-Honor (a quarter of one Honor). */
export const DAILY_QUEST_HONOR = HONOR_MICROS / 4;

/** A purse is never empty: at least this much an hour, even while production is down. */
const FLOOR_PER_HOUR = 150;
/** Crystal is about 44% of alloy in income, so about 30% of the whole. */
const CRYSTAL_SHARE = 0.3;
const DAY_MS = 86_400_000;

export interface UtcDay {
  /** `YYYY-MM-DD`, the key a claim is filed under. */
  key: string;
  startMs: number;
  /** Exclusive: the instant every quest starts again. */
  endMs: number;
}

/** `YYYY-MM-DD` of the proleptic Gregorian day `days` after 1970-01-01 (Hinnant's civil-from-days, no clock needed). */
function civilDate(days: number): string {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const dayOfEra = z - era * 146_097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1_460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365);
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const shifted = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * shifted + 2) / 5) + 1;
  const month = shifted < 10 ? shifted + 3 : shifted - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The UTC calendar day holding `ms`. */
export function utcDay(ms: number): UtcDay {
  if (!Number.isFinite(ms)) throw new RangeError('A day needs a finite time');
  const days = Math.floor(ms / DAY_MS);
  return { key: civilDate(days), startMs: days * DAY_MS, endMs: (days + 1) * DAY_MS };
}

/** What `id` pays a capital that makes `perHour` of each. */
export function dailyQuestReward(id: DailyQuestId, perHour: { alloy: number; crystal: number }): { alloy: number; crystal: number } {
  const quest = DAILY_QUESTS.find((row) => row.id === id);
  if (!quest) throw new Error(`No daily quest ${id}`);
  const hourly = Math.max(FLOOR_PER_HOUR, Math.max(0, perHour.alloy) + Math.max(0, perHour.crystal));
  const worth = Math.round(quest.hours * hourly);
  const crystal = Math.round(worth * CRYSTAL_SHARE);
  return { alloy: worth - crystal, crystal };
}
