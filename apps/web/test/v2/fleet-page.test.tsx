import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { roomOf } from '../../src/lib/fleetPage.js';
import { clockTime } from '../../src/lib/time.js';
import type { AirborneItem } from '../../src/shell/PendingStrip.js';
import { FleetPage, type FleetPageProps, type FleetWorld } from '../../src/v2/hud/FleetPage.js';

/**
 * THE FLEET PAGE. Spec E4, B11 (docs/ui-v2/gozlemevi.md).
 *
 * Three views — in flight, at home, the Hangar — under the flight bays and the Hangar
 * room. Each flight is one row: progress, pace, time left and the clock it lands at.
 * A flight that may still turn says beside its button how long the way home would
 * take, because a recall is not free: the fleet stays up as long again (K8).
 */

const NOW = Date.parse('2026-09-24T12:00:00Z');
const MIN = 60_000;

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

const world = (over: Partial<FleetWorld> = {}): FleetWorld => ({
  id: 'p-1',
  name: 'Thistle',
  capital: true,
  active: true,
  fleet: { DART: 12, COURIER: 1 },
  away: 6,
  room: roomOf({ hangar: 80, hangarUsed: 54, hangarCeiling: 180, ground: 20, groundUsed: 4 }),
  ...over,
});

const props = (over: Partial<FleetPageProps> = {}): FleetPageProps => ({
  tab: 'air',
  onTab: vi.fn(),
  now: NOW,
  bays: { used: 1, total: 3 },
  hangar: { used: 54, total: 80 },
  flights: [flight()],
  worlds: [world()],
  recalling: null,
  onFocus: vi.fn(),
  onRecall: vi.fn(),
  onClose: vi.fn(),
  ...over,
});

