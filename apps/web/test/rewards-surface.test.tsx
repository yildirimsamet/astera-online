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

const social = (state: 'locked' | 'claimable' | 'claimed') => ({
  id: 'SOCIAL',
  metric: 'grant',
  progress: state === 'locked' ? 0 : 1,
  tiers: [{ id: 'SOCIAL:1', goal: 1, alloy: 1000, crystal: 500, state }],
});

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
    queries.setQueryData(['rewards'], rewards([social('locked')]));

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    expect(await screen.findByText(/Vantage/)).toBeInTheDocument();
    expect(screen.getByText(/waiting on your message/i)).toBeInTheDocument();
  });

  /**
   * IT LEAVES THE GAME, so the control has to be honest about that: a new tab, and
   * no handle on the page it came from. `noopener` is not decoration — without it
   * the opened site can reach back through `window.opener`.
   */
  it('opens the account in a new tab, with no handle on the game', async () => {
    const { wrapper: Wrapper, queries } = harness();
    queries.setQueryData(['rewards'], rewards([social('locked')]));

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    const link = await screen.findByRole('link', { name: /JoinAstera/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('JoinAstera'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  /**
   * PINNED ABOVE EVEN A CLAIMABLE GOAL. Owner instruction, and the reasoning is
   * that it is the only reward nobody can discover by playing — every other chain
   * is met by pressing the thing it pays for.
   */
  it('puts the community bonus first, above a goal that is ready to claim', async () => {
    const { wrapper: Wrapper, queries } = harness();
    queries.setQueryData(
      ['rewards'],
      rewards([probeChain(1, ['claimable', 'locked', 'locked']), social('locked')], 1),
    );

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    // Asserted by document ORDER rather than by list position: the bonus card's
    // three numbered steps are list items too, so counting `listitem` roles would
    // be counting the wrong things.
    const bonus = await screen.findByText(/community bonus/i);
    const goal = screen.getByText(/probes sent/i);
    expect(bonus.compareDocumentPosition(goal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers the claim once a human has confirmed it', async () => {
    const { wrapper: Wrapper, queries, api } = harness();
    queries.setQueryData(['rewards'], rewards([social('claimable')], 1));
    const claim = vi.spyOn(api, 'claimReward').mockResolvedValue({
      granted: { alloy: 1000, crystal: 500 },
      rewards: rewards([social('claimed')], 0),
      planet: undefined,
    } as never);

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    await userEvent.setup().click(await screen.findByRole('button', { name: /claim your bonus/i }));
    expect(claim).toHaveBeenCalledWith('SOCIAL:1');
  });
});

/**
 * WHAT HAPPENS WHEN THE STORE IS ALREADY FULL — the first question a player asks
 * before pressing a button that adds resources.
 *
 * The answer is the surprising one, and the panel has to say it: NOTHING IS LOST.
 * A grant is written straight to storage with no clamp, exactly as `OPENING_BONUS`
 * is, so the whole amount lands and the store is allowed to sit above its ceiling.
 * `apps/server/test/rewards.test.ts` proves the server half; this is the half that
 * tells the player.
 */
describe('claiming into a full store', () => {
  const stock = (alloy: number, crystal: number) => ({
    planet: { alloy, crystal, alloyCap: 1000, crystalCap: 400 },
  });

  it('says nothing is lost when a claimable reward would go over the ceiling', async () => {
    const { wrapper: Wrapper, queries } = harness();
    queries.setQueryData(['planet'], stock(950, 100));
    queries.setQueryData(
      ['rewards'],
      rewards([probeChain(1, ['claimable', 'locked', 'locked'])], 1),
    );

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    expect(await screen.findByText(/nothing is lost/i)).toBeInTheDocument();
    // And it is still claimable: the note explains, it does not block.
    expect(screen.getByRole('button', { name: /^claim$/i })).toBeEnabled();
  });

  it('stays quiet when everything on offer fits', async () => {
    const { wrapper: Wrapper, queries } = harness();
    queries.setQueryData(['planet'], stock(10, 10));
    queries.setQueryData(
      ['rewards'],
      rewards([probeChain(1, ['claimable', 'locked', 'locked'])], 1),
    );

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    await screen.findByRole('button', { name: /^claim$/i });
    expect(screen.queryByText(/nothing is lost/i)).not.toBeInTheDocument();
  });

  /**
   * Measured against the LARGEST single claimable tier and never against their
   * sum: they are claimed one at a time, so warning about a total nobody will
   * press in one go would cry wolf on a store with plenty of room.
   */
  it('does not warn about a total the player cannot claim in one press', async () => {
    const { wrapper: Wrapper, queries } = harness();
    // Three tiers of 200 each would total 600 and overflow; individually they fit.
    queries.setQueryData(['planet'], stock(500, 10));
    queries.setQueryData(
      ['rewards'],
      rewards([probeChain(5, ['claimable', 'claimable', 'claimable'])], 3),
    );

    render(
      <Wrapper>
        <RewardsScreen commander="Vantage" />
      </Wrapper>,
    );

    await screen.findAllByRole('button', { name: /^claim$/i });
    expect(screen.queryByText(/nothing is lost/i)).not.toBeInTheDocument();
  });
});
