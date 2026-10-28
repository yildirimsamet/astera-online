import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS, ANTI_STRATEGIC, BUILD, BUILDING_IDS, DEATH_STAR, ECON, FAULT, GALAXY,
  GROUND_HULLS, HULLS, INSTRUMENT_IDS, MOBILE_HULLS, PIRATE, PROBE, PROSPECTOR,
  RESEARCH_PROJECT_IDS, RESEARCH_PROJECTS, SATELLITE_IDS, SETTLEMENT_CLAIM_MINUTES,
  SUPPORT_ROUND_TRIP, TRADE, TRANSPORT_SPEED_MULT, TRAVEL, UNAIDED,
  advanceEconomy, alloyLift, alloyRate, buildMinutes, buildingMinutes, collect,
  collectorCap, constructionThroughput, crystalRate, defenceMinutes, defenceThroughput,
  deuteriumCollectorCap, deuteriumRate, deuteriumStorageCap, fleetSpeedMult,
  fleetTravelExact, hullWorkMinutes, instrumentCost, leakRates, minutesUntilCollectorFull,
  producerOutputMult, profileBuilding, profileFlightSpeed, profileHull,
  profileIncome, prospectorReturnSpeed, researchMinutes, robotSpeedMult,
  repairMinutes, satelliteCost, satelliteMinutes, shipHpRepairMinutes, shipMinutes, storageCap,
  yardSpeedMult, yardThroughput,
  type PlanetEconomyState, type Resources, type TechLevels,
} from '../src/index.js';

const OLD_BUILD_TIME = 0.975;
// The original slowdown plus the new 60-day overlay. The historical pre-cutover
// output and 48-hour leak remain frozen independently of current work durations.
const WORK_RATE = 0.8 / 1.15;
const OUTPUT_RATE = 0.8 * 0.85;
const technologies: readonly TechLevels[] = [{}, { AI_ROBOTS: 5, YARD_AUTOMATION: 5 }];
const total = (cost: Resources): number => cost.alloy + cost.crystal + cost.deuterium;

// Captured from the pre-change rules: exact capacity in resources, not production-hours.
const capacityCases = [
  { levels: [0, 0, 0, 0], boost: 1, store: [0, 0, 0], works: [0, 0, 0] },
  { levels: [1, 1, 0, 0], boost: 1, store: [1378, 551, 276], works: [875, 350, 175] },
  { levels: [1, 1, 1, 1], boost: 1, store: [1838, 735, 426], works: [875, 350, 203] },
  { levels: [6, 6, 6, 6], boost: 1, store: [42463, 16985, 9628], works: [8987, 3595, 2038] },
  { levels: [10, 9, 3, 5], boost: 1, store: [58661, 25576, 13227], works: [13967, 6090, 3149] },
  { levels: [13, 13, 12, 13], boost: 1, store: [196771, 98386, 54412], works: [20822, 10411, 5758] },
  { levels: [22, 22, 15, 22], boost: 1, store: [1569524, 784762, 413847], works: [62283, 31141, 16423] },
  { levels: [40, 30, 20, 40], boost: 1, store: [14297213, 3817065, 2003592], works: [226940, 60588, 31803] },
  { levels: [6, 6, 6, 6], boost: 1.06, store: [45010, 18004, 10206], works: [9526, 3810, 2160] },
] as const;

