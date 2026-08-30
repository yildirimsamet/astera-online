import { describe, expect, it } from 'vitest';
import { generateGalaxy, pickSpawnSlot, type PlanetSlot } from '../src/galaxy.js';
import { GALAXY, MULTI_WORLD, SERVERS } from '../src/constants.js';
import { ECONOMY_TEMPO, scaleResources } from '../src/tempo.js';
import { distance, fleetTravelExact } from '../src/travel.js';
import { MOBILE_HULLS } from '../src/hulls.js';
import {
  GALAXY_SPAN,
  SETTLEMENT_CLAIM_MINUTES,
  colonyCapacity,
  hasColonyCapacity,
  neutralReserve,
  neutralThreat,
  selectNeutralSlots,
  TRANSFER_CARGO_HULLS,
  transferCargoCapacity,
} from '../src/strategic.js';

const settlementFleet = { HAULER: MULTI_WORLD.settlement.haulers };

function octantCounts(slots: readonly PlanetSlot[]): number[] {
  const octants = Array.from({ length: 8 }, () => 0);
  for (const slot of slots) {
    const octant = (slot.x >= 0 ? 1 : 0) | (slot.y >= 0 ? 2 : 0) | (slot.z >= 0 ? 4 : 0);
    octants[octant] = (octants[octant] ?? 0) + 1;
  }
  return octants;
}

function centroidDistance(slots: readonly PlanetSlot[]): number {
  const sum = slots.reduce(
    (at, slot) => ({ x: at.x + slot.x, y: at.y + slot.y, z: at.z + slot.z }),
    { x: 0, y: 0, z: 0 },
  );
  return Math.hypot(sum.x, sum.y, sum.z) / slots.length;
}

