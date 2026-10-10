import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import type { PlanetsView } from '../src/api/schemas.js';
import { WorldProvider, useWorld } from '../src/api/world.js';
import { ColonyAbandonment } from '../src/screens/ColonyAbandonment.js';
import { ToastProvider } from '../src/ui/Toast.js';
import i18n from '../src/i18n/index.js';
import { describeNotification, isAlarming, isUrgent, signalFamily, signalOutcome } from '../src/lib/notifications.js';
import { planetView } from './fixtures.js';

const colonyId = '00000000-0000-4000-8000-000000000003';
const homeId = '00000000-0000-4000-8000-000000000001';
const colony = planetView({}, { id: colonyId, name: 'Haven', kind: 'COLONY' });
const capital = planetView({}, { id: homeId, name: 'Kestrel', kind: 'CAPITAL' });
let reasons: string[];
let failSubmit: boolean;
let checkGate: Promise<void> | null;
let submitGate: Promise<void> | null;
let cache: QueryClient;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});
const posts = () => fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
const confirm = () => screen.getByRole('button', { name: 'Yes, abandon colony' });
function ActiveWorld() {
  return <output data-testid="active-world">{useWorld().activePlanetId}</output>;
}
function ManagedWorld() {
  const { activePlanetId, worlds } = useWorld();
  const selected = worlds.find(world => world.planet.id === activePlanetId);
  return selected ? <ColonyAbandonment planet={selected} /> : null;
}
const renderDoor = (world = colony) => {
  const api = new Api({ fetch: fetcher });
  const tree = (next = world) => (
    <ApiProvider api={api}><QueryClientProvider client={cache}><ToastProvider>
      <ColonyAbandonment planet={next} />
    </ToastProvider></QueryClientProvider></ApiProvider>
  );
  return { ...render(tree()), tree };
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  reasons = [];
  failSubmit = false;
  checkGate = null;
  submitGate = null;
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  cache.setQueryData(keys.planets, { playerId: 'owner', seasonId: 'season', capitalPlanetId: homeId, planets: [capital, colony] });
  cache.setQueryData(keys.planetById(colonyId), colony);
  cache.setQueryData(keys.skins, { ownedSkinIds: [], planets: [{ id: colonyId, name: 'Haven', skinId: null }] });
  fetcher = vi.fn<typeof fetch>(async (_url, init) => {
    if (init?.method === 'POST') {
      await submitGate;
      return failSubmit
        ? json({ error: 'COLONY_ABANDON_BLOCKED', message: 'Cannot abandon', params: { reason: 'MINING' } }, 409)
        : json({ abandonedPlanetId: colonyId, capital });
    }
    await checkGate;
    return json({ planetId: colonyId, allowed: reasons.length === 0, reasons });
  });
});

