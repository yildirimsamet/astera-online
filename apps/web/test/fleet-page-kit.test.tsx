import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { clanSupportWaveSchema, type ClanSupportWave } from '../src/api/schemas.js';
import type { AirborneItem } from '../src/lib/airborne.js';
import { roomOf } from '../src/lib/fleetPage.js';
import { FleetPage, type FleetPageProps, type FleetWorld } from '../src/v2/hud/FleetPage.js';

/**
 * G2-h2 (2026-11-15): THE FLEET PAGE ON THE GAME KIT. The player comes here to see what is up,
 * what is home and how much room is left — and to turn a fleet back. The page reads the bays and
 * the Hangar of the world on top as gauges that say what is free; each flight is the timers
 * sheet's ring row; turning a fleet home is a short hold with the way home written on it, so a
 * stray tap on a crowded list can never cancel a raid.
 */

const NOW = Date.parse('2026-11-15T12:00:00Z');
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
  docked: 0,
  ...over,
});

const wave = (over: Record<string, unknown> = {}): ClanSupportWave => clanSupportWaveSchema.parse({
  id: 'w1', status: 'STATIONED',
  sender: { playerId: 'me', name: 'Me' }, host: { playerId: 'ali', name: 'Ali' },
  originPlanetId: 'home', hostPlanetId: 'vega', hostPlanetName: 'Vega',
  fleet: { PIKE: 12 }, bulk: 24, damaged: false,
  sentAt: new Date(NOW - 40 * MIN).toISOString(), arriveAt: new Date(NOW - 20 * MIN).toISOString(),
  stationedAt: new Date(NOW - 20 * MIN).toISOString(), expiresAt: new Date(NOW + 300 * MIN).toISOString(),
  returnAt: null, returnReason: null, outOfBand: false, battles: 0,
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
  onOpenRepairStation: vi.fn(),
  onFocusWorld: vi.fn(),
  onClose: vi.fn(),
  ...over,
});

