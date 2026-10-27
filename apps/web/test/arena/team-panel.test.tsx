import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamView } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import TeamPanel from '../../src/arena/TeamPanel.js';

const self = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const teamId = '00000000-0000-4000-8000-000000000003';
const clanId = '00000000-0000-4000-8000-000000000004';
const base = (): TeamView => ({ playerId: self, clanId, canCreate: true, capacity: 5, team: null, claims: [] });
const lobby = (ready = false): TeamView => ({ ...base(), canCreate: false, team: { id: teamId, state: 'forming', leaderId: self, joined: true,
  members: [self, other].map((playerId, i) => ({ playerId, name: i ? 'Bora' : 'Ada', ready, tactic: 'smoke', outcome: null, blocked: null,
    ship: { class: i ? 'muhafiz' : 'kilavuz', level: 3, fuel: 200, fuelMax: 250, readyAt: null } })) } });
function desk(routes: Record<string, TeamView[]>) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    expect(init?.headers).toMatchObject({ authorization: 'Bearer tok' });
    calls.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined });
    const answer = routes[url]?.shift();
    return Promise.resolve(new Response(JSON.stringify(answer ?? { error: 'TEAM_UNAVAILABLE' }), { status: answer ? 200 : 503,
      headers: { 'content-type': 'application/json' } }));
  }));
  return calls;
}
let previous = 'en';
beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); });
afterEach(async () => { vi.unstubAllGlobals(); await i18n.changeLanguage(previous); });

