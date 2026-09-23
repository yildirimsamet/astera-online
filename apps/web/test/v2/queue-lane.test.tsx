import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BuildOrderView } from '../../src/api/schemas.js';
import { orderProgress } from '../../src/lib/orders.js';
import { QueueLane } from '../../src/v2/kit/QueueLane.js';

/**
 * A LANE OF WORK AS RINGS. Spec B12 (docs/ui-v2/gozlemevi.md).
 *
 * Each order is a ring that fills as it builds, with its picture inside, its name
 * and the time left beside it; a slot with nothing in it says "+ Free slot". The
 * lane is a glance, not a control: a tap opens the queue sheet, and cancelling
 * lives there behind `Confirm` because it burns half of what the order cost.
 */

const NOW = Date.parse('2026-09-23T12:00:00Z');
const MIN = 60_000;

const hull = (id: string, from: number, to: number, count = 1): BuildOrderView => ({
  id,
  queue: 'YARD',
  slot: 0,
  kind: 'HULL',
  subject: 'DART',
  count,
  startedAt: new Date(NOW + from * MIN),
  finishesAt: new Date(NOW + to * MIN),
  cost: { alloy: 240, crystal: 0, deuterium: 0 },
});

const optimistic: BuildOrderView = {
  id: 'pending',
  queue: 'YARD',
  slot: 1,
  kind: 'HULL',
  subject: 'DART',
  count: 1,
  cost: { alloy: 240, crystal: 0, deuterium: 0 },
  optimistic: true,
};

describe('how far an order has built', () => {
  it('reads the running order by its own clock', () => {
    expect(orderProgress(hull('a', -30, 30), NOW)).toBe(0.5);
  });

  it('leaves an order that has not started at zero', () => {
    expect(orderProgress(hull('b', 30, 90), NOW)).toBe(0);
  });

  it('holds a finished order at full until the server takes it', () => {
    expect(orderProgress(hull('c', -90, -30), NOW)).toBe(1);
  });

  it('draws an order the server has not timed yet as not started', () => {
    expect(orderProgress(optimistic, NOW)).toBe(0);
  });
});

describe('the queue lane', () => {
  it('draws one ring per order and a free slot for each one left', () => {
    render(<QueueLane label="Yard" orders={[hull('a', -30, 30)]} now={NOW} onOpen={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getAllByText('+ Free slot')).toHaveLength(2);
  });

  it('has no free slot when the lane is full', () => {
    const orders = [hull('a', -30, 30), hull('b', 30, 60), hull('c', 60, 90)];
    render(<QueueLane label="Yard" orders={orders} now={NOW} onOpen={vi.fn()} />);
    expect(screen.queryByText('+ Free slot')).toBeNull();
  });

  it('fills the running ring and leaves the waiting ones empty', () => {
    const { container } = render(
      <QueueLane label="Yard" orders={[hull('a', -15, 45), hull('b', 45, 60)]} now={NOW} onOpen={vi.fn()} />,
    );
    const rings = [...container.querySelectorAll('[data-ring]')].map((ring) => ring.getAttribute('data-progress'));
    expect(rings).toEqual(['0.25', '0']);
  });

  it('names the order, its count and the time until it is done', () => {
    render(<QueueLane label="Yard" orders={[hull('a', -5, 12, 12)]} now={NOW} onOpen={vi.fn()} />);
    const ring = screen.getByRole('button');
    expect(within(ring).getByText('Dart')).toBeInTheDocument();
    expect(within(ring).getByText('×12')).toBeInTheDocument();
    expect(within(ring).getByText('12m 00s')).toBeInTheDocument();
  });

  it('says an untimed order is still committing', () => {
    render(<QueueLane label="Yard" orders={[optimistic]} now={NOW} onOpen={vi.fn()} />);
    expect(within(screen.getByRole('button')).getByText('committing…')).toBeInTheDocument();
  });

  it('opens the queue sheet on a tap', async () => {
    const onOpen = vi.fn();
    render(<QueueLane label="Yard" orders={[hull('a', -30, 30)]} now={NOW} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('names the lane for a screen reader', () => {
    render(<QueueLane label="Yard" orders={[]} now={NOW} onOpen={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Yard' })).toBeInTheDocument();
    expect(screen.getAllByText('+ Free slot')).toHaveLength(3);
  });
});
