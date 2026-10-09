import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { monumentsSchema } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { setMonumentHonorees } from '../src/i18n/names.js';
import { MonumentSheet } from '../src/screens/MonumentSheet.js';
import { SeasonLockProvider } from '../src/session/seasonLock.js';
import { planetView } from './fixtures.js';

const id = '00000000-0000-4000-8000-000000000001';
const waveId = '00000000-0000-4000-8000-000000000002';
const lotId = '00000000-0000-4000-8000-000000000003';
const at = new Date().toISOString();
const later = new Date(Date.now() + 3_600_000).toISOString();
const monument = { id, ordinal: 1, position: { x: 6000, y: 0, z: 0 }, controller: { kind: 'NEUTRAL' },
  capacity: 7270, used: 120, reserved: 30, productionPerMinute: 60, emptySince: null };
const catalog = { serverNow: at, monuments: [monument], waves: [], probes: [], probeReports: [] };
const quote = { fuel: 120, arriveAt: later, travelMinutes: 60, room: { used: 120, reserved: 30, total: 7270, after: 200 },
  bays: { used: 1, total: 3 }, shieldWouldDrop: true, outboundForecast: { doseHp: 500, destroyed: 1, fleet: { CITADEL: 1 },
    health: [{ hull: 'CITADEL', count: 2, maxHp: 2000, remainingHp: 1500, damageBp: 2500, remainderBp: 0 }] } };
const cargoLot = { id: lotId, hull: 'ARGOSY', count: 2, damageBp: 2500, remainderBp: 0.125,
  maxHp: 1350, remainingHp: 1012.483125, deuterium: 300, cargoCapacity: 600 };
const held = { id: waveId, monumentId: id, playerId: 'self', originPlanetId: 'home', rootWaveId: null,
  jointOperationId: null, status: 'HOLD', purpose: 'ATTACK', sentAt: at, heldAt: at, arriveAt: null,
  position: monument.position, route: [], tech: {}, fleet: { ARGOSY: 2 }, lots: [cargoLot], deuterium: 300,
  productionPerMinute: 15, fillsAt: later, nextLossAt: later,
  returnForecast: { homePlanetId: 'home', arriveAt: later, minutes: 60, doseHp: 100, destroyed: 0,
    deuterium: 300, lostDeuterium: 0, lots: [cargoLot] } };

function show(view: unknown = catalog, quoteDelay = 0, locked = false) {
  const requests: { path: string; body: string; key: string | null }[] = [];
  const fetch: typeof globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = typeof url === 'string' ? url : url instanceof URL ? url.pathname : url.url;
    const body = typeof init?.body === 'string' ? init.body : '';
    if (init?.method === 'POST') requests.push({ path, body, key: new Headers(init.headers).get('idempotency-key') });
    if (path.endsWith('/quote') && quoteDelay > 0) await new Promise((resolve) => setTimeout(resolve, quoteDelay));
    const result = path.endsWith('/recall/quote') ? { fleet: { ARGOSY: 1 }, deuterium: 150, arriveAt: later, minutes: 60,
      doseHp: 100, destroyed: 0, arrivalDeuterium: 150, lots: [{ ...cargoLot, count: 1, deuterium: 150, cargoCapacity: 300 }], arrivalLots: [] }
      : path.endsWith('/quote') ? quote
        : path.endsWith('/send') ? { wave: { id: waveId, monumentId: id, status: 'OUTBOUND' }, quote }
          : path.endsWith('/recall') ? { wave: { id: waveId, monumentId: id, status: 'RETURNING' } }
            : path.endsWith('/probe') ? { probe: { id: waveId, monumentId: id, status: 'OUTBOUND', departAt: at, arriveAt: later },
              lossProbability: 0.75, price: { alloy: 65, crystal: 40, deuterium: 0 } } : view;
    return new Response(JSON.stringify(result), { status: 200 });
  });
  const api = new Api({ fetch });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const origin = planetView({ fleet: { CITADEL: 2, ARGOSY: 2, PROSPECTOR: 3 } }, { id: 'home', deuterium: 1000 });
  const surface = (isLocked: boolean) => <QueryClientProvider client={client}><ApiProvider api={api}>
    <SeasonLockProvider locked={isLocked}><MonumentSheet monumentId={id} origin={origin} playerId="self" clanId={null} onClose={vi.fn()} /></SeasonLockProvider>
  </ApiProvider></QueryClientProvider>;
  const rendered = render(surface(locked));
  return { requests, client, freeze: () => { rendered.rerender(surface(true)); } };
}
function hold(button: HTMLElement): void { fireEvent.keyDown(button, { key: 'Enter' }); fireEvent.keyDown(button, { key: 'Enter' }); }
const send = (): HTMLElement => within(screen.getByTestId('monument-send')).getByRole('button');

