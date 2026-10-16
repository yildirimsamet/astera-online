import { describe, expect, it } from 'vitest';
import { honorReferenceAt } from '../src/honorHistory.js';

const hour = 3_600_000;
describe('Honor reference history', () => {
  it('retains a still-owned old fleet even if no event occurred during the last day', () => {
    expect(honorReferenceAt([{ at: 0, navy: 1000, coreTier: 4 }], 100 * hour))
      .toEqual({ navy: 1000, tier: 4 });
  });
  it('retains pre-defeat value for 24 hours, then expires it exactly at the boundary', () => {
    const history = [{ at: 0, navy: 1000, coreTier: 4 }, { at: 10 * hour, navy: 100, coreTier: 2 }];
    expect(honorReferenceAt(history, 34 * hour - 1)).toEqual({ navy: 1000, tier: 4 });
    expect(honorReferenceAt(history, 34 * hour)).toEqual({ navy: 100, tier: 4 });
  });
  it('higher colony loss never erases the season Core tier, and future records cannot leak backwards', () => {
    const history = [{ at: 0, navy: 1000, coreTier: 4 }, { at: 10, navy: 100, coreTier: 2 }, { at: 20, navy: 2000, coreTier: 5 }];
    expect(honorReferenceAt(history, 15)).toEqual({ navy: 1000, tier: 4 });
  });
  it('requires a known initial state and rejects contradictory same-time observations', () => {
    expect(() => honorReferenceAt([], 1)).toThrow();
    expect(() => honorReferenceAt([{ at: 2, navy: 1, coreTier: 1 }], 1)).toThrow();
    expect(() => honorReferenceAt([{ at: 0, navy: 1, coreTier: 1 }, { at: 0, navy: 2, coreTier: 1 }], 1)).toThrow();
  });
  it('normalises input order without reading a clock, and rejects malformed observations', () => {
    const history = [{ at: 0, navy: 1, coreTier: 1 }, { at: 2, navy: 2, coreTier: 2 }];
    expect(honorReferenceAt(history, 3)).toEqual(honorReferenceAt([...history].reverse(), 3));
    expect(() => honorReferenceAt([{ at: 0, navy: -1, coreTier: 1 }], 1)).toThrow();
  });
  it('uses persisted ordering for different settlements sharing an effective timestamp', () => {
    expect(honorReferenceAt([{ at: 0, order: 1, navy: 100, coreTier: 1 },
      { at: 0, order: 2, navy: 200, coreTier: 2 }], 25 * hour)).toEqual({ navy: 200, tier: 2 });
  });
});
