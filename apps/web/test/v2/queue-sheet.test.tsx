import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BuildOrderView } from '../../src/api/schemas.js';
import { QueueSheet } from '../../src/v2/kit/QueueSheet.js';

/**
 * THE QUEUE SHEET, ONE TAP UNDER THE RINGS. Spec B12 and K4 (docs/ui-v2/gozlemevi.md).
 *
 * Both lanes, every order with its time, and the only cancel control in the new
 * interface. Cancelling burns half of what the order cost, so it never happens on
 * the tap: the row opens what is destroyed and what comes back, and the cancel is
 * the kit's shortest hold (G2-k, 2026-11-15; owner: a former confirm is a 0.6 s hold).
 */

const NOW = Date.parse('2026-09-23T12:00:00Z');
const MIN = 60_000;

const dart = (id: string, from: number, to: number): BuildOrderView => ({
  id,
  queue: 'YARD',
  slot: 0,
  kind: 'HULL',
  subject: 'DART',
  count: 12,
  startedAt: new Date(NOW + from * MIN),
  finishesAt: new Date(NOW + to * MIN),
  cost: { alloy: 2_880, crystal: 0, deuterium: 0 },
});

const staged: BuildOrderView = {
  id: 'staged',
  queue: 'YARD',
  slot: 1,
  kind: 'HULL',
  subject: 'DART',
  count: 1,
  cost: { alloy: 240, crystal: 0, deuterium: 0 },
  optimistic: true,
};

const queues = { CONSTRUCTION: [] as BuildOrderView[], YARD: [dart('a', -5, 12)] };

describe('the queue sheet', () => {
  it('lists each lane with its orders, and says when a lane is idle', () => {
    render(<QueueSheet queues={queues} now={NOW} onCancel={vi.fn()} onClose={vi.fn()} />);
    const yard = screen.getByRole('group', { name: 'Yard' });
    expect(within(yard).getByText('Dart')).toBeInTheDocument();
    expect(within(yard).getByText('×12')).toBeInTheDocument();
    expect(within(yard).getByText('12m 00s')).toBeInTheDocument();
    expect(within(yard).getByText(/^ends /)).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Construction' })).getByText('Nothing building')).toBeInTheDocument();
  });

  it('is a kit sheet whose lanes and rows carry none of the old look', () => {
    render(<QueueSheet queues={queues} now={NOW} onCancel={vi.fn()} onClose={vi.fn()} />);
    const sheet = screen.getByRole('dialog', { name: 'Build queues' });
    expect(sheet).toHaveClass('gk-sheet');
    const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|(^|\s)text-(micro|caption)(\s|$)/;
    const old = [...sheet.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));
    expect(old).toEqual([]);
    expect(within(screen.getByRole('group', { name: 'Yard' })).getByRole('listitem')).toHaveClass('gk-qrow');
  });

  it('opens what a cancel destroys inside the row, and cancels nothing until it is held', () => {
    const onCancel = vi.fn();
    render(<QueueSheet queues={queues} now={NOW} onCancel={onCancel} onClose={vi.fn()} />);
    const ask = screen.getByRole('button', { name: 'Cancel Dart' });
    expect(ask).toHaveAttribute('data-own-sound');
    fireEvent.click(ask);
    expect(ask).toHaveAttribute('aria-expanded', 'true');
    // no dialog over the sheet: the loss is said where the order is
    expect(screen.queryByRole('dialog', { name: 'Dart' })).toBeNull();
    const row = screen.getAllByRole('listitem')[0]!;
    expect(within(row).getByText('Destroyed')).toBeInTheDocument();
    expect(within(row).getByText('Returned')).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    // a confirm dialog once: the shortest hold (owner, 2026-11-14)
    const commit = within(row).getByRole('button', { name: /Cancel the order/ });
    expect(commit).toHaveClass('gk-hold', 'gk-btn--danger');
    fireEvent.keyDown(commit, { key: 'Enter' });
    fireEvent.keyDown(commit, { key: 'Enter' });
    expect(onCancel).toHaveBeenCalledWith(queues.YARD[0]);
    expect(within(row).queryByText('Destroyed')).toBeNull();
  });

  it('keeps the order when the player steps back', () => {
    const onCancel = vi.fn();
    render(<QueueSheet queues={queues} now={NOW} onCancel={onCancel} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Dart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByText('Destroyed')).toBeNull();
  });

  it('folds the open cancel on Escape, and closes the sheet only on the next', () => {
    const onClose = vi.fn();
    render(<QueueSheet queues={queues} now={NOW} onCancel={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Dart' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Destroyed')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the time on the running order and "Queued" on the ones behind it', () => {
    const lanes = { CONSTRUCTION: [] as BuildOrderView[], YARD: [dart('a', -5, 12), dart('b', 12, 30)] };
    render(<QueueSheet queues={lanes} now={NOW} onCancel={vi.fn()} onClose={vi.fn()} />);
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]!).getByText('12m 00s')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Queued')).toBeInTheDocument();
    expect(within(rows[1]!).queryByText('30m 00s')).toBeNull();
  });

  it('offers no cancel on an order the server has not timed yet', () => {
    render(
      <QueueSheet queues={{ CONSTRUCTION: [], YARD: [staged] }} now={NOW} onCancel={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /^Cancel / })).toBeNull();
    expect(screen.getByText('committing…')).toBeInTheDocument();
  });

  it('holds every cancel while one is in flight, and says which one it is', () => {
    const two = { CONSTRUCTION: [] as BuildOrderView[], YARD: [dart('a', -5, 12), dart('b', 12, 30)] };
    render(<QueueSheet queues={two} now={NOW} cancelling="a" onCancel={vi.fn()} onClose={vi.fn()} />);
    const [first, second] = screen.getAllByRole('button', { name: 'Cancel Dart' });
    expect(first).toBeDisabled();
    expect(first).toHaveTextContent('Cancelling…');
    expect(second).toBeDisabled();
    expect(second).toHaveTextContent(/^Cancel$/);
  });
});
