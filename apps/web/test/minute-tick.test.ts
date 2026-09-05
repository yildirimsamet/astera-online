import { describe, expect, it } from 'vitest';
import { minuteTick } from '../src/lib/time.js';

/**
 * A CLOCK DEPENDENCY PRICED IN MINUTES. D166.
 *
 * `useNow()` ticks every second or five and a memo listing it never hits. For a
 * figure printed in whole minutes that is pure waste, and for the merchant's
 * "soonest reach" — a scan plus a bisection over a three-hour horizon — it was
 * twelve solves a minute on the main thread beside the 3D scene.
 *
 * The fix is to depend on the MINUTE rather than on the instant, and the property
 * that makes it safe is the one tested here: the value is constant inside a minute
 * and changes exactly once at the boundary. Anything more precise than the output
 * is work nobody can see.
 */
describe('the minute a memo depends on', () => {
  it('is constant everywhere inside one minute', () => {
    const start = 1_800_000_000_000;
    const minute = minuteTick(start);
    expect(minuteTick(start + 1)).toBe(minute);
    expect(minuteTick(start + 30_000)).toBe(minute);
    expect(minuteTick(start + 59_999)).toBe(minute);
  });

  it('advances by exactly one at the boundary', () => {
    const start = 1_800_000_000_000;
    expect(minuteTick(start + 60_000)).toBe(minuteTick(start) + 1);
    expect(minuteTick(start + 600_000)).toBe(minuteTick(start) + 10);
  });

  it('is monotonic, so a memo keyed on it never runs backwards', () => {
    let previous = minuteTick(0);
    for (let ms = 0; ms < 10 * 60_000; ms += 7_000) {
      const tick = minuteTick(ms);
      expect(tick).toBeGreaterThanOrEqual(previous);
      previous = tick;
    }
  });
});
