import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BellSheet, type BellSheetProps } from '../../src/v2/hud/BellSheet.js';

/**
 * THE BELL SHEET. Decision K1 (docs/ui-v2/gozlemevi.md).
 *
 * Signals, the galaxy chronicle and chat were three buttons scattered over the
 * disc; they are one sheet under the bell with three tabs. Chat's unread dot
 * moves onto its tab.
 */

const props = (over: Partial<BellSheetProps> = {}): BellSheetProps => ({
  tab: 'signals',
  onTab: vi.fn(),
  onClose: vi.fn(),
  unseen: 0,
  chatUnread: 0,
  signals: <p>signal rows</p>,
  chronicle: <p>chronicle rows</p>,
  chat: <p>chat log</p>,
  ...over,
});

describe('the bell sheet', () => {
  it('opens on the tab it is given and shows only that tab', () => {
    render(<BellSheet {...props({ tab: 'chronicle' })} />);
    expect(screen.getByRole('dialog', { name: 'Signals' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Chronicle' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('chronicle rows')).toBeInTheDocument();
    expect(screen.queryByText('signal rows')).toBeNull();
  });

  it('switches tabs through its host', async () => {
    const onTab = vi.fn();
    render(<BellSheet {...props({ onTab })} />);
    await userEvent.click(screen.getByRole('tab', { name: /^Chat/ }));
    expect(onTab).toHaveBeenCalledWith('chat');
  });

  it('carries chat’s unread dot on the chat tab', () => {
    render(<BellSheet {...props({ chatUnread: 4 })} />);
    expect(screen.getByRole('tab', { name: 'Chat · 4 unread' })).toBeInTheDocument();
  });

  it('says how many signals are new', () => {
    render(<BellSheet {...props({ unseen: 2 })} />);
    expect(screen.getByText('2 new')).toBeInTheDocument();
  });

  it('lets the chat log own its scrolling', () => {
    const { container, rerender } = render(<BellSheet {...props()} />);
    expect(container.querySelector('[data-sheet-body]')).toHaveClass('overflow-y-auto');
    rerender(<BellSheet {...props({ tab: 'chat' })} />);
    expect(container.querySelector('[data-sheet-body]')).toHaveClass('overflow-hidden');
  });
});
