import { describe, expect, it } from 'vitest';
import {
  ADMIRAL_WAIT, ARENA_ECONOMY as E, ARENA_TUNING as T, CLASS_STATS, FIELD_SPAWNS, FULL_LOADOUT, LOADOUT, classChangeOpen, dailyCap, entryOpen, launchLoad, loadoutPlan, refillCost, repairQuote, settleHold, shipStats,
} from '../../src/arena/index.js';

/**
 * Y6a (plan 14 §7, owner 2026-10-23): the ship's real economy. What a pilot farms is what lands in
 * the capital, one for one; the tank and magazine are filled from the capital's deuterium; a day
 * carries at most four hours of the capital's own production of each resource.
 */
describe('the hold is raw resources', () => {
  it('holds the owner\'s level-one totals, any mix', () => {
    expect([CLASS_STATS.akinci.cargoCapacity, CLASS_STATS.kilavuz.cargoCapacity, CLASS_STATS.muhafiz.cargoCapacity]).toEqual([300, 400, 500]);
  });

  // Owner 2026-10-27: every farm holds half (24/12/12/16 and 160 before), a rock regrows in the
  // same ~114 s (1.4/s before), and a rock gives at most 4 a second (16 before). Wrecks keep 40.
  it('halves every farm and mines at most four a second', () => {
    expect(FIELD_SPAWNS.map(spawn => spawn.amount)).toEqual([12, 6, 6, 8]);
    expect([T.mineRate, T.crystalReserve, T.crystalRegen, T.dropChunk, T.testCargo]).toEqual([4, 80, 0.7, 40, 240]);
    expect(T.crystalReserve / T.crystalRegen).toBeCloseTo(160 / 1.4, 6);
  });
});

describe('refill', () => {
  it('prices a full tank and magazine by class', () => {
    expect(E.refill).toEqual({ akinci: { fuel: 30, ammo: 15 }, kilavuz: { fuel: 40, ammo: 22 }, muhafiz: { fuel: 50, ammo: 30 } });
  });

  it('charges only the missing part, in whole deuterium rounded up', () => {
    const k = CLASS_STATS.kilavuz;
    expect(refillCost('kilavuz', k.fuelTank, k.ammoCapacity)).toEqual({ fuel: 0, ammo: 0, total: 0 });
    expect(refillCost('kilavuz', 0, 0)).toEqual({ fuel: 40, ammo: 22, total: 62 });
    expect(refillCost('kilavuz', k.fuelTank / 2, k.ammoCapacity)).toEqual({ fuel: 20, ammo: 0, total: 20 });
    // A sliver missing still costs one: nothing is filled for free.
    expect(refillCost('muhafiz', CLASS_STATS.muhafiz.fuelTank - 0.01, CLASS_STATS.muhafiz.ammoCapacity - 1)).toEqual({ fuel: 1, ammo: 1, total: 2 });
  });

  it('never charges for more than a full tank, whatever the ship says it holds', () => {
    expect(refillCost('akinci', -50, -1)).toEqual({ fuel: 30, ammo: 15, total: 45 });
    expect(refillCost('akinci', 9999, 9999)).toEqual({ fuel: 0, ammo: 0, total: 0 });
  });
});

/**
 * Owner 2026-10-27: a pilot may fly with half a tank, or a light magazine. The launch tops each up
 * to the pilot's plan (quarters; a magazine may stay empty for a miner's run), charging the part
 * below the plan only. What is aboard above the plan stays.
 */
describe('the launch plan', () => {
  it('offers the tank in quarters and the magazine from empty', () => {
    expect(LOADOUT).toEqual({ fuel: [25, 50, 75, 100], ammo: [0, 25, 50, 75, 100] });
    expect(FULL_LOADOUT).toEqual({ fuel: 100, ammo: 100 });
    expect(loadoutPlan({ fuel: 50, ammo: 0 })).toEqual({ fuel: 50, ammo: 0 });
    for (const bad of [{ fuel: 0, ammo: 100 }, { fuel: 10, ammo: 100 }, { fuel: 100, ammo: 101 }, { fuel: Number.NaN, ammo: 0 }, { fuel: 50, ammo: -25 }]) {
      expect(loadoutPlan(bad)).toBeNull();
    }
  });

  it('charges up to the plan, never for what is aboard above it', () => {
    const k = CLASS_STATS.kilavuz;
    expect(refillCost('kilavuz', 0, 0, 1, { fuel: 50, ammo: 0 })).toEqual({ fuel: 20, ammo: 0, total: 20 });
    expect(refillCost('kilavuz', 0, 0, 1, { fuel: 25, ammo: 75 })).toEqual({ fuel: 10, ammo: 17, total: 27 });
    expect(refillCost('kilavuz', k.fuelTank * 0.8, k.ammoCapacity, 1, { fuel: 50, ammo: 50 })).toEqual({ fuel: 0, ammo: 0, total: 0 });
    expect(refillCost('kilavuz', 0, 0, 1, FULL_LOADOUT)).toEqual(refillCost('kilavuz', 0, 0));
  });

  it('puts the plan aboard, or what is already there when that is more', () => {
    const k = CLASS_STATS.kilavuz;
    expect(launchLoad('kilavuz', 1, 0, 0, { fuel: 50, ammo: 0 })).toEqual({ fuel: k.fuelTank / 2, ammo: 0 });
    expect(launchLoad('kilavuz', 1, k.fuelTank * 0.8, 3, { fuel: 50, ammo: 0 })).toEqual({ fuel: k.fuelTank * 0.8, ammo: 3 });
    expect(launchLoad('kilavuz', 1, 9999, 9999, FULL_LOADOUT)).toEqual({ fuel: k.fuelTank, ammo: k.ammoCapacity });
    const grown = shipStats('kilavuz', 5);
    expect(launchLoad('kilavuz', 5, 0, 0, FULL_LOADOUT)).toEqual({ fuel: grown.fuelTank, ammo: grown.ammoCapacity });
  });
});

