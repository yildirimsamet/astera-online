import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import type * as Sound from '../src/lib/sound.js';
import { dailyQuestGate } from '../src/lib/dailyQuests.js';
import { DailyQuests } from '../src/screens/DailyQuests.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';
import { urlOf } from './starterVesselFixture.js';

const sound = vi.hoisted(() => ({ playSound: vi.fn() }));
const haptics = vi.hoisted(() => ({ haptic: vi.fn() }));
vi.mock('../src/lib/sound.js', async (original) => ({ ...await original<typeof Sound>(), ...sound }));
vi.mock('../src/lib/haptics.js', () => haptics);

type State = 'locked' | 'claimable' | 'claimed';
const row = (id: string, goal: number, progress: number, state: State, honor = 250_000) => ({ id, goal, progress, state, alloy: 300, crystal: 130, honor });
const view = (rows: ReturnType<typeof row>[], resetsInMs = 5 * 3_600_000) => ({
  day: '2026-11-24', resetsAt: new Date(Date.now() + resetsInMs).toISOString(), quests: rows,
  claimable: rows.filter(one => one.state === 'claimable').length,
});
const mixed = view([row('PROBES', 3, 2, 'locked'), row('RIFT', 1, 1, 'claimable'), row('PIRATE', 1, 0, 'locked'), row('ASTEROID', 1, 1, 'claimed')]);

const harness = (quests: object | null, onGo = vi.fn(), paidHonor = 250_000) => {
  const claimed = view([row('PROBES', 3, 2, 'locked', paidHonor), row('RIFT', 1, 1, 'claimed', paidHonor), row('PIRATE', 1, 0, 'locked', paidHonor), row('ASTEROID', 1, 1, 'claimed', paidHonor)]);
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);
    const post = init?.method === 'POST';
    const found = quests !== null && url.includes('/api/daily-quests');
    const body = found && post ? { granted: { alloy: 300, crystal: 130, honor: paidHonor }, quests: claimed, planet: planetView() } : quests;
    return Promise.resolve(new Response(JSON.stringify(body), { status: found ? 200 : 404, headers: { 'content-type': 'application/json' } }));
  });
  const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider><DailyQuests onGo={onGo} /></ToastProvider></ApiProvider></QueryClientProvider>);
  return { fetcher, onGo };
};

beforeEach(async () => { await i18n.changeLanguage('en'); window.localStorage.clear(); sound.playSound.mockClear(); haptics.haptic.mockClear(); });
afterEach(() => { cleanup(); });

/**
 * GÜNLÜK GÖREVLER on the phone (owner, 2026-11-24). The panel answers three questions at a glance: what
 * is today's list, how far am I, and what do I do next. Each row says what it pays and either takes the
 * player to the place it is done or takes the purse.
 */
