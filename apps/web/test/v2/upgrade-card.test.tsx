import { render, screen } from '@testing-library/react';
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
    expect(card).toHaveTextContent('L2');
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

  it('says when a card it cannot pay for will be affordable', () => {
    render(<UpgradeRow {...base} held={{ alloy: 25, crystal: 0 }} income={{ alloyPerHour: 60, crystalPerHour: 60 }} onOpen={vi.fn()} />);
    expect(document.querySelector('[data-layout="card"]')).toHaveTextContent(/affordable in/i);
  });

  it('carries its own control where it opens no detail', async () => {
    const onAct = vi.fn();
    render(<UpgradeRow {...base} onAct={onAct} />);
    const act = document.querySelector<HTMLElement>('[data-layout="card"] [data-act] button')!;
    await userEvent.click(act);
    expect(onAct).toHaveBeenCalledTimes(1);
  });
});
