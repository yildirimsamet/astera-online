import { ARENA_TUNING as T } from '@astera/rules/arena';
import { describe, expect, it } from 'vitest';
import { dustGlow, FIELD_DUST, MAX_STREAK, RUSH_DUST, streakLength } from '../../src/arena/render/dust.js';

/**
 * Owner 2026-10-22: the white speed lines were too bright, too long and too many. Before:
 * 520 + 320 motes, lines of ~42 m in turbo, brightness 1.2 at full turbo.
 */
const TOP = T.speedMax * T.turboSpeedMul;

describe('speed lines', () => {
  it('are never longer than MAX_STREAK, even in turbo at top speed', () => {
    expect(MAX_STREAK).toBeLessThanOrEqual(14);
    for (const options of [FIELD_DUST, RUSH_DUST]) expect(streakLength(TOP, true, options.stretch)).toBeLessThanOrEqual(MAX_STREAK);
  });

  it('still read speed: dots when drifting, longer as the ship speeds up', () => {
    const at = (speed: number) => streakLength(speed, false, FIELD_DUST.stretch);
    expect(at(5)).toBeLessThan(1);
    expect(at(5)).toBeLessThan(at(60));
    expect(at(60)).toBeLessThan(at(T.speedMax));
  });

  it('are dimmer: at most 0.72 in turbo, the turbo-only swarm at most 0.5', () => {
    expect(dustGlow(TOP, true, true, false)).toBeLessThanOrEqual(0.72);
    expect(dustGlow(T.speedMax, false, true, false)).toBeLessThanOrEqual(0.62);
    expect(dustGlow(TOP, true, true, true)).toBeLessThanOrEqual(0.5);
    // Still there when drifting, gone with no pilot, and the swarm only in turbo.
    expect(dustGlow(0, false, true, false)).toBeGreaterThan(0);
    expect(dustGlow(T.speedMax, false, false, false)).toBe(0);
    expect(dustGlow(T.speedMax, false, true, true)).toBe(0);
  });

  it('are sparser: about half as many motes as before', () => {
    expect(FIELD_DUST.count).toBeLessThanOrEqual(300);
    expect(RUSH_DUST.count).toBeLessThanOrEqual(160);
  });
});
