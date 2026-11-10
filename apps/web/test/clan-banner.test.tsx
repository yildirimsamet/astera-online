import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { clanLedgerSchema, clanWarSchema, type ClanLedger, type ClanWar } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { ClanBanner } from '../src/screens/ClanBanner.js';

/**
 * KLAN SANCAĞI + KATKI DEFTERİ (F2 P1 · P6, owner 2026-11-10). Ten notches on a hanging banner:
 * the open perks glow, the next one says what it opens and how full the purse is; the leader
 * raises it with a hold. Under it, who carries the clan this season, own row lit.
 */

const war = (over: Record<string, unknown> = {}): ClanWar => clanWarSchema.parse({
  available: true, level: 2, maxLevel: false,
  treasury: { alloy: 1130, crystal: 300, deuterium: 0 },
  nextCost: { alloy: 2260, crystal: 609, deuterium: 0 },
  room: { alloy: 1130, crystal: 309, deuterium: 0 }, canUpgrade: false,
  hangar: { used: 0, reserved: 0, total: 160 }, serverNow: '2026-11-10T12:00:00Z', operation: null,
  ...over,
});

const ledger = (): ClanLedger => clanLedgerSchema.parse({ members: [
  { playerId: 'me', name: 'Vantage', donated: { alloy: 900, crystal: 200, deuterium: 0 }, towardNext: { alloy: 400, crystal: 100, deuterium: 0 },
    supportWaves: 2, supportShips: 40, supportBattles: 1, alarmAnswers: 1, aidSent: 0, jointWar: 0 },
  { playerId: 'ayse', name: 'Ayşe', donated: { alloy: 2000, crystal: 300, deuterium: 0 }, towardNext: { alloy: 730, crystal: 200, deuterium: 0 },
    supportWaves: 7, supportShips: 210, supportBattles: 3, alarmAnswers: 4, aidSent: 2, jointWar: 1 },
  { playerId: 'quiet', name: 'Quiet', donated: { alloy: 0, crystal: 0, deuterium: 0 }, towardNext: { alloy: 0, crystal: 0, deuterium: 0 },
    supportWaves: 0, supportShips: 0, supportBattles: 0, alarmAnswers: 0, aidSent: 0, jointWar: 0 },
] });

function show(given: ClanWar, role: 'LEADER' | 'MEMBER' = 'MEMBER', book: ClanLedger | null = ledger()) {
  const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(
    JSON.stringify(url.endsWith('/api/clan/ledger') ? book : { level: (given.level ?? 1) + 1 }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  render(<QueryClientProvider client={client}><ApiProvider api={api}>
    <ClanBanner war={given} role={role} selfPlayerId="me" canGive onDonate={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
  return { api, fetch };
}

describe('the clan banner', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('lights the rungs the clan has reached and names the next', () => {
    show(war());
    const notches = document.querySelectorAll('[data-rung]');
    expect(notches).toHaveLength(10);
    expect([...notches].filter((notch) => notch.getAttribute('data-state') === 'open')).toHaveLength(2);
    expect(document.querySelector('[data-rung="3"]')).toHaveAttribute('data-state', 'next');
    const card = document.querySelector<HTMLElement>('[data-rung-card]')!;
    expect(card).toHaveTextContent(/level 3 · clan corridor ×3/i);
    expect(card).toHaveTextContent(/first leg 3× faster/i);
    expect(card).toHaveTextContent(/treasury 50% full/i);
    // The rung wears its perk's art.
    expect(card.querySelector('[data-perk-art="CORRIDOR"]')).toHaveAttribute('src', expect.stringContaining('perk-corridor'));
  });

  it('lists what the clan already has', () => {
    show(war());
    expect(document.querySelector('[data-perks-open]')).toHaveTextContent(/clan corridor ×2 · clan alarm/i);
  });

  it('explains a rung on tap, locked ones included', async () => {
    show(war());
    await userEvent.click(screen.getByRole('button', { name: /level 6/i }));
    expect(document.querySelector('[data-rung-card]')).toHaveTextContent(/shared furnace \+1% per active member/i);
    expect(document.querySelector('[data-rung-card]')).toHaveTextContent(/locked/i);
    await userEvent.click(screen.getByRole('button', { name: /level 2/i }));
    expect(document.querySelector('[data-rung-card]')).toHaveTextContent(/open/i);
  });

  it('turns gold at the top', () => {
    show(war({ level: 10, maxLevel: true, nextCost: null, room: null }));
    expect(document.querySelector('[data-banner]')).toHaveAttribute('data-gold', 'true');
    expect(document.querySelector('[data-rung-card]')).toHaveTextContent(/all ten rungs are open/i);
    expect(document.querySelector('[data-rung-card] [data-perk-art="BANNER"]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hold to raise/i })).toBeNull();
  });

  it('lets only the leader raise it, with a hold, once the purse is full', async () => {
    show(war(), 'MEMBER');
    expect(screen.queryByText(/raise to level 3/i)).toBeNull();
    document.body.innerHTML = '';
    const { api } = show(war({ canUpgrade: true, treasury: { alloy: 2260, crystal: 609, deuterium: 0 } }), 'LEADER');
    const upgrade = vi.spyOn(api, 'upgradeClanLevel');
    const hold = within(document.querySelector<HTMLElement>('[data-banner-raise]')!).getByRole('button');
    expect(hold).toHaveTextContent(/raise to level 3/i);
    fireEvent.keyDown(hold, { key: 'Enter' });
    fireEvent.keyDown(hold, { key: 'Enter' });
    await waitFor(() => { expect(upgrade).toHaveBeenCalledWith(2); });
  });

  it('says why the leader cannot raise it yet', () => {
    show(war(), 'LEADER');
    expect(within(document.querySelector<HTMLElement>('[data-banner-raise]')!).getByRole('button'))
      .toHaveTextContent(/fill the treasury first/i);
  });
});

describe('the contribution ledger', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('lists who carries the clan, biggest first, and lights your own row', async () => {
    show(war());
    const rows = await screen.findAllByTestId('ledger-row');
    expect(rows.map((row) => row.getAttribute('data-player'))).toEqual(['ayse', 'me', 'quiet']);
    expect(rows[1]).toHaveAttribute('data-self', 'true');
    expect(rows[0]).toHaveTextContent(/7 support waves/i);
    expect(rows[0]).toHaveTextContent(/4 alarms answered/i);
    expect(rows[2]).toHaveTextContent(/nothing yet this season/i);
  });

  it('splits the purse bar by donor', async () => {
    show(war());
    await screen.findAllByTestId('ledger-row');
    const slices = [...document.querySelectorAll<HTMLElement>('[data-purse-slice]')];
    expect(slices.map((slice) => slice.getAttribute('data-purse-slice'))).toEqual(['ayse', 'me']);
    // 930 of 2869 for Ayşe, 500 for me.
    expect(slices[0]!.style.width).toBe('32.4%');
    expect(slices[1]!.style.width).toBe('17.4%');
  });
});
