import { describe, expect, it } from 'vitest';
import {
  cargoFit,
  formatMultiplier,
  nearestDetent,
  rangeGeometry,
  repeatInterval,
  repeatStep,
  ringFraction,
  sliderValue,
  REPEAT_MIN_MS,
} from '../../src/game-ui/logic.js';

/**
 * THE GAME KIT'S ARITHMETIC. Every bar, lever and hold in the kit draws from these,
 * so a player reads the same geometry on every surface.
 */

describe('the power ranges on one axis', () => {
  it('puts both sides on a shared scale with headroom, and hatches an unscouted side to the end', () => {
    const g = rangeGeometry({ low: 24, high: 28 }, { low: 21, high: null });
    expect(g.mine).toEqual({ solid: 78.9, reach: 92 });
    expect(g.theirs).toEqual({ solid: 69, reach: 100, unknown: true });
  });

  it('draws a fully scouted side as a range, not an unknown', () => {
    const g = rangeGeometry({ low: 10, high: 12 }, { low: 20, high: 23 });
    expect(g.theirs).toEqual({ solid: 80, reach: 92, unknown: false });
    expect(g.mine.reach).toBe(48);
  });

  it('keeps an empty wing at zero instead of dividing by nothing', () => {
    expect(rangeGeometry({ low: 0, high: 0 }, { low: 0, high: 0 })).toEqual({
      mine: { solid: 0, reach: 0 },
      theirs: { solid: 0, reach: 0, unknown: false },
    });
  });
});

describe('whether the hold carries the loot', () => {
  it('covers when the hold is at least the top of the band', () => {
    expect(cargoFit(18, { low: 13, high: 17 })).toEqual({ fit: 'covers', capacity: 90, low: 65, high: 85 });
  });

  it('is partial inside the band and short below it', () => {
    expect(cargoFit(15, { low: 13, high: 17 }).fit).toBe('partial');
    expect(cargoFit(10, { low: 13, high: 17 }).fit).toBe('short');
  });

  it('reads an empty hold with no loot as covering nothing to carry', () => {
    expect(cargoFit(0, { low: 0, high: 0 })).toEqual({ fit: 'covers', capacity: 0, low: 0, high: 0 });
  });
});

describe('holding a + to add many ships', () => {
  it('speeds up but never below the floor', () => {
    expect(repeatInterval(0)).toBeGreaterThan(repeatInterval(4));
    expect(repeatInterval(4)).toBeGreaterThan(repeatInterval(8));
    expect(repeatInterval(200)).toBe(REPEAT_MIN_MS);
  });

  it('adds one at a time first, then bigger steps scaled to the stock', () => {
    expect(repeatStep(0, 400)).toBe(1);
    expect(repeatStep(9, 400)).toBe(1);
    expect(repeatStep(10, 400)).toBe(10);
    expect(repeatStep(25, 400)).toBe(27);
    expect(repeatStep(30, 12)).toBe(1);
  });
});

describe('levers and sliders', () => {
  it('snaps a lever to the nearest of its positions', () => {
    expect(nearestDetent(0, 3)).toBe(0);
    expect(nearestDetent(0.3, 3)).toBe(1);
    expect(nearestDetent(0.8, 3)).toBe(2);
    expect(nearestDetent(1.4, 3)).toBe(2);
    expect(nearestDetent(-1, 3)).toBe(0);
  });

  it('maps a slider position to a whole count inside the stock', () => {
    expect(sliderValue(0.5, 40)).toBe(20);
    expect(sliderValue(0.61, 40)).toBe(24);
    expect(sliderValue(1.2, 40)).toBe(40);
    expect(sliderValue(-0.2, 40)).toBe(0);
  });
});

describe('the small formats', () => {
  it('writes a counter multiplier the way the locale writes decimals', () => {
    expect(formatMultiplier(1.6, 'tr')).toBe('×1,6');
    expect(formatMultiplier(0.625, 'tr')).toBe('×0,6');
    expect(formatMultiplier(1, 'en')).toBe('×1');
  });

  it('turns time left into the fraction a ring has left to draw', () => {
    expect(ringFraction(30_000, 60_000)).toBe(0.5);
    expect(ringFraction(-5, 60_000)).toBe(0);
    expect(ringFraction(90_000, 60_000)).toBe(1);
    expect(ringFraction(10, 0)).toBe(0);
  });
});
