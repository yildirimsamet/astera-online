import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { combatValue, type Fleet } from '@astera/rules';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { IntergalacticConvoySheet } from '../src/screens/IntergalacticConvoySheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { IntergalacticConvoyEvent } from '../src/lib/intergalacticConvoy.js';
import { planetView } from './fixtures.js';
import { full } from '../src/lib/format.js';

const START = new Date('2026-09-11T21:00:00.000Z');
const NOW = new Date('2026-09-12T16:10:00.000Z');
const event: IntergalacticConvoyEvent = {
  id: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11',
  kind: 'INTERGALACTIC_CONVOY',
  startsAt: new Date('2026-09-12T16:00:00.000Z'),
  endsAt: new Date('2026-09-12T18:00:00.000Z'),
  appearsAtMinute: 1140,
  expiresAtMinute: 1260,
  route: {
    from: { x: -2000, y: 0, z: 0 },
    to: { x: 2000, y: 0, z: 0 },
    velocity: { x: 100 / 3, y: 0, z: 0 },
    speed: 100 / 3,
  },
  visual: { formationVersion: 1 },
  rewardPolicy: {
    resourceCapHours: 4,
    fullRewardForceRatio: 1,
    shipDropFullFirepower: 5780,
    shipDropChanceAtFullQuality: 0.15,
    maxAwardedShips: 3,
  },
};

describe('the intergalactic convoy commitment surface', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function openSheet(fleet: Fleet = { DART: 12 }) {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    const launch = vi.fn().mockRejectedValue(new Error('test stop after request'));
    const api = { launchIntergalacticConvoy: launch } as unknown as Api;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>
          <ToastProvider>{children}</ToastProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
    const world = planetView({
      fleet,
      buildings: {
        CORE: 3,
        REFINERY: 3,
        EXTRACTOR: 3,
        VAULT: 0,
        SHIPYARD: 2,
        DEUTERIUM_PLANT: 2,
      },
      convoyLaunchLocked: false,
      flight: { used: 0, total: 3 },
    }, {
      position: { x: 0, y: 300, z: 0 },
      deuterium: 100_000,
    });

    render(
      <IntergalacticConvoySheet
        event={event}
        seasonStart={START}
        planet={world}
        onClose={() => undefined}
        onLaunched={() => undefined}
      />,
      { wrapper },
    );
    return launch;
  }

  it('keeps the selected fleet while committing the exact quote with one key', async () => {
    const launch = openSheet();
    fireEvent.click(screen.getByRole('button', { name: /Send every Dart/i }));
    expect(screen.getByText('Firepower').nextSibling).toHaveTextContent(/[1-9]/);
    // The column names the cap the occurrence carries, not a figure baked into copy.
    expect(screen.getByText('4h cap')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('convoy-review'));
    fireEvent.click(screen.getByTestId('convoy-confirm'));

    await waitFor(() => { expect(launch).toHaveBeenCalledTimes(1); });
    const [input, key] = launch.mock.calls[0] as [
      { fleet: { DART?: number }; quotedAt: Date; quotedArriveAt: Date; quotedFlightSeconds: number },
      string,
    ];
    expect(input.fleet.DART).toBe(12);
    expect(input.quotedAt).toEqual(NOW);
    expect(Math.abs(
      input.quotedArriveAt.getTime()
        - input.quotedAt.getTime()
        - input.quotedFlightSeconds * 1000,
    )).toBeLessThan(1);
    expect(key.length).toBeGreaterThanOrEqual(8);
  });

  it('recalculates after Max and minus, including removing a hull from a mixed wing', async () => {
    const launch = openSheet({ DART: 2, PIKE: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Send every Dart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send every Pike' }));
    fireEvent.click(screen.getByTestId('convoy-review'));

    fireEvent.click(screen.getByRole('button', { name: 'Send fewer Dart' }));
    expect(screen.queryByTestId('convoy-confirm')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Dart quantity' })).toHaveValue('1');
    expect(screen.getByText('Firepower').nextSibling).toHaveTextContent(
      full(combatValue({ DART: 1, PIKE: 3 })),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send fewer Dart' }));
    expect(screen.getByRole('textbox', { name: 'Dart quantity' })).toHaveValue('0');
    expect(screen.getByTestId('convoy-review')).toBeEnabled();
    expect(screen.getByText('Firepower').nextSibling).toHaveTextContent(
      full(combatValue({ PIKE: 3 })),
    );
    fireEvent.click(screen.getByTestId('convoy-review'));
    fireEvent.click(screen.getByTestId('convoy-confirm'));
    await waitFor(() => { expect(launch).toHaveBeenCalledTimes(1); });
    expect(launch.mock.calls[0]?.[0]).toHaveProperty('fleet', { PIKE: 3 });
  });

  it.each(['0', ''])('can clear a selected hull by entering %j and select it again', (value) => {
    openSheet({ DART: 2, PIKE: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Send every Dart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send every Pike' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Dart quantity' }), {
      target: { value },
    });
    expect(screen.getByTestId('convoy-review')).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Send more Dart' }));
    expect(screen.getByRole('textbox', { name: 'Dart quantity' })).toHaveValue('1');
    expect(screen.getByTestId('convoy-review')).toBeEnabled();
  });

  it('requires a wing after removing every ship and firepower when only transports remain', () => {
    openSheet({ DART: 1, COURIER: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Send every Dart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send fewer Dart' }));
    expect(screen.getByTestId('convoy-review')).toBeDisabled();
    expect(screen.getByTestId('convoy-review')).toHaveTextContent('Choose a strike wing');
    fireEvent.click(screen.getByRole('button', { name: 'Send every Courier' }));
    expect(screen.getByTestId('convoy-review')).toBeDisabled();
    expect(screen.getByTestId('convoy-review')).toHaveTextContent('Send at least one armed ship');
    fireEvent.click(screen.getByRole('button', { name: 'Send more Dart' }));
    expect(screen.getByTestId('convoy-review')).toBeEnabled();
  });
});
