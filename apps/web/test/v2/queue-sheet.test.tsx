import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BuildOrderView } from '../../src/api/schemas.js';
import { QueueSheet } from '../../src/v2/kit/QueueSheet.js';

/**
 * THE QUEUE SHEET, ONE TAP UNDER THE RINGS. Spec B12 and K4 (docs/ui-v2/gozlemevi.md).
 *
 * Both lanes, every order with its time, and the only cancel control in the new
 * interface. Cancelling burns half of what the order cost, so it never happens on
 * the tap: it opens `Confirm`, which states what is destroyed before it is.
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

  it('opens Confirm on cancel and cancels nothing until it is answered', async () => {
    const onCancel = vi.fn();
    render(<QueueSheet queues={queues} now={NOW} onCancel={onCancel} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Dart' }));
    const confirm = screen.getByRole('dialog', { name: 'Dart' });
    expect(within(confirm).getByText('Destroyed')).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancel the order' }));
    expect(onCancel).toHaveBeenCalledWith(queues.YARD[0]);
    expect(screen.queryByRole('dialog', { name: 'Dart' })).toBeNull();
  });

  it('keeps the order when Confirm is refused', async () => {
    const onCancel = vi.fn();
    render(<QueueSheet queues={queues} now={NOW} onCancel={onCancel} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Dart' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Dart' })).toBeNull();
  });

  it('closes only the Confirm on Escape, not the sheet under it', async () => {
    const onClose = vi.fn();
    render(<QueueSheet queues={queues} now={NOW} onCancel={vi.fn()} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Dart' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Dart' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
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
