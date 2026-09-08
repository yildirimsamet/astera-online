import { describe, expect, it } from 'vitest';
import { inactivityEligible } from '../src/index.js';

describe('continuous 48-hour inactivity', () => {
  const hour = 60 * 60 * 1000;
  const state = { lastActiveAt: 0, joinedAt: 0, mainEnteredAt: 0 };
  it('includes exactly 48 hours and excludes one millisecond before', () => {
    expect(inactivityEligible(state, 48 * hour - 1)).toBe(false);
    expect(inactivityEligible(state, 48 * hour)).toBe(true);
  });
  it.each(['lastActiveAt', 'joinedAt', 'mainEnteredAt'] as const)('uses %s as a lower bound', (field) => {
    expect(inactivityEligible({ ...state, [field]: hour }, 48 * hour)).toBe(false);
    expect(inactivityEligible({ ...state, [field]: hour }, 49 * hour)).toBe(true);
  });
  it('does not depend on midnight or a last-seen timestamp', () => {
    const offset = 23.5 * hour;
    const shifted = { lastActiveAt: offset, joinedAt: offset, mainEnteredAt: offset, lastSeenAt: 100 * hour };
    expect(inactivityEligible(shifted, offset + 48 * hour)).toBe(true);
    expect(inactivityEligible(state, -hour)).toBe(false);
  });
});
