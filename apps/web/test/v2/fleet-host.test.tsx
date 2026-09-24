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
};

vi.mock('../../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/api/queries.js');
  return {
    ...actual,
    usePending: () => ({ data: { pending: rows } }),
    useMining: () => ({ data: { runs } }),
    useTraffic: () => ({ data: { contacts: [] } }),
    usePlanet: () => ({ data: withRoom }),
    useRecallMining: () => ({ mutate: recallMining, isPending: false }),
    useRecallFlight: () => ({ mutate: recallFlight, isPending: false }),
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

const host = (onFocus = vi.fn(), onClose = vi.fn()) => render(
  <ToastProvider>
    <FleetHost onFocus={onFocus} onClose={onClose} />
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
});
