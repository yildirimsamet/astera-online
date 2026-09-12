import { GALAXY, INTERGALACTIC_CONVOY } from './constants.js';
import { alloyRate, crystalRate, deuteriumRate, productionMult } from './economy.js';
import { missionFuelForDistances } from './fuel.js';
import {
  HULLS,
  MOBILE_HULLS,
  combatValue,
  fleetCargo,
  fleetEntries,
} from './hulls.js';
import { clamp } from './rng.js';
import { fleetPace, type FlightModifiers } from './travel.js';
import type { IntergalacticConvoyEffect } from './galaxyEvents.js';
import type { TechLevels } from './tech.js';
import type {
  BuildingLevels,
  Fleet,
  MobileHullId,
  Resources,
  Rng,
  SatelliteSet,
  ShipTier,
  Vec3,
} from './types.js';

const MOBILE_HULL_SET: ReadonlySet<string> = new Set(MOBILE_HULLS);
const EPSILON = 1e-12;

const finiteVec = (value: Vec3): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);

function randomUnit(rng: Rng): number {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('convoy random draws must be finite values in [0, 1)');
  }
  return value;
}

function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and positive`);
  }
}

function assertProbability(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a probability`);
  }
}

function assertWeights(weights: readonly number[], name: string): void {
  if (weights.length === 0
    || weights.some((weight) => !Number.isFinite(weight) || weight < 0 || weight > 1)
    || Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) > 1e-9) {
    throw new RangeError(`${name} must contain probabilities summing to one`);
  }
}

function assertVersion(value: number, supported: number, name: string): void {
  if (value !== supported) throw new RangeError(`unsupported convoy ${name} version`);
}

function assertRewardEffect(effect: IntergalacticConvoyEffect): void {
  assertVersion(effect.rewardPoolVersion, 1, 'reward pool');
  assertPositive(effect.resourceCapHours, 'resourceCapHours');
  assertPositive(effect.fullRewardForceRatio, 'fullRewardForceRatio');
  assertPositive(effect.shipDropFullFirepower, 'shipDropFullFirepower');
  assertProbability(effect.shipDropChanceAtFullQuality, 'shipDropChanceAtFullQuality');
  assertWeights(effect.shipCountWeights, 'shipCountWeights');
  assertWeights(effect.shipTierWeights, 'shipTierWeights');
}

function validatedMobileFleet(
  fleet: unknown,
  options: { allowEmpty: boolean; requireFirepower: boolean },
): Fleet {
  if (typeof fleet !== 'object' || fleet === null) {
    throw new RangeError('convoy fleet must be an object');
  }
  const copy: Fleet = {};
  let count = 0;
  for (const [rawId, rawCount] of Object.entries(fleet)) {
    if (!MOBILE_HULL_SET.has(rawId)) {
      throw new RangeError(`convoy fleet contains non-mobile hull ${rawId}`);
    }
    if (typeof rawCount !== 'number' || !Number.isSafeInteger(rawCount) || rawCount <= 0) {
      throw new RangeError(`convoy fleet count for ${rawId} must be a positive safe integer`);
    }
    count += rawCount;
    if (!Number.isSafeInteger(count)) throw new RangeError('convoy fleet count overflow');
    copy[rawId as MobileHullId] = rawCount;
  }
  if (!options.allowEmpty && count === 0) {
    throw new RangeError('convoy fleet must contain a mobile hull');
  }
  const firepower = combatValue(copy);
  if (!Number.isSafeInteger(firepower) || firepower < 0) {
    throw new RangeError('convoy fleet firepower overflow');
  }
  if (options.requireFirepower && firepower === 0) {
    throw new RangeError('convoy fleet must have positive firepower');
  }
  return copy;
}

export interface IntergalacticConvoySpec {
  readonly sequence: number;
  readonly routeVersion: 1;
  readonly appearsAt: number;
  readonly expiresAt: number;
  readonly direction: Vec3;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly velocity: Vec3;
  /** Game units per minute. */
  readonly speed: number;
}

