import { describe, expect, it } from 'vitest';
import { arriveShip, departShip, WARP_STAGGER, warpSecond } from '../../src/dev/lab/warp.js';

describe('fleet warp timeline (vfx lab)', () => {
  it('a departing ship spools up, stretches into light and is gone', () => {
    const jump = warpSecond('depart', 0);
    expect(departShip(0, 0).visible).toBe(true);
    expect(departShip(0, 0).stretch).toBe(1);
    expect(departShip(0, 0.9).engine).toBeGreaterThan(departShip(0, 0.1).engine);
    expect(departShip(0, jump + 0.05).stretch).toBeGreaterThan(3);
    expect(departShip(0, jump + 0.2).visible).toBe(false);
    expect(departShip(0, jump).flash).toBeGreaterThan(0.9);
    expect(departShip(0, jump + 0.5).flash).toBe(0);
  });

  it('ships leave one after another, never all on one frame', () => {
    expect(warpSecond('depart', 1) - warpSecond('depart', 0)).toBeCloseTo(WARP_STAGGER);
    const jump = warpSecond('depart', 0);
    expect(departShip(0, jump + 0.15).visible).toBe(false);
    expect(departShip(4, jump + 0.15).visible).toBe(true);
  });

  it('a departing ship keeps moving forward until it vanishes', () => {
    const jump = warpSecond('depart', 0);
    let last = -Infinity;
    for (let t = 0; t < jump + 0.1; t += 0.05) {
      const now = departShip(0, t).travel;
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
  });

  it('an arriving ship comes out of a flash and settles where it stops', () => {
    const at = warpSecond('arrive', 0);
    expect(arriveShip(0, at - 0.3).visible).toBe(false);
    expect(arriveShip(0, at).flash).toBeGreaterThan(0.9);
    expect(arriveShip(0, at + 0.02).stretch).toBeGreaterThan(3);
    expect(arriveShip(0, at + 1.5).stretch).toBe(1);
    expect(Math.abs(arriveShip(0, at + 3).travel)).toBeLessThan(0.05);
    expect(arriveShip(0, at + 0.1).travel).toBeLessThan(arriveShip(0, at + 1).travel);
  });

  it('the swirl forms before the ship leaves and collapses after it', () => {
    const jump = warpSecond('depart', 0);
    expect(departShip(0, jump - 0.4).ring).toBeGreaterThan(0.5);
    expect(departShip(0, jump - 0.4).ringFrame).toBeLessThan(departShip(0, jump + 0.2).ringFrame);
    expect(departShip(0, jump + 1).ring).toBe(0);
  });

  it('bad clocks draw a ship at rest, never NaN', () => {
    for (const t of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      for (const ship of [departShip(0, t), arriveShip(0, t)]) {
        expect(Object.values(ship).every((v) => typeof v === 'boolean' || Number.isFinite(v))).toBe(true);
        expect(ship.flash).toBe(0);
      }
    }
  });
});
