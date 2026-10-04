import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { useClaimReward, usePlanet } from '../src/api/queries.js';
import { useWorld, WorldProvider } from '../src/api/world.js';
import type { PlanetsView, PlanetView } from '../src/api/schemas.js';
import { StatusBar } from '../src/shell/StatusBar.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';
import { AcademyLessonContext } from '../src/onboarding/lessonScope.js';

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

function PlanetReading() {
  const { data } = usePlanet();
  return <output aria-label="stock">{JSON.stringify(data?.planet)}</output>;
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
  it('keeps updated refinery capacities and amounts when an older worlds read arrives', async () => {
    localStorage.clear();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(keys.planets, worlds());
    client.setQueryData(keys.planetById('capital'), capital);
    let finishRead: (data: PlanetsView) => void = () => undefined;
    const olderRead = new Promise<PlanetsView>((resolve) => { finishRead = resolve; });
    const api = new Api({ fetch: () => Promise.reject(new Error('unexpected fetch')) });
    api.planets = vi.fn().mockReturnValue(olderRead);
    render(<QueryClientProvider client={client}><ApiProvider api={api}>
      <WorldProvider><PlanetReading /></WorldProvider>
    </ApiProvider></QueryClientProvider>);
    await waitFor(() => { expect(screen.getByLabelText('stock')).toHaveTextContent('"alloy":500'); });
    act(() => { void client.refetchQueries({ queryKey: keys.planets }); });
    await waitFor(() => { expect(api.planets).toHaveBeenCalledOnce(); });
    const updated = planetView({ buildings: { ...capital.buildings, REFINERY: 2, EXTRACTOR: 2 } }, {
      id: 'capital', alloy: 2400, crystal: 750, alloyCap: 3000, crystalCap: 900,
      bufferAlloyCap: 1500, bufferCrystalCap: 600, alloyPerHour: 150, crystalPerHour: 60,
    });
    act(() => { client.setQueryData(keys.planetById('capital'), updated); });
    await waitFor(() => { expect(screen.getByLabelText('stock')).toHaveTextContent('"alloyCap":3000'); });
    await act(async () => {
      // The list response made before the upgrade also advances a production buffer.
      finishRead(worlds([planetView({}, { id: 'capital', bufferAlloy: 1 }), colony]));
      await olderRead;
    });
    await waitFor(() => { expect(client.getQueryState(keys.planets)?.fetchStatus).toBe('idle'); });
    expect(client.getQueryData(keys.planetById('capital'))).toEqual(updated);
    expect(screen.getByLabelText('stock')).toHaveTextContent('"alloy":2400');
    expect(screen.getByLabelText('stock')).toHaveTextContent('"crystalCap":900');
    expect(screen.getByLabelText('stock')).toHaveTextContent('"bufferAlloyCap":1500');
    expect(screen.getByLabelText('stock')).toHaveTextContent('"crystalPerHour":60');
    client.clear();
  });

  it('keeps a reward claimed into a full store after an already pending worlds read', async () => {
    localStorage.clear();
    const full = planetView({}, { id: 'capital', alloy: 2000, crystal: 600 });
    const paid = planetView({}, { id: 'capital', alloy: 2400, crystal: 750 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(keys.planets, worlds([full, colony]));
    client.setQueryData(keys.planetById('capital'), full);
    let finishRead: (data: PlanetsView) => void = () => undefined;
    const olderRead = new Promise<PlanetsView>((resolve) => { finishRead = resolve; });
    const api = new Api({ fetch: () => Promise.reject(new Error('unexpected fetch')) });
    api.planets = vi.fn().mockReturnValue(olderRead);
    api.claimReward = vi.fn().mockResolvedValue({
      granted: { alloy: 400, crystal: 150, deuterium: 0 },
      rewards: { chains: [], claimable: 0 }, planet: paid,
    });
    render(<QueryClientProvider client={client}><ApiProvider api={api}>
      <WorldProvider><RewardProbe /><PlanetReading /></WorldProvider>
    </ApiProvider></QueryClientProvider>);
    await waitFor(() => { expect(screen.getByLabelText('stock')).toHaveTextContent('"alloy":2000'); });
    act(() => { void client.refetchQueries({ queryKey: keys.planets }); });
    await waitFor(() => { expect(api.planets).toHaveBeenCalledOnce(); });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Claim' }));
    await waitFor(() => { expect(screen.getByLabelText('stock')).toHaveTextContent('"alloy":2400'); });
    await act(async () => { finishRead(worlds([full, colony])); await olderRead; });
    await waitFor(() => { expect(client.getQueryState(keys.planets)?.fetchStatus).toBe('idle'); });
    expect(client.getQueryData<PlanetView>(keys.planetById('capital'))?.planet.alloy).toBe(2400);
    expect(client.getQueryData<PlanetsView>(keys.planets)?.planets[0]?.planet.crystal).toBe(750);
    expect(screen.getByLabelText('stock')).toHaveTextContent('"crystal":750');
    expect(client.getQueryData(keys.planetById('colony'))).toEqual(colony);
    client.clear();
  });

  it('does not show the account menu and signals before they are taught in Academy', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(keys.planet, capital);
    const api = new Api({ fetch: () => Promise.reject(new Error('unexpected fetch')) });
    render(<QueryClientProvider client={client}><ApiProvider api={api}><ToastProvider>
      <AcademyLessonContext.Provider value="core"><StatusBar commander="Academy" onOpen={vi.fn()} onFocusPlanet={vi.fn()} /></AcademyLessonContext.Provider>
    </ToastProvider></ApiProvider></QueryClientProvider>);
    expect(screen.queryByRole('button', { name: /menu|signals/i })).not.toBeInTheDocument();
    expect(screen.getByText('Alloy')).toBeInTheDocument();
  });
  it('focuses the world chosen from the active-world dropdown', async () => {
    localStorage.clear();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(keys.planets, worlds());
    client.setQueryData(keys.planetById('capital'), capital);
    client.setQueryData(keys.planetById('colony'), colony);
    const api = new Api({ fetch: (() => Promise.reject(new Error('unexpected fetch'))) });
    const onFocusPlanet = vi.fn();

    render(
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>
          <WorldProvider>
            <ToastProvider>
              <StatusBar
                commander="Vantage"
                onOpen={vi.fn()}
                onFocusPlanet={onFocusPlanet}
              />
            </ToastProvider>
          </WorldProvider>
        </ApiProvider>
      </QueryClientProvider>,
    );

    const selector = await screen.findByRole('combobox', { name: /active world/i });
    await userEvent.setup().selectOptions(selector, 'colony');

    expect(selector).toHaveValue('colony');
    expect(onFocusPlanet).toHaveBeenCalledOnce();
    expect(onFocusPlanet).toHaveBeenCalledWith('colony');
  });

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
