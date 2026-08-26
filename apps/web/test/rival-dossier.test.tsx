import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import type { GalaxyPlanet, IntelView, PlanetView, RivalSummary } from '../src/api/schemas.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

const NOW = new Date('2026-08-23T12:00:00.000Z');
const target: GalaxyPlanet = {
  id: 'rival-planet', name: 'Orrery-8', owner: 'Sable', position: { x: 100, y: 0, z: 0 },
  coreTier: 2, coreLevel: 6, satellites: [], shielded: false, isSelf: false,
};
const mine: PlanetView = planetView({ buildings: { CORE: 4, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 } });
const intel: IntelView = {
  watching: [], radarLog: [], probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
  probeReports: [{
    targetPlanetId: target.id, targetName: target.name, targetUsername: target.owner,
    at: new Date(NOW.getTime() - 30 * 60_000), accuracy: 0.8, detected: false,
    stock: { low: 100, high: 200 }, deuteriumStock: null,
    defence: { low: 20, high: 50 },
    fleetSize: { low: 2, high: 5 }, fleetHome: true,
  }],
};
const rival: RivalSummary = {
  planetId: target.id,
  playerId: 'rival-player',
  battles: 4,
  attacks: 3,
  defences: 1,
  dominionGained: 820,
  dominionLost: 240,
  lastInteractionAt: new Date(NOW.getTime() - 90 * 60_000),
  lastKnownFleet: { WASP: 5 },
  lastKnownAt: new Date(NOW.getTime() - 90 * 60_000),
};

function show(isRival = false) {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const setRival = vi.spyOn(api, 'setRival').mockImplementation((planetId) => Promise.resolve({
    rivalPlanetId: planetId,
    rivalPlayerId: planetId === null ? null : 'rival-player',
  }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.season, { rivalPlanetId: isRival ? target.id : null });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider>
    </QueryClientProvider>
  );
  render(
    <Wrapper>
      <PlanetFocus
        target={target} planet={mine} intel={intel} reports={[]} rival={rival} isRival={isRival}
        now={NOW.getTime()} onClose={vi.fn()} onAttack={vi.fn()} onInstallTelescope={vi.fn()}
        onLaunched={vi.fn()} open onToggle={vi.fn()}
      />
    </Wrapper>,
  );
  return { client, setRival };
}

describe('Rival dossier', () => {
  it('turns full-season encounters into a short, actionable story', () => {
    show(true);
    expect(screen.getByRole('region', { name: 'Your story this season' })).toBeInTheDocument();
    expect(screen.getByText('4 encounters have made this more than a single raid.')).toBeInTheDocument();
    expect(screen.getByText('+820 · −240')).toBeInTheDocument();
    expect(screen.getByText('Marked rival')).toBeInTheDocument();
  });

  it('marks one rival through the server and updates the existing season cache', async () => {
    const { client, setRival } = show(false);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mark rival' }));
    await waitFor(() => { expect(setRival).toHaveBeenCalledWith(target.id); });
    expect(client.getQueryData<{ rivalPlanetId: string | null }>(keys.season)?.rivalPlanetId).toBe(target.id);
    expect(client.getQueryData<{ rivalPlayerId: string | null }>(keys.season)?.rivalPlayerId).toBe('rival-player');
  });

  it('clears the marker without deleting the encounter history', async () => {
    const { client, setRival } = show(true);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Rival' }));
    await waitFor(() => { expect(setRival).toHaveBeenCalledWith(null); });
    expect(client.getQueryData<{ rivalPlanetId: string | null }>(keys.season)?.rivalPlanetId).toBeNull();
    expect(screen.getByText('4 encounters have made this more than a single raid.')).toBeInTheDocument();
  });
});
