import { describe, expect, it } from 'vitest';
import { COMBAT, createBattleRecording, fleetCount, mulberry32, resolveBattle, type Fleet, type JointAttackerStack } from '../src/index.js';

const attack = (fleet: Fleet): JointAttackerStack => ({ contributionId: 'a', playerId: 'a', fleet, tech: { tech: {} } });
const defence = (fleet: Fleet) => ({ stackId: 'd', playerId: 'd', fleet, tech: { tech: {} } });
const CASES: readonly [Fleet, Fleet, number][] = [
  [{ DART: 6 }, { DART: 6 }, 0],
  [{ DART: 2, PIKE: 2, WARDEN: 2 }, { DART: 1, PIKE: 1, WARDEN: 1 }, 150],
  [{ DART: 16 }, { WARDEN: 3 }, 0],
  [{ PIKE: 3 }, { DART: 10 }, 225],
];

describe('the optional battle tempo', () => {
  it('changes nothing in the main game when it is not given', () => {
    for (const [a, d, shield] of CASES) for (let seed = 1; seed <= 40; seed++) {
      const plain = resolveBattle([attack(a)], [defence(d)], shield, mulberry32(seed), 'HP_PLANET', true);
      const named = resolveBattle([attack(a)], [defence(d)], shield, mulberry32(seed), 'HP_PLANET', true, undefined, COMBAT.tempo);
      expect(named).toEqual(plain);
    }
  });

  it('leaves more ships alive at half tempo', () => {
    let full = 0, half = 0;
    for (let seed = 1; seed <= 200; seed++) {
      full += fleetCount(resolveBattle([attack({ DART: 6 })], [defence({ DART: 6 })], 0, mulberry32(seed), 'HP_PLANET', true).defenderSurvivors);
      half += fleetCount(resolveBattle([attack({ DART: 6 })], [defence({ DART: 6 })], 0, mulberry32(seed), 'HP_PLANET', true, undefined, COMBAT.tempo / 2).defenderSurvivors);
    }
    expect(half).toBeGreaterThan(full);
  });

  it('halves the damage scale exactly, and the replay records it', () => {
    const scale = (tempo?: number) => {
      const recording = createBattleRecording();
      resolveBattle([attack({ DART: 6 })], [defence({ DART: 6 })], 0, mulberry32(9), 'HP_PLANET', true, recording, tempo);
      return recording.damageScale!;
    };
    expect(scale(COMBAT.tempo / 2).attacker).toBeCloseTo(scale().attacker / 2, 10);
    expect(scale(COMBAT.tempo / 2).defender).toBeCloseTo(scale().defender / 2, 10);
  });

  it('is what hull and attack multipliers cannot do: on both sides they cancel out', () => {
    const run = (mult: { hullMult?: number; damageMult?: number }) =>
      resolveBattle(
        [{ contributionId: 'a', playerId: 'a', fleet: { DART: 6 }, tech: { tech: {}, ...mult } }],
        [{ stackId: 'd', playerId: 'd', fleet: { DART: 6 }, tech: { tech: {}, ...mult } }],
        0, mulberry32(21), 'HP_PLANET', true,
      );
    const plain = run({});
    for (const mult of [{ hullMult: 1.5 }, { damageMult: 0.7 }]) {
      const changed = run(mult);
      expect(changed.attackerSurvivors).toEqual(plain.attackerSurvivors);
      expect(changed.defenderSurvivors).toEqual(plain.defenderSurvivors);
    }
  });
});