/** Derive the persisted route-v1 occurrence without a clock or ambient randomness. */
export function intergalacticConvoySpec(
  occurrence: {
    readonly sequence: number;
    readonly startsAtMinute: number;
    readonly endsAtMinute: number;
    readonly effect: IntergalacticConvoyEffect;
  },
  rng: Rng,
): IntergalacticConvoySpec {
  if (!Number.isSafeInteger(occurrence.sequence) || occurrence.sequence < 0) {
    throw new RangeError('convoy sequence must be a non-negative safe integer');
  }
  assertVersion(occurrence.effect.routeVersion, 1, 'route');
  if (!Number.isFinite(occurrence.startsAtMinute)
    || !Number.isFinite(occurrence.endsAtMinute)
    || occurrence.endsAtMinute - occurrence.startsAtMinute
      !== INTERGALACTIC_CONVOY.durationMinutes) {
    throw new RangeError('convoy route duration must match the authored duration');
  }
  assertPositive(GALAXY.radius, 'galaxy radius');

  // V1 DRAW ORDER IS FROZEN: azimuth, then z. Append; never insert.
  const azimuth = randomUnit(rng) * Math.PI * 2;
  const z = randomUnit(rng) * 2 - 1;
  const radial = Math.sqrt(Math.max(0, 1 - z * z));
  const direction = {
    x: radial * Math.cos(azimuth),
    y: radial * Math.sin(azimuth),
    z,
  };
  const speed = (2 * GALAXY.radius) / INTERGALACTIC_CONVOY.durationMinutes;
  const from = {
    x: -direction.x * GALAXY.radius,
    y: -direction.y * GALAXY.radius,
    z: -direction.z * GALAXY.radius,
  };
  const to = {
    x: direction.x * GALAXY.radius,
    y: direction.y * GALAXY.radius,
    z: direction.z * GALAXY.radius,
  };
  return {
    sequence: occurrence.sequence,
    routeVersion: 1,
    appearsAt: occurrence.startsAtMinute,
    expiresAt: occurrence.endsAtMinute,
    direction,
    from,
    to,
    speed,
    velocity: {
      x: direction.x * speed,
      y: direction.y * speed,
      z: direction.z * speed,
    },
  };
}

/** The formation centre on its authored, clamped two-hour diameter transit. */
export function intergalacticConvoyPosition(
  spec: Pick<IntergalacticConvoySpec, 'appearsAt' | 'expiresAt' | 'from' | 'to'>,
  minute: number,
): Vec3 {
  if (!Number.isFinite(minute)) throw new RangeError('convoy position minute must be finite');
  const span = spec.expiresAt - spec.appearsAt;
  if (!Number.isFinite(span) || span <= 0 || !finiteVec(spec.from) || !finiteVec(spec.to)) {
    throw new RangeError('invalid convoy route spec');
  }
  const progress = clamp((minute - spec.appearsAt) / span, 0, 1);
  if (progress === 0) return { ...spec.from };
  if (progress === 1) return { ...spec.to };
  return {
    x: spec.from.x + (spec.to.x - spec.from.x) * progress,
    y: spec.from.y + (spec.to.y - spec.from.y) * progress,
    z: spec.from.z + (spec.to.z - spec.from.z) * progress,
  };
}

export interface ConvoyFormationSlot {
  readonly rank: number;
  readonly column: -1 | 1;
  readonly hull: MobileHullId;
  readonly localPosition: Vec3;
}

