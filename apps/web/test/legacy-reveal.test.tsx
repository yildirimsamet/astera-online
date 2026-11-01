import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { LegacyRevealHost } from '../src/legacy/AwardReveal.js';
import i18n from '../src/i18n/index.js';
import { galaxyCover } from '../src/lib/galaxyCover.js';

vi.mock('../src/legacy/snapshot.js', () => ({ useAwardSnapshot: () => null }));

beforeEach(async () => { await i18n.changeLanguage('en'); });

const award = (n: number, definitionId: string, over: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, definitionId, tier: 1, edition: 'career',
  category: 'COMBAT', form: 'MEDAL', rarity: 'COMMON', sourceSeasonId: null,
  earnedAt: '2026-10-01T00:00:00.000Z', grantedAt: '2026-10-01T00:00:00.000Z', seasonOrdinal: null, rank: null, ...over,
});
const honor = award(1, 'honor-podium', { category: 'SEASON', form: 'TROPHY', rarity: 'LEGENDARY', edition: 'season:x', seasonOrdinal: 12, rank: 1 });
const pirate = award(2, 'pirate-hunter', { tier: 2, rarity: 'RARE' });
const probe = award(3, 'deep-sight');
const coin = award(4, 'season-memento', { category: 'SEASON', form: 'COIN', edition: 'cycle:x', seasonOrdinal: 12 });
const pin = award(5, 'year-of-service', { category: 'CAREER', form: 'PIN', edition: 'year:2026' });
const me = { publicId: '00000000-0000-4000-9000-000000000001', commanderName: 'Mira', country: null,
  joinedAt: '2026-01-01T00:00:00.000Z', portrait: 'x', backdrop: 'x', self: true, activeTitle: null,
  collection: { count: 5 }, career: { seasons: 1, bestHonorRank: 1, bestDominionRank: null }, showcase: [] };

function show(queue: unknown[], ready = true) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  let waiting = [...queue];
  const api = new Api({ fetch: (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input, 'http://x');
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ method: init?.method ?? 'GET', path: url.pathname + url.search, body });
    const reply = (value: unknown) => Promise.resolve(new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } }));
    if (url.pathname === '/api/legacy/me/reveals' && init?.method === 'POST') {
      const ids = (body as { awardIds: string[] }).awardIds;
      waiting = waiting.filter(row => !ids.includes((row as { id: string }).id));
      return reply({ revealed: ids.length });
    }
    if (url.pathname === '/api/legacy/me/reveals') return reply({ awards: waiting, total: waiting.length });
    if (url.pathname === '/api/legacy/me') return reply(me);
    return reply({ ok: true });
  } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  const view = render(<LegacyRevealHost ready={ready} live={false} />, { wrapper });
  return { calls, view };
}
const acks = (calls: { method: string; body: unknown }[]) => calls.filter(call => call.method === 'POST').map(call => (call.body as { awardIds: string[] }).awardIds);
const finishIntro = () => { fireEvent.click(screen.getByTestId('legacy-reveal')); };

describe('revealing a won piece', () => {
  it('owns focus and covers the galaxy, and lets Escape leave unseen pieces for next time', async () => {
    const opener = document.createElement('button');
    document.body.append(opener); opener.focus();
    const { calls } = show([honor]);
    const dialog = await screen.findByTestId('legacy-reveal');
    await waitFor(() => { expect(dialog).toHaveFocus(); });
    expect(galaxyCover()).toBe('whole');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => { expect(screen.queryByTestId('legacy-reveal')).toBeNull(); });
    expect(acks(calls)).toEqual([]);
    expect(galaxyCover()).toBeNull();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('keeps keyboard navigation inside the revealed actions', async () => {
    show([honor]);
    const dialog = await screen.findByTestId('legacy-reveal');
    finishIntro();
    const close = await screen.findByRole('button', { name: i18n.t('legacy.reveal.close') });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole('button', { name: i18n.t('legacy.award.showOnShelf') })).toHaveFocus();
  });
  it('evaluates once, reveals the rarest first and marks each piece seen only after it was shown', async () => {
    const { calls } = show([pirate, honor]);
    expect(await screen.findByRole('dialog', { name: i18n.t('legacy.reveal.eyebrow') })).toBeInTheDocument();
    expect(calls[0]?.path).toBe('/api/legacy/me/reveals?refresh=1');
    expect(screen.getByText('Honor Champion')).toBeInTheDocument();
    expect(acks(calls)).toEqual([]);
    finishIntro();
    await waitFor(() => { expect(acks(calls)).toEqual([[honor.id]]); });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('legacy.reveal.next') }));
    expect(screen.getByText('Pirate Hunter II')).toBeInTheDocument();
    finishIntro();
    await waitFor(() => { expect(acks(calls)).toEqual([[honor.id], [pirate.id]]); });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('legacy.reveal.close') }));
    await waitFor(() => { expect(screen.queryByTestId('legacy-reveal')).toBeNull(); });
  });

  it('finishes the entrance on its own when nobody taps', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { calls } = show([probe]);
      await screen.findByTestId('legacy-reveal');
      await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
      await waitFor(() => { expect(acks(calls)).toEqual([[probe.id]]); });
    } finally { vi.useRealTimers(); }
  });

  it('does not mark a piece watched while the app is hidden and resumes its entrance on return', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const visible = vi.spyOn(document, 'visibilityState', 'get');
      const { calls } = show([probe]);
      await screen.findByTestId('legacy-reveal');
      visible.mockReturnValue('hidden');
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
      expect(acks(calls)).toEqual([]);
      visible.mockReturnValue('visible');
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
      await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
      await waitFor(() => { expect(acks(calls)).toEqual([[probe.id]]); });
    } finally { vi.useRealTimers(); }
  });

  it('opens the rest of a long queue together after the first three, and marks them seen together', async () => {
    const { calls } = show([honor, pirate, probe, coin, pin]);
    await screen.findByTestId('legacy-reveal');
    for (let step = 0; step < 3; step++) {
      finishIntro();
      if (step < 2) fireEvent.click(await screen.findByRole('button', { name: i18n.t('legacy.reveal.next') }));
    }
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('legacy.reveal.openRest', { count: 2 }) }));
    expect(screen.getAllByTestId('legacy-reveal-rest-piece')).toHaveLength(2);
    finishIntro();
    await waitFor(() => { expect(acks(calls).at(-1)?.sort()).toEqual([coin.id, pin.id].sort()); });
  });

  it('waits while the galaxy is busy and shows nothing when nothing was won', async () => {
    const busy = show([honor], false);
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(screen.queryByTestId('legacy-reveal')).toBeNull();
    busy.view.unmount();
    const { calls } = show([]);
    await waitFor(() => { expect(calls.length).toBeGreaterThan(0); });
    expect(screen.queryByTestId('legacy-reveal')).toBeNull();
  });
});
