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

/**
 * WHAT A LADDER PAYS AT ONE RUNG, AND LEVEL ZERO IS ALWAYS NEUTRAL.
 *
 * Every effect below is a typed table now (D169), so there is exactly one piece of
 * arithmetic left in this file and this is it: clamp into the table, and read.
 * Level zero is not in the table because "not researched" is not a rung — it is
 * the absence of one, and its value is 1 for every project by construction.
 */
const ladderAt = (ladder: readonly number[], level: number): number => {
  const rung = Math.max(0, Math.min(ladder.length, Math.floor(level)));
  return rung === 0 ? 1 : ladder[rung - 1] ?? 1;
};

/**
 * HOW MUCH FASTER THE YARD RUNS. T8.
 *
 * A share off the build time, never a rewrite of the throughput curve: the
 * Shipyard still decides the shape and this shaves it.
 *
 * D169 opened the ladder at a tenth and took it to three tenths at the top, where
 * it used to run from 4% to 20%. That is a real second Shipyard at rung five, and
 * it is priced like one — see the table in `research.ts`.
 */
export const yardSpeedMult = (tech: TechLevels): number =>
  ladderAt(RESEARCH_TECH.yardSpeedLadder, tech.YARD_AUTOMATION ?? 0);

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
  ladderAt(RESEARCH_TECH.holdLadder, tech.PROSPECTOR_HOLDS ?? 0);

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
  ladderAt(RESEARCH_TECH.cargoLadder, tech.CARGO_HOLDS ?? 0);

/**
 * ONE SIDE'S CONTRIBUTION, AS A FACTOR ON ONE STAT. D169.
 *
 * It used to be `powerCeiling` raised to a fractional power, which made the
 * ceiling arithmetic rather than a promise — and made every rung unreadable:
 * 1.0225651825635729 for eleven thousand alloy. The relationship now runs the
 * other way. The table is authored, and `powerCeiling` is DERIVED from its top
 * rung squared, so the ceiling still cannot disagree with what is sold; what
 * changed is which of the two a person wrote down.
 */
const fleetStatSide = (level: number): number =>
  ladderAt(RESEARCH_TECH.fleetStatLadder, level);

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
 * may never raise a hull's equal-budget power above `RESEARCH_TECH.powerCeiling`,
 * and that ceiling is now read off the ladder rather than the ladder off it.
 *
 *   information (the counter cycle)  1.6 / 0.625 = 2.56x   =  156%
 *   technology  (Power x Armor)      1.25 x 1.25 = 1.5625x =   56%
 *
 * `hulls.ts` states the claim the game rests on — "information beats tech by
 * construction". D169 gave attack and hit points 25% EACH on the owner's
 * instruction, so the product is 1.5625x and the information lead narrowed from
 * six times to 1.64x. It is still a lead, and `test/tech.test.ts` walks every hull
 * at every rung to hold it rather than trusting this paragraph.
 */
export function hullTech(
  tech: TechLevels,
  id: HullId,
): { atk: number; hp: number; speed: number } {
  const hull = HULLS[id];
  const fleetV2 = hull.tier !== null;
  const emplacement = hull.profile === 'EMPLACEMENT';

  if (emplacement) {
    const factor = ladderAt(RESEARCH_TECH.doctrineLadder, tech.EMPLACEMENT_DOCTRINE ?? 0);
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
