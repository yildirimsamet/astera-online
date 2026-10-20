import { describe, expect, it } from 'vitest';
import { createInput, createSandboxWorld, hiddenBySmoke, stepSandboxWorld, ARENA_TUNING as T } from '../../src/arena/index.js';

/**
 * Owner 2026-10-21: smoke lasts half again as long, spreads 30 % wider and is denser to
 * see through. Sight through a grown puff is blocked; a puff thins out only at its end.
 */
const puff = (age: number) => ({ p: { x: 0, y: 0, z: 0 }, age, active: true, owner: 1 });

describe('smoke screen', () => {
  it('blocks a line passing 45 m from a grown puff', () => {
    expect(hiddenBySmoke([puff(1)], { x: -200, y: 45, z: 0 }, { x: 200, y: 45, z: 0 })).toBe(true);
    expect(hiddenBySmoke([puff(1)], { x: -200, y: 47, z: 0 }, { x: 200, y: 47, z: 0 })).toBe(false);
  });

  it('hangs for ten and a half seconds', () => {
    const world = createSandboxWorld();
    const smoke = world.smoke[0]; if (!smoke) throw new Error('no puff');
    Object.assign(smoke, puff(0));
    const input = createInput();
    for (let tick = 0; tick < 10 * T.tickRate; tick++) stepSandboxWorld(world, input);
    expect(smoke.active).toBe(true);
    for (let tick = 0; tick < 0.6 * T.tickRate; tick++) stepSandboxWorld(world, input);
    expect(smoke.active).toBe(false);
  });

  it('holds every puff of eight pilots smoking at once', () => {
    const perScreen = Math.ceil(T.smokeEmitDuration / T.smokePuffInterval);
    expect(createSandboxWorld().smoke.length).toBeGreaterThanOrEqual(8 * perScreen);
  });
});
