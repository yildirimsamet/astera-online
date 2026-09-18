import { describe, expect, it } from 'vitest';
import {
  MULTI_WORLD,
  PIRATE,
  dynamicPirateHourOf,
  dynamicPirateIndex,
  generatePirateHour,
  mulberry32,
  pirateHoard,
  planPirateHour,
} from '../src/index.js';

/**
 * PIRATES PER ACTIVE COMMANDER. Owner instruction, 2026-09-19: *"korsan filo spawn
 * oranını asteroid spawn oranı gibi aktif oyuncu sayısı ile orantılı yapsak"* —
 * 0.25 a commander an hour, and never fewer than one an hour.
 */

const hour = (activePlayers: number, overrides: Partial<Parameters<typeof planPirateHour>[0]> = {}) =>
  planPirateHour({
    activePlayers,
    hourStartsAtMinute: 600,
    spawnFromMinute: 600,
    seasonEndsAtMinute: 99_999,
    ...overrides,
  });

describe('the dynamic pirate rate', () => {
  it('is the owner’s quarter of a pirate per active commander, with a floor of one', () => {
    expect(PIRATE.dynamic.perActivePlayerPerHour).toBe(0.25);
    expect(PIRATE.dynamic.floorPerHour).toBe(1);
  });

  it('starts with the ruleset that introduces it, and every new season is on it', () => {
    expect(MULTI_WORLD.dynamicPirateRulesetVersion).toBe(9);
    expect(MULTI_WORLD.rulesetVersion).toBeGreaterThanOrEqual(MULTI_WORLD.dynamicPirateRulesetVersion);
  });

  it.each([
    [200, 50],
    [60, 15],
    [10, 3],
    [4, 1],
    [1, 1],
    [0, 1],
  ])('spawns for %i active commanders %i pirates across a whole hour', (active, count) => {
    expect(hour(active)).toEqual({ fromMinute: 600, untilMinute: 660, count });
  });

  it('pays a late hour only for what is left of it, and still at least one', () => {
    expect(hour(200, { spawnFromMinute: 630 })).toEqual({ fromMinute: 630, untilMinute: 660, count: 25 });
    expect(hour(0, { spawnFromMinute: 650 })).toEqual({ fromMinute: 650, untilMinute: 660, count: 1 });
  });

  it('never spawns past the end of the season', () => {
    expect(hour(200, { seasonEndsAtMinute: 630 })).toEqual({ fromMinute: 600, untilMinute: 630, count: 25 });
    expect(hour(200, { seasonEndsAtMinute: 600 })).toBeNull();
    expect(hour(200, { spawnFromMinute: 660 })).toBeNull();
  });

  it.each([-1, 1.5, Number.NaN])('refuses %s active commanders', (active) => {
    expect(() => hour(active)).toThrow(RangeError);
  });

  it('refuses an hour its index span cannot hold', () => {
    const tooMany = Math.ceil(PIRATE.dynamic.indexSpanPerHour / PIRATE.dynamic.perActivePlayerPerHour) + 4;
    expect(() => hour(tooMany)).toThrow(RangeError);
  });
});

describe('the dynamic pirate index', () => {
  it('gives every hour its own span above every derived lane', () => {
    expect(dynamicPirateIndex(0, 0)).toBe(PIRATE.dynamic.indexBase);
    expect(dynamicPirateIndex(3, 7)).toBe(PIRATE.dynamic.indexBase + 3 * PIRATE.dynamic.indexSpanPerHour + 7);
    expect(dynamicPirateHourOf(dynamicPirateIndex(3, 7))).toBe(3);
    expect(dynamicPirateHourOf(dynamicPirateIndex(3, PIRATE.dynamic.indexSpanPerHour - 1))).toBe(3);
  });

  it('says a derived-lane index belongs to no hour', () => {
    expect(dynamicPirateHourOf(0)).toBeNull();
    expect(dynamicPirateHourOf(PIRATE.dynamic.indexBase - 1)).toBeNull();
    expect(dynamicPirateHourOf(-3)).toBeNull();
    expect(dynamicPirateHourOf(1.5)).toBeNull();
  });

  it.each([[-1, 0], [0, -1], [0, PIRATE.dynamic.indexSpanPerHour], [0.5, 0]])(
    'refuses hour %s offset %s',
    (hourOrdinal, offset) => {
      expect(() => dynamicPirateIndex(hourOrdinal, offset)).toThrow(RangeError);
    },
  );

  it('fits a thirty-day season inside a Postgres integer', () => {
    expect(dynamicPirateIndex(30 * 24, PIRATE.dynamic.indexSpanPerHour - 1)).toBeLessThan(2 ** 31);
  });
});

describe('the pirates of one stored hour', () => {
  const lane = { fromMinute: 600, untilMinute: 660, count: 12 };
  const generate = (seed: number) => generatePirateHour({ hourOrdinal: 10, lane, rng: mulberry32(seed) });

  it('is every pirate the hour was sized for, in index order', () => {
    const pirates = generate(1);
    expect(pirates.map((p) => p.index)).toEqual(
      Array.from({ length: 12 }, (_, i) => dynamicPirateIndex(10, i)),
    );
  });

  it('is the same pirates every time the same hour is read', () => {
    expect(generate(5)).toEqual(generate(5));
    expect(generate(5)).not.toEqual(generate(6));
  });

  it('appears inside its hour and lives the lane’s two to four hours', () => {
    for (const pirate of generate(2)) {
      expect(pirate.appearsAt).toBeGreaterThanOrEqual(600);
      expect(pirate.appearsAt).toBeLessThan(660);
      const lifeHours = (pirate.expiresAt - pirate.appearsAt) / 60;
      expect(lifeHours).toBeGreaterThanOrEqual(PIRATE.lifeHoursMin);
      expect(lifeHours).toBeLessThanOrEqual(PIRATE.lifeHoursMax);
    }
  });

  it('is built exactly like a derived pirate: its orbit band, its roster, its hoard', () => {
    for (const pirate of generate(3)) {
      expect(pirate.radius).toBeGreaterThanOrEqual(PIRATE.orbitMin);
      expect(pirate.radius).toBeLessThanOrEqual(PIRATE.orbitMax);
      expect(pirate.speed).toBeGreaterThanOrEqual(PIRATE.speedMin);
      expect(pirate.speed).toBeLessThanOrEqual(PIRATE.speedMax);
      expect(pirate.period).toBeCloseTo((2 * Math.PI * pirate.radius) / pirate.speed, 9);
      expect([1, 2, 3, 4]).toContain(pirate.level);
      expect(pirate.hoard).toEqual(pirateHoard(pirate.roster));
    }
  });

  it('generates nothing for an empty hour', () => {
    expect(generatePirateHour({ hourOrdinal: 0, lane: { ...lane, count: 0 }, rng: mulberry32(1) })).toEqual([]);
  });
});