describe('Y7 clan team panel', () => {
  it('opens the loaded flight desk before offering readiness on the clan page', async () => {
    desk({ '/arena/team': [lobby()] }); const onEnter = vi.fn();
    render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={onEnter} prepareOnly />);
    fireEvent.click(await screen.findByRole('button', { name: 'Uçuşa hazırlan' }));
    expect(onEnter).toHaveBeenCalledWith(lobby());
    expect(screen.queryByRole('button', { name: 'Hazırım' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Birlikte kalk' })).toBeNull();
  });

  it('creates the clan lobby without client-supplied clan, resources or member identities', async () => {
    const calls = desk({ '/arena/team': [base()], '/arena/team/create': [lobby()] });
    render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Takım kur' }));
    await screen.findByText('Bora');
    expect(calls.find(c => c.url === '/arena/team/create')?.body).toEqual({});
    expect(screen.getByRole('button', { name: 'Birlikte kalk' })).toBeDisabled();
    expect(screen.getByText(/Ölen üye de payını alır/)).toBeInTheDocument();
  });

  it('confirms the chosen tactic, waits for everyone and enters once after the server starts the team', async () => {
    const all = lobby(true); const flying = { ...all, team: all.team ? { ...all.team, state: 'flying' as const } : null };
    const calls = desk({ '/arena/team': [lobby()], '/arena/team/ready': [all], '/arena/team/start': [flying] });
    const onEnter = vi.fn(); render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={onEnter} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Hazırım' }));
    const start = await screen.findByRole('button', { name: 'Birlikte kalk' });
    await waitFor(() => { expect(start).toBeEnabled(); }); fireEvent.click(start);
    await waitFor(() => { expect(onEnter).toHaveBeenCalledTimes(1); });
    expect(calls.find(c => c.url === '/arena/team/ready')?.body).toEqual({ teamId, ready: true, tactic: 'smoke' });
    expect(calls.find(c => c.url === '/arena/team/start')?.body).toEqual({ teamId });
  });

  it('takes the ready mark back when the pilot leaves the desk before launch, and says so while ready', async () => {
    const calls = desk({ '/arena/team': [lobby(true)], '/arena/team/ready': [lobby()] });
    const view = render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
    await screen.findByText('Kalkışa kadar bu ekranda kal. Ayrılırsan hazır işaretin kalkar.');
    view.unmount();
    await waitFor(() => { expect(calls.find(c => c.url === '/arena/team/ready')?.body).toEqual({ teamId, ready: false, tactic: 'smoke' }); });
  });

  it('takes the ready mark back when the phone hides the page', async () => {
    const calls = desk({ '/arena/team': [lobby(true)], '/arena/team/ready': [lobby()] });
    render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
    await screen.findByRole('button', { name: 'Hazır değilim' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    try { document.dispatchEvent(new Event('visibilitychange'));
      await waitFor(() => { expect(calls.find(c => c.url === '/arena/team/ready')?.body).toEqual({ teamId, ready: false, tactic: 'smoke' }); });
    } finally { Reflect.deleteProperty(document, 'hidden'); }
  });

  it('keeps the launch when the desk closes because the flight started', async () => {
    const all = lobby(true); const flying = { ...all, team: all.team ? { ...all.team, state: 'flying' as const } : null };
    const calls = desk({ '/arena/team': [all, flying] });
    const view = render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
    await screen.findByRole('button', { name: 'Takım uçuşuna geç' }, { timeout: 4000 });
    view.unmount();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(calls.some(c => c.url === '/arena/team/ready')).toBe(false);
  });

  it('names a repair and does not let that ship become ready', async () => {
    const view = lobby(); if (!view.team?.members[0]) throw new Error('no self');
    view.team.members[0].blocked = 'SHIP_NOT_READY'; view.team.members[0].ship = { class: 'kilavuz', level: 3, fuel: 200, fuelMax: 250, readyAt: '2026-10-25T12:00:00Z' };
    desk({ '/arena/team': [view] }); render(<TeamPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Hazırım' })).toBeDisabled();
    expect(screen.getAllByText(/Tamir veya bakım/).length).toBeGreaterThan(0);
  });

  it('keeps a share claimable outside the clan and shows what the daily cap kept out', async () => {
    const share = { alloy: 150, crystal: 60, deuterium: 3 };
    const before = { ...base(), clanId: null, canCreate: false, claims: [{ teamId, share, finishedAt: '2026-10-24T12:00:00Z', autoAt: '2026-10-31T12:00:00Z' }] };
    const after = { ...base(), claims: [], receipt: { deposit: { alloy: 100, crystal: 60, deuterium: 3 }, overflow: { alloy: 50, crystal: 0, deuterium: 0 } } };
    const calls = desk({ '/arena/team': [before], '/arena/team/claim': [after] });
    render(<TeamPanel credential={() => Promise.resolve('tok')} claimsOnly />);
    fireEvent.click(await screen.findByRole('button', { name: 'Payımı al' }));
    await screen.findByText(/Günlük sınırı aşan/);
    expect(calls.find(c => c.url === '/arena/team/claim')?.body).toEqual({ teamId });
    expect(screen.queryByRole('button', { name: 'Takım kur' })).toBeNull();
  });
  it('warns before the claim what today\'s limit would keep out, and when it resets', async () => {
    const share = { alloy: 150, crystal: 60, deuterium: 3 };
    const view = { ...base(), claims: [{ teamId, share, finishedAt: '2026-10-24T12:00:00Z', autoAt: '2026-10-31T12:00:00Z' }] };
    desk({ '/arena/team': [view] });
    render(<TeamPanel credential={() => Promise.resolve('tok')} claimsOnly
      room={{ left: { alloy: 100, crystal: 500, deuterium: 0 }, resetsAt: '2026-10-25T00:00:00.000Z' }} />);
    const warning = await screen.findByText(/Bugünkü sınır/);
    // 50 alloy and 3 D would not reach the capital; the crystal fits.
    const line = warning.closest('[data-claim-overflow]');
    expect(line?.textContent).toContain('+50'); expect(line?.textContent).toContain('+3');
    expect(line?.textContent).not.toContain('+60');
  });
  it('says nothing more when the whole share fits today', async () => {
    const share = { alloy: 150, crystal: 60, deuterium: 3 };
    desk({ '/arena/team': [{ ...base(), claims: [{ teamId, share, finishedAt: '2026-10-24T12:00:00Z', autoAt: '2026-10-31T12:00:00Z' }] }] });
    render(<TeamPanel credential={() => Promise.resolve('tok')} claimsOnly
      room={{ left: { alloy: 150, crystal: 60, deuterium: 3 }, resetsAt: '2026-10-25T00:00:00.000Z' }} />);
    await screen.findByRole('button', { name: 'Payımı al' });
    expect(document.querySelector('[data-claim-overflow]')).toBeNull();
  });
});
