import { describe, expect, it } from 'vitest';
import { HULLS } from '@astera/rules';
import { healthDisplay, homeMaintenanceRows, maintenanceChoice } from '../src/lib/maintenanceInventory.js';

describe('maintenance UI presents exact, explicit health selections', () => {
  it('groups by hull and exact health, including healthy ships for scrap', () => {
    const rows = homeMaintenanceRows({ DART: 5 }, [{ hull: 'DART', count: 2, damageBp: 1000, remainderBp: 0.25 }]);
    expect(rows.map((row) => [row.count, row.damageBp, row.remainderBp])).toEqual([[2, 1000, 0.25], [3, 0, 0]]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
    expect(maintenanceChoice(rows, {}, 100).ships).toBe(0);
  });

  it('prices only the chosen quantities and never substitutes a changed cohort', () => {
    const rows = homeMaintenanceRows({ DART: 5 }, [{ hull: 'DART', count: 2, damageBp: 1000, remainderBp: 0.25 }]);
    const chosen = maintenanceChoice(rows, { [rows[0]!.key]: 1 }, 100);
    expect(chosen.ships).toBe(1);
    expect(chosen.selection).toEqual({ source: 'HOME', groups: [{ hull: 'DART', count: 1, damageBp: 1000, remainderBp: 0.25 }] });
    expect(chosen.repairCost.alloy).toBe(Math.ceil(HULLS.DART.alloy * 0.100025));
    expect(chosen.scrap.alloy).toBe(Math.floor(HULLS.DART.alloy * 0.899975 * 0.5));
    const changed = homeMaintenanceRows({ DART: 5 }, [{ hull: 'DART', count: 2, damageBp: 1001, remainderBp: 0.25 }]);
    expect(maintenanceChoice(changed, { [rows[0]!.key]: 1 }, 100)).toMatchObject({ stale: true, selection: null });
    expect(maintenanceChoice(rows, { [rows[0]!.key]: 3 }, 100)).toMatchObject({ stale: true, selection: null });
  });

  it('keeps damage below 1bp visible and distinguishes both sides of the 5% cutoff', () => {
    expect(healthDisplay({ damageBp: 0, remainderBp: Number.MIN_VALUE })).toEqual({ percent: 100, relation: 'below' });
    expect(healthDisplay({ damageBp: 9499, remainderBp: 1 - Number.EPSILON })).toEqual({ percent: 5, relation: 'above' });
    expect(healthDisplay({ damageBp: 9500, remainderBp: 0 })).toEqual({ percent: 5, relation: 'exact' });
    expect(healthDisplay({ damageBp: 9500, remainderBp: 0.001 })).toEqual({ percent: 5, relation: 'below' });
    expect(healthDisplay({ damageBp: 9999, remainderBp: 1 - Number.EPSILON })).toEqual({ percent: 0.01, relation: 'below' });
  });
});
