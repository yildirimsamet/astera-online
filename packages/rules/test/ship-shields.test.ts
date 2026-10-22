import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  HULLS, RESEARCH_PROJECTS, applyHpDose, fleetCount, hullTech, resolveBattle, resolveCombat,
  resolveJointCombat, shipShieldHp, shipShieldMult, shipShieldHit, type JointAttackerStack,
} from '../src/index.js';
const mean = () => 0.5;
const side = { tech: {} };

describe('personal ship shields', () => {
  it('starts at 25% of researched hull and retains four cumulative research rungs', () => {
    expect([0, 1, 2, 3, 4, 99].map(SHIP_SHIELDS => shipShieldMult({ SHIP_SHIELDS }))).toEqual([1, 1.25, 1.5, 1.7, 2, 2]);
    expect(shipShieldHp({ SHIP_ARMOR: 3, SHIP_SHIELDS: 2 }, 'DART')).toBe(HULLS.DART.hp * hullTech({ SHIP_ARMOR: 3 }, 'DART').hp * .25 * 1.5);
    expect(shipShieldHp({ SHIP_SHIELDS: 4 }, 'BASTION')).toBe(0);
    expect(shipShieldHp({}, 'ARGOSY')).toBe(HULLS.ARGOSY.hp * .25);
    expect(RESEARCH_PROJECTS.SHIP_SHIELDS.maxLevel).toBe(4);
    expect(RESEARCH_PROJECTS.SHIP_SHIELDS.prerequisite).toBe('STARSHIP_ENGINEERING');
    const prices = [1, 2, 3, 4].map(n => RESEARCH_PROJECTS.SHIP_SHIELDS.costAt(n));
    expect(prices[0]).toEqual(RESEARCH_PROJECTS.SHIP_ARMOR.costAt(1));
    expect(prices[3]!.alloy / prices[0]!.alloy).toBeCloseTo(1.8 ** 3, 1);
  });

  it('never regenerates between rounds in solo, joint, supported planet or monument combat', () => {
    const attack: JointAttackerStack[] = [{ contributionId: 'a', playerId: 'a', fleet: { CORSAIR: 1 }, tech: side }];
    const d = [{ stackId: 'd', playerId: 'd', fleet: { CORSAIR: 1 }, tech: side }];
    for (const result of [resolveCombat({ CORSAIR: 1 }, { CORSAIR: 1 }, 0, mean, { attacker: side, defender: side }),
      resolveJointCombat(attack, { CORSAIR: 1 }, 0, mean, side),
      resolveBattle(attack, [...d, { stackId: 'empty', playerId: 'ally', fleet: {}, tech: side }], 0, mean),
      resolveBattle(attack, d, 0, mean, 'MONUMENT')]) {
      expect(result.rounds.map(row => row.defenderShipShieldAbsorbed)).toEqual([377, 0, 0]);
      expect(result.rounds.map(row => row.attackerShipShieldAbsorbed)).toEqual([377, 0, 0]);
      expect(result.defenderDamage[0]!.damageBp).toBeGreaterThan(5000);
    }
  });

  it('starts the next battle with a fresh shield but keeps the previous hull wounds', () => {
    const a: JointAttackerStack[] = [{ contributionId: 'a', playerId: 'a', fleet: { CORSAIR: 1 }, tech: side }];
    const first = resolveBattle(a, [{ stackId: 'd', playerId: 'd', fleet: { CORSAIR: 1 }, tech: side }], 0, mean, 'MONUMENT');
    const second = resolveBattle(a, [{ stackId: 'd', playerId: 'd', fleet: first.defenderSurvivors, damage: first.defenderDamage, tech: side }], 0, mean, 'MONUMENT');
    expect(second.rounds[0]!.defenderShipShieldAbsorbed).toBe(377);
    expect(second.rounds[0]!.attackerHullDamage).toBe(31);
  });

  it('keeps arrival wounds behind a shield without crediting shield hits as hull damage', () => {
    const slow = { tech: {}, damageMult: .1 };
    const r = resolveJointCombat([{ contributionId: 'a', playerId: 'p', fleet: { DART: 1 }, tech: slow,
      damage: [{ hull: 'DART', count: 1, damageBp: 5000 }] }], { DART: 1 }, 0, mean, slow, true);
    expect(r.attackerDamage).toMatchObject([{ hull: 'DART', count: 1, damageBp: 5000 }]);
    expect(r.contributions[0]!.hullDamage).toBe(0);
  });

  it('identical wounded waves cannot gain shields or survival by splitting their owners', () => {
    const stack = (id: string, n: number): JointAttackerStack => ({ contributionId: id, playerId: id, fleet: { DART: n },
      tech: { tech: { SHIP_SHIELDS: 3 } }, damage: [{ hull: 'DART', count: n, damageBp: 5000, remainderBp: .25 }] });
    const one = resolveJointCombat([stack('one', 40)], { PIKE: 25 }, 0, mean, side, true);
    const many = resolveJointCombat(Array.from({ length: 40 }, (_, i) => stack(String(i), 1)), { PIKE: 25 }, 0, mean, side, true);
    expect(many.attackerSurvivors).toEqual(one.attackerSurvivors);
    expect(many.attackerRetreated).toEqual(one.attackerRetreated);
    expect(many.attackerDamage).toEqual(one.attackerDamage);
    expect(many.rounds.map(({ retreats: _retreats, casualties: _casualties, ...round }) => round)).toEqual(one.rounds.map(({ retreats: _retreats, casualties: _casualties, ...round }) => round));
  });

  it('uses each defender’s own shield research and credits only real remaining hull on overkill', () => {
    const hp = HULLS.ARGOSY.hp;
    const r = resolveBattle([
      { contributionId: 'a', playerId: 'a', fleet: { DART: 1000 }, tech: side },
      { contributionId: 'b', playerId: 'b', fleet: { DART: 1000 }, tech: side },
    ], [
      { stackId: 'plain', playerId: 'd1', fleet: { ARGOSY: 2 }, tech: side, damage: [{ hull: 'ARGOSY', count: 1, damageBp: 5000 }] },
      { stackId: 'shielded', playerId: 'd2', fleet: { ARGOSY: 2 }, tech: { tech: { SHIP_SHIELDS: 4 } }, damage: [{ hull: 'ARGOSY', count: 2, damageBp: 7500 }] },
    ], 0, mean, 'MONUMENT');
    expect(r.rounds).toHaveLength(1);
    expect(fleetCount(r.defenderSurvivors)).toBe(0);
    expect(r.rounds[0]!.defenderShipShieldAbsorbed).toBe(hp * 1.5);
    expect(r.contributions.reduce((sum, row) => sum + row.hullDamage, 0)).toBeCloseTo(hp * 2, 7);
  });

  it('never borrows unhit shields and distinguishes initial hull wounds from shield charge', () => {
    expect(shipShieldHit(10, 100, 0, 150, 20)).toMatchObject({ count: 9, wound: 10, absorbed: 40, hullDamage: 110 });
    expect(shipShieldHit(10, 100, 40, 60, 20)).toMatchObject({ count: 10, wound: 80, absorbed: 20, hullDamage: 40 });
    expect(shipShieldHit(10, 100, 80, 40, 20)).toMatchObject({ count: 9, wound: 0, absorbed: 20, hullDamage: 20 });
    expect(shipShieldHit(10, 100, 40, 0, 20)).toMatchObject({ count: 10, wound: 40, absorbed: 0, hullDamage: 0 });
    expect(shipShieldHit(2, 100, 0, 1000, 20)).toMatchObject({ count: 0, wound: 0, absorbed: 40, hullDamage: 200, left: 760 });
    expect(shipShieldHit(0, 100, 0, 1000, 20)).toMatchObject({ count: 0, absorbed: 0, hullDamage: 0, left: 1000 });
  });

  it('carries only the front survivor’s unspent shield, including a hit that reaches no hull', () => {
    const first = shipShieldHit(2, 100, 0, 60, 100);
    expect(first).toMatchObject({ count: 2, wound: 0, shieldLeft: 40, absorbed: 60 });
    const second = shipShieldHit(first.count, 100, first.wound, 70, 100, first.shieldLeft);
    expect(second).toMatchObject({ count: 2, wound: 30, shieldLeft: 0, absorbed: 40, hullDamage: 30 });
    expect(shipShieldHit(second.count, 100, second.wound, 90, 100, second.shieldLeft))
      .toMatchObject({ count: 1, wound: 0, shieldLeft: 80, absorbed: 20, hullDamage: 70 });
  });

  it('rejects malformed hit inputs instead of creating ships or invalid wounds', () => {
    const invalid: [number, number, number, number, number, number?][] = [
      [-1, 100, 0, 20, 100], [1.5, 100, 0, 20, 100], [1, 0, 0, 20, 100],
      [1, 100, 100, 20, 100], [1, 100, -1, 20, 100], [1, 100, 0, -1, 100],
      [1, 100, 0, 20, -1], [1, 100, 0, NaN, 100], [1, Infinity, 0, 20, 100],
      [1, 100, 0, 20, 100, -1], [1, 100, 0, 20, 100, 101], [1, 100, 0, 20, 100, NaN],
    ];
    for (const args of invalid) {
      expect(() => shipShieldHit(...args)).toThrow(RangeError);
    }
  });

  it('conserves hit energy and surviving hull across large fleets and wounded first ships', () => {
    fc.assert(fc.property(
      fc.integer({ min: 1, max: 1_000_000 }), fc.integer({ min: 1, max: 100_000 }),
      fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 0, max: 10_000_000 }),
      fc.integer({ min: 0, max: 2 }),
      (count, hp, bp, damage, factor) => {
        const wound = hp * bp / 10000;
        const hit = shipShieldHit(count, hp, wound, damage, hp * factor);
        expect(hit.absorbed + hit.hullDamage + hit.left).toBeCloseTo(damage, 5);
        expect(count * hp - wound - hit.hullDamage).toBeCloseTo(hit.count * hp - hit.wound, 4);
        expect(hit.count).toBeGreaterThanOrEqual(0);
        expect(hit.count).toBeLessThanOrEqual(count);
        expect(hit.wound).toBeGreaterThanOrEqual(0);
        expect(hit.wound).toBeLessThan(hp);
        expect(hit.absorbed).toBeGreaterThanOrEqual(0);
      },
    ), { seed: 20261020, numRuns: 500 });
  });

  it('spends Aegis before personal shields and never spills Nullifier bonus into either hull or personal shields', () => {
    const args = { attacker: { tech: {} }, defender: { tech: { SHIP_SHIELDS: 4 } } };
    const covered = resolveCombat({ NULLIFIER: 1 }, { CITADEL: 10 }, 1e9, mean, args);
    expect(covered.rounds[0]!.shieldBreakerDamage).toBeGreaterThan(0);
    expect(covered.rounds.every(r => r.defenderShipShieldAbsorbed === 0 && r.attackerHullDamage === 0)).toBe(true);
    const bare = resolveCombat({ NULLIFIER: 1 }, { CITADEL: 10 }, 0, mean, args);
    expect(bare.rounds[0]!.shieldBreakerDamage).toBe(0);
    expect(bare.rounds[0]!.defenderShipShieldAbsorbed).toBe(bare.rounds[0]!.attackerDamage);
    expect(bare.defenderDamage).toEqual([]);
  });

  it('radiation bypasses even fully researched shields and can destroy a fully shielded ship', () => {
    const hp = HULLS.DART.hp;
    expect(applyHpDose({ DART: 2 }, [], hp / 2, { SHIP_SHIELDS: 4 }))
      .toEqual(applyHpDose({ DART: 2 }, [], hp / 2, {}));
    expect(applyHpDose({ DART: 2 }, [], hp, { SHIP_SHIELDS: 4 }).destroyed).toEqual({ DART: 2 });
  });

  it('treats consecutive hits as one budget without refilling shields or healing wounds', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 50 }), fc.integer({ min: 1, max: 1000 }),
      fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 0, max: 10000 }), fc.integer({ min: 0, max: 10000 }),
      (count, hp, bp, a, b) => {
        const wound = hp * bp / 10000;
        const first = shipShieldHit(count, hp, wound, a, hp);
        const next = shipShieldHit(first.count, hp, first.wound, b, hp, first.shieldLeft);
        const combined = shipShieldHit(count, hp, wound, a + b, hp);
        expect(next.count).toBe(combined.count);
        expect(next.wound).toBeCloseTo(combined.wound, 7);
        expect(next.shieldLeft).toBeCloseTo(combined.shieldLeft, 7);
        expect(first.absorbed + next.absorbed).toBeCloseTo(combined.absorbed, 7);
        expect(first.hullDamage + next.hullDamage).toBeCloseTo(combined.hullDamage, 7);
      }), { seed: 20261021, numRuns: 500 });
  });

});
