import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { RewardsScreen } from '../src/screens/RewardsScreen.js';
import type * as Sound from '../src/lib/sound.js';
import type { RewardChainView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

const sound = vi.hoisted(() => ({ playSound: vi.fn() }));
const haptics = vi.hoisted(() => ({ haptic: vi.fn() }));
vi.mock('../src/lib/sound.js', async (original) => ({ ...await original<typeof Sound>(), ...sound }));
vi.mock('../src/lib/haptics.js', () => haptics);

const harness = (answer: unknown = {}) => {
  const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })));
  const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  );
  return { Wrapper, queries, api, fetcher };
};
type State = 'locked' | 'claimable' | 'claimed';
const tier = (chain: string, goal: number, state: State) => ({ id: `${chain}:${String(goal)}`, goal, alloy: 200, crystal: 70, state });
const core = (states: State[]): RewardChainView => ({ id: 'CORE', metric: 'level', scope: 'season', progress: 3, tiers: [2, 3, 5].map((goal, i) => tier('CORE', goal, states[i]!)) });
const social = (state: State): RewardChainView => ({ id: 'SOCIAL', metric: 'grant', scope: 'account', progress: 0, tiers: [{ id: 'SOCIAL:1', goal: 1, alloy: 1000, crystal: 500, state }] });
const view = (chains: RewardChainView[]) => ({ chains, claimable: chains.flatMap(chain => chain.tiers).filter(one => one.state === 'claimable').length });

beforeEach(() => { localStorage.clear(); sound.playSound.mockClear(); haptics.haptic.mockClear(); });

/**
 * TAKE IT ALL IN ONE MOVE (plan 2026-11-06 §7.1 R4, Faz 4.3). A landing leaves several tiers waiting;
 * one press takes them all, the pod opens on the sum, with a sound and a knock.
 */
describe('taking every waiting reward', () => {
  it('offers one move for two or more waiting tiers and takes them in one request', async () => {
    const taken = view([core(['claimed', 'claimed', 'locked'])]);
    // Through the real client, so the answer is read by the same schema the game reads it with.
    const { Wrapper, queries, api } = harness({ granted: { alloy: 400, crystal: 140, deuterium: 0 }, count: 2, rewards: taken, planet: planetView() });
    queries.setQueryData(['rewards'], view([core(['claimable', 'claimable', 'locked'])]));
    const all = vi.spyOn(api, 'claimAllRewards');
    render(<Wrapper><RewardsScreen commander="Vantage" /></Wrapper>);
    const take = await screen.findByRole('button', { name: /Take all · 2/u });
    await userEvent.setup().click(take);
    expect(all).toHaveBeenCalledTimes(1);
    expect(haptics.haptic).toHaveBeenCalledWith('thunk');
    await waitFor(() => { expect(sound.playSound).toHaveBeenCalledWith('unseal'); });
    await waitFor(() => { expect(screen.queryByRole('button', { name: /Take all/u })).toBeNull(); });
  });

  it('leaves a single waiting tier to its own pod', async () => {
    const { Wrapper, queries } = harness();
    queries.setQueryData(['rewards'], view([core(['claimable', 'claimed', 'locked'])]));
    render(<Wrapper><RewardsScreen commander="Vantage" /></Wrapper>);
    await screen.findAllByRole('button', { name: /^claim$/iu });
    expect(screen.queryByRole('button', { name: /Take all/u })).toBeNull();
  });
});

/**
 * R5: the community card took most of the first screen. It stays pinned first (owner: the one reward no
 * play reveals), but short: what it pays, and its three steps one tap away.
 */
describe('the community card', () => {
  it('stays first but short, its steps folded', async () => {
    const { Wrapper, queries } = harness();
    queries.setQueryData(['rewards'], view([social('locked'), core(['claimable', 'locked', 'locked'])]));
    const { container } = render(<Wrapper><RewardsScreen commander="Vantage" /></Wrapper>);
    await screen.findAllByRole('button', { name: /^claim$/iu });
    const order = [...container.querySelectorAll('[data-reward-chain]')].map(node => node.getAttribute('data-reward-chain'));
    expect(order).toEqual(['SOCIAL', 'CORE']);
    const card = container.querySelector<HTMLElement>('[data-reward-chain="SOCIAL"]')!;
    expect(within(card).queryByText(/Vantage/u)).toBeNull();
    await userEvent.setup().click(within(card).getByRole('button', { name: /How to earn it/u }));
    expect(within(card).getByText(/Vantage/u)).toBeInTheDocument();
  });
});
