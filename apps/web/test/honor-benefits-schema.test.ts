import { describe, expect, it } from 'vitest';
import { HONOR_BENEFIT_THRESHOLDS_V1, honorBenefits } from '@astera/rules';
import { honorBenefitsSchema } from '../src/api/schemas.js';

describe('private Honor economics at the client boundary', () => {
  const value = { version: 1, score: -100_000_000, thresholds: HONOR_BENEFIT_THRESHOLDS_V1,
    ...honorBenefits(-100_000_000, HONOR_BENEFIT_THRESHOLDS_V1) };
  it('keeps the frozen policy, exact score and matching personal effects', () => {
    expect(honorBenefitsSchema.parse(value)).toEqual(value);
  });
  it('rejects a mismatched tier/rate rather than quoting a false price', () => {
    expect(honorBenefitsSchema.safeParse({ ...value, tradePct: 0 }).success).toBe(false);
    expect(honorBenefitsSchema.safeParse({ ...value, tier: 2 }).success).toBe(false);
    expect(honorBenefitsSchema.safeParse({ ...value, thresholds: { ...value.thresholds, positive: [0, 1] } }).success).toBe(false);
  });
  it.each([.5, -1.5, Number.MAX_SAFE_INTEGER + 1])('refuses a malformed score %s as a parse failure without throwing from refinement', score => {
    expect(honorBenefitsSchema.safeParse({ ...value, score }).success).toBe(false);
  });
  it.each([.5, Number.MAX_SAFE_INTEGER + 1])('refuses malformed threshold %s without running integer accounting', threshold => {
    expect(honorBenefitsSchema.safeParse({ ...value, thresholds: { ...value.thresholds,
      positive: [threshold, Number.MAX_SAFE_INTEGER + 2] } }).success).toBe(false);
  });
});
