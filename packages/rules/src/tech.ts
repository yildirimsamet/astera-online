import { RESEARCH_TECH } from './constants.js';
import { HULLS } from './hulls.js';
import type { HullId, ResearchProjectId } from './types.js';

/**
 * WHAT A COMMANDER HAS RESEARCHED, AS LEVELS. T8 · T9.
 *
 * Every levelled effect in the game reads this one shape, and every effect is a
 * single exported pure function below. That is not tidiness: this code base has
 * already shipped an effect honoured in one place and forgotten in another (the
 * satellites), and a multiplier that applies on the server but not in the launch
 * preview is a screen that lies about a decision.
 *
 * A missing entry is level zero, which is always the neutral value. Every function
 * here returns exactly 1 — or the untouched base — for an empty map, so a caller
 * that has no research to hand cannot accidentally change an outcome.
 */
export type TechLevels = Partial<Record<ResearchProjectId, number>>;

const rung = (tech: TechLevels, id: ResearchProjectId, max: number): number =>
  Math.max(0, Math.min(max, Math.floor(tech[id] ?? 0)));

/**
 * HOW MUCH FASTER THE YARD RUNS. T8.
 *
 * A share off the build time, never a rewrite of the throughput curve: the
 * Shipyard still decides the shape and this shaves it. D128 calibrated yard time
 * with a coefficient of 1.50 and `pnpm balance:goal` holds the six-to-seven day
 * band, so the ceiling here is deliberately small enough to be a convenience
 * rather than a second Shipyard.
 */
export const yardSpeedMult = (tech: TechLevels): number =>
  1 - RESEARCH_TECH.yardSpeedPerLevel
    * rung(tech, 'YARD_AUTOMATION', RESEARCH_TECH.economyMaxLevel);

/**
 * HOW MUCH MORE ONE MINING CRAFT CARRIES. T8.
 *
 * MULTIPLICATIVE WITH THE DERRICK, and that is a decision rather than an accident.
 * The Derrick is hardware in orbit that lifts every craft the player owns; this is
 * a technique that lifts every craft they will ever own. They are two different
 * kinds of investment answering the same question, and a player who has made both
 * should see both — an additive split would make whichever came second feel like
 * it did nothing.
 */
export const prospectorHoldMult = (tech: TechLevels): number =>
  1 + RESEARCH_TECH.holdPerLevel
    * rung(tech, 'PROSPECTOR_HOLDS', RESEARCH_TECH.economyMaxLevel);

/**
 * HOW MUCH MORE A HULL CARRIES HOME. T8.
 *
 * THE MOST DANGEROUS OF THE THREE, because `fleetCargo` is what caps a raid's
 * loot: this is the only economy project that moves ARR directly. It is the
 * smallest for that reason, and the band is measured rather than assumed.
 *
 * It does NOT touch `transferCargoCapacity`, which counts only Courier, Wayfarer
 * and Atlas moving ore between a commander's own worlds. Those are two different questions —
 * what a raid can carry away, and what a logistics run can move — and they were
 * deliberately separated long before this existed.
 */
export const cargoMult = (tech: TechLevels): number =>
  1 + RESEARCH_TECH.cargoPerLevel
    * rung(tech, 'CARGO_HOLDS', RESEARCH_TECH.economyMaxLevel);

/**
 * One side's contribution, as a factor on ONE stat.
 *
 * Everything is derived from `powerCeiling`. Equal-budget power goes as
 * `atk x hp / value^2`, so a project that lifts attack and hit points equally by
 * `c` moves power by `c^2` — which is why each side takes the square root of the
 * share it is allowed. Written this way, the ceiling is arithmetic rather than a
 * promise: change `powerCeiling` and every rung follows it.
 */
const side = (level: number, share: number): number =>
  Math.pow(
    RESEARCH_TECH.powerCeiling,
    (share / 2) * (Math.max(0, Math.min(RESEARCH_TECH.weaponMaxLevel, Math.floor(level)))
      / RESEARCH_TECH.weaponMaxLevel),
  );

/** A full half of the product ceiling: Power owns attack and Armor owns HP. */
const fleetStatSide = (level: number): number =>
  side(level, 1);

/**
 * Propulsion is linear and visibly capped at DOUBLE across four rungs. D152.
 *
 * It reads `propulsionMaxLevel` rather than `weaponMaxLevel` because speed is not
 * a combat statistic: it takes no share of `powerCeiling` and therefore has no
 * business inheriting the ladder length that ceiling is split across.
 */
const propulsionSide = (level: number): number =>
  1 + RESEARCH_TECH.propulsionPerLevel
    * Math.max(0, Math.min(RESEARCH_TECH.propulsionMaxLevel, Math.floor(level)));

/**
 * WHAT THIS COMMANDER'S RESEARCH DOES TO ONE HULL. T9.
 *
 * THE ONE HARD RULE IN THE WHOLE TASK: the COMBINED effect of every weapon project
 * may never raise a hull's equal-budget power above `RESEARCH_TECH.powerCeiling`.
 *
 *   information (the counter cycle)  1.6 / 0.625 = 2.56x   =  156%
 *   technology  (every project)                    1.25x   =   25%
 *
 * `hulls.ts` states the claim the game rests on — "information beats tech by
 * construction". Give attack and hit points 25% EACH and the product is 1.5625x,
 * which is 56%, and at that point knowing what your opponent flies stops being the
 * decisive thing. So the ceiling is on the PRODUCT, the two projects split it
 * between them, and `test/tech.test.ts` walks every hull at every rung rather than
 * trusting this paragraph.
 */
export function hullTech(
  tech: TechLevels,
  id: HullId,
): { atk: number; hp: number; speed: number } {
  const hull = HULLS[id];
  const fleetV2 = hull.tier !== null;
  const emplacement = hull.profile === 'EMPLACEMENT';

  if (emplacement) {
    const factor = side(
      tech.EMPLACEMENT_DOCTRINE ?? 0,
      RESEARCH_TECH.doctrineShare,
    );
    return { atk: factor, hp: factor, speed: 1 };
  }

  if (!fleetV2) return { atk: 1, hp: 1, speed: 1 };

  return {
    atk: hull.cls === 'SUPPORT' ? 1 : fleetStatSide(tech.SHIP_POWER ?? 0),
    hp: fleetStatSide(tech.SHIP_ARMOR ?? 0),
    speed: propulsionSide(tech.SHIP_PROPULSION ?? 0),
  };
}

/**
 * The doctrines a probe brings home. T9 · D124.
 *
 * A 25% multiplier nobody can see would silently eat the value of every scouting
 * flight, and D124 is blunt about it: a rule the player cannot SEE is not a rule.
 * This is the list that goes into the silhouette — frozen at the look and stale
 * from then on, exactly like everything else D127 put there.
 */
export const COMBAT_RESEARCH_PROJECTS: readonly ResearchProjectId[] = [
  'SHIP_POWER', 'SHIP_ARMOR', 'EMPLACEMENT_DOCTRINE',
];
