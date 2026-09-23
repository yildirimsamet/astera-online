import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { stock } from '../../src/lib/format.js';
import { ResourceMeter } from '../../src/v2/kit/ResourceMeter.js';

/**
 * WHAT YOU HOLD AND HOW MUCH ROOM IS LEFT. Spec B1 · resource meter (docs/ui-v2/gozlemevi.md).
 *
 * Icon, figure, and a two-pixel line of value over capacity under it. A full
 * store is a gap to close, not a danger: it ends in a warn notch and never wears
 * the hostile red (H2). A tap opens the economy detail.
 */

describe('the figure a meter prints', () => {
  it.each([
    [0, '0'],
    [12_400, '12,400'],
    [99_999, '99,999'],
    [100_000, '100k'],
    [1_234_567, '1.2M'],
  ])('prints %i as %s', (value, text) => {
    expect(stock(value)).toBe(text);
  });
});

describe('the resource meter', () => {
  it('reads the stock against the store', () => {
    render(<ResourceMeter resource="alloy" value={12_400} cap={20_000} />);
    expect(screen.getByText('12,400')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Alloy: 12,400 of 20,000' })).toBeInTheDocument();
  });

  it('fills the line by value over capacity', () => {
    const { container } = render(<ResourceMeter resource="crystal" value={6_200} cap={10_000} />);
    expect(container.querySelector('[data-fill]')).toHaveStyle({ width: '62%' });
    expect(container.querySelector('[data-full]')).toBeNull();
  });

  it('closes a full store with a warn notch and no hostile colour', () => {
    const { container } = render(<ResourceMeter resource="alloy" value={20_000} cap={20_000} />);
    expect(container.querySelector('[data-full]')).toHaveClass('bg-v2-warn');
    expect(container.innerHTML).not.toMatch(/hostile|threat/);
    expect(screen.getByRole('img', { name: 'Alloy: 20,000 of 20,000, store full' })).toBeInTheDocument();
  });

  it('holds the line at full when the stock overflows the store', () => {
    const { container } = render(<ResourceMeter resource="deuterium" value={9_000} cap={6_000} />);
    expect(container.querySelector('[data-fill]')).toHaveStyle({ width: '100%' });
    expect(container.querySelector('[data-full]')).not.toBeNull();
  });

  it('draws an empty line when the world has no store for it', () => {
    const { container } = render(<ResourceMeter resource="deuterium" value={0} cap={0} />);
    expect(container.querySelector('[data-fill]')).toHaveStyle({ width: '0%' });
    expect(container.querySelector('[data-full]')).toBeNull();
  });

  it('opens the economy detail on a tap', async () => {
    const onOpen = vi.fn();
    render(<ResourceMeter resource="alloy" value={100} cap={1_000} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Alloy: 100 of 1,000' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