/** Frozen v1 double-row layout. Local +Z is the direction of travel. */
export function convoyFormationSlots(formationVersion: number): readonly ConvoyFormationSlot[] {
  if (formationVersion !== 1) throw new RangeError('unsupported convoy formation version');
  const ranks = INTERGALACTIC_CONVOY.formation.ranks;
  const gaps = INTERGALACTIC_CONVOY.formation.rankGaps;
  if (gaps.length !== ranks.length - 1) {
    throw new RangeError('convoy formation gaps must separate every neighbouring rank');
  }
  const rankZ = ranks.map((_, rankIndex) => (
    rankIndex === 0
      ? 0
      : -gaps.slice(0, rankIndex).reduce((distance, gap) => distance + gap, 0)
  ));
  // The gameplay anchor and camera subject sit halfway along the finished train,
  // regardless of the uneven gaps required by its different hull sizes.
  const centreZ = ((rankZ[0] ?? 0) + (rankZ.at(-1) ?? 0)) / 2;
  return ranks.flatMap((pair, rankIndex) => ([-1, 1] as const).map((column, columnIndex) => ({
    rank: rankIndex + 1,
    column,
    hull: pair[columnIndex]!,
    localPosition: {
      x: column * INTERGALACTIC_CONVOY.formation.lateralSpacing / 2,
      y: 0,
      z: (rankZ[rankIndex] ?? 0) - centreZ,
    },
  })));
}

/** The explicit manifest a rewardPoolVersion=1 occurrence was dealt with. */
export function intergalacticConvoyRewardPool(
  rewardPoolVersion: number,
): readonly MobileHullId[] {
  if (rewardPoolVersion !== 1) throw new RangeError('unsupported convoy reward pool version');
  return INTERGALACTIC_CONVOY.rewardPool;
}

export interface LinearTransitInterceptInput {
  readonly origin: Vec3;
  readonly targetAtQuoteTime: Vec3;
  readonly targetVelocity: Vec3;
  readonly fleetUnitsPerMinute: number;
  readonly minMeetMinute: number;
  readonly maxMeetMinute: number;
}

export interface LinearTransitIntercept {
  /** Minutes after quote/departure time. */
  readonly meetsAtMinute: number;
  readonly at: Vec3;
}

/** Solve |target + velocity*t - origin| = fleetSpeed*t for the first valid root. */
export function interceptLinearTransit(
  input: LinearTransitInterceptInput,
): LinearTransitIntercept | null {
  const { origin, targetAtQuoteTime: target, targetVelocity: velocity } = input;
  if (!finiteVec(origin) || !finiteVec(target) || !finiteVec(velocity)
    || !Number.isFinite(input.fleetUnitsPerMinute) || input.fleetUnitsPerMinute <= 0
    || !Number.isFinite(input.minMeetMinute) || input.minMeetMinute < 0
    || !Number.isFinite(input.maxMeetMinute)
    || input.maxMeetMinute < input.minMeetMinute) return null;

  const relative = {
    x: target.x - origin.x,
    y: target.y - origin.y,
    z: target.z - origin.z,
  };
  const dot = (left: Vec3, right: Vec3): number =>
    left.x * right.x + left.y * right.y + left.z * right.z;
  const c = dot(relative, relative);
  if (c === 0) {
    if (input.minMeetMinute > EPSILON) return null;
    return { meetsAtMinute: 0, at: { ...target } };
  }

  const speedSquared = input.fleetUnitsPerMinute ** 2;
  const a = dot(velocity, velocity) - speedSquared;
  const b = 2 * dot(relative, velocity);
  const coefficientScale = Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c));
  const coefficientEpsilon = EPSILON * coefficientScale;
  let roots: number[];
  if (Math.abs(a) <= coefficientEpsilon) {
    if (Math.abs(b) <= coefficientEpsilon) return null;
    roots = [-c / b];
  } else {
    const rawDiscriminant = b * b - 4 * a * c;
    const discriminantScale = Math.max(b * b, Math.abs(4 * a * c), Number.MIN_VALUE);
    const discriminantEpsilon = Number.EPSILON * 64 * discriminantScale;
    if (rawDiscriminant < -discriminantEpsilon) return null;
    const discriminant = Math.abs(rawDiscriminant) <= discriminantEpsilon
      ? 0
      : rawDiscriminant;
    const root = Math.sqrt(Math.max(0, discriminant));
    if (root === 0) {
      roots = [-b / (2 * a)];
    } else {
      const q = -0.5 * (b + Math.sign(b || 1) * root);
      roots = [q / a, c / q];
    }
  }

  const boundaryEpsilon = EPSILON * Math.max(1, Math.abs(input.maxMeetMinute));
  const meetsAtMinute = roots
    .filter((value) => Number.isFinite(value)
      && value >= Math.max(0, input.minMeetMinute) - boundaryEpsilon
      && value <= input.maxMeetMinute + boundaryEpsilon)
    .sort((left, right) => left - right)[0];
  if (meetsAtMinute === undefined) return null;
  const boundedMinute = clamp(
    meetsAtMinute,
    Math.max(0, input.minMeetMinute),
    input.maxMeetMinute,
  );
  const at = {
    x: target.x + velocity.x * boundedMinute,
    y: target.y + velocity.y * boundedMinute,
    z: target.z + velocity.z * boundedMinute,
  };
  return finiteVec(at) ? { meetsAtMinute: boundedMinute, at } : null;
}

