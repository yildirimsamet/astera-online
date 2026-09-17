import { describe, expect, it } from 'vitest';
import {
  ASTEROID_DYNAMIC,
  ASTEROID_SHOWER_FRONT_LOAD,
  GALAXY,
  asteroidMaxLevelOnDay,
  dynamicAsteroidHourOf,
  dynamicAsteroidIndex,
  generateAsteroidHour,
  mulberry32,
  planAsteroidHour,
  type AsteroidHourLane,
} from '../src/index.js';

/**
 * THE FIELD FOLLOWS THE PEOPLE PLAYING IT. Owner instruction, 2026-09-16:
 * *"Aktif oyuncu azalınca bedava farm yapmamalı, çok oyuncu olunca asteroid yok
 * denilmemeli. Her saat başı aktif oyuncuya bakılır ve önümüzdeki 1 saat ne kadar
 * atılacağı belirlenir. Asteroid show etkinliklerinde aynı logic katsayı ile çarpılır."*
 *
 * Revised 2026-09-17 to one rock per active commander per hour:
 * 20 active commanders → 20 rocks that hour; 30 active during a x5 shower → 150.
 *
 * *"İlk gün sadece level 1-2, ikinci gün level 1-2-3, üçüncü gün level 1-2-3-4,
 * dördüncü gün artık hepsi"* — the level ladder opens one rung a day.
 */

const HOUR = 60;
const lanesTotal = (lanes: readonly AsteroidHourLane[]) =>
  lanes.reduce((sum, lane) => sum + lane.count, 0);

describe('the dynamic field, as figures', () => {
  it('is one rock an hour per commander active in the last hour', () => {
    expect(ASTEROID_DYNAMIC.perPlayerPerHour).toBe(1);
    expect(ASTEROID_DYNAMIC.activeWindowMinutes).toBe(60);
  });

  it('opens the level ladder one rung a day', () => {
    expect(asteroidMaxLevelOnDay(0)).toBe(2);
    expect(asteroidMaxLevelOnDay(1)).toBe(3);
    expect(asteroidMaxLevelOnDay(2)).toBe(4);
    expect(asteroidMaxLevelOnDay(3)).toBe(5);
    expect(asteroidMaxLevelOnDay(29)).toBe(5);
    // Before the season's first instant nothing larger than the first day's rocks.
    expect(asteroidMaxLevelOnDay(-1)).toBe(2);
  });

  it('makes each higher level progressively rarer without changing the old derived field', () => {
    expect(ASTEROID_DYNAMIC.levelWeights).toEqual([0, 0.44, 0.26, 0.17, 0.09, 0.04]);
    expect(ASTEROID_DYNAMIC.levelWeights.reduce((sum, weight) => sum + weight, 0))
      .toBeCloseTo(1, 9);
    for (let level = 2; level < ASTEROID_DYNAMIC.levelWeights.length; level += 1) {
      expect(ASTEROID_DYNAMIC.levelWeights[level])
        .toBeLessThan(ASTEROID_DYNAMIC.levelWeights[level - 1]!);
    }
    // The rarest rock moves from 5% to 4%: exactly twenty percent harder to roll.
    expect(ASTEROID_DYNAMIC.levelWeights[5])
      .toBeCloseTo(GALAXY.asteroidLevelWeights[5]! * 0.8, 9);
  });

  it('uses the dynamic weights when a rock level is rolled', () => {
    const draws = [0.5, 0.5, 0.5, 0.42];
    const [rock] = generateAsteroidHour({
      hourOrdinal: 72,
      lanes: [{ fromMinute: 3 * 1440, untilMinute: 3 * 1440 + 60, count: 1, frontCount: 0 }],
      rng: () => draws.shift() ?? 0.5,
      isotopeSeed: 5,
    });
    // 0.42 was L2 under the legacy 40% L1 boundary; it is L1 under the new 44% boundary.
    expect(rock?.level).toBe(1);
  });

  it('can re-derive an already-open hour with the weights stored beside it', () => {
    const draws = [0.5, 0.5, 0.5, 0.42];
    const [rock] = generateAsteroidHour({
      hourOrdinal: 72,
      lanes: [{ fromMinute: 3 * 1440, untilMinute: 3 * 1440 + 60, count: 1, frontCount: 0 }],
      levelWeights: GALAXY.asteroidLevelWeights,
      rng: () => draws.shift() ?? 0.5,
      isotopeSeed: 5,
    });
    // The same draw stays L2 for a row opened under the legacy 40% L1 boundary.
    expect(rock?.level).toBe(2);
  });
});

