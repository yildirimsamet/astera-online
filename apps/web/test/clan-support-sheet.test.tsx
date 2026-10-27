import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ClanSupportSheet } from '../src/screens/ClanSupportSheet.js';
import { keys } from '../src/api/keys.js';
import { planetView } from './fixtures.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the send sheet (P12): the flight in figures, the rules that
 * bind it, and the first refusal on the held button's face.
 */

const HOUR = 3_600_000;
const quote = (over: Record<string, unknown> = {}) => ({
  refusals: [],
  arriveAt: new Date(Date.now() + 20 * 60_000).toISOString(),
  travelMinutes: 20,
  returnMinutes: 20,
  fuel: 64,
  bays: { used: 2, total: 5 },
  hostRoom: { used: 40, reserved: 0, total: 470, after: 64 },
  band: { ok: true, mine: 3, theirs: 3 },
  stationUntil: new Date(Date.now() + 12 * HOUR + 20 * 60_000).toISOString(),
  seasonClipped: false,
  personalHangar: { used: 300, total: 470 },
  senderShieldUntil: null,
  ...over,
});

function show(answer: Record<string, unknown>, world?: ReturnType<typeof planetView>, honorSoloCredit = false, ship: unknown = null) {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(answer), {
    status: 200, headers: { 'content-type': 'application/json' },
  })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['season'], { honorSoloCredit });
  if (ship) client.setQueryData(keys.commanderShip, ship);
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  const origin = world ?? planetView({ fleet: { PIKE: 30, DART: 10 } }, { id: 'origin', name: 'Home' });
  render(<QueryClientProvider client={client}><ApiProvider api={api}>
    <ClanSupportSheet host={{ planetId: 'world', planetName: 'Vega', ownerName: 'Ali' }}
      worlds={[origin]} onClose={vi.fn()} onSent={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
  return { fetch };
}

const commit = () => within(document.querySelector<HTMLElement>('[data-support-commit]')!).getByRole('button');

async function pick(count: number) {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const more = screen.getByRole('button', { name: /more pike/i });
  for (let i = 0; i < count; i++) {
    act(() => { more.click(); });
  }
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  vi.useRealTimers();
}

describe('the clan support sheet', () => {
  it('states the Honor consequence before sending defence support', () => {
    show(quote(), undefined, true);
    expect(screen.getByText(/Shared sides cannot earn positive Honor/)).toBeVisible();
  });
  it('limits support dispatches to ships above 5% HP', async () => {
    show(quote(), planetView({ fleet: { PIKE: 3 }, fleetDamage: [{ hull: 'PIKE', count: 2, damageBp: 9500 }],
      fleetCombatReady: { PIKE: 1 } }, { id: 'origin', name: 'Home' }));
    await pick(3);
    expect(screen.getByRole('textbox', { name: /pike.*quantity/i })).toHaveValue('1');
  });
  it('names the host world and asks for ships before anything else', () => {
    show(quote());
    expect(screen.getByText(/Ali · Vega/)).toBeInTheDocument();
    expect(commit()).toHaveTextContent(/pick at least one ship/i);
  });

  it('prices the flight once ships are picked, and states every binding rule', async () => {
    const { fetch } = show(quote());
    await pick(4);
    expect(fetch).toHaveBeenCalled();
    expect((fetch.mock.calls.at(-1) as [string])[0]).toContain('/api/clan/support/quote');
    expect(await screen.findByText(/out and back · no refund/i)).toBeInTheDocument();
    expect(screen.getByText(/stays at most 12 h/i)).toBeInTheDocument();
    expect(screen.getByText(/does not retreat while support stands/i)).toBeInTheDocument();
    expect(screen.getByText(/your dominion stays unchanged as a supporter/i)).toHaveTextContent(/your losses are not multiplied/i);
    expect(screen.getByText(/tier 3 · host tier 3/i)).toBeInTheDocument();
    expect(commit()).toHaveTextContent(/send 4 ships/i);
  });

  it('offers the commander ship to stand with the wave, quoting and sending it (Y9)', async () => {
    const { fetch } = show(quote(), undefined, false, { capitalPlanetId: '00000000-0000-4000-8000-000000000009', rulesetVersion: 19,
      ship: { class: 'muhafiz', level: 1, status: 'ready', readyAt: null } });
    await pick(4);
    const toggle = await screen.findByRole('switch', { name: /commander ship escorts/i });
    expect(screen.getByText(/hull and shields \+2%/i)).toBeVisible();
    expect(screen.getByText(/only a decisive defeat of the line sends it to repair for 60 min/i)).toBeVisible();
    act(() => { toggle.click(); });
    await pick(0);
    const bodyOf = (call: unknown): string => { const body = (call as [string, RequestInit | undefined])[1]?.body; return typeof body === 'string' ? body : ''; };
    const bodies = () => fetch.mock.calls.map(bodyOf);
    await waitFor(() => { expect(bodies().some((body) => body.includes('"admiral":true'))).toBe(true); });
    fireEvent.keyDown(commit(), { key: 'Enter' });
    fireEvent.keyDown(commit(), { key: 'Enter' });
    await waitFor(() => {
      const sent = fetch.mock.calls.find((call) => (call as [string])[0].endsWith('/api/clan/support'));
      expect(bodyOf(sent)).toContain('"admiral":true');
    });
  });

  it('puts the first refusal on the button', async () => {
    show(quote({ refusals: [{ code: 'CLAN_SUPPORT_ROOM_FULL', message: 'full', params: { used: 460, total: 470 } }],
      band: { ok: true, mine: 3, theirs: 3 } }));
    await pick(2);
    await screen.findByText(/out and back · no refund/i);
    expect(commit()).not.toHaveTextContent(/send 2 ships/i);
    expect(commit()).toBeDisabled();
  });

  it('says when the season cuts the stay short', async () => {
    show(quote({ seasonClipped: true }));
    await pick(1);
    expect(await screen.findByText(/home before the season ends/i)).toBeInTheDocument();
  });
});
