import { describe, expect, it } from 'vitest';
import {
  ASTEROID_SHOWER_FRONT_LOAD,
  ECONOMY_ADJUSTMENT,
  FUEL,
  GALAXY_EVENTS,
  GALAXY,
  HULLS,
  MOBILE_HULLS,
  PIRATE,
  PROSPECTOR,
  RESEARCH_MAX_LEVEL,
  RESEARCH_PROJECTS,
  RESEARCH_PROJECT_IDS,
  SALVAGE,
  SERVERS,
  buildingMinutes,
  hullFuelMass,
  instrumentCost,
  mulberry32,
  prospectorHold,
  prospectorReturnSpeed,
  prospectorSpeed,
  type InstrumentId,
  type PlannedGalaxyEvent,
} from '../src/index.js';
import {
  activeAsteroids,
  generateAsteroidSchedule,
  withAsteroidShowerLanes,
} from '../src/galaxy.js';
import { profileResearch } from '../src/economy-profile.js';
import { monthlySupply } from '../src/monthly-supply.js';
import { SEASON } from '../src/constants.js';

/**
 * THE 2026-09-14 BALANCE PACKAGE, HELD AS ONE FILE.
 *
 * Eight owner-set changes shipped together because they multiply: a cheaper
 * instrument is also a faster one (time is priced off cost), and a bigger drill
 * meeting a quantised rock is the whole point of the quantum. Each section below
 * states the rule rather than a re-typed number wherever the rule has a source to
 * compare against — `docs/balance-tempo-change-plan-2026-09-14.md` carries the
 * argument, and this file is what stops the argument drifting from the code.
 */

/** Every resource of an instrument rung, so a discount cannot be asserted per column. */
const RESOURCES = ['alloy', 'crystal', 'deuterium'] as const;

describe('the drill and the rock it meets', () => {
  it('carries 400 units bare, which is the canonical ore packet', () => {
    expect(PROSPECTOR.hold).toBe(400);
    expect(GALAXY.asteroidOreQuantum).toBe(400);
    expect(prospectorHold([], {})).toBe(400);
  });

  it('states every level of the ore table as a positive multiple of the packet', () => {
    const table = GALAXY.asteroidOreByLevel;
    expect(table).toEqual([0, 1600, 3200, 4800, 6400, 8000]);
    for (let level = 1; level < table.length; level++) {
      const ore = table[level]!;
      expect(ore % GALAXY.asteroidOreQuantum).toBe(0);
      expect(ore).toBeGreaterThan(0);
    }
  });

  it('comes home at half speed laden, not a third', () => {
    expect(PROSPECTOR.returnSpeedFactor).toBe(1 / 2);
    expect(prospectorReturnSpeed([], true)).toBe(prospectorSpeed([]) / 2);
    expect(prospectorReturnSpeed([], false)).toBe(prospectorSpeed([]));
  });
});

describe('the generated asteroid field', () => {
  const seeds = [1, 7, 42, 1234];

  it('gives every rock a positive whole number of packets', () => {
    for (const seed of seeds) {
      const field = generateAsteroidSchedule(mulberry32(seed));
      for (const rock of field) {
        expect(rock.ore % GALAXY.asteroidOreQuantum, `seed ${String(seed)} rock ${String(rock.index)}`)
          .toBe(0);
        expect(rock.ore, `seed ${String(seed)} rock ${String(rock.index)}`).toBeGreaterThan(0);
      }
    }
  });

  it('never spends more than the day it was budgeted from', () => {
    for (const seed of seeds) {
      const field = generateAsteroidSchedule(mulberry32(seed));
      for (let day = 0; day < SEASON.days; day++) {
        const today = field.filter((rock) => Math.floor(rock.appearsAt / 1440) === day);
        if (today.length === 0) continue;
        const budget = monthlySupply('mining', day, SERVERS.capacity);
        const spent = today.reduce((sum, rock) => ({
          alloy: sum.alloy + rock.ore * (1 - rock.crystalShare - rock.deuteriumShare),
          crystal: sum.crystal + rock.ore * rock.crystalShare,
          deuterium: sum.deuterium + rock.ore * rock.deuteriumShare,
        }), { alloy: 0, crystal: 0, deuterium: 0 });
        for (const resource of RESOURCES) {
          expect(spent[resource], `seed ${String(seed)} day ${String(day)} ${resource}`)
            .toBeLessThanOrEqual(budget[resource] + 1e-6);
        }
      }
    }
  });

  it('leaves the lane shape — orbits, lives and indices — untouched by the ore rule', () => {
    const field = generateAsteroidSchedule(mulberry32(7));
    expect(field.map((rock) => rock.index)).toEqual(field.map((_, index) => index));
    // Two runs of one seed are one field; the quantiser may not consult a clock.
    expect(generateAsteroidSchedule(mulberry32(7))).toEqual(field);
  });
});

