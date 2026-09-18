import { describe, expect, it } from 'vitest';
import {
  GALAXY,
  GALAXY_EVENTS,
  HULLS,
  INTERGALACTIC_CONVOY,
  TRADE,
  travelExact,
} from '../src/index.js';

/**
 * THE TWO VOYAGES THAT CROSS THE WHOLE DISC GOT LONGER WITH IT. Owner instruction,
 * 2026-09-19, after the 2000 → 3000 radius: the convoy runs 180 minutes and every
 * merchant window 150.
 */
describe('event windows sized for the radius-3000 galaxy', () => {
  it('runs every convoy crossing for three hours', () => {
    expect(INTERGALACTIC_CONVOY.durationMinutes).toBe(180);
    const { windows, version } = GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY;
    expect(version).toBe(5);
    for (const window of windows) {
      expect(window.endsAtLocalMinute - window.startsAtLocalMinute).toBe(180);
    }
    // Back to the pre-growth crossing speed: 6,000 units in three hours.
    expect((2 * GALAXY.radius) / INTERGALACTIC_CONVOY.durationMinutes).toBeCloseTo(4000 / 120, 12);
  });

  it('keeps every merchant window open for two and a half hours', () => {
    const { windows, version } = GALAXY_EVENTS.definitions.TRADE_SHIP;
    expect(version).toBe(5);
    expect(windows.map((w) => [w.startsAtLocalMinute, w.endsAtLocalMinute])).toEqual([
      [60, 3.5 * 60], [7 * 60, 9.5 * 60], [15 * 60, 17.5 * 60], [21 * 60, 23.5 * 60],
    ]);
  });

  it('leaves the slowest cargo hull a real margin on the worst merchant trip', () => {
    const worst = travelExact(GALAXY.radius + TRADE.orbitMax, HULLS.ATLAS.speed) * 2;
    const window = GALAXY_EVENTS.definitions.TRADE_SHIP.windows[0].endsAtLocalMinute
      - GALAXY_EVENTS.definitions.TRADE_SHIP.windows[0].startsAtLocalMinute;
    expect(window - worst).toBeGreaterThan(30);
  });
});

