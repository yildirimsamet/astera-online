import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  GALAXY_EVENTS,
  GALAXY_EVENT_KINDS,
  GALAXY,
  INTERGALACTIC_CONVOY,
  MULTI_WORLD,
  assertMutuallyExclusiveEventWindows,
  galaxyEventConfigForRuleset,
  galaxyEventKindsForRuleset,
  generateAsteroidSchedule,
  generateGalaxyEventSchedule,
  mulberry32,
  plannedEffectFor,
  withAsteroidShowerLanes,
  type AsteroidSpec,
  type GalaxyEventKind,
  type PlannedGalaxyEvent,
  type Rng,
} from '../src/index.js';

const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;
// 2026-09-02 00:00 in Türkiye (UTC+03:00).
const TURKEY_MIDNIGHT_UNIX_MINUTE = Date.parse('2026-09-01T21:00:00.000Z') / MINUTE;
const LEGACY_GALAXY_EVENTS = galaxyEventConfigForRuleset(7);
const legacySchedule = (input: Parameters<typeof generateGalaxyEventSchedule>[0]) =>
  generateGalaxyEventSchedule({
    ...input,
    config: input.config ?? LEGACY_GALAXY_EVENTS,
    kinds: input.kinds ?? galaxyEventKindsForRuleset(7),
  });
const LEGACY_SHOWER_DEFINITION = LEGACY_GALAXY_EVENTS.definitions.ASTEROID_SHOWER;
if (LEGACY_SHOWER_DEFINITION.schedule !== 'RANDOM_DAILY') {
  throw new Error('legacy shower config must be random');
}
const LEGACY_TRADE_DEFINITION = LEGACY_GALAXY_EVENTS.definitions.TRADE_SHIP;
if (LEGACY_TRADE_DEFINITION.schedule !== 'RANDOM_DAILY') {
  throw new Error('legacy trade config must be random');
}

/**
 * One independent stream per kind, memoised because `rngFor` is asked once per
 * kind and a fresh generator each time would replan the same draws.
 *
 * The ASTEROID_SHOWER stream is `mulberry32(seed)` UNSHIFTED on purpose: that is
 * the exact single stream the single-kind generator consumed, so every shower
 * assertion below is the same calendar it has always asserted.
 */
const streamsFrom = (seed: number): ((kind: GalaxyEventKind) => Rng) => {
  const made = new Map<GalaxyEventKind, Rng>();
  return (kind) => {
    const existing = made.get(kind);
    if (existing) return existing;
    const stream = mulberry32(kind === 'ASTEROID_SHOWER' ? seed : (seed ^ 0x7ade5) >>> 0);
    made.set(kind, stream);
    return stream;
  };
};

const onlyKind = (
  schedule: readonly PlannedGalaxyEvent[],
  kind: GalaxyEventKind,
): PlannedGalaxyEvent[] => schedule.filter((event) => event.kind === kind);

