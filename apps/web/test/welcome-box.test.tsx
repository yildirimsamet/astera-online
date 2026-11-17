import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import type * as Sound from '../src/lib/sound.js';
import { WelcomeBox } from '../src/screens/WelcomeBox.js';
import { useRewardsWaiting } from '../src/api/queries.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { urlOf } from './starterVesselFixture.js';

const sound = vi.hoisted(() => ({ playSound: vi.fn() }));
vi.mock('../src/lib/sound.js', async (original) => ({ ...await original<typeof Sound>(), ...sound }));

const HOUR = 3_600_000;
const state = (over: Record<string, unknown> = {}) => ({ welcome: { opened: 2, box: 3, readyAt: new Date(Date.now() - 1000).toISOString(), preview: { alloy: 160, crystal: 240 }, ...over } });

const harness = (welcome: object, waiting = true) => {
  const fetcher = vi.fn((input: RequestInfo | URL) => {
    const url = urlOf(input);
    const body = url.includes('/api/welcome/open')
      ? { granted: { alloy: 160, crystal: 240 }, ...state({ opened: 3, box: 4, readyAt: new Date(Date.now() + 20 * HOUR).toISOString() }) }
      : welcome;
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  });
  const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider><WelcomeBox waiting={waiting} /></ToastProvider></ApiProvider></QueryClientProvider>);
  return { opened: () => fetcher.mock.calls.filter(([input]) => urlOf(input as RequestInfo).includes('/api/welcome/open')) };
};

beforeEach(async () => { await i18n.changeLanguage('en'); sound.playSound.mockClear(); });
afterEach(() => { cleanup(); });

/** New Commander 7 Days (plan 2026-11-06 §7.2): the box is a crate in the bay, lifted the same way. */
describe('the welcome box', () => {
  it('shows the ready box with what it holds, and opens it with the crate\'s gesture', async () => {
    const { opened } = harness(state());
    const crate = await screen.findByRole('button', { name: /Commander box 3\/7/u });
    expect(crate).toHaveTextContent('+160');
    expect(crate).toHaveTextContent('+240');
    fireEvent.keyDown(crate, { key: 'Enter' });
    await waitFor(() => { expect(opened()).toHaveLength(1); });
    expect(sound.playSound).toHaveBeenCalledWith('crate');
  });

  it('says when the next box is ready while it waits, with no crate to press', async () => {
    harness(state({ readyAt: new Date(Date.now() + 5 * HOUR).toISOString() }));
    expect(await screen.findByTestId('welcome-wait')).toHaveTextContent(/Commander box 3\/7 · in 5h/u);
    expect(screen.queryByRole('button', { name: /Commander box/u })).toBeNull();
  });

  it('keeps the waiting line off a crowded screen', async () => {
    harness(state({ readyAt: new Date(Date.now() + 5 * HOUR).toISOString() }), false);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.queryByTestId('welcome-box')).toBeNull();
  });

  it('shows nothing once the seven are open, or for an account without the week', async () => {
    harness(state({ opened: 7, box: null, readyAt: null, preview: null }));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.queryByTestId('welcome-box')).toBeNull();
    cleanup();
    harness({ welcome: null });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(screen.queryByTestId('welcome-box')).toBeNull();
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
