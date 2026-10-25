import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  COMBAT, HULLS, counterMult, battleRetreatPolicy, fleetCount, mulberry32, resolveBattle,
  resolveCombat, resolveMonumentCombat, resolveRaid, seededFrom,
  type Fleet, type HullId, type JointAttackerStack,
} from '../src/index.js';
import { resolveRandomBattle, resolveVolley, type VolleyShip } from '../src/randomBattle.js';
import { distributedCombatReference } from './fixtures/distributed-combat-reference.js';

const ship = (hull: HullId, hp = 1000, attack = 0, shield = 0): VolleyShip =>
  ({ hull, hp, attack, shield, owner: 0, canFire: true, retreated: false });
const attack = (fleet: Fleet): JointAttackerStack[] =>
  [{ contributionId: 'a', playerId: 'a', fleet, tech: { tech: {} } }];
const defence = (fleet: Fleet) => [{ stackId: 'd', playerId: 'd', fleet, tech: { tech: {} } }];
const mean = () => .5;

describe('six-round distributed combat: approved production contract', () => {
  it.each(distributedCombatReference)('$name exactly matches the frozen, independently captured calibration model', spec => {
    const rng = typeof spec.seed === 'string' ? seededFrom(spec.seed) : mulberry32(spec.seed);
    const result = resolveRandomBattle(spec.attackers, spec.defenders, spec.shield, rng, spec.precise, spec.maintenance);
    expect(result.rounds.every(round => round.distributedFire === true)).toBe(true);
    // The simulator predates the additive report marker; all numeric/ownership fields stay identical.
    expect({ ...result, rounds: result.rounds.map(({ distributedFire: _model, ...round }) => round) }).toEqual(spec.expected);
  });

  it('uses six rounds and the rounded percentage windows, excluding support power', () => {
    expect(COMBAT.rounds).toBe(6);
    const fresh = resolveCombat({ CITADEL: 1 }, { CITADEL: 1 }, 0, mean, { attacker: { tech: {} }, defender: { tech: {} } });
    expect(fresh.rounds[0]).toHaveProperty('distributedFire', true);
    for (const [n, weakChance, weakHp, strongChance, strongHp] of [
      [100, .10, .30, .10, .30], [149, .10, .30, .10, .30],
      [150, .20, .46, .10, .30], [199, .20, .46, .10, .30],
      [200, .28, .66, .10, .30], [299, .28, .66, .10, .30],
      [300, .40, .80, .06, .26], [400, .40, .80, .06, .26],
    ] as const) {
      const a = { CORSAIR: n, COURIER: 10000 }, d = { CORSAIR: 100, GARBAGE_COLLECTOR: 10000 };
      const weak = { chance: weakChance, threshold: weakHp }, strong = { chance: strongChance, threshold: strongHp };
      expect(battleRetreatPolicy(a, d)).toEqual({ attacker: strong, defender: weak });
      expect(battleRetreatPolicy(d, a)).toEqual({ attacker: weak, defender: strong });
    }
  });

  it('splits ONE shot among every eligible ship without mutating the live round snapshot', () => {
    const from = [ship('CORSAIR', 1000, 408)], to = Array.from({ length: 10 }, () => ship('DART'));
    const before = structuredClone({ from, to });
    const r = resolveVolley(from, to, 1, mulberry32(19), 0, 1);
    expect(r.hp.filter(hp => hp < 1000)).toHaveLength(10);
    expect(r.hp.reduce((sum, hp) => sum + 1000 - hp, 0)).toBeCloseTo(408, 8);
    expect(new Set(r.hp).size).toBeGreaterThan(1);
    expect({ from, to }).toEqual(before);
  });

  it('redistributes same-shot overkill to other warships before cargo', () => {
    const r = resolveVolley([ship('CORSAIR', 1000, 100)],
      [ship('DART', 10), ship('DART', 1000), ship('COURIER', 100)], 1, () => 0, 0, 1);
    expect(r.hp).toEqual([0, 910, 100]);
    expect(r.credited).toEqual([100]);
  });

  it('protects cargo AND collectors, then moves surplus to both within the same shot', () => {
    const from = [ship('CORSAIR', 1000, 20)];
    const protectedHit = resolveVolley(from,
      [ship('DART', 1000), ship('COURIER', 100), ship('GARBAGE_COLLECTOR', 100)], 1, () => 0, 0, 1);
    expect(protectedHit.hp).toEqual([980, 100, 100]);
    const overflow = resolveVolley(from,
      [ship('DART', 5, 0, 3), ship('COURIER', 100), ship('GARBAGE_COLLECTOR', 100)], 1, () => 0, 0, 1);
    expect(overflow.hp[0]).toBe(0);
    // Twelve base damage left, divided between two SUPPORT targets at the existing 1.6 counter.
    expect(overflow.hp[1]).toBeCloseTo(90.4, 10);
    expect(overflow.hp[2]).toBeCloseTo(90.4, 10);
  });

  it('converts surplus back to base damage before applying a different target counter', () => {
    const r = resolveVolley([ship('CATACLYSM', 1000, 100)],
      [ship('DART', 30), ship('CITADEL', 1000)], 1, () => 0, 0, 1);
    expect(r.hp[0]).toBe(0);
    expect(r.hp[1]).toBeCloseTo(949.21875, 10);
    expect(r.hullDamage).toBeCloseTo(80.78125, 10);
  });

  it('keeps Nullifier bonus shield-only and credits actual hull damage once', () => {
    const r = resolveVolley([ship('NULLIFIER', 1000, 100)], [ship('DART', 1000)], 1, () => 0, 500, 1);
    expect(r.specialistAbsorbed).toBe(500);
    expect(r.aegis).toBe(0);
    expect(r.hp).toEqual([840]);
    expect(r.credited).toEqual([160]);
  });

  it('executes all SIX rounds without healing and never retreats after the last round', () => {
    const side = { tech: { SHIP_SHIELDS: 4 } };
    const r = resolveBattle(attack({ CITADEL: 1 }).map(row => ({ ...row, tech: side })),
      defence({ CITADEL: 1 }).map(row => ({ ...row, tech: side })), 0, mean, 'HP_PLANET');
    expect(r.rounds.map(round => round.round)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.rounds.map(round => round.attackerShipShieldAbsorbed)).toEqual([445, 445, 189, 0, 0, 0]);
    expect(r.rounds[5]!.retreats).toEqual([]);
    for (const damage of [r.attackerDamage[0]!, r.defenderDamage[0]!]) {
      const hp = HULLS.CITADEL.hp * (1 - (damage.damageBp + (damage.remainderBp ?? 0)) / 10000);
      expect(hp).toBeCloseTo(567, 8);
      expect(hp / HULLS.CITADEL.hp).toBeLessThan(.30);
    }
    expect(r.attackerRetreated).toEqual({}); expect(r.defenderRetreated).toEqual({});
  });

  it('allows fifth-round escape, preserving living ships and their owner/wounds', () => {
    let fifthRoundEscapes = 0;
    for (let seed = 0; seed < 64; seed++) {
      const r = resolveBattle(attack({ CITADEL: 1 }), defence({ CITADEL: 1 }), 0, mulberry32(seed), 'HP_PLANET');
      for (const round of r.rounds) {
        if (round.round === 5) fifthRoundEscapes += (round.retreats ?? []).reduce((sum, row) => sum + fleetCount(row.fleet), 0);
        if (round.round === 6) expect(round.retreats).toEqual([]);
      }
      expect(fleetCount(r.attackerSurvivors) + fleetCount(r.attackerLosses)).toBe(1);
      expect(fleetCount(r.defenderSurvivors) + fleetCount(r.defenderLosses)).toBe(1);
    }
    expect(fifthRoundEscapes).toBeGreaterThan(0);
  });

  it('fires simultaneously even when both sides are killed by their first volley', () => {
    const a = attack({ DART: 1 }).map(row => ({ ...row, tech: { tech: {}, damageMult: 100 } }));
    const d = defence({ DART: 1 }).map(row => ({ ...row, tech: { tech: {}, damageMult: 100 } }));
    const r = resolveBattle(a, d, 0, mean);
    expect(r.attackerLosses).toEqual({ DART: 1 }); expect(r.defenderLosses).toEqual({ DART: 1 });
    expect(r.rounds).toHaveLength(1); expect(r.rounds[0]!.retreats).toEqual([]);
  });

  it('settles the reported heavy-wing-versus-many-Darts battle as a decisive raid', () => {
    const fleet = { ATLAS: 1, CITADEL: 3, CORSAIR: 5, PALADIN: 5, CATACLYSM: 11 };
    const tech = { SHIP_POWER: 5, SHIP_ARMOR: 5, SHIP_SHIELDS: 4 };
    const r = resolveRaid({ stacks: attack(fleet).map(row => ({ ...row, tech: { tech } })),
      line: { DART: 235, THORN: 15, COURIER: 2 }, shield: 150,
      rng: () => seededFrom('9865571b-fda2-4af5-86e7-a051712410d2'),
      defender: { tech: { SHIP_POWER: 2 } }, deuterium: 0, escape: true,
      minimumCombatShips: 5, maintenance: true, preciseDamage: true });
    expect(r.escape).toBeNull(); expect(r.result.grade).toBe('DECISIVE');
    expect(r.result.attackerSurvivors).toEqual(fleet);
    const active = fleetCount(r.result.defenderSurvivors) - fleetCount(r.result.defenderRetreated ?? {});
    expect(active).toBe(0);
  });

  it('keeps cargo-only monument control and allows a surviving warship to evict support', () => {
    const held = resolveMonumentCombat(attack({ COURIER: 2 }), defence({ GARBAGE_COLLECTOR: 1 }), mean);
    expect(held.control).toBe('DEFENDER'); expect(held.rounds).toEqual([]);
    const won = resolveMonumentCombat(attack({ CORSAIR: 3 }), defence({ CORSAIR: 1, GARBAGE_COLLECTOR: 1 }), mean);
    expect(won.control).toBe('ATTACKER');
  });
});


