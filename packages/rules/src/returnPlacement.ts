import type { PlanetSlot } from './galaxy.js';
import { colonyCapacity } from './strategic.js';

export interface ReturnVacancy extends PlanetSlot {
  readonly id: string;
  readonly kind: 'CAPITAL' | 'COLONY';
  readonly createdAt: number;
  readonly departureTransferId: string;
}

/**
 * Inputs are open vacancies from ONE season/cycle, read under admission lock.
 * An unused spawn slot is never a return address. Return the original records so
 * the caller can atomically consume their IDs and retain their exact coordinates.
 */
export function returnPlacement<T extends ReturnVacancy>(
  vacancies: readonly T[],
  occupied: ReadonlySet<number>,
  colonyCount: number,
): { capital: T; colonies: T[] } | null {
  if (!Number.isInteger(colonyCount) || colonyCount < 0 || colonyCount > colonyCapacity(Infinity)) {
    throw new RangeError('Invalid returning colony count');
  }
  const available = vacancies.filter((vacancy) => !occupied.has(vacancy.index)).sort((a, b) =>
    a.createdAt - b.createdAt
    || (a.departureTransferId < b.departureTransferId ? -1 : a.departureTransferId > b.departureTransferId ? 1 : 0)
    || a.index - b.index);
  const capital = available.find((vacancy) => vacancy.kind === 'CAPITAL');
  const colonies = available.filter((vacancy) => vacancy.kind === 'COLONY').slice(0, colonyCount);
  if (!capital || colonies.length !== colonyCount) return null;
  return { capital, colonies };
}
