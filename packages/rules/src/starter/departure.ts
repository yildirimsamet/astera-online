import type { PlanetSlot } from '../galaxy.js';
import type { Vec3 } from '../types.js';
import { distance } from '../travel.js';
import { STARTER } from './constants.js';
import { canLoadFuel, isJumpReady, type VesselProgress } from './ladder.js';

const DAY_MS = 86_400_000;

export type DepartureBlock =
  | { code: 'MIGRATION_NOT_READY' }
  | { code: 'MIGRATION_FLEET_OUT'; flying: number }
  | { code: 'MIGRATION_SEASON_WAIT'; daysLeft: number };

/**
 * WHAT STANDS BETWEEN A SHIP AND THE JUMP, the first thing only. Plan §3.8. The order is the order
 * a player can do something about it: the tank, then the fleet, then the calendar. A season that
 * ends inside the cutoff is not a refusal of the ship: it plays on and leaves into the next one.
 */
export function departureBlock(input: { progress: VesselProgress; flying: number; seasonEndsAtMs: number; nowMs: number }): DepartureBlock | null {
  if (!isJumpReady(input.progress)) return { code: 'MIGRATION_NOT_READY' };
  if (input.flying > 0) return { code: 'MIGRATION_FLEET_OUT', flying: input.flying };
  const left = input.seasonEndsAtMs - input.nowMs;
  if (left < STARTER.migrationCutoffDays * DAY_MS) return { code: 'MIGRATION_SEASON_WAIT', daysLeft: Math.ceil(left / DAY_MS) };
  return null;
}

/** Whole units, and never more than the tank has room for. No order buys fuel: it is carried over from stock. */
export function fuelToLoad(progress: VesselProgress, stock: number, amount: number): number {
  if (!canLoadFuel(progress) || !Number.isFinite(amount) || amount <= 0) return 0;
  return Math.max(0, Math.floor(Math.min(amount, stock, STARTER.fuelForJump - progress.fuel)));
}

export interface LandingChoice extends PlanetSlot {
  /** Worlds within `LANDING_NEAR` of this address. Positions in the main galaxy are public. */
  neighbours: number;
}

/** About what a first Telescope reaches in the main galaxy: "who will I see from here". */
export const LANDING_NEAR = 800;
/** Closer than this and two of the three would be the same place on the map. */
const LANDING_APART = 400;

/**
 * THREE ADDRESSES, THREE DIFFERENT GAMES. Plan §3.8 (A7): the emptiest is safe and far from targets,
 * the most crowded is rich and dangerous, one sits between. Sorted emptiest first, so the card reads
 * the same way every time. A pick that stands too near one already chosen gives way to the next
 * along; with few places left it offers what there is.
 */
export function landingChoices(
  slots: readonly PlanetSlot[],
  occupied: ReadonlySet<number>,
  /** Every world that counts as a neighbour: the commanders' band alone would miss the rest. */
  worlds: readonly Vec3[] = slots.filter(slot => occupied.has(slot.index)),
): LandingChoice[] {
  const free = slots.filter(slot => !occupied.has(slot.index))
    .map(slot => ({ ...slot, neighbours: worlds.filter(world => distance(slot, world) <= LANDING_NEAR).length }))
    .sort((a, b) => a.neighbours - b.neighbours || a.index - b.index);
  if (free.length <= 1) return free;

  const emptiest = free[0]!;
  const crowded = free.at(-1)!;
  const chosen: LandingChoice[] = [emptiest];
  if (crowded.index !== emptiest.index) chosen.push(crowded);
  const middle = free.length >> 1;
  const byMiddle = free.map((slot, i) => ({ slot, off: Math.abs(i - middle) })).sort((a, b) => a.off - b.off);
  const between = byMiddle.find(({ slot }) => chosen.every(pick => pick.index !== slot.index && distance(pick, slot) >= LANDING_APART))
    ?? byMiddle.find(({ slot }) => chosen.every(pick => pick.index !== slot.index));
  if (between) chosen.push(between.slot);
  return chosen.sort((a, b) => a.neighbours - b.neighbours || a.index - b.index);
}
