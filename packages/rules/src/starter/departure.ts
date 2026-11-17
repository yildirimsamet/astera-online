import type { PlanetSlot } from '../galaxy.js';
import type { Vec3 } from '../types.js';
import { distance } from '../travel.js';
import { STARTER } from './constants.js';
import { jumpWindowOpen, type VesselProgress } from './ladder.js';

const DAY_MS = 86_400_000;

export type DepartureBlock =
  | { code: 'MIGRATION_NOT_READY' }
  | { code: 'MIGRATION_FLEET_OUT'; flying: number }
  | { code: 'MIGRATION_SEASON_WAIT'; daysLeft: number };

/**
 * WHAT STANDS BETWEEN A SHIP AND THE JUMP, the first thing only. Plan §3.8. The order is the order
 * a player can do something about it: the first loop, then the fleet, then the calendar. A season that
 * ends inside the cutoff is not a refusal of the ship: it plays on and leaves into the next one.
 */
export function departureBlock(input: { progress: VesselProgress; flying: number; seasonEndsAtMs: number; nowMs: number }): DepartureBlock | null {
  if (!jumpWindowOpen(input.progress)) return { code: 'MIGRATION_NOT_READY' };
  if (input.flying > 0) return { code: 'MIGRATION_FLEET_OUT', flying: input.flying };
  const left = input.seasonEndsAtMs - input.nowMs;
  if (left < STARTER.migrationCutoffDays * DAY_MS) return { code: 'MIGRATION_SEASON_WAIT', daysLeft: Math.ceil(left / DAY_MS) };
  return null;
}

export interface LandingChoice extends PlanetSlot {
  /** Worlds within `LANDING_NEAR` of this address. Positions in the main galaxy are public. */
  neighbours: number;
  /** The old starter neighbour this address is nearest to, when it was offered for that (plan 2026-11-06 §7.3-4). */
  friend?: string;
}

/** A commander who left the same starter galaxy lately, where they live now. */
export interface LandingFriend extends Vec3 { name: string }

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
  /** Old starter neighbours who landed lately: the free address nearest one of them is always offered. */
  friends: readonly LandingFriend[] = [],
): LandingChoice[] {
  const free: LandingChoice[] = slots.filter(slot => !occupied.has(slot.index))
    .map(slot => ({ ...slot, neighbours: worlds.filter(world => distance(slot, world) <= LANDING_NEAR).length }))
    .sort((a, b) => a.neighbours - b.neighbours || a.index - b.index);
  return besideFriend(spread(free), free, friends);
}

/** The emptiest, the most crowded and one between them, apart from each other. */
function spread(free: LandingChoice[]): LandingChoice[] {
  if (free.length <= 1) return free;

  const emptiest = free[0]!;
  const crowded = free.at(-1)!;
  const chosen: LandingChoice[] = [emptiest];
  if (crowded.index !== emptiest.index) chosen.push(crowded);
  // Between the two by neighbours: in a thinly settled galaxy the middle of the list is as empty as the first.
  const target = (emptiest.neighbours + crowded.neighbours) / 2;
  const byMiddle = [...free].sort((a, b) => Math.abs(a.neighbours - target) - Math.abs(b.neighbours - target) || a.index - b.index);
  const between = byMiddle.find(slot => chosen.every(pick => pick.index !== slot.index && distance(pick, slot) >= LANDING_APART))
    ?? byMiddle.find(slot => chosen.every(pick => pick.index !== slot.index));
  if (between) chosen.push(between);
  return chosen.sort((a, b) => a.neighbours - b.neighbours || a.index - b.index);
}

/**
 * NEXT TO SOMEONE YOU KNOW. The free address nearest an old neighbour takes the middle one's place: the
 * emptiest and the most crowded stay, so the choice still spans calm to rich. Already offered, it is named.
 */
function besideFriend(chosen: LandingChoice[], free: readonly LandingChoice[], friends: readonly LandingFriend[]): LandingChoice[] {
  let best: { slot: LandingChoice; friend: LandingFriend; gap: number } | null = null;
  for (const friend of friends) {
    for (const slot of free) {
      const gap = distance(slot, friend);
      if (!best || gap < best.gap) best = { slot, friend, gap };
    }
  }
  if (!best) return chosen;
  const named = { ...best.slot, friend: best.friend.name };
  const picks = chosen.some(pick => pick.index === named.index)
    ? chosen.map(pick => (pick.index === named.index ? named : pick))
    : chosen.length < 3 ? [...chosen, named] : [chosen[0]!, named, chosen.at(-1)!];
  return picks.sort((a, b) => a.neighbours - b.neighbours || a.index - b.index);
}
