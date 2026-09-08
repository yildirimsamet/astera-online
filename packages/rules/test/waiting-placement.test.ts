import { describe, expect, it } from 'vitest';
import {
  GALAXY, MULTI_WORLD, distance, generateGalaxy, selectNeutralSlots, waitingColonySlots,
} from '../src/index.js';

describe('waiting colony address pool', () => {
  it.each([1, 7, 42, 99, 4242, 1337])('fits 900 colonies around reserved capitals and authored neutrals on seed %s', (seed) => {
    const galaxy = generateGalaxy(seed, MULTI_WORLD.neutralSlotPool);
    const obstacles = [
      ...galaxy.slots.slice(0, MULTI_WORLD.capitalSlots),
      ...selectNeutralSlots(seed, galaxy.slots).map((world) => world.slot),
    ];
    const before = structuredClone(obstacles);
    const slots = waitingColonySlots(seed, obstacles, 900);
    expect(slots).toHaveLength(900);
    expect(obstacles).toEqual(before);
    expect(waitingColonySlots(seed, [...obstacles].reverse(), 900)).toEqual(slots);
    expect(new Set(slots.map((slot) => slot.index)).size).toBe(900);
    let nearest = Infinity;
    for (const [i, slot] of slots.entries()) {
      expect(slot.index).toBeGreaterThanOrEqual(MULTI_WORLD.neutralSlotPool);
      expect(Math.hypot(slot.x, slot.y, slot.z)).toBeLessThanOrEqual(GALAXY.radius);
      for (const other of [...obstacles, ...slots.slice(0, i)]) {
        nearest = Math.min(nearest, distance(slot, other));
      }
    }
    expect(nearest).toBeGreaterThanOrEqual(GALAXY.minSeparation);
  });

  it('preserves existing migration worlds and never reuses their occupied indices', () => {
    const original = waitingColonySlots(42, [], 3);
    const next = waitingColonySlots(42, original, 3);
    expect(next).toHaveLength(3);
    for (const slot of next) for (const occupied of original) {
      expect(slot.index).not.toBe(occupied.index);
      expect(distance(slot, occupied)).toBeGreaterThanOrEqual(GALAXY.minSeparation);
    }
  });

  it('returns addresses only on request and rejects invalid counts', () => {
    expect(waitingColonySlots(42, [], 0)).toEqual([]);
    expect(() => waitingColonySlots(42, [], -1)).toThrow(RangeError);
    expect(() => waitingColonySlots(42, [], 1.5)).toThrow(RangeError);
  });
});
