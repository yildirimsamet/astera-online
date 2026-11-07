import { describe, expect, it } from 'vitest';
import {
  COMBAT,
  STARTER,
  STARTER_PVP_BALANCE,
  computeLoot,
  createBattleRecording,
  fleetCount,
  mulberry32,
  resolveBattle,
  shieldHp,
  starterBattle,
  vesselAegisHp,
  type Fleet,
  type JointAttackerStack,
  type DefenderStack,
} from '../src/index.js';

const attack = (fleet: Fleet): JointAttackerStack => ({ contributionId: 'a', playerId: 'a', fleet, tech: { tech: {} } });
const defend = (fleet: Fleet): DefenderStack => ({ stackId: 'd', playerId: 'd', fleet, tech: { tech: {} } });

describe('a battle in the starter galaxy', () => {
  it('is the main solver at this galaxy\'s tempo, with the wounds rule on', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const here = starterBattle([attack({ DART: 6 })], [defend({ DART: 3 })], 75, mulberry32(seed));
      const main = resolveBattle([attack({ DART: 6 })], [defend({ DART: 3 })], 75, mulberry32(seed), 'HP_PLANET', true, undefined, STARTER.combat.tempo);
      expect(here).toEqual(main);
    }
  });

  it('records the slower damage on the replay', () => {
    const recording = createBattleRecording();
    starterBattle([attack({ DART: 6 })], [defend({ DART: 6 })], 0, mulberry32(4), recording);
    const main = createBattleRecording();
    resolveBattle([attack({ DART: 6 })], [defend({ DART: 6 })], 0, mulberry32(4), 'HP_PLANET', true, main);
    expect(recording.damageScale!.attacker / main.damageScale!.attacker).toBeCloseTo(STARTER.combat.tempo / COMBAT.tempo, 10);
  });

  it('can still destroy ships, and can leave a whole fleet dead with no flight home', () => {
    let destroyed = 0, wiped = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const result = starterBattle([attack({ DART: 3 })], [defend({ DART: 16 })], 0, mulberry32(seed));
      const left = fleetCount(result.attackerSurvivors);
      if (left < 3) destroyed++;
      if (left === 0) wiped++;
    }
    expect(destroyed).toBeGreaterThan(0);
    expect(wiped).toBeGreaterThan(0);
  });

  it('leaves more ships alive than the same fight in the main game', () => {
    let here = 0, main = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const a = [attack({ DART: 6 })], d = [defend({ DART: 6 })];
      here += fleetCount(starterBattle(a, d, 0, mulberry32(seed)).attackerSurvivors);
      main += fleetCount(resolveBattle(a, d, 0, mulberry32(seed), 'HP_PLANET', true).attackerSurvivors);
    }
    expect(here).toBeGreaterThan(main);
  });
});

describe('the Aegis on a ship', () => {
  it('scales with the tempo', () => {
    expect(vesselAegisHp(1)).toBe(75);
    expect(vesselAegisHp(2)).toBe(113);
    expect(vesselAegisHp(1)).toBe(Math.round(shieldHp(1) * STARTER.combat.tempo / COMBAT.tempo));
  });

  it('is nothing before it is repaired', () => {
    expect(vesselAegisHp(0)).toBe(0);
  });

  it('stops at the second stage', () => {
    expect(vesselAegisHp(3)).toBe(vesselAegisHp(STARTER.combat.aegisMax));
    expect(vesselAegisHp(9)).toBe(113);
  });
});

describe('what a raid takes', () => {
  const stock = { alloy: 1000, crystal: 1000, deuterium: 1000 };
  const none = { alloy: 0, crystal: 0, deuterium: 0 };

  it('fills all six fields of the balance a report stores', () => {
    expect(STARTER_PVP_BALANCE).toEqual({
      lootDecisive: 0.1, lootPartial: 0.05, lootBufferShare: 0.5,
      recoveryLossHours: 0, recoveryLookbackHours: 0, recoveryShieldHours: 3,
    });
  });

  it('takes a tenth on a decisive win, half that on a partial one, and nothing when repelled', () => {
    const take = (grade: 'DECISIVE' | 'PARTIAL' | 'REPELLED') => {
      const loot = computeLoot(stock, none, none, grade, 100_000, STARTER_PVP_BALANCE);
      return loot.alloy + loot.crystal + loot.deuterium;
    };
    expect(take('DECISIVE')).toBeCloseTo(300, 0);
    expect(take('PARTIAL')).toBeCloseTo(150, 0);
    expect(take('REPELLED')).toBe(0);
  });

  it('is capped by what the ships can carry', () => {
    const loot = computeLoot(stock, none, none, 'DECISIVE', 30, STARTER_PVP_BALANCE);
    expect(loot.alloy + loot.crystal + loot.deuterium).toBeLessThanOrEqual(30);
  });
});
