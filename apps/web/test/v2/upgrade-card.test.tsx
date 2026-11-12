import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UpgradeRow } from '../../src/ui/UpgradeRow.js';

/**
 * THE BASE'S CARDS. Spec E5 (docs/ui-v2/gozlemevi.md), the mock's two-column Base:
 * "iki sütun kartlar (render ≥74 px; sahip / alınabilir / yetersiz / kilitli
 * durumları; eksik kaynak sarı ve yetme süresiyle)".
 *
 * The same row, laid out as a card: the render on top, the level on it, the name
 * WHOLE under it — it wraps, it is never cut (the owner's standing rule for this
 * component) — then what it becomes, the price and, when short, when it will be
 * affordable. The whole card opens the detail; a lock's reason is still a door.
 */

const base = {
  art: '/assets/images/general/command_core_1.png',
  name: 'Command Core',
  role: 'Unlocks higher levels',
  level: 2,
  gain: { label: 'Build cap', now: 'L2', next: 'L3' },
  cost: { alloy: 125, crystal: 34 },
  held: { alloy: 1_000, crystal: 1_000 },
  verb: 'raise' as const,
  onAct: vi.fn(),
  layout: 'card' as const,
};

describe('an upgrade as a card', () => {
  it('draws the render, the level, the whole name, the gain and the price', () => {
    render(<UpgradeRow {...base} onOpen={vi.fn()} />);
    const card = document.querySelector<HTMLElement>('[data-layout="card"]')!;
    expect(card.querySelector('[data-art] img')).not.toBeNull();
    // the level is the kit's badge on the render: a number on screen, a word for a screen reader
    expect(within(card).getByRole('img', { name: 'Level 2' })).toHaveTextContent(/^2$/);
    const name = screen.getByRole('heading', { name: 'Command Core' });
    expect(name.className).not.toMatch(/\btruncate\b/);
    expect(card).toHaveTextContent('L3');
    expect(card).toHaveTextContent('125');
  });

  it('opens the detail from anywhere on the card', async () => {
    const onOpen = vi.fn();
    render(<UpgradeRow {...base} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: /command core/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('keeps a lock’s reason a door to what opens it, not the detail', async () => {
    const onOpen = vi.fn();
    const onFix = vi.fn();
    render(<UpgradeRow {...base} unowned blocked={{ reason: 'Needs research', onFix }} onOpen={onOpen} />);
    expect(document.querySelector('[data-layout="card"]')).toHaveAttribute('data-progression-state', 'locked');
    await userEvent.click(screen.getByRole('button', { name: /needs research/i }));
    expect(onFix).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  /** A full queue is not a lock: time lifts it, so the card wears the hourglass (stage 4.1). */
  it('wears the hourglass, not the lock, on a refusal that time lifts', () => {
    const { unmount } = render(<UpgradeRow {...base} blocked={{ reason: 'Queue full', waits: true }} onOpen={vi.fn()} />);
    expect(document.querySelector('[data-blocked-reason]')).toHaveAttribute('data-waits');
    unmount();
    render(<UpgradeRow {...base} blocked={{ reason: 'Needs Core L7' }} onOpen={vi.fn()} />);
    expect(document.querySelector('[data-blocked-reason]')).not.toHaveAttribute('data-waits');
  });

  it('says when a card it cannot pay for will be affordable, in the words its sheet uses', () => {
    render(<UpgradeRow {...base} held={{ alloy: 25, crystal: 0 }} income={{ alloyPerHour: 60, crystalPerHour: 60 }} onOpen={vi.fn()} />);
    // short 100 alloy and 34 crystal at 60 an hour: the alloy is the longer wait, 100 minutes
    expect(document.querySelector('[data-layout="card"] [data-wait]')).toHaveTextContent(/^Enough in ~1h 40m$/);
  });

  it('marks on the price the resource the store cannot pay yet', () => {
    render(<UpgradeRow {...base} held={{ alloy: 1_000, crystal: 10 }} onOpen={vi.fn()} />);
    const short = [...document.querySelectorAll('[data-card-price] [data-short]')].map((part) => part.textContent);
    expect(short).toEqual(['34']);
  });

  it('lights up for a moment when an order for it lands in the queue', () => {
    const { rerender } = render(<UpgradeRow {...base} onOpen={vi.fn()} />);
    expect(document.querySelector('[data-layout="card"]')).not.toHaveAttribute('data-flash');
    rerender(<UpgradeRow {...base} queued="Queued" flash onOpen={vi.fn()} />);
    expect(document.querySelector('[data-layout="card"]')).toHaveAttribute('data-flash');
  });

  it('carries its own control where it opens no detail', async () => {
    const onAct = vi.fn();
    render(<UpgradeRow {...base} onAct={onAct} />);
    const act = document.querySelector<HTMLElement>('[data-layout="card"] [data-act] button')!;
    await userEvent.click(act);
    expect(onAct).toHaveBeenCalledTimes(1);
  });
});
