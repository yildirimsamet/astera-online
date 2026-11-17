import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { MonumentSheet } from '../src/screens/MonumentSheet.js';
import { planetView } from './fixtures.js';

/**
 * THE MONUMENT IS A TARGET, NOT A TABLE (owner 2026-11-17: "Anıt'a focus olunca çıkan sheet'i UX
 * açısından incele" → "onaylıyorum düzelt"). The sheet ran ~3.7 screens in one column, the known
 * garrison 2,000 px from the ships picked against it, the flight priced in twenty lines and two
 * consent switches before the hold. Now: the monument's portrait and its facts on one card, then
 * three pages — Target (what holds it and the probe that tells you), Attack/Reinforce (the ships,
 * beside what they will meet, priced in four plates, the risks said over the hold) and Your fleets.
 */
const id = '00000000-0000-4000-8000-000000000001';
const waveId = '00000000-0000-4000-8000-000000000002';
const lotId = '00000000-0000-4000-8000-000000000003';
const at = new Date().toISOString();
const later = new Date(Date.now() + 3_600_000).toISOString();
const monument = { id, ordinal: 2, position: { x: 6000, y: 0, z: 0 }, controller: { kind: 'PLAYER', playerId: 'rival', name: 'Kestrel' },
  capacity: 7270, used: 2410, reserved: 300, productionPerMinute: 60, emptySince: null, difficulty: 'HARD', radiationHpPerMinute: 5 };
const lot = { id: lotId, hull: 'ARGOSY', count: 2, damageBp: 2500, remainderBp: 0, maxHp: 1350, remainingHp: 1012.5, deuterium: 300, cargoCapacity: 600 };
const held = { id: waveId, monumentId: id, playerId: 'self', originPlanetId: 'home', rootWaveId: null, jointOperationId: null,
  status: 'HOLD', purpose: 'ATTACK', sentAt: at, heldAt: at, arriveAt: null, position: monument.position, route: [], tech: {},
  fleet: { ARGOSY: 2 }, lots: [lot], deuterium: 300, productionPerMinute: 15, fillsAt: later, nextLossAt: later,
  returnForecast: { homePlanetId: 'home', arriveAt: later, minutes: 60, doseHp: 100, destroyed: 0, deuterium: 300, lostDeuterium: 0, lots: [lot], fuelRefund: 42 } };
const report = { id: 'r1', monumentId: id, observedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  deliveredAt: new Date(Date.now() - 110 * 60_000).toISOString(), fleet: { CITADEL: 12, PIKE: 40 }, accuracy: 1 };
const catalog = { serverNow: at, monuments: [monument], waves: [], probes: [], probeReports: [] };
const quote = { fuel: 920, outboundFuel: 120, returnFuelReserve: 800, arriveAt: later, travelMinutes: 60,
  room: { used: 2410, reserved: 300, total: 7270, after: 2500 }, bays: { used: 2, total: 5 }, shieldWouldDrop: true,
  outboundForecast: { doseHp: 240, destroyed: 1, fleet: { CITADEL: 1 },
    health: [{ hull: 'CITADEL', count: 2, maxHp: 2000, remainingHp: 1760, damageBp: 1200, remainderBp: 0 }] } };

