import { describe, expect, it } from 'vitest';
import {
  COSMETICS, GALAXY, HULLS, MULTI_WORLD, UNKNOWN_SIGNAL,
  distance, generateGalaxy, placeUnknownSignal, radarContactRange,
  rollUnknownSignalOutcome, rollUnknownSignalResources, unknownSignalOdds, validateUnknownSignalFleet,
  type CosmeticId, type Vec3,
} from '../src/index.js';

const ORIGIN = { x: 0, y: 0, z: 0 };
const eligibleSkins = COSMETICS.filter(item =>
  (item.category === 'FLAG' && !item.free)
  || item.category === 'RING'
  || ['planet-lava', 'planet-ice', 'planet-desert', 'planet-toxic'].includes(item.id));
const ownedPool = eligibleSkins.map(item => item.id);

describe('unknown signal owner decisions', () => {
  it('keeps eligibility, lifetime, cadence and placement limits explicit', () => {
    expect(UNKNOWN_SIGNAL.tiers).toEqual([1, 2, 3]);
    expect(UNKNOWN_SIGNAL.gapMinutes).toEqual([120, 240]);
    expect(UNKNOWN_SIGNAL.lifetimeMinutes).toBe(60);
    expect(UNKNOWN_SIGNAL.minFromCapital).toBe(400);
    expect(UNKNOWN_SIGNAL.minFromAnyPlanet).toBe(250);
    expect(UNKNOWN_SIGNAL.placementAttempts).toBe(40);
    expect(UNKNOWN_SIGNAL.noRadarRangeLevel).toBe(1);
    expect(UNKNOWN_SIGNAL.outcomeWeights).toEqual({
      RESOURCES: 56, ENERGY: 15, DERELICT: 12, PIRATES: 16, SKIN: 1,
    });
  });
});

/*
  Owner, 2026-10-20: a first-game commander's first signal comes within 2–10 minutes and never
  holds pirates — "daha ilk tutunda korsan denk getirip filosunu öldürmeyelim".
*/
describe('the first signal of a first game', () => {
  it('arrives within 2–10 minutes, before any ordinary signal could', () => {
    expect(UNKNOWN_SIGNAL.firstGameGapMinutes).toEqual([2, 10]);
    expect(UNKNOWN_SIGNAL.firstGameGapMinutes[1]).toBeLessThan(UNKNOWN_SIGNAL.gapMinutes[0]);
  });

  it('never rolls pirates, and every seed that would have keeps its non-pirate roll otherwise', () => {
    const kinds = new Set<string>();
    let unchanged = true;
    for (let seed = 0; seed < 20_000; seed++) {
      const spared = rollUnknownSignalOutcome(seed, 1, [], false);
      kinds.add(spared.kind);
      const ordinary = rollUnknownSignalOutcome(seed, 1, []);
      if (ordinary.kind !== 'PIRATES' && JSON.stringify(ordinary) !== JSON.stringify(spared)) unchanged = false;
    }
    expect(kinds.has('PIRATES')).toBe(false);
    expect([...kinds].sort()).toEqual(['DERELICT', 'ENERGY', 'RESOURCES', 'SKIN']);
    expect(unchanged).toBe(true);
  });

  it('shows the odds the roll uses: the ordinary table, or pirates at zero and the rest rescaled', () => {
    expect(unknownSignalOdds(true)).toEqual(UNKNOWN_SIGNAL.outcomeWeights);
    const spared = unknownSignalOdds(false);
    expect(spared).toEqual({ RESOURCES: 67, ENERGY: 18, DERELICT: 14, PIRATES: 0, SKIN: 1 });
    expect(Object.values(spared).reduce((sum, value) => sum + value, 0)).toBe(100);
  });
});

