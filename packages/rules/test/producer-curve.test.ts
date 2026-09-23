import { describe, expect, it } from 'vitest';
import {
  ECONOMY_ADJUSTMENT,
  ECONOMY_CURVE,
  SEASON,
  alloyRate,
  buildingCost,
  crystalRate,
  marginalOutput,
  producerPaybackHours,
  profileIncome,
  resourceValue,
  type ProducerId,
} from '../src/index.js';

/**
 * ONE PRODUCER CURVE FOR A THIRTY-DAY SEASON. Plan §15.7 (Faz 4.1 + 4.2), owner decision
 * 2026-09-22.
 *
 * THE COMPLAINT, IN THE OWNER'S WORDS: *"3-5 gün saçmalık"* — and the clarification that matters:
 * Refinery 10, 11 and 12 are LOW levels in this economy's plan. A rung there that takes three to
 * five days to repay tells a commander on day five that the producer ladder is already over. The
 * live season shows exactly that: the median Refinery reached 10 on day 4 and 11 on day 5, and
 * then the whole field stopped — sixteen commanders reached 12, one reached 16, with twenty-four
 * days of season still to run.
 *
 * WHAT THE PLAN ASKED FOR (§0.7): a single curve, the L12 exception deleted, the L5–L9 dead zone
 * closed, and a sunset that still arrives — around day 24 for a Refinery-20 world — so the last
 * week belongs to fleets rather than mines.
 *
 * PAYBACK IS THE PLAYER'S OWN ARITHMETIC. `producerPaybackHours` is the rung's price over what it
 * adds, both on `resourceValue` — the same sum the chat logs do by hand (*"60000 harcıyom, saatte 200
 * daha fazla"*).
 */

const PRODUCERS: readonly ProducerId[] = ['REFINERY', 'EXTRACTOR', 'DEUTERIUM_PLANT'];
const TOP = 29;
const days = (hours: number): number => hours / 24;
/** Payback of the rung that takes a world from `from` to `from + 1`. */
const payback = (producer: ProducerId, from: number): number => producerPaybackHours(producer, from);

describe('the producer ladder repays on a curve a player can follow', () => {
  /**
   * THE DEAD ZONE, CLOSED. Between Refinery 6 and 10 the opening lift decays, each rung adds less
   * alloy than the one before (190 → 103 an hour), the price kept climbing, and payback went from
   * 7 hours to 82 in four rungs. A rung that repays SLOWER than the one above it is a ladder that
   * punishes climbing it.
   */
  it('never repays a rung slower than the rung above it', () => {
    for (const producer of PRODUCERS) {
      for (let from = 1; from < TOP; from++) {
        expect(payback(producer, from + 1), `${producer} ${String(from + 1)}→${String(from + 2)}`)
          .toBeGreaterThan(payback(producer, from));
      }
    }
  });

  /**
   * ONE SHAPE, NO SEAMS. HEAD's curve was three shapes stitched at L10 (the lift ends, x1.8) and L12
   * (the late exception, x1.6 on the output side). Past the opening every step grows by the same
   * modest factor; the one seam left is where the flat opening lift hands over, and it is gentler
   * than any step the old ladder took there.
   */
  it('grows by one gentle factor per rung past the opening', () => {
    for (const producer of PRODUCERS) {
      for (let from: number = ECONOMY_CURVE.openingTop; from < TOP; from++) {
        const step = payback(producer, from + 1) / payback(producer, from);
        expect(step, `${producer} ${String(from + 1)}`).toBeLessThanOrEqual(1.5);
      }
    }
  });

  /** The owner's own target: the low levels repay in about a day, never in three to five. */
  it('repays Refinery and Extractor 10, 11 and 12 inside a day and a half', () => {
    for (const producer of ['REFINERY', 'EXTRACTOR'] as const) {
      for (const from of [10, 11, 12]) {
        const hours = payback(producer, from);
        expect(days(hours), `${producer} ${String(from)}→${String(from + 1)}`).toBeLessThanOrEqual(1.5);
        // And still a price: a rung that repays in an hour is not a decision.
        expect(hours, `${producer} ${String(from)}→${String(from + 1)}`).toBeGreaterThanOrEqual(12);
      }
    }
  });

  /**
   * THE SUNSET STILL COMES, AND WHERE THE PLAN PUT IT. `worthInvesting` stops a rung once its
   * payback exceeds `investmentHorizonShare` of the season left; for a Refinery-20 world that must
   * land in the last week — around day 24 — not on day 10 (the old ladder) and not never.
   */
  it('puts the Refinery-20 sunset in the last week of a thirty-day season', () => {
    const hoursLeftAtSunset = payback('REFINERY', 20) / SEASON.investmentHorizonShare;
    const sunsetDay = 30 - days(hoursLeftAtSunset);
    expect(sunsetDay).toBeGreaterThanOrEqual(21);
    expect(sunsetDay).toBeLessThanOrEqual(25);
  });

  /** The Plant repays roughly twice as slowly as the Refinery at every rung, and keeps doing so. */
  it('keeps the Plant a steady multiple of the Refinery', () => {
    for (let from = ECONOMY_CURVE.openingTop + 1; from < TOP; from++) {
      const ratio = payback('DEUTERIUM_PLANT', from) / payback('EXTRACTOR', from);
      expect(ratio, `plant/extractor at ${String(from)}`).toBeGreaterThan(1.5);
      expect(ratio, `plant/extractor at ${String(from)}`).toBeLessThan(2.5);
    }
  });
});