describe('galaxy event calendar', () => {
  it('ships the requested Asteroid Shower production defaults', () => {
    expect(LEGACY_GALAXY_EVENTS.definitions.ASTEROID_SHOWER).toMatchObject({
      dailyCount: { min: 5, max: 5 },
    });
    expect(LEGACY_GALAXY_EVENTS.calendar.timeZone).toBe('Europe/Istanbul');
    expect(LEGACY_GALAXY_EVENTS.calendar.utcOffsetMinutes).toBe(180);
    expect(LEGACY_GALAXY_EVENTS.calendar.lowPriorityWindow).toMatchObject({
      startsAtLocalMinute: 0,
      endsAtLocalMinute: 8 * 60,
      targetShare: 0.2,
      maxDailyCount: 2,
    });
    expect(LEGACY_GALAXY_EVENTS.definitions.ASTEROID_SHOWER).toMatchObject({
      durationMinutes: 60,
      repeatCooldownMinutes: 120,
      effect: { asteroidSpawnMultiplier: 10 },
      nightEffect: { asteroidSpawnMultiplier: 5 },
    });
  });

  /**
   * TEN BY DAY, FIVE AT NIGHT. D178, owner instruction.
   *
   * The multiplier has always been per OCCURRENCE — a frozen snapshot on the row,
   * which is why it can differ between two showers of the same season at all — so
   * this is a stamping rule and not a new mechanism. The night it reads is the
   * calendar's OWN `lowPriorityWindow`, the same 00:00–08:00 that already decides
   * how rarely a shower is scheduled there; inventing a third definition of night
   * beside that one and the merchant's would be two rules where one will do.
   */
  it('stamps the night figure on a night shower and the day figure on the rest', () => {
    const schedule = legacySchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 14 * DAY_MINUTES,
      rngFor: streamsFrom(0x51a7),
      kinds: ['ASTEROID_SHOWER'],
    });

    const night: number[] = [];
    const day: number[] = [];
    for (const event of schedule) {
      const local = ((event.startsAtMinute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
      const isNight = local >= 0 && local < 8 * 60;
      (isNight ? night : day).push(
        event.kind === 'ASTEROID_SHOWER' ? event.effect.asteroidSpawnMultiplier : NaN,
      );
    }
    // Both sets must be non-empty, or this passes by finding nothing to check.
    expect(night.length).toBeGreaterThan(0);
    expect(day.length).toBeGreaterThan(0);
    expect(new Set(night)).toEqual(new Set([5]));
    expect(new Set(day)).toEqual(new Set([10]));
  });

  /**
   * THE EFFECT NEVER TOUCHES THE STREAM, AND THIS IS WHAT PROVES IT. D149 · D178.
   *
   * A shower's start instants are drawn before any effect is stamped, so changing
   * either figure must move no window by a single minute — the property the whole
   * "byte-identical stream" rule depends on, and the one that makes a mid-season
   * change to the multiplier a safe operation rather than a re-deal.
   */
  it('draws the same windows whatever the two multipliers are', () => {
    const plan = (effect: number, nightEffect: number) => legacySchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 14 * DAY_MINUTES,
      rngFor: streamsFrom(0x51a7),
      kinds: ['ASTEROID_SHOWER'],
      config: {
        ...LEGACY_GALAXY_EVENTS,
        definitions: {
          ...LEGACY_GALAXY_EVENTS.definitions,
          ASTEROID_SHOWER: {
            ...LEGACY_SHOWER_DEFINITION,
            effect: { asteroidSpawnMultiplier: effect },
            nightEffect: { asteroidSpawnMultiplier: nightEffect },
          },
        },
      },
    }).map((event) => [event.startsAtMinute, event.endsAtMinute].join(':'));

    expect(plan(10, 5)).toEqual(plan(2, 1.5));
    expect(plan(10, 5)).toEqual(plan(97, 96));
  });

  /** A night figure is an effect like any other, and is refused on the same rule. */
  it('refuses a night multiplier that is not a multiplier', () => {
    expect(() => legacySchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: DAY_MINUTES,
      rngFor: streamsFrom(1),
      kinds: ['ASTEROID_SHOWER'],
      config: {
        ...LEGACY_GALAXY_EVENTS,
        definitions: {
          ...LEGACY_GALAXY_EVENTS.definitions,
          ASTEROID_SHOWER: {
            ...LEGACY_SHOWER_DEFINITION,
            nightEffect: { asteroidSpawnMultiplier: 1 },
          },
        },
      },
    })).toThrow(/multiplier/i);
  });

  it('plans exactly five events per full Türkiye day with one or at most two at night', () => {
    const schedule = legacySchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 14 * DAY_MINUTES,
      rngFor: streamsFrom(0x51a7),
      kinds: ['ASTEROID_SHOWER'],
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
      kinds: ['ASTEROID_SHOWER'] as const,
    };
    const first = legacySchedule({ ...input, rngFor: streamsFrom(9441) });
    const second = legacySchedule({ ...input, rngFor: streamsFrom(9441) });

    expect(second).toEqual(first);
    for (let index = 1; index < first.length; index += 1) {
      const previous = first[index - 1]!;
      const current = first[index]!;
      expect(current.startsAtMinute).toBeGreaterThanOrEqual(
        previous.endsAtMinute
          + LEGACY_SHOWER_DEFINITION.repeatCooldownMinutes,
      );
    }
  });

  it('keeps a 14-day arbitrary-start season at seventy occurrences', () => {
    for (const [offset, seed] of [[3 * 60, 91], [11 * 60 + 17, 291]] as const) {
      const schedule = legacySchedule({
        seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE + offset,
        seasonDurationMinutes: 14 * DAY_MINUTES,
        rngFor: streamsFrom(seed),
        kinds: ['ASTEROID_SHOWER'],
      });

      expect(schedule).toHaveLength(70);
      expect(schedule.every((event) => event.startsAtMinute >= 0)).toBe(true);
      expect(schedule.every((event) => event.endsAtMinute <= 14 * DAY_MINUTES)).toBe(true);
    }
  });

  it('rejects an impossible calendar instead of silently dropping events', () => {
    expect(() => legacySchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: DAY_MINUTES,
      rngFor: streamsFrom(1),
      config: {
        ...LEGACY_GALAXY_EVENTS,
        definitions: {
          ...LEGACY_GALAXY_EVENTS.definitions,
          ASTEROID_SHOWER: {
            ...LEGACY_SHOWER_DEFINITION,
            repeatCooldownMinutes: DAY_MINUTES,
          },
        },
      },
    })).toThrow(/Unable to schedule galaxy events/);
  });

  it('rejects an impossible TRADE_SHIP calendar too, rather than dropping one', () => {
    // The fail-closed rule is per kind, not a property of the one kind that had
    // it first: a lane that cannot be packed is a bug, never a shorter calendar.
    expect(() => legacySchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: DAY_MINUTES,
      rngFor: streamsFrom(1),
      kinds: ['TRADE_SHIP'],
      config: {
        ...LEGACY_GALAXY_EVENTS,
        definitions: {
          ...LEGACY_GALAXY_EVENTS.definitions,
          TRADE_SHIP: {
            ...LEGACY_TRADE_DEFINITION,
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

/**
 * THE SECOND KIND, AND THE PROOF THAT ADDING IT MOVED NOTHING. D156.
 *
 * A galaxy-event calendar is dealt once at season creation and persisted, so a
 * change to the generator that silently re-deals the Asteroid Shower would not
 * fail anywhere — it would just quietly be a different season. Planning one kind
 * at a time from its own stream, showers first, is what makes that impossible,
 * and the first test here is the assertion that says so.
 */
describe('a multi-kind calendar', () => {
  it('deals the same shower calendar whether or not trade ships are planned', () => {
    for (const [offset, seed] of [[0, 0x51a7], [3 * 60, 91], [11 * 60 + 17, 291]] as const) {
      const input = {
        seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE + offset,
        seasonDurationMinutes: 14 * DAY_MINUTES,
      };
      const showerOnly = legacySchedule({
        ...input,
        rngFor: streamsFrom(seed),
        kinds: ['ASTEROID_SHOWER'],
      });
      const both = legacySchedule({ ...input, rngFor: streamsFrom(seed) });

      expect(onlyKind(both, 'ASTEROID_SHOWER')).toEqual(showerOnly);
      expect(onlyKind(both, 'TRADE_SHIP').length).toBeGreaterThan(0);
    }
  });

  it('defaults to every kind the ruleset has', () => {
    const schedule = generateGalaxyEventSchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 2 * DAY_MINUTES,
      rngFor: streamsFrom(12),
    });
    expect(new Set(schedule.map((event) => event.kind)))
      .toEqual(new Set(['ASTEROID_SHOWER', 'TRADE_SHIP', 'INTERGALACTIC_CONVOY']));
  });

  it('seeds a shower-only calendar for a season that predates the trade ship', () => {
    // The ruleset-4 path: an existing season is entitled to the shower and to
    // nothing else, and asks for exactly that.
    const schedule = legacySchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 14 * DAY_MINUTES,
      rngFor: streamsFrom(64),
      kinds: ['ASTEROID_SHOWER'],
    });
    expect(schedule).toHaveLength(70);
    expect(schedule.every((event) => event.kind === 'ASTEROID_SHOWER')).toBe(true);
  });

  it('numbers each kind from zero in its own start order', () => {
    const schedule = legacySchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE + 137,
      seasonDurationMinutes: 5 * DAY_MINUTES,
      rngFor: streamsFrom(555),
    });
    for (const kind of ['ASTEROID_SHOWER', 'TRADE_SHIP'] as const) {
      const rows = onlyKind(schedule, kind);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.map((event) => event.sequence)).toEqual(rows.map((_, index) => index));
      for (let index = 1; index < rows.length; index += 1) {
        expect(rows[index]!.startsAtMinute).toBeGreaterThan(rows[index - 1]!.startsAtMinute);
      }
    }
  });

  it('lets the two kinds overlap, because packing both without that is pointless', () => {
    // `mutuallyExclusive` is empty on purpose. A merchant in the sky during a
    // shower costs the design nothing and buys the packer 720 free minutes a day.
    expect(GALAXY_EVENTS.mutuallyExclusive).toHaveLength(0);
    let overlaps = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const schedule = legacySchedule({
        seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
        seasonDurationMinutes: 14 * DAY_MINUTES,
        rngFor: streamsFrom(seed),
      });
      for (const shower of onlyKind(schedule, 'ASTEROID_SHOWER')) {
        for (const trade of onlyKind(schedule, 'TRADE_SHIP')) {
          if (shower.startsAtMinute < trade.endsAtMinute
            && trade.startsAtMinute < shower.endsAtMinute) overlaps += 1;
        }
      }
    }
    expect(overlaps).toBeGreaterThan(0);
  });

  it('plans three trade ships a full Türkiye day at their own cooldown', () => {
    /*
      THE PACKING PROOF, MEASURED OVER SEEDS RATHER THAN ARGUED.

      Four starts at a 240-minute minimum gap need a 960-minute span inside a
      1,440-minute day, and the shower's five starts at a 180-minute gap need 720
      of their own. Both fit independently, which is why the two lanes never have
      to negotiate. The season-boundary fragments are where the generator's
      bounded whole-season retry earns its keep, so an arbitrary start offset is
      swept here rather than a tidy midnight one.
    */
    const definition = LEGACY_TRADE_DEFINITION;
    const gap = definition.durationMinutes + definition.repeatCooldownMinutes;
    for (const [offset, seed] of [
      [0, 11], [3 * 60, 12], [11 * 60 + 17, 13], [19 * 60 + 43, 14], [187.5, 15],
    ] as const) {
      const schedule = legacySchedule({
        seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE + offset,
        seasonDurationMinutes: 14 * DAY_MINUTES,
        rngFor: streamsFrom(seed),
      });
      const trades = onlyKind(schedule, 'TRADE_SHIP');

      // Largest-remainder allocation: fourteen days at four a day, whole or split.
      expect(trades).toHaveLength(56);
      for (const event of trades) {
        expect(event.endsAtMinute - event.startsAtMinute).toBe(definition.durationMinutes);
        expect(event.startsAtMinute).toBeGreaterThanOrEqual(0);
        expect(event.endsAtMinute).toBeLessThanOrEqual(14 * DAY_MINUTES);
        expect(event.definitionVersion).toBe(definition.version);
        expect(event.effect).toEqual(definition.effect);
      }
      for (let index = 1; index < trades.length; index += 1) {
        const previous = trades[index - 1]!;
        const current = trades[index]!;
        expect(current.startsAtMinute - previous.startsAtMinute).toBeGreaterThanOrEqual(gap);
        expect(current.startsAtMinute - previous.endsAtMinute)
          .toBeGreaterThanOrEqual(definition.repeatCooldownMinutes);
      }
    }
  });

  it("keeps a trade ship's own cooldown out of the shower's arithmetic", () => {
    // A trade ship's 180-minute cooldown says nothing about a shower, and the
    // shower's 120 says nothing about a trade ship. The gap is per kind.
    const schedule = legacySchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 7 * DAY_MINUTES,
      rngFor: streamsFrom(808),
    });
    const showers = onlyKind(schedule, 'ASTEROID_SHOWER');
    const showerGap = LEGACY_SHOWER_DEFINITION.durationMinutes
      + LEGACY_SHOWER_DEFINITION.repeatCooldownMinutes;
    let tight = 0;
    for (let index = 1; index < showers.length; index += 1) {
      const delta = showers[index]!.startsAtMinute - showers[index - 1]!.startsAtMinute;
      expect(delta).toBeGreaterThanOrEqual(showerGap);
      if (delta < 360) tight += 1;
    }
    // Proof the shower is not silently paying the trade ship's larger gap.
    expect(tight).toBeGreaterThan(0);
  });
});

