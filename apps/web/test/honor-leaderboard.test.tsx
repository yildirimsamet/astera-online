import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { LeaderboardScreen } from '../src/screens/LeaderboardScreen.js';
import { honorScore } from '../src/lib/honor.js';

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('Honor is the primary player-visible race', () => {
  const row = (id: string, score: number, rank: number) => ({ playerId: id, username: id,
    country: 'TR', score, rank, dominion: 900, honor: score, skinId: null });
  const show = async (withReceipt = false, tied = false, opened = false, honorSoloCredit = false) => {
    await i18n.changeLanguage('en');
    const api = new Api({ fetch: vi.fn<typeof globalThis.fetch>() });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const rows = [row('rival', 2_000_000, 1), row('me', 1_234_567, 2), row('recovering', -1, 3)];
    if (tied) { rows[0] = row('rival', 1_234_567, 1); rows[1] = row('me', 1_234_567, 1); }
    client.setQueryData(['leaderboard'], { ranking: 'HONOR', honorEnabled: true, honorSoloCredit, ladder: rows, you: rows[1],
      honorStartsAt: opened ? new Date('2026-10-15T12:00:00Z') : null,
      honorReward: { rank: tied ? 1 : 2, honor: 1_234_567,
        nominal: tied ? { alloy: 3750, crystal: 2750, deuterium: 550 } : { alloy: 3500, crystal: 2500, deuterium: 500 },
        reward: tied ? { alloy: 34, crystal: 25, deuterium: 5 } : { alloy: 34, crystal: 24, deuterium: 4 },
        fullThreshold: tied ? 134_250_000 : 122_500_000 } });
    const old = [row('me', 900, 1)];
    client.setQueryData(['leaderboard', 'DOMINION'], { ranking: 'DOMINION', honorEnabled: true,
      ladder: old, you: old[0], honorReward: null });
    client.setQueryData(['season'], { status: 'live', endsAt: new Date(Date.now() + 86_400_000),
      seasonReward: withReceipt ? { ranking: 'HONOR', sourceSeasonId: 'previous', displayRank: 2, rewardPlace: 2,
        alloy: 34, crystal: 24, deuterium: 4, programVersion: 1 } : null,
      seasonRewards: { version: 1, minimumDominion: 1, tiers: [
        { place: 1, alloy: 2000, crystal: 1500, deuterium: 300 },
        { place: 2, alloy: 1750, crystal: 1250, deuterium: 250 },
      ] } });
    const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
    render(<Wrapper><LeaderboardScreen onFocusPlanet={vi.fn()} /></Wrapper>);
  };

  it('shows Honor first, preserves micro precision and explains the competition and prize cap', async () => {
    await show();
    expect(screen.getByRole('button', { name: 'Honor', pressed: true })).toBeInTheDocument();
    expect(screen.getAllByText('1.234567').length).toBeGreaterThan(0);
    expect(screen.getByText('-0.000001')).toBeInTheDocument();
    expect(screen.getByText(/122.5 Honor/)).toBeInTheDocument();
    await userEvent.click(screen.getByText('How Honor works'));
    expect(screen.getByText(/Defending never reduces your Honor/)).toBeVisible();
    expect(screen.getByText(/highest tier in the galaxy.*one tier below.*equal-tier/)).toBeVisible();
  });

  it('shows the solo-credit rule prominently only when the server announces it', async () => {
    await show(false, false, false, true);
    expect(screen.getByText(/Shared sides cannot earn positive Honor/)).toBeVisible();
    expect(screen.getByText(/A solo opponent can still earn Honor/)).toBeVisible();
  });

  it('states the visible opening date and the old-flight boundary at the point of competition', async () => {
    await show(false, false, true);
    const opening = screen.getByTestId('honor-opening');
    expect(opening).toHaveTextContent('Oct 15, 2026');
    expect(opening).toHaveTextContent('Everyone started at 0 Honor. Only attacks sent after this time count.');
    expect(opening).toHaveTextContent('Dominion history is preserved.');
    expect(opening.querySelector('time')).toHaveAttribute('datetime', '2026-10-15T12:00:00.000Z');
  });

  it('does not invent an opening date on an older response without boundary metadata', async () => {
    await show();
    expect(screen.queryByTestId('honor-opening')).not.toBeInTheDocument();
  });

  it('keeps Dominion available as a separate ranking', async () => {
    await show();
    await userEvent.click(screen.getByRole('button', { name: 'Dominion' }));
    expect(screen.getByRole('button', { name: 'Dominion', pressed: true })).toBeInTheDocument();
    expect(screen.getByText('+900')).toBeInTheDocument();
  });
  it('keeps last season’s delivered receipt separate from the current prize estimate', async () => {
    await show(true);
    expect(screen.getByText('Previous season prize delivered')).toBeVisible();
    expect(screen.getByText('Honor · Rank 2')).toBeVisible();
    expect(screen.getByText('Honor season prize')).toBeVisible();
  });
  it('explains a pooled tied prize without promising every tied rank one a personal double package', async () => {
    await show(false, true);
    expect(screen.getByText(/134.25 Honor/)).toBeVisible();
    expect(screen.getByText(/3,750/)).toBeVisible();
    await userEvent.click(screen.getByText('How Honor works'));
    expect(screen.getByText(/Tied commanders equally share the packages for their occupied places/)).toBeVisible();
    expect(screen.queryByText(/For the same place, Honor’s full package is twice Dominion’s/)).not.toBeInTheDocument();
  });
  it('keeps the promised Dominion prize visible on its own tab and explains the single payout', async () => {
    await show();
    await userEvent.click(screen.getByRole('button', { name: 'Dominion' }));
    expect(screen.getByText('End of season prize')).toBeVisible();
    expect(screen.getByText('Rank 1 · you are winning this')).toBeVisible();
    expect(screen.getByText('2,000')).toBeVisible();
    expect(screen.getByText(/more valuable package once/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /prize by place/i }));
    expect(screen.getByRole('list', { name: 'Prize by place' }).children).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Honor' }));
    expect(screen.queryByText('End of season prize')).not.toBeInTheDocument();
    expect(screen.getByText('Honor season prize')).toBeVisible();
  });

  it('formats the smallest amount and maximum safe score without erasing a micro-Honor', async () => {
    await i18n.changeLanguage('en');
    expect(honorScore(1)).toBe('0.000001');
    expect(honorScore(-1)).toBe('-0.000001');
    expect(honorScore(Number.MAX_SAFE_INTEGER)).toBe('9,007,199,254.740991');
    await i18n.changeLanguage('tr');
    expect(honorScore(1_234_567)).toBe('1,234567');
  });
});
