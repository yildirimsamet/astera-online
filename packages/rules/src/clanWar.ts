import { HANGAR } from './constants.js';
import { buildingCost, hangarCapacity } from './economy.js';
import { missionFuelForDistances } from './fuel.js';
import type { Fleet, Resources } from './types.js';

/**
 * KLAN ORTAK SAVAŞI — the pure half. Owner design, 2026-09-20.
 *
 * Everything here is arithmetic a storage layer, an HTTP route and the client can
 * all reproduce: what a clan's shared hangar holds, what the next rung costs, what
 * three legs of a staging flight burn, who carries which part of one haul home,
 * and how a lopsided fight's Dominion is divided among the people who fought it.
 *
 * THE ONE INVARIANT EVERY ALLOCATION HERE ANSWERS TO: nothing is minted and
 * nothing is burned. A split that loses a unit to rounding is a resource leak in a
 * zero-sum ledger, and it would be invisible until somebody audited a season.
 */

const RESOURCE_KEYS = ['alloy', 'crystal', 'deuterium'] as const;
type ResourceKey = typeof RESOURCE_KEYS[number];

const NOTHING = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });

const resourceUnits = (amounts: Resources): number =>
  amounts.alloy + amounts.crystal + amounts.deuterium;

function assertWholeAmount(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function assertWholeResources(amounts: Resources, label: string): Resources {
  for (const key of RESOURCE_KEYS) assertWholeAmount(amounts[key], `${label} ${key}`);
  return amounts;
}

/* ── the clan ladder ────────────────────────────────────────────── */

export const CLAN_LEVEL_MIN = 1;
export const CLAN_LEVEL_MAX = HANGAR.maxLevel;

function assertClanLevel(level: number, top: number): number {
  if (!Number.isSafeInteger(level) || level < CLAN_LEVEL_MIN || level > top) {
    throw new RangeError(`clan level must be an integer between ${CLAN_LEVEL_MIN} and ${top}`);
  }
  return level;
}

/**
 * WHAT THE KLAN HANGARI HOLDS AT THIS RUNG — exactly twice the personal Hangar's
 * room, measured in the same `hangarLoad` bulk as every other capacity in the
 * game. Owner decision.
 *
 * DERIVED, NEVER TABULATED. A second table of ten numbers would have to be
 * re-derived by hand the next time the personal ladder moves, and the failure
 * would be silent: a clan quietly holding the wrong amount of fleet.
 *
 * It is a SEPARATE pool from a member's own Hangar and never a discount on it —
 * a contributed wave keeps occupying its owner's personal room for its whole life
 * (`clan-joint-war` §3.5), so sending ships out frees nothing at home.
 */
export function clanHangarCapacity(level: number): number {
  return 2 * hangarCapacity(assertClanLevel(level, CLAN_LEVEL_MAX));
}

/**
 * WHAT THE NEXT RUNG COSTS — TWICE the personal Hangar's price, for twice the room.
 * Owner decision, 2026-09-22, replacing "the room doubles, the invoice does not".
 *
 * THE OLD RULE HAD A HIDDEN COUPLING. A clan rung bought double room at the personal invoice, so
 * every cut to the personal ladder halved the clan's price per unit of room — for free, without
 * anybody choosing it. Plan 2B.3 cut the late personal rungs by 35–75%; under the old rule that
 * would have handed clans the same cut twice over.
 *
 * Doubling the invoice keeps the coupling and closes the multiplier: a unit of clan room now costs
 * exactly what a unit of personal room costs, at every rung, whatever the personal ladder does
 * next. `hangar-price.test.ts` holds that equality.
 *
 * Still delegated to `buildingCost` so the clan ladder cannot drift from the building ladder it
 * mirrors. There is NO cost at the top rung, and that absence is the rule that closes donation and
 * upgrade at level 10 rather than a separate flag.
 */
export function clanLevelUpgradeCost(currentLevel: number): Resources {
  const personal = buildingCost('HANGAR', assertClanLevel(currentLevel, CLAN_LEVEL_MAX - 1));
  return {
    alloy: personal.alloy * 2,
    crystal: personal.crystal * 2,
    deuterium: personal.deuterium * 2,
  };
}

/* ── fuel ───────────────────────────────────────────────────────── */

/**
 * THE LEGS A CONTRIBUTION PAYS FOR, UP FRONT AND ONCE.
 *
 * A member's wave flies origin → staging → target → origin: three legs, three
 * lengths, and the last one is NOT the first one reversed. The leader's own
 * capital is already at the staging world, so it pays the two combat legs only.
 */
export type JointWarFuelLeg =
  | 'ORIGIN_TO_STAGING'
  | 'STAGING_TO_TARGET'
  | 'TARGET_TO_ORIGIN'
  | 'TARGET_TO_STAGING';

/** The legs a physically-flown contribution is charged for, in flight order. */
export const JOINT_WAR_PHYSICAL_LEGS: readonly JointWarFuelLeg[] = [
  'ORIGIN_TO_STAGING', 'STAGING_TO_TARGET', 'TARGET_TO_ORIGIN',
];

/** The legs the leader's staging-capital contribution is charged for. */
export const JOINT_WAR_STAGING_LEGS: readonly JointWarFuelLeg[] = [
  'STAGING_TO_TARGET', 'TARGET_TO_STAGING',
];

export interface JointWarFuelLegQuote {
  leg: JointWarFuelLeg;
  distance: number;
  fuel: number;
}

/**
 * WHAT A CONTRIBUTION BURNS. The existing mission formula, named for this lane.
 *
 * A NAME, NOT A SECOND FORMULA. `missionFuelForDistances` already rounds each real
 * leg up on its own length (which is the whole reason it exists), and a joint war
 * is nothing but a mission with an extra waypoint. A second copy would disagree
 * with the launch screen the first time either moved.
 */
export function jointWarFuel(fleet: Fleet, distances: readonly number[]): number {
  return missionFuelForDistances(fleet, distances);
}

/**
 * The same charge, itemised — because the player commits to it before anything
 * flies and `fuel_paid = sum(legs)` is an invariant the audit checks.
 *
 * Each leg is quoted through the one formula, so the parts cannot fail to add up
 * to the total no matter how the rounding falls.
 */
export function jointWarFuelLegs(
  fleet: Fleet,
  legs: readonly { leg: JointWarFuelLeg; distance: number }[],
): { legs: JointWarFuelLegQuote[]; total: number } {
  const quoted = legs.map((leg) => ({
    leg: leg.leg,
    distance: leg.distance,
    fuel: jointWarFuel(fleet, [leg.distance]),
  }));
  return { legs: quoted, total: jointWarFuel(fleet, legs.map((leg) => leg.distance)) };
}

/* ── deterministic integer allocation ───────────────────────────── */

interface Target {
  /** Canonical tie-breaker: a player or contribution UUID. */
  key: string;
  units: number;
}

const byKey = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** Larger exact remainder first; 0 when the two shares are genuinely equal. */
const compareRest = (left: bigint, right: bigint): number =>
  left < right ? 1 : left > right ? -1 : 0;

/**
 * MAX-MIN FAIR SHARE OF ONE HAUL. Owner design.
 *
 * Everybody's carried total is raised together; whoever fills up drops out and
 * their unclaimed room is re-offered to the rest. The smallest hold on the field
 * therefore always comes home full, which is the point: a member who sent one
 * transport is not paid a rounding error for having shown up.
 *
 * The remainder that will not divide is handed out one unit apiece in UUID order,
 * so the split is the same whichever order the waves happened to be read in.
 */
function waterFill(units: number, caps: readonly Target[]): number[] {
  const targets = new Array<number>(caps.length).fill(0);
  const ascending = caps
    .map((_, index) => index)
    .sort((x, y) => caps[x]!.units - caps[y]!.units || byKey(caps[x]!.key, caps[y]!.key));

  let remaining = units;
  for (let seat = 0; seat < ascending.length; seat++) {
    const left = ascending.length - seat;
    const base = Math.floor(remaining / left);
    const index = ascending[seat]!;
    if (caps[index]!.units <= base) {
      targets[index] = caps[index]!.units;
      remaining -= caps[index]!.units;
      continue;
    }
    // Everyone still standing has room for `base`, since the list is ascending.
    const rest = ascending.slice(seat);
    const extra = remaining - base * left;
    for (const other of rest) targets[other] = base;
    const canonical = [...rest].sort((x, y) => byKey(caps[x]!.key, caps[y]!.key));
    for (let given = 0; given < extra; given++) targets[canonical[given]!]! += 1;
    break;
  }
  return targets;
}

/**
 * SPLIT A WHOLE INTO SHARES PROPORTIONAL TO WEIGHTS, LOSING NOTHING.
 *
 * Largest remainder, with the exact rational remainder compared as an integer so
 * two shares that are genuinely equal tie rather than being separated by a float
 * artefact. Ties fall to the lower UUID.
 */
function largestRemainder(total: number, weights: readonly Target[]): number[] {
  const out = new Array<number>(weights.length).fill(0);
  const denominator = weights.reduce((sum, row) => sum + row.units, 0);
  if (total === 0 || denominator === 0) return out;

  const den = BigInt(denominator);
  const remainders: { index: number; rest: bigint }[] = [];
  let assigned = 0;
  for (let index = 0; index < weights.length; index++) {
    const numerator = BigInt(total) * BigInt(weights[index]!.units);
    const share = Number(numerator / den);
    out[index] = share;
    assigned += share;
    remainders.push({ index, rest: numerator % den });
  }
  remainders.sort((x, y) => (
    compareRest(x.rest, y.rest) || byKey(weights[x.index]!.key, weights[y.index]!.key)
  ));
  for (let given = 0; given < total - assigned; given++) out[remainders[given]!.index]! += 1;
  return out;
}

/**
 * ROUND A PROPORTIONAL SPLIT OF THREE PILES ONTO WHOLE BUNDLES.
 *
 * Each bundle carries exactly the number of units it was allotted (so nobody
 * exceeds the hold they were measured against), each pile is handed out exactly
 * once (so nothing is minted or burned), and every bundle mirrors the haul's
 * alloy:crystal:deuterium shape as closely as whole units allow.
 *
 * WHY IT IS NOT THREE INDEPENDENT LARGEST-REMAINDER PASSES. Rounding each resource
 * on its own keeps the piles exact but lets a bundle drift up to two units past
 * its allowance — which, for the commander whose hold was the binding constraint,
 * is cargo they cannot physically carry. Rows and columns have to be settled
 * together. A transportation matrix always has an integral point inside its own
 * floor/ceiling box, and the descending-need greedy below finds one.
 */
function roundBundles(total: Resources, targets: readonly Target[]): Resources[] {
  const bundles = targets.map(() => NOTHING());
  const units = resourceUnits(total);
  if (units === 0 || targets.length === 0) return bundles;

  const den = BigInt(units);
  const rowNeed = new Array<number>(targets.length).fill(0);
  const colNeed: Record<ResourceKey, number> = { ...total };
  const rest: bigint[][] = targets.map(() => [0n, 0n, 0n]);

  for (let row = 0; row < targets.length; row++) {
    let placed = 0;
    for (let col = 0; col < RESOURCE_KEYS.length; col++) {
      const key = RESOURCE_KEYS[col]!;
      const numerator = BigInt(total[key]) * BigInt(targets[row]!.units);
      const base = Number(numerator / den);
      bundles[row]![key] = base;
      rest[row]![col] = numerator % den;
      placed += base;
      colNeed[key] -= base;
    }
    rowNeed[row] = targets[row]!.units - placed;
  }

  const order = targets
    .map((_, index) => index)
    .sort((x, y) => rowNeed[y]! - rowNeed[x]! || byKey(targets[x]!.key, targets[y]!.key));

  for (const row of order) {
    let need = rowNeed[row]!;
    if (need <= 0) continue;
    const columns = [0, 1, 2]
      .filter((col) => colNeed[RESOURCE_KEYS[col]!] > 0)
      .sort((x, y) => (
        colNeed[RESOURCE_KEYS[y]!] - colNeed[RESOURCE_KEYS[x]!]
        || compareRest(rest[row]![x]!, rest[row]![y]!)
        || x - y
      ));
    for (const col of columns) {
      if (need === 0) break;
      const key = RESOURCE_KEYS[col]!;
      bundles[row]![key] += 1;
      colNeed[key] -= 1;
      need -= 1;
    }
    if (need !== 0) throw new RangeError('joint allocation could not be rounded without a leak');
  }

  for (const key of RESOURCE_KEYS) {
    if (colNeed[key] !== 0) {
      throw new RangeError('joint allocation could not be rounded without a leak');
    }
  }
  return bundles;
}

/* ── loot and salvage ───────────────────────────────────────────── */

/** One surviving wave and the room it still has. `cargo` is raw hold units. */
export interface JointCargoShare {
  playerId: string;
  contributionId: string;
  cargo: number;
}

export interface JointResourceShare {
  playerId: string;
  contributionId: string;
  resources: Resources;
}

const canonicalShare = (left: JointCargoShare, right: JointCargoShare): number =>
  byKey(left.playerId, right.playerId) || byKey(left.contributionId, right.contributionId);

/**
 * WHO CARRIES WHICH PART OF ONE JOINT HAUL. Owner design, §3.10.
 *
 * ONE haul is computed first, against the whole surviving side's hold, exactly as
 * a single raider's is. It is then divided in two steps, and the order matters:
 *
 *   1. BETWEEN COMMANDERS, max-min fair. Equality is measured in raw cargo units —
 *      one alloy, one crystal and one deuterium are each one unit — so nobody is
 *      paid more for having been handed the dearer pile.
 *   2. INSIDE a commander, across their own surviving waves in proportion to each
 *      wave's remaining hold, because the loot has to physically fly home in the
 *      ships that are carrying it.
 *
 * A wave with no surviving hold is not in the division at all. The ordinary 10%
 * clan raid share (`CLAN.raidLootShare`) is deliberately NOT applied anywhere on
 * this path: a joint war pays its participants, not the roster.
 */
export function allocateJointLoot(
  total: Resources,
  shares: readonly JointCargoShare[],
): JointResourceShare[] {
  assertWholeResources(total, 'joint loot');
  const eligible = [...shares]
    .filter((share) => assertWholeAmount(share.cargo, 'joint loot hold') > 0)
    .sort(canonicalShare);
  const units = resourceUnits(total);
  if (units === 0 || eligible.length === 0) return [];

  const byPlayer = new Map<string, JointCargoShare[]>();
  for (const share of eligible) {
    const waves = byPlayer.get(share.playerId);
    if (waves) waves.push(share);
    else byPlayer.set(share.playerId, [share]);
  }
  const players = [...byPlayer.keys()].sort(byKey);
  const holds = players.map((playerId) => ({
    key: playerId,
    units: byPlayer.get(playerId)!.reduce((sum, wave) => sum + wave.cargo, 0),
  }));
  const room = holds.reduce((sum, hold) => sum + hold.units, 0);
  if (units > room) {
    throw new RangeError('joint loot exceeds the surviving hold it was computed against');
  }

  const playerBundles = roundBundles(total, waterFill(units, holds).map((given, index) => ({
    key: players[index]!,
    units: given,
  })));

  const out: JointResourceShare[] = [];
  for (let index = 0; index < players.length; index++) {
    const waves = byPlayer.get(players[index]!)!;
    const bundle = playerBundles[index]!;
    const weights = waves.map((wave) => ({ key: wave.contributionId, units: wave.cargo }));
    const perWave = largestRemainder(resourceUnits(bundle), weights);
    const split = roundBundles(bundle, weights.map((weight, seat) => ({
      key: weight.key,
      units: perWave[seat]!,
    })));
    for (let seat = 0; seat < waves.length; seat++) {
      out.push({
        playerId: waves[seat]!.playerId,
        contributionId: waves[seat]!.contributionId,
        resources: split[seat]!,
      });
    }
  }
  return out;
}

/**
 * WHO LIFTS WHICH PART OF THE WRECK. §3.10, and deliberately not the loot rule.
 *
 * Salvage is not a haul to be shared fairly — it is work done by a specific hull.
 * Every surviving Garbage Collector lifts in proportion to the room it brought,
 * whoever owns it, and the remainder stays in orbit as the ordinary public field
 * (`settleWreck`). Max-min fairness here would pay a commander who brought no
 * collector at all.
 */
export function allocateJointSalvage(
  total: Resources,
  shares: readonly JointCargoShare[],
): JointResourceShare[] {
  assertWholeResources(total, 'joint salvage');
  const eligible = [...shares]
    .filter((share) => assertWholeAmount(share.cargo, 'joint salvage lift') > 0)
    .sort(canonicalShare);
  const units = resourceUnits(total);
  if (units === 0 || eligible.length === 0) return [];

  const weights = eligible.map((share) => ({ key: share.contributionId, units: share.cargo }));
  const room = weights.reduce((sum, weight) => sum + weight.units, 0);
  if (units > room) {
    throw new RangeError('joint salvage exceeds the lift it was computed against');
  }
  const perWave = largestRemainder(units, weights);
  const split = roundBundles(total, weights.map((weight, seat) => ({
    key: weight.key,
    units: perWave[seat]!,
  })));
  return eligible.map((share, seat) => ({
    playerId: share.playerId,
    contributionId: share.contributionId,
    resources: split[seat]!,
  }));
}

/* ── Dominion ───────────────────────────────────────────────────── */

const SAFE_MAX = BigInt(Number.MAX_SAFE_INTEGER);
const SAFE_MIN = BigInt(Number.MIN_SAFE_INTEGER);

function fromExact(value: bigint, label: string): number {
  if (value > SAFE_MAX || value < SAFE_MIN) {
    throw new RangeError(`${label} is outside the safe integer range`);
  }
  return Number(value);
}

/**
 * THE ONLY THING A HEAD-COUNT ADVANTAGE CHANGES. Owner decision, §3.11.
 *
 * It does NOT change the fight. Five commanders bring five commanders' guns and
 * the battle resolves exactly as those guns say it should. What it changes is the
 * LADDER: a three-on-one win is worth a third of the same win alone, and a
 * three-on-one defeat pays the defender three times over. Dominion is a claim
 * about skill, and outnumbering somebody is not one.
 *
 * BOTH WAYS in form, though only the attackers are ever the many here: a joint war's
 * defender is one commander. A line HELD BY SEVERAL (Klan Savunma Desteği) is priced by
 * power, not heads — `adjustDefendedDominion` with the support factor, which equals this
 * function whenever that factor is a whole number.
 *
 * TRUNCATED TOWARD ZERO, in exact integer arithmetic. Rounding could turn a
 * transfer of two into a transfer of one where the rule says three attackers share
 * it, and a ladder that mints a point from a rounding mode is not zero-sum.
 */
export function adjustJointDominion(
  base: number,
  attackers: number,
  defenders: number,
): number {
  if (!Number.isSafeInteger(base)) {
    throw new RangeError('joint Dominion base must be a safe integer');
  }
  if (!Number.isSafeInteger(attackers) || attackers < 1) {
    throw new RangeError('joint Dominion needs at least one attacking commander');
  }
  if (!Number.isSafeInteger(defenders) || defenders < 1) {
    throw new RangeError('joint Dominion needs at least one defending commander');
  }
  if (base === 0 || attackers === defenders) return base;

  const exact = base > 0
    ? (BigInt(base) * BigInt(defenders)) / BigInt(attackers)
    : (BigInt(base) * BigInt(attackers)) / BigInt(defenders);
  return fromExact(exact, 'joint Dominion transfer');
}

/** One participant's unnormalised score before the team transfer is divided. */
export interface JointDominionWeight {
  playerId: string;
  /** `allocated loot value + allocated defender loss - own permanent loss`. Signed. */
  raw: number;
}

export interface JointDominionShare {
  playerId: string;
  delta: number;
}

/**
 * DIVIDE THE TEAM'S TRANSFER AMONG THE PEOPLE WHO EARNED IT. §7.3.
 *
 * Each participant's exact share is `adjusted x raw_i / base`, and because the
 * ratio correction never flips the team's sign, a commander who came out behind
 * still reads as behind. The whole-number remainder is settled by fractional size
 * and then by UUID, and the shares sum to the adjusted transfer EXACTLY — that
 * equality is what keeps the player ledger and the clan ledger zero-sum against
 * the defender's single opposite entry.
 *
 * A TEAM THAT EXCHANGED NOTHING PAYS NOBODY. When `base` is zero the participants'
 * raw scores cancelled out, and manufacturing equal-and-opposite deltas from that
 * would move score between allies over a battle that moved none.
 */
export function allocateJointDominion(
  adjusted: number,
  weights: readonly JointDominionWeight[],
): JointDominionShare[] {
  if (!Number.isSafeInteger(adjusted)) {
    throw new RangeError('joint Dominion transfer must be a safe integer');
  }
  const roster = [...weights].sort((left, right) => byKey(left.playerId, right.playerId));
  let base = 0n;
  for (const weight of roster) {
    if (!Number.isSafeInteger(weight.raw)) {
      throw new RangeError('joint Dominion weight must be a safe integer');
    }
    base += BigInt(weight.raw);
  }
  if (adjusted === 0 || base === 0n) {
    return roster.map((weight) => ({ playerId: weight.playerId, delta: 0 }));
  }

  const shares = roster.map((weight) => ({ playerId: weight.playerId, delta: 0 }));
  const remainders: { seat: number; rest: bigint }[] = [];
  let placed = 0n;
  for (let seat = 0; seat < roster.length; seat++) {
    const numerator = BigInt(adjusted) * BigInt(roster[seat]!.raw);
    const whole = numerator / base;
    shares[seat]!.delta = fromExact(whole, 'joint Dominion share');
    placed += whole;
    const rest = numerator % base;
    remainders.push({ seat, rest: rest < 0n ? -rest : rest });
  }

  let outstanding = BigInt(adjusted) - placed;
  if (outstanding === 0n) return shares;
  const step = outstanding > 0n ? 1 : -1;
  remainders.sort((x, y) => (
    compareRest(x.rest, y.rest) || byKey(roster[x.seat]!.playerId, roster[y.seat]!.playerId)
  ));
  for (const row of remainders) {
    if (outstanding === 0n) break;
    shares[row.seat]!.delta += step;
    outstanding -= BigInt(step);
  }
  if (outstanding !== 0n) {
    throw new RangeError('joint Dominion shares could not be settled without a leak');
  }
  return shares;
}

/**
 * WHOSE FIRE KILLED WHAT THE DEFENDER LOST. §7.3.
 *
 * The defender's permanent loss is one number for one board, and Dominion needs it
 * per attacker — so it is divided by each participant's CREDITED hull damage, the
 * post-shield, overkill-capped figure the resolver returns. The split is exact:
 * the parts must add back to the defender's loss or the team's raw scores will not
 * reproduce the base transfer, and settlement refuses to commit when they do not.
 */
export function allocateJointDefenderLoss(
  total: number,
  shares: readonly { playerId: string; damage: number }[],
): { playerId: string; value: number }[] {
  assertWholeAmount(total, 'defender permanent loss');
  const roster = [...shares].sort((left, right) => byKey(left.playerId, right.playerId));
  let credited = 0;
  for (const share of roster) {
    if (!Number.isFinite(share.damage) || share.damage < 0) {
      throw new RangeError('credited hull damage must be a non-negative number');
    }
    credited += share.damage;
  }
  if (total === 0) return roster.map((share) => ({ playerId: share.playerId, value: 0 }));
  if (credited <= 0) {
    throw new RangeError('a defender loss cannot be attributed without any hull damage');
  }

  const out = roster.map((share) => ({ playerId: share.playerId, value: 0 }));
  const fractions: { seat: number; rest: number }[] = [];
  let placed = 0;
  for (let seat = 0; seat < roster.length; seat++) {
    const exact = (total * roster[seat]!.damage) / credited;
    const whole = Math.floor(exact);
    out[seat]!.value = whole;
    placed += whole;
    fractions.push({ seat, rest: exact - whole });
  }
  fractions.sort((x, y) => (
    y.rest - x.rest || byKey(roster[x.seat]!.playerId, roster[y.seat]!.playerId)
  ));
  // `total - placed` is mathematically below the roster size; the guard is here
  // because the exact shares are read off floating-point damage, and a leak in a
  // zero-sum ledger has to stop a settlement rather than quietly round away.
  const outstanding = total - placed;
  if (outstanding < 0 || outstanding > fractions.length) {
    throw new RangeError('defender loss attribution could not be settled without a leak');
  }
  for (let given = 0; given < outstanding; given++) out[fractions[given]!.seat]!.value += 1;
  return out;
}
