import { STARTER } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { holdShare } from '../src/starter/hold.js';

/** Plan 2026-11-13 §4.4: the hold the jump carries, read the way the server counts it (store and works, capped). */
describe('how full the hold is', () => {
  const none = { alloy: 0, crystal: 0, bufferAlloy: 0, bufferCrystal: 0 };
  it('is empty with nothing aboard, and full at both caps', () => {
    expect(holdShare(none)).toBe(0);
    expect(holdShare({ ...none, alloy: STARTER.carry.alloy, crystal: STARTER.carry.crystal })).toBe(1);
  });

  it('counts the works as well as the store, and nothing over a cap', () => {
    const half = holdShare({ ...none, alloy: STARTER.carry.alloy / 2, bufferCrystal: STARTER.carry.crystal / 2 });
    expect(half).toBeCloseTo(0.5, 5);
    expect(holdShare({ ...none, alloy: STARTER.carry.alloy * 9 })).toBeCloseTo(0.5, 5);
  });
});