export interface IntergalacticConvoyIntercept {
  readonly arrivesAtMinute: number;
  readonly intercept: Vec3;
  readonly engagementEndsAtMinute: number;
  readonly engagementEnd: Vec3;
}

/**
 * Aim at the moving formation centre and reserve the complete five-second pass.
 * The returned second point is the real beginning of the homeward leg.
 */
export function interceptIntergalacticConvoy(input: {
  readonly origin: Vec3;
  readonly spec: Pick<
    IntergalacticConvoySpec,
    'appearsAt' | 'expiresAt' | 'from' | 'to' | 'velocity'
  >;
  readonly departAtMinute: number;
  readonly fleetUnitsPerMinute: number;
}): IntergalacticConvoyIntercept | null {
  if (!Number.isFinite(input.departAtMinute)
    || input.departAtMinute < input.spec.appearsAt
    || input.departAtMinute >= input.spec.expiresAt) return null;
  const engagementMinutes = INTERGALACTIC_CONVOY.engagementSeconds / 60;
  const latestMeetAfterDeparture = input.spec.expiresAt
    - engagementMinutes
    - input.departAtMinute;
  if (latestMeetAfterDeparture < 0) return null;
  const targetAtDeparture = intergalacticConvoyPosition(input.spec, input.departAtMinute);
  const result = interceptLinearTransit({
    origin: input.origin,
    targetAtQuoteTime: targetAtDeparture,
    targetVelocity: input.spec.velocity,
    fleetUnitsPerMinute: input.fleetUnitsPerMinute,
    minMeetMinute: 0,
    maxMeetMinute: latestMeetAfterDeparture,
  });
  if (result === null) return null;
  const arrivesAtMinute = input.departAtMinute + result.meetsAtMinute;
  const engagementEndsAtMinute = arrivesAtMinute + engagementMinutes;
  return {
    arrivesAtMinute,
    intercept: result.at,
    engagementEndsAtMinute,
    engagementEnd: intergalacticConvoyPosition(input.spec, engagementEndsAtMinute),
  };
}

export const CONVOY_ENGAGEMENT_MS = INTERGALACTIC_CONVOY.engagementSeconds * 1_000;

export function convoyEngagementEndsAt(arriveAtMs: number): number {
  if (!Number.isFinite(arriveAtMs)) throw new RangeError('convoy arrival must be finite');
  return arriveAtMs + CONVOY_ENGAGEMENT_MS;
}

export const isConvoyEngaging = (arriveAtMs: number, nowMs: number): boolean =>
  Number.isFinite(nowMs)
  && nowMs >= arriveAtMs
  && nowMs < convoyEngagementEndsAt(arriveAtMs);

export function convoyProductionCap(input: {
  readonly buildings: BuildingLevels;
  readonly orbit: SatelliteSet;
  readonly effect: Pick<IntergalacticConvoyEffect, 'resourceCapHours'>;
}): Resources {
  assertPositive(input.effect.resourceCapHours, 'resourceCapHours');
  for (const id of ['REFINERY', 'EXTRACTOR', 'DEUTERIUM_PLANT'] as const) {
    if (!Number.isSafeInteger(input.buildings[id]) || input.buildings[id] < 0) {
      throw new RangeError(`building level ${id} must be a non-negative safe integer`);
    }
  }
  const boost = productionMult(input.orbit);
  assertPositive(boost, 'production multiplier');
  const cap = {
    alloy: Math.floor(alloyRate(input.buildings.REFINERY) * boost * input.effect.resourceCapHours),
    crystal: Math.floor(
      crystalRate(input.buildings.EXTRACTOR) * boost * input.effect.resourceCapHours,
    ),
    deuterium: Math.floor(
      deuteriumRate(input.buildings.DEUTERIUM_PLANT) * boost * input.effect.resourceCapHours,
    ),
  };
  assertResources(cap, 'production cap');
  return cap;
}

