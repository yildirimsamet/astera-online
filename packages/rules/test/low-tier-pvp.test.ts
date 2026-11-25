import { describe, expect, it } from 'vitest';
import {
  computeLoot, coreTier, earnsRecoveryShield, extendRecoveryShield,
  pvpBalanceForTier, raidableStock, recoveryShieldUntil,
  type Resources,
} from '../src/index.js';

const empty: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
const stock: Resources = { alloy: 11_000, crystal: 6_000, deuterium: 3_000 };
const floor: Resources = { alloy: 1_000, crystal: 1_000, deuterium: 1_000 };
const buffer: Resources = { alloy: 2_000, crystal: 1_000, deuterium: 400 };

describe('the defending commander’s tier selects PvP protection', () => {
  it.each([1, 2, 3])('reduces loot and improves recovery at tier %i', tier => {
    expect(pvpBalanceForTier(tier)).toMatchObject({
      lootDecisive: 0.25, lootPartial: 0.125, lootBufferShare: 0.6,
      recoveryLossHours: 2, recoveryLookbackHours: 8, recoveryShieldHours: 12,
    });
  });

  it.each([4, 5])('uses mid-tier loot (45%%/22.5%%) and 3-hour recovery at tier %i', tier => {
    expect(pvpBalanceForTier(tier)).toMatchObject({
      lootDecisive: 0.45, lootPartial: 0.225, lootBufferShare: 0.5,
      recoveryLossHours: 3, recoveryLookbackHours: 6, recoveryShieldHours: 12,
    });
  });

  it.each([6, 7, undefined, null, 0, -1, 1.5, Number.NaN, Infinity])(
    'keeps standard rules for tier %s or absent/invalid context', tier => {
      expect(pvpBalanceForTier(tier)).toMatchObject({
        lootDecisive: 0.6, lootPartial: 0.3, lootBufferShare: 0.5,
        recoveryLossHours: 3, recoveryLookbackHours: 6, recoveryShieldHours: 12,
      });
    },
  );

  it('changes at Core 9 → 10 and Core 15 → 16', () => {
    expect(pvpBalanceForTier(coreTier(9)).recoveryLossHours).toBe(2);
    expect(pvpBalanceForTier(coreTier(10)).recoveryLossHours).toBe(3);
    expect(pvpBalanceForTier(coreTier(10)).lootDecisive).toBe(0.45);
    expect(pvpBalanceForTier(coreTier(15)).lootDecisive).toBe(0.45);
    expect(pvpBalanceForTier(coreTier(16)).lootDecisive).toBe(0.6);
  });
});

