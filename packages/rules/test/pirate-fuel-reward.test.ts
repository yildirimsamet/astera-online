import { describe, expect, it } from 'vitest';
import {
  FUEL,
  PIRATE,
  fleetValue,
  missionFuel,
  mulberry32,
  pirateHoard,
  pirateRoster,
  resourcesTotal,
  type Fleet,
  type PirateLevel,
} from '../src/index.js';

const LEVELS = [1, 2, 3, 4] as const;

/**
 * WHAT A PIRATE PAYS IN DEUTERIUM, AND WHY IT IS PRICED OFF ITS OWN THIRST.
 * Owner decision, 2026-09-22.
 *
 * THE DEFECT, MEASURED. Deuterium is fuel, and fuel is what makes a raid cost something (D136) —
 * so the rule written over `pirateHoard` was that a hoard must never refill the tank it emptied.
 * The test that guarded it asked the wrong question: it checked deuterium's share of the HOARD
 * (1.3%, comfortably under a tenth) instead of its size against the FUEL a raid burns. Measured
 * against that, a level-4 hoard paid 1,155 deuterium for a flight costing 294 — the pirate lane
 * refilled its own tank nearly four times over, in silence.
 *
 * THE RULE THE OWNER GAVE: *"Spawnlanan korsan filosunun içindeki gemilerin 1bin birimde yaktığı
 * yakıtın toplamının 4-6 katı arasında döteryum ödülü."* The prize is a multiple of what the
 * PIRATE'S OWN hulls would burn over one reference span — so the reward is priced by the same
 * quantity the raid's cost is, and over-committing is punished by arithmetic rather than by a cap.
 *
 * FIVE, MEASURED ACROSS THE OWNER'S 4–6 RANGE. Their stated outcome was "send twice the pirate's
 * combat value and earn 2–3x; send three to five times and earn nothing; send much more and lose
 * deuterium". At 4x the two-times wing returns only 1.6x; at 6x a five-times wing still breaks
 * even. Five is the rung where both halves hold.
 */
describe('a pirate pays for its own thirst, times five', () => {
  const thirst = (roster: Fleet): number => missionFuel(roster, FUEL.reference, 1);

  it('states the multiplier rather than hiding one inline', () => {
    expect(PIRATE.hoardFuelMult).toBe(5);
  });

  it('pays exactly that multiple of what its own hulls burn over one reference span', () => {
    for (const level of LEVELS) {
      for (const seed of [1, 7, 99, 4242]) {
        const roster = pirateRoster(level, mulberry32(seed));
        expect(pirateHoard(roster).deuterium, `level ${String(level)} seed ${String(seed)}`)
          .toBe(thirst(roster) * PIRATE.hoardFuelMult);
      }
    }
  });

  /** The ore half is untouched: it is still priced off what the pirate is worth. */
  it('leaves the alloy and crystal priced off the roster’s value', () => {
    for (const level of LEVELS) {
      const roster = pirateRoster(level, mulberry32(11));
      const hoard = pirateHoard(roster);
      const worth = fleetValue(roster) * PIRATE.hoardValueMult;
      expect(hoard.alloy).toBe(Math.floor(worth * PIRATE.hoardShare.alloy));
      expect(hoard.crystal).toBe(Math.floor(worth * PIRATE.hoardShare.crystal));
    }
  });

  it('keeps every figure a whole number, and the ladder rising with the level', () => {
    let previous = 0;
    for (const level of LEVELS) {
      const hoard = pirateHoard(pirateRoster(level, mulberry32(3)));
      for (const key of ['alloy', 'crystal', 'deuterium'] as const) {
        expect(Number.isInteger(hoard[key]), `${String(level)} ${key}`).toBe(true);
        expect(hoard[key]).toBeGreaterThan(0);
      }
      expect(resourcesTotal(hoard)).toBeGreaterThan(previous);
      previous = resourcesTotal(hoard);
    }
  });
});

/**
 * THE DECISION THE PRICING CREATES, HELD AS ARITHMETIC.
 *
 * *"Bir korsan filonun savaş değerinin 2 katı güçte bir filo yollarsak kabaca 2x-3x gelir elde
 * edilebilir. Ama 3-5 katı bir filo yollarsa gelir elde edemez veya çok daha fazla filo yollarsa
 * döteryum olarak zarar eder."*
 *
 * The wings below are the pirate's own roster scaled up, so their thirst scales with their
 * strength — which is what makes over-committing cost something instead of merely wasting time.
 */
describe('what over-committing costs a raider', () => {
  const RAID_DISTANCE = 600;
  const scaled = (roster: Fleet, times: number): Fleet => Object.fromEntries(
    Object.entries(roster).map(([id, n]) => [id, Math.max(1, Math.round(n * times))]),
  );
  const net = (level: PirateLevel, times: number): number => {
    const roster = pirateRoster(level, mulberry32(7));
    return pirateHoard(roster).deuterium
      - missionFuel(scaled(roster, times), RAID_DISTANCE, 2);
  };

  it('pays a wing twice the pirate’s size', () => {
    for (const level of LEVELS) expect(net(level, 2), `level ${String(level)}`).toBeGreaterThan(0);
  });

  /** The return falls as the wing grows, at every level — that is the rule, in one line. */
  it('pays less the more a raider over-commits', () => {
    for (const level of LEVELS) {
      let previous = Number.POSITIVE_INFINITY;
      for (const times of [1, 2, 3, 5, 8]) {
        const value = net(level, times);
        expect(value, `level ${String(level)} at ${String(times)}x`).toBeLessThan(previous);
        previous = value;
      }
    }
  });

  /**
   * AND IT CROSSES ZERO BY THE FIVE-TIMES WING — from level two up.
   *
   * Level one is exempt and stays exempt: its roster burns two deuterium over the reference span,
   * so the whole ladder there is single digits and rounding decides the sign. It is the opening
   * pirate, the one a commander meets before they know what a wing costs, and punishing them for
   * bringing too much to it would be teaching the wrong lesson with the wrong number.
   */
  it('pays a five-times wing nothing at all, from the second level up', () => {
    for (const level of [2, 3, 4] as const) {
      expect(net(level, 5), `level ${String(level)}`).toBeLessThanOrEqual(0);
    }
  });

  it('costs a wing eight times the pirate’s size real deuterium', () => {
    for (const level of LEVELS) expect(net(level, 8), `level ${String(level)}`).toBeLessThan(0);
  });

  /** And the prize can no longer refuel the raid that took it, at any level. */
  it('never refills the tank a proportionate raid emptied', () => {
    for (const level of LEVELS) {
      const roster = pirateRoster(level, mulberry32(7));
      const burn = missionFuel(scaled(roster, 3), RAID_DISTANCE, 2);
      expect(pirateHoard(roster).deuterium, `level ${String(level)}`).toBeLessThan(burn * 2);
    }
  });
});
