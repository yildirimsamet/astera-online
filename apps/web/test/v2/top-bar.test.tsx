import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TopBar, type TopBarProps } from '../../src/v2/hud/TopBar.js';

/**
 * THE TOP BAR. Spec B1 (docs/ui-v2/gozlemevi.md).
 *
 * One row: who you are (with your shield, while it holds), which world is active
 * (only once there are two), the three resources of that world, and the bell.
 */

const NOW = Date.parse('2026-09-23T12:00:00Z');

const props = (over: Partial<TopBarProps> = {}): TopBarProps => ({
  commander: 'Samet',
  shield: null,
  now: NOW,
  world: null,
  stock: {
    alloy: { value: 12_400, cap: 20_000 },
    crystal: { value: 3_105, cap: 8_000 },
    deuterium: { value: 860, cap: 4_000 },
  },
  bell: { unseen: 0, urgent: false },
  rewards: 0,
  boosted: false,
  onCommander: vi.fn(),
  onRewards: vi.fn(),
  onWorld: vi.fn(),
  onResource: vi.fn(),
  onBell: vi.fn(),
  ...over,
});

describe('the top bar', () => {
  it('reads three resources against their stores', () => {
    render(<TopBar {...props()} />);
    expect(screen.getByRole('button', { name: 'Alloy: 12,400 of 20,000' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crystal: 3,105 of 8,000' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deuterium: 860 of 4,000' })).toBeInTheDocument();
  });

  it('never paints a full store in the colour of harm', () => {
    const { container } = render(<TopBar {...props({ stock: { ...props().stock, alloy: { value: 20_000, cap: 20_000 } } })} />);
    expect(container.innerHTML).not.toMatch(/hostile|threat/);
  });

  it('opens the economy from a meter, the commander page from the chip, the bell from the bell', async () => {
    const all = props();
    render(<TopBar {...all} />);
    await userEvent.click(screen.getByRole('button', { name: /^Alloy/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Commander Samet/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Signals' }));
    expect(all.onResource).toHaveBeenCalledTimes(1);
    expect(all.onCommander).toHaveBeenCalledTimes(1);
    expect(all.onBell).toHaveBeenCalledTimes(1);
  });

  /** The mock's avatar: two letters in a square, not one in a circle (owner, 2026-09-24). */
  it('wears the commander’s initials', () => {
    render(<TopBar {...props({ commander: 'Kestrel Sable' })} />);
    expect(within(screen.getByRole('button', { name: /^Commander Kestrel Sable/ })).getByText('KS')).toBeInTheDocument();
  });

  it('draws the world mark only once there is a second world', async () => {
    const { rerender } = render(<TopBar {...props()} />);
    expect(screen.queryByRole('button', { name: /CAPITAL|COLONY/ })).toBeNull();
    const onWorld = vi.fn();
    rerender(<TopBar {...props({ world: { capital: false, name: 'Hollow' }, onWorld })} />);
    await userEvent.click(screen.getByRole('button', { name: 'COLONY · Hollow' }));
    expect(onWorld).toHaveBeenCalledTimes(1);
  });

  it('counts unseen news on the bell and pulses only for an urgent one', () => {
    const { rerender } = render(<TopBar {...props({ bell: { unseen: 3, urgent: false } })} />);
    const bell = screen.getByRole('button', { name: 'Signals — 3 unread' });
    expect(within(bell).getByText('3')).toBeInTheDocument();
    expect(bell).not.toHaveAttribute('data-urgent');
    expect(within(bell).getByText('3')).not.toHaveClass('animate-pulse');
    rerender(<TopBar {...props({ bell: { unseen: 12, urgent: true } })} />);
    expect(screen.getByRole('button', { name: 'Signals — 12 unread' })).toHaveAttribute('data-urgent');
    // Owner, 2026-09-24: the red count beats with the bell, not only the bell.
    expect(screen.getByText('9+')).toHaveClass('animate-pulse');
  });

  it('offers a swinging gift that opens rewards directly while claims wait', async () => {
    const { rerender } = render(<TopBar {...props()} />);
    expect(screen.queryByTestId('claimable-rewards')).toBeNull();
    expect(screen.getByRole('button', { name: /^Commander Samet/ })).not.toHaveAttribute('data-attention');
    const onRewards = vi.fn();
    rerender(<TopBar {...props({ rewards: 2, onRewards })} />);
    const chip = screen.getByRole('button', { name: /^Commander Samet/ });
    expect(chip).not.toHaveAttribute('data-attention');
    const gift = screen.getByTestId('claimable-rewards');
    expect(gift).toHaveAccessibleName(/rewards.*2 ready to claim/i);
    expect(gift.querySelector('.claimable-gift-swing')).toBeInTheDocument();
    await userEvent.click(gift);
    expect(onRewards).toHaveBeenCalledTimes(1);
    rerender(<TopBar {...props({ rewards: 0, onRewards })} />);
    expect(screen.queryByTestId('claimable-rewards')).toBeNull();
  });

  it('marks every store while production is boosted', () => {
    const { rerender } = render(<TopBar {...props()} />);
    expect(screen.queryAllByRole('img', { name: 'Output boosted +50%' })).toHaveLength(0);
    rerender(<TopBar {...props({ boosted: true })} />);
    expect(screen.getAllByRole('img', { name: 'Output boosted +50%' })).toHaveLength(3);
  });

  it('wears the shield on the commander chip while it holds, with its time', () => {
    const { rerender } = render(<TopBar {...props({ shield: { until: NOW + 7 * 3_600_000, kind: 'NEWCOMER' } })} />);
    const chip = screen.getByRole('button', { name: /^Commander Samet/ });
    expect(chip).toHaveAttribute('data-shielded');
    // Whole hours on the chip, rounded down so it never promises time it does not have;
    // the exact figure is in its name and, in the last hour, on the Now line.
    expect(within(chip).getByText('7h')).toBeInTheDocument();
    expect(chip).toHaveAccessibleName(/7h 00m/);
    rerender(<TopBar {...props({ shield: { until: NOW + 42 * 60_000, kind: 'NEWCOMER' } })} />);
    expect(within(screen.getByRole('button', { name: /^Commander Samet/ })).getByText('42m')).toBeInTheDocument();
    rerender(<TopBar {...props({ shield: { until: NOW - 1, kind: 'NEWCOMER' } })} />);
    expect(screen.getByRole('button', { name: /^Commander Samet/ })).not.toHaveAttribute('data-shielded');
  });
});
