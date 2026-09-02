import { describe, expect, it } from 'vitest';
import {
  GALAXY_EVENTS,
  GALAXY,
  assertMutuallyExclusiveEventWindows,
  generateAsteroidSchedule,
  generateGalaxyEventSchedule,
  mulberry32,
  withAsteroidShowerLanes,
} from '../src/index.js';

const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;
// 2026-09-02 00:00 in Türkiye (UTC+03:00).
const TURKEY_MIDNIGHT_UNIX_MINUTE = Date.parse('2026-09-01T21:00:00.000Z') / MINUTE;

describe('galaxy event calendar', () => {
  it('ships the requested Asteroid Shower production defaults', () => {
    expect(GALAXY_EVENTS.calendar.dailyCount).toEqual({ min: 5, max: 5 });
    expect(GALAXY_EVENTS.calendar.timeZone).toBe('Europe/Istanbul');
    expect(GALAXY_EVENTS.calendar.utcOffsetMinutes).toBe(180);
    expect(GALAXY_EVENTS.calendar.lowPriorityWindow).toMatchObject({
      startsAtLocalMinute: 0,
      endsAtLocalMinute: 8 * 60,
      targetShare: 0.2,
      maxDailyCount: 2,
    });
    expect(GALAXY_EVENTS.definitions.ASTEROID_SHOWER).toMatchObject({
      durationMinutes: 60,
      repeatCooldownMinutes: 120,
      effect: { asteroidSpawnMultiplier: 5 },
    });
  });

  it('plans exactly five events per full Türkiye day with one or at most two at night', () => {
    const schedule = generateGalaxyEventSchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 14 * DAY_MINUTES,
      rng: mulberry32(0x51a7),
    });

    expect(schedule).toHaveLength(14 * 5);
    for (let day = 0; day < 14; day += 1) {
      const inDay = schedule.filter((event) =>
        event.startsAtMinute >= day * DAY_MINUTES
        && event.startsAtMinute < (day + 1) * DAY_MINUTES);
      const atNight = inDay.filter((event) => {
        const minute = event.startsAtMinute - day * DAY_MINUTES;
        return minute >= 0 && minute < 8 * 60;
      });
      expect(inDay).toHaveLength(5);
      expect(atNight.length).toBeGreaterThanOrEqual(1);
      expect(atNight.length).toBeLessThanOrEqual(2);
    }
  });

  it('is deterministic and preserves the configured cooldown across local midnight', () => {
    const input = {
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 4 * DAY_MINUTES,
    };
    const first = generateGalaxyEventSchedule({ ...input, rng: mulberry32(9441) });
    const second = generateGalaxyEventSchedule({ ...input, rng: mulberry32(9441) });

    expect(second).toEqual(first);
    for (let index = 1; index < first.length; index += 1) {
      const previous = first[index - 1]!;
      const current = first[index]!;
      expect(current.startsAtMinute).toBeGreaterThanOrEqual(
        previous.endsAtMinute + GALAXY_EVENTS.definitions.ASTEROID_SHOWER.repeatCooldownMinutes,
      );
    }
  });

  it('keeps a 14-day arbitrary-start season at seventy occurrences', () => {
    for (const [offset, seed] of [[3 * 60, 91], [11 * 60 + 17, 291]] as const) {
      const schedule = generateGalaxyEventSchedule({
        seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE + offset,
        seasonDurationMinutes: 14 * DAY_MINUTES,
        rng: mulberry32(seed),
      });

      expect(schedule).toHaveLength(70);
      expect(schedule.every((event) => event.startsAtMinute >= 0)).toBe(true);
      expect(schedule.every((event) => event.endsAtMinute <= 14 * DAY_MINUTES)).toBe(true);
    }
  });

  it('rejects an impossible calendar instead of silently dropping events', () => {
    expect(() => generateGalaxyEventSchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: DAY_MINUTES,
      rng: mulberry32(1),
      config: {
        ...GALAXY_EVENTS,
        definitions: {
          ASTEROID_SHOWER: {
            ...GALAXY_EVENTS.definitions.ASTEROID_SHOWER,
            repeatCooldownMinutes: DAY_MINUTES,
          },
        },
      },
    })).toThrow(/Unable to schedule galaxy events/);
  });

  it('rejects configured cross-kind overlaps but allows touching half-open windows', () => {
    const first = { kind: 'ASTEROID_SHOWER', startsAtMinute: 60, endsAtMinute: 120 } as const;
    const overlapping = { kind: 'TRADING_SHIP', startsAtMinute: 119, endsAtMinute: 180 } as const;
    const touching = { ...overlapping, startsAtMinute: 120 };
    const exclusions = [['ASTEROID_SHOWER', 'TRADING_SHIP']] as const;

    expect(() => {
      assertMutuallyExclusiveEventWindows([first, overlapping], exclusions);
    })
      .toThrow(/mutually exclusive/i);
    expect(() => {
      assertMutuallyExclusiveEventWindows([first, touching], exclusions);
    }).not.toThrow();
  });
});

describe('Asteroid Shower bonus lane', () => {
  it('adds four times the normal hourly rate without changing existing rocks', () => {
    const span = DAY_MINUTES;
    const base = generateAsteroidSchedule(mulberry32(400), span, 400);
    const showered = withAsteroidShowerLanes(base, [{
      sequence: 3,
      kind: 'ASTEROID_SHOWER',
      startsAtMinute: 8 * 60,
      endsAtMinute: 9 * 60,
      definitionVersion: 1,
      effect: { asteroidSpawnMultiplier: 5 },
    }], 400);

    expect(showered.slice(0, base.length)).toEqual(base);
    expect(showered.length - base.length).toBe(
      Math.round(GALAXY.asteroidSpawnPerHour
        * (GALAXY_EVENTS.definitions.ASTEROID_SHOWER.effect.asteroidSpawnMultiplier - 1)),
    );
    const bonus = showered.slice(base.length);
    expect(bonus.every((rock) => rock.appearsAt >= 8 * 60 && rock.appearsAt < 9 * 60)).toBe(true);
    expect(bonus.some((rock) => rock.expiresAt > 9 * 60)).toBe(true);
  });
});
