import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationView, PendingThread, PlanetView } from '../../src/api/schemas.js';
import { HudTop } from '../../src/v2/shell/HudTop.js';
import { planetView } from '../fixtures.js';

/**
 * THE TOP OF THE v2 SHELL, WIRED. Spec B1, B2 (docs/ui-v2/gozlemevi.md).
 *
 * The top bar reads the ACTIVE world's stock, draws the world mark only once a
 * second world exists, counts news (never states) on the bell; the Now line under
 * it reads the flights and the shield.
 */

let planet: PlanetView = planetView();
let worlds: PlanetView[] = [planet];
let notifications: NotificationView[] = [];
let pending: PendingThread[] = [];
let shieldUntil: Date | null = null;

vi.mock('../../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: planet, dataUpdatedAt: Date.now() }),
    useSeason: () => ({ data: { shieldUntil, shieldKind: shieldUntil ? 'NEWCOMER' : null } }),
    useNotifications: () => ({ data: { notifications } }),
    useRewards: () => ({ data: { claimable: 0 } }),
    usePending: () => ({ data: { pending } }),
    useMining: () => ({ data: { runs: [] } }),
    useGalaxyEvents: () => ({ data: { events: [] } }),
    useTraffic: () => ({ data: { contacts: [] } }),
  };
});

vi.mock('../../src/api/world.js', () => ({
  useWorld: () => ({
    activePlanetId: planet.planet.id,
    capitalPlanetId: 'p1',
    worlds,
    selectPlanet: vi.fn(),
  }),
}));

const handlers = () => ({ onCommander: vi.fn(), onWorlds: vi.fn(), onEconomy: vi.fn(), onBell: vi.fn() });

beforeEach(() => {
  planet = planetView();
  worlds = [planet];
  notifications = [];
  pending = [];
  shieldUntil = null;
});

describe('the wired top of the shell', () => {
  it('reads the active world’s stores', () => {
    render(<HudTop commander="Samet" {...handlers()} />);
    expect(screen.getByRole('button', { name: 'Alloy: 500 of 2,000' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crystal: 120 of 600' })).toBeInTheDocument();
  });

  it('draws the world mark only once there is a second world', () => {
    const { rerender } = render(<HudTop commander="Samet" {...handlers()} />);
    expect(screen.queryByRole('button', { name: /^CAPITAL/ })).toBeNull();
    worlds = [planet, planetView({}, { id: 'p2', name: 'Hollow' })];
    rerender(<HudTop commander="Samet" {...handlers()} />);
    expect(screen.getByRole('button', { name: 'CAPITAL · Kestrel-12' })).toBeInTheDocument();
  });

  it('counts unseen news on the bell, and never a standing state', () => {
    planet = planetView({}, { alloy: 2_000 });
    notifications = [
      { id: 'n1', kind: 'fleet_returned', payload: {}, seen: false, at: new Date() },
      { id: 'n2', kind: 'fleet_returned', payload: {}, seen: true, at: new Date() },
    ];
    render(<HudTop commander="Samet" {...handlers()} />);
    expect(screen.getByRole('button', { name: 'Signals — 1 unread' })).toBeInTheDocument();
  });

  it('puts an attack on its way on the Now line', () => {
    pending = [{ kind: 'incoming', targetName: 'Kestrel-12', targetPlanetId: 'p1', minutesRemaining: 9, arriveAt: new Date(Date.now() + 9 * 60_000) }];
    render(<HudTop commander="Samet" {...handlers()} />);
    expect(screen.getByRole('button', { name: /Most urgent timer/ })).toHaveAttribute('data-tone', 'hostile');
  });

  it('wears the shield on the chip while it holds', () => {
    shieldUntil = new Date(Date.now() + 3 * 3_600_000);
    render(<HudTop commander="Samet" {...handlers()} />);
    expect(screen.getByRole('button', { name: /^Commander Samet/ })).toHaveAttribute('data-shielded');
  });

  it('routes its controls to the shell', async () => {
    const on = handlers();
    render(<HudTop commander="Samet" {...on} />);
    await userEvent.click(screen.getByRole('button', { name: /^Commander Samet/ }));
    await userEvent.click(screen.getByRole('button', { name: /^Alloy/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Signals' }));
    expect(on.onCommander).toHaveBeenCalledTimes(1);
    expect(on.onEconomy).toHaveBeenCalledTimes(1);
    expect(on.onBell).toHaveBeenCalledTimes(1);
  });
});
