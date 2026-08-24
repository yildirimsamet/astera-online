import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { useClaimReward } from '../src/api/queries.js';
import { useWorld, WorldProvider } from '../src/api/world.js';
import type { PlanetsView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

const capital = planetView({}, { id: 'capital', name: 'Origin' });
const colony = planetView({}, { id: 'colony', name: 'Haven' });
const worlds = (planets = [capital, colony]): PlanetsView => ({
  playerId: 'player-1',
  seasonId: 'season-1',
  capitalPlanetId: 'capital',
  planets,
});

function Probe() {
  const world = useWorld();
  return (
    <div>
      <output aria-label="active">{world.activePlanetId}</output>
      <button type="button" onClick={() => { world.selectPlanet('colony'); }}>Colony</button>
    </div>
  );
}

function RewardProbe() {
  const world = useWorld();
  const claim = useClaimReward();
  return (
    <div>
      <output aria-label="active">{world.activePlanetId}</output>
      <button type="button" onClick={() => { claim.mutate('CORE:3'); }}>Claim</button>
    </div>
  );
}

const show = (data = worlds()) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.planets, data);
  const api = new Api({ fetch: (() => Promise.reject(new Error('unexpected fetch'))) });
  render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <WorldProvider><Probe /></WorldProvider>
      </ApiProvider>
    </QueryClientProvider>,
  );
  return client;
};

describe('commander world selection', () => {
  it('persists selection under the season and commander and primes isolated caches', async () => {
    localStorage.clear();
    const client = show();
    await waitFor(() => expect(screen.getByLabelText('active')).toHaveTextContent('capital'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Colony' }));
    expect(screen.getByLabelText('active')).toHaveTextContent('colony');
    expect(localStorage.getItem('astera:world:v1:season-1:player-1')).toBe('colony');
    expect(client.getQueryData(keys.planetById('capital'))).toEqual(capital);
    expect(client.getQueryData(keys.planetById('colony'))).toEqual(colony);
  });

  it('falls back to capital and repairs persistence when the selected colony is lost', async () => {
    localStorage.setItem('astera:world:v1:season-1:player-1', 'colony');
    const client = show();
    await waitFor(() => expect(screen.getByLabelText('active')).toHaveTextContent('colony'));
    act(() => { client.setQueryData(keys.planets, worlds([capital])); });
    await waitFor(() => expect(screen.getByLabelText('active')).toHaveTextContent('capital'));
    expect(localStorage.getItem('astera:world:v1:season-1:player-1')).toBe('capital');
  });

  it('does not write a capital-only reward response into the selected colony cache', async () => {
    localStorage.setItem('astera:world:v1:season-1:player-1', 'colony');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(keys.planets, worlds());
    const claimReward = vi.fn().mockResolvedValue({
      granted: { alloy: 100, crystal: 0, deuterium: 0 },
      rewards: { chains: [], claimable: 0 },
      planet: capital,
    });
    const api = { planets: vi.fn(), claimReward } as unknown as Api;

    render(
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>
          <WorldProvider><RewardProbe /></WorldProvider>
        </ApiProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(screen.getByLabelText('active')).toHaveTextContent('colony'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Claim' }));
    await waitFor(() => { expect(claimReward).toHaveBeenCalledOnce(); });
    expect(client.getQueryData(keys.planetById('colony'))).toEqual(colony);
    expect(client.getQueryData(keys.planetById('capital'))).toEqual(capital);
  });
});
