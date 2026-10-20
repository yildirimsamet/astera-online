import { describe, expect, it } from 'vitest';
import { KNOB_TRAVEL, STICK_RING, stickHome, type Rect } from '../../src/arena/input.js';

/**
 * Owner 2026-10-21: "joystick'i hızlıca çekince çok fazla sağa gelebiliyor ve tuşlar iç
 * içe geçiyor". The stick base opens where the thumb lands, but never over a key, and
 * the knob never leaves its ring.
 */
const W = 350; const H = 812;
const pad: Rect = { left: 0, top: H * 0.56, right: W * 0.56, bottom: H };
const rect = (right: number, bottom: number, size: number): Rect =>
  ({ left: W - right - size, right: W - right, top: H - bottom - size, bottom: H - bottom });
const turbo = rect(112, 30, 58); const smoke = rect(112, 122, 50);
const land: Rect = { left: W / 2 - 37, right: W / 2 + 37, top: H - 240, bottom: H - 204 };

const clear = (c: { x: number; y: number }, key: Rect): boolean => {
  const dx = Math.max(key.left - c.x, 0, c.x - key.right); const dy = Math.max(key.top - c.y, 0, c.y - key.bottom);
  return dx * dx + dy * dy >= STICK_RING * STICK_RING;
};

describe('stick home', () => {
  it('opens where the thumb lands inside the home area', () => {
    expect(stickHome({ x: 100, y: H - 120 }, pad, [turbo, smoke])).toEqual({ x: 100, y: H - 120 });
  });

  it('never opens over the turbo or smoke key, however far right the thumb lands', () => {
    for (const x of [150, 190, 260]) for (const y of [H - 240, H - 160, H - 90]) {
      const home = stickHome({ x, y }, pad, [turbo, smoke]);
      expect(clear(home, turbo) && clear(home, smoke), `${String(x)},${String(y)}`).toBe(true);
    }
  });

  it('moves below the land key rather than covering it', () => {
    const home = stickHome({ x: 140, y: H - 230 }, pad, [turbo, smoke, land]);
    expect(clear(home, land)).toBe(true);
    expect(clear(home, turbo) && clear(home, smoke)).toBe(true);
    expect(home.y).toBeLessThanOrEqual(pad.bottom);
  });

  it('keeps the knob inside its ring', () => {
    expect(KNOB_TRAVEL + 23).toBeLessThanOrEqual(STICK_RING);
  });
});
