import { describe, expect, it } from 'vitest';
import {
  COMBAT_HULLS, HULLS, SENSOR, massClass, massMediumValue, massHeavyValue,
  type HullId,
} from '../src/index.js';

const val = (id: HullId): number => HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium;
const cheapestAt = (tier: number): number =>
  Math.min(...COMBAT_HULLS.filter((id) => HULLS[id].tier === tier).map(val));

/**
 * WHAT A STRANGER IS TOLD ABOUT A FLEET, AND WHERE THE LINE BETWEEN THE WORDS IS.
 * D197, owner instruction: *"eski bir hesaptan geliyor -> düzeltilmeli"*.
 *
 * `SENSOR.massMedium/massHeavy` were `scalePrice(…, ECONOMY_TEMPO.hullPrice)` —
 * and `ECONOMY_TEMPO.hullPrice` stopped pricing hulls when the executable economy
 * took over. Its own docblock states the intent it had already lost: *"Read
 * against `fleetValue`, which is the quantity the hull table is priced on, so the
 * buckets move with prices instead of drifting away from them."* The numbers were
 * still correct — measured across the whole catalogue — but nothing connected them
 * to the table any more, so the next price change would have moved every hull and
 * left both thresholds where they were, silently.
 *
 * ONE IDEA, TWO RUNGS: a wing is `SENSOR.massWing` hulls, and what the words
 * separate is which TIER those hulls are. MEDIUM is a wing of mid-tier craft — a
 * working raid — and HEAVY is a wing of the best a commander can build.
 */
describe('the mass a stranger reads off a fleet', () => {
  it('derives both thresholds from the live hull table', () => {
    expect(massMediumValue()).toBe(SENSOR.massWing * cheapestAt(SENSOR.massMediumTier));
    expect(massHeavyValue()).toBe(SENSOR.massWing * cheapestAt(SENSOR.massHeavyTier));
    expect(massMediumValue()).toBeLessThan(massHeavyValue());
  });

  /** A single craft of anything is a mote, which is what LIGHT is for. */
  it('calls one of anything light', () => {
    for (const id of COMBAT_HULLS) expect(massClass({ [id]: 1 }), id).toBe('LIGHT');
  });

  /**
   * THE THREE WORDS HAVE TO SEPARATE THE THREE STAGES a commander actually flies,
   * or the reading tells a stranger nothing they could not have guessed.
   */
  it('separates an opening raid, a working raid and a commitment', () => {
    expect(massClass({ DART: 6 })).toBe('LIGHT');
    expect(massClass({ DART: 20 })).toBe('LIGHT');
    expect(massClass({ VIPER: 10, COURIER: 3 })).toBe('MEDIUM');
    expect(massClass({ TEMPEST: 12, WAYFARER: 3 })).toBe('MEDIUM');
    expect(massClass({ CATACLYSM: 8, ATLAS: 3 })).toBe('HEAVY');
    expect(massClass({ CORSAIR: 10, ARGOSY: 2 })).toBe('HEAVY');
  });

  /** And it must actually MOVE with the table, which is the whole repair. */
  it('tracks the catalogue rather than a number typed beside it', () => {
    const tier2 = cheapestAt(2), tier4 = cheapestAt(4);
    expect(massMediumValue() / tier2).toBe(SENSOR.massWing);
    expect(massHeavyValue() / tier4).toBe(SENSOR.massWing);
  });
});