describe('the daily quests panel', () => {
  it('lists the four quests with their progress, and says when they start again', async () => {
    harness(mixed);
    const panel = await screen.findByTestId('daily-quests');
    expect(within(panel).getAllByRole('listitem')).toHaveLength(4);
    expect(panel).toHaveTextContent(/Send 3 probes/u);
    expect(panel).toHaveTextContent(/2 \/ 3/u);
    expect(panel).toHaveTextContent(/Resets in/u);
  });

  it('says on every row what the quest pays in Honor, beside the purse', async () => {
    harness(mixed);
    const panel = await screen.findByTestId('daily-quests');
    for (const quest of panel.querySelectorAll<HTMLElement>('[data-quest]')) expect(quest).toHaveTextContent(/0\.25\s*Honor/u);
  });

  it('says nothing of Honor where the season pays none, rather than promising 0', async () => {
    const none = view([row('PROBES', 3, 2, 'locked', 0), row('RIFT', 1, 1, 'claimable', 0), row('PIRATE', 1, 0, 'locked', 0), row('ASTEROID', 1, 1, 'claimed', 0)]);
    harness(none);
    const panel = await screen.findByTestId('daily-quests');
    expect(within(panel).getAllByRole('listitem')).toHaveLength(4);
    expect(panel).not.toHaveTextContent(/Honor/u);
  });

  it('shows a ready purse as a claim key and a finished one as taken, never both', async () => {
    harness(mixed);
    const panel = await screen.findByTestId('daily-quests');
    const rift = panel.querySelector<HTMLElement>('[data-quest="RIFT"]')!;
    const asteroid = panel.querySelector<HTMLElement>('[data-quest="ASTEROID"]')!;
    expect(within(rift).getByRole('button', { name: /Claim/u })).toBeEnabled();
    expect(within(asteroid).queryByRole('button')).toBeNull();
    expect(asteroid).toHaveTextContent(/Taken/u);
  });

  it('takes a locked quest to the place it is done, and each to its own', async () => {
    const { onGo } = harness(mixed);
    const panel = await screen.findByTestId('daily-quests');
    const user = userEvent.setup();
    await user.click(within(panel.querySelector<HTMLElement>('[data-quest="PROBES"]')!).getByRole('button', { name: /Go/u }));
    expect(onGo).toHaveBeenLastCalledWith({ kind: 'probe' });
    await user.click(within(panel.querySelector<HTMLElement>('[data-quest="PIRATE"]')!).getByRole('button', { name: /Go/u }));
    expect(onGo).toHaveBeenLastCalledWith({ kind: 'pirate' });
  });

  it('claims through the server, says what landed, and turns the row to taken', async () => {
    const { fetcher } = harness(mixed);
    const panel = await screen.findByTestId('daily-quests');
    const rift = panel.querySelector<HTMLElement>('[data-quest="RIFT"]')!;
    await userEvent.setup().click(within(rift).getByRole('button', { name: /Claim/u }));
    await waitFor(() => { expect(rift).toHaveTextContent(/Taken/u); });
    const call = fetcher.mock.calls.find(([input]) => urlOf(input as RequestInfo).includes('/api/daily-quests/claim'))!;
    expect(JSON.parse(z.string().parse(call[1]!.body))).toEqual({ id: 'RIFT' });
    expect(await screen.findByText(/\+300/u)).toBeInTheDocument();
    expect(await screen.findByText(/\+0\.25 Honor/u)).toBeInTheDocument();
    expect(haptics.haptic).toHaveBeenCalled();
    expect(sound.playSound).toHaveBeenCalled();
  });

  it('names only the purse in the toast when the claim paid no Honor', async () => {
    const none = view([row('PROBES', 3, 2, 'locked', 0), row('RIFT', 1, 1, 'claimable', 0), row('PIRATE', 1, 0, 'locked', 0), row('ASTEROID', 1, 1, 'claimed', 0)]);
    harness(none, vi.fn(), 0);
    const panel = await screen.findByTestId('daily-quests');
    const rift = panel.querySelector<HTMLElement>('[data-quest="RIFT"]')!;
    await userEvent.setup().click(within(rift).getByRole('button', { name: /Claim/u }));
    expect(await screen.findByText(/\+300 alloy/u)).toBeInTheDocument();
    expect(screen.queryByText(/Honor/u)).toBeNull();
  });

  it('stays out of the way while it loads and when the server has no panel for this commander', async () => {
    harness(null);
    await waitFor(() => { expect(screen.queryByTestId('daily-quests')).toBeNull(); });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('where each quest is done', () => {
  it('sends the probes to the map, the pirate hunt to the pirates, the asteroid to the rocks and the Yarık to the commander ship', () => {
    expect(dailyQuestGate('PROBES')).toEqual({ kind: 'probe' });
    expect(dailyQuestGate('PIRATE')).toEqual({ kind: 'pirate' });
    expect(dailyQuestGate('ASTEROID')).toEqual({ kind: 'mine' });
    expect(dailyQuestGate('RIFT')).toEqual({ kind: 'hangar' });
  });

  it('knows no place for a quest it has never heard of', () => {
    expect(dailyQuestGate('FUTURE')).toBeNull();
  });
});