/**
 * THE CORE ON ITS OWN, GENTLER CURVE. Owner decision, 2026-09-23.
 *
 * No producer may pass the Core, so a world at its own ceiling pays the Core rung AND the producer
 * rungs for its next level. Putting the Core on the producers' curve made that cheap — and made the
 * Core itself cheap: the sim's median reached Core 25 by day 30, where ground emplacements
 * (+10 a level), flight bays (+1 per 3), the ±1 attack tier and colony loyalty tiers were all built
 * for Core ~12–18. Re-balancing every one of those was the alternative, and the owner chose not to.
 *
 * So the Core has its own slope, `coreGrowth`, chosen so its level stays where the live game already
 * plays (median Core 13, top 17 on day 9 of the live season): the sim's day-30 median lands at 16,
 * its top tenth at 19. Below the Core ceiling — where the live field stands at Refinery 10–12 —
 * a producer rung still repays in about a day; above it, a whole level costs more, and the sunset
 * arrives with the Core.
 */
describe('a world standing at its own Core ceiling', () => {
  const levelPayback = (from: number): number => {
    const price = resourceValue(buildingCost('CORE', from))
      + resourceValue(buildingCost('REFINERY', from))
      + resourceValue(buildingCost('EXTRACTOR', from));
    const gain = resourceValue(marginalOutput('REFINERY', from))
      + resourceValue(marginalOutput('EXTRACTOR', from));
    return price / gain;
  };

  it('keeps the Core on its own slope, gentler than the old one and steeper than the producers', () => {
    expect(ECONOMY_CURVE.coreGrowth).toBeGreaterThan(ECONOMY_CURVE.growth);
    expect(ECONOMY_CURVE.coreGrowth).toBeLessThan(ECONOMY_CURVE.openingGrowth);
    for (let from = ECONOMY_CURVE.openingTop + 1; from < TOP; from++) {
      const step = resourceValue(buildingCost('CORE', from)) / resourceValue(buildingCost('CORE', from - 1));
      expect(step, `Core ${String(from)}`).toBeGreaterThan(1);
    }
  });

  /** Where the live field is today, a whole level still repays in under three days. */
  it('repays a whole level at Core 12 inside three days, and at Core 16 inside six', () => {
    expect(days(levelPayback(12))).toBeLessThanOrEqual(3);
    expect(days(levelPayback(16))).toBeLessThanOrEqual(6);
  });

  /**
   * MORE CRYSTAL IN THE CORE, NOT MORE COST. On its steeper slope the Core became most of a level's
   * price, and its alloy-heavy recipe (0.65 / 0.35) pushed the whole level's crystal charge under the
   * floor `invariants.test.ts` holds (0.6 of the rate crystal arrives) — crystal piling up faster,
   * the chat logs' own complaint. Past the opening the Core's recipe leans to crystal (0.55 / 0.45);
   * a crystal is worth two alloy, so the rung's value, payback and build time do not move.
   */
  it('leans the Core past the opening toward crystal without changing what it costs', () => {
    const early = buildingCost('CORE', ECONOMY_CURVE.openingTop - 1);
    expect(early.crystal / early.alloy).toBeCloseTo((0.35 * 0.5) / 0.65, 2);
    for (const from of [ECONOMY_CURVE.openingTop, 10, 16, 22]) {
      const late = buildingCost('CORE', from);
      expect(late.crystal / late.alloy, `Core ${String(from)}`).toBeCloseTo((0.45 * 0.5) / 0.55, 2);
    }
  });

  /** And the brake is real: past the range the level rules were built for, climbing slows hard. */
  it('slows a Core-bound world down well before the old level rules would be outgrown', () => {
    expect(days(levelPayback(20))).toBeGreaterThanOrEqual(10);
  });
});

