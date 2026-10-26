import { describe, expect, it } from 'vitest';
import { createBattleRecording, resolveBattle, resolveRaid, mulberry32, type DefenderStack, type JointAttackerStack, type HpDamageLots, type Fleet } from '../src/index.js';

const a = (fleet: Fleet, damage?: HpDamageLots): JointAttackerStack => ({ contributionId: 'a', playerId: 'a', fleet, damage, tech: { tech: {} } });
const d = (fleet: Fleet, damage?: HpDamageLots): DefenderStack => ({ stackId: 'host', playerId: 'd', fleet, damage, tech: { tech: {} } });
const flat = () => 0.5;

describe('maintenance combat participation is fixed when the battle starts', () => {
  it.each([0, 3])('cannot win an undefended raid when warships become unable to fight, even with %s cargo ships', cargo => {
    const damage = [{ hull: 'DART' as const, count: 2, damageBp: 9500, remainderBp: 0.25 }];
    const fleet: Fleet = cargo > 0 ? { DART: 2, COURIER: cargo } : { DART: 2 };
    const raid = resolveRaid({ stacks: [a(fleet, damage)], line: {}, shield: 1000,
      rng: () => flat, defender: { tech: {} }, deuterium: 100_000, escape: false,
      minimumCombatShips: 1, maintenance: true, preciseDamage: true });
    expect(raid.result.grade).toBe('REPELLED');
    expect(raid.result.attackerSurvivors).toEqual(fleet);
    expect(raid.result.attackerDamage).toEqual(damage);
    expect(raid.result.defenderLosses).toEqual({});
    expect(raid.result.shieldLeft).toBe(1000);
  });
  /*
    Combat v3: the escape reads the battle's own matchup, where a grounded hull stands in the
    line and fires nothing. A wing of nothing but grounded hulls is no threat at all.
  */
  it('does not let attackers that cannot fire make a threat on their own', () => {
    const result = resolveRaid({ stacks: [a({ CITADEL: 500 }, [{ hull: 'CITADEL', count: 500, damageBp: 9500 }])],
      line: { DART: 1 }, shield: 0, rng: () => flat, defender: { tech: {} }, deuterium: 100_000,
      escape: true, minimumCombatShips: 1, maintenance: true, preciseDamage: true });
    expect(result.escape).toBeNull();
  });
  it('does not erase an untouched fractional wound in a legacy planet battle', () => {
    const damage = [{ hull: 'DART' as const, count: 1, damageBp: 0, remainderBp: 0.125 }];
    const result = resolveBattle([a({ DART: 1 }, damage)], [d({})], 0, flat, 'PLANET', true);
    expect(result.attackerDamage).toEqual(damage);
  });
  it('keeps an initially eligible ship firing after battle damage takes it below 5% HP', () => {
    // Combat v3 critical damage usually breaks a hull hit this low apart, and a survivor usually
    // retreats; the rare seeds where it holds together and stays decide.
    let checked = 0;
    for (let seed = 0; seed < 2048; seed++) {
      const recording = createBattleRecording();
      resolveBattle([a({ CITADEL: 1 }, [{ hull: 'CITADEL', count: 1, damageBp: 9499 }])],
        [d({ DART: 1 })], 100_000, mulberry32(seed), 'HP_PLANET', true, recording);
      const [first, second] = recording.rounds;
      const citadel = recording.ships.find(ship => ship.hull === 'CITADEL')!;
      const after = first?.after.find(ship => ship.id === citadel.id);
      if (!second || !after || after.hp <= 0 || after.hp >= citadel.maxHp * .05) continue;
      checked++;
      expect(second.attackerShots.some(shot => shot.sourceId === citadel.id && shot.baseDamage > 0)).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('uses a wounded home host’s real HP in the solo defender path', () => {
    const wounded = createBattleRecording(), whole = createBattleRecording();
    const result = resolveBattle([a({ DART: 5 })], [d({ DART: 1 }, [{ hull: 'DART', count: 1, damageBp: 9000 }])], 0, flat, 'HP_PLANET', true, wounded);
    expect(result.defenderLosses.DART).toBe(1);
    const healthy = resolveBattle([a({ DART: 5 })], [d({ DART: 1 })], 0, flat, 'HP_PLANET', false, whole);
    // The wound is read into the host's power; its gun is not.
    expect(wounded.ships.find(ship => ship.side === 'DEFENCE')!.hp).toBeCloseTo(whole.ships.find(ship => ship.side === 'DEFENCE')!.hp * .1, 9);
    expect(result.balance!.defenderPower).toBeLessThan(healthy.balance!.defenderPower);
    const shot = (recording: typeof wounded) => recording.rounds[0]!.defenderShots[0]!.baseDamage / recording.damageScale!.defender;
    expect(shot(wounded)).toBeCloseTo(shot(whole), 9);
  });

  it('excludes 5% planet defenders entirely without awarding kills or damage for them', () => {
    const result = resolveBattle([a({ CITADEL: 100 })], [d({ DART: 2 }, [{ hull: 'DART', count: 2, damageBp: 9500, remainderBp: 0 }])], 1000, flat, 'HP_PLANET', true);
    expect(result.grade).toBe('DECISIVE');
    expect(result.rounds).toEqual([]);
    expect(result.defenderLosses).toEqual({});
    expect(result.defenders[0]?.sent).toEqual({});
    expect(result.contributions[0]?.hullDamage).toBe(0);
  });

  it('keeps critically wounded monument ships targetable but prevents their fire', () => {
    const result = resolveBattle([a({ DART: 40 })], [d({ DART: 10 }, [{ hull: 'DART', count: 10, damageBp: 9500 }])], 0, flat, 'MONUMENT', true);
    expect(result.rounds.every((round) => round.defenderDamage === 0)).toBe(true);
    expect(result.defenderLosses.DART).toBe(10);
    expect(result.attackerLosses).toEqual({});
    expect(result.defenderLossValue).toBeGreaterThan(0);
  });

  it('does not let initially critical attackers fire or add Nullifier shield damage', () => {
    const result = resolveBattle([a({ NULLIFIER: 10 }, [{ hull: 'NULLIFIER', count: 10, damageBp: 9500 }])], [d({ CITADEL: 1 })], 1000, flat, 'HP_PLANET', true);
    expect(result.rounds.every((round) => round.attackerDamage === 0 && round.shieldBreakerDamage === 0)).toBe(true);
    expect(result.shieldLeft).toBe(1000);
  });

  it('retains healthy combat arithmetic and seeded rolls', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      const stacks = [a({ DART: 30, CITADEL: 5 })];
      const defenders = [d({ DART: 10, BASTION: 3 })];
      expect(resolveBattle(stacks, defenders, 500, mulberry32(seed), 'HP_PLANET', true))
        .toEqual(resolveBattle(stacks, defenders, 500, mulberry32(seed), 'HP_PLANET'));
    }
  });

  it('keeps the existing NPC garrison combat rule outside player maintenance eligibility', () => {
    const guard = { ...d({ DART: 10 }, [{ hull: 'DART' as const, count: 10, damageBp: 9500 }]), maintenanceExempt: true };
    const result = resolveBattle([a({ DART: 20 })], [guard], 0, flat, 'MONUMENT', true);
    expect(result.rounds[0]?.defenderDamage).toBeGreaterThan(0);
  });
});
