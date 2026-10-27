import { describe, expect, it } from 'vitest';
import { ARENA_PROGRESSION, CLASS_STATS, HIT_REFERENCE, RING_DISTANCE, SHIP_CLASSES, SPREAD_PATTERN, SPREAD_REACH, hitShare, shipStats, spreadAt } from '../../src/arena/index.js';

/**
 * Accuracy as a pilot reads it (owner 2026-10-24: "accuracy oranı"): the share of shots that land
 * on a ship aimed dead centre, out where fights happen. It comes from the same pattern the guns
 * fire, so a better number is a narrower cone in the Yarık, and the reticle draws that cone.
 */
const levels = Array.from({ length: ARENA_PROGRESSION.maxLevel }, (_, i) => i + 1);

describe('the spread a pilot reads', () => {
  it('holds every shot of the pattern inside its reach', () => {
    for (let i = 0; i < SPREAD_PATTERN.length; i += 2) {
      expect(Math.hypot(SPREAD_PATTERN[i] ?? 0, SPREAD_PATTERN[i + 1] ?? 0)).toBeLessThanOrEqual(SPREAD_REACH + 1e-12);
    }
    expect(SPREAD_REACH).toBeGreaterThan(0.7);
  });

  it('is every shot for a perfect gun, fewer as the cone widens, never outside 0–1', () => {
    expect(hitShare(0)).toBe(1);
    expect(hitShare(1)).toBeLessThan(hitShare(0.02));
    expect(hitShare(0.02)).toBeLessThan(hitShare(0.01));
    for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY]) expect(hitShare(bad)).toBe(0);
    expect(HIT_REFERENCE).toEqual({ radius: 4, near: 200, far: 400 });
  });

  it('starts each class where the owner set it and grows it a little every level', () => {
    const at = (ship: typeof SHIP_CLASSES[number], level: number): number => Math.round(hitShare(shipStats(ship, level).spreadBase) * 100);
    expect(SHIP_CLASSES.map(ship => [at(ship, 1), at(ship, 20)])).toEqual([[56, 80], [34, 40], [45, 61]]);
    for (const ship of SHIP_CLASSES) {
      const shares = levels.map(level => hitShare(shipStats(ship, level).spreadBase));
      for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeGreaterThanOrEqual(shares[i - 1] ?? 1);
    }
    // Damage grows with it.
    for (const ship of SHIP_CLASSES) expect(shipStats(ship, 20).damage).toBeGreaterThan(CLASS_STATS[ship].damage);
  });

  it('spreads over a known width at the reticle\'s distance, narrower each level (owner 2026-10-24: "500 m")', () => {
    expect(RING_DISTANCE).toBe(500);
    const wide = (ship: typeof SHIP_CLASSES[number], level: number): number => Math.round(spreadAt(shipStats(ship, level).spreadBase, RING_DISTANCE) * 2 * 10) / 10;
    expect(SHIP_CLASSES.map(ship => [wide(ship, 1), wide(ship, 20)])).toEqual([[19.9, 14.2], [27.6, 25], [23, 18.6]]);
    // Twice as far, twice as wide: it is a cone.
    expect(spreadAt(0.02, 1000)).toBeCloseTo(spreadAt(0.02, 500) * 2, 12);
    expect(spreadAt(Number.NaN, 500)).toBe(0);
  });
});
