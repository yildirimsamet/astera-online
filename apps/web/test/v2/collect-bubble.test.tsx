import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CollectState } from '../../src/lib/collect.js';
import { CollectBubble } from '../../src/v2/hud/CollectBubble.js';

/**
 * THE COLLECT BUBBLE OVER YOUR WORLD. Spec B13 (docs/ui-v2/gozlemevi.md).
 *
 * "+3.2k" in your colour once the works hold a tenth of what they can; pulsing
 * when a vessel is full; one tap, one request. When the store has no room for any
 * of it the bubble says so and opens the base instead of collecting nothing.
 */

const state = (over: Partial<CollectState> = {}): CollectState => ({
  waiting: 3_200,
  ripe: true,
  full: false,
  movable: 3_200,
  blocked: false,
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
    const bubble = screen.getByRole('button', { name: 'Collect 3,200' });
    expect(bubble).toHaveTextContent('+3.2k');
    await userEvent.click(bubble);
    rerender(<CollectBubble state={state()} pending onCollect={onCollect} onOpenBase={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Collect 3,200' }));
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
