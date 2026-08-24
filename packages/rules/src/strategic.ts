import { HULLS } from './hulls.js';
import { GALAXY, MULTI_WORLD } from './constants.js';
import type { PlanetSlot } from './galaxy.js';
import type {
  Fleet,
  NeutralReserve,
  NeutralThreat,
  NeutralTier,
  Resources,
} from './types.js';

/** Capacity is deliberately stepwise and derived from the strongest controlled Core. */
export function colonyCapacity(highestCore: number): number {
  if (highestCore < 3) return 0;
  return Math.min(3, Math.floor(highestCore / 3));
}

export const hasColonyCapacity = (
  highestCore: number,
  colonies: number,
  reservations: number,
): boolean => colonies + reservations < colonyCapacity(highestCore);

export function neutralReserve(held: Resources, capacity: Resources): NeutralReserve {
  const total = Math.max(0, held.alloy) + Math.max(0, held.crystal);
  const cap = Math.max(0, capacity.alloy) + Math.max(0, capacity.crystal);
  const share = cap <= 0 ? 0 : total / cap;
  if (share < 0.2) return 'EMPTY';
  return share < 0.6 ? 'LOW' : 'RICH';
}

export const neutralThreat = (tier: NeutralTier): NeutralThreat =>
  tier === 1 ? 'UNGUARDED' : tier === 2 ? 'GUARDED' : 'FORTIFIED';

/** Only dedicated transports count when moving resources between owned worlds. */
export function transferCargoCapacity(fleet: Fleet): number {
  return (fleet.HAULER ?? 0) * HULLS.HAULER.cargo + (fleet.RUNNER ?? 0) * HULLS.RUNNER.cargo;
}

export const resourcesTotal = (cargo: Resources): number =>
  Math.max(0, cargo.alloy) + Math.max(0, cargo.crystal) + Math.max(0, cargo.deuterium);

export interface NeutralSlot {
  slot: PlanetSlot;
  tier: NeutralTier;
  profileSeed: number;
}

export interface NeutralLayout {
  capitalSlots: number;
  neutralCounts: Readonly<Record<NeutralTier, number>>;
}

/** Stable 32-bit profile identity; never consumes the galaxy generator's random stream. */
function profileSeed(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ 0xa511e9b3) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
  // PostgreSQL stores the profile in a signed int4. Preserve all 32 bits while
  // presenting them in that representable signed range.
  return (value ^ (value >>> 13)) | 0;
}

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const T2_RADIUS_SHARE = 0.55;
const T3_RADIUS_SHARE = 0.12;

/** A stable rotation keeps the strata seeded without coupling them to slot generation. */
function layoutPhase(seed: number, tier: NeutralTier): number {
  return ((profileSeed(seed, 0x51f15e + tier) >>> 0) / 0x1_0000_0000) * TAU;
}

/**
 * Ideal points for one neutral tier. Actual worlds still come from the generated
 * slot pool; these points only stop a lucky radial sample becoming one visible clump.
 */
function neutralTargets(
  seed: number,
  tier: NeutralTier,
  count: number,
): { x: number; y: number; z: number }[] {
  const phase = layoutPhase(seed, tier);
  if (tier === 1) {
    // A sunflower is an equal-area disc: broad radial coverage without sectors or bands.
    return Array.from({ length: count }, (_, index) => {
      const radius = GALAXY.radius * Math.sqrt((index + 0.5) / count);
      const angle = phase + index * GOLDEN_ANGLE;
      return { x: radius * Math.cos(angle), y: 0, z: radius * Math.sin(angle) };
    });
  }

  const radius = GALAXY.radius * (tier === 2 ? T2_RADIUS_SHARE : T3_RADIUS_SHARE);
  return Array.from({ length: count }, (_, index) => {
    const angle = phase + (index * TAU) / count;
    return { x: radius * Math.cos(angle), y: 0, z: radius * Math.sin(angle) };
  });
}

/** Match each ideal point to its nearest still-free generated address. */
function selectNearTargets(
  candidates: readonly PlanetSlot[],
  used: Set<number>,
  targets: readonly { x: number; y: number; z: number }[],
  angularHalfWidth?: number,
): PlanetSlot[] {
  const selected: PlanetSlot[] = [];
  for (const target of targets) {
    let best: PlanetSlot | undefined;
    let bestDistance = Infinity;
    for (const slot of candidates) {
      if (used.has(slot.index)) continue;
      if (angularHalfWidth !== undefined) {
        const delta = Math.atan2(
          Math.sin(Math.atan2(slot.z, slot.x) - Math.atan2(target.z, target.x)),
          Math.cos(Math.atan2(slot.z, slot.x) - Math.atan2(target.z, target.x)),
        );
        if (Math.abs(delta) > angularHalfWidth) continue;
      }
      const dx = slot.x - target.x;
      const dy = slot.y - target.y;
      const dz = slot.z - target.z;
      const squaredDistance = dx * dx + dy * dy + dz * dz;
      if (
        squaredDistance < bestDistance
        || (squaredDistance === bestDistance && slot.index < (best?.index ?? Infinity))
      ) {
        best = slot;
        bestDistance = squaredDistance;
      }
    }
    if (!best) break;
    used.add(best.index);
    selected.push(best);
  }
  return selected;
}

/**
 * Pick the v2 neutral pool from slots after every reserved capital address.
 * T3 owns the central contested points, T2 the middle density ring, and T1 covers
 * the whole playable disc. Seeded ideal points are matched to generated addresses:
 * the worlds stay random-looking without allowing a whole tier to collapse into
 * one lucky angular sample.
 */
export function selectNeutralSlots(
  seed: number,
  slots: readonly PlanetSlot[],
  layout: NeutralLayout = {
    capitalSlots: MULTI_WORLD.capitalSlots,
    neutralCounts: MULTI_WORLD.neutralCounts,
  },
): NeutralSlot[] {
  const capital = slots.filter((slot) => slot.index < layout.capitalSlots);
  const candidates = slots.filter((slot) => slot.index >= layout.capitalSlots);
  const needed =
    layout.neutralCounts[1]
    + layout.neutralCounts[2]
    + layout.neutralCounts[3];
  if (capital.length < layout.capitalSlots || candidates.length < needed) return [];

  const used = new Set<number>();
  const take = (tier: NeutralTier): PlanetSlot[] => {
    const count = layout.neutralCounts[tier];
    return selectNearTargets(
      candidates,
      used,
      neutralTargets(seed, tier, count),
      tier === 1 ? undefined : Math.PI / count,
    );
  };
  // Strategic strata get first choice of their constrained bands; T1 can use the remainder.
  const t3 = take(3);
  const t2 = take(2);
  const t1 = take(1);

  const wrap = (tier: NeutralTier, chosen: readonly PlanetSlot[]): NeutralSlot[] =>
    chosen.map((slot) => ({ slot, tier, profileSeed: profileSeed(seed, slot.index) }));
  return [...wrap(1, t1), ...wrap(2, t2), ...wrap(3, t3)];
}
