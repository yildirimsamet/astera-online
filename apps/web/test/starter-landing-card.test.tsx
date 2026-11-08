import { FIRST_SEASON_START } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { ArrivalHost } from '../src/starter/ArrivalHost.js';
import { urlOf } from './starterVesselFixture.js';

/**
 * THE FIRST MOVE IN THE MAIN GALAXY (plan 2026-11-08 F7, moment 17). The card after the landing
 * keeps what came down, the first-season start and the total apart, and ends on a real choice:
 * fly out with what is ready, or build the Deuterium the new world does not make yet.
 */
const arrival = { shardName: 'Vantage', cargo: { alloy: 2000, crystal: 300, deuterium: 50, fleet: { DART: 6 } }, planetId: 'p1', hull: 'SPINE' };

const harness = () => {
  const fetcher = vi.fn((input: RequestInfo | URL) => {
    const url = urlOf(input);
    const body = url.includes('/api/starter/arrival/seen') ? { ok: true } : { arrival, landedAt: new Date().toISOString() };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  });
  const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onPanel = vi.fn();
  render(<QueryClientProvider client={queries}><ApiProvider api={api}><ArrivalHost onPanel={onPanel} /></ApiProvider></QueryClientProvider>);
  return { fetcher, onPanel };
};

const packageShips = Object.values(FIRST_SEASON_START.fleet).reduce<number>((sum, n) => sum + n, 0);

beforeEach(async () => {
  await i18n.changeLanguage('en');
  // The scene has played: the card itself is what these cases read.
  window.sessionStorage.setItem('astera:jump-scene-played', '1');
});
afterEach(() => { cleanup(); window.sessionStorage.clear(); });

describe('the card after the landing', () => {
  it('keeps what came down, the first-season start and the total apart', async () => {
    harness();
    const carried = await screen.findByTestId('arrival-carried');
    expect(carried).toHaveTextContent('2,000');
    expect(carried).toHaveTextContent('300');
    expect(carried).toHaveTextContent('6 ships');
    const start = screen.getByTestId('arrival-package');
    expect(start).toHaveTextContent(FIRST_SEASON_START.resources.alloy.toLocaleString('en'));
    expect(start).toHaveTextContent(`${String(packageShips)} ships`);
    const total = screen.getByTestId('arrival-total');
    expect(total).toHaveTextContent((2000 + FIRST_SEASON_START.resources.alloy).toLocaleString('en'));
    expect(total).toHaveTextContent((300 + FIRST_SEASON_START.resources.crystal).toLocaleString('en'));
    expect(total).toHaveTextContent(String(50 + FIRST_SEASON_START.resources.deuterium));
    expect(total).toHaveTextContent(`${String(6 + packageShips)} ships`);
  });

  it('offers a first sortie with the fleet and fuel that are ready', async () => {
    const { onPanel, fetcher } = harness();
    const move = within(await screen.findByTestId('arrival-decide'));
    expect(move.getByTestId('arrival-outward')).toHaveTextContent(`${String(50 + FIRST_SEASON_START.resources.deuterium)} Deuterium`);
    fireEvent.click(move.getByRole('button', { name: /Plan a first sortie/u }));
    expect(onPanel).toHaveBeenCalledWith('intel');
    await waitFor(() => { expect(fetcher.mock.calls.some(([url]) => urlOf(url).includes('/api/starter/arrival/seen'))).toBe(true); });
  });

  it('offers to build the Deuterium the new world does not make', async () => {
    const { onPanel } = harness();
    const move = within(await screen.findByTestId('arrival-decide'));
    expect(move.getByTestId('arrival-grow')).toHaveTextContent(/output is zero. Research Deuterium Synthesis, then build the Deuterium Refinery/u);
    fireEvent.click(move.getByRole('button', { name: /Open Deuterium output/u }));
    expect(onPanel).toHaveBeenCalledWith('planet', undefined, undefined, { group: 'grow', itemId: 'DEUTERIUM_PLANT' });
  });
});