describe('unknown signal resource roll', () => {
  it('honours every resource bound and samples all seven subsets equally over 30k seeds', () => {
    const subsets = new Map<string, number>();
    let maximumAlloyOnly = 0;
    let maximumCrystalOnly = 0;
    let minimumDeuteriumOnly = Infinity;
    let maximumDeuteriumOnly = 0;
    let valid = true;
    for (let seed = 0; seed < 30_000; seed++) {
      const loot = rollUnknownSignalResources(seed);
      const { alloy: a, crystal: c, deuterium: d } = loot;
      const subset = `${a > 0 ? 'A' : ''}${c > 0 ? 'C' : ''}${d > 0 ? 'D' : ''}`;
      subsets.set(subset, (subsets.get(subset) ?? 0) + 1);
      valid &&= Object.values(loot).every(Number.isSafeInteger)
        && a >= 0 && c >= 0 && d >= 0
        && a + c + d <= 1000 && d <= 100
        && (a === 0 || a >= 200) && (c === 0 || c >= 100) && (d === 0 || d >= 10)
        && a % 10 === 0 && c % 10 === 0;
      if (subset === 'A') maximumAlloyOnly = Math.max(maximumAlloyOnly, a);
      if (subset === 'C') maximumCrystalOnly = Math.max(maximumCrystalOnly, c);
      if (subset === 'D') {
        minimumDeuteriumOnly = Math.min(minimumDeuteriumOnly, d);
        maximumDeuteriumOnly = Math.max(maximumDeuteriumOnly, d);
      }
    }
    expect(valid).toBe(true);
    expect([...subsets.keys()].sort()).toEqual(['A', 'AC', 'ACD', 'AD', 'C', 'CD', 'D']);
    for (const count of subsets.values()) expect(Math.abs(count / 30_000 - 1 / 7)).toBeLessThan(0.01);
    expect(maximumAlloyOnly).toBe(1000);
    expect(maximumCrystalOnly).toBe(1000);
    expect(minimumDeuteriumOnly).toBe(10);
    expect(maximumDeuteriumOnly).toBe(100);
  });

  it('is deterministic for persisted string seeds as well as numeric seeds', () => {
    for (const seed of [0, -1, 2 ** 32 - 1, 'season:player:14']) {
      expect(rollUnknownSignalResources(seed)).toEqual(rollUnknownSignalResources(seed));
    }
  });
});