describe('the ruleset-8 fixed public-event calendar', () => {
  const convoyWindowAt = (index: number) => {
    const window = GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows[index];
    if (window === undefined) throw new Error(`missing convoy window ${String(index)}`);
    return window;
  };

  const currentDay = () => generateGalaxyEventSchedule({
    seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
    seasonDurationMinutes: DAY_MINUTES,
    rngFor: (kind) => {
      throw new Error(`fixed kind ${kind} must not request an RNG stream`);
    },
  });

  it('appends the Intergalactic Convoy kind without moving the existing order', () => {
    expect(GALAXY_EVENT_KINDS).toEqual([
      'ASTEROID_SHOWER',
      'TRADE_SHIP',
      'INTERGALACTIC_CONVOY',
    ]);
  });

  it('makes the fixed convoy calendar the boundary for newly created seasons', () => {
    expect(MULTI_WORLD.rulesetVersion).toBe(8);
    expect(GALAXY_EVENTS.version).toBe(4);
    expect(galaxyEventConfigForRuleset(MULTI_WORLD.rulesetVersion)).toBe(GALAXY_EVENTS);
    expect(galaxyEventKindsForRuleset(MULTI_WORLD.rulesetVersion)).toEqual([
      'ASTEROID_SHOWER',
      'TRADE_SHIP',
      'INTERGALACTIC_CONVOY',
    ]);
    expect(galaxyEventKindsForRuleset(7)).toEqual(['ASTEROID_SHOWER', 'TRADE_SHIP']);
  });

  /**
   * THE WORKING WEEK AND THE WEEKEND ARE TWO CALENDARS. Owner instruction, 2026-09-16:
   * *"galaksi eventlerinin boku çıktı oyun çok fazla aktif farm'a döndü, kitlemiz 30-40
   * yaş çalışan insanlar bunlar eventleri yakalayamıyor."*
   *
   * Six showers and three convoys a day rewarded whoever could attend all of them.
   * The new shape is two moments a weekday — lunch and the evening — and a bigger
   * pair on Saturday and Sunday, when the audience is actually free.
   */
  it('versions both reshaped lanes so a dealt row says which calendar it came from', () => {
    expect(GALAXY_EVENTS.definitions.ASTEROID_SHOWER.version).toBe(7);
    expect(GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.version).toBe(4);
    // The merchant was left exactly as it was.
    expect(GALAXY_EVENTS.definitions.TRADE_SHIP.version).toBe(4);
  });

  it('deals a weekday: lunch and evening showers, one evening convoy', () => {
    // 2026-09-02 is a Wednesday.
    const rows = currentDay().map((event) => ({
      kind: event.kind,
      startsAtMinute: event.startsAtMinute,
      endsAtMinute: event.endsAtMinute,
      effect: event.effect,
    }));

    expect(rows).toEqual([
      { kind: 'TRADE_SHIP', startsAtMinute: 60, endsAtMinute: 180,
        effect: GALAXY_EVENTS.definitions.TRADE_SHIP.windows[0].effect },
      { kind: 'TRADE_SHIP', startsAtMinute: 420, endsAtMinute: 540,
        effect: GALAXY_EVENTS.definitions.TRADE_SHIP.windows[1].effect },
      { kind: 'ASTEROID_SHOWER', startsAtMinute: 750, endsAtMinute: 810,
        effect: { asteroidSpawnMultiplier: 3 } },
      { kind: 'TRADE_SHIP', startsAtMinute: 900, endsAtMinute: 1020,
        effect: GALAXY_EVENTS.definitions.TRADE_SHIP.windows[2].effect },
      { kind: 'ASTEROID_SHOWER', startsAtMinute: 1200, endsAtMinute: 1260,
        effect: { asteroidSpawnMultiplier: 10 } },
      { kind: 'TRADE_SHIP', startsAtMinute: 1260, endsAtMinute: 1380,
        effect: GALAXY_EVENTS.definitions.TRADE_SHIP.windows[3].effect },
      { kind: 'INTERGALACTIC_CONVOY', startsAtMinute: 1260, endsAtMinute: 1380,
        effect: convoyWindowAt(0).effect },
    ]);
  });

  it('deals a weekend: bigger showers and two convoys', () => {
    // 2026-09-05 is a Saturday.
    const saturday = generateGalaxyEventSchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE + 3 * DAY_MINUTES,
      seasonDurationMinutes: DAY_MINUTES,
      rngFor: (kind) => { throw new Error(`fixed kind ${kind} must not request an RNG stream`); },
    }).filter((event) => event.kind !== 'TRADE_SHIP');

    expect(saturday.map((event) => ({
      kind: event.kind,
      startsAtMinute: event.startsAtMinute,
      endsAtMinute: event.endsAtMinute,
      effect: event.effect,
    }))).toEqual([
      { kind: 'INTERGALACTIC_CONVOY', startsAtMinute: 720, endsAtMinute: 840,
        effect: convoyWindowAt(1).effect },
      { kind: 'ASTEROID_SHOWER', startsAtMinute: 780, endsAtMinute: 840,
        effect: { asteroidSpawnMultiplier: 5 } },
      { kind: 'ASTEROID_SHOWER', startsAtMinute: 1200, endsAtMinute: 1260,
        effect: { asteroidSpawnMultiplier: 15 } },
      { kind: 'INTERGALACTIC_CONVOY', startsAtMinute: 1200, endsAtMinute: 1320,
        effect: convoyWindowAt(2).effect },
    ]);
  });

  it('counts a whole week as five weekdays and a two-day weekend', () => {
    const week = generateGalaxyEventSchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 7 * DAY_MINUTES,
      rngFor: (kind) => { throw new Error(`fixed kind ${kind} must not request an RNG stream`); },
    });
    const of = (kind: GalaxyEventKind) => week.filter((event) => event.kind === kind);
    expect(of('ASTEROID_SHOWER')).toHaveLength(5 * 2 + 2 * 2);
    expect(of('INTERGALACTIC_CONVOY')).toHaveLength(5 * 1 + 2 * 2);
    expect(of('TRADE_SHIP')).toHaveLength(7 * 4);
    // Sequences stay per kind and in start order across the day-type change.
    expect(of('ASTEROID_SHOWER').map((event) => event.sequence))
      .toEqual([...Array(14).keys()]);

    const saturdayStart = 3 * DAY_MINUTES;
    const sundayEnd = 5 * DAY_MINUTES;
    const weekendShowers = of('ASTEROID_SHOWER').filter((event) =>
      event.startsAtMinute >= saturdayStart && event.startsAtMinute < sundayEnd);
    expect(weekendShowers.map((event) => event.effect)).toEqual([
      { asteroidSpawnMultiplier: 5 }, { asteroidSpawnMultiplier: 15 },
      { asteroidSpawnMultiplier: 5 }, { asteroidSpawnMultiplier: 15 },
    ]);
  });

  /**
   * THE CONVOY KEEPS ITS AUTHORED SHAPE AND PAYS DOUBLE WHAT IT DID. Owner instruction,
   * 2026-09-16: *"artık convoy -> saatlik üretim miktarının 4 katına kadar verecek."*
   *
   * Every window is still `INTERGALACTIC_CONVOY.durationMinutes` long, because the
   * route contract refuses any other duration — the formation's speed is the disc's
   * diameter over its window.
   */
  it('keeps every convoy at the route contract’s duration and caps it at four hours', () => {
    const windows = GALAXY_EVENTS.definitions.INTERGALACTIC_CONVOY.windows;
    expect(windows.map((window) => [window.days, window.startsAtLocalMinute]))
      .toEqual([['WEEKDAY', 21 * 60], ['WEEKEND', 12 * 60], ['WEEKEND', 20 * 60]]);
    for (const window of windows) {
      expect(window.endsAtLocalMinute - window.startsAtLocalMinute)
        .toBe(INTERGALACTIC_CONVOY.durationMinutes);
      expect(window.effect.resourceCapHours).toBe(4);
    }
  });

  it('authors the four shower windows the owner asked for, an hour each', () => {
    const windows = GALAXY_EVENTS.definitions.ASTEROID_SHOWER.windows;
    expect(windows.map((window) => [
      window.days,
      window.startsAtLocalMinute,
      window.endsAtLocalMinute,
      window.effect.asteroidSpawnMultiplier,
    ])).toEqual([
      ['WEEKDAY', 12 * 60 + 30, 13 * 60 + 30, 3],
      ['WEEKDAY', 20 * 60, 21 * 60, 10],
      ['WEEKEND', 13 * 60, 14 * 60, 5],
      ['WEEKEND', 20 * 60, 21 * 60, 15],
    ]);
  });

  it('writes only complete fixed windows inside arbitrary season boundaries', () => {
    const schedule = generateGalaxyEventSchedule({
      // Wednesday 12:45 → Thursday 20:30 TRT: the first lunch shower and the second
      // evening shower are partial and must not be written.
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE + 765,
      seasonDurationMinutes: DAY_MINUTES + 465,
      kinds: ['ASTEROID_SHOWER', 'INTERGALACTIC_CONVOY'],
      rngFor: () => { throw new Error('fixed definitions do not consume RNG'); },
    });

    expect(schedule.map((event) => [event.kind, event.startsAtMinute, event.endsAtMinute]))
      .toEqual([
        ['ASTEROID_SHOWER', 435, 495],
        ['INTERGALACTIC_CONVOY', 495, 615],
        ['ASTEROID_SHOWER', 1425, 1485],
      ]);
  });

  it('matches a fixed effect only at an authored start minute on its own kind of day', () => {
    const wednesdayEvening = TURKEY_MIDNIGHT_UNIX_MINUTE + 20 * 60;
    const saturdayEvening = wednesdayEvening + 3 * DAY_MINUTES;
    expect(plannedEffectFor('ASTEROID_SHOWER', wednesdayEvening, GALAXY_EVENTS))
      .toEqual({ asteroidSpawnMultiplier: 10 });
    expect(plannedEffectFor('ASTEROID_SHOWER', saturdayEvening, GALAXY_EVENTS))
      .toEqual({ asteroidSpawnMultiplier: 15 });
    expect(() => plannedEffectFor('ASTEROID_SHOWER', wednesdayEvening + 1, GALAXY_EVENTS))
      .toThrow(/exact fixed start/i);
    // 13:00 is a weekend window and 12:30 a weekday one; neither exists on the other.
    expect(() => plannedEffectFor(
      'ASTEROID_SHOWER', TURKEY_MIDNIGHT_UNIX_MINUTE + 13 * 60, GALAXY_EVENTS,
    )).toThrow(/exact fixed start/i);
    expect(() => plannedEffectFor(
      'ASTEROID_SHOWER', TURKEY_MIDNIGHT_UNIX_MINUTE + 3 * DAY_MINUTES + 12 * 60 + 30, GALAXY_EVENTS,
    )).toThrow(/exact fixed start/i);
    // Sunday is a weekend day as well as Saturday.
    expect(plannedEffectFor('INTERGALACTIC_CONVOY', saturdayEvening + DAY_MINUTES, GALAXY_EVENTS)
      .resourceCapHours).toBe(4);
  });

  it('lets windows on different kinds of day share hours, and no others', () => {
    const effect = GALAXY_EVENTS.definitions.TRADE_SHIP.windows[0].effect;
    const withWindows = (windows: readonly {
      days?: 'WEEKDAY' | 'WEEKEND';
      startsAtLocalMinute: number;
      endsAtLocalMinute: number;
      effect: typeof effect;
    }[]) => () => generateGalaxyEventSchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 7 * DAY_MINUTES,
      rngFor: streamsFrom(1),
      config: {
        ...GALAXY_EVENTS,
        definitions: {
          ...GALAXY_EVENTS.definitions,
          TRADE_SHIP: { ...GALAXY_EVENTS.definitions.TRADE_SHIP, windows },
        },
      },
    });

    expect(withWindows([
      { days: 'WEEKDAY', startsAtLocalMinute: 60, endsAtLocalMinute: 180, effect },
      { days: 'WEEKEND', startsAtLocalMinute: 60, endsAtLocalMinute: 180, effect },
    ])).not.toThrow();
    expect(withWindows([
      { days: 'WEEKDAY', startsAtLocalMinute: 60, endsAtLocalMinute: 180, effect },
      { days: 'WEEKDAY', startsAtLocalMinute: 120, endsAtLocalMinute: 240, effect },
    ])).toThrow(/fixed windows cannot overlap/i);
    // A window with no day restriction runs every day, so it overlaps both.
    expect(withWindows([
      { startsAtLocalMinute: 60, endsAtLocalMinute: 180, effect },
      { days: 'WEEKEND', startsAtLocalMinute: 120, endsAtLocalMinute: 240, effect },
    ])).toThrow(/fixed windows cannot overlap/i);
  });

  it('rejects wrapping, overlapping, fractional and out-of-day fixed windows', () => {
    const invalidWindows = [
      [{ startsAtLocalMinute: 60, endsAtLocalMinute: 60,
        effect: GALAXY_EVENTS.definitions.TRADE_SHIP.windows[0].effect }],
      [{ startsAtLocalMinute: 1380, endsAtLocalMinute: 60,
        effect: GALAXY_EVENTS.definitions.TRADE_SHIP.windows[0].effect }],
      [{ startsAtLocalMinute: 1.5, endsAtLocalMinute: 60,
        effect: GALAXY_EVENTS.definitions.TRADE_SHIP.windows[0].effect }],
      [{ startsAtLocalMinute: 60, endsAtLocalMinute: 1441,
        effect: GALAXY_EVENTS.definitions.TRADE_SHIP.windows[0].effect }],
      [
        { startsAtLocalMinute: 60, endsAtLocalMinute: 180,
          effect: GALAXY_EVENTS.definitions.TRADE_SHIP.windows[0].effect },
        { startsAtLocalMinute: 179, endsAtLocalMinute: 240,
          effect: GALAXY_EVENTS.definitions.TRADE_SHIP.windows[0].effect },
      ],
    ] as const;

    for (const windows of invalidWindows) {
      expect(() => generateGalaxyEventSchedule({
        seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
        seasonDurationMinutes: DAY_MINUTES,
        rngFor: streamsFrom(1),
        config: {
          ...GALAXY_EVENTS,
          definitions: {
            ...GALAXY_EVENTS.definitions,
            TRADE_SHIP: { ...GALAXY_EVENTS.definitions.TRADE_SHIP, windows },
          },
        },
      })).toThrow(/fixed window/i);
    }
  });

  it('keeps frozen calendar shapes for old rulesets and gates kinds by their first boundary', () => {
    expect(galaxyEventKindsForRuleset(3)).toEqual([]);
    expect(galaxyEventKindsForRuleset(4)).toEqual(['ASTEROID_SHOWER']);
    expect(galaxyEventKindsForRuleset(5)).toEqual(['ASTEROID_SHOWER', 'TRADE_SHIP']);
    expect(galaxyEventKindsForRuleset(7)).toEqual(['ASTEROID_SHOWER', 'TRADE_SHIP']);
    expect(galaxyEventKindsForRuleset(8)).toEqual(GALAXY_EVENT_KINDS);

    expect(galaxyEventConfigForRuleset(4).definitions.TRADE_SHIP.schedule).toBe('RANDOM_DAILY');
    expect(galaxyEventConfigForRuleset(5).definitions.TRADE_SHIP).toMatchObject({
      schedule: 'RANDOM_DAILY',
      version: 1,
      dailyCount: { min: 3, max: 3 },
      durationMinutes: 180,
      repeatCooldownMinutes: 180,
    });
    expect(galaxyEventConfigForRuleset(7).definitions.TRADE_SHIP).toMatchObject({
      schedule: 'RANDOM_DAILY',
      version: 2,
      dailyCount: { min: 4, max: 4 },
      durationMinutes: 180,
      repeatCooldownMinutes: 60,
    });
    expect(galaxyEventConfigForRuleset(8)).toBe(GALAXY_EVENTS);
    expect(() => galaxyEventConfigForRuleset(3)).toThrow(/ruleset/i);
  });
});

