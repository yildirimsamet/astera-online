import { describe, expect, it } from 'vitest';
import { dockBill } from '../src/index.js';

/**
 * EVERY WOUND IS BILLED (owner 2026-11-06). The ship once mended a fifth of a hull on landing, a rule
 * the main game does not have (`maintenanceLanding`); what is learned aboard now holds after the jump.
 */
describe('the Repair Station aboard', () => {
  it('bills a light wound, as the main game does', () => {
    const bill = dockBill([{ hull: 'DART', count: 2, damageBp: 1500 }]);
    expect(bill.cost.alloy).toBeGreaterThan(0);
    expect(bill.minutes).toBeGreaterThan(0);
  });

  it('bills nothing for no wound', () => {
    expect(dockBill([])).toEqual({ cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 0 });
  });

  // A battle can leave a wound below one basis point, which the station has nothing to mend (F4 measurement).
  it('bills nothing for a wound below a basis point, as the main station does', () => {
    expect(dockBill([{ hull: 'DART', count: 1, damageBp: 0, remainderBp: 0.4 }])).toEqual({ cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 0 });
    const real = { hull: 'DART' as const, count: 1, damageBp: 1500 };
    expect(dockBill([{ hull: 'DART', count: 1, damageBp: 0, remainderBp: 0.4 }, real])).toEqual(dockBill([real]));
  });
});
