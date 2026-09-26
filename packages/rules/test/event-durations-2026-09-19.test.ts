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
 * THE TWO PUBLIC VOYAGES AFTER THE 4,500-RADIUS MOVE. Owner instruction,
 * 2026-09-25: both the convoy crossing and every merchant window run 180 minutes.
 */
describe('event windows sized for the radius-4500 galaxy', () => {
  it('runs every convoy crossing for three hours', () => {
    expect(INTERGALACTIC_CONVOY.durationMinutes).toBe(180);
    const { windows, version } = GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY;
    expect(version).toBe(6);
    for (const window of windows) {
      expect(window.endsAtLocalMinute - window.startsAtLocalMinute).toBe(180);
    }
    // One complete 9,000-unit centre crossing in the authored three-hour window.
    expect((2 * GALAXY.radius) / INTERGALACTIC_CONVOY.durationMinutes).toBe(50);
  });

  it('keeps every merchant window open for three hours without crossing midnight', () => {
    const { windows, version } = GALAXY_EVENTS.definitions.TRADE_SHIP;
    expect(version).toBe(6);
    expect(windows.map((w) => [w.startsAtLocalMinute, w.endsAtLocalMinute])).toEqual([
      [60, 4 * 60], [7 * 60, 10 * 60], [15 * 60, 18 * 60], [21 * 60, 24 * 60],
    ]);
  });

  it('leaves the slowest cargo hull a real launch margin on the worst merchant trip', () => {
    const worst = travelExact(GALAXY.radius + TRADE.orbitMax, HULLS.ARGOSY.speed);
    const window = GALAXY_EVENTS.definitions.TRADE_SHIP.windows[0].endsAtLocalMinute
      - GALAXY_EVENTS.definitions.TRADE_SHIP.windows[0].startsAtLocalMinute;
    // Only rendezvous must happen before expiry; the return is allowed to land later.
    expect(window - worst).toBeGreaterThan(50);
  });
});
