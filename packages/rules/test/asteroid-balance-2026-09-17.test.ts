import { describe, expect, it } from 'vitest';
import { ASTEROID_DYNAMIC, GALAXY, GALAXY_EVENTS, generateAsteroidSchedule, planAsteroidHour } from '../src/index.js';
import { mulberry32 } from '../src/rng.js';

describe('2026-09-17 asteroid balance', () => {
  it('halves the actual budgeted ore of the established field', () => {
    const rocks = generateAsteroidSchedule(mulberry32(123), 1440, 123);
    const yields = rocks.reduce<Record<number, number>>((counts, rock) => {
      counts[rock.ore] = (counts[rock.ore] ?? 0) + 1;
      return counts;
    }, {});
    expect(GALAXY.asteroidOreQuantum).toBe(200);
    expect(yields).toEqual({ 200: 308, 400: 65 });
  });

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

  it('defines doubled half-hour showers for future calendar adoption', () => {
    expect(GALAXY_EVENTS.definitions.ASTEROID_SHOWER.version).toBe(10);
    expect(GALAXY_EVENTS.definitions.ASTEROID_SHOWER.windows.map((window) => [
      window.days,
      window.startsAtLocalMinute,
      window.endsAtLocalMinute,
      window.effect.asteroidSpawnMultiplier,
    ])).toEqual([
      ['WEEKDAY', 750, 780, 4],
      ['WEEKDAY', 1200, 1230, 6],
      ['WEEKEND', 780, 810, 6],
      ['WEEKEND', 1200, 1230, 10],
    ]);
    expect(GALAXY_EVENTS.definitions.TRADE_SHIP.windows.map((window) => [
      window.startsAtLocalMinute,
      window.endsAtLocalMinute,
    ])).toEqual([[60, 240], [420, 600], [900, 1080], [1260, 1440]]);
  });
});