describe('low-tier loot', () => {
  it('takes 25% of exposed storage and 15% of Works independently for every resource', () => {
    const loot = computeLoot(stock, buffer, floor, 'DECISIVE', 1e9, pvpBalanceForTier(3));
    expect(loot.fromStock).toEqual({ alloy: 2_500, crystal: 1_250, deuterium: 500 });
    expect(loot.fromBuffer).toEqual({ alloy: 300, crystal: 150, deuterium: 60 });
    expect(loot.alloy + loot.crystal + loot.deuterium).toBe(4_760);
    expect(raidableStock(stock, buffer, floor, 'DECISIVE', pvpBalanceForTier(3))).toBe(4_760);
  });

  it('halves both shares for a partial success', () => {
    const loot = computeLoot(stock, buffer, floor, 'PARTIAL', 1e9, pvpBalanceForTier(1));
    expect(loot.fromStock).toEqual({ alloy: 1_250, crystal: 625, deuterium: 250 });
    expect(loot.fromBuffer).toEqual({ alloy: 150, crystal: 75, deuterium: 30 });
  });

  it('still protects the floor while exposing uncollected Works', () => {
    const loot = computeLoot(floor, buffer, floor, 'DECISIVE', 1e9, pvpBalanceForTier(2));
    expect(loot.fromStock).toEqual(empty);
    expect(loot.fromBuffer).toEqual({ alloy: 300, crystal: 150, deuterium: 60 });
  });

  it('caps the whole proportional load to surviving cargo', () => {
    const loot = computeLoot(stock, buffer, floor, 'DECISIVE', 476, pvpBalanceForTier(3));
    expect(loot.fromStock).toEqual({ alloy: 250, crystal: 125, deuterium: 50 });
    expect(loot.fromBuffer).toEqual({ alloy: 30, crystal: 15, deuterium: 6 });
    expect(loot.alloy + loot.crystal + loot.deuterium).toBe(476);
  });

  it.each(['REPELLED', 'DECISIVE'] as const)('takes nothing for %s with no cargo', grade => {
    expect(computeLoot(stock, buffer, floor, grade, 0, pvpBalanceForTier(1)).alloy).toBe(0);
  });

  it('a repelled fleet takes nothing even with cargo', () => {
    expect(computeLoot(stock, buffer, floor, 'REPELLED', 1e9, pvpBalanceForTier(1)).alloy).toBe(0);
  });

  it('takes 45% of exposed storage and 22.5% of Works at tiers 4–5, and 60%/30% at tier 6+ and NPC', () => {
    const mid = computeLoot(stock, buffer, floor, 'DECISIVE', 1e9, pvpBalanceForTier(4));
    expect(mid.fromStock).toEqual({ alloy: 4_500, crystal: 2_250, deuterium: 900 });
    expect(mid.fromBuffer).toEqual({ alloy: 450, crystal: 225, deuterium: 90 });
    const midPartial = computeLoot(stock, buffer, floor, 'PARTIAL', 1e9, pvpBalanceForTier(5));
    expect(midPartial.fromStock).toEqual({ alloy: 2_250, crystal: 1_125, deuterium: 450 });
    expect(midPartial.fromBuffer).toEqual({ alloy: 225, crystal: 112, deuterium: 45 });
    expect(computeLoot(stock, buffer, floor, 'DECISIVE', 1e9)).toEqual(
      computeLoot(stock, buffer, floor, 'DECISIVE', 1e9, pvpBalanceForTier(6)),
    );
    expect(computeLoot(stock, buffer, floor, 'DECISIVE', 1e9).fromStock.alloy).toBe(6_000);
    expect(computeLoot(stock, buffer, floor, 'DECISIVE', 1e9).fromBuffer.alloy).toBe(600);
  });
});

describe('low-tier recovery', () => {
  const production = { alloy: 1_000, crystal: 500, deuterium: 20 };
  const loss = (hours: number) => ({ alloy: 1_000 * hours, crystal: 500 * hours, deuterium: 20 * hours });
  const check = (hours: number, tier: number) => ({
    production, defeats: [{ loot: loss(hours), fleetLost: empty }], raids: [],
    balance: pvpBalanceForTier(tier),
  });

  it('includes the exact two-hour (tier 1–3) and three-hour (tier 4+) boundaries', () => {
    expect(earnsRecoveryShield(check(2, 3))).toBe(true);
    expect(earnsRecoveryShield(check(1.999, 3))).toBe(false);
    expect(earnsRecoveryShield(check(2.999, 4))).toBe(false);
    expect(earnsRecoveryShield(check(3, 4))).toBe(true);
    expect(earnsRecoveryShield(check(3, 6))).toBe(true);
  });

  it('keeps permanent fleet loss and positive own-raid profit in the calculation', () => {
    const input = check(1, 2);
    input.defeats[0]!.fleetLost = loss(1);
    expect(earnsRecoveryShield(input)).toBe(true);
    expect(earnsRecoveryShield({ ...input, raids: [{ loot: loss(0.1), fleetLost: empty }] })).toBe(false);
  });

  it('grants twelve hours without stacking or shortening an existing window', () => {
    const balance = pvpBalanceForTier(3);
    expect(recoveryShieldUntil(1_000, balance)).toBe(1_000 + 12 * 3_600_000);
    expect(extendRecoveryShield(1_000 + 5 * 3_600_000, 1_000, balance)).toBe(1_000 + 12 * 3_600_000);
    expect(extendRecoveryShield(1_000 + 15 * 3_600_000, 1_000, balance)).toBe(1_000 + 15 * 3_600_000);
    expect(recoveryShieldUntil(1_000, pvpBalanceForTier(4))).toBe(1_000 + 12 * 3_600_000);
  });
});
