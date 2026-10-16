import { describe, expect, it } from 'vitest';
import { DEATH_STAR } from '../src/index.js';

describe('Death Star flight speed', () => {
  it('flies 50% faster than the 1,000 units the 20% reduction left it (owner, 2026-10-16)', () => {
    expect(DEATH_STAR.speed).toBe(1_500);
  });
});
