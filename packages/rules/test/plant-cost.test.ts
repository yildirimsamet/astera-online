import { describe, expect, it } from 'vitest';
import { DEUTERIUM, buildingCost, prospectorRoom, upgradeCost } from '../src/index.js';

/**
 * WHAT THE DEUTERIUM REFINERY COSTS, AND WHY IT IS NOT AN ORDINARY BUILDING. D170.
 *
 * It was priced off the shared `upgradeCost` curve like a Refinery or an
 * Extractor, and the owner's report is what that produced: *"Döteryum rafinerisi
 * level atlatmak için çok az kaynak istiyor, özellikle ilk 3-5 level çok düşük."*
 * The plant is the only source of the only resource a world cannot mine, gated
 * behind a research ladder that already costs thousands — and its first levels
 * came in at under a hundred alloy. The gate was the research; the building was
 * loose change behind it.
 *
 * FIVE TIMES AT THE BOTTOM, AND MUCH LESS AT THE TOP, which is the whole shape of
 * the request. The opening rungs are what a commander actually buys in the act
 * where deuterium is new, so they carry the change; by the time the plant is tall
 * the shared curve is already steep and multiplying it again would price the
 * resource out of the late game rather than into it.
 */

describe('the deuterium refinery has its own price', () => {
  it('opens at about five times an ordinary building', () => {
    for (const level of [0, 1, 2]) {
      const ratio = buildingCost('DEUTERIUM_PLANT', level).alloy / upgradeCost(level).alloy;
      expect(ratio, `L${String(level)}`).toBeGreaterThan(4.5);
      expect(ratio, `L${String(level)}`).toBeLessThan(5.5);
    }
  });

  it('costs less and less of a premium as it grows', () => {
    const ratio = (level: number) =>
      buildingCost('DEUTERIUM_PLANT', level).alloy / upgradeCost(level).alloy;
    for (let level = 1; level <= 14; level += 1) {
      expect(ratio(level), `L${String(level)}`).toBeLessThanOrEqual(ratio(level - 1));
    }
  });

  /** It never falls back to the plain curve, and never runs away from it either. */
  it('settles above the ordinary curve rather than on it', () => {
    const ratio = (level: number) =>
      buildingCost('DEUTERIUM_PLANT', level).alloy / upgradeCost(level).alloy;
    expect(ratio(15)).toBeGreaterThan(1.2);
    expect(ratio(15)).toBeLessThan(2);
    expect(ratio(30)).toBeGreaterThanOrEqual(DEUTERIUM.plantCostFloor);
  });

  it('charges the premium on Crystal too, and adds no deuterium', () => {
    const cost = buildingCost('DEUTERIUM_PLANT', 0);
    const base = upgradeCost(0);
    expect(cost.crystal / base.crystal).toBeCloseTo(cost.alloy / base.alloy, 1);
    expect(cost.deuterium).toBe(0);
  });

  /** Every other building is untouched: this change is one building wide. */
  it('leaves the ordinary buildings on the shared curve', () => {
    for (const type of ['CORE', 'REFINERY', 'EXTRACTOR', 'SHIPYARD'] as const) {
      expect(buildingCost(type, 4)).toEqual(upgradeCost(4));
    }
  });
});

/**
 * THE THIRD PROSPECTOR IS BOUGHT, NOT GIVEN. D170, owner request.
 *
 * D131 fixed a world at two Prospectors wherever they were standing, and that
 * ceiling is what makes a rock contested — a commander cannot simply out-mine a
 * neighbour by owning more craft. The third one keeps that true because it is not
 * free: it costs the third rung of Prospector Holds, which is 6,000 alloy and
 * 3,500 crystal of commander-wide research, and it lifts every world at once.
 *
 * `prospectorRoom` stays the single statement of the arithmetic — the build gate,
 * the transfer gate and the interface all read it — so the rung enters here or it
 * does not exist.
 */
describe('how many Prospectors a world may own', () => {
  it('is two until the third rung of Prospector Holds', () => {
    for (const rung of [0, 1, 2]) {
      expect(prospectorRoom(0, { PROSPECTOR_HOLDS: rung }), `rung ${String(rung)}`).toBe(2);
    }
  });

  it('is three from the third rung on', () => {
    for (const rung of [3, 4, 5]) {
      expect(prospectorRoom(0, { PROSPECTOR_HOLDS: rung }), `rung ${String(rung)}`).toBe(3);
    }
  });

  it('still counts what is already owned, and never goes negative', () => {
    expect(prospectorRoom(2, { PROSPECTOR_HOLDS: 3 })).toBe(1);
    expect(prospectorRoom(3, { PROSPECTOR_HOLDS: 3 })).toBe(0);
    expect(prospectorRoom(5, { PROSPECTOR_HOLDS: 3 })).toBe(0);
    expect(prospectorRoom(5, {})).toBe(0);
  });

  /** No research to hand is the two-craft world every caller had before. */
  it('reads two for a caller with no research', () => {
    expect(prospectorRoom(0, {})).toBe(2);
    expect(prospectorRoom(1, {})).toBe(1);
  });
});
