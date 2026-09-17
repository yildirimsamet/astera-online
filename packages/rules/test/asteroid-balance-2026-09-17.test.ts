import { describe, expect, it } from 'vitest';
import { ASTEROID_DYNAMIC, GALAXY_EVENTS, planAsteroidHour } from '../src/index.js';

describe('2026-09-17 asteroid balance', () => {
  it('opens one normal rock per active commander each hour', () => {
    expect(ASTEROID_DYNAMIC.perPlayerPerHour).toBe(1);
    expect(planAsteroidHour({
      activePlayers: 26,
      hourStartsAtMinute: 600,
      spawnFromMinute: 600,
      seasonEndsAtMinute: 9999,
      showers: [],
    })).toEqual([{ fromMinute: 600, untilMinute: 660, count: 26, frontCount: 0 }]);
  });

  it('defines the reduced weekday and weekend showers for future restamps', () => {
    expect(GALAXY_EVENTS.definitions.ASTEROID_SHOWER.version).toBe(8);
    expect(GALAXY_EVENTS.definitions.ASTEROID_SHOWER.windows.map((window) => [
      window.days,
      window.startsAtLocalMinute,
      window.endsAtLocalMinute,
      window.effect.asteroidSpawnMultiplier,
    ])).toEqual([
      ['WEEKDAY', 750, 810, 2],
      ['WEEKDAY', 1200, 1260, 5],
      ['WEEKEND', 780, 840, 3],
      ['WEEKEND', 1200, 1260, 6],
    ]);
    expect(GALAXY_EVENTS.definitions.TRADE_SHIP.windows.map((window) => [
      window.startsAtLocalMinute,
      window.endsAtLocalMinute,
    ])).toEqual([[60, 180], [420, 540], [900, 1020], [1260, 1380]]);
  });
});