describe('Asteroid Shower bonus lane', () => {
  /**
   * THE LANE FOLLOWS THE OCCURRENCE'S OWN FIGURE, never the definition's. D178.
   *
   * That was always the code's shape and it used to be untestable, because every
   * shower in a season carried the same number and the assertion could read either
   * one and pass. Now two showers of one season legitimately differ, so reading the
   * definition here would have made this test a statement about the wrong thing —
   * it failed the moment the day figure moved and the hand-built occurrence did not.
   */
  it('adds the occurrence’s own multiple of the hourly rate, and moves no existing rock', () => {
    const span = DAY_MINUTES;
    const base = generateAsteroidSchedule(mulberry32(400), span, 400);
    const occurrence: PlannedGalaxyEvent = {
      sequence: 3,
      kind: 'ASTEROID_SHOWER',
      startsAtMinute: 8 * 60,
      endsAtMinute: 9 * 60,
      definitionVersion: 2,
      effect: { asteroidSpawnMultiplier: 5 },
    };
    const showered = withAsteroidShowerLanes(base, [occurrence], 400, { span });
    const establishedCount = Math.round(10.35 * span / 60);
    const establishedBonus = Math.round(10.35 * (occurrence.effect.asteroidSpawnMultiplier - 1));
    const expandedBonus = Math.round(
      GALAXY.asteroidSpawnPerHour * (occurrence.effect.asteroidSpawnMultiplier - 1),
    );

    /*
      Both hashes are the complete pre-increase schedules, taken WITHOUT `ore` —
      see the same treatment in `invariants.test.ts`. Ore is deliberately re-priced
      by the 2026-09-14 packet rule and that ships at a season boundary; what a
      live claim, an in-flight run and a drawn target actually resolve through is
      the index, the orbit and the two instants, and those stay byte-identical.
    */
    const laneShape = (rocks: readonly AsteroidSpec[]): string => createHash('sha256')
      .update(JSON.stringify(rocks.map(({ ore: _ore, ...rest }) => rest)))
      .digest('hex');
    expect(laneShape(base.slice(0, establishedCount)))
      .toBe('69d30eb877f5a878adda1d34022bf904699c870cad58a59a40e588bb75f7b693');
    expect(laneShape(showered.slice(0, establishedCount + establishedBonus)))
      .toBe('617dc6f3c0aca9b3d129611bf2a34f5a073006d92bce2179fbfb5e8085539e5e');
    expect(showered.length - base.length).toBe(expandedBonus);
    const bonus = [
      ...showered.slice(establishedCount, establishedCount + establishedBonus),
      ...showered.slice(showered.length - (expandedBonus - establishedBonus)),
    ];
    expect(bonus.every((rock) => rock.appearsAt >= 8 * 60 && rock.appearsAt < 9 * 60)).toBe(true);
    expect(bonus.some((rock) => rock.expiresAt > 9 * 60)).toBe(true);
  });

  /**
   * TWO SHOWERS OF ONE SEASON, TWO SIZES, AND THE EARLIER ONE UNMOVED. D178.
   *
   * This is the property the day/night split rests on and the one a mid-season
   * change to a future window depends on: a lane is appended after everything
   * already in the field, so a bigger later shower adds rocks and renumbers
   * nothing before it. The reverse — changing an EARLIER lane's size — is what
   * would move every later index onto a different rock, which is why that is never
   * done to a window that has already opened.
   */
  it('sizes each shower from its own figure and never renumbers an earlier one', () => {
    const span = DAY_MINUTES;
    const base = generateAsteroidSchedule(mulberry32(511), span, 511);
    const night: PlannedGalaxyEvent = {
      sequence: 0, kind: 'ASTEROID_SHOWER',
      startsAtMinute: 3 * 60, endsAtMinute: 4 * 60,
      definitionVersion: 2, effect: { asteroidSpawnMultiplier: 5 },
    };
    const day: PlannedGalaxyEvent = {
      sequence: 1, kind: 'ASTEROID_SHOWER',
      startsAtMinute: 13 * 60, endsAtMinute: 14 * 60,
      definitionVersion: 2, effect: { asteroidSpawnMultiplier: 10 },
    };

    const both = withAsteroidShowerLanes(base, [night, day], 511, { span });
    const nightOnly = withAsteroidShowerLanes(base, [night], 511, { span });
    const nightCount = Math.round(GALAXY.asteroidSpawnPerHour * 4);
    const dayCount = Math.round(GALAXY.asteroidSpawnPerHour * 9);

    expect(nightOnly.length - base.length).toBe(nightCount);
    expect(both.length - base.length).toBe(nightCount + dayCount);
    // The day shower is worth more rocks than the night one, which is the point.
    expect(dayCount).toBeGreaterThan(nightCount);
    /*
      AND EVERY ROCK THE NIGHT LANE ALREADY OWNED KEEPS ITS INDEX. A rock's public
      id is an HMAC of that index, and claims and in-flight runs are keyed by it, so
      this equality is what makes adding to a later window safe on a live season.
    */
    const establishedCount = Math.round(10.35 * span / 60);
    const establishedNightCount = Math.round(10.35 * 4);
    expect(both.slice(0, establishedCount + establishedNightCount))
      .toEqual(nightOnly.slice(0, establishedCount + establishedNightCount));
  });

  it('ignores TRADE_SHIP rows instead of turning every trade window into a shower', () => {
    /*
      THE SILENT BREAKAGE THIS FILTER EXISTS TO PREVENT.

      The lane builder used to append a bonus rock lane for EVERY occurrence it was
      handed, which was correct while there was exactly one kind of occurrence. The
      moment a second kind enters that list, every trade window also becomes an
      asteroid shower — and nothing would have failed. The filter lives INSIDE the
      builder rather than at the call site, because a call site is a place a rule
      can be forgotten.
    */
    const span = 2 * DAY_MINUTES;
    const base = generateAsteroidSchedule(mulberry32(97), span, 97);
    const showers: PlannedGalaxyEvent[] = [
      {
        sequence: 0,
        kind: 'ASTEROID_SHOWER',
        startsAtMinute: 4 * 60,
        endsAtMinute: 5 * 60,
        definitionVersion: 1,
        effect: { asteroidSpawnMultiplier: 5 },
      },
      {
        sequence: 1,
        kind: 'ASTEROID_SHOWER',
        startsAtMinute: 14 * 60,
        endsAtMinute: 15 * 60,
        definitionVersion: 1,
        effect: { asteroidSpawnMultiplier: 5 },
      },
    ];
    const trades: PlannedGalaxyEvent[] = [
      {
        sequence: 0,
        kind: 'TRADE_SHIP',
        startsAtMinute: 60,
        endsAtMinute: 240,
        definitionVersion: 1,
        effect: { rate: { alloy: 1, crystal: 3, deuterium: 90 } },
      },
      {
        sequence: 1,
        kind: 'TRADE_SHIP',
        startsAtMinute: 10 * 60,
        endsAtMinute: 13 * 60,
        definitionVersion: 1,
        effect: { rate: { alloy: 1, crystal: 3, deuterium: 90 } },
      },
    ];

    const mixed = withAsteroidShowerLanes(
      base,
      [trades[0]!, showers[0]!, trades[1]!, showers[1]!],
      97,
      { span },
    );
    // Byte-identical to the field the shower-only calendar produces: the same
    // rocks, the same indices, the same draws in the same order.
    expect(mixed).toEqual(withAsteroidShowerLanes(base, showers, 97, { span }));
    expect(mixed.length).toBeGreaterThan(base.length);
    // And a calendar with no shower in it adds nothing at all.
    expect(withAsteroidShowerLanes(base, trades, 97, { span })).toEqual(base);
  });
});

