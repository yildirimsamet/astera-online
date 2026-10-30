import { describe, expect, it } from 'vitest';
import { CAPACITY_NEUTRAL_SHAPE } from './capacity-shape.js';

describe('capacity reconciliation neutral shape', () => {
  it('follows the opening neutral template instead of a copied deployment literal', () => {
    // A fresh season opens with these and grows by census; the seed opens fresh seasons.
    expect(CAPACITY_NEUTRAL_SHAPE).toEqual({
      tier1: 15,
      tier2: 8,
      tier3: 3,
      total: 26,
    });
  });
});
