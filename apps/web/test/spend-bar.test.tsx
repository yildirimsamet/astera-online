import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SpendBar } from '../src/ui/SpendBar.js';
import i18n from '../src/i18n/index.js';

/**
 * WHAT A PRICE TAKES OUT OF WHAT YOU HOLD. Owner instruction, D142's vocabulary.
 *
 * `CapacityBar` answers "does it fit" and `Meter` answers "how full is it".
 * Neither answers the question a commander holds while looking at a fuel figure
 * or a cargo hold: what will be left of my tank after I press this. That was
 * being answered everywhere by two numbers on one grey line and a subtraction the
 * player had to do in their head.
 *
 * The whole bar is the store, the bright part taken off the left is the burn, and
 * the dim tail is what survives. When the price is bigger than the store the
 * deficit continues PAST the end in red behind a hard stop line — because
 * clamping it at 100% would draw "exactly enough" for a shortfall of one unit and
 * for a shortfall of ten thousand alike, which are the two states a player most
 * needs to tell apart.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const bar = (over: Partial<Parameters<typeof SpendBar>[0]> = {}) => render(
  <SpendBar stock={1000} spend={0} tone="deuterium" label="fuel" {...over} />,
);

const widthOf = (view: ReturnType<typeof render>, part: string): number => {
  const element = view.container.querySelector<HTMLElement>(`[data-part="${part}"]`);
  expect(element, `no ${part} segment`).not.toBeNull();
  return Number.parseFloat(element!.style.width);
};

describe('the spend bar', () => {
  it('draws the whole store as what survives when nothing is being spent', () => {
    const view = bar({ spend: 0 });
    expect(widthOf(view, 'left')).toBeCloseTo(100, 1);
    expect(widthOf(view, 'spent')).toBeCloseTo(0, 1);
  });

  it('carves the spend off the store and leaves the rest', () => {
    const view = bar({ stock: 1000, spend: 250 });
    expect(widthOf(view, 'spent')).toBeCloseTo(25, 1);
    expect(widthOf(view, 'left')).toBeCloseTo(75, 1);
  });

  /** The one figure with any size to it, and it is the one being decided on. */
  it('names what is left, not what it costs', () => {
    const view = bar({ stock: 1000, spend: 250 });
    expect(view.container.querySelector('[data-spend-left]')).toHaveTextContent('750');
    expect(view.container.querySelector('[data-spend-short]')).toBeNull();
  });

  describe('when the price is bigger than the store', () => {
    it('marks itself short and names the gap instead of the remainder', () => {
      const view = bar({ stock: 100, spend: 400 });
      expect(view.container.querySelector('[data-spend-bar]'))
        .toHaveAttribute('data-short', 'true');
      expect(view.container.querySelector('[data-spend-short]')).toHaveTextContent('300');
      expect(view.container.querySelector('[data-spend-left]')).toBeNull();
    });

    /**
     * THE REASON THE SCALE IS `max(stock, spend)` AND NOT THE STORE.
     *
     * Against the store alone, a spend of twice the tank and a spend of exactly
     * the tank both draw one full bar. Growing the deficit past the end is what
     * separates "one more Wasp" from "not this session".
     */
    it('grows the deficit as the shortfall grows', () => {
      const near = widthOf(bar({ stock: 100, spend: 200 }), 'short');
      const far = widthOf(bar({ stock: 100, spend: 900 }), 'short');
      expect(far).toBeGreaterThan(near);
    });

    it('never draws the covered part past the store it came out of', () => {
      expect(widthOf(bar({ stock: 100, spend: 900 }), 'spent')).toBeLessThanOrEqual(100);
    });
  });

  /** The bar is a picture, and a picture needs a sentence for a screen reader. */
  it('reads out the two states in full', () => {
    expect(bar({ stock: 1000, spend: 250 }).container.querySelector('[role="img"]'))
      .toHaveAttribute('aria-label', expect.stringContaining('750 left'));
    expect(bar({ stock: 100, spend: 400 }).container.querySelector('[role="img"]'))
      .toHaveAttribute('aria-label', expect.stringContaining('300 short'));
  });

  /** An empty store must not divide by zero and must still draw the deficit. */
  it('survives an empty store', () => {
    const view = bar({ stock: 0, spend: 50 });
    expect(widthOf(view, 'spent')).toBe(0);
    expect(widthOf(view, 'short')).toBeCloseTo(100, 1);
  });
});
