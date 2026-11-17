import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { LeaderboardScreen } from '../src/screens/LeaderboardScreen.js';

/**
 * THE STANDINGS COME FIRST (owner, 2026-11-17, item 4): "sıralamayı görene kadar çok scroll
 * yapmak gerekiyor". A commander opens the board to see where they stand, so the ladder is the
 * first thing under the race tabs — one line of their own place, the search, the list. What the
 * places pay and how Honor is scored each have their own page one press away.
 */

afterEach(async () => { await i18n.changeLanguage('en'); });

const row = (id: string, score: number, rank: number) => ({ playerId: id, username: id,
  country: 'TR', score, rank, dominion: 900, honor: score, skinId: null });

const show = async () => {
  await i18n.changeLanguage('en');
  const api = new Api({ fetch: vi.fn<typeof globalThis.fetch>() });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rows = [row('rival', 2_000_000, 1), row('me', 1_234_567, 2), row('trailer', 5, 3)];
  client.setQueryData(['leaderboard'], { ranking: 'HONOR', honorEnabled: true, honorSoloCredit: true, ladder: rows, you: rows[1],
    honorStartsAt: new Date('2026-10-15T12:00:00Z'),
    honorReward: { rank: 2, honor: 1_234_567, nominal: { alloy: 1750, crystal: 1250, deuterium: 250 },
      reward: { alloy: 34, crystal: 24, deuterium: 4 }, fullThreshold: 61_250_000 } });
  const old = [row('me', 900, 1)];
  client.setQueryData(['leaderboard', 'DOMINION'], { ranking: 'DOMINION', honorEnabled: true, ladder: old, you: old[0], honorReward: null });
  client.setQueryData(['season'], { status: 'live', endsAt: new Date(Date.now() + 86_400_000), seasonReward: null,
    seasonRewards: { version: 1, minimumDominion: 1, tiers: [{ place: 1, alloy: 1000, crystal: 750, deuterium: 150 }] } });
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
    <ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  return render(<Wrapper><LeaderboardScreen onFocusPlanet={vi.fn()} /></Wrapper>);
};

const views = () => screen.getByRole('radiogroup', { name: 'Leaderboard view' });

describe('the ladder opens first', () => {
  it('lands on the standings: the ladder is there, the prize and rule blocks are not', async () => {
    const view = await show();
    expect(within(views()).getByRole('radio', { name: 'Standings', checked: true })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Leaderboard' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.queryByText('Honor season prize')).toBeNull();
    expect(screen.queryByRole('region', { name: 'End of season prize' })).toBeNull();
    expect(screen.queryByText(/Defending never reduces your Honor/)).toBeNull();
    expect(screen.queryByText(/Shared sides cannot earn positive Honor/)).toBeNull();
    expect(screen.queryByTestId('honor-opening')).toBeNull();
    expect(view.container.querySelector('.gk-lb__lead')).toBeNull();
  });

  it('keeps the reader’s own place as one line above the search', async () => {
    const view = await show();
    const mine = view.container.querySelector<HTMLElement>('[data-honor-mine]')!;
    expect(mine).toHaveTextContent('#2');
    expect(mine).toHaveTextContent('1.234567');
    expect(mine).toHaveTextContent(/0.765433 Honor to draw level with rival/);
    expect(mine.compareDocumentPosition(screen.getByRole('searchbox')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('the rewards page', () => {
  it('holds what the places pay, and the ladder steps aside', async () => {
    await show();
    await userEvent.click(within(views()).getByRole('radio', { name: 'Rewards' }));
    expect(screen.getByText('Honor season prize')).toBeVisible();
    expect(screen.getByRole('region', { name: 'End of season prize' })).toBeVisible();
    expect(screen.getByText(/more valuable package once/)).toBeVisible();
    expect(screen.getByText(/Prizes beside commanders show/)).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Leaderboard' })).toBeNull();
  });
});

describe('the rules page', () => {
  it('leads with what Honor is and lays each rule out as one titled fold', async () => {
    const view = await show();
    await userEvent.click(within(views()).getByRole('radio', { name: 'Rules' }));
    expect(screen.getByText('Military success against comparable or stronger commanders.')).toBeVisible();
    expect(screen.getByText(/Shared sides cannot earn positive Honor/)).toBeVisible();
    expect(screen.getByTestId('honor-opening')).toBeVisible();
    const folds = [...view.container.querySelectorAll<HTMLDetailsElement>('[data-honor-rule]')];
    expect(folds.map((fold) => fold.querySelector('summary')?.textContent))
      .toEqual(['Earning Honor', 'Fleet balance', 'Defending', 'Repeats and bullying', 'Sharing prizes', 'One package']);
    expect(folds.every((fold) => !fold.open)).toBe(true);
    expect(screen.getByText(/Defending never reduces your Honor/)).not.toBeVisible();
    await userEvent.click(screen.getByText('Defending'));
    expect(screen.getByText(/Defending never reduces your Honor/)).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Leaderboard' })).toBeNull();
  });

  it('has no page on the Dominion race, which falls back to its standings', async () => {
    await show();
    await userEvent.click(within(views()).getByRole('radio', { name: 'Rules' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Dominion' }));
    expect(within(views()).queryByRole('radio', { name: 'Rules' })).toBeNull();
    expect(within(views()).getByRole('radio', { name: 'Standings', checked: true })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Leaderboard' })).toBeInTheDocument();
  });
});
