import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import type * as Sound from '../src/lib/sound.js';
import { WelcomeWeek } from '../src/screens/WelcomeWeek.js';
import { useRewardsWaiting } from '../src/api/queries.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { urlOf } from './starterVesselFixture.js';

const sound = vi.hoisted(() => ({ playSound: vi.fn() }));
vi.mock('../src/lib/sound.js', async (original) => ({ ...await original<typeof Sound>(), ...sound }));

const HOUR = 3_600_000;
const state = (over: Record<string, unknown> = {}) => ({ welcome: { opened: 2, box: 3, readyAt: new Date(Date.now() - 1000).toISOString(), preview: { alloy: 160, crystal: 240 }, ...over } });

const harness = (welcome: object) => {
  const fetcher = vi.fn((input: RequestInfo | URL) => {
    const url = urlOf(input);
    const body = url.includes('/api/welcome/open')
      ? { granted: { alloy: 160, crystal: 240 }, ...state({ opened: 3, box: 4, readyAt: new Date(Date.now() + 20 * HOUR).toISOString() }) }
      : welcome;
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  });
  const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider><WelcomeWeek /></ToastProvider></ApiProvider></QueryClientProvider>);
  return { opened: () => fetcher.mock.calls.filter(([input]) => urlOf(input as RequestInfo).includes('/api/welcome/open')) };
};
const cell = (box: number) => screen.getByTestId(`welcome-box-${String(box)}`);

beforeEach(async () => { await i18n.changeLanguage('en'); sound.playSound.mockClear(); });
afterEach(() => { cleanup(); });

/** New Commander 7 Days as one board (owner 2026-11-18): the whole week at a glance, the box opened in place. */
describe('the welcome board', () => {
  it('shows all seven boxes: the opened ones, the one to open with what it holds, and those ahead', async () => {
    harness(state());
    expect(await screen.findByTestId('welcome-week')).toHaveTextContent(/New Commander · 7 Boxes/u);
    expect([1, 2, 3, 4, 5, 6, 7].map(box => cell(box).dataset.state)).toEqual(['opened', 'opened', 'ready', 'later', 'later', 'later', 'later']);
    expect(cell(1)).toHaveAccessibleName(/Commander box 1\/7.*Opened/u);
    const ready = within(cell(3)).getByRole('button', { name: /Commander box 3\/7/u });
    expect(ready).toHaveTextContent('240');
    expect(ready).toHaveTextContent('160');
  });

  it('says what the boxes hold and when the next comes, in the rules\' own numbers', async () => {
    harness(state());
    expect(await screen.findByTestId('welcome-rule')).toHaveTextContent(/Helios planet ring.*deuterium.*Titan Drive.*20 hours/u);
  });

  it('opens the ready box with the crate\'s hold, and pours it into the store', async () => {
    const { opened } = harness(state());
    const ready = await within(await screen.findByTestId('welcome-box-3')).findByRole('button');
    fireEvent.keyDown(ready, { key: 'Enter' });
    await waitFor(() => { expect(opened()).toHaveLength(1); });
    expect(sound.playSound).toHaveBeenCalledWith('crate');
    expect(await screen.findByTestId('welcome-poured')).toHaveTextContent(/240.*160|160.*240/u);
  });

  it('gives the next box its wait while it is not ready, with nothing to press', async () => {
    harness(state({ readyAt: new Date(Date.now() + 5 * HOUR).toISOString() }));
    await screen.findByTestId('welcome-week');
    expect(cell(3).dataset.state).toBe('waiting');
    expect(cell(3)).toHaveTextContent(/in 5h/u);
    expect(within(cell(3)).queryByRole('button')).toBeNull();
  });

  it('shows the third with the Helios Ring and the seventh as the big box with Titan Drive and escalating fixed cache', async () => {
    harness(state());
    await screen.findByTestId('welcome-week');
    expect(cell(3)).toHaveTextContent(/Helios Ring/u);
    expect(cell(7).dataset.big).toBe('');
    expect(cell(7)).toHaveTextContent(/Big box/u);
    expect(cell(7)).toHaveTextContent(/Titan Drive/u);
    expect(cell(7)).toHaveTextContent('3K');
    expect(cell(7)).toHaveTextContent('1.8K');
    expect(cell(7)).toHaveTextContent('500');
  });

  it('shows nothing once the seven are open, or for an account without the week', async () => {
    harness(state({ opened: 7, box: null, readyAt: null, preview: null }));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.queryByTestId('welcome-week')).toBeNull();
    cleanup();
    harness({ welcome: null });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.queryByTestId('welcome-week')).toBeNull();
  });
});

// Plan 2026-11-06 §7.2: the gift icon counts a ready box as one more thing waiting.
describe('the gift count', () => {
  const Count = () => <output data-testid="count">{useRewardsWaiting()}</output>;
  const count = (welcome: object, claimable: number) => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const body = urlOf(input).includes('/api/welcome') ? welcome : { chains: [], claimable };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
    const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
    render(<QueryClientProvider client={new QueryClient()}><ApiProvider api={api}><Count /></ApiProvider></QueryClientProvider>);
  };
  it('adds a ready box to the rewards waiting, and not one still waiting itself', async () => {
    count(state(), 2);
    await waitFor(() => { expect(screen.getByTestId('count')).toHaveTextContent('3'); });
    cleanup();
    count(state({ readyAt: new Date(Date.now() + HOUR).toISOString() }), 2);
    await waitFor(() => { expect(screen.getByTestId('count')).toHaveTextContent('2'); });
  });
});

// Owner 2026-11-18: a ready box is what the gift icon called the player for, so it stands first on the panel.
describe('the board on the reward panel', () => {
  const panel = async (welcome: object) => {
    const { RewardsScreen } = await import('../src/screens/RewardsScreen.js');
    const api = new Api({ fetch: (() => new Promise<Response>(() => undefined)) as unknown as typeof globalThis.fetch });
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    queries.setQueryData(['rewards'], { chains: [{ id: 'CORE', metric: 'level', scope: 'season', progress: 3, tiers: [{ id: 'CORE:2', goal: 2, alloy: 200, crystal: 70, state: 'claimable' }] }], claimable: 1 });
    queries.setQueryData(['welcome'], welcome);
    render(<QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider><RewardsScreen commander="Vantage" /></ToastProvider></ApiProvider></QueryClientProvider>);
    const board = await screen.findByTestId('welcome-week');
    const pod = document.querySelector('.gk-rewards__pod');
    return board.compareDocumentPosition(pod!) & Node.DOCUMENT_POSITION_FOLLOWING ? 'first' : 'after';
  };
  const parsed = (over: Record<string, unknown>) => ({ welcome: { opened: 2, box: 3, readyAt: new Date(Date.now() - 1000), preview: { alloy: 160, crystal: 240 }, ...over } });

  it('stands above the capsule while a box is ready, below it while the next one waits', async () => {
    expect(await panel(parsed({}))).toBe('first');
    cleanup();
    expect(await panel(parsed({ readyAt: new Date(Date.now() + 5 * HOUR) }))).toBe('after');
  });
});
