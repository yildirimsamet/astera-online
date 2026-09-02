import { HULLS } from './hulls.js';
import { GALAXY, MULTI_WORLD } from './constants.js';
import { fleetTravelExact } from './travel.js';
import type { PlanetSlot } from './galaxy.js';
import type {
  Fleet,
  NeutralReserve,
  NeutralThreat,
  NeutralTier,
  Resources,
} from './types.js';

/**
 * The widest crossing the playable sphere can contain: one diameter.
 *
 * Every playable coordinate has Euclidean distance `≤ GALAXY.radius` from the
 * origin, so antipodal boundary points are exactly `2 × radius` apart and no pair
 * can be further apart. This is a contract, not a sampled measurement.
 */
export const GALAXY_SPAN = 2 * GALAXY.radius;

/**
 * HOW LONG A PUBLIC CLAIM STAYS OPEN. DERIVED, NEVER TYPED. D111.
 *
 * A claim is a race that only a SETTLEMENT can win, and a settlement is two
 * Couriers — the settlement transport. So the window is not a taste in
 * minutes: it is the longest settlement flight the map can produce, or the far
 * half of the galaxy is unreachable by arithmetic and the race is decided by
 * where a commander was seeded rather than by anything they chose.
 *
 * WRITTEN AS `30` IT WAS RIGHT ONCE. At radius 1000 the widest crossing was a
 * little over 2,000 units and two transports covered it in 29.2 minutes, so a flat
 * thirty was this same derivation with the arithmetic already done. D101 then
 * widened the disc 2.5× and named every constant that did and did not take the
 * factor — hull speeds no, `radarRange` no, the Prospector and the rocks yes —
 * and this one was never in the list. The widest crossing became 71.1 minutes
 * against an unchanged thirty-minute window.
 *
 * WHAT THAT COST, measured over seeds 1-3 at the shipped 300/51 layout: 48% of
 * all (capital, neutral) pairs were settleable at all, the median pair missed by
 * 0.8 minutes, and the six T3 worlds at the contested centre — the whole strategic
 * prize — sat 21 to 33 minutes from a rim capital. A commander could decisively
 * raid a world and then watch its one window close with their Couriers still in
 * the air. This is the class of failure D63 named: an absolute duration stops
 * being a fraction of the thing it has to cover as soon as the map moves.
 *
 * THE CEILING IS THE ONLY SLACK, and it is deliberate. A commander at the extreme
 * rim gets the rounding — about a minute at a real seed's widest pair — to see the
 * claim and press. Anyone nearer gets the difference between their flight and this
 * one, which is what still makes proximity worth having: the first valid arrival
 * wins, so distance decides the RACE while no longer deciding who may enter it.
 */
export const SETTLEMENT_CLAIM_MINUTES = Math.ceil(
  fleetTravelExact(GALAXY_SPAN, {
    [MULTI_WORLD.settlement.transportHull]: MULTI_WORLD.settlement.transports,
  }),
);

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

/**
 * THE ONLY HULLS THAT CARRY ORE BETWEEN OWNED WORLDS.
 *
 * Exported because the transfer screen has to NAME them. It used to list craft by
 * "what this world has more than none of", so a commander with no transport was shown
 * no transport row, a cargo readout of `0 / 0` and three sliders pinned at zero, with
 * the reason written nowhere — the refusal existed on the server and the sentence
 * existed on no surface at all. A screen that names the pair off its own literal
 * would be a second copy of this rule, free to drift the first time a third
 * transport is priced.
 *
 * NOT the same list as `CLAN_TRANSFERABLE_HULLS`, and not the same as clan aid's
 * carriers (the same three dedicated transports — see `clanTransferCargoCapacity`).
 */
export const TRANSFER_CARGO_HULLS = ['COURIER', 'WAYFARER', 'ATLAS'] as const;

/** Only dedicated transports count when moving resources between owned worlds. */
export function transferCargoCapacity(fleet: Fleet): number {
  let capacity = 0;
  for (const id of TRANSFER_CARGO_HULLS) capacity += (fleet[id] ?? 0) * HULLS[id].cargo;
  return capacity;
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
  // T1 fills equal-volume radial strata. Shuffle those strata independently of
  // the Fibonacci directions so radius cannot become a disguised north/south band.
  const radialRanks = Array.from({ length: count }, (_, index) => index)
    .toSorted((a, b) => {
      const ah = profileSeed(seed ^ 0x6a09e667 ^ tier, a) >>> 0;
      const bh = profileSeed(seed ^ 0x6a09e667 ^ tier, b) >>> 0;
      return ah - bh || a - b;
    });

  return Array.from({ length: count }, (_, index) => {
    // Fibonacci directions cover the full sphere without latitude rings or poles.
    const vertical = 1 - (2 * (index + 0.5)) / count;
    const planar = Math.sqrt(1 - vertical * vertical);
    const angle = phase + index * GOLDEN_ANGLE;
    const radius = tier === 1
      ? GALAXY.radius * Math.cbrt(((radialRanks[index] ?? index) + 0.5) / count)
      : GALAXY.radius * (tier === 2 ? T2_RADIUS_SHARE : T3_RADIUS_SHARE);
    return {
      x: radius * planar * Math.cos(angle),
      y: radius * vertical,
      z: radius * planar * Math.sin(angle),
    };
  });
}

/** Match each ideal point to its nearest still-free generated address. */
function selectNearTargets(
  candidates: readonly PlanetSlot[],
  used: Set<number>,
  targets: readonly { x: number; y: number; z: number }[],
): PlanetSlot[] {
  const selected: PlanetSlot[] = [];
  for (const target of targets) {
    let best: PlanetSlot | undefined;
    let bestDistance = Infinity;
    for (const slot of candidates) {
      if (used.has(slot.index)) continue;
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
 * the whole playable sphere. Seeded ideal points are matched to generated addresses:
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
    return selectNearTargets(candidates, used, neutralTargets(seed, tier, count));
  };
  // Strategic strata get first choice of their constrained bands; T1 can use the remainder.
  const t3 = take(3);
  const t2 = take(2);
  const t1 = take(1);

  const wrap = (tier: NeutralTier, chosen: readonly PlanetSlot[]): NeutralSlot[] =>
    chosen.map((slot) => ({ slot, tier, profileSeed: profileSeed(seed, slot.index) }));
  return [...wrap(1, t1), ...wrap(2, t2), ...wrap(3, t3)];
}
