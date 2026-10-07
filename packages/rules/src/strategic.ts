import { HULLS } from './hulls.js';
import { GALAXY, MULTI_WORLD } from './constants.js';
import { cargoMult, type TechLevels } from './tech.js';
import { distance } from './travel.js';
import type { PlanetSlot } from './galaxy.js';
import type {
  Fleet,
  HullId,
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
 * HOW LONG A PUBLIC CLAIM STAYS OPEN: NINETY MINUTES. Owner decision, 2026-10-06.
 *
 * D111 derived this from the widest settlement flight — two Couriers across one
 * diameter — so the far half of the galaxy could never be locked out by arithmetic.
 * When every transport became 2.5x faster that derivation would have shrunk the
 * race from 81 minutes to about a third of an hour for a change nobody aimed at
 * it. The owner fixed it instead: "Sabit olsun ve 90dk olsun."
 *
 * D111'S GUARANTEE STILL HOLDS, AND A TEST KEEPS IT: the widest crossing the disc
 * allows lands well inside ninety minutes, so distance still decides the RACE
 * (first valid arrival wins) and never who may enter it.
 */
export const SETTLEMENT_CLAIM_MINUTES = 90;

/**
 * THE FIRST HOUR OF A CLAIM BELONGS TO THE RAIDER WHO OPENED IT. Owner decision, 2026-10-07:
 * "ilk 60dk sadece o kişi koloniyi elegeçirebilir olsun" — a commander who broke the guard
 * kept losing the world to a stranger's Couriers before their own could land.
 *
 * Inside the ninety minutes, not added to them: sixty that are the raider's, thirty that are
 * everyone's. The rule is about LANDING — anybody may leave early and land as the hour ends —
 * and it is reserved only for a raider with a free colony slot at the moment the claim opens,
 * or a commander could lock worlds they can never take. Nobody is shut out by distance:
 * every flight that fits the ninety reaches the open thirty — a near commander waits, a far
 * one leaves during the hour (the widest crossing, ~32 min, is longer than the thirty).
 */
export const SETTLEMENT_PRIORITY_MINUTES = 60;

/**
 * Capacity is deliberately stepwise and derived from the CAPITAL's Core: one colony
 * per threshold reached in `MULTI_WORLD.colonyCoreThresholds` (D209).
 */
export function colonyCapacity(capitalCore: number): number {
  return MULTI_WORLD.colonyCoreThresholds.filter((core) => capitalCore >= core).length;
}

/**
 * The Core the NEXT colony opens at for a commander holding `colonies` (and
 * `reservations` already flying), or null when every slot the game has is spoken
 * for. What the settle control tells a commander it cannot yet use. D209.
 */
export function nextColonyCore(colonies: number, reservations = 0): number | null {
  return MULTI_WORLD.colonyCoreThresholds[colonies + reservations] ?? null;
}

export const hasColonyCapacity = (
  capitalCore: number,
  colonies: number,
  reservations: number,
): boolean => colonies + reservations < colonyCapacity(capitalCore);

/** The staged neutral supply shared by season creation, the worker and the sim. */
export const NEUTRAL_OPENING = {
  initial: { 1: 15, 2: 8, 3: 3 },
  perFreeSlot: 1,
  firstCensusDays: 3,
  censusEveryHours: 24,
} as const;

export interface NeutralCommanderDemand {
  capitalCore: number;
  colonies: number;
  reservations: number;
}

const emptyTierCounts = (): Record<NeutralTier, number> => ({ 1: 0, 2: 0, 3: 0 });

/** Each unfilled colony right asks for the tier belonging to that ordinal right. */
export function neutralDemand(
  commanders: readonly NeutralCommanderDemand[],
): Record<NeutralTier, number> {
  const demand = emptyTierCounts();
  for (const commander of commanders) {
    const capacity = colonyCapacity(commander.capitalCore);
    const occupied = Math.max(0, Math.floor(commander.colonies) + Math.floor(commander.reservations));
    for (let ordinal = occupied + 1; ordinal <= capacity; ordinal++) {
      const tier = ordinal as NeutralTier;
      demand[tier] += NEUTRAL_OPENING.perFreeSlot;
    }
  }
  return demand;
}

export interface NeutralOpeningInput {
  demand: Readonly<Record<NeutralTier, number>>;
  /** Every neutral world currently available, including returned colonies. */
  stillNeutral: Readonly<Record<NeutralTier, number>>;
  /** Authored selected addresses already materialised, captured or not. */
  opened: Readonly<Record<NeutralTier, number>>;
  cap: Readonly<Record<NeutralTier, number>>;
}

/** Open only supply not already standing, and never beyond an authored tier cap. */
export function neutralOpenings(input: NeutralOpeningInput): Record<NeutralTier, number> {
  const openings = emptyTierCounts();
  for (const tier of [1, 2, 3] as const) {
    const unmet = Math.max(0, Math.floor(input.demand[tier]) - Math.floor(input.stillNeutral[tier]));
    const room = Math.max(0, Math.floor(input.cap[tier]) - Math.floor(input.opened[tier]));
    openings[tier] = Math.min(unmet, room);
  }
  return openings;
}

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
 * Dedicated transports. They form the Hauler group in world transfers and are
 * the only hulls eligible for merchant trade capacity. Other mobile ships with
 * holds can also carry resources between owned worlds.
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
 * carriers (the same four dedicated transports — see `clanTransferCargoCapacity`).
 */
export const TRANSFER_CARGO_HULLS = ['COURIER', 'WAYFARER', 'ATLAS', 'ARGOSY'] as const;

export type TransferDisposition = 'STAY' | 'RETURN';
export interface TransferReturnPlan {
  cargoShips: TransferDisposition;
  otherShips: TransferDisposition;
}

/** Ships ordered home after unloading at an owned world. */
export function transferReturningFleet(fleet: Fleet, plan: TransferReturnPlan): Fleet {
  const returning: Fleet = {};
  for (const [id, count] of Object.entries(fleet) as [HullId, number][]) {
    if (count <= 0) continue;
    const cargoShip = (TRANSFER_CARGO_HULLS as readonly HullId[]).includes(id);
    if ((cargoShip ? plan.cargoShips : plan.otherShips) === 'RETURN') returning[id] = count;
  }
  return returning;
}

export function transferStayingFleet(fleet: Fleet, returning: Fleet): Fleet {
  const staying: Fleet = {};
  for (const [id, count] of Object.entries(fleet) as [HullId, number][]) {
    if (count - (returning[id] ?? 0) > 0) staying[id] = count - (returning[id] ?? 0);
  }
  return staying;
}

/**
 * What a merchant trade convoy can carry. Only dedicated transports count.
 *
 * `CARGO_HOLDS` LIFTS THIS TOO, SINCE D180 (owner instruction). It used to lift
 * `fleetCargo` alone, on the reasoning that a raid's loot ceiling and a logistics
 * run are different questions. They are — the two count different rosters, and
 * still do — but they are not different LADDERS: a commander who buys a project
 * called Cargo Holds and finds their Atlas carrying exactly what it carried
 * yesterday has learned that the game lied to them, not that raid economics are
 * subtle.
 *
 * `tech` IS REQUIRED for the same reason it is required on `fleetSpeed`: an
 * optional one would let the next caller quote an unbuffed hold by omission, and
 * this figure is a REFUSAL as well as a label — `launchTrade` rejects a load above
 * it. One multiplier, `cargoMult`, floored after the
 * multiply exactly as `fleetCargo` floors it, so the two can never round apart.
 */
export function transferCargoCapacity(fleet: Fleet, tech: TechLevels): number {
  let capacity = 0;
  for (const id of TRANSFER_CARGO_HULLS) capacity += (fleet[id] ?? 0) * HULLS[id].cargo;
  return Math.floor(capacity * cargoMult(tech));
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
  /** Server-commander addresses after the capitals; neutrals start past them. Default 0. */
  botSlots?: number;
  neutralCounts: Readonly<Record<NeutralTier, number>>;
}

/**
 * Order one tier by repeatedly taking the address furthest from the prefix.
 * A deterministic profile seed chooses the first point; distance then keeps every
 * early census spread over the sphere instead of walking down Fibonacci latitude.
 */
function farthestNeutralOrder(slots: readonly NeutralSlot[]): NeutralSlot[] {
  if (slots.length === 0) return [];
  const remaining = [...slots].toSorted(
    (a, b) => a.profileSeed - b.profileSeed || a.slot.index - b.slot.index,
  );
  const ordered = [remaining.shift()!];
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = -1;
    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index]!;
      let nearest = Infinity;
      for (const opened of ordered) {
        nearest = Math.min(nearest, distance(candidate.slot, opened.slot));
      }
      const best = remaining[bestIndex]!;
      if (
        nearest > bestDistance
        || (nearest === bestDistance && (
          candidate.profileSeed < best.profileSeed
          || (candidate.profileSeed === best.profileSeed && candidate.slot.index < best.slot.index)
        ))
      ) {
        bestDistance = nearest;
        bestIndex = index;
      }
    }
    ordered.push(remaining.splice(bestIndex, 1)[0]!);
  }
  return ordered;
}

