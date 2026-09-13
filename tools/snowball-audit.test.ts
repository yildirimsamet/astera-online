import { expect, it } from 'vitest';
import { openingRoute, neutralBank, pirateRepeatProof, lowCoreHighTierProof } from './snowball-audit.js';

it('prices the capital gate from the current level and exposes its sub-hour paid opening', () => {
  const route = openingRoute();
  expect(route.coreCost).toEqual({ alloy: 2437, crystal: 657, deuterium: 0 });
  expect(route.coreMinutes).toBeCloseTo(24.8773271552, 8);
  expect(route.futureCoreCost.alloy).toBe(2312);
  expect(route.canFundCoreSixAndFounding).toBe(true);
});

it('separates fixed capture stock from the still-raidable neutral bank', () => {
  const bank = neutralBank();
  expect(bank.tiers.map((tier) => tier.count)).toEqual([38, 19, 8]);
  expect(bank.tiers.map((tier) => tier.captureValue)).toEqual([2000, 42000, 121000]);
  expect(bank.tiers[0]?.stock).toEqual({ alloy: 3878, crystal: 1939, deuterium: 970 });
  expect(bank.initialDeuterium).toBe(144513);
  expect(bank.tiers[2]?.raidThenCapture.deuterium).toBe(7114);
  expect(bank.tiers[2]?.raidThenCapture.deuterium).toBeGreaterThan(bank.tiers[2]!.stock.deuterium);
});

it('reproduces a bounded, lossless partial-then-decisive pirate payout above its original purse', () => {
  const proof = pirateRepeatProof();
  expect(proof.grades).toEqual(['PARTIAL', 'DECISIVE']);
  expect(proof.losses).toEqual([{}, {}]);
  expect(proof.totalPaid.alloy).toBeGreaterThan(proof.hoard.alloy);
  expect(proof.totalPaid.crystal).toBeGreaterThan(proof.hoard.crystal);
  expect(proof.originalPhysical).toBe(1127);
  expect(proof.paidPhysical).toBe(1179);
});

it('shows that a paid tier-four fleet can retain access to tier-one victims by holding Core six', () => {
  const proof = lowCoreHighTierProof();
  expect(proof.productionAllowed).toBe(true);
  expect(proof.researchGates.every((gate) => gate.requiredCore <= 6 && gate.availableAtMinutes === 0)).toBe(true);
  expect(proof.attackFromSix).toEqual({ ok: true });
  expect(proof.attackFromSeven).toEqual({ ok: false, reason: 'TIER_BAND_WEAK' });
});