describe('colony abandonment confirmation', () => {
  it('describes a voluntary abandonment separately from loyalty secession', () => {
    const notice = { id: 'notice', kind: 'colony_lost', seen: false, at: new Date(),
      refId: null, payload: { planetId: colonyId, planetName: 'Haven', cause: 'ABANDONED' } };
    expect(describeNotification(notice, Date.now()))
      .toBe('You abandoned Haven · the colony is now neutral');
    expect(isUrgent(notice)).toBe(false);
    expect(isAlarming(notice)).toBe(false);
    expect(signalFamily(notice)).toBe('note');
    expect(signalOutcome(notice)).toBe('neutral');
  });

  it.each([undefined, 'SECESSION', 'UNKNOWN'])('keeps involuntary or unrecognised colony loss alarming: %s', cause => {
    const notice = { id: 'notice', kind: 'colony_lost', seen: false, at: new Date(),
      refId: null, payload: { planetName: 'Haven', ...(cause ? { cause } : {}) } };
    expect(isUrgent(notice)).toBe(true);
    expect(isAlarming(notice)).toBe(true);
    expect(signalFamily(notice)).toBe('threat');
    expect(signalOutcome(notice)).toBe('loss');
  });
  it('only offers abandonment for a colony', () => {
    renderDoor(capital);
    expect(screen.queryByRole('button', { name: 'Abandon colony' })).not.toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('opens a named confirmation and explains losses before submitting', async () => {
    renderDoor();
    await userEvent.click(screen.getByRole('button', { name: 'Abandon colony' }));
    const sheet = await screen.findByRole('dialog', { name: 'Abandon this colony?' });
    expect(within(sheet).getByText('Haven')).toBeInTheDocument();
    expect(within(sheet).getByText(/buildings, satellites, resources and ground defences stay/i)).toBeInTheDocument();
    expect(within(sheet).getByText(/ready death stars and interceptor charges also stay/i)).toBeInTheDocument();
    expect(within(sheet).getByText(/ships at home and in repair move to your capital/i)).toBeInTheDocument();
    expect(within(sheet).getByText(/cancelled without a refund/i)).toBeInTheDocument();
    expect(within(sheet).getByText(/cannot undo/i)).toBeInTheDocument();
    await waitFor(() => { expect(confirm()).toBeEnabled(); });
    expect(posts()).toHaveLength(0);
  });

  it('cancel and Escape close the confirmation without abandoning', async () => {
    renderDoor();
    await userEvent.click(screen.getByRole('button', { name: 'Abandon colony' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep colony' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Abandon colony' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });

  it('cannot confirm before the server check finishes', async () => {
    let release: () => void = () => undefined;
    checkGate = new Promise<void>(resolve => { release = resolve; });
    renderDoor();
    await userEvent.click(screen.getByRole('button', { name: 'Abandon colony' }));
    expect(confirm()).toBeDisabled();
    expect(screen.getByText('Checking active missions…')).toBeInTheDocument();
    await userEvent.click(confirm());
    expect(posts()).toHaveLength(0);
    await act(async () => { release(); await checkGate; });
    await waitFor(() => { expect(confirm()).toBeEnabled(); });
  });

  it('lists every blocker, keeps the action disabled and lets the player check again', async () => {
    reasons = ['CLAN_SUPPORT', 'MINING', 'FLIGHT'];
    renderDoor();
    await userEvent.click(screen.getByRole('button', { name: 'Abandon colony' }));
    expect(await screen.findByText(/support ships are travelling, stationed or returning/i)).toBeInTheDocument();
    expect(screen.getByText(/mining or salvage mission is still active/i)).toBeInTheDocument();
    expect(screen.getByText(/flight connected to this colony is still active/i)).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
    reasons = [];
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    await waitFor(() => { expect(confirm()).toBeEnabled(); });
    expect(posts()).toHaveLength(0);
  });

  it('shows a new blocker returned by the POST and keeps the confirmation open', async () => {
    failSubmit = true;
    renderDoor();
    await userEvent.click(screen.getByRole('button', { name: 'Abandon colony' }));
    await waitFor(() => { expect(confirm()).toBeEnabled(); });
    reasons = ['MINING'];
    await userEvent.click(confirm());
    expect(await screen.findByText(/mining or salvage mission is still active/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
    expect(posts()).toHaveLength(1);
  });

  it('disables repeat submissions and removes the abandoned colony only after success', async () => {
    let release: () => void = () => undefined;
    submitGate = new Promise<void>(resolve => { release = resolve; });
    renderDoor();
    await userEvent.click(screen.getByRole('button', { name: 'Abandon colony' }));
    await waitFor(() => { expect(confirm()).toBeEnabled(); });
    await userEvent.click(confirm());
    expect(screen.getByRole('button', { name: 'Abandoning…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Keep colony' })).toBeDisabled();
    expect(cache.getQueryData(keys.planetById(colonyId))).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Abandoning…' }));
    expect(posts()).toHaveLength(1);
    expect(posts()[0]?.[1]?.body).toBe(JSON.stringify({ confirm: true }));
    await act(async () => { release(); await submitGate; });
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); });
    expect(cache.getQueryData(keys.planetById(colonyId))).toBeUndefined();
    expect(cache.getQueryData<PlanetsView>(keys.planets)?.planets.map(world => world.planet.id)).toEqual([homeId]);
    expect(cache.getQueryData(keys.planetById(homeId))).toMatchObject({ planet: { id: homeId } });
    expect(cache.getQueryState(keys.skins)?.isInvalidated).toBe(true);
  });

  it('network failure never enables abandonment and remains visible in the sheet', async () => {
    fetcher.mockRejectedValue(new TypeError('offline'));
    renderDoor();
    await userEvent.click(screen.getByRole('button', { name: 'Abandon colony' }));
    expect(await screen.findByText(/could not check/i)).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
  });

  it('disables confirmation when a fresh check fails after an earlier successful check', async () => {
    renderDoor();
    await userEvent.click(screen.getByRole('button', { name: 'Abandon colony' }));
    await waitFor(() => { expect(confirm()).toBeEnabled(); });
    fetcher.mockRejectedValue(new TypeError('offline'));
    await act(async () => {
      await cache.refetchQueries({ queryKey: ['colony-abandonment', colonyId] });
    });
    expect(await screen.findByText(/could not check/i)).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
    expect(posts()).toHaveLength(0);
  });

  it('returns the real world selector to the capital and cancels a stale list read', async () => {
    const storageKey = 'astera:world:v1:season:owner';
    localStorage.setItem(storageKey, colonyId);
    const api = new Api({ fetch: fetcher });
    render(<ApiProvider api={api}><QueryClientProvider client={cache}>
      <WorldProvider><ToastProvider><ActiveWorld /><ManagedWorld /></ToastProvider></WorldProvider>
    </QueryClientProvider></ApiProvider>);
    await waitFor(() => { expect(screen.getByTestId('active-world')).toHaveTextContent(colonyId); });
    const staleList = cache.getQueryData(keys.planets);
    let release: () => void = () => undefined;
    const delayed = new Promise<void>(resolve => { release = resolve; });
    const oldRead = cache.fetchQuery({ queryKey: keys.planets, queryFn: async () => {
      await delayed;
      return staleList;
    } }).catch(() => undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Abandon colony' }));
    await waitFor(() => { expect(confirm()).toBeEnabled(); });
    await userEvent.click(confirm());
    await waitFor(() => { expect(screen.getByTestId('active-world')).toHaveTextContent(homeId); });
    await act(async () => { release(); await oldRead; });
    expect(localStorage.getItem(storageKey)).toBe(homeId);
    expect(cache.getQueryData<PlanetsView>(keys.planets)?.planets.map(world => world.planet.id)).toEqual([homeId]);
    expect(cache.getQueryData(keys.planetById(colonyId))).toBeUndefined();
    expect(screen.getByText('You abandoned Haven · the colony is now neutral')).toBeInTheDocument();
    localStorage.removeItem(storageKey);
  });

  it('reconciles ownership if the server commits abandonment but its POST response is lost', async () => {
    const storageKey = 'astera:world:v1:season:owner';
    localStorage.setItem(storageKey, colonyId);
    let committed = false;
    fetcher.mockImplementation((input, init) => {
      if (init?.method === 'POST') {
        committed = true;
        return Promise.reject(new TypeError('connection dropped after commit'));
      }
      const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (path.endsWith('/api/planets')) {
        return Promise.resolve(json({ playerId: 'owner', seasonId: 'season', capitalPlanetId: homeId,
          planets: committed ? [capital] : [capital, colony] }));
      }
      return Promise.resolve(json({ planetId: colonyId, allowed: true, reasons: [] }));
    });
    render(<ApiProvider api={new Api({ fetch: fetcher })}><QueryClientProvider client={cache}>
      <WorldProvider><ToastProvider><ActiveWorld /><ManagedWorld /></ToastProvider></WorldProvider>
    </QueryClientProvider></ApiProvider>);
    await waitFor(() => { expect(screen.getByTestId('active-world')).toHaveTextContent(colonyId); });
    await userEvent.click(screen.getByRole('button', { name: 'Abandon colony' }));
    await waitFor(() => { expect(confirm()).toBeEnabled(); });
    await userEvent.click(confirm());
    await waitFor(() => { expect(screen.getByTestId('active-world')).toHaveTextContent(homeId); });
    expect(posts()).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(storageKey)).toBe(homeId);
    localStorage.removeItem(storageKey);
  });

  it('changing the managed world closes its old confirmation', async () => {
    const view = renderDoor();
    await userEvent.click(screen.getByRole('button', { name: 'Abandon colony' }));
    await waitFor(() => { expect(confirm()).toBeEnabled(); });
    view.rerender(view.tree(planetView({}, { id: '00000000-0000-4000-8000-000000000004', name: 'Orlo', kind: 'COLONY' })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });
});
