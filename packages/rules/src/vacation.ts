import { deuteriumRate } from './economy.js';

export const VACATION_DAY_MS = 86_400_000;
export interface VacationWorld { id: string; coreLevel: number; capital: boolean }

/** All holdings are priced together, using nominal output rather than installed hardware. */
export function vacationCost(days: number, worlds: readonly VacationWorld[]) {
  if (!Number.isInteger(days) || days < 1 || days > 7) throw new RangeError('Invalid vacation days');
  if (worlds.filter(w => w.capital).length !== 1 || new Set(worlds.map(w => w.id)).size !== worlds.length) {
    throw new RangeError('Invalid vacation holdings');
  }
  const lines = worlds.map(world => {
    if (!Number.isInteger(world.coreLevel) || world.coreLevel < 1) throw new RangeError('Invalid Core level');
    const referenceLevel = 2 * Math.ceil(world.coreLevel / 2);
    const hours = days * (world.capital ? 12 : 6);
    const rate = deuteriumRate(referenceLevel);
    return { ...world, referenceLevel, hours, rate, cost: rate * hours };
  });
  return { worlds: lines, total: Math.ceil(lines.reduce((sum, line) => sum + line.cost, 0)) };
}

/** A frozen queue must still finish before the season closes. */
export function vacationDaysAvailable(now: number, seasonEnd: number, latestQueueEnd = now): number {
  const duration = Math.min(seasonEnd - VACATION_DAY_MS - now, seasonEnd - latestQueueEnd - 1);
  return Math.max(0, Math.min(7, Math.floor(duration / VACATION_DAY_MS)));
}

export function vacationPayment(cost: number, store: number, buffer: number): { store: number; buffer: number } | null {
  if (![cost, store, buffer].every(n => Number.isFinite(n) && n >= 0)) throw new RangeError('Invalid vacation balance');
  if (store + buffer < cost) return null;
  const paidStore = Math.min(cost, store);
  return { store: paidStore, buffer: cost - paidStore };
}

/** Public eligibility categories; never include other commanders' private flight details. */
export const VACATION_BLOCK_REASONS = [
  'VACATION_ACTIVE', 'SEASON_FROZEN', 'VACATION_MAIN_ONLY', 'VACATION_DURATION',
  'VACATION_FLIGHTS', 'VACATION_FLEET', 'VACATION_PROBES', 'VACATION_MINING',
  'VACATION_PIRATES', 'VACATION_TRADE', 'VACATION_CONVOY', 'VACATION_SUPPORT_SENT',
  'VACATION_SUPPORT_HOSTED', 'VACATION_CLAN_FLEET', 'VACATION_CLAN_OPERATION',
  'VACATION_MONUMENT_FLEET', 'VACATION_MONUMENT_PROBES', 'VACATION_STRATEGIC',
  'VACATION_SETTLING', 'VACATION_FUNDS',
] as const;
export type VacationBlockReason = typeof VACATION_BLOCK_REASONS[number];

