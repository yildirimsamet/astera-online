import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import type * as Sound from '../src/lib/sound.js';
import { ArrivalHost } from '../src/starter/ArrivalHost.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';
import { urlOf } from './starterVesselFixture.js';

const sound = vi.hoisted(() => ({ playSound: vi.fn() }));
const haptics = vi.hoisted(() => ({ haptic: vi.fn() }));
vi.mock('../src/lib/sound.js', async (original) => ({ ...await original<typeof Sound>(), ...sound }));
vi.mock('../src/lib/haptics.js', () => haptics);

type State = 'locked' | 'claimable' | 'claimed';
const chain = (id: string, states: State[]) => ({ id, metric: 'level', scope: 'season', progress: 3, tiers: states.map((state, i) => ({ id: `${id}:${String(i + 1)}`, goal: i + 1, alloy: 300, crystal: 100, state })) });
const waiting = (count: number) => ({ chains: [chain('CORE', [...Array<State>(count).fill('claimable'), 'locked'])], claimable: count });

const firstBox = { welcome: { opened: 0, box: 1, readyAt: new Date(Date.now() - 1000).toISOString(), preview: { alloy: 160, crystal: 240 } } };
const harness = ({ rewards, daysAgo = 0, welcome = { welcome: null } }: { rewards: object; daysAgo?: number; welcome?: object }) => {
  const taken = { chains: [chain('CORE', ['claimed', 'claimed', 'claimed', 'locked'])], claimable: 0 };
  const fetcher = vi.fn((input: RequestInfo | URL) => {
    const url = urlOf(input);
    const body = url.includes('/api/rewards/claim-all') ? { granted: { alloy: 900, crystal: 300, deuterium: 0 }, count: 3, rewards: taken, planet: planetView() }
      : url.includes('/api/rewards') ? rewards
        : url.includes('/api/welcome') ? welcome
        : url.includes('/api/reports') ? { reports: [], rivals: [] }
          : { arrival: null, landedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString() };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  });
  const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onPanel = vi.fn();
  render(<QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider><ArrivalHost onPanel={onPanel} /></ToastProvider></ApiProvider></QueryClientProvider>);
  return { fetcher, onPanel };
};
const claimedAll = (fetcher: ReturnType<typeof vi.fn>) => fetcher.mock.calls.filter(([input]) => urlOf(input as RequestInfo).includes('/api/rewards/claim-all'));

beforeEach(async () => { await i18n.changeLanguage('en'); window.localStorage.clear(); sound.playSound.mockClear(); haptics.haptic.mockClear(); });
afterEach(() => { cleanup(); });

/**
 * THE LANDING PAYS (plan 2026-11-06 §7, §7.1 R1). The first-season start earns several tiers at once and
 * the old panel hid them behind a gift icon. After the landing card, one moment says what the ship's work
 * is worth here, takes it all in one move, and points at the first upgrades to spend it on.
 */
