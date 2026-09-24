import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Segmented } from '../../src/v2/kit/Segmented.js';

/**
 * A SEGMENTED SWITCH. Used by the bell sheet (K1: Signals · Chronicle · Chat) and
 * the base (K6: This world | Research). Every option is named; a dot on one says
 * something is waiting behind it.
 */

const options = [
  { id: 'signals', label: 'Signals' },
  { id: 'chronicle', label: 'Chronicle' },
  { id: 'chat', label: 'Chat', dot: true, dotLabel: '4 unread' },
] as const;

describe('the segmented switch', () => {
  it('names every option and marks the one that is on', () => {
    render(<Segmented label="Bell" options={options} value="chronicle" onChange={vi.fn()} />);
    expect(screen.getByRole('tablist', { name: 'Bell' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
  });

  it('switches on a press', async () => {
    const onChange = vi.fn();
    render(<Segmented label="Bell" options={options} value="signals" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: /Chronicle/ }));
    expect(onChange).toHaveBeenCalledWith('chronicle');
  });

  it('says what is waiting behind a dot', () => {
    render(<Segmented label="Bell" options={options} value="signals" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Chat · 4 unread' })).toBeInTheDocument();
  });

  it('moves with the arrow keys, wrapping at both ends', async () => {
    const onChange = vi.fn();
    render(<Segmented label="Bell" options={options} value="signals" onChange={onChange} />);
    screen.getByRole('tab', { name: 'Signals' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /^Chat/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange.mock.calls.map(([id]) => id as string)).toEqual(['chat', 'signals', 'chronicle']);
  });

  /** WAI-ARIA tabs: Home and End jump to the ends, as the old kit's switch did. */
  it('jumps to the first and last option with Home and End', async () => {
    const onChange = vi.fn();
    render(<Segmented label="Bell" options={options} value="chronicle" onChange={onChange} />);
    screen.getByRole('tab', { name: 'Chronicle' }).focus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /^Chat/ })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Signals' })).toHaveFocus();
    expect(onChange.mock.calls.map(([id]) => id as string)).toEqual(['chat', 'signals']);
  });

  /** A caller that already words the whole reading ("Clan — 2 unread") names the option itself. */
  it('takes a whole accessible name for an option when given one', () => {
    render(<Segmented label="Channels" options={[{ id: 'a', label: 'Clan', dot: true, name: 'Clan — 2 unread' }]} value="a" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Clan — 2 unread' })).toBeInTheDocument();
  });

  /** A panel below it can name itself after the option that shows it. */
  it('gives each option an id when asked', () => {
    render(<Segmented label="Bell" options={options} value="signals" onChange={vi.fn()} tabId={(id) => `bell-${id}`} />);
    expect(screen.getByRole('tab', { name: 'Signals' })).toHaveAttribute('id', 'bell-signals');
  });
});