/** Every class the v2 look painted with. */
const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|rounded-chip/;
const v2Painted = (root: HTMLElement): string[] =>
  [...root.querySelectorAll<HTMLElement>('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

describe('the fleet page on the kit', () => {
  /*
    The head sits on the fleet's art, which hides the plate's tone (atmosphere.css), so an
    attack coming is said in words under the name — wherever its row falls in the list.
  */
  it('is a kit sheet that names the world its gauges read, and says so in red while attacks come', () => {
    const { rerender } = render(<FleetPage {...props()} />);
    const page = screen.getByRole('dialog', { name: 'Fleet' });
    expect(page).toHaveClass('gk-sheet');
    const head = page.querySelector('.gk-sheet__head')!;
    expect(head).toHaveTextContent('Thistle');
    expect(head.querySelector('[data-tone="hostile"]')).toBeNull();
    rerender(<FleetPage {...props({ flights: [
      flight({ key: 'in-1', incoming: true, title: 'Attack → Thistle' }), flight(), flight({ key: 'in-2', incoming: true, title: 'Attack → Hollow' }),
    ] })} />);
    const threat = screen.getByRole('dialog', { name: 'Fleet' }).querySelector('.gk-sheet__head [data-tone="hostile"]');
    expect(threat).toHaveTextContent('2 attacks coming');
  });

  it('switches its views on the kit tabs', async () => {
    const onTab = vi.fn();
    render(<FleetPage {...props({ onTab })} />);
    expect(screen.getByRole('tablist', { name: 'Fleet views' })).toHaveClass('gk-tabs');
    await userEvent.click(screen.getByRole('tab', { name: 'Hangar' }));
    expect(onTab).toHaveBeenCalledWith('room');
  });

  it('reads the bays and the Hangar as gauges that say what is free', () => {
    render(<FleetPage {...props()} />);
    const bays = document.querySelector('[data-fleet-gauge="bays"]')!;
    expect(bays.querySelector('.gk-bar--segments')).not.toBeNull();
    expect(bays).toHaveTextContent('1 / 3');
    expect(bays).toHaveTextContent('free 2');
    const hangar = document.querySelector('[data-fleet-gauge="hangar"]')!;
    expect(hangar.querySelector('.gk-bar')).not.toBeNull();
    expect(hangar).toHaveTextContent('54 / 80');
    expect(hangar).toHaveTextContent('free 26');
  });

  it('says a gauge is full in its warning colour and in words', () => {
    render(<FleetPage {...props({ bays: { used: 3, total: 3 }, hangar: { used: 80, total: 80 } })} />);
    for (const kind of ['bays', 'hangar']) {
      const gauge = document.querySelector(`[data-fleet-gauge="${kind}"]`)!;
      expect(gauge).toHaveAttribute('data-full', '');
      expect(gauge.querySelector('.gk-bar')).toHaveClass('gk-fill-warn');
      expect(gauge).toHaveTextContent('Full');
    }
  });

  it('draws each flight as the timers sheet does: a ring that empties, red when it comes for you', () => {
    render(<FleetPage {...props({ flights: [flight({ key: 'in', incoming: true, title: 'Attack → Thistle', span: null }), flight()] })} />);
    const [enemy, mine] = screen.getAllByRole('listitem');
    expect(enemy!.querySelector('.gk-trow')).toHaveAttribute('data-tone', 'hostile');
    expect(enemy!.querySelector('.gk-timer__arc')).toBeNull();
    expect(mine!.querySelector('.gk-trow')).toHaveAttribute('data-tone', 'self');
    expect(mine!.querySelector('.gk-timer__arc')).not.toBeNull();
    expect(within(mine!).getByText('4m 00s')).toBeInTheDocument();
  });

  it('marks a flight coming home with the recall mark', () => {
    render(<FleetPage {...props({ flights: [flight({ leg: 'return' })] })} />);
    expect(screen.getByRole('listitem').querySelector('.gk-timer__ring')).toHaveAttribute('data-glyph', 'recall');
  });

  it('turns a flight home only by a short hold that says when it would be home', async () => {
    const onRecall = vi.fn();
    const onFocus = vi.fn();
    const item = flight({ recallMission: { missionId: 'm-1' } });
    render(<FleetPage {...props({ flights: [item], onRecall, onFocus })} />);
    const hold = screen.getByRole('button', { name: /^Recall/ });
    expect(hold).toHaveClass('gk-hold', 'gk-hold--md');
    expect(hold.style.getPropertyValue('--gk-hold-ms')).toBe('600ms');
    expect(hold).toHaveTextContent('Home in 4m 00s');
    await userEvent.click(hold);
    expect(onRecall).not.toHaveBeenCalled();
    hold.focus();
    await userEvent.keyboard('{Enter}{Enter}');
    expect(onRecall).toHaveBeenCalledWith(item);
    expect(onFocus).not.toHaveBeenCalled();
  });

  it('says the turn is under way instead of offering it twice', () => {
    const item = flight({ recallMission: { missionId: 'm-1' } });
    render(<FleetPage {...props({ flights: [item], recalling: item.key })} />);
    expect(screen.queryByRole('button', { name: /^Recall/ })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Turning…');
  });

  it('puts each support wave on a ring row, its stay said as time left, and turns it by a hold', async () => {
    const onRecall = vi.fn();
    render(<FleetPage {...props({ flights: [], support: { waves: [wave()], recalling: null, onRecall } })} />);
    const group = screen.getByRole('region', { name: /clan support/i });
    const row = group.querySelector('.gk-trow')!;
    expect(row).toHaveTextContent(/standing at vega/i);
    expect(row).toHaveTextContent('5h 00m');
    expect(row).toHaveTextContent(/left/);
    const hold = within(group).getByRole('button', { name: /^Recall/ });
    expect(hold).toHaveClass('gk-hold');
    hold.focus();
    await userEvent.keyboard('{Enter}{Enter}');
    expect(onRecall).toHaveBeenCalledWith('w1');
  });

  it('opens each world from a door a thumb can hit, its hulls under their class emblems', () => {
    const onOpenRepairStation = vi.fn();
    render(<FleetPage {...props({ tab: 'home', worlds: [world({ docked: 2 })], onOpenRepairStation })} />);
    expect(screen.getByRole('button', { name: /show thistle in the galaxy/i })).toHaveClass('gk-world__door');
    const hulls = screen.getAllByTestId('garrison-hull');
    expect(hulls[0]!.querySelector('.gk-emblem')).not.toBeNull();
    expect(screen.getByRole('button', { name: /2 in repair/i })).toHaveClass('gk-hit');
  });

  it('moves hurt ships with a kit button that says what it waits for', async () => {
    const onDock = vi.fn();
    render(<FleetPage {...props({ tab: 'home', onDock, worlds: [world({ damage: [{ hull: 'DART', count: 1, damageBp: 3000 }] })] })} />);
    const idle = screen.getByRole('button', { name: 'Select ships' });
    expect(idle).toHaveClass('gk-btn');
    expect(idle).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Move to workshop' }));
    expect(onDock).toHaveBeenCalledWith('p-1', [{ hull: 'DART', count: 1, damageBp: 3000, remainderBp: 0 }], expect.any(Function));
  });

  // E6 (owner 2026-11-17): the room tab says its one consequence; the full rule is behind ⓘ.
  it('says on the room tab what a full Hangar stops, the rest one press away', () => {
    render(<FleetPage {...props({ tab: 'room', worlds: [world()] })} />);
    expect(screen.getByText('A full Hangar stops the yard.')).toBeInTheDocument();
    expect(screen.queryByText(/a recalled fleet always fits/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'What is this?' }));
    expect(screen.getByText(/a recalled fleet always fits/)).toBeInTheDocument();
  });

  it('reads each world’s room on a kit bar, warning when full', () => {
    render(<FleetPage {...props({ tab: 'room', worlds: [world({ room: roomOf({ hangar: 80, hangarUsed: 80, ground: 20, groundUsed: 4 }) })] })} />);
    const card = screen.getByRole('listitem');
    expect(card.querySelector('[data-room="hangar"] .gk-bar')).toHaveClass('gk-fill-warn');
    expect(card.querySelector('[data-room="ground"] .gk-bar')).not.toHaveClass('gk-fill-warn');
  });

  it('leaves none of the v2 look on any of its views', () => {
    const many = props({
      flights: [flight({ recallMission: { missionId: 'm-1' } })],
      support: { waves: [wave(), wave({ id: 'w2', status: 'OUTBOUND', stationedAt: null, expiresAt: null, arriveAt: new Date(NOW + 9 * MIN).toISOString() })], recalling: null, onRecall: vi.fn() },
      worlds: [world({ docked: 2, damage: [{ hull: 'DART', count: 1, damageBp: 3000 }] })],
      onDock: vi.fn(),
    });
    for (const tab of ['air', 'home', 'room'] as const) {
      const { unmount } = render(<FleetPage {...many} tab={tab} />);
      expect(v2Painted(screen.getByRole('dialog', { name: 'Fleet' }))).toEqual([]);
      unmount();
    }
  });
});