describe('planning one hour', () => {
  const plain = { hourStartsAtMinute: 600, spawnFromMinute: 600, seasonEndsAtMinute: 99_999, showers: [] };

  it('spawns twenty rocks for twenty commanders in an ordinary hour', () => {
    const lanes = planAsteroidHour({ ...plain, activePlayers: 20 });
    expect(lanes).toEqual([{ fromMinute: 600, untilMinute: 660, count: 20, frontCount: 0 }]);
  });

  it('spawns one hundred fifty for thirty commanders under a x5 shower', () => {
    const lanes = planAsteroidHour({
      ...plain,
      activePlayers: 30,
      showers: [{ startsAtMinute: 600, endsAtMinute: 660, multiplier: 5 }],
    });
    expect(lanesTotal(lanes)).toBe(150);
    // Half of the shower's BONUS arrives in its opening minutes, as before.
    expect(lanes[0]!.frontCount).toBe(Math.round((150 - 30) * ASTEROID_SHOWER_FRONT_LOAD.share));
  });

  it('spawns nothing in an hour nobody played', () => {
    expect(planAsteroidHour({ ...plain, activePlayers: 0 })).toEqual([]);
  });

  /**
   * A WINDOW THAT OPENS ON THE HALF HOUR MULTIPLIES HALF OF EACH HOUR. The 12:30–13:30
   * weekday shower is read by two hourly counts, and each multiplies only the part of
   * its own hour the window covers. The opening burst belongs to the first half only.
   */
  it('multiplies only the part of the hour a shower covers', () => {
    const shower = { startsAtMinute: 630, endsAtMinute: 690, multiplier: 3 };
    const first = planAsteroidHour({ ...plain, activePlayers: 10, showers: [shower] });
    expect(first).toEqual([
      { fromMinute: 600, untilMinute: 630, count: 5, frontCount: 0 },
      { fromMinute: 630, untilMinute: 660, count: 15, frontCount: 5 },
    ]);
    const second = planAsteroidHour({
      ...plain,
      hourStartsAtMinute: 660,
      spawnFromMinute: 660,
      activePlayers: 10,
      showers: [shower],
    });
    expect(second).toEqual([
      { fromMinute: 660, untilMinute: 690, count: 15, frontCount: 0 },
      { fromMinute: 690, untilMinute: 720, count: 5, frontCount: 0 },
    ]);
  });

  it('pays a late hour only for the minutes it has left', () => {
    const lanes = planAsteroidHour({ ...plain, spawnFromMinute: 620, activePlayers: 30 });
    expect(lanes).toEqual([{ fromMinute: 620, untilMinute: 660, count: 20, frontCount: 0 }]);
    expect(planAsteroidHour({ ...plain, spawnFromMinute: 660, activePlayers: 30 })).toEqual([]);
  });

  it('stops at the season’s end', () => {
    const lanes = planAsteroidHour({ ...plain, seasonEndsAtMinute: 615, activePlayers: 20 });
    expect(lanes).toEqual([{ fromMinute: 600, untilMinute: 615, count: 5, frontCount: 0 }]);
  });

  it('ignores a shower that ended before the hour or opens after it', () => {
    const lanes = planAsteroidHour({
      ...plain,
      activePlayers: 5,
      showers: [
        { startsAtMinute: 500, endsAtMinute: 600, multiplier: 10 },
        { startsAtMinute: 660, endsAtMinute: 720, multiplier: 10 },
      ],
    });
    expect(lanes).toEqual([{ fromMinute: 600, untilMinute: 660, count: 5, frontCount: 0 }]);
  });

  it('refuses a count it cannot trust', () => {
    for (const activePlayers of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => planAsteroidHour({ ...plain, activePlayers })).toThrow(RangeError);
    }
    expect(() => planAsteroidHour({
      ...plain,
      activePlayers: ASTEROID_DYNAMIC.indexSpanPerHour,
      showers: [{ startsAtMinute: 600, endsAtMinute: 660, multiplier: 15 }],
    })).toThrow(/index span/i);
  });
});

