import { describe, expect, it } from 'vitest';
import {
  MOON,
  RESEARCH_PROJECTS,
  researchEffectAt,
  researchMinutes,
  researchOrderMinutes,
  MOON_RARITIES,
  birthRarityWeights,
  crackLimit,
  dockFree,
  effectiveCracks,
  fleetSizeClass,
  gateCapacity,
  gateChargeMs,
  gozcuSees,
  jumpCapacity,
  jumpFuel,
  missionFuel,
  moonBirthChance,
  moonsEnabled,
  replaces,
  rollMoonBirth,
  scanPierces,
  scanRange,
  seedMoonPlan,
  strikeMoon,
  type MoonRarity,
  type NeutralSlot,
} from '../src/index.js';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 11, 27);
const at = (ms: number): number => T0 + ms;

describe('moon tables (S12, S17, S19, S20)', () => {
  it('rarity scales gate capacity, charge, scan range and crack limit', () => {
    expect(MOON_RARITIES).toEqual(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
    expect(MOON_RARITIES.map(gateCapacity)).toEqual([470, 1550, 3250, 7270]);
    expect(MOON_RARITIES.map(gateChargeMs)).toEqual([6 * HOUR, 4 * HOUR, 3 * HOUR, 2 * HOUR]);
    expect(MOON_RARITIES.map(scanRange)).toEqual([1500, 2250, 3000, 4000]);
    expect(MOON_RARITIES.map(crackLimit)).toEqual([3, 5, 7, 9]);
    expect(MOON_RARITIES.map(scanPierces)).toEqual([false, false, false, true]);
  });

  it('keeps the approved timings', () => {
    expect(MOON.rulesetVersion).toBe(20);
    expect(MOON.hopSeconds).toBe(90);
    expect(MOON.gateOpenSeconds).toBe(10);
    expect(MOON.scanCost).toEqual({ deuterium: 30 });
    expect(MOON.strikeCloseHours).toBe(3);
    expect(MOON.crackHealHours).toBe(24);
  });
});

describe('moonsEnabled', () => {
  it('opens only in a MAIN galaxy dealt ruleset 20 or later', () => {
    expect(moonsEnabled({ rulesetVersion: 20 }, { role: 'MAIN' })).toBe(true);
    expect(moonsEnabled({ rulesetVersion: 21 }, { role: 'MAIN' })).toBe(true);
    expect(moonsEnabled({ rulesetVersion: 19 }, { role: 'MAIN' })).toBe(false);
    expect(moonsEnabled({ rulesetVersion: 20 }, { role: 'WAITING' })).toBe(false);
  });

  it('opens in a live season dealt an older ruleset once moons are activated there (owner 2026-11-24)', () => {
    const at = new Date('2026-11-25T00:00:00Z');
    expect(moonsEnabled({ rulesetVersion: 19, moonsStartsAt: at }, { role: 'MAIN' })).toBe(true);
    expect(moonsEnabled({ rulesetVersion: 19, moonsStartsAt: null }, { role: 'MAIN' })).toBe(false);
    expect(moonsEnabled({ rulesetVersion: 19, moonsStartsAt: at }, { role: 'WAITING' })).toBe(false);
  });
});

describe('cracks (S19)', () => {
  const fresh = { rarity: 'COMMON' as MoonRarity, cracks: 0, lastHitAtMs: null };

  it('a hit opens a crack and closes gate and Gözcü for 3 hours', () => {
    const hit = strikeMoon(fresh, at(0));
    expect(hit).toEqual({ cracks: 1, lastHitAtMs: at(0), closedUntilMs: at(3 * HOUR), explodes: false });
  });

  it('cracks heal exactly 24 hours after the last hit, not a moment before', () => {
    const moon = { cracks: 2, lastHitAtMs: at(0) };
    expect(effectiveCracks(moon, at(24 * HOUR - 1))).toBe(2);
    expect(effectiveCracks(moon, at(24 * HOUR))).toBe(0);
    expect(effectiveCracks({ cracks: 0, lastHitAtMs: null }, at(0))).toBe(0);
  });

  it('a hit after healing starts again from one', () => {
    const healed = { rarity: 'RARE' as MoonRarity, cracks: 4, lastHitAtMs: at(0) };
    expect(strikeMoon(healed, at(24 * HOUR)).cracks).toBe(1);
    expect(strikeMoon(healed, at(24 * HOUR - 1))).toMatchObject({ cracks: 5, explodes: true });
  });

  it('explodes exactly at the rarity threshold', () => {
    for (const rarity of MOON_RARITIES) {
      const limit = crackLimit(rarity);
      const before = { rarity, cracks: limit - 2, lastHitAtMs: at(0) };
      expect(strikeMoon(before, at(HOUR)).explodes).toBe(false);
      expect(strikeMoon({ ...before, cracks: limit - 1 }, at(HOUR)).explodes).toBe(true);
    }
  });
});

describe('battle birth (S9, S44, §3.2)', () => {
  it('rolls nothing under 10k wreck, 1 % per 5k above, capped at 20 %', () => {
    expect(moonBirthChance(9_999)).toBe(0);
    expect(moonBirthChance(10_000)).toBeCloseTo(0.02, 12);
    expect(moonBirthChance(50_000)).toBeCloseTo(0.10, 12);
    expect(moonBirthChance(100_000)).toBeCloseTo(0.20, 12);
    expect(moonBirthChance(500_000)).toBe(0.20);
    expect(moonBirthChance(Number.NaN)).toBe(0);
  });

  it('rarity weights move linearly from 60/30/9/1 at 2 % to 30/35/25/10 at 20 %', () => {
    expect(birthRarityWeights(0.02)).toEqual([60, 30, 9, 1]);
    expect(birthRarityWeights(0.20)).toEqual([30, 35, 25, 10]);
    const mid = birthRarityWeights(0.11);
    expect(mid[0]).toBeCloseTo(45, 9);
    expect(mid[1]).toBeCloseTo(32.5, 9);
    expect(mid[2]).toBeCloseTo(17, 9);
    expect(mid[3]).toBeCloseTo(5.5, 9);
  });

  it('is deterministic for a seed and never births under the threshold', () => {
    expect(rollMoonBirth(123, 80_000)).toBe(rollMoonBirth(123, 80_000));
    for (let seed = 0; seed < 500; seed++) expect(rollMoonBirth(seed, 9_999)).toBeNull();
  });

  it('births about as often as the chance says, mostly rare-or-better at the cap', () => {
    let born = 0;
    const tally: Record<MoonRarity, number> = { COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0 };
    const runs = 20_000;
    for (let seed = 0; seed < runs; seed++) {
      const rarity = rollMoonBirth(seed, 100_000);
      if (rarity) { born++; tally[rarity]++; }
    }
    expect(born / runs).toBeGreaterThan(0.18);
    expect(born / runs).toBeLessThan(0.22);
    expect(tally.COMMON / born).toBeGreaterThan(0.24);
    expect(tally.COMMON / born).toBeLessThan(0.36);
    expect(tally.LEGENDARY).toBeGreaterThan(0);
  });

  it('a new moon replaces the old one only when rarer (S11)', () => {
    expect(replaces(null, 'COMMON')).toBe(true);
    expect(replaces('RARE', 'EPIC')).toBe(true);
    expect(replaces('RARE', 'RARE')).toBe(false);
    expect(replaces('LEGENDARY', 'EPIC')).toBe(false);
  });
});

describe('dock and gate (S12, §3.4)', () => {
  it('free dock never goes below zero', () => {
    expect(dockFree('COMMON', 300, 100)).toBe(70);
    expect(dockFree('COMMON', 500, 0)).toBe(0);
  });

  it('a jump carries the smaller of the origin gate and the destination free dock', () => {
    expect(jumpCapacity('LEGENDARY', 470)).toBe(470);
    expect(jumpCapacity('COMMON', 7_270)).toBe(470);
  });

  it('a jump costs the homeward one-leg fuel of the same route', () => {
    const fleet = { DART: 40 };
    expect(jumpFuel(fleet, 1_800)).toBe(missionFuel(fleet, 1_800, 1, 'HOMEWARD'));
    expect(jumpFuel({}, 1_800)).toBe(0);
  });
});

describe('Gözcü (S15, S20, S33, S50)', () => {
  it('sees only planet-to-planet flights unless the moon is Legendary', () => {
    const flights = [
      { originBody: 'PLANET', targetBody: 'PLANET' },
      { originBody: 'MOON', targetBody: 'PLANET' },
      { originBody: 'PLANET', targetBody: 'MOON' },
      { originBody: 'MOON', targetBody: 'MOON' },
    ] as const;
    expect(flights.map((f) => gozcuSees(f, false))).toEqual([true, false, false, false]);
    expect(flights.map((f) => gozcuSees(f, true))).toEqual([true, true, true, true]);
  });

  it('reports only a rough size, bounded by the Common and Epic docks', () => {
    expect(fleetSizeClass(1)).toBe('LIGHT');
    expect(fleetSizeClass(470)).toBe('LIGHT');
    expect(fleetSizeClass(471)).toBe('MEDIUM');
    expect(fleetSizeClass(3_250)).toBe('MEDIUM');
    expect(fleetSizeClass(3_251)).toBe('HEAVY');
  });
});

describe('seeded moons (S22)', () => {
  const slots = (tier: 1 | 2 | 3, count: number, from: number): NeutralSlot[] =>
    Array.from({ length: count }, (_, i) => ({
      tier, profileSeed: i, slot: { index: from + i, x: 0, y: 0, z: 0 },
    }));
  const pool = [...slots(1, 76, 1000), ...slots(2, 38, 2000), ...slots(3, 16, 3000)];

  it('places ~20 moons in the approved split', () => {
    const plan = seedMoonPlan(42, pool);
    const byTier = (tier: number) => [...plan.entries()]
      .filter(([index]) => pool.find((n) => n.slot.index === index)?.tier === tier)
      .map(([, rarity]) => rarity);
    expect(byTier(1)).toHaveLength(8);
    expect(byTier(1).every((r) => r === 'COMMON' || r === 'RARE')).toBe(true);
    expect(byTier(2)).toHaveLength(7);
    expect(byTier(2).every((r) => r === 'RARE' || r === 'EPIC')).toBe(true);
    const t3 = byTier(3);
    expect(t3.filter((r) => r === 'EPIC')).toHaveLength(4);
    const legendary = t3.filter((r) => r === 'LEGENDARY').length;
    expect(legendary === 1 || legendary === 2).toBe(true);
    expect(plan.size).toBeGreaterThanOrEqual(20);
    expect(plan.size).toBeLessThanOrEqual(21);
  });

  it('is deterministic and does not depend on the order worlds open in', () => {
    const a = seedMoonPlan(7, pool);
    const b = seedMoonPlan(7, [...pool].reverse());
    expect([...a.entries()].sort()).toEqual([...b.entries()].sort());
    expect([...seedMoonPlan(8, pool).keys()].sort()).not.toEqual([...a.keys()].sort());
  });

  it('a galaxy with fewer neutral slots than planned seeds what it has', () => {
    const small = [...slots(1, 3, 1000), ...slots(3, 2, 3000)];
    const plan = seedMoonPlan(1, small);
    expect(plan.size).toBe(5);
  });
});

/*
  V34 (owner 2026-11-19, V28–V29): Lunar Capture is a Core 9 permission at a set price and a set time; the
  Common moon it opens is built at a set price and a set time. Neither follows the economy profile, the
  crystal discount or the Core's construction speed.
*/
describe('Lunar Capture and the Common moon', () => {
  it('prices Lunar Capture as the owner set it: 20k alloy, 10k crystal, 500 deuterium, four hours, Core 9', () => {
    const project = RESEARCH_PROJECTS.LUNAR_CAPTURE;
    expect(project.maxLevel).toBe(1);
    expect(project.requiredCore).toBe(9);
    expect(project.prerequisite).toBeNull();
    expect(project.costAt(1)).toEqual({ alloy: 20_000, crystal: 10_000, deuterium: 500 });
    for (const core of [9, 12, 15]) expect(researchOrderMinutes('LUNAR_CAPTURE', project.costAt(1), core)).toBe(240);
    expect(researchEffectAt('LUNAR_CAPTURE', 1)).toBe(1);
    expect(researchEffectAt('LUNAR_CAPTURE', 0)).toBe(0);
  });

  it('keeps every other project on the Core’s construction speed', () => {
    const cost = RESEARCH_PROJECTS.SHIP_POWER.costAt(1);
    expect(researchOrderMinutes('SHIP_POWER', cost, 9)).toBe(researchMinutes(cost, 9));
  });

  it('builds a Common moon for 25k alloy and 15k crystal in eight hours', () => {
    expect(MOON.build).toEqual({ cost: { alloy: 25_000, crystal: 15_000, deuterium: 0 }, minutes: 480 });
  });
});
