import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BuildOrderView, PendingThread } from '../../src/api/schemas.js';
import i18n from '../../src/i18n/index.js';
import { nowEntries, type NowInput } from '../../src/lib/nowLine.js';
import { buildOrderLabel } from '../../src/lib/orders.js';
import { NowLine } from '../../src/v2/hud/NowLine.js';

/**
 * THE NOW LINE. Spec B2 (docs/ui-v2/gozlemevi.md).
 *
 * One line under the top bar: a dot (red only for an enemy), what it is, and the
 * countdown, with "+N" for the rest. It is gone when nothing is timed. A tap
 * opens every timer, each with its countdown and the clock time it lands at.
 */

const NOW = Date.parse('2026-09-23T12:00:00Z');
const at = (ms: number): Date => new Date(NOW + ms);

const thread = (kind: PendingThread['kind'], ms: number): PendingThread => ({
  kind,
  targetName: 'Kestrel',
  targetPlanetId: 'p-1',
  minutesRemaining: ms / 60_000,
  arriveAt: at(ms),
});

const refinery: BuildOrderView = {
  id: 'o-1',
  queue: 'CONSTRUCTION',
  slot: 0,
  kind: 'BUILDING',
  subject: 'REFINERY',
  count: 1,
  startedAt: at(-3_600_000),
  finishesAt: at(120_000),
  cost: { alloy: 1, crystal: 0, deuterium: 0 },
};

/** The sheet's open state belongs to the shell; closed unless a test opens it. */
const closed = () => ({ open: false, onOpen: vi.fn(), onClose: vi.fn() });

const entries = (over: Partial<NowInput>) => nowEntries({
  now: NOW, threads: [], runs: [], builds: [], research: [], events: [], shieldUntil: null, ...over,
});

describe('the Now line', () => {
  it('is not in the page when nothing is timed', () => {
    const { container } = render(<NowLine entries={[]} now={NOW} {...closed()} />);
    expect(container.innerHTML).toBe('');
  });

  it('leads with an enemy, in red, and announces it once', () => {
    render(<NowLine entries={entries({ threads: [thread('transfer', 60_000), thread('incoming', 252_000)] })} now={NOW} {...closed()} />);
    const line = screen.getByRole('button', { name: /Most urgent timer/ });
    expect(line).toHaveAttribute('data-tone', 'hostile');
    expect(within(line).getByText('Inbound → Kestrel')).toHaveAttribute('aria-live', 'polite');
    expect(within(line).getByText('4m 12s')).toBeInTheDocument();
    expect(within(line).getByText('+1')).toBeInTheDocument();
  });

  /** Owner, 2026-09-24: the dot beats on every timer, not only an enemy's — something is running. */
  it('beats the dot in front of every timer, yours and an enemy’s', () => {
    const { container, rerender } = render(
      <NowLine entries={entries({ threads: [thread('transfer', 60_000)] })} now={NOW} {...closed()} />,
    );
    const dot = () => container.querySelector('[data-now-dot]');
    expect(dot()).toHaveClass('animate-pulse', 'bg-v2-self');
    rerender(<NowLine entries={entries({ threads: [thread('incoming', 60_000)] })} now={NOW} {...closed()} />);
    expect(dot()).toHaveClass('animate-pulse', 'bg-v2-hostile');
  });

  it('draws your own timers in your colour', () => {
    render(<NowLine entries={entries({ threads: [thread('transfer', 60_000)] })} now={NOW} {...closed()} />);
    const line = screen.getByRole('button', { name: /Most urgent timer/ });
    expect(line).toHaveAttribute('data-tone', 'self');
    expect(within(line).queryByText(/^\+/)).toBeNull();
  });

  it('names work by what is being built', () => {
    render(<NowLine entries={entries({ builds: [refinery] })} now={NOW} {...closed()} />);
    expect(screen.getByText(buildOrderLabel(refinery))).toBeInTheDocument();
    expect(screen.getByText('Work finishing')).toBeInTheDocument();
    expect(screen.getByText('2m 00s')).toBeInTheDocument();
  });

  it('counts down in the reader’s language', async () => {
    render(<NowLine entries={entries({ threads: [thread('transfer', 252_000)] })} now={NOW} {...closed()} />);
    await act(async () => { await i18n.changeLanguage('tr'); });
    expect(screen.getByText('4d 12sn')).toBeInTheDocument();
    await act(async () => { await i18n.changeLanguage('en'); });
  });

  it('opens every timer with the clock time each lands at', async () => {
    const list = entries({ threads: [thread('incoming', 252_000), thread('transfer', 600_000)], builds: [refinery] });
    const onOpen = vi.fn();
    const { rerender } = render(<NowLine entries={list} now={NOW} {...closed()} onOpen={onOpen} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Most urgent timer/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    rerender(<NowLine entries={list} now={NOW} {...closed()} open />);
    const sheet = screen.getByRole('dialog', { name: 'Timers' });
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(3);
    expect(within(sheet).getAllByText(/^at /)).toHaveLength(3);
  });
});
