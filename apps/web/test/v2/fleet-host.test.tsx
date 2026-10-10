import { MULTI_WORLD } from '@astera/rules';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MiningRun, PendingThread } from '../../src/api/schemas.js';
import { ToastProvider } from '../../src/ui/Toast.js';
import { FleetHost } from '../../src/v2/shell/FleetHost.js';
import { planetView } from '../fixtures.js';

/**
 * THE FLEET PAGE, WIRED. Spec E4 (docs/ui-v2/gozlemevi.md).
 *
 * The same flights the strip lists (`useAirborne`), the active world's flight bays
 * and Hangar at the head, every world's garrison and room, and the two recalls: a
 * transfer or a raid through the flight recall (K8), a Prospector run through the
 * mining one. A row pressed closes the page before the camera moves.
 */

let rows: PendingThread[] = [];
let runs: MiningRun[] = [];
const recallFlight = vi.fn();
const recallMining = vi.fn();

const capital = planetView({ fleet: { DART: 12 } }, { id: 'p-1', name: 'Thistle' });
const withRoom = {
  ...capital,
  flight: { used: 1, total: 4 },
  fleetAway: { DART: 6 },
  capacity: { hangar: 80, hangarUsed: 54, hangarCeiling: 180, ground: 20, groundUsed: 4 },
  // A season dealt the Repair Station (ruleset 14), with two Ballistas waiting in it.
  rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion,
  fleetDocked: { BALLISTA: 2 },
  dock: {
    lots: [{ id: 'lot-1', hull: 'BALLISTA' as const, count: 2, damageBp: 6400, repairing: false, orderId: null, cost: { alloy: 10, crystal: 5, deuterium: 0 }, minutes: 3 }],
    waiting: { cost: { alloy: 10, crystal: 5, deuterium: 0 }, minutes: 3 },
    pct: 100,
  },
};

vi.mock('../../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/api/queries.js');
  return {
    ...actual,
    usePending: () => ({ data: { pending: rows } }),
    useMining: () => ({ data: { runs } }),
    useTraffic: () => ({ data: { contacts: [] } }),
    usePlanet: () => ({ data: withRoom }),
    useMonuments: () => ({ data: undefined }),
    useRecallMining: () => ({ mutate: recallMining, isPending: false }),
    useRecallFlight: () => ({ mutate: recallFlight, isPending: false }),
    useMySupport: () => ({ data: { waves: [] } }),
    useClanSupportActions: () => ({ recall: { mutate: vi.fn(), isPending: false } }),
  };
});

vi.mock('../../src/api/world.js', () => ({
  useWorld: () => ({ activePlanetId: 'p-1', capitalPlanetId: 'p-1', worlds: [withRoom], selectPlanet: vi.fn() }),
}));

const raid: PendingThread = {
  id: 'mission-1',
  kind: 'fleet',
  targetName: 'Kestrel',
  minutesRemaining: 12,
  arriveAt: new Date(Date.now() + 12 * 60_000),
  leg: 'outbound',
  recallable: true,
  pace: 0.5,
  fleet: { DART: 6 },
  path: {
    from: { x: 0, y: 0, z: 0 },
    to: { x: 1, y: 0, z: 0 },
    departAt: new Date(Date.now() - 60_000),
    arriveAt: new Date(Date.now() + 12 * 60_000),
  },
};

const host = (onFocus = vi.fn(), onClose = vi.fn(), onOpenRepairStation = vi.fn(), onFocusWorld = vi.fn()) => render(
  <ToastProvider>
    <FleetHost onFocus={onFocus} onClose={onClose} onOpenRepairStation={onOpenRepairStation} onFocusWorld={onFocusWorld} />
  </ToastProvider>,
);

beforeEach(() => {
  rows = [];
  runs = [];
  recallFlight.mockReset();
  recallMining.mockReset();
});