describe('the daily transfer cap', () => {
  it('is four hours of each resource the capital makes', () => {
    expect(dailyCap({ alloy: 1416, crystal: 708, deuterium: 19 })).toEqual({ alloy: 5664, crystal: 2832, deuterium: 76 });
    expect(dailyCap({ alloy: 10.4, crystal: 0, deuterium: 0.3 })).toEqual({ alloy: 41, crystal: 0, deuterium: 1 });
  });

  it('lands whole resources up to what is left today; the rest is overflow', () => {
    const settled = settleHold([240.7, 112, 90], { alloy: 5000, crystal: 100, deuterium: 76 });
    expect(settled.deposit).toEqual({ alloy: 240, crystal: 100, deuterium: 76 });
    expect(settled.overflow).toEqual({ alloy: 0, crystal: 12, deuterium: 14 });
  });

  it('lands nothing once a resource is spent for the day, and never a negative', () => {
    expect(settleHold([10, 10, 10], { alloy: 0, crystal: -5, deuterium: 3.9 })).toEqual({
      deposit: { alloy: 0, crystal: 0, deuterium: 3 }, overflow: { alloy: 10, crystal: 10, deuterium: 7 } });
    expect(settleHold([], { alloy: 9, crystal: 9, deuterium: 9 }).deposit).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
  });
});

describe('class and entry windows', () => {
  const chosen = new Date('2026-10-23T10:00:00Z');
  it('allows one free change in the first 24 hours', () => {
    expect(classChangeOpen(chosen, null, new Date('2026-10-24T09:59:59Z'))).toBe(true);
    expect(classChangeOpen(chosen, null, new Date('2026-10-24T10:00:00Z'))).toBe(false);
    expect(classChangeOpen(chosen, new Date('2026-10-23T11:00:00Z'), new Date('2026-10-23T12:00:00Z'))).toBe(false);
  });

  it('closes entry ten minutes before the season ends', () => {
    const ends = new Date('2026-11-01T00:00:00Z');
    expect(entryOpen(ends, new Date('2026-10-31T23:49:59Z'))).toBe(true);
    expect(entryOpen(ends, new Date('2026-10-31T23:50:00Z'))).toBe(false);
    expect(E.minCore).toBe(9);
    // Owner 2026-10-28 ("şuanlık 3 dk … biraz oynasınlar alışsınlar"): death and extraction wait alike, for now.
    expect([E.repairMinutes, E.serviceMinutes]).toEqual([3, 3]);
  });
});

describe('paid repair (plan 14 §7.4)', () => {
  it('buys a shorter wait, never an instant repair, at the ship level', () => {
    expect([1, 10, 20].map(repairQuote)).toEqual([
      { minutes: 15, cost: { alloy: 175, crystal: 60, deuterium: 0 } },
      { minutes: 22, cost: { alloy: 400, crystal: 150, deuterium: 0 } },
      { minutes: 30, cost: { alloy: 650, crystal: 250, deuterium: 0 } },
    ]);
    for (let level = 1; level <= 20; level++) {
      expect(repairQuote(level).minutes).toBeGreaterThan(0);
      // A Yarık repair is already shorter than any quote; payment shortens only an escort's lost battle.
      expect(repairQuote(level).minutes).toBeGreaterThanOrEqual(E.repairMinutes);
      expect(repairQuote(level).minutes).toBeLessThan(ADMIRAL_WAIT.repairMinutes);
    }
  });

  it('uses the same bounded whole level as ship stats', () => {
    for (const level of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) expect(repairQuote(level)).toEqual(repairQuote(1));
    expect(repairQuote(100)).toEqual(repairQuote(20));
    expect(repairQuote(10.9)).toEqual(repairQuote(10));
  });
});