describe('monument decision surface, through the real client and cache', () => {
  it('quotes only the last quantity in a burst and keeps commit disabled during the wait', async () => {
    const { requests } = show();
    const count = await screen.findByRole('textbox', { name: /citadel.*quantity/i });
    fireEvent.change(count, { target: { value: '1' } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    fireEvent.change(count, { target: { value: '2' } });
    expect(send()).toBeDisabled();
    expect(requests.filter((request) => request.path.endsWith('/quote'))).toHaveLength(0);
    await screen.findByText(/Outbound radiation: 500/i);
    expect(requests.filter((request) => request.path.endsWith('/quote'))).toHaveLength(1);
    expect(requests.find((request) => request.path.endsWith('/quote'))?.body).toContain('"CITADEL":2');
  });

  /** Owner, 2026-10-06: the monument carries last season's rank-N name, and the sheet says why. */
  it('says whose name the monument carries, and why', async () => {
    setMonumentHonorees(['Vantasia', null, null, null, null]);
    try {
      show();
      await screen.findByText('Named for Vantasia, rank 1 last season.');
      const sheet = screen.getByRole('dialog');
      expect(sheet).toHaveTextContent('Vantasia • Abandoned Space Wreckage');
      expect(sheet).toHaveTextContent('Named for Vantasia, rank 1 last season.');
    } finally {
      setMonumentHonorees([]);
    }
  });

  it('identifies an empty monument and shows the garrison return time', async () => {
    show({ ...catalog, monuments: [{ ...monument, used: 0, emptySince: at, respawnAt: later }] });
    await screen.findByText(/Garrison returns/i);
    expect(screen.getByRole('dialog')).toHaveTextContent('Unoccupied');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Neutral garrison');
  });

  it('stops selected recall quote POSTs when the open season freezes and physical lots refresh', async () => {
    const { requests, client, freeze } = show({ ...catalog, waves: [held] });
    const count = await screen.findByRole('textbox', { name: /argosy.*recall/i });
    fireEvent.change(count, { target: { value: '1' } });
    await screen.findByTestId('monument-recall-forecast');
    const before = requests.filter(request => request.path.endsWith('/recall/quote')).length;
    freeze();
    client.setQueryData(keys.monuments, monumentsSchema.parse({ ...catalog, waves: [{ ...held, deuterium: 301, lots: [{ ...cargoLot, deuterium: 301 }] }] }));
    await waitFor(() => expect(screen.getByTestId(`monument-wave-${waveId}`)).toHaveTextContent(/301/));
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(requests.filter(request => request.path.endsWith('/recall/quote'))).toHaveLength(before);
    expect(count).toBeDisabled();
  });
  it('keeps the frozen monument readable and disables every mutation', async () => {
    show({ ...catalog, waves: [held] }, 0, true);
    await screen.findByText(/7,270/);
    const probe = screen.getByTestId('monument-probe');
    expect(within(probe).getByRole('button', { name: /hold.*probe/i })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /citadel.*quantity/i })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /argosy.*recall/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /close/i })).toBeEnabled();
  });
  it('shows shared capacity, production purpose and the enemy intelligence gap before committing', async () => {
    show();
    expect(await screen.findByText(/7,270/)).toBeInTheDocument();
    expect(screen.getByText(/60.*deuterium.*minute/i)).toBeInTheDocument();
    expect(screen.getByText(/enemy fleet.*probe/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /prospector/i })).toBeNull();
    expect(send()).toBeDisabled();
  });
  it('automatically quotes the picked fleet and requires both explicit consents', async () => {
    const { requests, client } = show();
    await screen.findByRole('textbox', { name: /citadel.*quantity/i });
    fireEvent.change(screen.getByRole('textbox', { name: /citadel.*quantity/i }), { target: { value: '2' } });
    await screen.findByText(/Outbound radiation: 500/i);
    expect(send()).toBeDisabled();
    expect(screen.getByText(/1.*ship.*lost.*outbound/i)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: /shield/i }));
    expect(send()).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /radiation/i }));
    expect(send()).toBeEnabled();
    hold(send());
    await waitFor(() => { expect(requests.filter((request) => request.path.endsWith('/send'))).toHaveLength(1); });
    const request = requests.find((entry) => entry.path.endsWith('/send'));
    expect(request?.body).toBe(JSON.stringify({ originPlanetId: 'home', purpose: 'ATTACK', fleet: { CITADEL: 2 },
      acknowledgeShieldLoss: true, acknowledgeRadiationLoss: true }));
    expect(request?.key).toBeTruthy();
    await waitFor(() => { expect(client.getQueryState(keys.planet)?.isInvalidated ?? true).toBe(true); });
  });
  it('disables commit while a changed fleet is still being quoted', async () => {
    show(catalog, 150);
    const count = await screen.findByRole('textbox', { name: /citadel.*quantity/i });
    fireEvent.change(count, { target: { value: '1' } });
    await screen.findByText(/Outbound radiation: 500/i);
    fireEvent.change(count, { target: { value: '2' } });
    expect(send()).toBeDisabled();
    expect(screen.queryByText(/Outbound radiation: 500/i)).toBeNull();
  });
  it('selects a physical cargo cohort partially and quotes the cargo and arrival before recall', async () => {
    const { requests } = show({ ...catalog, waves: [held] });
    const card = await screen.findByTestId(`monument-wave-${waveId}`);
    expect(card).toHaveTextContent(/300.*600/);
    expect(card).toHaveTextContent(/75.*%/);
    fireEvent.change(within(card).getByRole('textbox', { name: /argosy.*recall/i }), { target: { value: '1' } });
    await waitFor(() => { expect(within(card).getByTestId('monument-recall-forecast')).toHaveTextContent(/150/); });
    hold(within(card).getByRole('button', { name: /hold.*recall/i }));
    await waitFor(() => { expect(requests.find((entry) => entry.path.endsWith('/recall'))?.body)
      .toBe(JSON.stringify({ selections: [{ lotId, count: 1 }] })); });
    expect(requests.find((entry) => entry.path.endsWith('/recall'))?.key).toBeTruthy();
  });
  it('discloses the 75% probe loss and its price before the held action', async () => {
    const { requests } = show();
    await screen.findByText(/7,270/);
    const probe = await screen.findByTestId('monument-probe');
    expect(probe).toHaveTextContent(/75%/);
    expect(probe).toHaveTextContent(/65/);
    expect(probe).toHaveTextContent(/40/);
    hold(within(probe).getByRole('button', { name: /hold.*probe/i }));
    await waitFor(() => { expect(requests.find((entry) => entry.path.endsWith('/probe'))?.body)
      .toBe(JSON.stringify({ originPlanetId: 'home' })); });
  });
  it.each(['en', 'tr', 'de', 'fr', 'es', 'ja'] as const)('discloses the current probe loss before launch in %s', async (language) => {
    await i18n.changeLanguage(language);
    show();
    const probe = await screen.findByTestId('monument-probe');
    expect(probe).toHaveTextContent(language === 'tr' ? /%75/ : /75\s?%/);
    expect(probe).not.toHaveTextContent(/90|\{\{/);
  });
  it('gives a second intentional probe a new confirmation identity', async () => {
    const { requests } = show();
    await screen.findByText(/7,270/);
    const button = within(screen.getByTestId('monument-probe')).getByRole('button', { name: /hold.*probe/i });
    hold(button);
    await waitFor(() => { expect(requests.filter((request) => request.path.endsWith('/probe'))).toHaveLength(1); });
    await waitFor(() => { expect(button).toBeEnabled(); });
    hold(button);
    await waitFor(() => { expect(requests.filter((request) => request.path.endsWith('/probe'))).toHaveLength(2); });
    const probes = requests.filter((request) => request.path.endsWith('/probe'));
    expect(probes[1]?.key).not.toBe(probes[0]?.key);
  });
  it('uses reinforcement for its own controller and leaves a returning wave read-only', async () => {
    const { requests } = show({ ...catalog, monuments: [{ ...monument, controller: { kind: 'PLAYER', playerId: 'self', name: 'Me' } }],
      waves: [{ ...held, status: 'RETURNING', arriveAt: later }] });
    const count = await screen.findByRole('textbox', { name: /citadel.*quantity/i });
    fireEvent.change(count, { target: { value: '1' } });
    await waitFor(() => { expect(requests.find((entry) => entry.path.endsWith('/quote'))?.body).toContain('REINFORCE'); });
    const card = screen.getByTestId(`monument-wave-${waveId}`);
    expect(within(card).queryByRole('textbox', { name: /recall/i })).toBeNull();
  });
});
