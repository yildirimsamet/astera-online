import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { RangeBand } from '../src/ui/RangeBand.js';
import i18n from '../src/i18n/index.js';

/**
 * A THING YOU KNOW ROUGHLY, DRAWN ROUGHLY. Owner instruction.
 *
 * A probe report is the one number in the game that is deliberately NOT a number
 * — D127 makes it a silhouette, fuzzed at the look — and the intel screen printed
 * it as `1.2k–3.4k` under a grey label. That is two figures the reader has to
 * pair, subtract and then weigh, for the fact the whole information layer is sold
 * on.
 *
 * So the DOUBT is the shape: the band's width is what the reading is worth. A
 * clean probe is a narrow block; a poor one smears across the card. Those two are
 * distinguishable with no digits read at all, which is the product of raising a
 * Telescope or catching a target with its fleet at home.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const band = (over: Partial<Parameters<typeof RangeBand>[0]> = {}) => render(
  <RangeBand label="Stock" low={0} high={100} {...over} />,
);

const widthOf = (view: ReturnType<typeof render>): number => {
  const element = view.container.querySelector<HTMLElement>('[data-part="band"]');
  expect(element, 'no band').not.toBeNull();
  return Number.parseFloat(element!.style.width);
};

describe('the range band', () => {
  it('draws a wide reading wider than a tight one', () => {
    const vague = widthOf(band({ low: 200, high: 2000 }));
    const sharp = widthOf(band({ low: 1800, high: 2000 }));
    expect(vague).toBeGreaterThan(sharp);
  });

  /**
   * A PERFECT READ IS ZERO WIDTH, AND ZERO WIDTH IS NOT A MORE PRECISE PICTURE —
   * it is no picture. The floor keeps a certain reading legible beside a fuzzy
   * neighbour without pretending to any doubt it does not have.
   */
  it('keeps a certain reading visible', () => {
    expect(widthOf(band({ low: 500, high: 500 }))).toBeGreaterThan(0);
  });

  /** The midpoint is the guess, and it is drawn as thinly as a guess deserves. */
  it('marks the middle of what it knows', () => {
    const view = band({ low: 0, high: 100 });
    const mid = view.container.querySelector<HTMLElement>('[data-part="mid"]');
    expect(mid).not.toBeNull();
    expect(Number.parseFloat(mid!.style.left)).toBeCloseTo(50, 1);
  });

  /** The figures stay, small and under the shape, to be checked rather than parsed. */
  it('still carries both ends as digits', () => {
    const view = band({ low: 1200, high: 3400 });
    expect(view.container.textContent).toContain('1.2k');
    expect(view.container.textContent).toContain('3.4k');
  });

  it('says the whole reading out loud for a screen reader', () => {
    const view = band({ label: 'Stock', low: 1200, high: 3400 });
    expect(view.container.querySelector('[role="img"]'))
      .toHaveAttribute('aria-label', expect.stringContaining('between 1.2k and 3.4k'));
  });

  /** A probe that read nothing must not divide by zero. */
  it('survives a reading of nothing at all', () => {
    expect(() => band({ low: 0, high: 0 })).not.toThrow();
  });
});
