import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILD } from '@astera/rules';
import { QueueStrip } from '../src/ui/QueueStrip.js';
import i18n from '../src/i18n/index.js';
import type { BuildOrderView } from '../src/api/schemas.js';

/**
 * WHAT IS BEING BUILT AND WHEN IT IS ALL DONE, AS ONE SHAPE. Owner instruction.
 *
 * The queue was three stacked rows — a number, a name, a clock and the word
 * "Cancel" — and only the first row had any indication of time at all. Two things
 * a player wants were nowhere on it: how the orders compare in LENGTH (a Bulwark
 * is not a Wasp, and nothing said so), and when the whole lane finishes, which is
 * the one figure that decides whether to queue a fourth thing.
 *
 * The strip is a timeline. Each order is a segment as wide as it is long, the head
 * one fills as it runs, and the end of the strip is the end of the work.
 */

const at = (minutes: number) => new Date(Date.parse('2026-08-28T09:00:00.000Z') + minutes * 60_000);
const NOW = at(0).getTime();

const order = (over: Partial<BuildOrderView> = {}): BuildOrderView => ({
  id: `order-${String(Math.random())}`,
  queue: 'CONSTRUCTION',
  slot: 0,
  kind: 'BUILDING',
  subject: 'REFINERY',
  count: 1,
  startedAt: at(0),
  finishesAt: at(10),
  cost: { alloy: 100, crystal: 100, deuterium: 0 },
  ...over,
} as BuildOrderView);

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const strip = (orders: BuildOrderView[], over: Record<string, unknown> = {}) => render(
  <QueueStrip
    label="Construction"
    orders={orders}
    now={NOW}
    onCancel={vi.fn()}
    {...over}
  />,
);

const widthOf = (view: ReturnType<typeof render>, index: number): number => {
  const segments = view.container.querySelectorAll<HTMLElement>('[data-segment]');
  return Number.parseFloat(segments[index]!.style.width);
};

describe('the queue strip', () => {
  it('draws one segment per order', () => {
    const view = strip([order(), order({ startedAt: at(10), finishesAt: at(30) })]);
    expect(view.container.querySelectorAll('[data-segment]')).toHaveLength(2);
  });

  /**
   * THE COMPARISON THE OLD LIST COULD NOT MAKE. A twenty-minute order is twice a
   * ten-minute one and is drawn twice as wide, so "the Bulwark is the long one" is
   * seen rather than worked out from two clocks.
   */
  it('sizes each order by how long it takes', () => {
    const view = strip([
      order({ startedAt: at(0), finishesAt: at(10) }),
      order({ startedAt: at(10), finishesAt: at(30) }),
    ]);
    expect(widthOf(view, 1) / widthOf(view, 0)).toBeCloseTo(2, 1);
  });

  it('keeps a very short order visible beside a very long one', () => {
    const view = strip([
      order({ startedAt: at(0), finishesAt: at(1) }),
      order({ startedAt: at(1), finishesAt: at(600) }),
    ]);
    expect(widthOf(view, 0)).toBeGreaterThan(1);
  });

  /** The head is the only one running, so it is the only one that fills. */
  it('fills the running order as it runs', () => {
    const view = strip([order({ startedAt: at(-5), finishesAt: at(5) })]);
    const fill = view.container.querySelector<HTMLElement>('[data-segment] [data-fill]');
    expect(fill).toBeInTheDocument();
    expect(Number.parseFloat(fill!.style.width)).toBeCloseTo(50, 0);
  });

  it('leaves the ones behind it unfilled', () => {
    const view = strip([
      order({ startedAt: at(-5), finishesAt: at(5) }),
      order({ startedAt: at(5), finishesAt: at(20) }),
    ]);
    const segments = view.container.querySelectorAll('[data-segment]');
    expect(segments[1]!.querySelector('[data-fill]')).toBeNull();
  });

  /**
   * THE FIGURE THAT DECIDES WHETHER TO QUEUE A FOURTH THING, and the old list had
   * it nowhere: when does all of this end.
   */
  it('says when the whole lane is done', () => {
    const view = strip([
      order({ startedAt: at(0), finishesAt: at(10) }),
      order({ startedAt: at(10), finishesAt: at(30) }),
    ]);
    expect(view.container.querySelector('[data-lane-ends]')?.textContent ?? '').toMatch(/\d/);
  });

  it('says nothing about an ending that does not exist', () => {
    expect(strip([]).container.querySelector('[data-lane-ends]')).toBeNull();
  });

  /** I6b: a rack shows its empty slots, so the room left is a thing you can see. */
  it('draws the free slots as empty cells', () => {
    const view = strip([order()]);
    expect(view.container.querySelectorAll('[data-free-slot]'))
      .toHaveLength(BUILD.queueDepth - 1);
  });

  it('draws no empty cells when the lane is full', () => {
    const view = strip([order(), order(), order()]);
    expect(view.container.querySelectorAll('[data-free-slot]')).toHaveLength(0);
  });

  /**
   * CANCELLING IS A MARK ON THE SEGMENT, not a word in every row. The word cost
   * three columns of a phone screen on every order, forever, to offer something a
   * player does once in a session.
   */
  it('cancels from the segment itself', async () => {
    const onCancel = vi.fn();
    const one = order();
    const view = strip([one], { onCancel });
    await userEvent.click(view.container.querySelector<HTMLElement>('[data-cancel]')!);
    expect(onCancel).toHaveBeenCalledWith(one);
  });

  it('offers no cancel on an order the server has not acknowledged', () => {
    const view = strip([order({ startedAt: undefined, finishesAt: undefined })]);
    expect(view.container.querySelector('[data-cancel]')).toBeNull();
  });

  it('names each order for a screen reader', () => {
    const view = strip([order()]);
    expect(view.container.querySelector('[data-segment]')?.getAttribute('aria-label') ?? '')
      .toMatch(/refinery/i);
  });
});