describe('owner tempo overlays through the sixty-day season', () => {
  it('composes flight slowdowns while retaining each role and cargo rung', () => {
    for (const id of MOBILE_HULLS) {
      const hull = HULLS[id];
      const roundTrip = hull.profile === 'TRANSPORT' ? SUPPORT_ROUND_TRIP[hull.tier! - 1]!
        : hull.profile === 'COLLECTOR' ? 20
          : hull.cls === 'SKIRMISHER' ? 15 : hull.cls === 'LANCE' ? 20
            : hull.profile === 'ESCORT' ? 18 : 25;
      const oldSpeed = profileFlightSpeed(roundTrip) * 0.75
        * (hull.profile === 'TRANSPORT' ? TRANSPORT_SPEED_MULT : 1);
      expect(hull.speed, id).toBeCloseTo(oldSpeed * 0.8 * 0.9, 10);
      expect(fleetTravelExact(1250, { [id]: 1 }, UNAIDED), id)
        .toBeCloseTo(1250 / oldSpeed * TRAVEL.distanceFactor / 0.8 / 0.9, 10);
    }
    for (const id of GROUND_HULLS) expect(HULLS[id].speed, id).toBe(0);
  });

  it('keeps the probe and mining overlays independent of the preserved Death Star', () => {
    expect(PROBE.speed).toBe(3510 * 0.75 * 0.9);
    expect(PROSPECTOR.speed).toBe(1237.5 * 0.8 * 0.9);
    expect(HULLS.PROSPECTOR.speed).toBe(891);
    expect(prospectorReturnSpeed([], false)).toBe(891);
    expect(prospectorReturnSpeed([], true)).toBe(445.5);
    // The owner then raised the Death Star by 50% on 2026-10-16; the slowdown itself stands.
    expect(DEATH_STAR.speed).toBe(1250 * 0.8 * 1.5);
  });

  it('sets the Beacon to a 20% speed bonus, without changing a bare launch', () => {
    expect(fleetSpeedMult([])).toBe(1);
    expect(fleetSpeedMult(['BEACON'])).toBe(1.2);
    const bare = fleetTravelExact(600, { DART: 2, ARGOSY: 1 }, UNAIDED);
    expect(fleetTravelExact(600, { DART: 2, ARGOSY: 1 }, { boost: fleetSpeedMult(['BEACON']), tech: {} }))
      .toBeCloseTo(bare / 1.2, 10);
  });

  it('reduces all three hourly outputs uniformly at levels 0–100, preserving their shape', () => {
    for (let level = 0; level <= 100; level++) {
      const income = profileIncome(level);
      const oldCut = 0.70 * producerOutputMult(level);
      expect(alloyRate(level)).toBeCloseTo(income.alloy * oldCut * alloyLift(level) * OUTPUT_RATE, 8);
      expect(crystalRate(level)).toBeCloseTo(income.crystal * oldCut * OUTPUT_RATE, 8);
      expect(deuteriumRate(level)).toBeCloseTo(income.deuterium * oldCut * OUTPUT_RATE, 8);
      if (level > 0) {
        expect(alloyRate(level)).toBeGreaterThan(alloyRate(level - 1));
        expect(crystalRate(level)).toBeGreaterThan(crystalRate(level - 1));
        expect(deuteriumRate(level)).toBeGreaterThan(deuteriumRate(level - 1));
      }
    }
  });

  it.each(capacityCases)('preserves Store and Works capacities for $levels with boost $boost', (entry) => {
    const [a, c, d, vault] = entry.levels;
    const ra = alloyRate(a) * entry.boost;
    const rc = crystalRate(c) * entry.boost;
    const rd = deuteriumRate(d) * entry.boost;
    expect([storageCap(ra, vault), storageCap(rc, vault), deuteriumStorageCap(rd, rc, vault)])
      .toEqual(entry.store);
    expect([collectorCap(ra), collectorCap(rc), deuteriumCollectorCap(rd, rc)])
      .toEqual(entry.works);
  });

  it('keeps previously accumulated resources intact across ticking and collection', () => {
    const input = { refineryLevel: 6, extractorLevel: 6, plantLevel: 6, vaultLevel: 6, aegisLevel: 0 };
    const state: PlanetEconomyState = {
      alloy: 0, crystal: 0, deuterium: 0,
      bufferAlloy: 8987, bufferCrystal: 3595, bufferDeuterium: 2038,
      shield: 0, lastTickMinutes: 0, disruptedUntilMinutes: 0,
    };
    const ticked = advanceEconomy(state, input, 60);
    expect([ticked.bufferAlloy, ticked.bufferCrystal, ticked.bufferDeuterium])
      .toEqual([8987, 3595, 2038]);
    expect(collect(ticked, input).moved).toEqual({ alloy: 8987, crystal: 3595, deuterium: 2038 });
    expect(minutesUntilCollectorFull(0, alloyRate(6)))
      .toBeCloseTo(8987 / alloyRate(6) * 60, 10);
    expect(ECON.collectorHours).toBeCloseTo(12.5 / 0.85, 10);
  });

  it('composes ordinary work durations with every robot discount', () => {
    for (const tech of technologies) {
      for (const id of BUILDING_IDS) {
        for (const level of [1, 6, 13, 40, 100]) {
          const oldMinutes = profileBuilding(id, level).minutes * OLD_BUILD_TIME * robotSpeedMult(tech);
          expect(buildingMinutes(id, level, tech), `${id}:${String(level)}`)
            .toBeCloseTo(oldMinutes / WORK_RATE, 9);
        }
      }
      for (const id of INSTRUMENT_IDS) {
        for (const level of [0, 5, 30]) {
          const oldMinutes = Math.min(480, total(instrumentCost(id, level)) / constructionThroughput(6))
            * OLD_BUILD_TIME * robotSpeedMult(tech);
          expect(buildMinutes(instrumentCost(id, level), 6, tech), id)
            .toBeCloseTo(oldMinutes / WORK_RATE, 9);
        }
      }
      for (const id of SATELLITE_IDS) {
        const oldWork = id === 'UPLINK' ? 5
          : Math.min(480, total(satelliteCost(id)) / constructionThroughput(6));
        expect(satelliteMinutes(id, 6, tech), id)
          .toBeCloseTo(oldWork * OLD_BUILD_TIME * robotSpeedMult(tech) / WORK_RATE, 9);
      }
    }
  });

  it('slows all hull batches, ground defence and repairs through the same work rate', () => {
    for (const id of ALL_HULLS) {
      for (const tech of technologies) {
        for (const count of [1, 3, 100]) {
          const oldMinutes = profileHull(HULLS[id]).workMinutes * count / (1 + 0.12 * 6)
            * yardSpeedMult(tech) * OLD_BUILD_TIME;
          expect(hullWorkMinutes(id, count, 6, tech), id).toBeCloseTo(oldMinutes / WORK_RATE, 9);
          expect(shipHpRepairMinutes([{ hull: id, count, damageBp: 4000 }], 6, tech, 50), id)
            .toBeCloseTo(oldMinutes * 0.4 * 0.5 / WORK_RATE, 9);
        }
      }
    }
  });

  it('slows research and interceptor work while preserving Death Star manufacturing', () => {
    for (const id of RESEARCH_PROJECT_IDS) {
      for (let level = 1; level <= RESEARCH_PROJECTS[id].maxLevel; level++) {
        const cost = RESEARCH_PROJECTS[id].costAt(level);
        const oldMinutes = Math.min(480, BUILD.researchTimeMult * total(cost) / constructionThroughput(6))
          * OLD_BUILD_TIME;
        expect(researchMinutes(cost, 6), `${id}:${String(level)}`).toBeCloseTo(oldMinutes / WORK_RATE, 9);
      }
    }
    expect(DEATH_STAR.buildMinutes).toBe(73.125);
    expect(ANTI_STRATEGIC.buildMinutes).toBe(29.25 / WORK_RATE);
  });

  it('also slows zero-cost and capped work consistently', () => {
    for (const amount of [0, 750, 1_000_000]) {
      const cost: Resources = { alloy: amount, crystal: 0, deuterium: 0 };
      expect(buildMinutes(cost, 6, {}))
        .toBeCloseTo(Math.min(480, amount / constructionThroughput(6)) * OLD_BUILD_TIME / WORK_RATE, 9);
      expect(shipMinutes(cost, 6, {}))
        .toBeCloseTo(Math.min(480, amount / yardThroughput(6)) * OLD_BUILD_TIME / WORK_RATE, 9);
      expect(defenceMinutes(cost, 6))
        .toBeCloseTo(Math.min(480, amount / defenceThroughput(6)) * OLD_BUILD_TIME / WORK_RATE, 9);
    }
    expect(BUILD.capMinutes).toBeCloseTo(585 * 1.15, 10);
  });

  it('extends colony repair crews by the ordinary duration overlay at both ends', () => {
    expect(FAULT.repairMinMinutes).toBe(5 / WORK_RATE);
    expect(FAULT.repairMaxMinutes).toBe(15 / WORK_RATE);
    for (const roll of [0, 0.5, 1 - Number.EPSILON]) {
      expect(repairMinutes(() => roll)).toBeCloseTo((5 + roll * 10) / WORK_RATE, 10);
    }
  });

  it('retains moving-target leads and the fixed colony claim window', () => {
    for (const id of MOBILE_HULLS.filter((hull) => HULLS[hull].profile === 'TRANSPORT')) {
      expect(HULLS[id].speed / TRAVEL.distanceFactor, id).toBeGreaterThan(TRADE.speed);
    }
    expect(PROSPECTOR.speed / TRAVEL.distanceFactor).toBeGreaterThan(GALAXY.asteroidSpeedMax);
    expect(HULLS.CITADEL.speed / TRAVEL.distanceFactor).toBeGreaterThan(PIRATE.speedMin);
    expect(HULLS.DART.speed / TRAVEL.distanceFactor).toBeGreaterThan(PIRATE.speedMax);
    expect(fleetTravelExact(2 * GALAXY.radius, { COURIER: 2 }, UNAIDED))
      .toBeLessThan(SETTLEMENT_CLAIM_MINUTES);
  });
});