/** Stable, balanced materialisation order; tier groups remain independently addressable. */
export function neutralOpeningOrder(
  seed: number,
  selected: readonly NeutralSlot[],
): NeutralSlot[] {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Neutral opening seed must be an integer');
  return ([1, 2, 3] as const).flatMap(
    (tier) => farthestNeutralOrder(selected.filter((entry) => entry.tier === tier)),
  );
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
  // T1 fills equal-volume radial strata of its own band. Shuffle those strata
  // independently of the Fibonacci directions so radius cannot become a disguised
  // north/south band.
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
    const { t1, t2Share, t3Share } = GALAXY.strata;
    const radius = tier === 1
      ? GALAXY.radius * Math.cbrt(
        t1.inner ** 3 + (((radialRanks[index] ?? index) + 0.5) / count) * (t1.outer ** 3 - t1.inner ** 3),
      )
      : GALAXY.radius * (tier === 2 ? t2Share : t3Share);
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
 * Pick the v2 neutral pool from slots after every reserved capital and bot address.
 * T3 owns the central contested points, T2 the ring around them, and T1 the outer
 * neutral band just inside the server's commanders (`GALAXY.strata`). Seeded ideal
 * points are matched to generated addresses: the worlds stay random-looking without allowing a whole tier to collapse into
 * one lucky angular sample.
 */
export function selectNeutralSlots(
  seed: number,
  slots: readonly PlanetSlot[],
  layout: NeutralLayout = {
    capitalSlots: MULTI_WORLD.capitalSlots,
    botSlots: MULTI_WORLD.botSlots,
    neutralCounts: MULTI_WORLD.neutralCounts,
  },
): NeutralSlot[] {
  const firstNeutral = layout.capitalSlots + (layout.botSlots ?? 0);
  const capital = slots.filter((slot) => slot.index < layout.capitalSlots);
  const candidates = slots.filter((slot) => slot.index >= firstNeutral);
  const needed =
    layout.neutralCounts[1]
    + layout.neutralCounts[2]
    + layout.neutralCounts[3];
  if (capital.length < layout.capitalSlots || candidates.length < needed) return [];

  const used = new Set<number>();
  /*
    EACH TIER DRAWS FROM ITS OWN RADIAL BAND, so the layering is a property of the
    selection rather than a hope about density. Matched to the nearest free address
    alone, a tier spilled into its neighbour's shell whenever the core ran short of
    addresses — one galaxy in ten once the counts doubled. A band too thin for its
    tier (a small simulated galaxy) falls back to the whole pool.
  */
  const { t1: t1Band, t3Outer } = GALAXY.strata;
  const within = (tier: NeutralTier) => (slot: PlanetSlot): boolean => {
    const share = Math.hypot(slot.x, slot.y, slot.z) / GALAXY.radius;
    if (tier === 3) return share < t3Outer;
    if (tier === 2) return share >= t3Outer && share < t1Band.inner;
    return share >= t1Band.inner;
  };
  const take = (tier: NeutralTier): PlanetSlot[] => {
    const count = layout.neutralCounts[tier];
    const band = candidates.filter(within(tier));
    const free = band.filter((slot) => !used.has(slot.index)).length;
    return selectNearTargets(free >= count ? band : candidates, used, neutralTargets(seed, tier, count));
  };
  // Strategic strata get first choice of their constrained bands; T1 can use the remainder.
  const t3 = take(3);
  const t2 = take(2);
  const t1 = take(1);

  const wrap = (tier: NeutralTier, chosen: readonly PlanetSlot[]): NeutralSlot[] =>
    chosen.map((slot) => ({ slot, tier, profileSeed: profileSeed(seed, slot.index) }));
  return [...wrap(1, t1), ...wrap(2, t2), ...wrap(3, t3)];
}
