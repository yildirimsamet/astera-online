import { DISRUPTION, ECON, SEASON, SHIELD } from './constants.js';
import { SATELLITE_IDS, type Resources, type SatelliteLevels } from './types.js';

/**
 * Satellite levels, by known key.
 *
 * `Object.values()` on a `Partial<Record<K, number>>` is typed `number[]`, which
 * quietly hides the fact that a value can be undefined at runtime. Iterating the
 * key list keeps the types honest and matches how hulls are handled.
 */
export function satelliteEntries(sats: SatelliteLevels): [(typeof SATELLITE_IDS)[number], number][] {
  const out: [(typeof SATELLITE_IDS)[number], number][] = [];
  for (const id of SATELLITE_IDS) {
    const level = sats[id];
    if (level !== undefined && level > 0) out.push([id, level]);
  }
  return out;
}

export const alloyRate = (level: number): number =>
  ECON.alloyBase * Math.pow(ECON.alloyMult, level);

export const crystalRate = (level: number): number =>
  ECON.crystalBase * Math.pow(ECON.crystalMult, level);

/** Cost to go from `level` to `level + 1`. */
export function upgradeCost(level: number): Resources {
  return {
    alloy: Math.round(ECON.costBase * Math.pow(ECON.costMult, level)),
    crystal:
      level >= ECON.crystalCostFromLevel
        ? Math.round(ECON.crystalCostBase * Math.pow(ECON.crystalCostMult, level))
        : 0,
  };
}

/** Everything sunk into a building to reach `level`. Feeds the Wealth display. */
export function investedInBuilding(level: number): number {
  let total = 0;
  for (let l = 0; l < level; l++) {
    const c = upgradeCost(l);
    total += c.alloy + c.crystal;
  }
  return total;
}

export const storageCap = (ratePerHour: number): number =>
  Math.round(ECON.capHours * ratePerHour);

/** Level 0 still protects the base amount — nobody is ever lootable to zero. */
export const vaultProtects = (level: number): number =>
  Math.round(ECON.vaultBase * Math.pow(ECON.vaultMult, Math.max(0, level)));

export const shieldHp = (level: number): number =>
  level <= 0 ? 0 : Math.round(SHIELD.base * Math.pow(SHIELD.mult, level));

export const satelliteSlots = (ringLevel: number): number =>
  1 + Math.floor(ringLevel / 2);

/**
 * Hours for an upgrade at `level` to repay its own cost.
 *
 * Grows by (costMult / alloyMult) per level, which is the brake that stops a
 * 14-day season running away — and the reason investment stops being rational
 * on the final day, producing the sunset phase.
 */
export function paybackHours(level: number): number {
  const cost = ECON.costBase * Math.pow(ECON.costMult, level);
  const gain = ECON.alloyBase * Math.pow(ECON.alloyMult, level) * (ECON.alloyMult - 1);
  return cost / gain;
}

/** Is building still rational, this many hours before the season ends? */
export const worthInvesting = (level: number, hoursRemaining: number): boolean =>
  paybackHours(level) < hoursRemaining * SEASON.investmentHorizonShare;

/* ── Disruption ─────────────────────────────────────────────────── */

export const disruptionMinutes = (grade: 'DECISIVE' | 'PARTIAL' | 'REPELLED'): number =>
  grade === 'DECISIVE'
    ? DISRUPTION.decisiveMinutes
    : grade === 'PARTIAL'
      ? DISRUPTION.partialMinutes
      : 0;

/** Refreshes rather than stacks, and is capped — chain-raiding cannot bury a player. */
export function applyDisruption(
  disruptedUntil: number,
  now: number,
  grade: 'DECISIVE' | 'PARTIAL' | 'REPELLED',
): number {
  const add = disruptionMinutes(grade);
  if (add === 0) return disruptedUntil;
  return Math.min(now + DISRUPTION.maxPendingMinutes, Math.max(disruptedUntil, now + add));
}

/** Producing minutes inside [from, to), given surface works offline until `until`. */
export function productiveMinutes(from: number, to: number, until = 0): number {
  const span = Math.max(0, to - from);
  const lost = Math.max(0, Math.min(to, until) - from);
  return Math.max(0, span - lost);
}

/* ── The lazy tick ──────────────────────────────────────────────── */

export interface PlanetEconomyState {
  alloy: number;
  crystal: number;
  shield: number;
  lastTickMinutes: number;
  disruptedUntilMinutes: number;
}

export interface PlanetEconomyInput {
  refineryLevel: number;
  extractorLevel: number;
  aegisLevel: number;
}

/**
 * Advance a planet's continuous state to `nowMinutes`.
 *
 * This is the entire offline-progression system. It is called at the top of any
 * transaction that touches a planet, and never on a timer — production for 300
 * players costs exactly zero background compute.
 *
 * Shield regeneration deliberately uses wall-clock minutes rather than
 * productive ones: it is a separate system and disruption should not freeze it.
 */
export function advanceEconomy(
  state: PlanetEconomyState,
  input: PlanetEconomyInput,
  nowMinutes: number,
): PlanetEconomyState {
  if (nowMinutes <= state.lastTickMinutes) return state;

  const producing = productiveMinutes(
    state.lastTickMinutes,
    nowMinutes,
    state.disruptedUntilMinutes,
  ) / 60;
  const wall = (nowMinutes - state.lastTickMinutes) / 60;

  const ra = alloyRate(input.refineryLevel);
  const rc = crystalRate(input.extractorLevel);
  const maxShield = shieldHp(input.aegisLevel);

  return {
    alloy: Math.min(storageCap(ra), state.alloy + ra * producing),
    crystal: Math.min(storageCap(rc), state.crystal + rc * producing),
    shield:
      maxShield > 0
        ? Math.min(maxShield, state.shield + maxShield * SHIELD.regenPerHour * wall)
        : 0,
    lastTickMinutes: nowMinutes,
    disruptedUntilMinutes: state.disruptedUntilMinutes,
  };
}