function assertResources(resources: Resources, name: string): void {
  for (const [resource, amount] of Object.entries(resources)) {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new RangeError(`${name}.${resource} must be a non-negative safe integer`);
    }
  }
}

function convoyMaxTier(fleet: Fleet): ShipTier {
  let maxTier: ShipTier = 1;
  for (const [id] of fleetEntries(fleet)) {
    const tier = HULLS[id].tier;
    if (tier !== null && tier > maxTier) maxTier = tier;
  }
  return maxTier;
}

export interface IntergalacticConvoyRewardQuote {
  readonly productionCap: Resources;
  readonly firepower: number;
  readonly resourceFullThreshold: number;
  readonly resourceQualityFactor: number;
  readonly shipQualityFactor: number;
  readonly rawResourceReward: Resources;
  readonly cargo: number;
  readonly cargoFactor: number;
  readonly resourceReward: Resources;
  readonly shipDropChance: number;
  readonly maxTier: ShipTier;
}

/** The one launch-time reward quote shared by server and client. */
export function quoteIntergalacticConvoyReward(input: {
  readonly productionCap: Resources;
  readonly fleet: Fleet;
  readonly launchTech: TechLevels;
  readonly effect: Pick<
    IntergalacticConvoyEffect,
    | 'resourceCapHours'
    | 'fullRewardForceRatio'
    | 'shipDropFullFirepower'
    | 'shipDropChanceAtFullQuality'
  >;
}): IntergalacticConvoyRewardQuote {
  assertPositive(input.effect.resourceCapHours, 'resourceCapHours');
  assertPositive(input.effect.fullRewardForceRatio, 'fullRewardForceRatio');
  assertPositive(input.effect.shipDropFullFirepower, 'shipDropFullFirepower');
  assertProbability(input.effect.shipDropChanceAtFullQuality, 'shipDropChanceAtFullQuality');
  assertResources(input.productionCap, 'production cap');
  const fleet = validatedMobileFleet(input.fleet, { allowEmpty: false, requireFirepower: true });
  const firepower = combatValue(fleet);
  const capTotal = input.productionCap.alloy
    + input.productionCap.crystal
    + input.productionCap.deuterium;
  if (!Number.isSafeInteger(capTotal)) throw new RangeError('production cap total overflow');
  /*
    THE THRESHOLD IS A RATIO OF A TOTAL, SO IT IS NOT AN INTEGER. D201.

    This asserted `Number.isSafeInteger`, which happens to hold at
    `fullRewardForceRatio: 1` and fails for every other value a balance pass might
    reach for — 0.8 of a cap is a fraction, and the assert turned that into a
    RangeError thrown inside the launch transaction, i.e. a 500 on a player's
    action. Nothing downstream needs a whole number: the factor it feeds is a clamp
    to [0, 1] and the rewards are floored afterwards. What actually has to hold is
    that the figure is finite and positive, which is what the divisor needs.
  */
  const resourceFullThreshold = Math.max(1, capTotal * input.effect.fullRewardForceRatio);
  if (!Number.isFinite(resourceFullThreshold) || resourceFullThreshold <= 0) {
    throw new RangeError('resource reward threshold must be finite and positive');
  }
  const resourceQualityFactor = clamp(firepower / resourceFullThreshold, 0, 1);
  const shipQualityFactor = clamp(firepower / input.effect.shipDropFullFirepower, 0, 1);
  const rawResourceReward = {
    alloy: Math.floor(input.productionCap.alloy * resourceQualityFactor),
    crystal: Math.floor(input.productionCap.crystal * resourceQualityFactor),
    deuterium: Math.floor(input.productionCap.deuterium * resourceQualityFactor),
  };
  const rawTotal = rawResourceReward.alloy
    + rawResourceReward.crystal
    + rawResourceReward.deuterium;
  if (!Number.isSafeInteger(rawTotal)) throw new RangeError('raw convoy reward overflow');
  const cargo = fleetCargo(fleet, input.launchTech);
  if (!Number.isSafeInteger(cargo) || cargo < 0) throw new RangeError('convoy cargo overflow');
  const cargoFactor = Math.min(1, cargo / Math.max(1, rawTotal));
  const resourceReward = {
    alloy: Math.floor(rawResourceReward.alloy * cargoFactor),
    crystal: Math.floor(rawResourceReward.crystal * cargoFactor),
    deuterium: Math.floor(rawResourceReward.deuterium * cargoFactor),
  };
  return {
    productionCap: { ...input.productionCap },
    firepower,
    resourceFullThreshold,
    resourceQualityFactor,
    shipQualityFactor,
    rawResourceReward,
    cargo,
    cargoFactor,
    resourceReward,
    shipDropChance: input.effect.shipDropChanceAtFullQuality * shipQualityFactor,
    maxTier: convoyMaxTier(fleet),
  };
}

