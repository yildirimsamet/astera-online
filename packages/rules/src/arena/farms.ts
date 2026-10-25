/**
 * WHAT THE ZONE IS PLAYED FOR. Three farm kinds, the galaxy's own resources, each worth
 * a fixed number of points per unit delivered through an exit. Rarer is worth more.
 * Field pieces float free (fly through them); deposits sit on rock (land and mine).
 */
export const FARM_KINDS = ['alloy', 'crystal', 'deuterium'] as const;
export type FarmKind = (typeof FARM_KINDS)[number];
export const FARM_POINTS: readonly number[] = [1, 2, 3];

/** One way a field group can grow back: a lone piece or a small cluster of one kind. */
export interface FieldSpawn { kind: number; pieces: number; amount: number; weight: number }
export const FIELD_SPAWNS: readonly FieldSpawn[] = [
  { kind: 0, pieces: 1, amount: 6, weight: 4 },
  { kind: 0, pieces: 4, amount: 3, weight: 3 },
  { kind: 1, pieces: 3, amount: 3, weight: 2 },
  { kind: 2, pieces: 1, amount: 4, weight: 1 },
];
/** Slots per field group: the largest cluster. */
export const FIELD_GROUP_SIZE = 4;

export const emptyHold = (): number[] => FARM_KINDS.map(() => 0);

/** Points a hold is worth if it reaches an exit. Whole points; fractions of a unit do not count. */
export function holdPoints(hold: readonly number[]): number {
  let total = 0;
  for (let kind = 0; kind < FARM_POINTS.length; kind++) total += (hold[kind] ?? 0) * (FARM_POINTS[kind] ?? 0);
  return Math.floor(total + 1e-9);
}

export function pickFieldSpawn(roll: number): FieldSpawn {
  let total = 0;
  for (const spawn of FIELD_SPAWNS) total += spawn.weight;
  let left = roll * total;
  for (const spawn of FIELD_SPAWNS) { left -= spawn.weight; if (left < 0) return spawn; }
  return FIELD_SPAWNS[FIELD_SPAWNS.length - 1] ?? { kind: 0, pieces: 1, amount: 1, weight: 1 };
}
