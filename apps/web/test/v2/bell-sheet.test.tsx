import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BellSheet, type BellSheetProps } from '../../src/v2/hud/BellSheet.js';

/**
 * THE BELL SHEET. Decision K1 (docs/ui-v2/gozlemevi.md), revised by the owner on
 * 2026-09-24: the bell holds what happened — Signals and the Chronicle. Chat left
 * it for a button of its own on the galaxy, where a thumb reaches it.
 */

const props = (over: Partial<BellSheetProps> = {}): BellSheetProps => ({
  tab: 'signals',
  onTab: vi.fn(),
  onClose: vi.fn(),
  unseen: 0,
  signals: <p>signal rows</p>,
  chronicle: <p>chronicle rows</p>,
  ...over,
});

describe('the bell sheet', () => {
  it('opens on the tab it is given and shows only that tab', () => {
    render(<BellSheet {...props({ tab: 'chronicle' })} />);
    // Named for all three tabs, not for the first: a "Signals" title over the chronicle misled.
    expect(screen.getByRole('dialog', { name: 'What happened' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Chronicle' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('chronicle rows')).toBeInTheDocument();
    expect(screen.queryByText('signal rows')).toBeNull();
  });

  it('switches tabs through its host', async () => {
    const onTab = vi.fn();
    render(<BellSheet {...props({ onTab })} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Chronicle' }));
    expect(onTab).toHaveBeenCalledWith('chronicle');
  });

  /** G1-e: the kit's metal tabs, and the open one's body is the panel it names. */
  it('switches on the kit\u2019s tabs, each naming the panel it opens', () => {
    render(<BellSheet {...props()} />);
    const tab = screen.getByRole('tab', { name: 'Signals' });
    expect(tab.closest('.gk-tabs')).not.toBeNull();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', tab.getAttribute('aria-controls'));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('signal rows');
  });

  it('holds Signals and the Chronicle, and no chat', () => {
    render(<BellSheet {...props()} />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Signals', 'Chronicle']);
    expect(screen.queryByRole('tab', { name: /chat/i })).toBeNull();
  });

  it('says how many signals are new, on the signals tab', () => {
    const { rerender } = render(<BellSheet {...props({ unseen: 2 })} />);
    expect(screen.getByText('2 new')).toBeInTheDocument();
    rerender(<BellSheet {...props({ unseen: 2, tab: 'chronicle' })} />);
    expect(screen.queryByText('2 new')).toBeNull();
  });

  /** Seen in the game: an empty feed stood 92% of the screen tall. */
  it('is as tall as its feed', () => {
    render(<BellSheet {...props()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'half');
  });
});
