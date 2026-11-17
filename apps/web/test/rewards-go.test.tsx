import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { RewardChainView } from '../src/api/schemas.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { RewardsScreen } from '../src/screens/RewardsScreen.js';

type State = 'locked' | 'claimable' | 'claimed';
const chain = (id: string, metric: string, progress: number, tiers: [number, State][]): RewardChainView => ({
  id, metric, scope: 'season', progress, tiers: tiers.map(([goal, state]) => ({ id: `${id}:${String(goal)}`, goal, alloy: 200, crystal: 70, state })),
});
const show = (chains: RewardChainView[], onGo = vi.fn()) => {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queries.setQueryData(['rewards'], { chains, claimable: chains.flatMap(one => one.tiers).filter(tier => tier.state === 'claimable').length });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  );
  return { onGo, ...render(<Wrapper><RewardsScreen commander="Vantage" onGo={onGo} /></Wrapper>) };
};

beforeEach(() => { localStorage.clear(); });

/** R3 and R6 (plan 2026-11-06 §7.1): the panel says what to do next and takes the player there. */
describe('from a reward goal to the place it is played', () => {
  it('names the next goal while nothing is waiting, and goes there', async () => {
    const { onGo } = show([chain('PROBE', 'count', 1, [[1, 'claimed'], [3, 'locked']]), chain('CORE', 'level', 3, [[5, 'locked']])]);
    const next = await screen.findByTestId('reward-next');
    expect(next).toHaveTextContent(/Probes sent/u);
    expect(next).toHaveTextContent(/2/u);
    await userEvent.setup().click(within(next).getByRole('button', { name: /Go/u }));
    expect(onGo).toHaveBeenCalledWith({ kind: 'probe' });
  });

  it('lets each unfinished goal go to its place, and a finished one not', async () => {
    const { onGo, container } = show([chain('REFINERY', 'level', 1, [[2, 'locked']]), chain('VAULT', 'level', 3, [[1, 'claimed'], [3, 'claimed']])]);
    await screen.findByTestId('reward-next');
    const refinery = container.querySelector<HTMLElement>('[data-reward-chain="REFINERY"]')!;
    await userEvent.setup().click(within(refinery).getByRole('button', { name: /Go/u }));
    expect(onGo).toHaveBeenCalledWith({ kind: 'build', group: 'grow', item: 'REFINERY' });
    const vault = container.querySelector<HTMLElement>('[data-reward-chain="VAULT"]')!;
    expect(within(vault).queryByRole('button', { name: /Go/u })).toBeNull();
  });

  it('leaves the next line to the pod while a tier is waiting', async () => {
    show([chain('PROBE', 'count', 1, [[1, 'claimable'], [3, 'locked']])]);
    await screen.findAllByRole('button', { name: /^claim$/iu });
    expect(screen.queryByTestId('reward-next')).toBeNull();
  });
});