describe('the Fleet page', () => {
  it('heads the page with the flight bays and the Hangar room', () => {
    render(<FleetPage {...props()} />);
    expect(screen.getByText('Flight bays')).toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText('54 / 80')).toBeInTheDocument();
  });

  /** The mock's "Havada · 5": how many are up, read before the list is. */
  it('counts what is in the air on its tab', () => {
    const { rerender } = render(<FleetPage {...props()} />);
    expect(screen.getByRole('tab', { name: 'In flight · 1' })).toBeInTheDocument();
    rerender(<FleetPage {...props({ flights: [] })} />);
    expect(screen.getByRole('tab', { name: 'In flight' })).toBeInTheDocument();
  });

  it('lists each flight with its countdown, how far along it is and the clock it lands at', () => {
    render(<FleetPage {...props()} />);
    const row = screen.getByRole('listitem');
    expect(within(row).getByText('Your fleet → Kestrel')).toBeInTheDocument();
    expect(within(row).getByText('4m 00s')).toBeInTheDocument();
    expect(row.querySelector('[data-progress]')).toHaveAttribute('data-progress', '0.5');
    expect(within(row).getByText(new RegExp(`at ${clockTime(new Date(NOW + 4 * MIN))}`))).toBeInTheDocument();
  });

  /*
    A flight coming home travels the track from the far end: the fill runs from the right
    and covers what it has flown. Seen in the gallery: a return leg 30% along drew 70%.
  */
  it('fills a homeward track from the far end by what it has flown', () => {
    render(<FleetPage {...props({ flights: [flight({ leg: 'return', span: { from: NOW - 3 * MIN, to: NOW + 7 * MIN } })] })} />);
    const fill = screen.getByRole('listitem').querySelector<HTMLElement>('[data-progress] > span');
    expect(fill?.style.width).toBe('30%');
    expect(fill).toHaveClass('ml-auto');
  });

  it('labels a slowed flight with its pace, and a full-speed one with nothing', () => {
    const { rerender } = render(<FleetPage {...props({ flights: [flight({ pace: 0.75 })] })} />);
    expect(screen.getByText(/75% speed/)).toBeInTheDocument();
    rerender(<FleetPage {...props({ flights: [flight({ pace: 1 })] })} />);
    expect(screen.queryByText(/% speed/)).toBeNull();
  });

  it('offers a recall only where the server allows, saying how long the way home would take', () => {
    const { rerender } = render(<FleetPage {...props({ flights: [flight({ recallMission: { missionId: 'm-1' } })] })} />);
    const recall = screen.getByRole('button', { name: /recall/i });
    // Four minutes out, so four minutes back — said on the row, beside the button (the mock).
    expect(recall).toHaveTextContent(/^Recall$/);
    expect(recall).toHaveAccessibleName('Recall · If recalled, home in 4m 00s');
    expect(recall.closest('li')).toHaveTextContent('If recalled, home in 4m 00s');

    rerender(<FleetPage {...props({ flights: [flight()] })} />);
    expect(screen.queryByRole('button', { name: /recall/i })).toBeNull();
    rerender(<FleetPage {...props({ flights: [flight({ leg: 'return' })] })} />);
    expect(screen.queryByRole('button', { name: /recall/i })).toBeNull();
  });

  it('recalls without flying the camera, and flies it on a tap of the row', async () => {
    const onRecall = vi.fn();
    const onFocus = vi.fn();
    const item = flight({ recallMission: { missionId: 'm-1' } });
    render(<FleetPage {...props({ flights: [item], onRecall, onFocus })} />);
    await userEvent.click(screen.getByRole('button', { name: /recall/i }));
    expect(onRecall).toHaveBeenCalledWith(item);
    expect(onFocus).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /your fleet → kestrel/i }));
    expect(onFocus).toHaveBeenCalledWith(item);
  });

  it('holds the button while its recall is on the way', () => {
    const item = flight({ recallMission: { missionId: 'm-1' } });
    render(<FleetPage {...props({ flights: [item], recalling: item.key })} />);
    expect(screen.getByRole('button', { name: /recall/i })).toBeDisabled();
  });

  it('marks an attack coming for you in red, and only that', () => {
    render(<FleetPage {...props({ flights: [flight({ key: 'thread:in', incoming: true, title: 'Attack → Thistle' }), flight()] })} />);
    const [enemy, mine] = screen.getAllByRole('listitem');
    expect(enemy).toHaveAttribute('data-tone', 'hostile');
    expect(mine).toHaveAttribute('data-tone', 'self');
  });

  it('says what to do when nothing is in the air', () => {
    render(<FleetPage {...props({ flights: [] })} />);
    expect(screen.getByText(/nothing in the air/i)).toBeInTheDocument();
  });

  it('shows each world’s ships at home, most first, and what is away', () => {
    render(<FleetPage {...props({ tab: 'home' })} />);
    const card = screen.getByRole('listitem');
    expect(within(card).getByText('Thistle')).toBeInTheDocument();
    expect(within(card).getByText('6 away')).toBeInTheDocument();
    const hulls = within(card).getAllByTestId('garrison-hull').map((el) => el.textContent);
    expect(hulls[0]).toMatch(/Dart.*12/);
    expect(hulls[1]).toMatch(/Courier.*1/);
  });

  it('says so when a world has no ships at home', () => {
    render(<FleetPage {...props({ tab: 'home', worlds: [world({ fleet: {} })] })} />);
    expect(screen.getByText(/no ships at home/i)).toBeInTheDocument();
  });

  it('shows each world’s Hangar and ground room with the rule, and says when one is full', () => {
    render(<FleetPage {...props({
      tab: 'room',
      worlds: [world({ room: roomOf({ hangar: 80, hangarUsed: 80, ground: 20, groundUsed: 4 }) })],
    })} />);
    expect(screen.getByText(/full hangar stops the yard/i)).toBeInTheDocument();
    const card = screen.getByRole('listitem');
    expect(card.querySelector('[data-room="hangar"]')).toHaveAttribute('data-full', '');
    expect(card.querySelector('[data-room="ground"]')).not.toHaveAttribute('data-full');
  });

  it('switches views through its tabs', async () => {
    const onTab = vi.fn();
    render(<FleetPage {...props({ onTab })} />);
    await userEvent.click(screen.getByRole('tab', { name: /at home/i }));
    expect(onTab).toHaveBeenCalledWith('home');
  });
});
