import { describe, expect, it } from 'vitest';
import {
  COMBAT,
  HULLS,
  SHIELD_BREAKER,
  fleetValue,
  hullTech,
  matchup,
  matchupRatio,
  powerUnits,
  shipShieldHp,
  type Fleet,
  type HullId,
  type TechLevels,
} from '../src/index.js';

/**
 * GÖRECELİ SAVAŞ GÜCÜ — combat v3, owner 2026-10-25 (docs/combat-v3-plan-2026-10-25.md §4).
 *
 * A side's power is measured against the side it meets: P = K·√(DPS × EHP). DPS is the
 * side's base fire per round times the counter multiplier it earns on the enemy line
 * (EHP-weighted harmonic mean, the rate that grinds the whole line down); EHP is its own
 * hull plus personal shield, plus Aegis on the defence. K makes one bare Dart worth its price.
 */
const atk = (hull: HullId, tech: TechLevels = {}) => HULLS[hull].atk * hullTech(tech, hull).atk;
const ehp = (hull: HullId, tech: TechLevels = {}) => HULLS[hull].hp * hullTech(tech, hull).hp + shipShieldHp(tech, hull);
const K = fleetValue({ DART: 1 }) / Math.sqrt(atk('DART') * ehp('DART'));
const side = (fleet: Fleet, tech: TechLevels = {}, aegis?: number) =>
  ({ units: powerUnits(fleet, { tech }), ...(aegis === undefined ? {} : { aegis }) });
const powers = (a: Fleet, d: Fleet, ta: TechLevels = {}, td: TechLevels = {}, aegis?: number) =>
  matchup(side(a, ta), side(d, td, aegis));

describe('matchup power: the unit', () => {
  it('prices one bare Dart against a Dart at exactly its resource cost', () => {
    const m = powers({ DART: 1 }, { DART: 1 });
    expect(m.attacker.power).toBeCloseTo(fleetValue({ DART: 1 }), 6);
    expect(m.defender.power).toBeCloseTo(fleetValue({ DART: 1 }), 6);
  });

  it('grows linearly with ship count when both sides grow together', () => {
    const small = powers({ PIKE: 3 }, { DART: 3 }), big = powers({ PIKE: 300 }, { DART: 300 });
    expect(big.attacker.power / small.attacker.power).toBeCloseTo(100, 6);
    expect(matchupRatio(big)).toBeCloseTo(matchupRatio(small), 9);
  });

  it('does not depend on how many ships carry the same strength (300 Darts vs 2 Corsairs)', () => {
    const m = powers({ DART: 300 }, { CORSAIR: 2 });
    // Skirmisher against Skirmisher: neutral, so only stats and counts speak.
    expect(m.attacker.power).toBeCloseTo(K * Math.sqrt(300 * atk('DART') * 300 * ehp('DART')), 6);
    expect(m.defender.power).toBeCloseTo(K * Math.sqrt(2 * atk('CORSAIR') * 2 * ehp('CORSAIR')), 6);
  });
});

describe('matchup power: counters', () => {
  it('turns an even pure fight into 1.6 for the side holding the counter', () => {
    // Lance ▸ Skirmisher: Pike hits Dart for 1.6, Dart hits Pike for 0.625.
    const m = powers({ PIKE: 10 }, { DART: 10 });
    expect(m.attacker.power).toBeCloseTo(K * Math.sqrt(10 * atk('PIKE') * COMBAT.strongMult * 10 * ehp('PIKE')), 6);
    expect(m.defender.power).toBeCloseTo(K * Math.sqrt(10 * atk('DART') * COMBAT.weakMult * 10 * ehp('DART')), 6);
    const neutral = Math.sqrt(atk('PIKE') * ehp('PIKE') / (atk('DART') * ehp('DART')));
    expect(m.attacker.power / m.defender.power).toBeCloseTo(neutral * COMBAT.strongMult, 9);
  });

  it('reads a mixed line by the EHP-weighted harmonic mean of the multipliers', () => {
    // Pike: 1.6 on Darts (Skirmisher), 0.625 on Ramparts (Bulwark ▸ Lance).
    const m = powers({ PIKE: 4 }, { DART: 6, RAMPART: 3 });
    const eD = 6 * ehp('DART'), eR = 3 * ehp('RAMPART');
    const mult = (eD + eR) / (eD / COMBAT.strongMult + eR / COMBAT.weakMult);
    expect(m.attacker.dps).toBeCloseTo(4 * atk('PIKE') * mult, 9);
  });

  it('hits a cargo-only line at the support multiplier, and cargo adds no power to its owner', () => {
    const m = powers({ DART: 5 }, { COURIER: 4 });
    expect(m.attacker.dps).toBeCloseTo(5 * atk('DART') * COMBAT.strongMult, 9);
    expect(m.defender.power).toBe(0);
    expect(m.defender.ehp).toBe(0);
  });

  it('ignores escorted cargo when reading the line it fires at', () => {
    const bare = powers({ DART: 5 }, { PIKE: 5 }), escorted = powers({ DART: 5 }, { PIKE: 5, ATLAS: 9 });
    expect(escorted.attacker.power).toBeCloseTo(bare.attacker.power, 9);
    expect(escorted.defender.power).toBeCloseTo(bare.defender.power, 9);
  });

  it('meets an empty line at the neutral multiplier, never NaN', () => {
    const m = powers({ DART: 2 }, {});
    expect(m.attacker.power).toBeCloseTo(2 * fleetValue({ DART: 1 }), 6);
    expect(m.defender.power).toBe(0);
    expect(matchupRatio(m)).toBe(Infinity);
    expect(matchupRatio(powers({}, {}))).toBe(1);
  });
});