/**
 * FOUR MERCHANTS A DAY, AND ONE OF THEM AT NIGHT. Owner instruction, D166.
 *
 * *"Ticaret gemisi günde 4 kez gelsin. 3 aktif zamanlarda 1 gece (TSİ 01:00 -
 * 08:00)"* — so the merchant stops sharing the calendar's generic quiet-hours
 * heuristic and states its own rule. The generic one is a SHARE with a ceiling
 * (`lowPriorityWindow.targetShare`, plus an `overflowWeight` coin flip), which is
 * right for a shower nobody has to attend and wrong here: "one a night" is a
 * promise to the commander who plays after midnight, and a promise that lands four
 * nights in five is not one.
 *
 * THE WINDOW IS THE MERCHANT'S OWN, TOO. The shared low-priority band opens at
 * 00:00; this one opens at 01:00, because the instruction says so and because the
 * hour either side of midnight belongs to the evening session rather than to the
 * night one.
 */
describe('the legacy ruleset-7 merchant’s four random windows a day', () => {
  const definition = LEGACY_TRADE_DEFINITION;
  const quiet = definition.quietWindow;
  if (!quiet) throw new Error('legacy trade config must have its quiet window');
  /** Minutes past local midnight for an absolute schedule minute. */
  const localMinuteOf = (startsAtMinute: number, offset: number): number => {
    const absolute = TURKEY_MIDNIGHT_UNIX_MINUTE + offset + startsAtMinute;
    const local = absolute + LEGACY_GALAXY_EVENTS.calendar.utcOffsetMinutes;
    return ((local % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  };

  it('states the rule on the definition rather than in the planner', () => {
    expect(definition.dailyCount).toEqual({ min: 4, max: 4 });
    expect(quiet.startsAtLocalMinute).toBe(60);
    expect(quiet.endsAtLocalMinute).toBe(8 * 60);
    expect(quiet.exactDailyCount).toBe(1);
  });

  it('puts exactly one of every four inside 01:00–08:00, on every whole day', () => {
    for (const [offset, seed] of [[0, 21], [5 * 60, 22], [17 * 60 + 9, 23]] as const) {
      const schedule = legacySchedule({
        seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE + offset,
        seasonDurationMinutes: 14 * DAY_MINUTES,
        rngFor: streamsFrom(seed),
      });
      const trades = onlyKind(schedule, 'TRADE_SHIP');

      const byDay = new Map<number, number[]>();
      for (const event of trades) {
        const local = localMinuteOf(event.startsAtMinute, offset);
        const day = Math.floor((event.startsAtMinute + offset) / DAY_MINUTES);
        byDay.set(day, [...(byDay.get(day) ?? []), local]);
      }
      for (const [day, locals] of byDay) {
        // Season-boundary fragments carry fewer than four; only whole days promise.
        if (locals.length !== 4) continue;
        const atNight = locals.filter(
          (local) => local >= quiet.startsAtLocalMinute && local < quiet.endsAtLocalMinute,
        );
        expect(atNight, `day ${String(day)} — starts ${locals.join(', ')}`).toHaveLength(1);
      }
    }
  });

  it('never opens one in the hour after midnight', () => {
    const schedule = legacySchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 14 * DAY_MINUTES,
      rngFor: streamsFrom(24),
    });
    for (const event of onlyKind(schedule, 'TRADE_SHIP')) {
      expect(localMinuteOf(event.startsAtMinute, 0)).toBeGreaterThanOrEqual(60);
    }
  });

  /**
   * The shower keeps the shared heuristic, and its own definition says nothing —
   * which is a fact about the TYPE as much as the value: `quietWindow` is optional
   * on `GalaxyEventDefinition`, and the shower's literal has no such key at all.
   */
  it('leaves the shower on the calendar-wide quiet-hours rule', () => {
    expect('quietWindow' in LEGACY_GALAXY_EVENTS.definitions.ASTEROID_SHOWER).toBe(false);
  });
});