it('conserves base-shot energy through mixed counters, shields, cargo and repeated overkill', () => {
  fc.assert(fc.property(fc.constantFrom('DART' as const, 'CITADEL' as const, 'CATACLYSM' as const),
    fc.array(fc.record({ hull: fc.constantFrom('DART' as const, 'CITADEL' as const, 'CATACLYSM' as const, 'COURIER' as const, 'GARBAGE_COLLECTOR' as const),
      hp: fc.integer({ min: 1, max: 1000 }), shield: fc.integer({ min: 0, max: 500 }), retreated: fc.boolean() }), { minLength: 1, maxLength: 25 }),
    fc.integer({ min: 1, max: 10000 }), fc.nat(), (hull, targets, power, seed) => {
      const to = targets.map(target => ({ ...ship(target.hull, target.hp, 0, target.shield), retreated: target.retreated }));
      const from = [ship(hull, 1000, power / 4), { ...ship(hull, 1000, power * 3 / 4), owner: 1 }];
      const r = resolveVolley(from, to, 1, mulberry32(seed), 0, 2);
      let capacity = 0, consumed = 0, actualHull = 0;
      for (let i = 0; i < to.length; i++) {
        const before = to[i]!;
        if (before.retreated) {
          expect(r.hp[i]).toBe(before.hp);
          expect(r.shields[i]).toBe(before.shield);
          continue;
        }
        const multiplier = counterMult(HULLS[hull].cls, HULLS[before.hull].cls);
        capacity += (before.hp + before.shield) / multiplier;
        consumed += (before.hp - r.hp[i]! + before.shield - r.shields[i]!) / multiplier;
        actualHull += before.hp - r.hp[i]!;
        expect(r.hp[i]).toBeGreaterThanOrEqual(0);
        expect(r.shields[i]).toBeGreaterThanOrEqual(0);
      }
      expect(consumed).toBeCloseTo(Math.min(capacity, power), 7);
      expect(r.credited.reduce((sum, value) => sum + value, 0)).toBeCloseTo(actualHull, 7);
      expect(r.hullDamage).toBeCloseTo(actualHull, 7);
    }), { seed: 20261023, numRuns: 150 });
});