function weightedIndex(weights: readonly number[], roll: number): number {
  let accumulated = 0;
  for (let index = 0; index < weights.length; index += 1) {
    accumulated += weights[index] ?? 0;
    if (roll < accumulated) return index;
  }
  return weights.length - 1;
}

/** Roll the server-seeded prize once. Persist the returned Fleet; never re-roll it. */
export function rollIntergalacticConvoyAward(input: {
  readonly fleet: Fleet;
  readonly shipQualityFactor: number;
  readonly effect: IntergalacticConvoyEffect;
  readonly rng: Rng;
}): Fleet {
  assertRewardEffect(input.effect);
  assertProbability(input.shipQualityFactor, 'shipQualityFactor');
  const fleet = validatedMobileFleet(input.fleet, { allowEmpty: false, requireFirepower: true });
  const chance = input.effect.shipDropChanceAtFullQuality * input.shipQualityFactor;
  if (randomUnit(input.rng) >= chance) return {};

  const count = weightedIndex(input.effect.shipCountWeights, randomUnit(input.rng)) + 1;
  const maxTier = convoyMaxTier(fleet);
  const eligibleTierWeights = input.effect.shipTierWeights.slice(0, maxTier);
  const eligibleWeightTotal = eligibleTierWeights.reduce((sum, weight) => sum + weight, 0);
  assertPositive(eligibleWeightTotal, 'eligible tier weight');
  const pool = intergalacticConvoyRewardPool(input.effect.rewardPoolVersion);
  const award: Fleet = {};
  for (let index = 0; index < count; index += 1) {
    const tierRoll = randomUnit(input.rng) * eligibleWeightTotal;
    const tier = (weightedIndex(eligibleTierWeights, tierRoll) + 1) as ShipTier;
    const tierPool = pool.filter((id) => HULLS[id].tier === tier);
    if (tierPool.length === 0) throw new RangeError(`convoy reward tier ${String(tier)} is empty`);
    const hullIndex = Math.floor(randomUnit(input.rng) * tierPool.length);
    const hull = tierPool[hullIndex];
    if (hull === undefined) throw new RangeError('convoy reward hull draw was out of bounds');
    award[hull] = (award[hull] ?? 0) + 1;
  }
  return award;
}

export interface IntergalacticConvoyReturnProfile {
  readonly visibleFleet: Fleet;
  readonly deliveredFleet: Fleet;
  readonly cargo: number;
  readonly pace: number;
  readonly fuel: number;
}

