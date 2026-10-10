import { describe, expect, it } from 'vitest';
import {
  ASTEROID_DYNAMIC, ASTEROID_SHOWER_FRONT_LOAD, GALAXY_EVENTS,
  LEGACY_ASTEROID_GENERATION, currentAsteroidGeneration, generateAsteroidHour,
  generateAsteroidSchedule, mulberry32, planAsteroidHour, withAsteroidShowerLanes,
  type PlannedGalaxyEvent,
} from '../src/index.js';

const plain = {
  activePlayers: 32, hourStartsAtMinute: 7200, spawnFromMinute: 7200,
  seasonEndsAtMinute: 99999, showers: [],
};

describe('10 October asteroid density', () => {
  it('uses 0.75 rocks per commander per hour and spreads the half-bonus over ten minutes', () => {
    expect(ASTEROID_DYNAMIC.perPlayerPerHour).toBe(0.75);
    expect(ASTEROID_SHOWER_FRONT_LOAD).toMatchObject({ share: 0.5, minutes: 10 });
    expect(currentAsteroidGeneration().frontLoadMinutes).toBe(10);
    expect(LEGACY_ASTEROID_GENERATION.frontLoadMinutes).toBe(5);
  });

  it('versions the same half-hour starts with weekday 2/2 and weekend 2/4', () => {
    const definition = GALAXY_EVENTS.definitions.ASTEROID_SHOWER;
    expect(definition.version).toBe(12);
    expect(definition.windows.map(window => [window.days, window.startsAtLocalMinute,
      window.endsAtLocalMinute, window.effect.asteroidSpawnMultiplier])).toEqual([
      ['WEEKDAY', 750, 780, 2], ['WEEKDAY', 1200, 1230, 2],
      ['WEEKEND', 780, 810, 2], ['WEEKEND', 1200, 1230, 4],
    ]);
  });

  it('plans 24 ordinary rocks for the live incident population of 32', () => {
    expect(planAsteroidHour(plain)).toEqual([
      { fromMinute: 7200, untilMinute: 7260, count: 24, frontCount: 0 },
    ]);
  });

  it.each([
    { multiplier: 2, count: 24, frontCount: 6 },
    { multiplier: 4, count: 48, frontCount: 18 },
  ])('plans only the first half-hour at x$multiplier, then 12 ordinary rocks', ({ multiplier, count, frontCount }) => {
    expect(planAsteroidHour({ ...plain,
      showers: [{ startsAtMinute: 7200, endsAtMinute: 7230, multiplier }],
    })).toEqual([
      { fromMinute: 7200, untilMinute: 7230, count, frontCount },
      { fromMinute: 7230, untilMinute: 7260, count: 12, frontCount: 0 },
    ]);
  });

  it('rounds fractional supply to whole rocks per lane for small populations', () => {
    expect(planAsteroidHour({ ...plain, activePlayers: 1 })[0]?.count).toBe(1);
    expect(planAsteroidHour({ ...plain, activePlayers: 2 })[0]?.count).toBe(2);
    expect(planAsteroidHour({ ...plain, activePlayers: 0 })).toEqual([]);
    expect(planAsteroidHour({ ...plain, activePlayers: 30, showers: [
      { startsAtMinute: 7200, endsAtMinute: 7230, multiplier: 2 },
    ] }).map(lane => lane.count)).toEqual([23, 11]);
  });

  it('places reserved new bonus rocks after minute five and before minute ten', () => {
    const input = {
      hourOrdinal: 120, isotopeSeed: 42, rng: () => 0.75,
      lanes: [{ fromMinute: 7200, untilMinute: 7230, count: 48, frontCount: 18 }],
    };
    const current = generateAsteroidHour({ ...input, generation: currentAsteroidGeneration() });
    expect(current).toHaveLength(48);
    expect(current.slice(0, 18).every(rock => rock.appearsAt === 7207.5)).toBe(true);
    expect(current.slice(18).every(rock => rock.appearsAt === 7222.5)).toBe(true);
    // Old rows keep the five-minute schedule even after the defaults change.
    const legacy = generateAsteroidHour(input);
    expect(legacy.slice(0, 18).every(rock => rock.appearsAt === 7203.75)).toBe(true);
    expect(legacy.map(rock => rock.index)).toEqual(current.map(rock => rock.index));
  });

  it.each([4, 5, 10, 11])('keeps legacy calendar v%i rock specs unchanged when the front default changes', definitionVersion => {
    const base = generateAsteroidSchedule(mulberry32(123), 60, 123);
    const event: PlannedGalaxyEvent = {
      sequence: 0, kind: 'ASTEROID_SHOWER', definitionVersion,
      startsAtMinute: 0, endsAtMinute: 30, effect: { asteroidSpawnMultiplier: 5 },
    };
    const descriptor = Object.getOwnPropertyDescriptor(ASTEROID_SHOWER_FRONT_LOAD, 'minutes')!;
    try {
      Object.defineProperty(ASTEROID_SHOWER_FRONT_LOAD, 'minutes', { value: 5 });
      const before = withAsteroidShowerLanes(base, [event], 123, { span: 60 });
      Object.defineProperty(ASTEROID_SHOWER_FRONT_LOAD, 'minutes', { value: 10 });
      expect(withAsteroidShowerLanes(base, [event], 123, { span: 60 })).toEqual(before);
    } finally {
      Object.defineProperty(ASTEROID_SHOWER_FRONT_LOAD, 'minutes', descriptor);
    }
  });
});