describe('unknown signal outcomes', () => {
  it('matches all five probabilities within one percentage point over 100k seeds', () => {
    const counts = { RESOURCES: 0, ENERGY: 0, DERELICT: 0, PIRATES: 0, SKIN: 0 };
    const hours = new Set<number>();
    const awarded = new Set<CosmeticId>();
    for (let seed = 0; seed < 100_000; seed++) {
      const result = rollUnknownSignalOutcome(seed, 1, []);
      counts[result.kind]++;
      if (result.kind === 'ENERGY') hours.add(result.hours);
      if (result.kind === 'SKIN') awarded.add(result.cosmeticId);
      if (result.kind === 'RESOURCES') expect(result.loot).toEqual(rollUnknownSignalResources(seed));
    }
    for (const kind of ['RESOURCES', 'ENERGY', 'DERELICT', 'PIRATES', 'SKIN'] as const) {
      expect(Math.abs(counts[kind] / 1000 - UNKNOWN_SIGNAL.outcomeWeights[kind])).toBeLessThan(1);
    }
    expect([...hours].sort()).toEqual([1, 2, 3, 4]);
    expect([...awarded].sort()).toEqual([...ownedPool].sort());
  });

  it.each([1, 2, 3] as const)('keeps the derelict tier table, warship pool and uniform damage at dispatch tier %i', tier => {
    const tiers = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const damageBands = [0, 0, 0, 0];
    const hulls = new Set<string>();
    let valid = true;
    for (let seed = 0; seed < 100_000; seed++) {
      const result = rollUnknownSignalOutcome(seed, tier, []);
      if (result.kind !== 'DERELICT') continue;
      const hull = HULLS[result.hull];
      if (hull.tier === null) throw new Error('Preserved hull cannot be a derelict reward');
      tiers[hull.tier]++;
      hulls.add(result.hull);
      valid &&= !hull.ground && (hull.family === 'OFFENSIVE' || hull.family === 'DEFENSIVE')
        && Number.isInteger(result.damageBp) && result.damageBp >= 2000 && result.damageBp <= 6000;
      const band = Math.min(3, Math.floor((result.damageBp - 2000) / 1000));
      damageBands[band] = (damageBands[band] ?? 0) + 1;
    }
    expect(valid).toBe(true);
    expect(tiers[4]).toBe(0);
    const total = Object.values(tiers).reduce((sum, n) => sum + n, 0);
    const expected = tier === 1 ? [80, 15, 5] : tier === 2 ? [0, 90, 10] : [0, 0, 100];
    for (const shipTier of [1, 2, 3] as const) {
      expect(Math.abs(tiers[shipTier] / total * 100 - (expected[shipTier - 1] ?? 0))).toBeLessThan(1);
    }
    for (const count of damageBands) expect(Math.abs(count / total - 0.25)).toBeLessThan(0.02);
    const expectedHulls = Object.values(HULLS).filter(hull => !hull.ground && hull.tier !== null && hull.tier >= tier && hull.tier <= 3
      && (hull.family === 'OFFENSIVE' || hull.family === 'DEFENSIVE')).map(hull => hull.id);
    expect([...hulls].sort()).toEqual(expectedHulls.sort());
  });

  it('uses the paid flag / element / ring distribution of 70 / 15 / 15', () => {
    const counts = { FLAG: 0, PLANET: 0, RING: 0 };
    for (let seed = 0; seed < 300_000; seed++) {
      const result = rollUnknownSignalOutcome(seed, 1, []);
      if (result.kind !== 'SKIN') continue;
      const skin = eligibleSkins.find(item => item.id === result.cosmeticId);
      if (!skin) throw new Error('Ineligible cosmetic reward');
      if (skin.category === 'FLAG' || skin.category === 'PLANET' || skin.category === 'RING') counts[skin.category]++;
    }
    const total = counts.FLAG + counts.PLANET + counts.RING;
    expect(total).toBeGreaterThan(2500);
    expect(Math.abs(counts.FLAG / total - 0.7)).toBeLessThan(0.03);
    expect(Math.abs(counts.PLANET / total - 0.15)).toBeLessThan(0.03);
    expect(Math.abs(counts.RING / total - 0.15)).toBeLessThan(0.03);
  });

  it('falls back through unowned categories in fixed order, then to the same seed resources', () => {
    const flags = eligibleSkins.filter(item => item.category === 'FLAG').map(item => item.id);
    const elements = eligibleSkins.filter(item => item.category === 'PLANET').map(item => item.id);
    const rings = eligibleSkins.filter(item => item.category === 'RING').map(item => item.id);
    const seen = new Set<string>();
    for (let seed = 0; seed < 10_000; seed++) {
      const result = rollUnknownSignalOutcome(seed, 1, []);
      if (result.kind !== 'SKIN') continue;
      const skin = eligibleSkins.find(item => item.id === result.cosmeticId);
      if (!skin) throw new Error('Ineligible cosmetic reward');
      seen.add(skin.category);
      const category = skin.category === 'FLAG' ? flags : skin.category === 'PLANET' ? elements : rings;
      const expectedFallback = skin.category === 'FLAG' ? elements : flags;
      const fallback = rollUnknownSignalOutcome(seed, 1, category);
      expect(fallback.kind).toBe('SKIN');
      if (fallback.kind === 'SKIN') expect(expectedFallback).toContain(fallback.cosmeticId);
      const onlyRing = rollUnknownSignalOutcome(seed, 1, [...flags, ...elements]);
      expect(onlyRing.kind).toBe('SKIN');
      if (onlyRing.kind === 'SKIN') expect(rings).toContain(onlyRing.cosmeticId);
      expect(rollUnknownSignalOutcome(seed, 1, ownedPool)).toEqual({
        kind: 'RESOURCES', loot: rollUnknownSignalResources(seed),
      });
      const almostAll = ownedPool.filter(id => id !== result.cosmeticId);
      expect(rollUnknownSignalOutcome(seed, 1, almostAll)).toEqual(result);
      expect(rollUnknownSignalOutcome(seed, 1, [...almostAll].reverse())).toEqual(result);
    }
    expect([...seen].sort()).toEqual(['FLAG', 'PLANET', 'RING']);
  });

  it('is deterministic and returns fresh, independent results', () => {
    for (const seed of [0, 1, -1, 'season:player:1']) {
      const first = rollUnknownSignalOutcome(seed, 2, []);
      const before = structuredClone(first);
      if (first.kind === 'RESOURCES') first.loot.alloy = -1;
      expect(rollUnknownSignalOutcome(seed, 2, [])).toEqual(before);
    }
  });
});