describe('matchup power: research, ground, Aegis, handicaps and wounds', () => {
  it('reads research through the same ladders the battle fires with', () => {
    const top: TechLevels = { SHIP_POWER: 5, SHIP_ARMOR: 5, SHIP_SHIELDS: 4 };
    const m = powers({ CORSAIR: 10 }, { CORSAIR: 10 }, top, {});
    expect(m.attacker.power / m.defender.power).toBeCloseTo(
      Math.sqrt(atk('CORSAIR', top) * ehp('CORSAIR', top) / (atk('CORSAIR') * ehp('CORSAIR'))), 9);
    expect(m.attacker.power / m.defender.power).toBeGreaterThan(1.3);
  });

  it('counts ground guns with their doctrine and no personal shield', () => {
    const doctrine: TechLevels = { EMPLACEMENT_DOCTRINE: 3 };
    const m = powers({ DART: 10 }, { BASTION: 2 }, {}, doctrine);
    expect(m.defender.ehp).toBeCloseTo(2 * HULLS.BASTION.hp * hullTech(doctrine, 'BASTION').hp, 9);
    expect(m.defender.dps).toBeCloseTo(2 * atk('BASTION', doctrine) * COMBAT.weakMult, 9);
  });

  it('adds the Aegis charge to the defending line as neutral hit points', () => {
    const bare = powers({ DART: 10 }, { PIKE: 4 }), shielded = powers({ DART: 10 }, { PIKE: 4 }, {}, {}, 3000);
    expect(shielded.defender.ehp - bare.defender.ehp).toBeCloseTo(3000, 9);
    expect(shielded.defender.power).toBeGreaterThan(bare.defender.power);
    expect(shielded.attacker.power).toBeCloseTo(bare.attacker.power, 9);
  });

  it('discounts Aegis by the share of the wing’s fire that is Nullifier bonus', () => {
    const m = powers({ NULLIFIER: 2, DART: 6 }, { PIKE: 4 }, {}, {}, 5000);
    // The Nullifier is a Lance firing at a Lance line: its bonus runs at the neutral multiplier.
    const bonus = 2 * atk('NULLIFIER') * SHIELD_BREAKER.bonusShieldDamageMult;
    const fire = m.attacker.dps;
    expect(m.defender.ehp).toBeCloseTo(4 * ehp('PIKE') + 5000 * fire / (fire + bonus), 6);
  });

  it('lets a flat damage handicap (the pirate) cut fire, never hit points', () => {
    const full = matchup(side({ CORSAIR: 4 }), side({ DART: 30 }));
    const weak = matchup({ units: powerUnits({ CORSAIR: 4 }, { tech: {}, damageMult: 0.5 }) }, side({ DART: 30 }));
    expect(weak.attacker.dps).toBeCloseTo(full.attacker.dps * 0.5, 9);
    expect(weak.attacker.ehp).toBeCloseTo(full.attacker.ehp, 9);
  });

  it('reads wounded ships at their remaining hull and grounded ones as targets that do not fire', () => {
    const fleet: Fleet = { CORSAIR: 4 };
    const wounded = powerUnits(fleet, { tech: {} }, [{ hull: 'CORSAIR', count: 2, damageBp: 5000 }]);
    const total = wounded.reduce((sum, unit) => sum + unit.ehp * unit.count, 0);
    expect(total).toBeCloseTo(4 * ehp('CORSAIR') - 2 * 0.5 * HULLS.CORSAIR.hp * hullTech({}, 'CORSAIR').hp, 6);
    const grounded = powerUnits(fleet, { tech: {} }, [{ hull: 'CORSAIR', count: 1, damageBp: 9600 }], true);
    expect(grounded.filter(unit => unit.attack === 0).reduce((sum, unit) => sum + unit.count, 0)).toBe(1);
  });
});
