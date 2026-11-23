import { describe, expect, it } from 'vitest';
import { WELCOME_WEEK, welcomeBox, welcomeNext } from '../src/index.js';

const HOUR = 3_600_000;

/**
 * NEW COMMANDER 7 DAYS (plan 2026-11-06 §7.2, Y3). Boxes are counted, not days: a missed day is not lost,
 * the next box waits. One box a day at most — the next is ready 20 hours after the last was opened.
 */
describe('the next welcome box', () => {
  it('has the first box ready at once', () => {
    expect(welcomeNext(0, null)).toEqual({ box: 1, readyAtMs: 0 });
  });

  it('readies the next one 20 hours after the last opening, however long ago that was', () => {
    expect(WELCOME_WEEK.gapHours).toBe(20);
    expect(welcomeNext(1, 0)).toEqual({ box: 2, readyAtMs: 20 * HOUR });
  });

  it('ends after the seventh', () => {
    expect(WELCOME_WEEK.boxes).toBe(7);
    expect(welcomeNext(7, 0)).toEqual({ box: null, readyAtMs: null });
  });
});

describe('what a welcome box holds', () => {
  it('increases alloy and crystal every single day from box 1 through box 7', () => {
    for (let i = 1; i < WELCOME_WEEK.boxes; i++) {
      const current = welcomeBox(i);
      const next = welcomeBox(i + 1);
      expect(next.alloy).toBeGreaterThan(current.alloy);
      expect(next.crystal).toBeGreaterThan(current.crystal);
    }
  });

  it('adds escalating deuterium starting after day 3 (boxes 4 through 7)', () => {
    expect([1, 2, 3].map(i => welcomeBox(i).deuterium)).toEqual([0, 0, 0]);
    for (let i = 4; i <= WELCOME_WEEK.boxes; i++) {
      expect(welcomeBox(i).deuterium).toBeGreaterThan(welcomeBox(i - 1).deuterium);
    }
  });

  it('grants ring-helios on day 3 and engine-titan on day 7', () => {
    expect(welcomeBox(3).cosmeticId).toBe('ring-helios');
    expect(welcomeBox(7).cosmeticId).toBe('engine-titan');
    expect([1, 2, 4, 5, 6].map(i => welcomeBox(i).cosmeticId)).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });

  it('refuses a box outside the seven', () => {
    expect(() => welcomeBox(0)).toThrow();
    expect(() => welcomeBox(8)).toThrow();
  });
});
