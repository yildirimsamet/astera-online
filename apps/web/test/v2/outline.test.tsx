import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BuildOrderView } from '../../src/api/schemas.js';
import type { AirborneItem } from '../../src/shell/PendingStrip.js';
import { Outline, type OutlineProps, type OutlineQueue, type OutlineWorld } from '../../src/v2/hud/Outline.js';

/**
 * THE DESK OUTLINE. Spec E11 · K10: on a wide screen the left column keeps the
 * commander's worlds, what is in the air and the work queues in view, so the
 * galaxy never has to be left to answer "what is mine doing".
 */

const NOW = Date.parse('2026-09-24T12:00:00Z');
const MIN = 60_000;

const world = (over: Partial<OutlineWorld> = {}): OutlineWorld => ({
  id: 'p-1',
  name: 'Thistle',
  capital: true,
  active: true,
  ships: 18,
  away: 6,
  threats: 0,
  ...over,
});

const flight = (over: Partial<AirborneItem> = {}): AirborneItem => ({
  key: 'thread:m-1',
  title: 'Your fleet → Kestrel',
  detail: '6 craft',
  arrival: NOW + 4 * MIN,
  leg: 'outbound',
  incoming: false,
  engages: true,
  mark: 'fleet',
  span: { from: NOW - 4 * MIN, to: NOW + 4 * MIN },
  focus: { kind: 'thread', key: 'm-1' },
  ...over,
});

const order = (id: string, over: Partial<BuildOrderView> = {}): BuildOrderView => ({
  id,
  queue: 'CONSTRUCTION',
  slot: 0,
  kind: 'BUILDING',
  subject: 'REFINERY',
  count: 4,
  startedAt: new Date(NOW - 10 * MIN),
  finishesAt: new Date(NOW + 12 * MIN),
  cost: { alloy: 300, crystal: 100, deuterium: 0 },
  ...over,
} as BuildOrderView);

const queues: OutlineQueue[] = [
  { worldId: null, world: null, lane: 'research', orders: [] },
  { worldId: 'p-1', world: 'Thistle', lane: 'construction', orders: [order('o-1')] },
  { worldId: 'p-1', world: 'Thistle', lane: 'yard', orders: [] },
];

const outline = (over: Partial<OutlineProps> = {}) => {
  const props: OutlineProps = {
    now: NOW,
    worlds: [world()],
    flights: [flight()],
    queues,
    onWorld: vi.fn(),
    onFlight: vi.fn(),
    onQueue: vi.fn(),
    ...over,
  };
  render(<Outline {...props} />);
  return props;
};

describe('the desk outline', () => {
  it('is one landmark with the three parts the spec names, in its order', () => {
    outline();
    const column = screen.getByRole('complementary', { name: 'Outline' });
    expect(within(column).getAllByRole('heading').map((h) => h.textContent)).toEqual([
      expect.stringMatching(/^Worlds/),
      expect.stringMatching(/^In the air/),
      expect.stringMatching(/^Queues/),
    ]);
  });

  it('lists each world with its ships home and away, the active one marked', async () => {
    const props = outline({ worlds: [world(), world({ id: 'p-2', name: 'Kestrel', capital: false, active: false, ships: 0, away: 0 })] });
    const thistle = screen.getByRole('button', { name: /^Thistle/ });
    expect(thistle).toHaveAttribute('aria-current', 'true');
    expect(thistle).toHaveTextContent('18 ships home');
    expect(thistle).toHaveTextContent('6 away');
    const kestrel = screen.getByRole('button', { name: /^Kestrel/ });
    expect(kestrel).not.toHaveAttribute('aria-current');
    expect(kestrel).toHaveTextContent('No ships at home');
    await userEvent.click(kestrel);
    expect(props.onWorld).toHaveBeenCalledWith('p-2');
  });

  it('puts an attack coming for a world on its row, in red — the one thing that is (K2)', () => {
    outline({ worlds: [world({ threats: 2 })] });
    const row = screen.getByRole('button', { name: /^Thistle/ });
    expect(row).toHaveAccessibleName(/2 attacks coming/);
    expect(row.querySelector('[data-tone="hostile"]')).not.toBeNull();
  });

  it('counts what is in the air and opens a flight on the galaxy', async () => {
    const props = outline({ flights: [flight(), flight({ key: 'thread:m-2', title: 'Raid on you', incoming: true, mark: 'incoming' })] });
    expect(screen.getByRole('heading', { name: /In the air/ })).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: 'Your fleet → Kestrel' })).toHaveTextContent('4m 00s');
    await userEvent.click(screen.getByRole('button', { name: 'Your fleet → Kestrel' }));
    expect(props.onFlight).toHaveBeenCalledWith(expect.objectContaining({ key: 'thread:m-1' }));
  });

  it('says so when nothing is in the air, and where a launch starts', () => {
    outline({ flights: [] });
    expect(screen.getByText(/Nothing in the air/)).toBeInTheDocument();
  });

  it('shows each lane’s work with the time left, research first', () => {
    outline();
    const lanes = screen.getAllByRole('button', { name: /^(Research|Construction|Yard)/ });
    expect(lanes.map((lane) => lane.getAttribute('aria-label')?.split(' · ')[0])).toEqual(['Research', 'Construction', 'Yard']);
    expect(screen.getByText('Alloy Refinery')).toBeInTheDocument();
    expect(screen.getByText('12m 00s')).toBeInTheDocument();
  });

  it('marks an idle lane as a gap you can close, with its free slots (warn, not red)', () => {
    outline();
    const yard = screen.getByRole('button', { name: /^Yard/ });
    expect(yard).toHaveAccessibleName('Yard · Idle · 3 slots free');
    expect(yard).toHaveAttribute('data-tone', 'warn');
    expect(screen.getByRole('button', { name: /^Construction/ })).toHaveAccessibleName('Construction · 1 of 3');
  });

  it('opens a lane’s page from its row', async () => {
    const props = outline();
    await userEvent.click(screen.getByRole('button', { name: /^Yard/ }));
    expect(props.onQueue).toHaveBeenCalledWith(queues[2]);
  });

  it('names the world above its lanes only when there is more than one', () => {
    outline();
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });

  it('names each world above its own lanes when there are two', () => {
    outline({
      worlds: [world(), world({ id: 'p-2', name: 'Kestrel', capital: false, active: false })],
      queues: [...queues, { worldId: 'p-2', world: 'Kestrel', lane: 'construction', orders: [] }],
    });
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Thistle', 'Kestrel']);
  });
});
