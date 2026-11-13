import { STARTER } from '@astera/rules';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { holdFullDue, holdShare, rememberHoldFull } from '../src/starter/hold.js';

/** Plan 2026-11-13 §4.4: the hold the jump carries, read the way the server counts it (`jumpHold`, capped). */
describe('how full the hold is', () => {
  const none = { alloy: 0, crystal: 0, deuterium: 0, bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0, queue: [], crates: [] };
  it('is empty with nothing aboard, and full at both caps', () => {
    expect(holdShare(none)).toBe(0);
    expect(holdShare({ ...none, alloy: STARTER.carry.alloy, crystal: STARTER.carry.crystal })).toBe(1);
  });

  it('counts the works as well as the store, and nothing over a cap', () => {
    const half = holdShare({ ...none, alloy: STARTER.carry.alloy / 2, bufferCrystal: STARTER.carry.crystal / 2 });
    expect(half).toBeCloseTo(0.5, 5);
    expect(holdShare({ ...none, alloy: STARTER.carry.alloy * 9 })).toBeCloseTo(0.5, 5);
  });

  // Code review 2026-11-13: the panel said "full" while the ship's own header said 90 %.
  it('counts what work in progress pays back and the ready crates, as the jump and its panel do', () => {
    const working = {
      ...none, alloy: STARTER.carry.alloy / 2,
      queue: [{ cost: { alloy: STARTER.carry.alloy / 2, crystal: 0, deuterium: 0 } }],
      crates: [{ state: 'ready' as const, alloy: 0, crystal: STARTER.carry.crystal }, { state: 'sealed' as const, alloy: 9_999, crystal: 9_999 }],
    };
    expect(holdShare(working)).toBe(1);
    expect(holdShare({ ...working, crates: [] })).toBeCloseTo(0.5, 5);
  });
});

/**
 * THE HOLD FILLS (plan 2026-11-13 §4.5, a medium moment). From here on what the ship earns cannot go
 * down with it: said once a ship, the first time it is seen full with the jump open, so a player who
 * was away while it filled hears it on the first look.
 */
describe('the moment the hold is full', () => {
  const opened = { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 }, facts: ['FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'] as const };
  const full = { id: 'ship-1', ...opened, alloy: STARTER.carry.alloy - 40, bufferAlloy: 40, crystal: STARTER.carry.crystal, bufferCrystal: 0, deuterium: 0, bufferDeuterium: 0, queue: [], crates: [] };
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('is due when alloy and crystal reach the caps, counting the works, with the jump open', () => {
    expect(holdFullDue(full)).toBe(true);
    expect(holdFullDue({ ...full, bufferAlloy: 39 })).toBe(false);
    expect(holdFullDue({ ...full, crystal: STARTER.carry.crystal - 1 })).toBe(false);
  });

  it('counts a repair under way, which the jump would pay back', () => {
    expect(holdFullDue({ ...full, crystal: 0, queue: [{ cost: { alloy: 0, crystal: STARTER.carry.crystal, deuterium: 0 } }] })).toBe(true);
  });

  it('waits for the jump window: a hold full before it opens has nowhere to go yet', () => {
    expect(holdFullDue({ ...full, facts: ['FIRST_MINING_RETURN'] })).toBe(false);
  });

  it('is said once a ship, however often it is full again', () => {
    rememberHoldFull('ship-1');
    expect(holdFullDue(full)).toBe(false);
    expect(holdFullDue({ ...full, id: 'ship-2' })).toBe(true);
  });

  it('never breaks on a device that keeps nothing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => { rememberHoldFull('ship-1'); }).not.toThrow();
    expect(holdFullDue(full)).toBe(true);
  });
});
