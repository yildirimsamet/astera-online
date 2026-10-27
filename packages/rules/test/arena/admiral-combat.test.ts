import { expect, it } from 'vitest';
import { resolveCombat, type CombatSide } from '../../src/combat.js';
import { mulberry32 } from '../../src/rng.js';
import { withAdmiral } from '../../src/arena/admiral.js';

/**
 * Combat v3 fights at a tempo fitted to both lines and draws every target at random, so one
 * fight on one roll says little; the bonus is read as the mean over a fixed set of seeds.
 */
const mean = (attacker: CombatSide, defender: CombatSide) => {
  const fleet = { DART: 500 }; let attack = 0, defence = 0;
  for (let seed = 0; seed < 40; seed++) {
    const fight = resolveCombat(fleet, fleet, 0, mulberry32(seed), { attacker, defender });
    attack += fight.attackerLossValue; defence += fight.defenderLossValue;
  }
  return { attack, defence };
};

it('applies class bonuses in the real battle resolver, outside research and existing damage modifiers', () => {
  const normal = { tech: {} };
  const baseline = mean(normal, normal);
  const attack = mean(withAdmiral(normal, { ship: 'akinci', level: 20 }), normal);
  const defend = mean(normal, withAdmiral(normal, { ship: 'muhafiz', level: 20 }));
  expect(attack.defence).toBeGreaterThan(baseline.defence);
  // The Muhafız's hull stands in the random-targeting battle too: its side loses less, the other more.
  expect(defend.defence).toBeLessThan(baseline.defence);
  expect(defend.attack).toBeGreaterThan(baseline.attack);
  expect(withAdmiral({ tech: {}, damageMult: .55 }, { ship: 'akinci', level: 20 }).damageMult).toBeCloseTo(.55 * 1.05);
  expect(withAdmiral(normal, null)).toBe(normal); expect(normal).toEqual({ tech: {} });
});