function show(view: unknown = catalog, galaxy?: unknown) {
  const requests: { path: string; body: string }[] = [];
  const fetch: typeof globalThis.fetch = vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const path = typeof url === 'string' ? url : url instanceof URL ? url.pathname : url.url;
    if (init?.method === 'POST') requests.push({ path, body: typeof init.body === 'string' ? init.body : '' });
    const result = path.endsWith('/api/commander-ship') ? { capitalPlanetId: 'home', rulesetVersion: 18, ship: null }
      : path.endsWith('/recall/quote') ? { fleet: { ARGOSY: 1 }, deuterium: 150, arriveAt: later, minutes: 60, doseHp: 100, destroyed: 0,
        arrivalDeuterium: 150, lots: [lot], arrivalLots: [], fuelRefund: 83.75 }
        : path.endsWith('/quote') ? quote
          : path.endsWith('/send') ? { wave: { id: waveId, monumentId: id, status: 'OUTBOUND' }, quote }
            : path.includes('galaxy') ? new Promise<never>(() => undefined) : view;
    return Promise.resolve(result).then((body) => new Response(JSON.stringify(body), { status: 200 }));
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(['season'], { honorSoloCredit: false });
  if (galaxy) client.setQueryData(['galaxy'], galaxy);
  const origin = planetView({ fleet: { CITADEL: 2, ARGOSY: 2 } }, { id: 'home', deuterium: 5000 });
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}>
    <MonumentSheet monumentId={id} origin={origin} playerId="self" clanId={null} onClose={vi.fn()} onClanTarget={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
  return { requests };
}
const pages = () => screen.getByRole('tablist', { name: 'Monument pages' });
const page = async (name: RegExp | string) => { await userEvent.setup().click(within(pages()).getByRole('tab', { name })); };
const hold = (button: HTMLElement): void => { fireEvent.keyDown(button, { key: 'Enter' }); fireEvent.keyDown(button, { key: 'Enter' }); };

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('the monument card', () => {
  it('shows the monument itself beside its facts, and its room as a bar', async () => {
    show();
    const facts = await screen.findByTestId('monument-target');
    expect(facts.querySelector('img[data-monument-portrait]')).toHaveAttribute('src', '/assets/images/monuments/abandoned-station-v1.webp');
    const room = within(facts).getByRole('progressbar', { name: /room/i });
    expect(room).toHaveAttribute('aria-valuenow', '2710');
    expect(room).toHaveAttribute('aria-valuemax', '7270');
  });

  it('speaks of tiers as “kademe” in Turkish', async () => {
    await i18n.changeLanguage('tr');
    show();
    const facts = await screen.findByTestId('monument-target');
    expect(facts).toHaveTextContent(/Kademe 4/);
    expect(facts).not.toHaveTextContent(/Tier/);
  });

  it('draws no radiation fold while nothing bombs the monument, and one while something does', async () => {
    show();
    await screen.findByTestId('monument-target');
    expect(document.querySelector('[data-monument-radiation]')).toBeNull();
  });

  it('folds the bomb’s radiation when one targets it', async () => {
    show(catalog, { you: { planetId: 'home', playerId: 'self' }, planets: [], sensors: [], radiation: [],
      hpRadiation: [{ id: 'bomb', mode: 'EMIT', center: { x: 6000, y: 0, z: 0 }, radius: 1500, intensityHpPerMinute: 12.5,
        activeFrom: new Date(0), activeUntil: null, target: { kind: 'MONUMENT', id } }] });
    await screen.findByTestId('monument-target');
    expect(document.querySelector('[data-monument-radiation]')).not.toBeNull();
  });
});

