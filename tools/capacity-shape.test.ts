import { describe, expect, it } from 'vitest';
import { CAPACITY_NEUTRAL_SHAPE } from './capacity-shape.js';

describe('capacity reconciliation neutral shape', () => {
  it('follows the live D209 neutral template instead of a copied deployment literal', () => {
    expect(CAPACITY_NEUTRAL_SHAPE).toEqual({
      tier1: 38,
      tier2: 19,
      tier3: 8,
      total: 65,
    });
  });
});
