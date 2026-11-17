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
  const rate = { alloy: 300, crystal: 100 };
  it('is about an hour of output, crystal-heavy', () => {
    const box = welcomeBox(1, rate);
    expect(box.alloy + box.crystal).toBe(400);
    expect(box.crystal).toBeGreaterThan(box.alloy);
  });

  it('makes the seventh about three hours', () => {
    const box = welcomeBox(7, rate);
    expect(box.alloy + box.crystal).toBe(1200);
  });

  it('is never empty, even while production is down', () => {
    const box = welcomeBox(2, { alloy: 0, crystal: 0 });
    expect(box.alloy + box.crystal).toBe(WELCOME_WEEK.floorPerHour);
  });

  it('refuses a box outside the seven', () => {
    expect(() => welcomeBox(0, rate)).toThrow();
    expect(() => welcomeBox(8, rate)).toThrow();
  });
});
