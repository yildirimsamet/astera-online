import { describe, expect, it } from 'vitest';
import { DEATH_STAR } from '../src/index.js';

describe('Death Star flight speed', () => {
  it('uses the approved 1,250-unit speed', () => {
    expect(DEATH_STAR.speed).toBe(1_250);
  });
});
