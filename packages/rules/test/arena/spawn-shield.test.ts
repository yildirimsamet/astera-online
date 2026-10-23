import { describe, expect, it } from 'vitest';
import { ARENA_TUNING as T } from '../../src/arena/index.js';
import { createPilot } from '../../src/arena/world.js';

/** Owner 2026-10-22: the newborn's no-damage shield lasts 15 s, not a minute (S29). */
describe('spawn shield', () => {
  it('lasts 15 seconds', () => {
    expect(T.spawnShield).toBe(15);
    expect(createPilot(0).shield).toBe(15 * T.tickRate);
  });
});