describe('the wired Fleet page', () => {
  it('heads the page with the active world’s flight bays and Hangar', () => {
    host();
    expect(screen.getByRole('dialog', { name: 'Fleet' })).toBeInTheDocument();
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    expect(screen.getByText('54 / 80')).toBeInTheDocument();
  });

  it('lists the flights with the pace the server states', () => {
    rows = [raid];
    host();
    expect(screen.getByText(/Kestrel/)).toBeInTheDocument();
    expect(screen.getByText(/50% speed/)).toBeInTheDocument();
  });

  it('turns a raid through the flight recall', async () => {
    rows = [raid];
    host();
    await userEvent.click(screen.getByRole('button', { name: /^recall/i }));
    expect(recallFlight).toHaveBeenCalledWith({ missionId: 'mission-1' }, expect.any(Object));
    expect(recallMining).not.toHaveBeenCalled();
  });

  it('turns an entire outbound monument fleet with the native return forecast', async () => {
    rows = [{ ...raid, kind: 'monument', monumentId: 'monument-1',
      monumentRecall: { minutes: 9 } }];
    host();
    const button = screen.getByRole('button', { name: /^recall/i });
    expect(button).toHaveAccessibleName('Recall · If recalled, home in 9m 00s');
    await userEvent.click(button);
    const recalled: unknown = recallFlight.mock.lastCall?.[0];
    expect(recalled).toEqual({ missionId: 'mission-1', monument: true });
    expect(recallMining).not.toHaveBeenCalled();
  });

  it('turns a Prospector run through the mining recall', async () => {
    runs = [{
      id: 'run-1',
      planetId: 'p-1',
      targetKind: 'asteroid',
      asteroidId: 'mJt7YvxMZEC5S7yYQ32SYw',
      debrisFieldId: null,
      status: 'outbound',
      craft: 1,
      departAt: new Date(Date.now() - 60_000),
      arriveAt: new Date(Date.now() + 5 * 60_000),
      homeAt: null,
      intercept: { x: 1, y: 0, z: 2 },
      minedAlloy: 0,
      minedCrystal: 0,
      minedDeuterium: 0,
      recalledAt: null,
    }];
    host();
    await userEvent.click(screen.getByRole('button', { name: /^recall/i }));
    expect(recallMining).toHaveBeenCalledWith({ runId: 'run-1', originPlanetId: 'p-1' }, expect.any(Object));
  });

  it('closes itself and frames the craft when its row is pressed', async () => {
    rows = [raid];
    const onFocus = vi.fn();
    const onClose = vi.fn();
    host(onFocus, onClose);
    await userEvent.click(screen.getByRole('button', { name: /Kestrel/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('shows every world’s garrison with what is away', async () => {
    host();
    await userEvent.click(screen.getByRole('tab', { name: /at home/i }));
    expect(screen.getByText('Thistle')).toBeInTheDocument();
    expect(screen.getByText('6 away')).toBeInTheDocument();
  });

  /** The count is the door to that world's station, which lives in its Base (2026-09-30). */
  it('opens the Repair Station of the world whose ships wait there', async () => {
    const onOpenRepairStation = vi.fn();
    host(vi.fn(), vi.fn(), onOpenRepairStation);
    await userEvent.click(screen.getByRole('tab', { name: /at home/i }));
    await userEvent.click(screen.getByRole('button', { name: /2 in repair/i }));
    expect(onOpenRepairStation).toHaveBeenCalledWith('p-1');
  });

  /**
   * A WORLD'S NAME TAKES YOU TO IT (owner, 2026-10-07). The page covers the galaxy, so it
   * closes first and the world is framed behind it — the same order a flight row keeps.
   */
  it.each([['At home'], ['Hangar']])('closes itself and frames the world whose name is pressed (%s)', async (view) => {
    const order: string[] = [];
    const onClose = vi.fn(() => { order.push('close'); });
    const onFocusWorld = vi.fn(() => { order.push('focus'); });
    host(vi.fn(), onClose, vi.fn(), onFocusWorld);
    await userEvent.click(screen.getByRole('tab', { name: view }));
    await userEvent.click(screen.getByRole('button', { name: /show thistle in the galaxy/i }));
    expect(onFocusWorld).toHaveBeenCalledWith('p-1');
    expect(order).toEqual(['close', 'focus']);
  });
});
