import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { hullBulk } from '@astera/rules';
import { CapacityBar } from '../src/ui/CapacityBar.js';
import i18n from '../src/i18n/index.js';

/**
 * HOW MUCH ROOM IS LEFT, AS A PICTURE. Owner instruction.
 *
 * The build sheet had every one of these numbers and spent them on one line of
 * small grey text: "takes 12 · 40 / 200 used". The owner's report was that they
 * could not tell what their capacity was, what one ship costs, or how many more
 * they could make — which is three questions the sentence technically answers and
 * none it answers at a glance.
 *
 * So the bar IS the answer:
 *
 *   · the FILLED part is what is already in the hangar
 *   · the BRIGHT part is what the order on screen would add, and it grows under the
 *     stepper as the player presses it — cause and effect in the same eyeful
 *   · the DARK part is what would still be free
 *
 * There is ONE bar and nothing under it. A narrower block drawing the width of a
 * single hull was tried and removed on owner instruction: it read as a second bar
 * with no stated job even once it shared an origin with the first, and the count
 * of how many more fit already answers what it was for.
 *
 * The only figure with any size to it is HOW MANY MORE FIT, because that is the
 * number the player came to the sheet holding.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const bar = (over: Partial<Parameters<typeof CapacityBar>[0]> = {}) => render(
  <CapacityBar total={200} used={40} incoming={0} fits={160} {...over} />,
);

const widthOf = (view: ReturnType<typeof render>, part: string): number => {
  const element = view.container.querySelector<HTMLElement>(`[data-part="${part}"]`);
  expect(element, `no ${part} segment`).not.toBeNull();
  return Number.parseFloat(element!.style.width);
};

describe('the capacity bar', () => {
  it('draws the three parts of the answer', () => {
    const view = bar();
    for (const part of ['used', 'incoming', 'free']) {
      expect(view.container.querySelector(`[data-part="${part}"]`), part).toBeInTheDocument();
    }
  });

  it('sizes what is used against the whole', () => {
    expect(widthOf(bar({ total: 200, used: 50, incoming: 0 }), 'used')).toBeCloseTo(25, 1);
  });

  it('grows the order as the count grows', () => {
    const one = widthOf(bar({ incoming: hullBulk('PIKE') }), 'incoming');
    const three = widthOf(bar({ incoming: hullBulk('PIKE') * 3 }), 'incoming');
    expect(three).toBeCloseTo(one * 3, 1);
  });

  it('shrinks what is free by exactly what the order takes', () => {
    const before = widthOf(bar({ used: 40, incoming: 0 }), 'free');
    const after = widthOf(bar({ used: 40, incoming: 20 }), 'free');
    expect(before - after).toBeCloseTo(10, 1);
  });

  /**
   * The one number on the card with any size to it. A player pressing "how many
   * can I make" is holding this question and no other.
   */
  it('leads with how many more fit', () => {
    const view = bar({ fits: 37 });
    expect(view.container.querySelector('[data-fits]')).toHaveTextContent('37');
  });

  it('never draws past the end of the bar', () => {
    const view = bar({ total: 100, used: 90, incoming: 40 });
    expect(widthOf(view, 'used') + widthOf(view, 'incoming')).toBeLessThanOrEqual(100.01);
  });

  /** A full hangar says nothing fits, rather than showing a bar with no room in it. */
  it('reads zero when the hangar is full', () => {
    const view = bar({ total: 200, used: 200, incoming: 0, fits: 0 });
    expect(view.container.querySelector('[data-fits]')).toHaveTextContent('0');
    expect(view.container.querySelector('[data-full]')).toBeInTheDocument();
  });

  it('says nothing about an order nobody has placed', () => {
    expect(bar({ incoming: 0 }).container
      .querySelector<HTMLElement>('[data-part="incoming"]')?.style.width).toBe('0%');
  });

  /** Ground guns share the vocabulary; only the ceiling behind it differs. */
  it('draws a ground battery the same way', () => {
    const view = bar({ total: 30, used: 13, incoming: hullBulk('BASTION'), fits: 1 });
    expect(widthOf(view, 'incoming')).toBeCloseTo(hullBulk('BASTION') / 30 * 100, 0);
  });
});

/**
 * NO SURFACE DRAWS A SECOND BAR. Owner report against the Fleet and Defend tabs —
 * *"alttaki bar ne işe yarıyor ve ortadaki beyaz çizgi gibi gözüken şey ne?"* —
 * answered first by aligning that block to the bar above it, and then by owner
 * instruction removing it. This holds the removal on every card the component
 * draws, so it cannot come back by accident.
 */
describe('the space under the bar', () => {
  it('draws nothing under the bar on a purchase card', () => {
    expect(bar().container.querySelector('[data-part="one"]')).toBeNull();
  });
});

/**
 * TWO CARDS, AND CONFLATING THEM WAS A REAL BUG. Owner report against the Fleet
 * and Defend tabs: *"bu iki bardan alttaki ne işe yarıyor?"*
 *
 * A ROOM — the Hangar band, the ground battery, a transfer's destination — has no
 * hull being chosen, so it has no count of ships to give. Giving one anyway states
 * space as a number of ships, which is exactly how it was reported.
 *
 * A PURCHASE — the craft sheet — adds the one thing only that surface can say.
 */
describe('a room card, where nobody is choosing a hull', () => {
  const room = () => render(<CapacityBar total={200} used={40} incoming={0} label="Hangar" />);

  it('gives no count of ships', () => {
    expect(room().container.querySelector('[data-fits]')).toBeNull();
  });

  /**
   * A DECK IS MEASURED IN SPACE, AND THE FIGURE HAS TO SAY SO. The Hangar band
   * passed `total - used` — space — into `fits`, which renders at readout size
   * under the words "more fit", so 185 units of free deck read as a hundred and
   * eighty-five buildable ships. Space is now stated as space, at both ends.
   */
  it('states what is spoken for and what is free, in space', () => {
    const view = room();
    expect(view.container.textContent).toContain('40');
    expect(view.container.textContent).toContain('160');
    expect(view.container.textContent).toContain('free');
  });

  it('counts a pending order against what is free', () => {
    const view = render(<CapacityBar total={200} used={40} incoming={60} label="Hangar" />);
    expect(view.container.textContent).toContain('100');
  });

  it('is full when the bar is, not when some hull no longer fits', () => {
    expect(render(<CapacityBar total={40} used={40} incoming={1} label="Hangar" />)
      .container.querySelector('[data-full]')).not.toBeNull();
    expect(room().container.querySelector('[data-full]')).toBeNull();
  });
});
