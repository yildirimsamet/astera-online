import { describe, expect, it } from 'vitest';
import { generateGalaxy, type PlanetSlot } from '../src/galaxy.js';
import { GALAXY, MULTI_WORLD, SERVERS } from '../src/constants.js';
import { UNAIDED, distance, fleetTravelExact } from '../src/travel.js';
import { MOBILE_HULLS } from '../src/hulls.js';
import {
  GALAXY_SPAN,
  NEUTRAL_OPENING,
  SETTLEMENT_CLAIM_MINUTES,
  colonyCapacity,
  hasColonyCapacity,
  neutralReserve,
  neutralDemand,
  neutralOpeningOrder,
  neutralOpenings,
  neutralThreat,
  selectNeutralSlots,
  TRANSFER_CARGO_HULLS,
  transferCargoCapacity,
} from '../src/strategic.js';

const settlementFleet = {
  [MULTI_WORLD.settlement.transportHull]: MULTI_WORLD.settlement.transports,
};

describe('multi-world strategic rules', () => {
  it('opens only the owner-approved twenty-percent neutral set at season start', () => {
    expect(NEUTRAL_OPENING).toEqual({
      initial: { 1: 15, 2: 8, 3: 3 },
      perFreeSlot: 1,
      firstCensusDays: 3,
      censusEveryHours: 24,
    });
  });

  it('counts each free colony right against its own tier', () => {
    expect(neutralDemand([
      { capitalCore: 8, colonies: 0, reservations: 0 },
      { capitalCore: 9, colonies: 0, reservations: 0 },
      { capitalCore: 13, colonies: 0, reservations: 0 },
      { capitalCore: 13, colonies: 1, reservations: 0 },
      { capitalCore: 16, colonies: 1, reservations: 0 },
      { capitalCore: 16, colonies: 1, reservations: 1 },
      { capitalCore: 16, colonies: 3, reservations: 0 },
    ])).toEqual({ 1: 2, 2: 3, 3: 2 });
  });

  it('lets reservations fill rights and never asks past capacity', () => {
    expect(neutralDemand([
      { capitalCore: 16, colonies: 0, reservations: 3 },
      { capitalCore: 99, colonies: 9, reservations: 9 },
    ])).toEqual({ 1: 0, 2: 0, 3: 0 });
  });

  it('opens only unmet demand inside the authored ceiling', () => {
    expect(neutralOpenings({
      demand: { 1: 8, 2: 4, 3: 7 },
      stillNeutral: { 1: 3, 2: 4, 3: 1 },
      opened: { 1: 74, 2: 20, 3: 16 },
      cap: MULTI_WORLD.neutralCounts,
    })).toEqual({ 1: 2, 2: 0, 3: 0 });
  });

  it('counts captured selected worlds as opened without counting them as neutral supply', () => {
    expect(neutralOpenings({
      demand: { 1: 5, 2: 0, 3: 0 },
      stillNeutral: { 1: 2, 2: 0, 3: 0 },
      opened: { 1: 5, 2: 0, 3: 0 },
      cap: { 1: 6, 2: 0, 3: 0 },
    })).toEqual({ 1: 1, 2: 0, 3: 0 });
  });

  it.each([1, 6, 18, 4242, 8331])(
    'orders every neutral tier in deterministic balanced prefixes for seed %i',
    (seed) => {
      const selected = selectNeutralSlots(
        seed,
        generateGalaxy(seed, MULTI_WORLD.neutralSlotPool).slots,
      );
      const ordered = neutralOpeningOrder(seed, selected);
      expect(neutralOpeningOrder(seed, selected)).toEqual(ordered);
      expect(new Set(ordered.map((entry) => entry.slot.index)))
        .toEqual(new Set(selected.map((entry) => entry.slot.index)));

      for (const tier of [1, 2, 3] as const) {
        const tierOrder = ordered.filter((entry) => entry.tier === tier);
        for (let length = 4; length <= tierOrder.length; length++) {
          const prefix = tierOrder.slice(0, length).map((entry) => entry.slot);
          for (const axis of ['x', 'y', 'z'] as const) {
            expect(prefix.some((slot) => slot[axis] < 0), `${String(tier)}:${String(length)}:${axis}-`).toBe(true);
            expect(prefix.some((slot) => slot[axis] > 0), `${String(tier)}:${String(length)}:${axis}+`).toBe(true);
          }
          const octants = new Map<number, number>();
          for (const slot of prefix) {
            const octant = (slot.x >= 0 ? 1 : 0) | (slot.y >= 0 ? 2 : 0) | (slot.z >= 0 ? 4 : 0);
            octants.set(octant, (octants.get(octant) ?? 0) + 1);
          }
          expect(Math.max(...octants.values()), `${String(tier)}:${String(length)}:octants`)
            .toBeLessThanOrEqual(Math.ceil(length / 2));
        }
      }
    },
  );

  it('prices a settlement as the Economy v2 two-Courier commitment', () => {
    expect(MULTI_WORLD.settlement).toMatchObject({
      cost: { alloy: 800, crystal: 400, deuterium: 0 },
      charge: { alloy: 1000, crystal: 500, deuterium: 0 },
      transportHull: 'COURIER',
      transports: 2,
    });
  });

  /**
   * D111. Stated as a RELATION rather than as a figure, because the figure is the
   * thing that went stale: any of `GALAXY.radius`,
   * `TRAVEL.*`, `HULLS.COURIER.speed` or the Courier count moves this window, and
   * a test asserting "73" would have to be edited by whoever broke it.
   */
  it('defines the widest settlement flight as exactly one spherical diameter', () => {
    expect(GALAXY_SPAN).toBe(2 * GALAXY.radius);
    expect(fleetTravelExact(GALAXY_SPAN, settlementFleet, UNAIDED))
      .toBeLessThanOrEqual(SETTLEMENT_CLAIM_MINUTES);
    // And no wider than it has to be: one whole minute of rounding, never two.
    expect(fleetTravelExact(GALAXY_SPAN, settlementFleet, UNAIDED))
      .toBeGreaterThan(SETTLEMENT_CLAIM_MINUTES - 1);
  });

  it('leaves every capital able to settle every neutral world in the shipped layout', () => {
    for (const seed of [1, 2, 3]) {
      const galaxy = generateGalaxy(seed, MULTI_WORLD.neutralSlotPool);
      const capitals = galaxy.slots.filter((slot) => slot.index < MULTI_WORLD.capitalSlots);
      const neutrals = selectNeutralSlots(seed, galaxy.slots);
      expect(neutrals.length).toBeGreaterThan(0);
      // A running max: a thousand capitals × every neutral is too many to spread.
      let worst = 0;
      for (const capital of capitals) {
        for (const neutral of neutrals) worst = Math.max(worst, distance(capital, neutral.slot));
      }
      // Strictly inside: `launchSettlement` refuses an arrival AT the boundary.
      expect(fleetTravelExact(worst, settlementFleet, UNAIDED)).toBeLessThan(SETTLEMENT_CLAIM_MINUTES);
    }
  });

  it.each([
    // The second and third slots remain separated on the current Core curve.
    [0, 0], [6, 0], [8, 0], [9, 1], [12, 1], [13, 2], [15, 2], [16, 3], [99, 3],
  ])('maps Core %i to %i colony slots', (core, capacity) => {
    expect(colonyCapacity(core)).toBe(capacity);
  });

  it('grandfathers existing colonies but rejects every new reservation over cap', () => {
    expect(hasColonyCapacity(9, 1, 0)).toBe(false);
    expect(hasColonyCapacity(2, 3, 0)).toBe(false);
    expect(hasColonyCapacity(16, 1, 1)).toBe(true);
    expect(hasColonyCapacity(16, 1, 2)).toBe(false);
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

  /** The DEDICATED transports and nothing else — one per tier since D196. */
  it('counts cargo space from the dedicated transports only', () => {
    expect(TRANSFER_CARGO_HULLS).toEqual(['COURIER', 'WAYFARER', 'ATLAS', 'ARGOSY']);
    const loaded = { WAYFARER: 1, COURIER: 2, ATLAS: 1, ARGOSY: 1 };
    expect(transferCargoCapacity({ DART: 99, ...loaded }, {}))
      .toBe(transferCargoCapacity(loaded, {}));
    expect(transferCargoCapacity({ DART: 99 }, {})).toBe(0);
  });

  it('selects exactly 76/38/16 stable unique neutral slots after every capital and bot seat', () => {
    const slots = generateGalaxy(8331, MULTI_WORLD.neutralSlotPool).slots;
    const first = selectNeutralSlots(8331, slots);
    const again = selectNeutralSlots(8331, slots);
    expect(again).toEqual(first);
    expect(first.filter((entry) => entry.tier === 1)).toHaveLength(76);
    expect(first.filter((entry) => entry.tier === 2)).toHaveLength(38);
    expect(first.filter((entry) => entry.tier === 3)).toHaveLength(16);
    expect(new Set(first.map((entry) => entry.slot.index))).toHaveLength(130);
    expect(first.every(
      (entry) => entry.slot.index >= SERVERS.capacity + MULTI_WORLD.botSlots,
    )).toBe(true);
    expect(slots).toHaveLength(
      SERVERS.capacity
      + MULTI_WORLD.botSlots
      + MULTI_WORLD.neutralCounts[1]
      + MULTI_WORLD.neutralCounts[2]
      + MULTI_WORLD.neutralCounts[3],
    );
  });

  it('keeps the T2 neutral ring at the same share when galaxy units change', () => {
    const slots = generateGalaxy(8331, MULTI_WORLD.neutralSlotPool).slots;
    const t2 = selectNeutralSlots(8331, slots).filter((entry) => entry.tier === 2);
    const meanRadius = t2.reduce(
      (sum, entry) => sum + Math.hypot(entry.slot.x, entry.slot.y, entry.slot.z),
      0,
    ) / t2.length;

    expect(Math.abs(meanRadius - GALAXY.radius * GALAXY.strata.t2Share))
      .toBeLessThan(GALAXY.minSeparation);
  });

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
      const carries = transferCargoCapacity({ [id]: 1 }, {}) > 0;
      expect(carries).toBe((TRANSFER_CARGO_HULLS as readonly string[]).includes(id));
    }
  });
});
