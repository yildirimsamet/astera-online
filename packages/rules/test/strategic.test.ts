import { describe, expect, it } from 'vitest';
import { generateGalaxy, pickSpawnSlot, type PlanetSlot } from '../src/galaxy.js';
import { GALAXY, MULTI_WORLD, SERVERS } from '../src/constants.js';
import { distance, fleetTravelExact } from '../src/travel.js';
import {
  GALAXY_SPAN,
  SETTLEMENT_CLAIM_MINUTES,
  colonyCapacity,
  hasColonyCapacity,
  neutralReserve,
  neutralThreat,
  selectNeutralSlots,
  transferCargoCapacity,
} from '../src/strategic.js';

const settlementFleet = { HAULER: MULTI_WORLD.settlement.haulers };

/** The widest empty angular wedge, in degrees. A whole tier can look clustered while averages pass. */
function largestAngularGap(slots: readonly PlanetSlot[]): number {
  const angles = slots
    .map((slot) => {
      const angle = Math.atan2(slot.z, slot.x);
      return angle < 0 ? angle + Math.PI * 2 : angle;
    })
    .toSorted((a, b) => a - b);
  return Math.max(...angles.map((angle, index) => {
    const next = index === angles.length - 1
      ? (angles[0] ?? 0) + Math.PI * 2
      : angles[index + 1] ?? angle;
    return next - angle;
  })) * 180 / Math.PI;
}

describe('multi-world strategic rules', () => {
  it('prices a settlement as the Economy v2 two-Hauler commitment', () => {
    expect(MULTI_WORLD.settlement).toEqual({
      cost: { alloy: 2000, crystal: 1000, deuterium: 0 },
      haulers: 2,
    });
  });

  /**
   * D111. Stated as a RELATION rather than as a figure, because the figure is the
   * thing that went stale: any of `GALAXY.radius`, `GALAXY.thickness`,
   * `TRAVEL.*`, `HULLS.HAULER.speed` or the Hauler count moves this window, and
   * a test asserting "73" would have to be edited by whoever broke it.
   */
  it('holds the claim window open for the widest settlement flight the disc can produce', () => {
    expect(GALAXY_SPAN).toBeGreaterThanOrEqual(2 * GALAXY.radius);
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
    'spreads capital addresses and the first commanders around the disc for seed %i',
    (seed) => {
      const slots = generateGalaxy(seed, MULTI_WORLD.capitalSlots).slots;
      const equalAreaQuarters = [0, 0, 0, 0];
      for (const slot of slots) {
        const radiusShareSquared = (slot.x ** 2 + slot.z ** 2) / GALAXY.radius ** 2;
        const quarter = Math.min(3, Math.floor(radiusShareSquared * 4));
        equalAreaQuarters[quarter] = (equalAreaQuarters[quarter] ?? 0) + 1;
      }
      expect(Math.min(...equalAreaQuarters)).toBeGreaterThanOrEqual(55);
      expect(Math.max(...equalAreaQuarters)).toBeLessThanOrEqual(95);

      const occupied = new Set<number>();
      const firstFifty: PlanetSlot[] = [];
      while (firstFifty.length < 50) {
        const next = pickSpawnSlot(slots, occupied);
        expect(next).not.toBeNull();
        occupied.add(next!.index);
        firstFifty.push(next!);
      }
      expect(largestAngularGap(firstFifty)).toBeLessThan(45);
    },
  );

  it.each([1, 6, 18, 30, 4242, 8331])(
    'leaves no broad empty wedge in any neutral tier for seed %i',
    (seed) => {
      const selected = selectNeutralSlots(
        seed,
        generateGalaxy(seed, MULTI_WORLD.neutralSlotPool).slots,
      );
      const tier = (value: 1 | 2 | 3): PlanetSlot[] => selected
        .filter((entry) => entry.tier === value)
        .map((entry) => entry.slot);

      expect(largestAngularGap(tier(1))).toBeLessThan(45);
      expect(largestAngularGap(tier(2))).toBeLessThan(48);
      expect(largestAngularGap(tier(3))).toBeLessThan(120);
    },
  );
});
