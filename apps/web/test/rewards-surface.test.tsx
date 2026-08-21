import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { RewardsScreen } from '../src/screens/RewardsScreen.js';

/**
 * THE REWARD PANEL, AND THE FOUR WAYS IT COULD LIE.
 *
 * It says what a player has done and what the game will pay for it, so the
 * failures worth testing are all about the panel disagreeing with the world:
 * offering a claim on something not earned, reading a level as if it were a
 * count, reporting a dead request as an empty ledger, and refusing to draw
 * anything because one card came from a newer server.
 */

const harness = () => {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}>
        <ToastProvider>{children}</ToastProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
  return { wrapper, queries, api };
};

const tier = (goal: number, state: 'locked' | 'claimable' | 'claimed', chain = 'PROBE') => ({
  id: `${chain}:${String(goal)}`,
  goal,
  alloy: 200,
  crystal: 70,
  state,
});

const rewards = (chains: unknown[], claimable = 0) => ({ chains, claimable });

const probeChain = (progress: number, states: ('locked' | 'claimable' | 'claimed')[]) => ({
  id: 'PROBE',
  metric: 'count',
  progress,
  tiers: [1, 3, 5].map((goal, i) => tier(goal, states[i]!, 'PROBE')),
});

describe('the reward panel', () => {
  it('offers a claim only on what has been earned', async () => {
    const { wrapper: Wrapper, queries } = harness();
    queries.setQueryData(
      ['rewards'],
      rewards([probeChain(3, ['claimable', 'claimable', 'locked'])], 2),
    );

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    expect(await screen.findAllByRole('button', { name: /claim/i })).toHaveLength(2);
    // The third states what is still missing rather than offering a button the
    // server would refuse.
    expect(screen.getByText(/2 to go/i)).toBeInTheDocument();
  });

  it('states progress in the units the chain is measured in', async () => {
    const { wrapper: Wrapper, queries } = harness();
    queries.setQueryData(
      ['rewards'],
      rewards([
        probeChain(3, ['claimed', 'locked', 'locked']),
        {
          id: 'CORE',
          metric: 'level',
          progress: 4,
          tiers: [tier(3, 'claimed', 'CORE'), tier(5, 'locked', 'CORE')],
        },
      ]),
    );

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    // A count reads as a fraction of its next goal; a level reads as a level.
    expect(await screen.findByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByText('L4')).toBeInTheDocument();
    // And a level tier's target is L5, never ×5, which would claim there are five
    // of something.
    expect(screen.getByText('L5')).toBeInTheDocument();
  });

  it('sends the tier id the server gave it, and reports what landed', async () => {
    const { wrapper: Wrapper, queries, api } = harness();
    queries.setQueryData(
      ['rewards'],
      rewards([probeChain(1, ['claimable', 'locked', 'locked'])], 1),
    );

    const claim = vi.spyOn(api, 'claimReward').mockResolvedValue({
      granted: { alloy: 200, crystal: 70 },
      rewards: rewards([probeChain(1, ['claimed', 'locked', 'locked'])], 0),
      planet: undefined,
    } as never);

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    await userEvent.setup().click(await screen.findByRole('button', { name: /claim/i }));
    expect(claim).toHaveBeenCalledWith('PROBE:1');
    await waitFor(() => {
      expect(screen.getByText(/\+200 alloy/i)).toBeInTheDocument();
    });
  });

  /**
   * A CHAIN FROM A NEWER SERVER COSTS ONE CARD, NEVER THE PANEL.
   *
   * `id` is a string on the wire for exactly this reason — an enum would make Zod
   * reject the whole array, leaving `data` undefined and the player staring at a
   * loading state that never resolves.
   */
  it('skips a chain it has never heard of and draws the rest', async () => {
    const { wrapper: Wrapper, queries } = harness();
    queries.setQueryData(
      ['rewards'],
      rewards(
        [
          {
            id: 'TIME_TRAVEL',
            metric: 'count',
            progress: 1,
            tiers: [tier(1, 'claimable', 'TIME_TRAVEL')],
          },
          probeChain(1, ['claimable', 'locked', 'locked']),
        ],
        2,
      ),
    );

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    expect(await screen.findByText(/probes sent/i)).toBeInTheDocument();
    expect(screen.queryByText(/TIME_TRAVEL/)).not.toBeInTheDocument();
  });

  /**
   * D53a. React Query drops `isPending` the moment a query errors while `data`
   * stays undefined, so a gate written as `isPending || !data` shimmers for ever
   * at a request that already gave up — and this panel would be claiming the
   * ledger was empty.
   */
  it('says a read failed rather than drawing it as a slow one', async () => {
    const { wrapper: Wrapper, api } = harness();
    vi.spyOn(api, 'rewards').mockRejectedValue(new Error('offline'));

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach/i);
  });

  /**
   * The social card cannot show progress — there is nothing in the galaxy to
   * count — so it has to be an instruction, and the instruction is useless
   * without the name the player is supposed to send.
   */
  /**
   * IT MUST BE THE COMMANDER NAME, NEVER THE PLANET NAME. The operator's command
   * resolves what is typed against `players.name` — the account's display name —
   * so a card printing the planet's name would have had every player send a
   * string the grant can never find, and the whole bonus would fail in silence
   * with nothing anywhere going red.
   */
  it('tells the commander what to put in the message', async () => {
    const { wrapper: Wrapper, queries } = harness();
    queries.setQueryData(
      ['rewards'],
      rewards([
        {
          id: 'SOCIAL',
          metric: 'grant',
          progress: 0,
          tiers: [{ id: 'SOCIAL:1', goal: 1, alloy: 500, crystal: 250, state: 'locked' }],
        },
      ]),
    );

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    expect(await screen.findByText(/Vantage/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /JoinAstera/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('JoinAstera'));
    // An outbound link out of a game must not hand the opener a live window.
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
