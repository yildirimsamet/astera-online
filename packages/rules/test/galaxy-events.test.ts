import { describe, expect, it } from 'vitest';
import {
  GALAXY_EVENTS,
  GALAXY,
  assertMutuallyExclusiveEventWindows,
  generateAsteroidSchedule,
  generateGalaxyEventSchedule,
  mulberry32,
  withAsteroidShowerLanes,
  type GalaxyEventKind,
  type PlannedGalaxyEvent,
  type Rng,
} from '../src/index.js';

const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;
// 2026-09-02 00:00 in Türkiye (UTC+03:00).
const TURKEY_MIDNIGHT_UNIX_MINUTE = Date.parse('2026-09-01T21:00:00.000Z') / MINUTE;

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
    expect(GALAXY_EVENTS.definitions.ASTEROID_SHOWER.dailyCount).toEqual({ min: 5, max: 5 });
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
    const first = generateGalaxyEventSchedule({ ...input, rngFor: streamsFrom(9441) });
    const second = generateGalaxyEventSchedule({ ...input, rngFor: streamsFrom(9441) });

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
        rngFor: streamsFrom(seed),
        kinds: ['ASTEROID_SHOWER'],
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
      rngFor: streamsFrom(1),
      config: {
        ...GALAXY_EVENTS,
        definitions: {
          ...GALAXY_EVENTS.definitions,
          ASTEROID_SHOWER: {
            ...GALAXY_EVENTS.definitions.ASTEROID_SHOWER,
            repeatCooldownMinutes: DAY_MINUTES,
          },
        },
      },
    })).toThrow(/Unable to schedule galaxy events/);
  });

  it('rejects an impossible TRADE_SHIP calendar too, rather than dropping one', () => {
    // The fail-closed rule is per kind, not a property of the one kind that had
    // it first: a lane that cannot be packed is a bug, never a shorter calendar.
    expect(() => generateGalaxyEventSchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: DAY_MINUTES,
      rngFor: streamsFrom(1),
      kinds: ['TRADE_SHIP'],
      config: {
        ...GALAXY_EVENTS,
        definitions: {
          ...GALAXY_EVENTS.definitions,
          TRADE_SHIP: {
            ...GALAXY_EVENTS.definitions.TRADE_SHIP,
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
      const showerOnly = generateGalaxyEventSchedule({
        ...input,
        rngFor: streamsFrom(seed),
        kinds: ['ASTEROID_SHOWER'],
      });
      const both = generateGalaxyEventSchedule({ ...input, rngFor: streamsFrom(seed) });

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
      .toEqual(new Set(['ASTEROID_SHOWER', 'TRADE_SHIP']));
  });

  it('seeds a shower-only calendar for a season that predates the trade ship', () => {
    // The ruleset-4 path: an existing season is entitled to the shower and to
    // nothing else, and asks for exactly that.
    const schedule = generateGalaxyEventSchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 14 * DAY_MINUTES,
      rngFor: streamsFrom(64),
      kinds: ['ASTEROID_SHOWER'],
    });
    expect(schedule).toHaveLength(70);
    expect(schedule.every((event) => event.kind === 'ASTEROID_SHOWER')).toBe(true);
  });

  it('numbers each kind from zero in its own start order', () => {
    const schedule = generateGalaxyEventSchedule({
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
      const schedule = generateGalaxyEventSchedule({
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
    const definition = GALAXY_EVENTS.definitions.TRADE_SHIP;
    const gap = definition.durationMinutes + definition.repeatCooldownMinutes;
    for (const [offset, seed] of [
      [0, 11], [3 * 60, 12], [11 * 60 + 17, 13], [19 * 60 + 43, 14], [187.5, 15],
    ] as const) {
      const schedule = generateGalaxyEventSchedule({
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
    const schedule = generateGalaxyEventSchedule({
      seasonStartsAtUnixMinute: TURKEY_MIDNIGHT_UNIX_MINUTE,
      seasonDurationMinutes: 7 * DAY_MINUTES,
      rngFor: streamsFrom(808),
    });
    const showers = onlyKind(schedule, 'ASTEROID_SHOWER');
    const showerGap = GALAXY_EVENTS.definitions.ASTEROID_SHOWER.durationMinutes
      + GALAXY_EVENTS.definitions.ASTEROID_SHOWER.repeatCooldownMinutes;
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
    );
    // Byte-identical to the field the shower-only calendar produces: the same
    // rocks, the same indices, the same draws in the same order.
    expect(mixed).toEqual(withAsteroidShowerLanes(base, showers, 97));
    expect(mixed.length).toBeGreaterThan(base.length);
    // And a calendar with no shower in it adds nothing at all.
    expect(withAsteroidShowerLanes(base, trades, 97)).toEqual(base);
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
describe('the merchant’s four windows a day', () => {
  const definition = GALAXY_EVENTS.definitions.TRADE_SHIP;
  const quiet = definition.quietWindow;
  /** Minutes past local midnight for an absolute schedule minute. */
  const localMinuteOf = (startsAtMinute: number, offset: number): number => {
    const absolute = TURKEY_MIDNIGHT_UNIX_MINUTE + offset + startsAtMinute;
    const local = absolute + GALAXY_EVENTS.calendar.utcOffsetMinutes;
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
      const schedule = generateGalaxyEventSchedule({
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
    const schedule = generateGalaxyEventSchedule({
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
    expect('quietWindow' in GALAXY_EVENTS.definitions.ASTEROID_SHOWER).toBe(false);
  });
});
