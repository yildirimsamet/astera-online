import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  HULLS, RESEARCH_PROJECTS, applyHpDose, fleetCount, hullTech,
  resolveBattle, resolveCombat, resolveJointCombat, shipShieldHp, shipShieldMult, shipShieldHit,
  type JointAttackerStack,
} from '../src/index.js';

const mean = () => 0.5;
const side = { tech: {} };

describe('personal ship shields', () => {
  it('starts at researched maximum hull and has exactly four cumulative research rungs', () => {
    expect([0, 1, 2, 3, 4, 99].map(SHIP_SHIELDS => shipShieldMult({ SHIP_SHIELDS })))
      .toEqual([1, 1.25, 1.5, 1.7, 2, 2]);
    expect(shipShieldHp({ SHIP_ARMOR: 3, SHIP_SHIELDS: 2 }, 'DART'))
      .toBe(HULLS.DART.hp * hullTech({ SHIP_ARMOR: 3 }, 'DART').hp * 1.5);
    expect(shipShieldHp({ SHIP_SHIELDS: 4 }, 'BASTION')).toBe(0);
    expect(shipShieldHp({}, 'ARGOSY')).toBe(HULLS.ARGOSY.hp);
    expect(RESEARCH_PROJECTS.SHIP_SHIELDS.maxLevel).toBe(4);
    expect(RESEARCH_PROJECTS.SHIP_SHIELDS.prerequisite).toBe('STARSHIP_ENGINEERING');
    const prices = [1, 2, 3, 4].map(n => RESEARCH_PROJECTS.SHIP_SHIELDS.costAt(n));
    expect(prices[0]).toEqual(RESEARCH_PROJECTS.SHIP_ARMOR.costAt(1));
    expect(prices[3]!.alloy / prices[0]!.alloy).toBeCloseTo(1.8 ** 3, 1);
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

  it('never regenerates between rounds in solo, joint, supported planet or monument combat', () => {
    const attack: JointAttackerStack[] = [{ contributionId: 'a', playerId: 'a', fleet: { CORSAIR: 3 }, tech: side }];
    const defence = [{ stackId: 'd', playerId: 'd', fleet: { CORSAIR: 1 }, tech: side }];
    const battles = [
      resolveCombat({ CORSAIR: 3 }, { CORSAIR: 1 }, 0, mean, { attacker: side, defender: side }),
      resolveJointCombat(attack, { CORSAIR: 1 }, 0, mean, side),
      ...(['PLANET', 'HP_PLANET', 'MONUMENT'] as const).map(context => resolveBattle(attack, defence, 0, mean, context, true)),
      resolveBattle(attack, [...defence, { stackId: 'cargo', playerId: 'ally', fleet: { ARGOSY: 1 }, tech: side }], 0, mean, 'HP_PLANET', true),
    ];
    for (const battle of battles) {
      expect(battle.rounds).toHaveLength(3);
      expect(battle.defenderSurvivors.CORSAIR ?? 0).toBe(0);
      expect(battle.rounds.map(round => round.defenderShipShieldAbsorbed)).toEqual([1224, 284, 0]);
      expect(battle.attackerDamage).toEqual([]);
    }
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

  it('absorbs small fire with the initial charge and carries only hull damage into repairs', () => {
    const result = resolveCombat({ DART: 1 }, { DART: 1 }, 0, mean, { attacker: side, defender: side });
    expect(result.rounds).toHaveLength(3);
    expect(result.attackerSurvivors.DART).toBe(1);
    expect(result.attackerDamage).toEqual([]);
    expect(result.defenderDamage).toEqual([]);
    expect(result.rounds.every(r => r.attackerShipShieldAbsorbed === HULLS.DART.atk
      && r.defenderShipShieldAbsorbed === HULLS.DART.atk)).toBe(true);
  });

  it('starts a new battle with full shields while preserving carried hull wounds', () => {
    const first = resolveBattle([{ contributionId: 'a', playerId: 'a', fleet: { CORSAIR: 2 }, tech: side }],
      [{ stackId: 'd', playerId: 'd', fleet: { CORSAIR: 1 }, tech: side }], 0, mean, 'MONUMENT');
    expect(first.defenderDamage.length).toBeGreaterThan(0);
    const second = resolveBattle([{ contributionId: 'a', playerId: 'a', fleet: { CORSAIR: 2 }, tech: side }],
      [{ stackId: 'd', playerId: 'd', fleet: first.defenderSurvivors, tech: side, damage: first.defenderDamage }], 0, mean, 'MONUMENT');
    expect(second.rounds[0]!.defenderShipShieldAbsorbed).toBe(2 * HULLS.CORSAIR.atk);
    expect(second.rounds[0]!.attackerHullDamage).toBe(0);
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

  it('keeps radiation wounds behind a fresh full shield and credits no shield damage as hull damage', () => {
    const result = resolveJointCombat([{ contributionId: 'a', playerId: 'p', fleet: { DART: 1 }, tech: side,
      damage: [{ hull: 'DART', count: 1, damageBp: 5000 }] }], { DART: 1 }, 0, mean, side, true);
    expect(result.attackerDamage).toMatchObject([{ hull: 'DART', count: 1, damageBp: 5000 }]);
    expect(result.contributions[0]!.hullDamage).toBe(0);
  });

  it('keeps targeting the spent shield on an injured ship instead of switching to fresh identical ships', () => {
    const hp = HULLS.ARGOSY.hp;
    const shot = hp * 2 / 3;
    const result = resolveBattle([{ contributionId: 'a', playerId: 'a', fleet: { DART: 1 },
      tech: { tech: {}, damageMult: shot / (HULLS.DART.atk * 1.6) } }], [
      { stackId: 'd', playerId: 'd', fleet: { ARGOSY: 2 }, tech: side,
        damage: [{ hull: 'ARGOSY', count: 2, damageBp: 5000 }] },
    ], 0, mean, 'MONUMENT');
    expect(result.defenderLosses).toEqual({ ARGOSY: 1 });
    expect(result.rounds.map(round => round.defenderShipShieldAbsorbed)).toEqual([900, 450, 675]);
    expect(result.defenderDamage).toMatchObject([{ hull: 'ARGOSY', count: 1, damageBp: 5000 }]);
    expect(result.contributions[0]!.hullDamage).toBeCloseTo(hp / 2, 7);
  });

  it('equal-technology waves cannot gain protection by splitting the fleet', () => {
    const stack = (id: string, count: number): JointAttackerStack => ({ contributionId: id, playerId: id,
      fleet: { DART: count }, tech: side });
    const one = resolveJointCombat([stack('one', 100)], { PIKE: 25 }, 0, mean, side);
    const many = resolveJointCombat(Array.from({ length: 100 }, (_, i) => stack(String(i), 1)), { PIKE: 25 }, 0, mean, side);
    expect(many.attackerSurvivors).toEqual(one.attackerSurvivors);
    expect(many.defenderSurvivors).toEqual(one.defenderSurvivors);
    expect(many.rounds).toEqual(one.rounds);
  });

  it('matches an independent per-ship model for mixed wounds and partly spent shields', () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: 0, max: 9400 }), { minLength: 1, maxLength: 8 }),
      fc.integer({ min: 1, max: 12000 }), fc.integer({ min: 0, max: 4 }),
      (wounds, shot, level) => {
        const hp = HULLS.ARGOSY.hp;
        const capacity = hp * [1, 1.25, 1.5, 1.7, 2][level]!;
        const ships = wounds.map(bp => ({ hp: hp * (10000 - bp) / 10000, shield: capacity }));
        const result = resolveBattle([{ contributionId: 'a', playerId: 'a', fleet: { DART: 1 },
          tech: { tech: {}, damageMult: shot / (HULLS.DART.atk * 1.6) } }], [
          { stackId: 'd', playerId: 'd', fleet: { ARGOSY: wounds.length }, tech: { tech: { SHIP_SHIELDS: level } },
            damage: wounds.filter(bp => bp > 0).map(damageBp => ({ hull: 'ARGOSY', count: 1, damageBp })) },
        ], 0, mean, 'MONUMENT', true);
        for (const round of result.rounds) {
          ships.sort((a, b) => a.hp - b.hp || a.shield - b.shield);
          let remaining = shot, absorbed = 0;
          for (const ship of ships) {
            const shieldHit = Math.min(remaining, ship.shield);
            ship.shield -= shieldHit;
            absorbed += shieldHit;
            remaining -= shieldHit;
            const hullHit = Math.min(remaining, ship.hp);
            ship.hp -= hullHit;
            remaining -= hullHit;
          }
          expect(round.defenderShipShieldAbsorbed).toBe(Math.round(absorbed));
        }
        const alive = ships.filter(ship => ship.hp > 1e-7);
        expect(result.defenderSurvivors.ARGOSY ?? 0).toBe(alive.length);
        const lostHp = result.defenderDamage.reduce((sum, lot) =>
          sum + lot.count * hp * (lot.damageBp + (lot.remainderBp ?? 0)) / 10000, 0);
        expect(alive.length * hp - lostHp).toBeCloseTo(alive.reduce((sum, ship) => sum + ship.hp, 0), 5);
      }), { seed: 20261022, numRuns: 300 });
  });

  it('cannot mint shields by splitting already wounded ships into individual waves', () => {
    const stack = (id: string, count: number): JointAttackerStack => ({ contributionId: id, playerId: id,
      fleet: { DART: count }, tech: { tech: { SHIP_SHIELDS: 3 } },
      damage: [{ hull: 'DART', count, damageBp: 5000, remainderBp: 0.25 }] });
    const one = resolveJointCombat([stack('one', 40)], { PIKE: 25 }, 0, mean, side, true);
    const many = resolveJointCombat(Array.from({ length: 40 }, (_, i) => stack(String(i), 1)), { PIKE: 25 }, 0, mean, side, true);
    expect(many.attackerSurvivors).toEqual(one.attackerSurvivors);
    expect(many.attackerDamage).toEqual(one.attackerDamage);
    expect(many.rounds).toEqual(one.rounds);
  });

  it('credits only real remaining hull when a shot overkills wounded owners with different shields', () => {
    const hp = HULLS.ARGOSY.hp;
    const result = resolveBattle([
      { contributionId: 'a', playerId: 'a', fleet: { DART: 1000 }, tech: side },
      { contributionId: 'b', playerId: 'b', fleet: { DART: 1000 }, tech: side },
    ], [
      { stackId: 'plain', playerId: 'd1', fleet: { ARGOSY: 2 }, tech: side,
        damage: [{ hull: 'ARGOSY', count: 1, damageBp: 5000 }] },
      { stackId: 'shielded', playerId: 'd2', fleet: { ARGOSY: 2 }, tech: { tech: { SHIP_SHIELDS: 4 } },
        damage: [{ hull: 'ARGOSY', count: 2, damageBp: 7500 }] },
    ], 0, mean, 'MONUMENT');
    expect(result.rounds).toHaveLength(1);
    expect(fleetCount(result.defenderSurvivors)).toBe(0);
    expect(result.rounds[0]!.defenderShipShieldAbsorbed).toBe(6 * hp);
    // 1.5 hulls remain on the first owner and 0.5 on the second; no shield or overkill is credit.
    expect(result.contributions.map(row => row.hullDamage)).toEqual([hp, hp]);
  });

  it('uses each owner’s shield research on a supported line', () => {
    const result = resolveBattle([{ contributionId: 'a', playerId: 'a', fleet: { PIKE: 100 }, tech: side }], [
      { stackId: 'base', playerId: 'd1', fleet: { DART: 100 }, tech: side },
      { stackId: 'researched', playerId: 'd2', fleet: { DART: 100 }, tech: { tech: { SHIP_SHIELDS: 4 } } },
    ], 0, mean, 'MONUMENT');
    expect(fleetCount(result.defenders[1]!.survivors)).toBeGreaterThan(fleetCount(result.defenders[0]!.survivors));
  });
});
