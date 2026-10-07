import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SpendBar } from '../src/ui/SpendBar.js';
import i18n from '../src/i18n/index.js';

/** The cost stays prominent as a fleet/cargo selection changes; deficits remain separate. */

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
  it('updates the cost upward as the selection increases and back down when cleared', () => {
    const view = bar();
    expect(view.container.querySelector('[data-spend-amount]')).toHaveTextContent(/^0$/);
    for (const spend of [250, 700, 0]) {
      view.rerender(<SpendBar stock={1000} spend={spend} tone="deuterium" label="fuel" />);
      expect(view.container.querySelector('[data-spend-amount]')).toHaveTextContent(String(spend));
      expect(view.container.querySelector('[data-spend-left]')).toBeNull();
    }
  });

  it.each(['alloy', 'crystal', 'deuterium'] as const)('shows the cost for %s in inline and compact layouts', (tone) => {
    for (const layout of [{ inline: true }, { compactSize: true }]) {
      const view = bar({ tone, stock: 250, spend: 250, ...layout });
      expect(view.container.querySelector('[data-spend-amount]')).toHaveTextContent('250');
      expect(view.container.querySelector('[data-spend-short]')).toBeNull();
      expect(view.container.querySelector('[data-spend-bar]')).toHaveAttribute('data-short', 'false');
      view.unmount();
    }
  });

  it.each([
    ['tr', '300 eksik'], ['en', '300 short'], ['de', '300 fehlen'],
    ['fr', 'manque 300'], ['es', 'faltan 300'], ['ja', '300不足'],
  ])('keeps cost and shortfall distinct in %s', async (language, shortage) => {
    await i18n.changeLanguage(language);
    const view = bar({ stock: 100, spend: 400 });
    expect(view.container.querySelector('[data-spend-amount]')).toHaveTextContent('400');
    expect(view.container.querySelector('[data-spend-short]')).toHaveTextContent(shortage);
    expect(view.container.querySelector('[role="img"]')).toHaveAttribute('aria-label', expect.stringContaining(shortage));
  });

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
  it('shows the amount spent instead of the amount left', () => {
    const view = bar({ stock: 1000, spend: 250 });
    expect(view.container.querySelector('[data-spend-amount]')).toHaveTextContent('250');
    expect(view.container.querySelector('[data-spend-left]')).toBeNull();
    expect(view.container.querySelector('[data-spend-short]')).toBeNull();
  });

  it('can make the amount being sent the primary readout', () => {
    const view = bar({ stock: 1000, spend: 250, label: 'Sending' });

    expect(view.container.querySelector('[data-spend-amount]')).toHaveTextContent('250');
    expect(view.container.querySelector('[data-spend-left]')).toBeNull();
    expect(view.container.querySelector('[role="img"]'))
      .toHaveAttribute('aria-label', 'Sending: 250');
  });

  describe('when the price is bigger than the store', () => {
    it('keeps the full cost visible and names the shortage separately', () => {
      const view = bar({ stock: 100, spend: 400 });
      expect(view.container.querySelector('[data-spend-bar]'))
        .toHaveAttribute('data-short', 'true');
      expect(view.container.querySelector('[data-spend-amount]')).toHaveTextContent('400');
      expect(view.container.querySelector('[data-spend-short]')).toHaveTextContent('300 short');
      expect(view.container.querySelector('[data-spend-left]')).toBeNull();
    });

    /**
     * THE REASON THE SCALE IS `max(stock, spend)` AND NOT THE STORE.
     *
     * Against the store alone, a spend of twice the tank and a spend of exactly
     * the tank both draw one full bar. Growing the deficit past the end is what
     * separates "one more Dart" from "not this session".
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
      .toHaveAttribute('aria-label', 'fuel: 250');
    expect(bar({ stock: 100, spend: 400 }).container.querySelector('[role="img"]'))
      .toHaveAttribute('aria-label', 'fuel: 400; 300 short');
  });

  /** An empty store must not divide by zero and must still draw the deficit. */
  it('survives an empty store', () => {
    const view = bar({ stock: 0, spend: 50 });
    expect(widthOf(view, 'spent')).toBe(0);
    expect(widthOf(view, 'short')).toBeCloseTo(100, 1);
  });
});
