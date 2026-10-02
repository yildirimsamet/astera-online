import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ClanSupportSheet } from '../src/screens/ClanSupportSheet.js';
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

function show(answer: Record<string, unknown>) {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(answer), {
    status: 200, headers: { 'content-type': 'application/json' },
  })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  const origin = planetView({ fleet: { PIKE: 30, DART: 10 } }, { id: 'origin', name: 'Home' });
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
    expect(screen.getByText(/your dominion does not change/i)).toBeInTheDocument();
    expect(screen.getByText(/tier 3 · host tier 3/i)).toBeInTheDocument();
    expect(commit()).toHaveTextContent(/send 4 ships/i);
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