describe('active-season production cutover', () => {
  const empty: PlanetEconomyState = {
    alloy: 0, crystal: 0, deuterium: 0,
    bufferAlloy: 0, bufferCrystal: 0, bufferDeuterium: 0,
    shield: 0, lastTickMinutes: 0, disruptedUntilMinutes: 0,
  };
  const input = {
    refineryLevel: 1, extractorLevel: 1, plantLevel: 1, vaultLevel: 1, aegisLevel: 0,
    productionTempoStartsAtMinutes: 60,
  };
  const legacyLeak = (level: number): Resources => {
    const alloy = alloyRate(level), crystal = crystalRate(level), deuterium = deuteriumRate(level);
    const vaultLevel = Math.min(level, 40);
    return {
      alloy: Math.min(storageCap(alloy, vaultLevel) / 48, alloy / OUTPUT_RATE * 2),
      crystal: Math.min(storageCap(crystal, vaultLevel) / 48, crystal / OUTPUT_RATE * 2),
      deuterium: Math.min(deuteriumStorageCap(deuterium, crystal, vaultLevel) / 48, deuterium / OUTPUT_RATE * 2),
    };
  };

  it('retains the sixty-hour drain and two-hour income cap at the new output', () => {
    expect(FAULT.leakDrainHours).toBe(60);
    for (let level = 0; level <= 100; level++) {
      const rates = { alloy: alloyRate(level), crystal: crystalRate(level), deuterium: deuteriumRate(level) };
      const vault = Math.min(level, 40);
      const leak = leakRates(rates, vault);
      expect(leak.alloy).toBeCloseTo(Math.min(storageCap(rates.alloy, vault) / 60, rates.alloy * 2), 10);
      expect(leak.crystal).toBeCloseTo(Math.min(storageCap(rates.crystal, vault) / 60, rates.crystal * 2), 10);
      expect(leak.deuterium).toBeCloseTo(Math.min(deuteriumStorageCap(rates.deuterium, rates.crystal, vault) / 60, rates.deuterium * 2), 10);
    }
  });

  it('retains pre-cutover leakage and applies reduced leakage only after the boundary', () => {
    const start = { ...empty, alloy: 50_000, crystal: 20_000, deuterium: 5_000 };
    const leaking = {
      ...input, refineryLevel: 6, extractorLevel: 6, plantLevel: 6, vaultLevel: 6,
      faults: ['VAULT_LEAK', 'REFINERY_OUTAGE', 'EXTRACTOR_OUTAGE', 'PLANT_OUTAGE'] as const,
    };
    const old = legacyLeak(6);
    const current = leakRates({ alloy: alloyRate(6), crystal: crystalRate(6), deuterium: deuteriumRate(6) }, 6);
    const before = advanceEconomy(start, leaking, 60);
    const after = advanceEconomy({ ...start, lastTickMinutes: 60 }, leaking, 120);
    const both = advanceEconomy(start, leaking, 120);
    for (const resource of ['alloy', 'crystal', 'deuterium'] as const) {
      expect(before[resource]).toBeCloseTo(start[resource] - old[resource], 6);
      expect(after[resource]).toBeCloseTo(start[resource] - current[resource], 6);
      expect(both[resource]).toBeCloseTo(start[resource] - (old[resource] + current[resource]), 6);
    }
    const pending = advanceEconomy(start, { ...leaking, productionTempoStartsAtMinutes: null }, 120);
    expect(pending.alloy).toBeCloseTo(start.alloy - old.alloy * 2, 6);
  });

  it('credits the first hour at the old rate and the next hour at the reduced rate', () => {
    const state = advanceEconomy(empty, input, 120);
    expect(state.bufferAlloy).toBeCloseTo(87.5 + 59.5, 10);
    expect(state.bufferCrystal).toBeCloseTo(35 + 23.8, 10);
    expect(state.bufferDeuterium).toBeCloseTo(2.8 + 1.904, 10);
  });

  it('does not apply the new rate to production before the cutover boundary', () => {
    expect(advanceEconomy(empty, input, 60).bufferAlloy).toBeCloseTo(87.5, 10);
    expect(advanceEconomy({ ...empty, lastTickMinutes: 60 }, input, 120).bufferAlloy)
      .toBeCloseTo(59.5, 10);
    expect(advanceEconomy(empty, { ...input, productionTempoStartsAtMinutes: null }, 120).bufferAlloy)
      .toBeCloseTo(175, 10);
  });

  it('is equivalent to separate ticks at the cutover, including faults and their spent budget', () => {
    const start = { ...empty, alloy: 5000, crystal: 2000, deuterium: 200 };
    const leaking = { ...input, faults: ['VAULT_LEAK'] as const };
    const before = advanceEconomy(start, leaking, 60);
    const after = advanceEconomy(before, {
      ...leaking,
      leakedSoFar: {
        alloy: before.pendingLeakAlloy ?? 0,
        crystal: before.pendingLeakCrystal ?? 0,
        deuterium: before.pendingLeakDeuterium ?? 0,
      },
    }, 120);
    expect(advanceEconomy(start, leaking, 120)).toEqual(after);
  });

  it('preserves old recovery boosts and disruption rather than crediting blocked minutes', () => {
    const state = advanceEconomy({ ...empty, disruptedUntilMinutes: 30 }, {
      ...input, recoveryBoostUntilMinutes: 60,
    }, 120);
    expect(state.bufferAlloy).toBeCloseTo(87.5 * 0.5 * 1.5 + 59.5, 10);
  });
});
