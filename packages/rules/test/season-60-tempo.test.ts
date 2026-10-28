import { describe, expect, it } from 'vitest';
import { ADMIRAL_WAIT, ARENA_ECONOMY, dailyCap, repairQuote } from '../src/arena/index.js';
import {
  ANTI_STRATEGIC, BUILD, DEATH_STAR, ECONOMY_PROFILE, FAULT, GALAXY, HULLS,
  PIRATE, PROBE, PROSPECTOR, RADIATION_BOMB, RESEARCH_PROJECTS, SEASON, TRADE,
  advanceEconomy, alloyRate, buildingCost, buildingMinutes, collectorCap,
  clanAidAllowance, clanPurseRemaining, convoyProductionCap, crystalRate, deuteriumCollectorCap, deuteriumRate,
  deuteriumStorageCap, dynamicAsteroidHourOf, dynamicAsteroidIndex, dynamicPirateHourOf, dynamicPirateIndex,
  fleetTravelExact, generateAsteroidHour, generateGalaxyEventSchedule,
  generatePirateHour, generateAsteroidSchedule, generatePirateSchedule, mulberry32,
  hullWorkMinutes, leakRates, planAsteroidHour, planPirateHour,
  prospectorReturnSpeed, radiationBombBuildSeconds, repairMinutes, seededFrom,
  shipHpRepairMinutes, storageCap, vacationCost, vaultProtects, worldRadius,
  type BuildingLevels, type PlanetEconomyState,
} from '../src/index.js';

// Captured from the current 30-day season, before this transition. Values below
// are independent of the new dials so an accidental double adjustment is visible.
const capacities = [
  { levels: [1, 1, 0, 0], boost: 1, store: [1378, 551, 276], works: [875, 350, 175] },
  { levels: [6, 6, 6, 6], boost: 1, store: [42463, 16985, 9628], works: [8987, 3595, 2038] },
  { levels: [10, 9, 3, 5], boost: 1, store: [58661, 25576, 13227], works: [13967, 6090, 3149] },
  { levels: [22, 22, 15, 22], boost: 1, store: [1569524, 784762, 413847], works: [62283, 31141, 16423] },
  { levels: [40, 30, 20, 40], boost: 1, store: [14297213, 3817065, 2003592], works: [226940, 60588, 31803] },
  { levels: [6, 6, 6, 6], boost: 1.06, store: [45010, 18004, 10206], works: [9526, 3810, 2160] },
] as const;

