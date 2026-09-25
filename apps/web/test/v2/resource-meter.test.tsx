import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { stock } from '../../src/lib/format.js';
import { ResourceMeter } from '../../src/v2/kit/ResourceMeter.js';

/**
 * WHAT YOU HOLD AND HOW MUCH ROOM IS LEFT. Spec B1 · resource meter (docs/ui-v2/gozlemevi.md).
 *
 * Icon, figure, and under it the Base's own store bar, compact (owner, 2026-09-25: the two
 * bars did not match): twelve cells, the Vault's share bracketed. A full store is a gap to
 * close, not a danger: it ends in a warn cap and never wears the hostile red (H2). A tap
 * opens the economy detail.
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

  const lit = (root: HTMLElement) => root.querySelectorAll('[data-cell][data-lit]').length;

  it('lights the store’s share of twelve cells, in the resource’s hue', () => {
    const { container } = render(<ResourceMeter resource="crystal" value={6_200} cap={10_000} />);
    expect(container.querySelectorAll('[data-cell]')).toHaveLength(12);
    expect(lit(container)).toBe(7);
    expect(container.querySelector('[data-cell]')).toHaveClass('bg-v2-crystal');
    expect(container.querySelector('[data-full-cap]')).toBeNull();
  });

  it('brackets the part of the store the Vault keeps from a raid, as the Base does', () => {
    const { container } = render(<ResourceMeter resource="alloy" value={620} cap={1_000} safe={350} />);
    expect(container.querySelector('[data-safe]')).toHaveAttribute('data-safe-cells', '4');
  });

  it('closes a full store with a warn cap and no hostile colour', () => {
    const { container } = render(<ResourceMeter resource="alloy" value={20_000} cap={20_000} />);
    expect(container.querySelector('[data-full-cap]')).toHaveClass('bg-v2-warn');
    expect(container.innerHTML).not.toMatch(/hostile|threat/);
    expect(screen.getByRole('img', { name: 'Alloy: 20,000 of 20,000, store full' })).toBeInTheDocument();
  });

  it('holds the cells at full when the stock overflows the store', () => {
    const { container } = render(<ResourceMeter resource="deuterium" value={9_000} cap={6_000} />);
    expect(lit(container)).toBe(12);
    expect(container.querySelector('[data-full-cap]')).not.toBeNull();
  });

  it('draws empty cells when the world has no store for it', () => {
    const { container } = render(<ResourceMeter resource="deuterium" value={0} cap={0} />);
    expect(lit(container)).toBe(0);
    expect(container.querySelector('[data-full-cap]')).toBeNull();
  });

  it('opens the economy detail on a tap', async () => {
    const onOpen = vi.fn();
    render(<ResourceMeter resource="alloy" value={100} cap={1_000} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Alloy: 100 of 1,000' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