describe('unknown signal fleet validation', () => {
  it.each(['DART', 'PIKE', 'RAMPART', 'WARDEN'])('accepts exactly one %s and one Courier', hull => {
    expect(validateUnknownSignalFleet({ [hull]: 1, COURIER: 1 })).toBe(true);
  });

  it.each([
    {}, { COURIER: 1 }, { DART: 1 }, { DART: 2, COURIER: 1 },
    { DART: 1, PIKE: 1, COURIER: 1 }, { VIPER: 1, COURIER: 1 },
    { DART: 1, WAYFARER: 1 }, { DART: -1, COURIER: 1 },
    { DART: 0, COURIER: 1 }, { DART: 0.5, COURIER: 1 },
    { DART: Number.NaN, COURIER: 1 }, { DART: Infinity, COURIER: 1 },
    { DART: 1, COURIER: -1 }, { DART: 1, COURIER: 0.5 },
    { DART: 1, COURIER: Number.NaN }, { DART: 1, COURIER: Infinity },
    { UNKNOWN: 1, COURIER: 1 }, { DART: 1, COURIER: 1, UNKNOWN: 0 },
    { DART: 1, COURIER: 1, PIKE: 0 }, { DART: undefined, COURIER: 1 },
  ])('rejects invalid composition %#', fleet => {
    expect(validateUnknownSignalFleet(fleet)).toBe(false);
  });
});

describe('unknown signal placement', () => {
  it.each([0, 1, 3, 8])('uses radar level %i in actual game coordinates', radarLevel => {
    const capital = { x: 3200, y: 800, z: -1000 };
    const planets = [capital, { x: 2200, y: 600, z: -2000 }];
    const reach = radarContactRange(Math.max(1, radarLevel));
    let found = 0;
    for (let seed = 0; seed < 200; seed++) {
      const at = placeUnknownSignal(seed, capital, planets, radarLevel, GALAXY.radius);
      if (!at) continue;
      found++;
      expect(distance(capital, at)).toBeGreaterThanOrEqual(400);
      expect(distance(capital, at)).toBeLessThanOrEqual(reach);
      expect(distance(ORIGIN, at)).toBeLessThanOrEqual(GALAXY.radius);
      for (const planet of planets) expect(distance(planet, at)).toBeGreaterThanOrEqual(250);
    }
    expect(found).toBeGreaterThan(190);
    expect(placeUnknownSignal('same', capital, planets, radarLevel, GALAXY.radius))
      .toEqual(placeUnknownSignal('same', capital, [...planets].reverse(), radarLevel, GALAXY.radius));
  });

  it('gives radar 0 exactly the L1 search area of 2700', () => {
    expect(radarContactRange(1)).toBe(2700);
    for (let seed = 0; seed < 50; seed++) {
      expect(placeUnknownSignal(seed, ORIGIN, [], 0, GALAXY.radius))
        .toEqual(placeUnknownSignal(seed, ORIGIN, [], 1, GALAXY.radius));
    }
  });

  it('samples a sphere, preserving all three axes rather than using render coordinates', () => {
    const sums = { x: 0, y: 0, z: 0 };
    let count = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const at = placeUnknownSignal(seed, ORIGIN, [], 1, GALAXY.radius);
      if (!at) throw new Error('Empty volume must accept a candidate');
      count++;
      sums.x += at.x ** 2;
      sums.y += at.y ** 2;
      sums.z += at.z ** 2;
    }
    const variance = (sums.x + sums.y + sums.z) / (3 * count);
    for (const value of Object.values(sums)) expect(value / count / variance).toBeCloseTo(1, 1);
  });

  it('respects actual full-galaxy planet addresses', () => {
    const planets = generateGalaxy(4242, MULTI_WORLD.neutralSlotPool).slots;
    for (const capital of planets.slice(0, 20)) {
      const at = placeUnknownSignal(`capital:${String(capital.index)}`, capital, planets, 1, GALAXY.radius);
      expect(at).not.toBeNull();
      if (!at) continue;
      expect(distance(capital, at)).toBeGreaterThanOrEqual(400);
      for (const planet of planets) expect(distance(planet, at)).toBeGreaterThanOrEqual(250);
    }
  });

  it('returns null in a fully obstructed volume without an unbounded search or fallback', () => {
    const planets: Vec3[] = [];
    for (let x = -2800; x <= 2800; x += 250) {
      for (let y = -2800; y <= 2800; y += 250) {
        for (let z = -2800; z <= 2800; z += 250) planets.push({ x, y, z });
      }
    }
    expect(placeUnknownSignal('full', ORIGIN, planets, 1, GALAXY.radius)).toBeNull();
    expect(placeUnknownSignal('too-small', ORIGIN, [], 1, 399)).toBeNull();
  });
});
