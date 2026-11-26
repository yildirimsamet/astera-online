import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { useGoalRewardsWaiting, useRewardsWaiting } from '../src/api/queries.js';
import type { DailyQuests } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { dailyQuestsKey, dailyRefetchDelay } from '../src/lib/dailyQuests.js';
import { DailyChip } from '../src/v2/hud/GalaxyCorners.js';
import { urlOf } from './starterVesselFixture.js';

/**
 * THE DAILY KEY ON THE GALAXY (owner, 2026-11-24): a round key among the tools at the top right that
 * stands while today's quests are not all taken, lights its red count when a finished quest waits to be
 * claimed, and is gone once the last purse is in. It stays out of the gift's count, which keeps to the goals.
 */
type State = 'locked' | 'claimable' | 'claimed';
const row = (id: string, state: State) => ({ id, goal: 1, progress: state === 'locked' ? 0 : 1, state, alloy: 300, crystal: 130, honor: 250_000 });
const view = (...states: State[]): DailyQuests => {
  const ids = ['PROBES', 'RIFT', 'PIRATE', 'ASTEROID'];
  const quests = states.map((state, index) => row(ids[index] ?? `EXTRA${String(index)}`, state));
  return { day: '2026-11-24', resetsAt: new Date(Date.now() + 5 * 3_600_000), quests, claimable: quests.filter((quest) => quest.state === 'claimable').length };
};

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); });

describe('when the daily key stands', () => {
  it('has nothing to say until the server sends a panel, or when it sends none', () => {
    expect(dailyQuestsKey(undefined)).toBeNull();
    expect(dailyQuestsKey({ ...view(), quests: [] })).toBeNull();
  });

  it('stands on a fresh day with nothing done, counting no waiting purse', () => {
    expect(dailyQuestsKey(view('locked', 'locked', 'locked', 'locked'))).toEqual({ claimable: 0, taken: 0, total: 4 });
  });

  it('counts the finished quests that wait and the ones already taken', () => {
    expect(dailyQuestsKey(view('claimable', 'claimed', 'locked', 'claimable'))).toEqual({ claimable: 2, taken: 1, total: 4 });
  });

  it('stays while a finished quest is not yet taken, even when every other one is', () => {
    expect(dailyQuestsKey(view('claimed', 'claimed', 'claimed', 'claimable'))).toEqual({ claimable: 1, taken: 3, total: 4 });
  });

  it('is gone once every purse is taken', () => {
    expect(dailyQuestsKey(view('claimed', 'claimed', 'claimed', 'claimed'))).toBeNull();
  });

  it('counts only the quests this build knows, so one it has never heard of cannot keep the key up', () => {
    const quests = [...view('claimed', 'claimed', 'claimed', 'claimed').quests, row('SOMETHING_NEW', 'locked')];
    expect(dailyQuestsKey({ ...view(), quests })).toBeNull();
  });
});

describe('when the daily list is read again', () => {
  const now = Date.UTC(2026, 10, 24, 19, 0, 0);
  const HOUR = 3_600_000;

  it('waits for the reset and a little past it, so the next day’s key is on the screen when it starts', () => {
    expect(dailyRefetchDelay(new Date(now + 5 * HOUR), now)).toBe(5 * HOUR + 2_000);
  });

  it('never spins: a reset already behind it is read again in five seconds, not at once', () => {
    expect(dailyRefetchDelay(new Date(now - HOUR), now)).toBe(5_000);
    expect(dailyRefetchDelay(new Date(now + 500), now)).toBe(5_000);
  });

  it('does not read on a timer while it has nothing', () => {
    expect(dailyRefetchDelay(undefined, now)).toBe(false);
  });
});

describe('the daily key', () => {
  it('says how far the day is, and opens the daily list', async () => {
    const onOpen = vi.fn();
    render(<DailyChip claimable={0} taken={1} total={4} onOpen={onOpen} />);
    const key = screen.getByRole('button', { name: /Daily quests · 1\/4/ });
    expect(key).not.toHaveTextContent(/\d/u);
    await userEvent.click(key);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('lights its red count for a finished quest that waits', () => {
    render(<DailyChip claimable={2} taken={1} total={4} onOpen={vi.fn()} />);
    const key = screen.getByRole('button', { name: /Daily quests · 2 ready to claim/ });
    expect(key).toHaveTextContent('2');
  });
});

describe('the counts of the two keys', () => {
  const Counts = () => <output data-testid="counts">{`${String(useGoalRewardsWaiting())}|${String(useRewardsWaiting())}`}</output>;
  const mount = (goals: number, daily: DailyQuests) => {
    const fetcher = vi.fn((input: RequestInfo | URL) => {
      const url = urlOf(input);
      const body = url.includes('/api/daily-quests') ? daily : url.includes('/api/welcome') ? { welcome: null } : { chains: [], claimable: goals };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
    const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
    render(<QueryClientProvider client={new QueryClient()}><ApiProvider api={api}><Counts /></ApiProvider></QueryClientProvider>);
  };

  it('keeps a waiting daily purse out of the gift, and in what the menu and the status bar mark', async () => {
    mount(1, view('claimable', 'claimable', 'locked', 'locked'));
    await waitFor(() => { expect(screen.getByTestId('counts')).toHaveTextContent('1|3'); });
  });

  it('counts the same when nothing daily waits', async () => {
    mount(2, view('locked', 'locked', 'locked', 'locked'));
    await waitFor(() => { expect(screen.getByTestId('counts')).toHaveTextContent('2|2'); });
  });
});
