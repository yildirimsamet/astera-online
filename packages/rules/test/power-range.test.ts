import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS,
  COMBAT_RESEARCH_PROJECTS,
  HULLS,
  INTEL,
  RESEARCH_MAX_LEVEL,
  classReading,
  combatValue,
  exactPowerRange,
  fuzzBand,
  matchup,
  mulberry32,
  powerUnits,
  readPowerRange,
  researchReading,
  type Fleet,
  type TechLevels,
} from '../src/index.js';

/**
 * GÖRECELİ GÜÇ ARALIĞI — combat v3, owner 2026-10-25 (docs/combat-v3-plan-2026-10-25.md §4).
 *
 * A probe reads a wall as ranges; the attack sheet shows what those ranges allow against the
 * wing being packed: the best and the worst matchup, never one guessed figure.
 */
const FIRING = ALL_HULLS.filter((id) => HULLS[id].atk > 0 && HULLS[id].cls !== 'SUPPORT');
const WINGS: Fleet[] = [{ DART: 40 }, { PIKE: 30, SENTINEL: 10 }, { CORSAIR: 8, CATACLYSM: 4, PALADIN: 4 }, { NULLIFIER: 6, CITADEL: 3 }];

const wallArb = fc.array(fc.tuple(fc.constantFrom(...FIRING), fc.integer({ min: 1, max: 40 })), { minLength: 1, maxLength: 5 })
  .map((rows) => {
    const wall: Fleet = {};
    for (const [id, n] of rows) wall[id] = (wall[id] ?? 0) + n;
    return wall;
  });
const levelsArb = fc.record(Object.fromEntries(COMBAT_RESEARCH_PROJECTS.map((id) => [id, fc.integer({ min: 0, max: RESEARCH_MAX_LEVEL[id] })]))) as fc.Arbitrary<TechLevels>;

/** Everything a probe of this accuracy brings home about `wall`, as the server writes it. */
function probe(wall: Fleet, levels: TechLevels, shield: number, accuracy: number, seed: number) {
  const rng = mulberry32(seed);
  return {
    lines: [{ value: fuzzBand(combatValue(wall), accuracy, rng), shape: classReading(wall, accuracy, rng), research: researchReading(levels, accuracy, rng) }],
    aegis: fuzzBand(shield, accuracy, rng),
  };
}

const truthOf = (wing: Fleet, wall: Fleet, levels: TechLevels, shield: number) =>
  matchup({ units: powerUnits(wing, { tech: {} }) }, { units: powerUnits(wall, { tech: levels }), aegis: shield });

