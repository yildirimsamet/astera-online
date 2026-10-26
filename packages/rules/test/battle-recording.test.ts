import { describe, expect, it } from 'vitest';
import { COMBAT, HULLS, fleetCount, mulberry32, resolveBattle, shipShieldHp, type Fleet, type JointAttackerStack } from '../src/index.js';
import { createBattleRecording, type BattleRecording } from '../src/battleRecording.js';

const attack = (fleet: Fleet, id = 'a'): JointAttackerStack => ({ contributionId: id, playerId: id, fleet, tech: { tech: {} } });
const defence = (fleet: Fleet) => ({ stackId: 'd', playerId: 'd', fleet, tech: { tech: {} } });
function battle(a: Fleet, d: Fleet, shield = 0, seed = 7) {
  const recording = createBattleRecording();
  const result = resolveBattle([attack(a)], [defence(d)], shield, mulberry32(seed), 'HP_PLANET', true, recording);
  return { result, recording };
}
const shots = (recording: BattleRecording) => recording.rounds.flatMap(r => [...r.attackerShots, ...r.defenderShots]);

describe('authoritative per-shot battle recording', () => {
  it('records actual ship identities and researched entry values without changing battle results or RNG consumption', () => {
    const a = [{ ...attack({ CORSAIR: 3, NULLIFIER: 2, COURIER: 1 }), tech: { tech: { SHIP_POWER: 3, SHIP_SHIELDS: 4 } } }];
    const d = [defence({ CITADEL: 2, BASTION: 3, ARGOSY: 1 })];
    for (let seed = 0; seed < 12; seed++) {
      const recording = createBattleRecording(), plainRng = mulberry32(seed), recordedRng = mulberry32(seed);
      const plain = resolveBattle(a, d, 1300, plainRng, 'HP_PLANET', true);
      const recorded = resolveBattle(a, d, 1300, recordedRng, 'HP_PLANET', true, recording);
      expect(recorded).toEqual(plain);
      expect(recordedRng()).toBe(plainRng());
      expect(recording.ships).toHaveLength(12);
      expect(new Set(recording.ships.map(s => s.id)).size).toBe(12);
      expect(recording.ships.find(s => s.hull === 'CORSAIR')?.shield).toBe(shipShieldHp(a[0]!.tech.tech, 'CORSAIR'));
      expect(recording.initialAegis).toBe(1300);
      expect(recording.roundLimit).toBe(COMBAT.rounds);
    }
  });

  it('reconstructs every target HP, shield and Aegis movement in order, including same-shot redistribution', () => {
    const { recording } = battle({ CATACLYSM: 2 }, { DART: 2, ARGOSY: 2, GARBAGE_COLLECTOR: 1 }, 100);
    const hp = new Map(recording.ships.map(s => [s.id, s.hp]));
    const shields = new Map(recording.ships.map(s => [s.id, s.shield]));
    let aegis = recording.initialAegis;
    for (const round of recording.rounds) {
      for (const strike of round.aegisStrikes ?? []) { expect(strike.aegisBefore).toBe(aegis); aegis = strike.aegisAfter; }
      for (const shot of [...round.attackerShots, ...round.defenderShots]) {
        const source = recording.ships.find(s => s.id === shot.sourceId)!;
        // Combat v3: every shot already carries its side's tempo × handicap scale.
        const scale = source.side === 'ATTACK' ? recording.damageScale!.attacker : recording.damageScale!.defender;
        expect(shot.baseDamage).toBeCloseTo(source.attack * (source.side === 'ATTACK' ? round.attackerRoll : round.defenderRoll) * scale, 9);
        let usedBase = 0;
        for (const hit of shot.hits) {
          expect(hit.hpBefore).toBe(hp.get(hit.targetId));
          expect(hit.shieldBefore).toBe(shields.get(hit.targetId));
          expect(hit.hpBefore - hit.hpAfter).toBeCloseTo(hit.hullDamage, 9);
          expect(hit.shieldBefore - hit.shieldAfter).toBeCloseTo(hit.shieldDamage, 9);
          expect(hit.hpAfter).toBeGreaterThanOrEqual(0);
          if (source.side === 'ATTACK') {
            expect(hit.aegisBefore).toBe(aegis);
            aegis = hit.aegisAfter;
          }
          usedBase += (hit.normalAegisDamage + hit.shieldDamage + hit.hullDamage) / hit.counter;
          hp.set(hit.targetId, hit.hpAfter);
          shields.set(hit.targetId, hit.shieldAfter);
        }
        expect(usedBase + shot.unusedBaseDamage).toBeCloseTo(shot.baseDamage, 7);
      }
      for (const state of round.after) {
        // A ship that broke apart after its hits ends the round at zero.
        expect(state.hp).toBe((round.exploded ?? []).includes(state.id) ? 0 : hp.get(state.id));
        expect(state.shield).toBe(shields.get(state.id));
        hp.set(state.id, state.hp);
      }
      expect(round.aegisAfter).toBe(aegis);
    }
    expect(shots(recording).some(s => s.hits.some(h => h.pass > 0))).toBe(true);
  });

  it('separates Nullifier bonus from normal Aegis absorption and never credits bonus to hulls', () => {
    const { recording } = battle({ NULLIFIER: 2 }, { BASTION: 5 }, 99);
    const hits = recording.rounds[0]!.attackerShots.flatMap(s => s.hits);
    const strikes = recording.rounds[0]!.aegisStrikes ?? [];
    expect(strikes.reduce((n, strike) => n + strike.damage, 0)).toBeGreaterThan(0);
    expect(hits.every(hit => hit.bonusAegisDamage === 0)).toBe(true);
    expect(strikes.reduce((n, strike) => n + strike.damage, 0) + hits.reduce((n, hit) => n + hit.normalAegisDamage, 0)).toBeCloseTo(99);
    for (const hit of hits) {
      expect(hit.aegisBefore - hit.aegisAfter).toBeCloseTo(hit.normalAegisDamage + hit.bonusAegisDamage);
      expect(hit.hpBefore - hit.hpAfter).toBeCloseTo(hit.hullDamage);
    }
  });

  it('records the fire of ships killed in the same round and preserves both sides firing rights', () => {
    const { recording } = battle({ DART: 1 }, { CATACLYSM: 1 });
    const round = recording.rounds[0]!;
    expect(round.attackerShots).toHaveLength(1);
    expect(round.defenderShots).toHaveLength(1);
    const dart = recording.ships.find(s => s.side === 'ATTACK')!;
    expect(round.after.find(s => s.id === dart.id)?.status).toBe('DESTROYED');
    expect(round.attackerShots[0]?.sourceId).toBe(dart.id);
  });

  it('keeps armed target protection through each shot and exposes cargo only after all armed HP is exhausted', () => {
    const { recording } = battle({ CATACLYSM: 3 }, { DART: 1, COURIER: 1, GARBAGE_COLLECTOR: 1 });
    let armedDead = false;
    for (const shot of recording.rounds[0]!.attackerShots) for (const hit of shot.hits) {
      const target = recording.ships.find(s => s.id === hit.targetId)!;
      if (target.hull === 'DART' && hit.hpAfter === 0) armedDead = true;
      if (target.hull !== 'DART') expect(armedDead).toBe(true);
    }
    expect(recording.rounds[0]!.after.filter(s => s.status === 'DESTROYED')).toHaveLength(3);
  });

  it('records actual round-end retreats and excludes those identities from subsequent shots and targets', () => {
    let escaped = 0;
    for (let seed = 0; seed < 48; seed++) {
      const { recording } = battle({ CORSAIR: 3 }, { CORSAIR: 2 }, 0, seed);
      const retreated = new Set<string>();
      for (const round of recording.rounds) {
        for (const shot of [...round.attackerShots, ...round.defenderShots]) {
          expect(retreated.has(shot.sourceId)).toBe(false);
          for (const hit of shot.hits) expect(retreated.has(hit.targetId)).toBe(false);
        }
        for (const id of round.retreated) { retreated.add(id); escaped++; }
        if (round.round === COMBAT.rounds) expect(round.retreated).toEqual([]);
      }
    }
    expect(escaped).toBeGreaterThan(0);
  });

  it('preserves ground identity and separate allied owners with different research and arrival wounds', () => {
    const recording = createBattleRecording();
    const a = [attack({ DART: 2 }), { ...attack({ DART: 1 }, 'ally'), tech: { tech: { SHIP_ARMOR: 4 } }, damage: [{ hull: 'DART' as const, count: 1, damageBp: 2000 }] }];
    resolveBattle(a, [defence({ BASTION: 3, HARPOON: 2, THORN: 1 })], 0, mulberry32(7), 'HP_PLANET', true, recording);
    expect(new Set(recording.ships.filter(s => s.side === 'ATTACK').map(s => s.playerId))).toEqual(new Set(['a', 'ally']));
    const ally = recording.ships.find(s => s.playerId === 'ally')!;
    expect(ally.hp).toBeCloseTo(ally.maxHp * .8);
    expect(recording.ships.filter(s => HULLS[s.hull].ground).every(s => s.shield === 0)).toBe(true);
    expect(recording.rounds.flatMap(r => r.retreated).every(id => !HULLS[recording.ships.find(s => s.id === id)!.hull].ground)).toBe(true);
  });

  it('records no fake rounds for empty or cargo-only battles and leaves unguarded Aegis untouched', () => {
    const empty = battle({ DART: 1 }, {}, 1000);
    expect(empty.recording.rounds).toEqual([]);
    expect(empty.result.shieldLeft).toBe(1000);
    const cargo = battle({ COURIER: 1 }, { ARGOSY: 1 });
    expect(cargo.recording.rounds).toEqual([]);
    expect(fleetCount(cargo.result.attackerSurvivors)).toBe(1);
  });
});