describe('generating one hour', () => {
  const lanes: AsteroidHourLane[] = [
    { fromMinute: 4 * 1440 + 600, untilMinute: 4 * 1440 + 630, count: 40, frontCount: 0 },
    { fromMinute: 4 * 1440 + 630, untilMinute: 4 * 1440 + 660, count: 120, frontCount: 40 },
  ];
  const hour = (seed = 7, over: Partial<Parameters<typeof generateAsteroidHour>[0]> = {}) =>
    generateAsteroidHour({ hourOrdinal: 106, lanes, rng: mulberry32(seed), isotopeSeed: 99, ...over });

  it('makes exactly the planned rocks, with their own index range', () => {
    const rocks = hour();
    expect(rocks).toHaveLength(160);
    expect(rocks.map((rock) => rock.index))
      .toEqual([...Array(160).keys()].map((offset) => dynamicAsteroidIndex(106, offset)));
    for (const rock of rocks) expect(dynamicAsteroidHourOf(rock.index)).toBe(106);
  });

  it('keeps every rock inside its lane, and the front inside its opening minutes', () => {
    const rocks = hour();
    const first = rocks.slice(0, 40);
    const second = rocks.slice(40);
    for (const rock of first) {
      expect(rock.appearsAt).toBeGreaterThanOrEqual(lanes[0]!.fromMinute);
      expect(rock.appearsAt).toBeLessThan(lanes[0]!.untilMinute);
    }
    for (const rock of second) {
      expect(rock.appearsAt).toBeGreaterThanOrEqual(lanes[1]!.fromMinute);
      expect(rock.appearsAt).toBeLessThan(lanes[1]!.untilMinute);
    }
    for (const rock of second.slice(0, 40)) {
      expect(rock.appearsAt).toBeLessThan(lanes[1]!.fromMinute + ASTEROID_SHOWER_FRONT_LOAD.minutes);
    }
  });

  it('arrives at random instants rather than on an even grid', () => {
    const gaps = hour().slice(0, 40).map((rock) => rock.appearsAt).sort((a, b) => a - b)
      .slice(1).map((at, index, sorted) => at - (index === 0 ? at : sorted[index - 1]!));
    expect(new Set(gaps.map((gap) => gap.toFixed(3))).size).toBeGreaterThan(10);
  });

  it('is the same hour every time it is derived, and a different one from another stream', () => {
    expect(hour(7)).toEqual(hour(7));
    expect(hour(8)).not.toEqual(hour(7));
  });

  it('pays the level table, whole packets, no monthly cap', () => {
    for (const rock of hour()) {
      expect(rock.ore).toBe(GALAXY.asteroidOreByLevel[rock.level]);
      expect(rock.ore % GALAXY.asteroidOreQuantum).toBe(0);
      expect(rock.expiresAt - rock.appearsAt).toBeGreaterThanOrEqual(GALAXY.asteroidLifeHoursMin * HOUR);
      expect(rock.expiresAt - rock.appearsAt).toBeLessThanOrEqual(GALAXY.asteroidLifeHoursMax * HOUR);
      expect(rock.radius).toBeGreaterThanOrEqual(GALAXY.asteroidOrbitMin);
      expect(rock.radius).toBeLessThanOrEqual(GALAXY.asteroidOrbitMax);
    }
  });

  it('holds each day’s rocks under that day’s top rung', () => {
    const levelsOnDay = (day: number): Set<number> => {
      const rocks = generateAsteroidHour({
        hourOrdinal: day * 24,
        lanes: [{ fromMinute: day * 1440, untilMinute: day * 1440 + 60, count: 2_000, frontCount: 0 }],
        rng: mulberry32(1000 + day),
        isotopeSeed: 5,
      });
      return new Set(rocks.map((rock) => rock.level));
    };
    expect(levelsOnDay(0)).toEqual(new Set([1, 2]));
    expect(levelsOnDay(1)).toEqual(new Set([1, 2, 3]));
    expect(levelsOnDay(2)).toEqual(new Set([1, 2, 3, 4]));
    expect(levelsOnDay(3)).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('never names a legacy index as a dynamic hour', () => {
    expect(dynamicAsteroidHourOf(0)).toBeNull();
    expect(dynamicAsteroidHourOf(ASTEROID_DYNAMIC.indexBase - 1)).toBeNull();
    expect(dynamicAsteroidHourOf(ASTEROID_DYNAMIC.indexBase)).toBe(0);
    expect(() => dynamicAsteroidIndex(-1, 0)).toThrow(RangeError);
    expect(() => dynamicAsteroidIndex(0, ASTEROID_DYNAMIC.indexSpanPerHour)).toThrow(RangeError);
    // The highest index of a thirty-day season still fits a Postgres integer.
    expect(dynamicAsteroidIndex(31 * 24, ASTEROID_DYNAMIC.indexSpanPerHour - 1))
      .toBeLessThan(2 ** 31);
  });
});