/**
 * WHAT DOES NOT MOVE. The opening was calibrated rung by rung (D56's rehearsal, the Academy) and a
 * cheaper late ladder is no reason to re-teach the first minutes; the Vault, the Shipyard and the
 * Hangar are priced on their own stages and are not part of this decision.
 */
describe('everything this curve does not own', () => {
  it('prices the first five rungs of every producer and the Core exactly as before', () => {
    expect(buildingCost('REFINERY', 1)).toEqual({ alloy: 88, crystal: 11, deuterium: 0 });
    expect(buildingCost('REFINERY', 5)).toEqual({ alloy: 1411, crystal: 177, deuterium: 0 });
    expect(buildingCost('EXTRACTOR', 5)).toEqual({ alloy: 706, crystal: 530, deuterium: 0 });
    expect(buildingCost('DEUTERIUM_PLANT', 5)).toEqual({ alloy: 1059, crystal: 1059, deuterium: 0 });
    expect(buildingCost('CORE', 5)).toEqual({ alloy: 1147, crystal: 309, deuterium: 0 });
  });

  it('leaves the Vault, the Shipyard and the Hangar where they were', () => {
    expect(buildingCost('VAULT', 12)).toEqual({ alloy: 30842, crystal: 15421, deuterium: 0 });
    expect(buildingCost('VAULT', 16)).toEqual({ alloy: 169703, crystal: 84852, deuterium: 0 });
    expect(buildingCost('SHIPYARD', 5)).toEqual({ alloy: 32587, crystal: 12534, deuterium: 0 });
    expect(buildingCost('SHIPYARD', 8)).toEqual({ alloy: 55204, crystal: 21233, deuterium: 0 });
    expect(buildingCost('HANGAR', 4)).toEqual({ alloy: 31324, crystal: 8434, deuterium: 0 });
  });

  /**
   * THE LATE OUTPUT LIFT IS PRICED, NOT DELETED. The owner's 2026-09-20 request (late gains that
   * accelerate, Refinery 14 at 2,400 an hour) stays; what goes is the seam it cut into payback when
   * the invoice ignored it. Priced on what each rung really adds, the Refinery and the Extractor
   * repay on the same curve at every rung past the opening, lift or no lift.
   */
  it('prices every rung past the opening on the output it really adds', () => {
    for (let from: number = ECONOMY_CURVE.openingTop; from < TOP; from++) {
      expect(payback('REFINERY', from) / payback('EXTRACTOR', from), `rung ${String(from)}`)
        .toBeCloseTo(1, 2);
    }
    expect(alloyRate(14)).toBeGreaterThanOrEqual(2_400);
    expect(crystalRate(16) / profileIncome(16).crystal).toBeGreaterThan(ECONOMY_ADJUSTMENT.producerOutput);
  });
});
