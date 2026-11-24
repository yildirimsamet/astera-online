import { describe, expect, it } from 'vitest';
import { INSTANT_BUILD, buildingMinutes, upgradeOrderMinutes } from '../src/index.js';

/**
 * THE FIVE-MINUTE RULE (owner, 2026-11-20; plan docs/inis-sonrasi-ilk-saat-plani-2026-11-20.md §5.6). A
 * building or instrument upgrade whose whole time is five minutes or less takes no time at all, for
 * everyone. Ships, defence, research and satellites keep their clocks.
 */
describe('the five-minute rule', () => {
  it('is five minutes, the edge included', () => {
    expect(INSTANT_BUILD).toEqual({ maxMinutes: 5 });
    expect(upgradeOrderMinutes(4.99)).toBe(0);
    expect(upgradeOrderMinutes(5)).toBe(0);
    expect(upgradeOrderMinutes(5.01)).toBe(5.01);
    expect(upgradeOrderMinutes(0.2)).toBe(0);
  });

  it('frees the first rungs a landed world can build, and none past them', () => {
    expect(upgradeOrderMinutes(buildingMinutes('DEUTERIUM_PLANT', 1, {}))).toBe(0);
    expect(upgradeOrderMinutes(buildingMinutes('DEUTERIUM_PLANT', 2, {}))).toBe(0);
    expect(upgradeOrderMinutes(buildingMinutes('VAULT', 2, {}))).toBe(0);
    expect(upgradeOrderMinutes(buildingMinutes('SHIPYARD', 2, {}))).toBe(0);
    expect(upgradeOrderMinutes(buildingMinutes('REFINERY', 3, {}))).toBeGreaterThan(5);
    expect(upgradeOrderMinutes(buildingMinutes('CORE', 4, {}))).toBeGreaterThan(5);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('refuses a time that is not a duration (%s)', minutes => {
    expect(() => upgradeOrderMinutes(minutes)).toThrow(RangeError);
  });
});
