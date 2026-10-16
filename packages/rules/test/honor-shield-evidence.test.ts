import { describe, expect, it } from 'vitest';
import { resolveRaid, soloStack, seededFrom } from '../src/index.js';

describe('Honor shield participation uses actual normal protection', () => {
  it('counts normal absorbed fire protecting an armed line', () => {
    const { result } = resolveRaid({ stacks: [soloStack({ DART: 10 }, { tech: {} })], line: { DART: 10 }, shield: 100_000,
      rng: () => seededFrom('honor-shield'), defender: { tech: {} }, deuterium: 0, escape: false, minimumCombatShips: 0, preciseDamage: true });
    expect(result.rounds.length).toBeGreaterThan(0);
    expect(result.shieldProtectedArmed).toBeGreaterThan(0);
    const visibleFire = result.rounds.reduce((sum, round) => sum + round.attackerDamage, 0);
    expect(Math.abs(result.shieldProtectedArmed! - visibleFire)).toBeLessThanOrEqual(result.rounds.length / 2);
  });

  it('does not turn Nullifier bonus shield burn into a defending contribution', () => {
    const { result } = resolveRaid({ stacks: [soloStack({ NULLIFIER: 20 }, { tech: {} })], line: { THORN: 100 }, shield: 10_000_000,
      rng: () => seededFrom('honor-nullifier'), defender: { tech: {} }, deuterium: 0, escape: false, minimumCombatShips: 0, preciseDamage: true });
    expect(result.rounds.length).toBeGreaterThan(0);
    for (const round of result.rounds) {
      expect(round.shieldBreakerDamage).toBeGreaterThan(0);
    }
    const visibleFire = result.rounds.reduce((sum, round) => sum + round.attackerDamage, 0);
    expect(Math.abs(result.shieldProtectedArmed! - visibleFire)).toBeLessThanOrEqual(result.rounds.length / 2);
    expect(result.shieldProtectedArmed).toBeLessThan(result.rounds.reduce((sum, round) => sum + round.shieldAbsorbed, 0));
  });

  it('gives no protection credit to an empty world or a maintenance-disabled line', () => {
    for (const count of [0, 10]) {
      const { result } = resolveRaid({ stacks: [soloStack({ DART: 10 }, { tech: {} })], line: { DART: count }, shield: 100_000,
        homeDamage: count ? [{ hull: 'DART', count, damageBp: 9500 }] : [], maintenance: true,
        rng: () => seededFrom('honor-disabled'), defender: { tech: {} }, deuterium: 0, escape: false, minimumCombatShips: 0, preciseDamage: true });
      expect(result.shieldProtectedArmed).toBe(0);
    }
  });
});
