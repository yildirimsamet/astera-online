import { describe, expect, it } from 'vitest';
import { TRACK_FRAME, TRACK_LOCK_SECONDS, trackFrame } from '../src/galaxy/trackFrame.js';

/**
 * ANOTHER COMMANDER'S JUMP, FAR OFF (owner 2026-11-18: no round glow). The ship is a speck; the sensors
 * lock a tracking frame on it: the brackets close in from wide, hold while it burns, and go when it is
 * gone or near enough to see for itself.
 */
const flying = { burn: 1, vanish: 0, lockedFor: 1, shipOnScreen: 0.002 };

describe('the tracking frame on a far jump', () => {
  it('holds on a burning ship far off', () => {
    const frame = trackFrame(flying);
    expect(frame.visible).toBe(true);
    expect(frame.opacity).toBeGreaterThan(0.8);
    expect(frame.scale).toBeCloseTo(TRACK_FRAME);
  });

  it('closes in from wide as it locks, and never grows after', () => {
    const start = trackFrame({ ...flying, lockedFor: 0 }).scale;
    const half = trackFrame({ ...flying, lockedFor: TRACK_LOCK_SECONDS / 2 }).scale;
    const locked = trackFrame({ ...flying, lockedFor: TRACK_LOCK_SECONDS }).scale;
    expect(start).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(locked);
    expect(locked).toBeCloseTo(TRACK_FRAME);
    expect(trackFrame({ ...flying, lockedFor: 60 }).scale).toBeCloseTo(TRACK_FRAME);
  });

  it('is not there before the engines light or once the ship has left', () => {
    expect(trackFrame({ ...flying, burn: 0 }).visible).toBe(false);
    expect(trackFrame({ ...flying, vanish: 1 }).visible).toBe(false);
    expect(trackFrame({ ...flying, vanish: 0.5 }).opacity).toBeLessThan(trackFrame(flying).opacity);
  });

  it('steps aside when the hull itself fills the frame', () => {
    expect(trackFrame({ ...flying, shipOnScreen: TRACK_FRAME }).visible).toBe(false);
    expect(trackFrame({ ...flying, shipOnScreen: TRACK_FRAME * 0.4 }).opacity)
      .toBeLessThan(trackFrame(flying).opacity);
  });
});