describe('three pages', () => {
  it('opens on Attack when no fleet of yours is there, with no fleets page', async () => {
    show();
    await screen.findByTestId('monument-target');
    expect(within(pages()).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Target', 'Attack']);
    expect(within(pages()).getByRole('tab', { name: 'Attack' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: /citadel.*quantity/i })).toBeInTheDocument();
    expect(screen.getByTestId('monument-send')).toBeInTheDocument();
  });

  it('opens on Your fleets when one holds there; the send hold stays on its own page', async () => {
    show({ ...catalog, waves: [held] });
    await screen.findByTestId(`monument-wave-${waveId}`);
    expect(within(pages()).getByRole('tab', { name: /Your fleets/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('monument-send')).toBeNull();
    await page('Attack');
    expect(screen.getByTestId('monument-send')).toBeInTheDocument();
  });

  it('names the page by what the ships will do: Reinforce at your own monument', async () => {
    show({ ...catalog, monuments: [{ ...monument, controller: { kind: 'PLAYER', playerId: 'self', name: 'Me' } }] });
    await screen.findByTestId('monument-target');
    expect(within(pages()).getByRole('tab', { name: 'Reinforce' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps the probe, its last reading and the clan mark on the Target page', async () => {
    show({ ...catalog, probeReports: [report] });
    await screen.findByTestId('monument-target');
    expect(screen.queryByTestId('monument-probe')).toBeNull();
    await page('Target');
    expect(screen.getByTestId('monument-probe')).toBeVisible();
    expect(screen.getByTestId('monument-report')).toHaveTextContent(/Citadel/);
    expect(screen.getByTestId('monument-report')).toHaveTextContent(/2 ?h.*ago/);
    expect(screen.getByTestId('monument-report')).not.toHaveTextContent(/AM|PM|\d{4}/);
    expect(screen.getByRole('button', { name: /clan target/i })).toBeVisible();
  });
});

describe('the attack page', () => {
  it('sets the known garrison over the ships picked against it, with its age', async () => {
    show({ ...catalog, probeReports: [report] });
    const known = await screen.findByTestId('monument-known');
    await waitFor(() => { expect(known).toHaveTextContent(/Known defence/); });
    expect(known).toHaveTextContent(/12/);
    expect(known).toHaveTextContent(/40/);
    expect(known).toHaveTextContent(/2 ?h.*ago/);
    expect(known.compareDocumentPosition(screen.getByTestId('monument-hull-CITADEL')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says the defence is unknown and where the probe is when none has looked', async () => {
    show();
    const known = await screen.findByTestId('monument-known');
    expect(known).toHaveTextContent(/unknown/i);
    expect(known).toHaveTextContent(/Target/);
  });

  it('prices the flight on four plates, the rest one press away', async () => {
    show();
    fireEvent.change(await screen.findByRole('textbox', { name: /citadel.*quantity/i }), { target: { value: '1' } });
    const priced = await screen.findByTestId('monument-quote');
    const plates = within(priced).getByTestId('monument-plates');
    expect([...plates.querySelectorAll('.gk-label')].map((label) => label.textContent))
      .toEqual(['Arrival', 'Fuel', 'Lost en route', 'Flight bays']);
    expect(plates).toHaveTextContent('920');
    expect(plates).toHaveTextContent('2 / 5');
    // The breakdown and the battle rules fold under one head, shut until pressed.
    const detail = priced.querySelector<HTMLDetailsElement>('[data-monument-detail]')!;
    expect(detail.open).toBe(false);
    expect(within(detail).getByText(/return reserve/)).not.toBeVisible();
    expect(plates.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('asks no consent switch: the hold says the risks over it and carries them', async () => {
    const { requests } = show();
    fireEvent.change(await screen.findByRole('textbox', { name: /citadel.*quantity/i }), { target: { value: '1' } });
    await screen.findByTestId('monument-quote');
    expect(screen.queryByRole('switch', { name: /shield|radiation/i })).toBeNull();
    const send = screen.getByTestId('monument-send');
    const risk = within(send).getByTestId('monument-risk');
    expect(risk).toHaveTextContent(/shield drops/i);
    expect(risk).toHaveTextContent(/1 ship.* lost/i);
    const button = within(send).getByRole('button');
    await waitFor(() => { expect(button).toBeEnabled(); });
    hold(button);
    await waitFor(() => { expect(requests.find((row) => row.path.endsWith('/send'))?.body).toContain('"acknowledgeShieldLoss":true'); });
    expect(requests.find((row) => row.path.endsWith('/send'))?.body).toContain('"acknowledgeRadiationLoss":true');
  });
});

describe('your fleets page', () => {
  it('keeps recall shut behind one head until it is wanted', async () => {
    show({ ...catalog, waves: [held] });
    const card = await screen.findByTestId(`monument-wave-${waveId}`);
    const recall = card.querySelector<HTMLDetailsElement>('[data-monument-recall]')!;
    expect(recall.tagName).toBe('DETAILS');
    expect(recall.open).toBe(false);
    expect(recall.querySelector('summary')).toHaveTextContent('Recall ships');
  });

  it('writes a fuel refund as the amount it is, not with three trailing zeros', async () => {
    show({ ...catalog, waves: [held] });
    const card = await screen.findByTestId(`monument-wave-${waveId}`);
    expect(card).toHaveTextContent(/Fuel refund on home arrival: 42 deuterium/);
  });
});