describe('multi-world strategic rules', () => {
  it('prices a settlement as the Economy v2 two-Hauler commitment', () => {
    expect(MULTI_WORLD.settlement).toEqual({
      cost: scaleResources(
        { alloy: 2000, crystal: 1000, deuterium: 0 },
        ECONOMY_TEMPO.fixedPrice,
      ),
      haulers: 2,
    });
  });

  /**
   * D111. Stated as a RELATION rather than as a figure, because the figure is the
   * thing that went stale: any of `GALAXY.radius`,
   * `TRAVEL.*`, `HULLS.HAULER.speed` or the Hauler count moves this window, and
   * a test asserting "73" would have to be edited by whoever broke it.
   */
  it('defines the widest settlement flight as exactly one spherical diameter', () => {
    expect(GALAXY_SPAN).toBe(2 * GALAXY.radius);
    expect(fleetTravelExact(GALAXY_SPAN, settlementFleet))
      .toBeLessThanOrEqual(SETTLEMENT_CLAIM_MINUTES);
    // And no wider than it has to be: one whole minute of rounding, never two.
    expect(fleetTravelExact(GALAXY_SPAN, settlementFleet))
      .toBeGreaterThan(SETTLEMENT_CLAIM_MINUTES - 1);
  });

  it('leaves every capital able to settle every neutral world in the shipped layout', () => {
    for (const seed of [1, 2, 3]) {
      const galaxy = generateGalaxy(seed, MULTI_WORLD.neutralSlotPool);
      const capitals = galaxy.slots.filter((slot) => slot.index < MULTI_WORLD.capitalSlots);
      const neutrals = selectNeutralSlots(seed, galaxy.slots);
      expect(neutrals.length).toBeGreaterThan(0);
      const worst = Math.max(...capitals.flatMap(
        (capital) => neutrals.map((neutral) => distance(capital, neutral.slot)),
      ));
      // Strictly inside: `launchSettlement` refuses an arrival AT the boundary.
      expect(fleetTravelExact(worst, settlementFleet)).toBeLessThan(SETTLEMENT_CLAIM_MINUTES);
    }
  });

  it.each([
    [0, 0], [2, 0], [3, 1], [5, 1], [6, 2], [8, 2], [9, 3], [99, 3],
  ])('maps Core %i to %i colony slots', (core, capacity) => {
    expect(colonyCapacity(core)).toBe(capacity);
  });

  it('grandfathers existing colonies but rejects every new reservation over cap', () => {
    expect(hasColonyCapacity(3, 1, 0)).toBe(false);
    expect(hasColonyCapacity(2, 3, 0)).toBe(false);
    expect(hasColonyCapacity(9, 1, 1)).toBe(true);
    expect(hasColonyCapacity(9, 1, 2)).toBe(false);
  });

  it('uses exact EMPTY/LOW/RICH public reserve boundaries', () => {
    const cap = { alloy: 500, crystal: 500, deuterium: 0 };
    expect(neutralReserve({ alloy: 199, crystal: 0, deuterium: 0 }, cap)).toBe('EMPTY');
    expect(neutralReserve({ alloy: 200, crystal: 0, deuterium: 0 }, cap)).toBe('LOW');
    expect(neutralReserve({ alloy: 599, crystal: 0, deuterium: 0 }, cap)).toBe('LOW');
    expect(neutralReserve({ alloy: 600, crystal: 0, deuterium: 0 }, cap)).toBe('RICH');
    expect(neutralReserve({ alloy: 1, crystal: 1, deuterium: 0 }, { alloy: 0, crystal: 0, deuterium: 0 })).toBe('EMPTY');
  });

  it('publishes tier threat without leaking a composition', () => {
    expect([neutralThreat(1), neutralThreat(2), neutralThreat(3)])
      .toEqual(['UNGUARDED', 'GUARDED', 'FORTIFIED']);
  });

  it('counts cargo space from Haulers and Runners only', () => {
    expect(transferCargoCapacity({ WASP: 99, HAULER: 1, RUNNER: 2 }))
      .toBe(transferCargoCapacity({ HAULER: 1, RUNNER: 2 }));
    expect(transferCargoCapacity({ WASP: 99 })).toBe(0);
  });

  it('selects exactly 30/15/6 stable unique neutral slots after all 300 capitals', () => {
    const slots = generateGalaxy(8331, MULTI_WORLD.neutralSlotPool).slots;
    const first = selectNeutralSlots(8331, slots);
    const again = selectNeutralSlots(8331, slots);
    expect(again).toEqual(first);
    expect(first.filter((entry) => entry.tier === 1)).toHaveLength(30);
    expect(first.filter((entry) => entry.tier === 2)).toHaveLength(15);
    expect(first.filter((entry) => entry.tier === 3)).toHaveLength(6);
    expect(new Set(first.map((entry) => entry.slot.index))).toHaveLength(51);
    expect(first.every((entry) => entry.slot.index >= SERVERS.capacity)).toBe(true);
  });

  it('keeps the T2 neutral ring at the same share when galaxy units change', () => {
    const slots = generateGalaxy(8331, MULTI_WORLD.neutralSlotPool).slots;
    const t2 = selectNeutralSlots(8331, slots).filter((entry) => entry.tier === 2);
    const meanRadius = t2.reduce(
      (sum, entry) => sum + Math.hypot(entry.slot.x, entry.slot.y, entry.slot.z),
      0,
    ) / t2.length;

    expect(Math.abs(meanRadius - GALAXY.radius * 0.55)).toBeLessThan(GALAXY.minSeparation);
  });

  it.each([1, 6, 18, 30, 4242, 8331])(
    'spreads capital addresses and the first commanders through the sphere for seed %i',
    (seed) => {
      const slots = generateGalaxy(seed, MULTI_WORLD.capitalSlots).slots;
      const equalVolumeShells = [0, 0, 0, 0];
      for (const slot of slots) {
        const radiusShareCubed = (Math.hypot(slot.x, slot.y, slot.z) / GALAXY.radius) ** 3;
        const shell = Math.min(3, Math.floor(radiusShareCubed * 4));
        equalVolumeShells[shell] = (equalVolumeShells[shell] ?? 0) + 1;
      }
      expect(Math.min(...equalVolumeShells)).toBeGreaterThanOrEqual(60);
      expect(Math.max(...equalVolumeShells)).toBeLessThanOrEqual(90);

      // Every octant receives a real population, and no axis is secretly flatter
      // than the others. A disc passes the old radial test but fails both checks.
      const octants = octantCounts(slots);
      expect(Math.min(...octants)).toBeGreaterThanOrEqual(25);
      expect(Math.max(...octants)).toBeLessThanOrEqual(55);
      const moments = [
        slots.reduce((sum, slot) => sum + slot.x ** 2, 0),
        slots.reduce((sum, slot) => sum + slot.y ** 2, 0),
        slots.reduce((sum, slot) => sum + slot.z ** 2, 0),
      ];
      expect(Math.max(...moments) / Math.min(...moments)).toBeLessThan(1.25);

      const occupied = new Set<number>();
      const firstFifty: PlanetSlot[] = [];
      while (firstFifty.length < 50) {
        const next = pickSpawnSlot(slots, occupied);
        expect(next).not.toBeNull();
        occupied.add(next!.index);
        firstFifty.push(next!);
      }
      const firstOctants = octantCounts(firstFifty);
      expect(Math.min(...firstOctants)).toBeGreaterThanOrEqual(4);
      expect(Math.max(...firstOctants)).toBeLessThanOrEqual(11);
      expect(centroidDistance(firstFifty)).toBeLessThan(GALAXY.radius * 0.075);
    },
  );

  it.each([1, 6, 18, 30, 4242, 8331])(
    'spreads every neutral tier across all three axes for seed %i',
    (seed) => {
      const selected = selectNeutralSlots(
        seed,
        generateGalaxy(seed, MULTI_WORLD.neutralSlotPool).slots,
      );
      const tier = (value: 1 | 2 | 3): PlanetSlot[] => selected
        .filter((entry) => entry.tier === value)
        .map((entry) => entry.slot);

      for (const [value, maxDirectionalBias] of [[1, 0.1], [2, 0.12], [3, 0.35]] as const) {
        const worlds = tier(value);
        for (const axis of ['x', 'y', 'z'] as const) {
          expect(worlds.some((slot) => slot[axis] < 0)).toBe(true);
          expect(worlds.some((slot) => slot[axis] > 0)).toBe(true);
        }
        const directionSum = worlds.reduce((sum, slot) => {
          const radius = Math.hypot(slot.x, slot.y, slot.z);
          return {
            x: sum.x + slot.x / radius,
            y: sum.y + slot.y / radius,
            z: sum.z + slot.z / radius,
          };
        }, { x: 0, y: 0, z: 0 });
        expect(
          Math.hypot(directionSum.x, directionSum.y, directionSum.z) / worlds.length,
        ).toBeLessThan(maxDirectionalBias);
      }
    },
  );
});

/**
 * The transfer screen lists these hulls by name and prints a sentence about them.
 * If the list and the capacity function ever disagree, the screen offers a craft
 * that adds no hold — or hides the one that does — and the player reads a lie.
 */
describe('the ore carriers a transfer may use', () => {
  it('names exactly the hulls that add cargo capacity, and no others', () => {
    for (const id of MOBILE_HULLS) {
      const carries = transferCargoCapacity({ [id]: 1 }) > 0;
      expect(carries).toBe((TRANSFER_CARGO_HULLS as readonly string[]).includes(id));
    }
  });
});
