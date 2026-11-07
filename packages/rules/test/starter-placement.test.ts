import { describe, expect, it } from 'vitest';
import { STARTER, VESSEL_HULLS, distance, pickVesselSlot, starterSlots } from '../src/index.js';

describe('the starter galaxy\'s berths', () => {
  const slots = starterSlots(11);

  it('has one berth per seat', () => {
    expect(slots.length).toBe(STARTER.capacity);
    expect(slots.map(s => s.index)).toEqual(slots.map((_, i) => i));
  });

  it('keeps every berth inside the galaxy', () => {
    for (const slot of slots) expect(Math.hypot(slot.x, slot.y, slot.z)).toBeLessThanOrEqual(STARTER.radius);
  });

  it('keeps berths apart', () => {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) expect(distance(slots[i]!, slots[j]!)).toBeGreaterThanOrEqual(STARTER.minSeparation);
    }
  });

  it('gives the same seed the same berths, and another seed others', () => {
    expect(starterSlots(11)).toEqual(slots);
    expect(starterSlots(12)).not.toEqual(slots);
  });
});

describe('choosing a berth', () => {
  const slots = starterSlots(11);

  it('puts the first ship nearest the centre', () => {
    const chosen = pickVesselSlot(slots, new Set(), [])!;
    const nearest = Math.min(...slots.map(s => Math.hypot(s.x, s.y, s.z)));
    expect(Math.hypot(chosen.x, chosen.y, chosen.z)).toBe(nearest);
  });

  it('puts a new ship near an active neighbour', () => {
    const neighbour = slots[12]!;
    const chosen = pickVesselSlot(slots, new Set([12]), [neighbour])!;
    const closest = Math.min(...slots.filter(s => s.index !== 12).map(s => distance(s, neighbour)));
    expect(distance(chosen, neighbour)).toBe(closest);
  });

  it('never takes a taken berth', () => {
    const neighbour = slots[12]!;
    const first = pickVesselSlot(slots, new Set([12]), [neighbour])!;
    const second = pickVesselSlot(slots, new Set([12, first.index]), [neighbour])!;
    expect(second.index).not.toBe(first.index);
    expect(second.index).not.toBe(12);
  });

  it('answers null when the galaxy is full', () => {
    expect(pickVesselSlot(slots, new Set(slots.map(s => s.index)), [])).toBeNull();
  });
});

describe('what a telescope finds in a galaxy of this size', () => {
  const seen = (reach: number) => {
    let total = 0, ships = 0, alone = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const slots = starterSlots(seed);
      for (const slot of slots) {
        const near = slots.filter(other => other !== slot && distance(slot, other) <= reach).length;
        total += near; ships++;
        if (near === 0) alone++;
      }
    }
    return { mean: total / ships, alone: alone / ships };
  };

  it('holds 30 ships', () => {
    expect(STARTER.capacity).toBe(30);
  });

  it('shows a few neighbours on the first telescope, and hardly anyone none', () => {
    const { mean, alone } = seen(STARTER.telescope[1]);
    expect(mean).toBeGreaterThanOrEqual(2);
    expect(mean).toBeLessThanOrEqual(5);
    expect(alone).toBeLessThan(0.1);
  });

  it('shows clearly more on each repair of the telescope, without running out', () => {
    expect(seen(STARTER.telescope[2]).mean).toBeGreaterThan(seen(STARTER.telescope[1]).mean * 2);
    expect(seen(STARTER.telescope[3]).mean).toBeGreaterThan(seen(STARTER.telescope[2]).mean * 1.5);
    expect(seen(STARTER.telescope[3]).mean).toBeLessThan(STARTER.capacity - 1);
  });
});

describe('the hulls', () => {
  it('are three, none a ring: a ship flies nose first and must fill a wide picture', () => {
    expect([...VESSEL_HULLS]).toEqual(['SPINE', 'WEDGE', 'SEED']);
  });
});