describe('60-day season transition', () => {
  it('keeps the legacy static field on its frozen 30-day reference', () => {
    const rocks = generateAsteroidSchedule(mulberry32(7));
    const oldRocks = generateAsteroidSchedule(mulberry32(7), 30 * 1440);
    expect(rocks.length).toBe(oldRocks.length);
    expect(rocks[rocks.length - 1]).toEqual(oldRocks[oldRocks.length - 1]);
    const pirates = generatePirateSchedule(mulberry32(7));
    const oldPirates = generatePirateSchedule(mulberry32(7), 30 * 1440);
    expect(pirates.length).toBe(oldPirates.length);
    expect(pirates[pirates.length - 1]).toEqual(oldPirates[oldPirates.length - 1]);
  });
  it('extends the deadline without repricing purchases or delaying the public acts', () => {
    expect(ECONOMY_PROFILE.id).toBe('season-60-v1');
    expect(SEASON.days).toBe(60);
    expect(ECONOMY_PROFILE.progressionDays).toBe(30);
    expect(buildingCost('CORE', 11)).toEqual({ alloy: 7327, crystal: 2998, deuterium: 0 });
    for (const [i, act] of SEASON.actBoundaries.entries()) {
      expect(SEASON.days * 1440 * act.share).toBeCloseTo(30 * 1440 * (i + 1) * 4 / 14, 8);
    }
    expect(RESEARCH_PROJECTS.STRATEGIC_STOCKPILE.availableAtMinutes).toBeCloseTo(30 * 1440 * 4 / 14, 8);
    expect(SEASON.afterglowMinutes).toBe(5);
  });

  it('cuts the current hourly income by 15%, retaining each producer curve', () => {
    for (let level = 0; level <= 100; level++) {
      const lift = level <= 6 ? 1.25 : level >= 10 ? 1 : 1.25 - (level - 6) * 0.25 / 4;
      const late = level <= 12 ? 1 : 1 + (level - 12) * 0.06;
      expect(alloyRate(level)).toBeCloseTo(100 * level ** 1.3 * 0.56 * lift * late * 0.85, 7);
      expect(crystalRate(level)).toBeCloseTo(50 * level ** 1.3 * 0.56 * late * 0.85, 7);
      expect(deuteriumRate(level)).toBeCloseTo(4 * level ** 1.2 * 0.56 * late * 0.85, 7);
    }
  });

  it.each(capacities)('retains the resource capacities at $levels, boost $boost', ({ levels, boost, store, works }) => {
    const [a, c, d, vault] = levels;
    const ra = alloyRate(a) * boost, rc = crystalRate(c) * boost, rd = deuteriumRate(d) * boost;
    expect([storageCap(ra, vault), storageCap(rc, vault), deuteriumStorageCap(rd, rc, vault)]).toEqual(store);
    expect([collectorCap(ra), collectorCap(rc), deuteriumCollectorCap(rd, rc)]).toEqual(works);
  });

  it.each([[59, 31636956], [87, 3287123914]])('keeps high-level half-integer capacity rounding within one resource at level %i', (level, before) => {
    // The compensation preserves nominal capacity. Different floating-point
    // multiplication order can cross an exact .5 boundary at these two high rungs.
    expect(Math.abs(storageCap(crystalRate(level), level) - before)).toBeLessThanOrEqual(1);
  });

  it('adds 15% to work and both repair systems, including the existing work cap', () => {
    expect(buildingMinutes('CORE', 2, {})).toBeCloseTo(2.72 * 1.21875 * 1.15, 10);
    expect(hullWorkMinutes('DART', 1, 0, {})).toBeCloseTo(2 * 1.21875 * 1.15, 10);
    expect(hullWorkMinutes('DART', 1000, 0, {})).toBeCloseTo(2000 * 1.21875 * 1.15, 9);
    expect(shipHpRepairMinutes([{ hull: 'DART', count: 10, damageBp: 4000 }], 0, {}, 50))
      .toBeCloseTo(20 * 1.21875 * 0.4 * 0.5 * 1.15, 10);
    expect(BUILD.capMinutes).toBeCloseTo(585 * 1.15, 10);
    expect(repairMinutes(() => 0)).toBeCloseTo(6.25 * 1.15, 10);
    expect(repairMinutes(() => 1 - Number.EPSILON)).toBeCloseTo(18.75 * 1.15, 10);
    expect(ANTI_STRATEGIC.buildMinutes).toBeCloseTo(36.5625 * 1.15, 10);
  });

  it('preserves Death Star and every Radiation Bomb while ordinary work slows', () => {
    expect(DEATH_STAR.buildMinutes).toBe(73.125);
    expect(DEATH_STAR.speed).toBe(1500);
    expect(DEATH_STAR.cost).toEqual({ alloy: 50000, crystal: 35000, deuterium: 3000 });
    expect(([1, 2, 3] as const).map(radiationBombBuildSeconds)).toEqual([2194, 3291, 4388]);
    expect(RADIATION_BOMB.speed).toBe(1300);
    expect(RADIATION_BOMB.durationMinutes).toBe(30);
    expect(RADIATION_BOMB.maxHpPerMinute).toBe(50);
  });

  it('slows mobile craft and the NPC anchors exactly once', () => {
    expect(HULLS.DART.speed).toBeCloseTo(121.34831460674155 * 0.9, 10);
    expect(PIRATE.speedMin).toBeCloseTo(52.94117647058824 * 0.9, 10);
    expect(PIRATE.speedMax).toBeCloseTo(70.78651685393257 * 0.9, 10);
    expect(TRADE.speed).toBeCloseTo(19.823788546255507 * 0.9, 10);
    expect(PROBE.speed).toBe(2369.25);
    expect(PROSPECTOR.speed).toBe(891);
    expect(prospectorReturnSpeed([], true)).toBe(445.5);
    expect(fleetTravelExact(1250, { DART: 2 }, { tech: {}, boost: 1 })).toBeCloseTo(12.36111111111111 / 0.9, 9);
    expect(GALAXY.asteroidSpeedMax).toBe(562.5);
  });

  it('shrinks the whole Core-level size curve by 20% without changing its spread', () => {
    const old = [0.3766902768834514, 0.702, 1.1985246];
    for (const [i, level] of [1, 11, 22].entries()) expect(worldRadius(level)).toBeCloseTo(old[i]! * 0.8, 12);
    expect(worldRadius(22) / worldRadius(1)).toBeCloseTo(old[2]! / old[0]!, 12);
  });

  it('keeps hours-based benefits and fees tied to the reduced income', () => {
    const buildings: BuildingLevels = { CORE: 12, REFINERY: 12, EXTRACTOR: 12, DEUTERIUM_PLANT: 12, VAULT: 12, SHIPYARD: 6, HANGAR: 6 };
    expect(vaultProtects(12, 12, 12, 12)).toEqual({ alloy: 9630, crystal: 4815, deuterium: 300 });
    expect(vacationCost(1, [{ id: 'capital', coreLevel: 12, capital: true }]).total).toBe(451);
    expect(convoyProductionCap({ buildings, orbit: [], effect: { resourceCapHours: 8 } }))
      .toEqual({ alloy: 9630, crystal: 4815, deuterium: 300 });
    expect(FAULT.leakDrainHours).toBe(60);
    const rates = { alloy: alloyRate(12), crystal: crystalRate(12), deuterium: deuteriumRate(12) };
    expect(ARENA_ECONOMY.capHours).toBe(4);
    expect(dailyCap(rates)).toEqual({ alloy: 4815, crystal: 2407, deuterium: 150 });
    const clan = { alloyPerHour: rates.alloy, crystalPerHour: rates.crystal, deuteriumCapacity: 10000 };
    expect(clanAidAllowance(clan)).toEqual({ alloy: 4815, crystal: 2407, deuterium: 2000 });
    expect(clanPurseRemaining({ ...clan, storageCapacity: { alloy: 200000, crystal: 100000, deuterium: 10000 },
      vaultProtection: vaultProtects(12, 12, 12, 12), unclaimed: { alloy: 0, crystal: 0, deuterium: 0 } }))
      .toEqual({ alloy: 2407, crystal: 1203, deuterium: 1000 });
    expect(leakRates(rates, 12).alloy).toBeCloseTo(Math.min(148701 / 60, rates.alloy * 2), 9);
  });

  it('preserves the latest Arena and escort cooldowns and paid cooldown shortening', () => {
    expect(ARENA_ECONOMY.repairMinutes).toBe(3);
    expect(ARENA_ECONOMY.serviceMinutes).toBe(3);
    expect(ADMIRAL_WAIT).toEqual({ repairMinutes: 60, serviceMinutes: 10 });
    expect(repairQuote(1)).toEqual({ minutes: 15, cost: { alloy: 175, crystal: 60, deuterium: 0 } });
    expect(repairQuote(20)).toEqual({ minutes: 30, cost: { alloy: 650, crystal: 250, deuterium: 0 } });
  });

  it('preserves historical production AND the 48-hour leak before the legacy cutover', () => {
    const state: PlanetEconomyState = { alloy: 5000, crystal: 2000, deuterium: 200,
      bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0, shield: 0,
      lastTickMinutes: 0, disruptedUntilMinutes: 0 };
    const input = { refineryLevel: 1, extractorLevel: 1, plantLevel: 1, vaultLevel: 1, aegisLevel: 0,
      productionTempoStartsAtMinutes: 60 };
    const produced = advanceEconomy(state, input, 120);
    expect(produced.bufferAlloy).toBeCloseTo(87.5 + 59.5, 10);
    const leaked = advanceEconomy(state, { ...input,
      faults: ['VAULT_LEAK', 'REFINERY_OUTAGE', 'EXTRACTOR_OUTAGE', 'PLANT_OUTAGE'] }, 60);
    expect(leaked.alloy).toBeCloseTo(5000 - 1838 / 48, 9);
    expect(leaked.crystal).toBeCloseTo(2000 - 735 / 48, 9);
    expect(leaked.deuterium).toBeCloseTo(200 - 2.8 * 2, 9);
  });

  it('keeps last-hour target identities within PostgreSQL integer range and outside earlier hours', () => {
    const hour = 60 * 24 - 1;
    const rock = dynamicAsteroidIndex(hour, 99999), pirate = dynamicPirateIndex(hour, 999);
    expect(rock).toBe(153999999);
    expect(pirate).toBe(2439999);
    expect(dynamicAsteroidHourOf(rock)).toBe(hour);
    expect(dynamicPirateHourOf(pirate)).toBe(hour);
    expect(dynamicAsteroidIndex(hour, 0)).toBeGreaterThan(dynamicAsteroidIndex(hour - 1, 99999));
    expect(dynamicPirateIndex(hour, 0)).toBeGreaterThan(dynamicPirateIndex(hour - 1, 999));
    expect(Math.max(rock, pirate)).toBeLessThan(2147483647);
  });

  it.each([30, 59])('keeps dynamic targets and public windows alive on zero-based day %i', (day) => {
    const minute = day * 1440;
    const input = { activePlayers: 20, hourStartsAtMinute: minute, spawnFromMinute: minute, seasonEndsAtMinute: 60 * 1440 };
    const rocks = generateAsteroidHour({ hourOrdinal: day * 24, lanes: planAsteroidHour({ ...input, showers: [] }),
      rng: seededFrom('60-day-rocks', day), isotopeSeed: 5 });
    expect(rocks.length).toBeGreaterThan(0);
    expect(rocks.every(rock => rock.ore > 0)).toBe(true);
    const lane = planPirateHour(input);
    expect(lane).not.toBeNull();
    if (!lane) throw new Error('Missing second-month pirate lane');
    const pirates = generatePirateHour({ hourOrdinal: day * 24, lane, rng: seededFrom('60-day-pirates', day) });
    expect(pirates.length).toBeGreaterThan(0);
    const schedule = generateGalaxyEventSchedule({ seasonStartsAtUnixMinute: 0, seasonDurationMinutes: 60 * 1440,
      rngFor: kind => seededFrom('60-day-calendar', kind) });
    for (const kind of ['ASTEROID_SHOWER', 'TRADE_SHIP', 'INTERGALACTIC_CONVOY']) {
      expect(schedule.some(event => event.kind === kind && event.startsAtMinute >= minute && event.endsAtMinute <= minute + 1440), kind).toBe(true);
    }
    expect(planAsteroidHour({ ...input, hourStartsAtMinute: 60 * 1440, spawnFromMinute: 60 * 1440, showers: [] })).toEqual([]);
    expect(planPirateHour({ ...input, hourStartsAtMinute: 60 * 1440, spawnFromMinute: 60 * 1440 })).toBeNull();
  });
});
