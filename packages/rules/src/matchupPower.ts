import { SHIELD_BREAKER } from './constants.js';
import { HULLS, counterMult, fleetValue } from './hulls.js';
import { shipCanFight, shipHealthGroups } from './shipMaintenance.js';
import { hullTech, shipShieldHp } from './tech.js';
import type { HpDamageLots } from './radiationHp.js';
import type { CombatSide } from './combat.js';
import type { Fleet, HullClass, HullId } from './types.js';

/**
 * GÖRECELİ SAVAŞ GÜCÜ — combat v3, owner 2026-10-25 (docs/combat-v3-plan-2026-10-25.md §4).
 *
 * What a side is worth AGAINST THE SIDE IT MEETS, not what it cost. Lanchester's square law
 * makes a fight's balance the product of how fast a side grinds the other down and how much
 * of it there is to grind: P = K·√(DPS × EHP).
 *
 * - DPS is base fire per round times the counter multiplier earned on the enemy line. A mixed
 *   line is read by the EHP-weighted harmonic mean of the multipliers: the rate that destroys
 *   the whole line, whatever order the shots take it in.
 * - EHP is hull plus personal shield of everything that stands in the line (cargo flies behind
 *   it and adds nothing), plus Aegis on the defence, less the share Nullifier bonus burns.
 * - K makes one bare Dart against a Dart worth exactly its price, so the owner's power tiers
 *   (25k / 100k / 300k) keep reading in the resource numbers players already know.
 *
 * The battle engine reads the same numbers for its tempo and handicap, so the ruler a player
 * sees and the fight that happens cannot drift apart.
 */
export interface PowerUnit {
  hull: HullId;
  cls: HullClass;
  /** Base damage per shot after research and handicap; 0 for a hull that cannot fire. */
  attack: number;
  /** Remaining hull plus personal shield. */
  ehp: number;
  /** Full researched hull: the weight the Nullifier opening reads a line by. */
  maxHp: number;
  count: number;
}
export interface MatchupSide {
  units: readonly PowerUnit[];
  /** Planet Aegis charge; only ever on the defence. */
  aegis?: number;
}
export interface SidePower { power: number; dps: number; ehp: number }
export interface Matchup { attacker: SidePower; defender: SidePower }

/** A side's ships as power units: wounds read from `damage`, grounded hulls fire nothing. */
export function powerUnits(fleet: Fleet, side: CombatSide, damage?: HpDamageLots | null, maintenance = false): PowerUnit[] {
  return shipHealthGroups(fleet, damage).map(lot => {
    const hull = HULLS[lot.hull], tech = hullTech(side.tech, lot.hull);
    // An admiral's hull bonus stands on the hull and the ship shield alike, as `statsFor` fights it.
    const hullMult = side.hullMult ?? 1;
    const maxHp = hull.hp * tech.hp * hullMult;
    const hp = maxHp * (10000 - lot.damageBp - (lot.remainderBp ?? 0)) / 10000;
    const fires = !maintenance || hull.ground || shipCanFight(lot);
    return { hull: lot.hull, cls: hull.cls, count: lot.count, maxHp,
      attack: fires ? hull.atk * tech.atk * (side.damageMult ?? 1) : 0,
      ehp: hp + (side.shipShields === false ? 0 : shipShieldHp(side.tech, lot.hull) * hullMult) };
  });
}

/** What a shot can reach: the armed line, or cargo once nothing armed stands. */
const lineOf = (units: readonly PowerUnit[]): readonly PowerUnit[] => {
  const present = units.filter(unit => unit.count > 0);
  const combat = present.filter(unit => unit.cls !== 'SUPPORT');
  return combat.length > 0 ? combat : present;
};

/** The EHP-weighted harmonic mean of the counter multipliers; neutral against nothing. */
function multiplierAgainst(cls: HullClass, line: readonly PowerUnit[]): number {
  let ehp = 0, work = 0;
  for (const unit of line) {
    const weight = unit.ehp * unit.count;
    ehp += weight;
    work += weight / counterMult(cls, unit.cls);
  }
  return work > 0 ? ehp / work : 1;
}

function fireAgainst(units: readonly PowerUnit[], line: readonly PowerUnit[]): number {
  // One multiplier per shooter class: the engine hands in one unit per ship.
  const multipliers = new Map<HullClass, number>();
  let dps = 0;
  for (const unit of units) {
    if (unit.attack <= 0 || unit.count <= 0) continue;
    let multiplier = multipliers.get(unit.cls);
    if (multiplier === undefined) multipliers.set(unit.cls, multiplier = multiplierAgainst(unit.cls, line));
    dps += unit.attack * unit.count * multiplier;
  }
  return dps;
}

const lineEhp = (units: readonly PowerUnit[]): number =>
  units.reduce((sum, unit) => sum + (unit.cls === 'SUPPORT' ? 0 : unit.ehp * unit.count), 0);

/** The Nullifier opening's Aegis-only bonus per round, read the way the engine reads it. */
function nullifierBonus(units: readonly PowerUnit[], line: readonly PowerUnit[]): number {
  let weight = 0, counter = 0;
  for (const unit of line) {
    weight += unit.maxHp * unit.count;
    counter += unit.maxHp * unit.count * counterMult(HULLS.NULLIFIER.cls, unit.cls);
  }
  if (weight === 0) return 0;
  return units.reduce((sum, unit) => sum + (unit.hull === 'NULLIFIER' ? unit.attack * unit.count : 0), 0)
    * (counter / weight) * SHIELD_BREAKER.bonusShieldDamageMult;
}

let unit: number | undefined;
/** K: one bare Dart against a Dart is worth its price. */
const powerUnit = (): number => {
  if (unit === undefined) {
    const [dart] = powerUnits({ DART: 1 }, { tech: {} });
    unit = fleetValue({ DART: 1 }) / Math.sqrt(dart!.attack * dart!.ehp);
  }
  return unit;
};

export function matchup(attacker: MatchupSide, defender: MatchupSide): Matchup {
  const attackerLine = lineOf(attacker.units), defenderLine = lineOf(defender.units);
  const attackerFire = fireAgainst(attacker.units, defenderLine), defenderFire = fireAgainst(defender.units, attackerLine);
  const aegis = Math.max(0, defender.aegis ?? 0);
  const bonus = aegis > 0 ? nullifierBonus(attacker.units, defenderLine) : 0;
  const aegisEhp = attackerFire + bonus > 0 ? aegis * attackerFire / (attackerFire + bonus) : aegis;
  const sideOf = (dps: number, ehp: number): SidePower => ({ dps, ehp, power: powerUnit() * Math.sqrt(dps * ehp) });
  return {
    attacker: sideOf(attackerFire, lineEhp(attacker.units)),
    defender: sideOf(defenderFire, lineEhp(defender.units) + aegisEhp),
  };
}

/** Stronger over weaker, ≥ 1: 1 when neither can fight, Infinity against a side that cannot. */
export function matchupRatio(m: Matchup): number {
  const high = Math.max(m.attacker.power, m.defender.power), low = Math.min(m.attacker.power, m.defender.power);
  return high === 0 ? 1 : low === 0 ? Infinity : high / low;
}
