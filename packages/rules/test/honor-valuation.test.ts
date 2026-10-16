import { describe, expect, it } from 'vitest';
import { createHonorCatalogue, createHonorStrategicCatalogue, honorStrategicValue, createHonorShieldCatalogue, honorShieldInvestment, honorFleetValue, honorLossEvidence, honorLootValue } from '../src/honorValuation.js';
import { HULLS, resolveRaid, soloStack, seededFrom, ESCAPE, instrumentCost } from '../src/index.js';
import { honorSide } from '../src/honor.js';

describe('frozen Honor military valuation', () => {
  const catalogue = createHonorCatalogue();
  it('freezes strategic prices separately from the ordinary hull catalogue', () => {
    expect(createHonorStrategicCatalogue()).toEqual({ DEATH_STAR: 216000, INTERCEPTOR: 71710 });
    expect(catalogue.DEATH_STAR).toBeUndefined();
    expect(honorStrategicValue({ DEATH_STAR: 123, INTERCEPTOR: 456 }, 'DEATH_STAR')).toBe(123);
  });
  it('rejects an unknown strategic identity or invalid frozen value', () => {
    expect(() => honorStrategicValue(createHonorStrategicCatalogue(), 'COURIER')).toThrow();
    expect(() => honorStrategicValue({ DEATH_STAR: -1, INTERCEPTOR: 456 }, 'DEATH_STAR')).toThrow();
    expect(() => honorStrategicValue({ DEATH_STAR: 1.5, INTERCEPTOR: 456 }, 'DEATH_STAR')).toThrow();
  });
  it('freezes cumulative shield investment independently of later catalogue changes', () => {
    const prices = createHonorShieldCatalogue();
    let expected = 0;
    for (let level = 0; level < 10; level++) {
      expect(honorShieldInvestment(prices, level)).toBe(expected);
      const cost = instrumentCost('AEGIS', level);
      expected += cost.alloy + 2 * cost.crystal + 32 * cost.deuterium;
    }
    expect(honorShieldInvestment([0, 123], 1)).toBe(123);
    for (const level of [-1, 0.5, Number.MAX_SAFE_INTEGER, prices.length]) {
      expect(() => honorShieldInvestment(prices, level)).toThrow();
    }
  });
  it('values fractional actual loot together before rounding to one resource-value unit', () => {
    expect(honorLootValue({ alloy: 0.4, crystal: 0.3, deuterium: 0.5 })).toBe(17);
    expect(honorLootValue({ alloy: 0, crystal: 0, deuterium: 0.125 })).toBe(4);
    expect(honorLootValue({ alloy: 0.99, crystal: 0, deuterium: 0 })).toBe(0);
    for (const alloy of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
      expect(() => honorLootValue({ alloy, crystal: 1, deuterium: 1 })).toThrow();
    }
  });
  it('prices the catalogue once, separately from nominal battle loss/Dominion values', () => {
    expect(catalogue.DART?.value).toBe(HULLS.DART.alloy + 2 * HULLS.DART.crystal + 32 * HULLS.DART.deuterium);
    expect(honorFleetValue(catalogue, { DART: 2 })).toBe(2 * (catalogue.DART?.value ?? 0));
    const custom = { DART: { value: 7, armed: true, ground: false } };
    expect(honorFleetValue(custom, { DART: 2 })).toBe(14);
  });
  it('counts cargo as permanent harm but never military success or owned armed reference', () => {
    const loss = honorLossEvidence(catalogue, { sent: { COURIER: 5 }, losses: { COURIER: 5 }, rebuilt: {} });
    expect(loss.all).toBeGreaterThan(0);
    expect(loss.armed).toBe(0);
    expect(honorFleetValue(catalogue, { COURIER: 5 }, true)).toBe(0);
  });
  it('deducts only actual free ground reconstruction', () => {
    const loss = honorLossEvidence(catalogue, { sent: { THORN: 10 }, losses: { THORN: 10 }, rebuilt: { THORN: 6 } });
    expect(loss.all).toBe(honorFleetValue(catalogue, { THORN: 4 }));
    expect(loss.armed).toBe(loss.all);
  });
  it('rejects unknown hulls, negative/fractional counts and impossible rebuilds', () => {
    expect(() => honorFleetValue(catalogue, { UNKNOWN: 1 })).toThrow();
    expect(() => honorFleetValue(catalogue, { DART: -1 })).toThrow();
    expect(() => honorFleetValue(catalogue, { DART: 0.5 })).toThrow();
    expect(() => honorLossEvidence(catalogue, { sent: { DART: 1 }, losses: { DART: 2 }, rebuilt: {} })).toThrow();
    expect(() => honorLossEvidence(catalogue, { sent: { DART: 1 }, losses: { DART: 1 }, rebuilt: { DART: 1 } })).toThrow();
    expect(() => honorLossEvidence(catalogue, { sent: { THORN: 1 }, losses: {}, rebuilt: { THORN: 1 } })).toThrow();
  });
  it('rejects unsafe resource accumulation rather than wrapping or dropping fractions', () => {
    expect(() => honorFleetValue(catalogue, { DART: Number.MAX_SAFE_INTEGER })).toThrow();
  });
  it.each(['escape', 'ground after escape', 'civilian', 'empty', 'wounded', 'mutual'])('prices actual engine casualties for %s', name => {
    const attacker = name === 'mutual' ? { PIKE: 1 } : { DART: 100 };
    const defender = name === 'mutual' ? { PIKE: 1 } : name === 'empty' ? {} : name === 'civilian' ? { COURIER: 10 }
      : name === 'ground after escape' ? { DART: 5, THORN: 5 } : { DART: 5 };
    const raid = resolveRaid({ stacks: [soloStack(attacker, { tech: {} }, name === 'wounded' ? [{ hull: 'DART', count: 100, damageBp: 9000 }] : undefined)],
      line: defender, shield: 0, rng: () => seededFrom(name), defender: { tech: {} }, deuterium: 1_000_000,
      escape: name.includes('escape'), minimumCombatShips: ESCAPE.minimumCombatShips, hostPlayerId: 'D', preciseDamage: true });
    const a = honorLossEvidence(catalogue, { sent: attacker, losses: raid.result.attackerLosses, rebuilt: {} });
    const d = honorLossEvidence(catalogue, { sent: defender, losses: raid.result.defenderLosses, rebuilt: raid.result.defenceSalvage });
    const score = honorSide({ k: d.armed, enemyLoss: d.all, l: a.all, loot: 0, ownTier: 3, enemyTier: 3, ownNavy: 100_000, enemyNavy: 100_000,
      defending: false, weakRepeat: 0, related: false, eligible: true, retaliationFifths: 0 });
    if (name === 'escape' || name === 'empty' || name === 'civilian') expect(score.raw).toBe(0);
    expect(score.raw).toBeLessThanOrEqual(d.armed * 1375);
    expect(a.all).toBeGreaterThanOrEqual(a.armed);
    expect(d.all).toBeGreaterThanOrEqual(d.armed);
  });
});
