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
  tag: 'Raises the level cap',
  role: 'Sets how high every other building can go',
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
    // short 100 alloy and 34 crystal at 60 an hour: the alloy is the longer wait, 100 minutes,
    // rounded up to the hour on the card. No "~": in the card's face a tilde reads as a minus
    // ("-1h 40m", the owner's report).
    expect(document.querySelector('[data-layout="card"] [data-wait]')).toHaveTextContent(/^Enough in 2h$/);
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

  /**
   * A FIXED SKELETON (owner note 4, G2-b, 2026-11-14): the picture, the name, one line of what
   * it is for, one line of what the next level does, and the foot — the price, and under it one
   * line of time or state. A lock stands where the price would. Two cards side by side are the
   * same height whatever they say.
   */
  describe('the skeleton', () => {
    const slots = () => {
      const card = document.querySelector<HTMLElement>('[data-layout="card"]')!;
      return {
        purpose: card.querySelector<HTMLElement>('[data-card-purpose]'),
        effect: card.querySelector<HTMLElement>('[data-card-effect]'),
        foot: card.querySelector<HTMLElement>('[data-card-foot]'),
        price: card.querySelector<HTMLElement>('[data-card-foot] [data-card-price]'),
        status: card.querySelector<HTMLElement>('[data-card-foot] [data-card-status]'),
      };
    };

    it('says what it is for in one line, and what the next level does in another', () => {
      render(<UpgradeRow {...base} onOpen={vi.fn()} />);
      const { purpose, effect } = slots();
      expect(purpose).toHaveTextContent('Raises the level cap');
      // the figures are the line; the label is the purpose line's to say, and a reader still hears it
      expect(effect).toHaveTextContent('L2→L3');
      expect(within(effect!).getByText('Build cap', { exact: false })).toHaveClass('sr-only');
    });

    it('says the card’s short form of a long effect, never the sheet’s whole sentence', () => {
      render(<UpgradeRow {...base} gain={{ label: 'Store depth', now: '39h store · 4h protected', next: '46h store · 5h protected', brief: { now: '39h', next: '46h' } }} onOpen={vi.fn()} />);
      expect(slots().effect).toHaveTextContent('39h→46h');
      expect(slots().effect).not.toHaveTextContent('protected');
    });

    it('keeps the effect line when nothing follows, so the foot stays where its neighbour’s is', () => {
      render(<UpgradeRow {...base} gain={undefined} onOpen={vi.fn()} />);
      expect(slots().effect).not.toBeNull();
    });

    it('shows the price, and how long the work takes under it', () => {
      render(<UpgradeRow {...base} takes={18} onOpen={vi.fn()} />);
      const { price, status } = slots();
      expect(price).toHaveTextContent('125');
      expect(price!.querySelector('[data-testid="order-time"]')).toBeNull();
      expect(status!.querySelector('[data-testid="order-time"]')).not.toBeNull();
    });

    it('when short, says when it will be enough where the time would be', () => {
      render(<UpgradeRow {...base} takes={18} held={{ alloy: 25, crystal: 0 }} income={{ alloyPerHour: 60, crystalPerHour: 60 }} onOpen={vi.fn()} />);
      const { status } = slots();
      expect(status).toHaveTextContent('Enough in 2h');
      expect(status!.querySelector('[data-testid="order-time"]')).toBeNull();
    });

    it('stands a lock where the price would be, in the card’s short words, the whole reason for a reader', async () => {
      const onFix = vi.fn();
      render(<UpgradeRow {...base} unowned blocked={{ reason: 'Requires: Deuterium Synthesis L2', short: 'Deuterium Synthesis L2', onFix }} onOpen={vi.fn()} />);
      const { foot, price } = slots();
      expect(price).toBeNull();
      const door = within(foot!).getByRole('button', { name: 'Requires: Deuterium Synthesis L2' });
      expect(door).toHaveTextContent('Deuterium Synthesis L2');
      expect(door).not.toHaveTextContent('Requires');
      await userEvent.click(door);
      expect(onFix).toHaveBeenCalledOnce();
    });

    it('keeps the price on a refusal time lifts, the wait under it', () => {
      render(<UpgradeRow {...base} blocked={{ reason: 'The queue already holds 3 orders.', short: 'Queue full', waits: true }} onOpen={vi.fn()} />);
      const { price, status } = slots();
      expect(price).toHaveTextContent('125');
      expect(status).toHaveTextContent('Queue full');
      expect(status!.querySelector('[data-blocked-reason]')).toHaveAttribute('data-waits');
    });

    it('says an order in the queue at the foot, without a price to pay twice', () => {
      render(<UpgradeRow {...base} queued="Queued for L3" onOpen={vi.fn()} />);
      const { price, status } = slots();
      expect(price).toBeNull();
      expect(status).toHaveTextContent('Queued for L3');
    });

    it('wears an order already queued on its picture when it takes another, the next order’s time under the price', () => {
      render(<UpgradeRow {...base} takes={18} queued="1 order queued" queuedActionable onOpen={vi.fn()} />);
      const card = document.querySelector<HTMLElement>('[data-layout="card"]')!;
      expect(card.querySelector('[data-art] [data-card-queued]')).toHaveTextContent('1 order queued');
      const { price, status } = slots();
      expect(price).toHaveTextContent('125');
      expect(status!.querySelector('[data-testid="order-time"]')).not.toBeNull();
      expect(status).not.toHaveTextContent('1 order queued');
    });

    it('says a finished ladder at the foot', () => {
      render(<UpgradeRow {...base} completed="At the top level" onOpen={vi.fn()} />);
      const { price, status } = slots();
      expect(price).toBeNull();
      expect(status).toHaveTextContent('At the top level');
    });
  });
});