/** Keep the prize towed and outside every frozen launch-flight calculation. */
export function intergalacticConvoyReturnProfile(input: {
  readonly fleet: Fleet;
  readonly awardedFleet: Fleet;
  readonly launchTech: TechLevels;
  readonly flightModifiers: FlightModifiers;
  readonly outboundDistance: number;
  readonly returnDistance: number;
}): IntergalacticConvoyReturnProfile {
  const fleet = validatedMobileFleet(input.fleet, { allowEmpty: false, requireFirepower: true });
  const awardedFleet = validatedMobileFleet(
    input.awardedFleet,
    { allowEmpty: true, requireFirepower: false },
  );
  const rewardPool = intergalacticConvoyRewardPool(1);
  for (const [id] of fleetEntries(awardedFleet)) {
    if (!rewardPool.includes(id as MobileHullId)) {
      throw new RangeError(`awarded hull ${id} is outside the convoy reward pool`);
    }
  }
  const deliveredFleet: Fleet = { ...fleet };
  for (const [id, count] of fleetEntries(awardedFleet)) {
    const delivered = (deliveredFleet[id] ?? 0) + count;
    if (!Number.isSafeInteger(delivered)) throw new RangeError('delivered fleet count overflow');
    deliveredFleet[id] = delivered;
  }
  const pace = fleetPace(fleet, input.flightModifiers);
  const cargo = fleetCargo(fleet, input.launchTech);
  if (!Number.isFinite(pace) || pace <= 0 || !Number.isSafeInteger(cargo) || cargo < 0) {
    throw new RangeError('invalid frozen convoy flight profile');
  }
  return {
    visibleFleet: { ...fleet },
    deliveredFleet,
    cargo,
    pace,
    fuel: missionFuelForDistances(fleet, [input.outboundDistance, input.returnDistance]),
  };
}

/**
 * UX GUARD FOR A NON-RECALLABLE LAUNCH, AND THE AGE IS THE WHOLE OF IT. D201.
 *
 * The screen shows an ETA and the player confirms it a few seconds later. Both
 * figures a quote could be checked against — the flight's DURATION and its
 * ABSOLUTE arrival — move at very nearly the delay itself, because a rendezvous
 * with a moving target is usually pinned in absolute time: departing `d` later
 * simply leaves `d` less flying to do. Measured over the shipped geometry the
 * worst-case duration drift is 0.98 × the delay.
 *
 * SO A RAW TOLERANCE ON EITHER FIGURE IS A REACTION-TIME TEST, NOT A STALENESS
 * TEST. At five seconds it refused the median confirmation — the player read the
 * sheet, pressed commit, and was told the convoy had moved beyond the launch they
 * had just been shown. Nothing was wrong with their quote; they were slow.
 *
 * THE DELAY IS THEREFORE FORGIVEN AND ONLY THE SURPLUS IS JUDGED.
 * `quoteToleranceSeconds` now bounds how much the trip changed BEYOND what the
 * elapsed time already explains, which is the only part that means "this is not
 * the launch you were shown" — a different wing, a different world, a client that
 * did its own arithmetic. `maxQuoteAgeSeconds` is the real staleness bound and
 * the one a human has to live inside.
 *
 * The server still recomputes every value it commits; this only decides whether
 * the player is asked to look again.
 */
export function intergalacticConvoyQuoteIsFresh(input: {
  readonly quotedAtMs: number;
  readonly quotedFlightSeconds: number;
  readonly quotedArriveAtMs: number;
  readonly serverNowMs: number;
  readonly actualFlightSeconds: number;
  readonly actualArriveAtMs: number;
}): boolean {
  const values = Object.values(input);
  if (values.some((value) => !Number.isFinite(value))) return false;
  const ageMs = input.serverNowMs - input.quotedAtMs;
  if (ageMs < 0 || ageMs > INTERGALACTIC_CONVOY.maxQuoteAgeSeconds * 1_000) return false;
  const allowanceSeconds = INTERGALACTIC_CONVOY.quoteToleranceSeconds + ageMs / 1_000;
  return Math.abs(input.quotedFlightSeconds - input.actualFlightSeconds) <= allowanceSeconds
    && Math.abs(input.quotedArriveAtMs - input.actualArriveAtMs) <= allowanceSeconds * 1_000;
}
