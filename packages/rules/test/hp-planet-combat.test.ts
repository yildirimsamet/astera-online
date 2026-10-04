import { describe, expect, it } from 'vitest';
import { mulberry32, resolveBattle, resolveRaid, type DefenderStack, type Fleet, type HpDamageLots, type JointAttackerStack } from '../src/index.js';

const attacker = (fleet: Fleet, damage?: HpDamageLots): JointAttackerStack => ({ contributionId: 'a', playerId: 'a', fleet, tech: { tech: {} }, ...(damage ? { damage } : {}) });
const host = (fleet: Fleet): DefenderStack => ({ stackId: 'host', playerId: 'host', fleet, tech: { tech: {} } });

describe('precise HP wounds in the new planet battle ruleset', () => {
  it('keeps a sub-bp arrival wound through an empty-world walkover with an idle shield', () => {
    const damage: HpDamageLots = [{ hull: 'DART', count: 2, damageBp: 0, remainderBp: 0.125 }];
    const result = resolveBattle([attacker({ DART: 2 }, damage)], [host({})], 9999, mulberry32(4), 'HP_PLANET');
    expect(result.grade).toBe('DECISIVE');
    expect(result.shieldLeft).toBe(9999);
    expect(result.attackerDamage).toEqual(damage);
    expect(result.contributions[0]?.survivorDamage).toEqual(damage);
  });

  it('keeps support damage precise while the home host and planet shield retain their rules', () => {
    const damage: HpDamageLots = [{ hull: 'COURIER', count: 1, damageBp: 2000, remainderBp: 0.75 }];
    const support: DefenderStack = { stackId: 'support', playerId: 'supporter', fleet: { COURIER: 1 }, tech: { tech: {} }, damage };
    const result = resolveBattle([attacker({ COURIER: 1 })], [host({}), support], 800, mulberry32(2), 'HP_PLANET');
    expect(result.shieldLeft).toBe(800);
    expect(result.defenders[1]?.survivorDamage).toEqual(damage);
  });

  it('does not admit wounded home ships, including wounds smaller than a whole bp', () => {
    const wounded: DefenderStack = { ...host({ DART: 1 }), damage: [{ hull: 'DART', count: 1, damageBp: 0, remainderBp: 0.25 }] };
    expect(() => resolveBattle([attacker({ DART: 2 })], [wounded], 0, mulberry32(1), 'HP_PLANET')).toThrow(RangeError);
  });

  it('retains ground-gun salvage and the solo planet salvo for the same seed', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const stacks = [attacker({ CITADEL: 10, DART: 50 })];
      const defenders = [host({ BASTION: 3, DART: 4 })];
      const legacy = resolveBattle(stacks, defenders, 1500, mulberry32(seed));
      const precise = resolveBattle(stacks, defenders, 1500, mulberry32(seed), 'HP_PLANET');
      expect(precise.rounds).toEqual(legacy.rounds);
      expect(precise.attackerSurvivors).toEqual(legacy.attackerSurvivors);
      expect(precise.defenderSurvivors).toEqual(legacy.defenderSurvivors);
      expect(precise.defenceSalvage).toEqual(legacy.defenceSalvage);
      expect(precise.grade).toBe(legacy.grade);
    }
  });

  it('threads precision through raid and escape resolution without healing untouched attackers', () => {
    const damage: HpDamageLots = [{ hull: 'CITADEL', count: 1, damageBp: 3000, remainderBp: 0.125 }];
    const result = resolveRaid({ stacks: [attacker({ CITADEL: 1 }, damage)], line: {}, shield: 100,
      rng: () => mulberry32(7), defender: { tech: {} }, deuterium: 0, escape: true, minimumCombatShips: 5, preciseDamage: true });
    expect(result.result.attackerDamage).toEqual(damage);
    expect(result.escape).toBeNull();
  });

  it('leaves the old planet’s pinned whole-bp damage output unchanged', () => {
    const result = resolveBattle([attacker({ DART: 1 }, [{ hull: 'DART', count: 1, damageBp: 3000 }])], [host({})], 100, mulberry32(7));
    expect(result.attackerDamage).toEqual([{ hull: 'DART', count: 1, damageBp: 3000 }]);
  });
});
