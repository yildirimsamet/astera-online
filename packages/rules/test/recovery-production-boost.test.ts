import { describe, expect, it } from 'vitest';
import {
  ABUSE,
  SHIELD,
  advanceEconomy,
  alloyRate,
  collectorCap,
  crystalRate,
  deuteriumCollectorCap,
  deuteriumRate,
  productionHours,
  productiveMinutes,
  shieldHp,
} from '../src/index.js';

/**
 * THE STRUCK WORLD WORKS DOUBLE WHILE THE RECOVERY SHIELD STANDS. Owner instruction,
 * 2026-09-16: *"Saldırı yiyen'e verdiğimiz kalkanın süresi 6 saat olmalı ve ek olarak
 * bu kalkan aktifken saldırı yediği gezegendeki üretim %100 boostlanmalı."*
 *
 * The pure half lives here: how many hours of production a span is worth when part
 * of it is boosted, and what the lazy tick does with that. Who gets the boost, and
 * when it is cut short, is the server's (`apps/server/test/recovery-shield.test.ts`).
 */

describe('the recovery production boost, as a figure', () => {
  it('is a hundred per cent on a six-hour window', () => {
    expect(ABUSE.recoveryShieldHours).toBe(6);
    expect(ABUSE.recoveryProductionMult).toBe(2);
  });
});

describe('production hours across a span', () => {
  it('is the ordinary productive hours when nothing is boosted', () => {
    expect(productionHours(0, 120)).toBe(2);
    expect(productionHours(0, 120, 60)).toBe(productiveMinutes(0, 120, 60) / 60);
    expect(productionHours(0, 120, 0, null)).toBe(2);
  });

  it('doubles every minute the boost covers', () => {
    expect(productionHours(0, 120, 0, 120)).toBe(4);
    expect(productionHours(0, 120, 0, 500)).toBe(4);
  });

  it('doubles only the part of the span before the boost ends', () => {
    // One boosted hour and one ordinary hour.
    expect(productionHours(0, 120, 0, 60)).toBe(3);
  });

  it('adds nothing once the boost ended before the span began', () => {
    expect(productionHours(120, 240, 0, 60)).toBe(2);
    // The boundary belongs to the galaxy: a boost ending exactly at `from` is gone.
    expect(productionHours(120, 240, 0, 120)).toBe(2);
  });

  /**
   * A DISRUPTED WORLD IS NOT PRODUCING, AND A BOOST CANNOT DOUBLE ZERO.
   *
   * A raid that clears the recovery bar also disrupts the surface, so the first
   * minutes of every boost are usually offline. The boost is spent in wall time —
   * it ends with the shield — and pays only the minutes the works actually ran.
   */
  it('boosts only productive minutes inside a disruption', () => {
    // Offline until 30, boosted until 90: 60 productive boosted + 30 ordinary.
    expect(productionHours(0, 120, 30, 90)).toBe((90 + 60) / 60);
    // A boost that ends while the works are still offline adds nothing.
    expect(productionHours(0, 120, 60, 45)).toBe(1);
  });

  it('never counts backwards and refuses a nonsense boost instant', () => {
    expect(productionHours(120, 60, 0, 500)).toBe(0);
    expect(productionHours(0, 60, 0, Number.NaN)).toBe(1);
    expect(productionHours(0, 60, 0, Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe('the lazy tick under a recovery boost', () => {
  const input = {
    refineryLevel: 5,
    extractorLevel: 4,
    plantLevel: 3,
    aegisLevel: 2,
    vaultLevel: 0,
  };
  const fresh = () => ({
    alloy: 0,
    crystal: 0,
    deuterium: 0,
    bufferAlloy: 0,
    bufferCrystal: 0,
    bufferDeuterium: 0,
    shield: 0,
    lastTickMinutes: 0,
    disruptedUntilMinutes: 0,
  });

  it('fills the works twice as fast while boosted', () => {
    const boosted = advanceEconomy(fresh(), { ...input, recoveryBoostUntilMinutes: 360 }, 60);
    expect(boosted.bufferAlloy).toBeCloseTo(alloyRate(5) * 2, 6);
    expect(boosted.bufferCrystal).toBeCloseTo(crystalRate(4) * 2, 6);
    expect(boosted.bufferDeuterium).toBeCloseTo(deuteriumRate(3) * 2, 6);
  });

  it('reads exactly as before when no boost is given', () => {
    expect(advanceEconomy(fresh(), { ...input, recoveryBoostUntilMinutes: null }, 60))
      .toEqual(advanceEconomy(fresh(), input, 60));
  });

  it('stops doubling at the instant the boost ends', () => {
    const after = advanceEconomy(fresh(), { ...input, recoveryBoostUntilMinutes: 30 }, 60);
    expect(after.bufferAlloy).toBeCloseTo(alloyRate(5) * 1.5, 6);
  });

  /**
   * THE COLLECTOR DOES NOT GROW WITH THE BOOST, AND THAT IS LOAD-BEARING.
   *
   * A ceiling that doubled for six hours would shrink back when the shield fell, and
   * the next tick would clamp the buffer down to it — the commander would lose ore
   * they had already made. So the boost fills the SAME vessel faster; it never makes
   * the vessel bigger.
   */
  it('fills the same collector faster rather than enlarging it', () => {
    const after = advanceEconomy(fresh(), { ...input, recoveryBoostUntilMinutes: 60 * 500 }, 60 * 500);
    expect(after.bufferAlloy).toBe(collectorCap(alloyRate(5)));
    expect(after.bufferCrystal).toBe(collectorCap(crystalRate(4)));
    expect(after.bufferDeuterium).toBe(deuteriumCollectorCap(deuteriumRate(3), crystalRate(4)));
  });

  it('leaves shield regeneration on wall time', () => {
    const plain = advanceEconomy(fresh(), input, 60);
    const boosted = advanceEconomy(fresh(), { ...input, recoveryBoostUntilMinutes: 360 }, 60);
    expect(boosted.shield).toBe(plain.shield);
    expect(boosted.shield).toBeCloseTo(shieldHp(2) * SHIELD.regenPerHour, 6);
  });

  it('pays nothing extra while the surface is disrupted', () => {
    const state = { ...fresh(), disruptedUntilMinutes: 60 };
    const after = advanceEconomy(state, { ...input, recoveryBoostUntilMinutes: 360 }, 60);
    expect(after.bufferAlloy).toBe(0);
  });
});
