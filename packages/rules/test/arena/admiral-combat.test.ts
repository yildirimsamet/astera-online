import { expect, it } from 'vitest';
import { resolveCombat } from '../../src/combat.js';
import { withAdmiral } from '../../src/arena/admiral.js';
it('applies class bonuses in the real battle resolver, outside research and existing damage modifiers', () => {
  const normal = { tech: {} }; const fleet = { DART: 500 };
  const baseline = resolveCombat(fleet, fleet, 0, () => .5, { attacker: normal, defender: normal });
  const attack = resolveCombat(fleet, fleet, 0, () => .5, { attacker: withAdmiral(normal, { ship: 'akinci', level: 20 }), defender: normal });
  const defend = resolveCombat(fleet, fleet, 0, () => .5, { attacker: normal, defender: withAdmiral(normal, { ship: 'muhafiz', level: 20 }) });
  expect(attack.defenderLossValue).toBeGreaterThan(baseline.defenderLossValue);
  expect(defend.defenderLossValue).toBeLessThan(baseline.defenderLossValue);
  expect(withAdmiral({ tech: {}, damageMult: .55 }, { ship: 'akinci', level: 20 }).damageMult).toBeCloseTo(.55 * 1.05);
  expect(withAdmiral(normal, null)).toBe(normal); expect(normal).toEqual({ tech: {} });
});
