import { describe, expect, it } from 'vitest';
import { nextEligibleReturn } from '../src/index.js';

describe('return admission preserves seniority while skipping temporary blockers', () => {
  it('admits B while A cannot return, then prefers A over C when A becomes eligible', () => {
    const a = { id: 'A', sequence: 1n, eligible: false };
    const b = { id: 'B', sequence: 2n, eligible: true };
    const c = { id: 'C', sequence: 3n, eligible: true };
    const queue = Object.freeze([Object.freeze(a), Object.freeze(b), Object.freeze(c)]);
    expect(nextEligibleReturn(queue)).toBe(b);
    expect(queue.map((entry) => entry.sequence)).toEqual([1n, 2n, 3n]);
    const unblocked = { ...a, eligible: true };
    expect(nextEligibleReturn([c, unblocked])).toBe(unblocked);
  });

  it('keeps every blocked application available for a later sweep', () => {
    const queue = Object.freeze([
      Object.freeze({ id: 'A', sequence: 1n, eligible: false }),
      Object.freeze({ id: 'B', sequence: 2n, eligible: false }),
    ]);
    expect(nextEligibleReturn(queue)).toBeNull();
    expect(queue).toHaveLength(2);
    expect(nextEligibleReturn(queue.map((entry) => ({ ...entry, eligible: true })))?.id).toBe('A');
  });

  it('uses durable sequence order even after restart with unordered rows and sequence gaps', () => {
    const older = { id: 'older', sequence: 9_007_199_254_740_992n, eligible: true };
    const newer = { id: 'newer', sequence: 9_007_199_254_740_993n, eligible: true };
    expect(nextEligibleReturn([newer, older])).toBe(older);
    expect(nextEligibleReturn([older, newer])).toBe(older);
  });

  it('returns no candidate for an empty queue', () => {
    expect(nextEligibleReturn([])).toBeNull();
  });
});