describe('research prices', () => {
  it('takes a fifth off the crystal of every rung and leaves the other two alone', () => {
    let rungs = 0;
    for (const id of RESEARCH_PROJECT_IDS) {
      for (let level = 1; level <= RESEARCH_MAX_LEVEL[id]; level++) {
        const quoted = RESEARCH_PROJECTS[id].costAt(level);
        const before = profileResearch(id, level).cost;
        expect(quoted.alloy, `${id} L${String(level)}`).toBe(before.alloy);
        expect(quoted.deuterium, `${id} L${String(level)}`).toBe(before.deuterium);
        expect(quoted.crystal, `${id} L${String(level)}`).toBe(Math.round(before.crystal * 0.8));
        rungs += 1;
      }
    }
    expect(RESEARCH_PROJECT_IDS.length).toBe(16);
    expect(rungs).toBe(52);
  });

  it('still charges whole positive resources at every rung', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      for (let level = 1; level <= RESEARCH_MAX_LEVEL[id]; level++) {
        const cost = RESEARCH_PROJECTS[id].costAt(level);
        expect(cost.alloy).toBeGreaterThan(0);
        expect(cost.crystal).toBeGreaterThan(0);
        for (const amount of Object.values(cost)) {
          expect(Number.isSafeInteger(amount)).toBe(true);
        }
      }
    }
  });
});

describe('instrument prices', () => {
  /** The figures the plan authored, held as a table so a drift is a diff. */
  const EXPECTED: Partial<Record<InstrumentId, readonly (readonly [number, number])[]>> = {
    TELESCOPE: [[207, 155], [892, 669], [2643, 1982], [6721, 5041], [15720, 11791],
      [34866, 26151], [74556, 55917], [155204, 116403]],
    RADAR: [[118, 89], [509, 382], [1510, 1133], [3841, 2881], [8983, 6737],
      [19924, 14943], [42603, 31952], [88688, 66516]],
  };

  for (const [id, rungs] of Object.entries(EXPECTED) as [InstrumentId, readonly (readonly [number, number])[]][]) {
    it(`prices every ${id} rung on the extended sensor curve`, () => {
      rungs.forEach(([alloy, crystal], index) => {
        expect(instrumentCost(id, index)).toEqual({ alloy, crystal, deuterium: 0 });
      });
    });
  }

  it('leaves the Aegis and the Veil at the undiscounted detector price', () => {
    for (let level = 0; level < 5; level++) {
      expect(instrumentCost('AEGIS', level)).toEqual(instrumentCost('VEIL', level));
      for (const resource of RESOURCES) {
        expect(instrumentCost('AEGIS', level)[resource])
          .toBeGreaterThanOrEqual(instrumentCost('RADAR', level)[resource]);
      }
    }
    // The Aegis is exactly the pre-discount Radar, which is what "unchanged" means.
    expect(instrumentCost('AEGIS', 0)).toEqual({ alloy: 197, crystal: 148, deuterium: 0 });
  });
});

describe('fuel', () => {
  it('halves the rate a unit of hull value is charged at', () => {
    expect(FUEL.perValue).toBe(0.0055);
  });

  it('keeps the Garbage Collector base before the current tier-three lift', () => {
    expect(SALVAGE.fuelMass).toBe(50);
    expect(hullFuelMass('GARBAGE_COLLECTOR')).toBe(59);
  });

  it('leaves no fuel-charged mobile hull free to move, and no ground gun charged', () => {
    for (const id of MOBILE_HULLS) expect(hullFuelMass(id), id).toBeGreaterThan(0);
    for (const id of Object.keys(HULLS) as (keyof typeof HULLS)[]) {
      if (HULLS[id].ground) expect(hullFuelMass(id), id).toBe(0);
    }
  });
});

