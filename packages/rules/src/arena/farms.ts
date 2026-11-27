/**
 * WHAT THE ZONE IS PLAYED FOR: the galaxy's own resources, carried out through an exit and landed in the
 * capital. There is no score (owner 2026-11-25: the points were the first deathmatch prototype's).
 * Field pieces float free (fly through them); deposits sit on rock (land and mine).
 * Asteryum (plan 2026-11-24 §3.2) is the fourth, and only the storm grows it.
 */
export const FARM_KINDS = ['alloy', 'crystal', 'deuterium', 'asterium'] as const;
export type FarmKind = (typeof FARM_KINDS)[number];

/** One way a field group can grow back: a lone piece or a small cluster of one kind. */
export interface FieldSpawn { kind: number; pieces: number; amount: number; weight: number }
// Owner 2026-10-27: half of what they held (24/12/12/16). Owner 2026-11-27: half as much again for the shorter Yarık hours.
export const FIELD_SPAWNS: readonly FieldSpawn[] = [
  { kind: 0, pieces: 1, amount: 18, weight: 4 },
  { kind: 0, pieces: 4, amount: 9, weight: 3 },
  { kind: 1, pieces: 3, amount: 9, weight: 2 },
  { kind: 2, pieces: 1, amount: 12, weight: 1 },
];
/**
 * THE ASTERYUM FIRTINASI, PILOT BY PILOT (owner 2026-11-25: "pilot başı dynamic … bazen 1 bazen 2 çıksın …
 * kişi başı 6-15 civarı … bunu açıklamayalım … ortalarda çıktığını söyleyelim, ama direkt işaret etmeyelim").
 * While it blows, Asteryum floats on its own in the heart of the zone, never in the ordinary field groups.
 * Every flying ship adds `perPilotHour` units an hour to what the storm owes, and a piece of 1 or 2 grows on a
 * free heart spot once the debt covers it: the room's supply follows how many fly. It opens with about one
 * piece per pilot already out, and keeps at most one per pilot (`minPieces`–`maxPieces`) waiting.
 * The players are told only that it is in the middle; the rate is the room's own.
 */
export const ASTERIUM_STORM = Object.freeze({ perPilotHour: 10, heart: 2000, minPieces: 2, maxPieces: 8 });

/** Slots per field group: the largest cluster. */
export const FIELD_GROUP_SIZE = 4;

export const emptyHold = (): number[] => FARM_KINDS.map(() => 0);

/** The field group a roll in [0, 1) grows. */
export function pickFieldSpawn(roll: number): FieldSpawn {
  let total = 0;
  for (const spawn of FIELD_SPAWNS) total += spawn.weight;
  let left = roll * total;
  for (const spawn of FIELD_SPAWNS) { left -= spawn.weight; if (left < 0) return spawn; }
  return FIELD_SPAWNS[FIELD_SPAWNS.length - 1] ?? { kind: 0, pieces: 1, amount: 1, weight: 1 };
}
