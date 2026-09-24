import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CollectState } from '../../src/lib/collect.js';
import { CollectBubble } from '../../src/v2/hud/CollectBubble.js';

/**
 * THE COLLECT BUBBLE OVER YOUR WORLD. Spec B13 (docs/ui-v2/gozlemevi.md).
 *
 * What is waiting, resource by resource, in your colour once the works hold a tenth of
 * what they can; pulsing
 * when a vessel is full; one tap, one request. When the store has no room for any
 * of it the bubble says so and opens the base instead of collecting nothing.
 */

const state = (over: Partial<CollectState> = {}): CollectState => ({
  waiting: 3_200,
  ripe: true,
  full: false,
  movable: 3_200,
  blocked: false,
  each: { alloy: 2_000, crystal: 1_200, deuterium: 0 },
  noRoom: [],
  ...over,
});

describe('the collect bubble', () => {
  it('stays down below the threshold', () => {
    const { container } = render(<CollectBubble state={state({ ripe: false })} pending={false} onCollect={vi.fn()} onOpenBase={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('offers what is waiting and collects it in one request', async () => {
    const onCollect = vi.fn();
    const { rerender } = render(<CollectBubble state={state()} pending={false} onCollect={onCollect} onOpenBase={vi.fn()} />);
    const bubble = screen.getByRole('button', { name: 'Collect 2,000 alloy, 1,200 crystal' });
    expect(bubble).toHaveTextContent('2.0k1.2k');
    await userEvent.click(bubble);
    rerender(<CollectBubble state={state()} pending onCollect={onCollect} onOpenBase={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Collect 2,000 alloy, 1,200 crystal' }));
    expect(onCollect).toHaveBeenCalledTimes(1);
  });

  it('pulses when a vessel is full', () => {
    render(<CollectBubble state={state({ full: true })} pending={false} onCollect={vi.fn()} onOpenBase={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Works are full — collect now' })).toHaveAttribute('data-full');
  });

  it('opens the base instead when the store can take none of it', async () => {
    const onCollect = vi.fn();
    const onOpenBase = vi.fn();
    render(<CollectBubble state={state({ blocked: true, movable: 0 })} pending={false} onCollect={onCollect} onOpenBase={onOpenBase} />);
    await userEvent.click(screen.getByRole('button', { name: 'Store full' }));
    expect(onOpenBase).toHaveBeenCalledTimes(1);
    expect(onCollect).not.toHaveBeenCalled();
  });
});

/**
 * THE SAME BUBBLE ON THE BASE (owner, 2026-09-24: "Havuz nerede, biriken maddeleri
 * nasıl toplayacağım?"). The world only raises it at a tenth, so below that the
 * works had no door at all — the base said "1.2k in the works" and offered nothing.
 * On the base it is there from the first unit, and it names the works.
 */
describe('the collect bubble on the base', () => {
  it('offers the works below the threshold, named as the works', async () => {
    const onCollect = vi.fn();
    const { container } = render(<CollectBubble place="base" state={state({ ripe: false, waiting: 1_200, movable: 1_200, each: { alloy: 1_200, crystal: 0, deuterium: 0 } })} pending={false} onCollect={onCollect} onOpenBase={vi.fn()} />);
    const bubble = screen.getByRole('button', { name: 'Collect 1,200 alloy' });
    expect(bubble).toHaveTextContent('1.2k');
    expect(container).toHaveTextContent(/^Works1\.2k$/);
    await userEvent.click(bubble);
    expect(onCollect).toHaveBeenCalledTimes(1);
  });

  /** "Works full" is the reason to collect now: production has stopped. */
  it('says the works are full, not only pulses', () => {
    const { container } = render(<CollectBubble place="base" state={state({ full: true })} pending={false} onCollect={vi.fn()} onOpenBase={vi.fn()} />);
    expect(container).toHaveTextContent(/^Works full2\.0k1\.2k$/);
  });

  it('stays down while the works are empty', () => {
    const { container } = render(<CollectBubble place="base" state={state({ ripe: false, waiting: 0.4, movable: 0.4 })} pending={false} onCollect={vi.fn()} onOpenBase={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('still says a full store before the tap', async () => {
    const onOpenBase = vi.fn();
    render(<CollectBubble place="base" state={state({ ripe: false, waiting: 900, blocked: true, movable: 0 })} pending={false} onCollect={vi.fn()} onOpenBase={onOpenBase} />);
    await userEvent.click(screen.getByRole('button', { name: 'Store full' }));
    expect(onOpenBase).toHaveBeenCalledTimes(1);
  });
});

/**
 * RESOURCE BY RESOURCE (owner, 2026-09-24): a bare "+1.5k" hid which resource was waiting —
 * a faulty refinery stops one, a nearly full store leaves one behind after a collect. The
 * bubble names each with its icon, and the one the store has no room for is a gap to
 * close, in yellow.
 */
describe('the works, resource by resource', () => {
  it('draws each waiting resource with its icon, and leaves out the empty ones', () => {
    const { container } = render(<CollectBubble state={state()} pending={false} onCollect={vi.fn()} onOpenBase={vi.fn()} />);
    const parts = [...container.querySelectorAll('[data-works-resource]')];
    expect(parts.map((part) => part.getAttribute('data-works-resource'))).toEqual(['alloy', 'crystal']);
    expect(parts[0]?.querySelector('img')).not.toBeNull();
    expect(parts[0]).toHaveTextContent('2.0k');
  });

  it('marks in yellow a resource the store has no room left for', () => {
    const { container } = render(<CollectBubble state={state({ noRoom: ['alloy'] })} pending={false} onCollect={vi.fn()} onOpenBase={vi.fn()} />);
    expect(container.querySelector('[data-works-resource="alloy"]')).toHaveAttribute('data-no-room');
    expect(container.querySelector('[data-works-resource="alloy"]')).toHaveClass('text-v2-warn');
    expect(container.querySelector('[data-works-resource="crystal"]')).not.toHaveAttribute('data-no-room');
  });

  it('still says what is waiting when the store can take none of it', () => {
    const { container } = render(
      <CollectBubble state={state({ blocked: true, movable: 0, noRoom: ['alloy', 'crystal'] })} pending={false} onCollect={vi.fn()} onOpenBase={vi.fn()} />,
    );
    expect(container.querySelectorAll('[data-works-resource]')).toHaveLength(2);
  });
});
