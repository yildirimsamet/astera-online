import type { ReactNode } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import type { DailyQuests } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { RewardsScreen } from '../src/screens/RewardsScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';

/**
 * THE REWARDS SHEET IN TWO TABS (owner, 2026-11-24): the day's quests under Daily, the standing goals
 * (milestone ladders and the commander's seven boxes) under Goals. The daily list is reached from its own
 * key on the galaxy, so it opens there; every other way in lands on the goals, as the sheet always did.
 */
const harness = (opts: { goals?: boolean; daily?: DailyQuests | null } = {}) => {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (opts.goals !== false) queries.setQueryData(keys.rewards, { chains: [probeChain], claimable: 2 });
  if (opts.daily) queries.setQueryData(keys.dailyQuests, opts.daily);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  );
  return wrapper;
};

const probeChain = {
  id: 'PROBE', metric: 'count', progress: 3,
  tiers: [1, 3, 5].map((goal, index) => ({ id: `PROBE:${String(goal)}`, goal, alloy: 200, crystal: 70, state: index < 2 ? 'claimable' : 'locked' })),
};
const quest = (id: string, state: 'locked' | 'claimable' | 'claimed') =>
  ({ id, goal: 1, progress: state === 'locked' ? 0 : 1, state, alloy: 300, crystal: 130, honor: 250_000 });
const daily = (...states: ('locked' | 'claimable' | 'claimed')[]): DailyQuests => {
  const quests = states.map((state, index) => quest(['PROBES', 'RIFT', 'PIRATE', 'ASTEROID'][index]!, state));
  return { day: '2026-11-24', resetsAt: new Date(Date.now() + 5 * 3_600_000), quests, claimable: quests.filter((one) => one.state === 'claimable').length };
};

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.removeItem('astera.accordion.rewards'); });
afterEach(() => { cleanup(); });

describe('the rewards tabs', () => {
  it('offers Daily and Goals when the server has a daily list, and opens on the goals', async () => {
    const Wrapper = harness({ daily: daily('locked', 'locked', 'locked', 'locked') });
    render(<Wrapper><RewardsScreen commander="Vantage" /></Wrapper>);
    const tabs = within(screen.getByRole('tablist'));
    expect(tabs.getByRole('tab', { name: /^Goals/ })).toHaveAttribute('aria-selected', 'true');
    expect(tabs.getByRole('tab', { name: /^Daily/ })).toHaveAttribute('aria-selected', 'false');
    expect(await screen.findByText('3 / 5')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-quests')).toBeNull();
  });

  it('shows the daily list and takes the goals away when Daily is pressed, and back again', async () => {
    const Wrapper = harness({ daily: daily('locked', 'claimable', 'locked', 'locked') });
    render(<Wrapper><RewardsScreen commander="Vantage" /></Wrapper>);
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /^Daily/ }));
    expect(screen.getByTestId('daily-quests')).toBeInTheDocument();
    expect(screen.queryByText('3 / 5')).toBeNull();
    expect(screen.getByRole('tab', { name: /^Daily/ })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: /^Goals/ }));
    expect(screen.queryByTestId('daily-quests')).toBeNull();
    expect(await screen.findByText('3 / 5')).toBeInTheDocument();
  });

  it('opens on the daily list when the daily key asked for it', () => {
    const Wrapper = harness({ daily: daily('locked', 'locked', 'locked', 'locked') });
    render(<Wrapper><RewardsScreen commander="Vantage" initialTab="daily" /></Wrapper>);
    expect(screen.getByRole('tab', { name: /^Daily/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('daily-quests')).toBeInTheDocument();
  });

  it('marks each tab with what waits behind it', () => {
    const Wrapper = harness({ daily: daily('claimable', 'locked', 'locked', 'locked') });
    render(<Wrapper><RewardsScreen commander="Vantage" /></Wrapper>);
    expect(within(screen.getByRole('tab', { name: /^Daily/ })).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /^Goals/ })).getByText('2')).toBeInTheDocument();
  });

  it('draws no tabs, and the goals as before, when the server has no daily list', async () => {
    const Wrapper = harness();
    render(<Wrapper><RewardsScreen commander="Vantage" /></Wrapper>);
    expect(await screen.findByText('3 / 5')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('keeps the daily list when the goals cannot be read', async () => {
    const Wrapper = harness({ goals: false, daily: daily('locked', 'claimable', 'locked', 'locked') });
    render(<Wrapper><RewardsScreen commander="Vantage" initialTab="daily" /></Wrapper>);
    expect(screen.getByTestId('daily-quests')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('tab', { name: /^Goals/ }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