describe('the landing reward moment', () => {
  // Owner phone playtest 2026-11-18 (item 15): "Take all · 7" read as all seven boxes with one box ready, and
  // "Upgrade" after it led away from the boxes. The repairs' reward is taken first, with one press that names
  // no count, and the moment goes on to the boxes; nothing in it leads elsewhere.
  it('says what the repairs are worth, takes it with one press, then says it is in the stores', async () => {
    const { fetcher, onPanel } = harness({ rewards: waiting(3) });
    const moment = await screen.findByTestId('landing-rewards');
    expect(moment).toHaveTextContent(/3 rewards/u);
    expect(moment).toHaveTextContent('900');
    expect(within(moment).queryByRole('button', { name: /Take all/u })).toBeNull();
    fireEvent.click(within(moment).getByRole('button', { name: 'Take the reward' }));
    await waitFor(() => { expect(claimedAll(fetcher)).toHaveLength(1); });
    expect(haptics.haptic).toHaveBeenCalledWith('thunk');
    await within(moment).findByText(/In your stores/u);
    expect(sound.playSound).toHaveBeenCalledWith('unseal');
    expect(within(moment).queryByRole('button', { name: /Upgrade/u })).toBeNull();
    fireEvent.click(within(moment).getByRole('button', { name: 'Continue' }));
    expect(onPanel).not.toHaveBeenCalled();
    expect(screen.queryByTestId('landing-rewards')).toBeNull();
  });

  it('comes once: closed, it does not come back', async () => {
    harness({ rewards: waiting(3) });
    fireEvent.click(within(await screen.findByTestId('landing-rewards')).getByRole('button', { name: /Later/u }));
    expect(screen.queryByTestId('landing-rewards')).toBeNull();
    cleanup();
    harness({ rewards: waiting(3) });
    await screen.findByTestId('landing-tip');
    expect(screen.queryByTestId('landing-rewards')).toBeNull();
  });

  it('waits for two or more rewards, and only in the first week', async () => {
    harness({ rewards: waiting(1) });
    await screen.findByTestId('landing-tip');
    expect(screen.queryByTestId('landing-rewards')).toBeNull();
    cleanup();
    harness({ rewards: waiting(3), daysAgo: 8 });
    await waitFor(() => { expect(screen.queryByTestId('landing-rewards')).toBeNull(); });
  });

  // Plan 2026-11-18 §6 (S6, 5.8): the seven boxes start at the landing, in this same moment, never a window of
  // their own; owner phone playtest 2026-11-18 (item 15): one after the other, the reward first, then the board.
  it('takes the repairs\' reward first, then shows the seven boxes, the first one ready to open where it stands', async () => {
    harness({ rewards: waiting(3), welcome: firstBox });
    const moment = await screen.findByTestId('landing-rewards');
    expect(within(moment).queryByTestId('welcome-week')).toBeNull();
    fireEvent.click(within(moment).getByRole('button', { name: 'Take the reward' }));
    const board = await within(moment).findByTestId('welcome-week');
    expect(within(board).getByTestId('welcome-box-1').dataset.state).toBe('ready');
    expect(within(moment).getByText(/In your stores/u)).toBeInTheDocument();
    expect(within(moment).getAllByText(/New Commander · 7 Boxes/u)).toHaveLength(1);
  });

  it('comes for the first box alone, with the board as the whole moment', async () => {
    harness({ rewards: waiting(0), welcome: firstBox });
    const moment = await screen.findByTestId('landing-rewards');
    expect(await within(moment).findByTestId('welcome-week')).toBeInTheDocument();
    expect(within(moment).queryByRole('button', { name: /Take all/u })).toBeNull();
    // The ribbon names the board, so the board does not say it twice.
    expect(within(moment).getAllByText(/New Commander · 7 Boxes/u)).toHaveLength(1);
  });

  it('does not come for a week already begun', async () => {
    harness({ rewards: waiting(1), welcome: { welcome: { ...firstBox.welcome, opened: 1, box: 2 } } });
    await screen.findByTestId('landing-tip');
    expect(screen.queryByTestId('landing-rewards')).toBeNull();
  });

  // Owner play-through 2026-11-18: the moment opened under the galaxy's event card and the top bar's note,
  // all of it at once. It is a dialog: it stands over the whole screen, alone.
  it('stands over the whole screen, over the galaxy\'s own cards', async () => {
    harness({ rewards: waiting(3) });
    const layer = await screen.findByTestId('landing-rewards');
    expect(layer).toHaveClass('fixed', 'inset-0', 'z-50');
  });

  it('puts the first-week note under the top bar and whatever note the bar holds, never over them', async () => {
    harness({ rewards: waiting(1) });
    const tip = await screen.findByTestId('landing-tip');
    expect(tip.className).toContain('top-[calc(var(--v2-top-h,96px)+6px)]');
  });

  it('holds the first-week note back while it is up', async () => {
    harness({ rewards: waiting(3) });
    await screen.findByTestId('landing-rewards');
    expect(screen.queryByTestId('landing-tip')).toBeNull();
  });
});
