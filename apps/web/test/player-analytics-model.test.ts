import { describe, expect, it } from 'vitest';
import { mergeIntervals, retentionWindow, summarizeActivity, shouldStartSession } from '../src/api/analyticsModel.js';

describe('observed activity and retention definitions', () => {
  it('merges overlapping tabs without counting unknown time', () => {
    expect(mergeIntervals([{ start: 0, end: 300_000 }, { start: 120_000, end: 420_000 }]))
      .toEqual([{ start: 0, end: 420_000 }]);
    expect(summarizeActivity([{ start: 0, end: 300_000 }, { start: 1_500_000, end: 1_680_000 }]))
      .toBe(480_000);
    expect(() => mergeIntervals([{ start: 10, end: 0 }])).toThrow();
  });
  it('uses the exact 30-minute boundary without treating token refresh as a visit', () => {
    expect(shouldStartSession(0, 1_799_999)).toBe(false);
    expect(shouldStartSession(0, 1_800_000)).toBe(true);
    expect(shouldStartSession(null, 0)).toBe(true);
    expect(shouldStartSession(100, 99)).toBe(true);
  });
  it('does not declare an immature or missing observation a retention failure', () => {
    const hour = 3_600_000;
    expect(retentionWindow(0, 1, 47 * hour, [30 * hour])).toEqual({ mature: false, returned: null });
    expect(retentionWindow(0, 1, 48 * hour, [24 * hour])).toEqual({ mature: true, returned: true });
    expect(retentionWindow(0, 1, 48 * hour, [48 * hour])).toEqual({ mature: true, returned: false });
    expect(retentionWindow(0, 7, 192 * hour, [168 * hour])).toEqual({ mature: true, returned: true });
  });
});
