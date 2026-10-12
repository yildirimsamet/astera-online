import { orbitFingerprint } from './orbitFingerprint.js';
import { describe, expect, it } from 'vitest';
import { COMBAT_HULLS, fleetCount, fleetEntries, HULLS } from '../src/hulls.js';
import { generatePirateHour, pirateHoard, pirateRoster } from '../src/pirates.js';
import { mulberry32 } from '../src/rng.js';
import { computeLoot } from '../src/loot.js';
import { currentPirateGeneration } from '../src/pirateGeneration.js';
import { claimPirateLoot, remainingPirateLoot } from '../src/pirateLoot.js';
import type { HullId } from '../src/types.js';

const zero = { alloy: 0, crystal: 0, deuterium: 0 };

describe('balanced pirate generation for this season', () => {
  it('keeps 2–5 armed ships and an own-level spine at every rung', () => {
    const generation = currentPirateGeneration();
    for (const level of [1, 2, 3, 4] as const) {
      for (let seed = 0; seed < 128; seed++) {
        const roster = pirateRoster(level, mulberry32(seed), generation);
        expect(fleetCount(roster)).toBeGreaterThanOrEqual(2);
        expect(fleetCount(roster)).toBeLessThanOrEqual(5);
        const entries = fleetEntries(roster);
        expect(entries.every(([id]) => new Set<HullId>(COMBAT_HULLS).has(id))).toBe(true);
        expect(entries.every(([id]) => (HULLS[id].tier ?? Infinity) <= level)).toBe(true);
        expect(entries.some(([id]) => HULLS[id].tier === level)).toBe(true);
      }
    }
  });

  it('copies hour inputs so later balance changes cannot change that hour', () => {
    const first = currentPirateGeneration();
    const second = currentPirateGeneration();
    expect(first).toEqual(second);
    expect(first.oreByLevel).not.toBe(second.oreByLevel);
    const lane = { fromMinute: 600, untilMinute: 660, count: 40, generation: first };
    const before = generatePirateHour({ hourOrdinal: 10, lane, rng: mulberry32(42) });
    second.oreByLevel[4] = 1;
    expect(generatePirateHour({ hourOrdinal: 10, lane, rng: mulberry32(42) })).toEqual(before);
    expect(before.every(p => fleetEntries(p.roster).every(([id]) => HULLS[id].cls !== 'SUPPORT'))).toBe(true);
  });

  it('keeps old hours on their recorded fleet and reward without rerolling identities or orbits', () => {
    const lane = { fromMinute: 600, untilMinute: 660, count: 40 };
    const legacy = generatePirateHour({ hourOrdinal: 10, lane, rng: mulberry32(42) });
    // Baseline comes from the deployed source. Only Math.pow orbit ulps are normalised;
    // every roster, hoard, RNG/window and identity value remains exact.
    expect(orbitFingerprint(legacy)).toBe('53c4917717e394c83f4166f19683850d51cb7887e3f78821a80b219fb63c4e90');
    const next = generatePirateHour({ hourOrdinal: 10, lane: { ...lane, generation: currentPirateGeneration() }, rng: mulberry32(42) });
    const identity = (p: typeof legacy[number]) => ({ index: p.index, level: p.level, appearsAt: p.appearsAt,
      expiresAt: p.expiresAt, radius: p.radius, period: p.period, phase: p.phase,
      inclination: p.inclination, ascendingNode: p.ascendingNode, speed: p.speed });
    expect(next.map(identity)).toEqual(legacy.map(identity));
    expect(legacy.some(p => fleetEntries(p.roster).some(([id]) => HULLS[id].cls === 'SUPPORT'))).toBe(true);
  });

  it('caps the no-collector payout at the rung budget, including rare 5-ship crews', () => {
    const generation = currentPirateGeneration();
    const rich = pirateHoard({ PALADIN: 5 }, generation);
    const loot = claimPirateLoot(rich, zero, 'DECISIVE', Number.MAX_SAFE_INTEGER);
    expect(loot.alloy + loot.crystal).toBeLessThanOrEqual(3000);
    expect(loot.deuterium).toBeLessThanOrEqual(200);
    expect(loot.alloy + loot.crystal).toBeGreaterThan(1000);
  });
});

describe('one pirate has one finite payable budget', () => {
  it('preserves the ordinary first win and first partial-win payment', () => {
    const hoard = { alloy: 1001, crystal: 501, deuterium: 101 };
    for (const grade of ['DECISIVE', 'PARTIAL', 'REPELLED'] as const) {
      expect(claimPirateLoot(hoard, zero, grade, 500)).toEqual(computeLoot(hoard, zero, zero, grade, 500));
    }
  });

  it('does not recreate the purse after partial wins, even after the final wipe', () => {
    const hoard = { alloy: 5000, crystal: 2500, deuterium: 333 };
    const paid = { ...zero };
    for (const grade of ['PARTIAL', 'PARTIAL', 'DECISIVE'] as const) {
      const loot = claimPirateLoot(hoard, paid, grade, Number.MAX_SAFE_INTEGER);
      paid.alloy += loot.alloy; paid.crystal += loot.crystal; paid.deuterium += loot.deuterium;
    }
    expect(paid).toEqual({ alloy: 3000, crystal: 1500, deuterium: 199 });
    expect(remainingPirateLoot(hoard, paid)).toEqual(zero);
  });

  it('keeps historical overpayments and empty holds conservative', () => {
    expect(remainingPirateLoot({ alloy: 100, crystal: 50, deuterium: 20 }, { alloy: 1000, crystal: 1000, deuterium: 1000 })).toEqual(zero);
    expect(claimPirateLoot({ alloy: 100, crystal: 50, deuterium: 20 }, zero, 'DECISIVE', 0).alloy).toBe(0);
    expect(() => remainingPirateLoot({ alloy: 100, crystal: 50, deuterium: 20 }, { ...zero, alloy: -1 })).toThrow();
  });

  it('keeps the exact first-claim proportions when fractional grade shares meet small cargo', () => {
    for (const grade of ['PARTIAL', 'DECISIVE'] as const) {
      for (let n = 1; n < 80; n++) {
        const hoard = { alloy: 31 * n + 1, crystal: 17 * n + 1, deuterium: n + 1 };
        for (const cargo of [1, 7, 123, 900]) {
          expect(claimPirateLoot(hoard, zero, grade, cargo))
            .toEqual(computeLoot(hoard, zero, zero, grade, cargo));
        }
      }
    }
  });
});