describe('the power range a probe reading allows', () => {
  it('holds the true matchup ratio and their true power, whatever the wall, research, Aegis and probe', () => {
    fc.assert(fc.property(
      wallArb, levelsArb, fc.constantFrom(0, 0, 12_000, 60_000), fc.constantFrom(...WINGS),
      fc.double({ min: INTEL.accuracyMin, max: INTEL.accuracyMax, noNaN: true }), fc.integer(),
      (wall, levels, shield, wing, accuracy, seed) => {
        const reading = probe(wall, levels, shield, accuracy, seed);
        const range = readPowerRange({ fleet: wing, tech: {} }, reading.lines, reading.aegis)!;
        const truth = truthOf(wing, wall, levels, shield);
        const ratio = truth.attacker.power / truth.defender.power;
        const inside = (value: number, span: { low: number; high: number }, slack = 1e-9) =>
          value >= span.low * (1 - slack) && value <= span.high * (1 + slack);
        // Their hull choice moves how a wing's counters land a little: the wing's own figure keeps 3%.
        return inside(ratio, range.ratio) && inside(truth.defender.power, range.theirs) && inside(truth.attacker.power, range.mine, 0.03);
      },
    ), { numRuns: 400 });
  });

  it('narrows as the probe improves', () => {
    const wall = { CORSAIR: 12, CITADEL: 6, HARPOON: 8 }, levels = { SHIP_POWER: 3, SHIP_ARMOR: 2 };
    const width = (accuracy: number) => {
      let sum = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const reading = probe(wall, levels, 20_000, accuracy, seed);
        const r = readPowerRange({ fleet: WINGS[2]!, tech: {} }, reading.lines, reading.aegis)!;
        sum += Math.log(r.ratio.high / r.ratio.low);
      }
      return sum / 40;
    };
    expect(width(INTEL.accuracyMax)).toBeLessThan(width(0.55));
    expect(width(0.55)).toBeLessThan(width(INTEL.accuracyMin));
  });

  it('reads the low end as the worse case for the wing: ratio low ≤ high, theirs low ≤ high', () => {
    const reading = probe({ TALON: 20, SENTINEL: 10 }, { SHIP_SHIELDS: 2 }, 5_000, 0.67, 3);
    const r = readPowerRange({ fleet: { VIPER: 30 }, tech: {} }, reading.lines, reading.aegis)!;
    expect(r.ratio.low).toBeLessThanOrEqual(r.ratio.high);
    expect(r.theirs.low).toBeLessThanOrEqual(r.theirs.high);
    expect(r.mine.low).toBeLessThanOrEqual(r.mine.high);
    expect(r.ratio.low).toBeGreaterThan(0);
  });

  it('opens unread research to the whole ladder, and a missing project to nothing', () => {
    const wall = { BALLISTA: 10, PRAETORIAN: 5 };
    const line = { value: { low: 40_000, high: 50_000 }, shape: classReading(wall, INTEL.accuracyMax, mulberry32(1)) };
    const unread = readPowerRange({ fleet: { DART: 60 }, tech: {} }, [line], { low: 0, high: 0 })!;
    const none = readPowerRange({ fleet: { DART: 60 }, tech: {} }, [{ ...line, research: {} }], { low: 0, high: 0 })!;
    expect(unread.theirs.high).toBeGreaterThan(none.theirs.high);
    expect(unread.theirs.low).toBeCloseTo(none.theirs.low, 6);
  });

  it('reads the class steps of reports written before combat v3', () => {
    const wall: Fleet = { BASTION: 6, DART: 4 }, wing: Fleet = { PIKE: 50 };
    const truth = truthOf(wing, wall, {}, 0);
    const ratio = truth.attacker.power / truth.defender.power;
    const value = { low: combatValue(wall) * 0.9, high: combatValue(wall) * 1.1 };
    for (const shape of [
      { kind: 'DOMINANT', cls: 'BULWARK' },
      { kind: 'SHARES', shares: { SKIRMISHER: 10, BULWARK: 90, LANCE: 0 } },
      { kind: 'UNREAD' },
      null,
    ] as const) {
      const r = readPowerRange({ fleet: wing, tech: {} }, [{ value, shape, research: {} }], { low: 0, high: 0 })!;
      expect(r.ratio.low, JSON.stringify(shape)).toBeLessThanOrEqual(ratio);
      expect(r.ratio.high, JSON.stringify(shape)).toBeGreaterThanOrEqual(ratio);
    }
  });

  it('meets a clan’s support as one wall with the host', () => {
    const host: Fleet = { SENTINEL: 10 }, support: Fleet = { CORSAIR: 6 }, wing: Fleet = { VIPER: 40, TALON: 10 };
    const levels = { SHIP_ARMOR: 2 };
    const exact = (fleet: Fleet) => ({ low: combatValue(fleet), high: combatValue(fleet) });
    const r = readPowerRange({ fleet: wing, tech: {} }, [
      { value: exact(host), shape: classReading(host, INTEL.accuracyMax, mulberry32(2)), research: { SHIP_ARMOR: { low: 2, high: 3 } } },
      { value: exact(support), shape: classReading(support, INTEL.accuracyMax, mulberry32(3)) },
    ], { low: 0, high: 0 })!;
    const truth = matchup({ units: powerUnits(wing, { tech: {} }) },
      { units: [...powerUnits(host, { tech: levels }), ...powerUnits(support, { tech: { SHIP_POWER: 4 } })] });
    expect(r.ratio.low).toBeLessThanOrEqual(truth.attacker.power / truth.defender.power);
    expect(r.ratio.high).toBeGreaterThanOrEqual(truth.attacker.power / truth.defender.power);
    const alone = readPowerRange({ fleet: wing, tech: {} }, [
      { value: exact(host), shape: classReading(host, INTEL.accuracyMax, mulberry32(2)), research: { SHIP_ARMOR: { low: 2, high: 3 } } },
    ], { low: 0, high: 0 })!;
    expect(r.theirs.low).toBeGreaterThan(alone.theirs.low);
  });

  it('reads a wall with nothing that fires as no power at all', () => {
    const r = readPowerRange({ fleet: { DART: 5 }, tech: {} }, [{ value: { low: 0, high: 0 }, shape: { kind: 'NONE' }, research: {} }], { low: 0, high: 9_000 })!;
    expect(r.theirs).toEqual({ low: 0, high: 0 });
    expect(r.ratio).toEqual({ low: Infinity, high: Infinity });
    expect(r.mine.low).toBeGreaterThan(0);
  });

  it('has nothing to say about a wing with no ships', () => {
    expect(readPowerRange({ fleet: {}, tech: {} }, [{ value: { low: 1_000, high: 2_000 } }], { low: 0, high: 0 })).toBeNull();
  });

  it('reads the wing as it flies: research, wounds and grounded hulls', () => {
    const line = [{ value: { low: 30_000, high: 30_000 }, shape: classReading({ VIPER: 27 }, INTEL.accuracyMax, mulberry32(5)), research: {} }];
    const bare = readPowerRange({ fleet: { TALON: 30 }, tech: {} }, line, { low: 0, high: 0 })!;
    const armed = readPowerRange({ fleet: { TALON: 30 }, tech: { SHIP_POWER: 5 } }, line, { low: 0, high: 0 })!;
    const hurt = readPowerRange({ fleet: { TALON: 30 }, tech: {}, damage: [{ hull: 'TALON', count: 30, damageBp: 5000 }] }, line, { low: 0, high: 0 })!;
    expect(armed.mine.low).toBeGreaterThan(bare.mine.low);
    expect(hurt.mine.high).toBeLessThan(bare.mine.high);
  });
});

describe('the power range of a crew seen exactly', () => {
  it('is one number: the matchup itself', () => {
    const wing: Fleet = { CORSAIR: 10 }, crew: Fleet = { TEMPEST: 12, LEVIATHAN: 4 };
    const r = exactPowerRange({ fleet: wing, tech: { SHIP_POWER: 2 } }, crew, { tech: {}, damageMult: 0.8 });
    const m = matchup({ units: powerUnits(wing, { tech: { SHIP_POWER: 2 } }) }, { units: powerUnits(crew, { tech: {}, damageMult: 0.8 }) });
    expect(r.mine).toEqual({ low: m.attacker.power, high: m.attacker.power });
    expect(r.theirs).toEqual({ low: m.defender.power, high: m.defender.power });
    expect(r.ratio.low).toBe(m.attacker.power / m.defender.power);
    expect(r.ratio.high).toBe(r.ratio.low);
  });
});
