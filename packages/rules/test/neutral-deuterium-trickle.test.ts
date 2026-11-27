import { describe, expect, it } from 'vitest';
import {
  GALAXY,
  HULLS,
  MULTI_WORLD,
  computeLoot,
  crystalRate,
  deuteriumRate,
  deuteriumStorageCap,
  missionFuel,
  neutralDeuteriumAt,
  neutralDeuteriumCap,
  scaleNeutralDeuteriumLoot,
  type Fleet,
  type NeutralTier,
} from '../src/index.js';

/**
 * CARETAKER DEUTERIUM TRICKLE — owner, 2026-11-27.
 *
 * A caretaker world used to hold a seeded stockpile of deuterium that only ever fell, so the
 * second raid on it came home empty — while the flight itself is paid for in deuterium. T2 and T3
 * now refill that stockpile slowly. T1 stays as it was (owner: "t1'e dokunmayalım").
 *
 * The calibration is the point: a raid every 12–18 hours must be worth flying, and raiding
 * non-stop must not be. Both are measured here against the fuel a reference raid burns.
 */

const HOUR_PERIODS = { worth: [12, 15, 18], farm: [2, 6] } as const;
/** A mid-game strike wing; the tests compare the haul against ITS fuel bill. */
const REFERENCE_FLEET: Fleet = { VIPER: 30, TEMPEST: 10 };
/** The owner's capital sits in the commander shell; 0.8 of the radius is the middle of it. */
const CAPITAL_RADIUS = 0.8;
/** Middle of the band each tier is aimed at (`GALAXY.strata`). */
const TIER_RADIUS: Record<NeutralTier, number> = {
  1: (GALAXY.strata.t1.inner + GALAXY.strata.t1.outer) / 2,
  2: (GALAXY.strata.t3Outer + GALAXY.strata.t1.inner) / 2,
  3: GALAXY.strata.t3Outer / 2,
};

const roundTripFuel = (tier: NeutralTier): number =>
  missionFuel(REFERENCE_FLEET, (CAPITAL_RADIUS - TIER_RADIUS[tier]) * GALAXY.radius, 2);

/** Raid every `hours`, DECISIVE, cargo never the limit; returns the haul of the LAST raid. */
function steadyStateHaul(tier: NeutralTier, hours: number, raids = 80): number {
  const cap = neutralDeuteriumCap(tier);
  const perHour = MULTI_WORLD.neutral[tier].deuteriumPerHour;
  let stock = cap;
  let haul = 0;
  for (let i = 0; i < raids; i++) {
    stock = neutralDeuteriumAt(stock, cap, perHour, hours);
    const loot = scaleNeutralDeuteriumLoot(computeLoot(
      { alloy: 0, crystal: 0, deuterium: stock },
      { alloy: 0, crystal: 0, deuterium: 0 },
      { alloy: 0, crystal: 0, deuterium: 0 },
      'DECISIVE',
      Number.MAX_SAFE_INTEGER,
    ), tier);
    stock -= loot.fromStock.deuterium;
    haul = loot.deuterium;
  }
  return haul;
}

describe('caretaker deuterium production', () => {
  it('leaves T1 without production and gives T2 and T3 a rising trickle', () => {
    expect(MULTI_WORLD.neutral[1].deuteriumPerHour).toBe(0);
    expect(MULTI_WORLD.neutral[2].deuteriumPerHour).toBeGreaterThan(0);
    expect(MULTI_WORLD.neutral[3].deuteriumPerHour)
      .toBeGreaterThan(MULTI_WORLD.neutral[2].deuteriumPerHour);
  });

  it('keeps the production well below a commander plant that costs real research', () => {
    // A T3 world must not out-produce a level-15 plant: it is a trickle, not a mine.
    expect(MULTI_WORLD.neutral[3].deuteriumPerHour).toBeLessThan(deuteriumRate(15));
  });

  it('sizes the refill ceiling as the seeded stockpile, from the template', () => {
    for (const tier of [1, 2, 3] as const) {
      const t = MULTI_WORLD.neutral[tier];
      expect(neutralDeuteriumCap(tier)).toBe(deuteriumStorageCap(
        deuteriumRate(t.buildings.DEUTERIUM_PLANT),
        crystalRate(t.buildings.EXTRACTOR),
        t.buildings.VAULT,
      ));
      expect(neutralDeuteriumCap(tier)).toBeGreaterThan(0);
    }
  });
});

describe('neutralDeuteriumAt', () => {
  it('adds rate x hours', () => {
    expect(neutralDeuteriumAt(100, 1_000, 24, 5)).toBe(220);
  });

  it('stops at the ceiling', () => {
    expect(neutralDeuteriumAt(990, 1_000, 24, 5)).toBe(1_000);
  });

  it('never takes anything away from a stock already over the ceiling', () => {
    expect(neutralDeuteriumAt(1_500, 1_000, 24, 5)).toBe(1_500);
  });

  it('does nothing without a rate, without time, or with time running backwards', () => {
    expect(neutralDeuteriumAt(100, 1_000, 0, 50)).toBe(100);
    expect(neutralDeuteriumAt(100, 1_000, 24, 0)).toBe(100);
    expect(neutralDeuteriumAt(100, 1_000, 24, -3)).toBe(100);
  });
});

describe('caretaker deuterium calibration — profit and loss against the flight fuel', () => {
  it('leaves T1 exactly as it was: nothing comes back once the stockpile is drained', () => {
    expect(steadyStateHaul(1, 15)).toBe(0);
  });

  it.each([2, 3] as const)('T%i: a raid every 12-18 hours pays more than its fuel', (tier) => {
    const fuel = roundTripFuel(tier);
    for (const hours of HOUR_PERIODS.worth) {
      expect(steadyStateHaul(tier, hours), `${String(hours)} h`).toBeGreaterThan(fuel * 1.1);
    }
  });

  it.each([2, 3] as const)('T%i: raiding every 2 or 6 hours does not pay its fuel', (tier) => {
    const fuel = roundTripFuel(tier);
    expect(steadyStateHaul(tier, 2)).toBeLessThan(fuel * 0.25);
    expect(steadyStateHaul(tier, 6)).toBeLessThan(fuel * 0.75);
  });

  it.each([2, 3] as const)('T%i: the first raid on a fresh stockpile still pays well', (tier) => {
    const stock = neutralDeuteriumCap(tier);
    const loot = scaleNeutralDeuteriumLoot(computeLoot(
      { alloy: 0, crystal: 0, deuterium: stock },
      { alloy: 0, crystal: 0, deuterium: 0 },
      { alloy: 0, crystal: 0, deuterium: 0 },
      'DECISIVE',
      Number.MAX_SAFE_INTEGER,
    ), tier);
    expect(loot.deuterium).toBeGreaterThan(roundTripFuel(tier));
  });

  it('prices the reference fleet from real hulls', () => {
    for (const hull of Object.keys(REFERENCE_FLEET)) expect(hull in HULLS).toBe(true);
  });
});