describe('build and research timers', () => {
  it('takes a quarter off the one shared tempo dial', () => {
    expect(ECONOMY_ADJUSTMENT.buildTime).toBeCloseTo(1.3 * 0.75, 12);
    expect(ECONOMY_ADJUSTMENT.buildTime).toBe(0.975);
  });

  it('lowers the effective eight-hour building ceiling from 624 to 468 minutes', () => {
    // The authored ceiling is 480 minutes of work; the dial is applied after it.
    expect(buildingMinutes('CORE', 40, {})).toBeCloseTo(468, 9);
  });
});

describe('the Asteroid Shower front load', () => {
  const SPAN = 24 * 60;
  const STARTS = 8 * 60;
  const ENDS = 9 * 60;

  const shower = (definitionVersion: number, multiplier: number): PlannedGalaxyEvent => ({
    sequence: 3,
    kind: 'ASTEROID_SHOWER',
    startsAtMinute: STARTS,
    endsAtMinute: ENDS,
    definitionVersion,
    effect: { asteroidSpawnMultiplier: multiplier },
  });

  /**
   * Everything the shower added, taken by position rather than by index.
   *
   * `withAsteroidShowerLanes` re-appends the standing increase AFTER the frozen
   * event lanes, so a composed field's indices deliberately do not line up with the
   * base field's — the two bonus lanes are the established block straight after the
   * standing field, and the new-rate delta block at the very end.
   */
  const bonusOf = (definitionVersion: number, multiplier: number, seed = 400) => {
    const base = generateAsteroidSchedule(mulberry32(seed), SPAN, seed);
    const showered = withAsteroidShowerLanes(base, [shower(definitionVersion, multiplier)], seed, {
      span: SPAN,
    });
    const establishedCount = Math.round((10.35 * SPAN) / 60);
    const duration = ENDS - STARTS;
    const establishedBonus = Math.round((10.35 * (multiplier - 1) * duration) / 60);
    const expandedBonus = Math.round(
      (GALAXY.asteroidSpawnPerHour * (multiplier - 1) * duration) / 60,
    );
    return [
      ...showered.slice(establishedCount, establishedCount + establishedBonus),
      ...showered.slice(showered.length - (expandedBonus - establishedBonus)),
    ];
  };

  it('ships the new behaviour as a new definition version', () => {
    expect(GALAXY_EVENTS.definitions.ASTEROID_SHOWER.version)
      .toBeGreaterThanOrEqual(ASTEROID_SHOWER_FRONT_LOAD.fromDefinitionVersion);
    expect(ASTEROID_SHOWER_FRONT_LOAD.share).toBe(0.5);
    expect(ASTEROID_SHOWER_FRONT_LOAD.minutes).toBe(5);
  });

  it('adds the same number of rocks as the version it replaces', () => {
    for (const multiplier of [3, 5, 10]) {
      expect(bonusOf(5, multiplier).length).toBe(bonusOf(4, multiplier).length);
    }
  });

  it('lands half the bonus inside the first five minutes, and never before the window', () => {
    for (const multiplier of [3, 5, 10]) {
      for (const seed of [400, 77, 9001]) {
        const bonus = bonusOf(5, multiplier, seed);
        expect(bonus.length).toBeGreaterThan(0);
        const early = bonus.filter((rock) => rock.appearsAt < STARTS + 5).length;
        expect(early / bonus.length, `x${String(multiplier)} seed ${String(seed)}`)
          .toBeGreaterThanOrEqual(0.45);
        expect(early / bonus.length, `x${String(multiplier)} seed ${String(seed)}`)
          .toBeLessThanOrEqual(0.55);
        for (const rock of bonus) {
          expect(rock.appearsAt).toBeGreaterThanOrEqual(STARTS);
          expect(rock.appearsAt).toBeLessThan(ENDS);
        }
      }
    }
  });

  it('does not deliver the front load as one instant, which would be a lottery', () => {
    const early = bonusOf(5, 10).filter((rock) => rock.appearsAt < STARTS + 5);
    expect(new Set(early.map((rock) => rock.appearsAt)).size).toBe(early.length);
    // Spread across the five minutes rather than piled at their start.
    expect(Math.max(...early.map((rock) => rock.appearsAt))).toBeGreaterThan(STARTS + 3);
  });

  /**
   * THE PLAYER-FACING CLAIM, MEASURED ON THE FIELD ITSELF.
   *
   * The rocks-in-a-lane assertions above are the mechanism; this is the thing the
   * owner actually asked for — that a shower is VISIBLE within a few minutes of its
   * banner. It counts active rocks on a full-season field around one window, so it
   * reads the same quantity a commander's disc does, and it holds the hour's total
   * flat at the same time: a front load redistributes, it does not inflate.
   */
  it('makes the field grow sharply in five minutes without adding to the hour', () => {
    const seasonSpan = 14 * 24 * 60;
    const startsAt = 5 * 24 * 60 + 8 * 60;
    const growthAt = (definitionVersion: number, multiplier: number, minutes: number): number => {
      const samples = [1, 7, 42, 99, 400].map((seed) => {
        const base = generateAsteroidSchedule(mulberry32(seed), seasonSpan, seed);
        const field = withAsteroidShowerLanes(base, [{
          ...shower(definitionVersion, multiplier),
          startsAtMinute: startsAt,
          endsAtMinute: startsAt + 60,
        }], seed, { span: seasonSpan });
        const before = activeAsteroids(field, startsAt).length;
        return activeAsteroids(field, startsAt + minutes).length / before - 1;
      });
      return samples.reduce((sum, value) => sum + value, 0) / samples.length;
    };

    // Floors, not bands: the plan asked for roughly 20-25% / 45-50% / 100% at five
    // minutes and the shipped split clears all three. They are stated as minimums so
    // a later tuning pass cannot quietly walk the effect back below what was asked.
    for (const [multiplier, floor] of [[3, 0.25], [5, 0.50], [10, 1.00]] as const) {
      expect(growthAt(5, multiplier, 5), `x${String(multiplier)} at five minutes`)
        .toBeGreaterThan(floor);
      // …and the old shape is what it is being measured against.
      expect(growthAt(4, multiplier, 5)).toBeLessThan(growthAt(5, multiplier, 5));
      // The hour is unchanged: nothing was added, only moved forward inside it.
      expect(growthAt(5, multiplier, 60)).toBeCloseTo(growthAt(4, multiplier, 60), 6);
    }
  });

  it('leaves a window stamped at an older version exactly where it was', () => {
    const old = bonusOf(4, 5);
    const early = old.filter((rock) => rock.appearsAt < STARTS + 5).length;
    // The old lane is uniform over the hour: a twelfth of it lands in five minutes.
    expect(early / old.length).toBeLessThan(0.2);
  });
});

describe('the pirate lane', () => {
  it('doubles the candidate rate to 0.06 a seat an hour', () => {
    expect(PIRATE.spawnPerSeatPerHour).toBeCloseTo(0.06, 12);
    expect(PIRATE.spawnPerHour).toBeCloseTo(0.06 * SERVERS.capacity, 9);
  });

  it('keeps both established rates so their lanes can be rebuilt byte for byte', () => {
    expect(PIRATE.establishedSpawnPerHour).toBeCloseTo(0.02 * SERVERS.capacity, 9);
    expect(PIRATE.increasedSpawnPerHour).toBeCloseTo(0.03 * SERVERS.capacity, 9);
  });

  it('doubles the monthly pirate allowance alongside the rate', () => {
    const day = 12;
    const allowance = monthlySupply('pirates', day, SERVERS.capacity);
    const mining = monthlySupply('mining', day, SERVERS.capacity);
    // 0.05 x hoardRewardScale x (spawn / established) = 0.195 of the reference,
    // against mining's 0.15 — asserted as the ratio so neither can drift alone.
    for (const resource of RESOURCES) {
      expect(allowance[resource] / mining[resource]).toBeCloseTo(0.195 / 0.15, 9);
    }
  });
});
