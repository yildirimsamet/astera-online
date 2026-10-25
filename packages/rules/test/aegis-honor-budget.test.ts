import { describe, expect, it } from 'vitest';
import { mulberry32, resolveBattle, resolveCombat, shieldHp, type Fleet } from '../src/index.js';

const side = { tech: {} };
describe('planet shield protection stays within the actual entry charge', () => {
  it('does not reject a real Warden volley through floating-point shield overcount', () => {
    const result = resolveCombat({ WARDEN: 42 }, { CORSAIR: 30, DART: 10 }, 100, mulberry32(40), { attacker: side, defender: side });
    expect(result.shieldLeft).toBe(0);
    expect(result.shieldProtectedArmed).toBe(100);
  });

  it.each([0, 1, 100, shieldHp(3), shieldHp(5), 338.25])('bounds normal protection by %s charge for solo, joint and supported battles', charge => {
    const fleet: Fleet = { WARDEN: 42, NULLIFIER: 3 };
    for (let seed = 0; seed < 64; seed++) {
      const result = resolveBattle([
        { contributionId: 'a', playerId: 'a', fleet, tech: side },
        { contributionId: 'b', playerId: 'b', fleet: { DART: 50 }, tech: side },
      ], [
        { stackId: 'host', playerId: 'host', fleet: { CORSAIR: 20, DART: 10 }, tech: side },
        { stackId: 'support', playerId: 'support', fleet: { CORSAIR: 10 }, tech: side },
      ], charge, mulberry32(seed), 'HP_PLANET', true);
      expect(result.shieldProtectedArmed).toBeGreaterThanOrEqual(0);
      expect(result.shieldProtectedArmed).toBeLessThanOrEqual(charge);
    }
  });
});
