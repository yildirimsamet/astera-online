import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { clanWarSchema } from '../src/api/schemas.js';
import { ClanWarPanel } from '../src/screens/ClanWarPanel.js';
import { planetView } from './fixtures.js';

const empty = clanWarSchema.parse({
  available: true, level: 1, maxLevel: false,
  treasury: { alloy: 0, crystal: 0, deuterium: 0 },
  nextCost: { alloy: 100, crystal: 100, deuterium: 10 },
  room: { alloy: 100, crystal: 100, deuterium: 10 }, canUpgrade: false,
  hangar: { used: 0, reserved: 0, total: 160 },
  serverNow: '2026-09-20T12:00:00Z', operation: null,
});

const active = clanWarSchema.parse({ ...empty, operation: {
  id: 'op', status: 'ASSEMBLING', closeReason: null, leaderPlayerId: 'leader',
  target: { playerId: 'enemy', username: 'Rival', planetId: 'target',
    planetName: 'Vega', position: { x: 1, y: 2, z: 3 } },
  staging: { planetId: 'home', name: 'Home', position: { x: 0, y: 0, z: 0 } },
  createdAt: '2026-09-20T12:00:00Z', expiresAt: '2026-09-21T12:00:00Z',
  startedAt: null, resolvedAt: null, completedAt: null,
  contributions: [], pool: { combatHulls: 0, waves: 0, participants: 0 },
} });

const launchReady = clanWarSchema.parse({ ...empty, operation: {
  ...active.operation!,
  contributions: [{ id: 'wave', playerId: 'member', username: 'Scout',
    originPlanetId: 'origin-a', originPlanetName: 'Origin A', sourceKind: 'PHYSICAL',
    status: 'STAGED', fleet: { DART: 3 }, bulk: 3, fuelPaid: 18,
    sentAt: '2026-09-20T12:01:00Z', arrivesAt: null, mine: false, canRecall: false }],
  pool: { combatHulls: 3, waves: 1, participants: 1 },
} });

const origin = planetView({}, { id: 'origin-a', name: 'Origin A', alloy: 40 });
const other = planetView({ fleet: {} }, { id: 'origin-b', name: 'Origin B', alloy: 8 });

function show(
  war = empty,
  role: 'LEADER' | 'MEMBER' = 'LEADER',
  worlds: readonly ReturnType<typeof planetView>[] = [],
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  render(<QueryClientProvider client={client}><ApiProvider api={api}>
    <ClanWarPanel war={war} role={role} mature worlds={worlds} />
  </ApiProvider></QueryClientProvider>);
  return { api, client };
}

/** The held commit of the wave composer; its face carries the reason it cannot send. */
const send = (): HTMLElement => within(document.querySelector<HTMLElement>('[data-wave-commit]')!).getByRole('button');

const shieldQuote = {
  ok: false,
  refusals: [{ code: 'SHIELD_WOULD_DROP', message: 'Sending drops your shield' }],
  sourceKind: 'PHYSICAL' as const, bulk: 1,
  fuel: { legs: [], total: 2, available: 50 },
  travel: { stagingMinutes: 2, combinedMinutes: 3, returnMinutes: 4,
    stagingEta: new Date('2026-09-20T12:02:00Z'),
    earliestHome: new Date('2026-09-20T12:09:00Z') },
  bays: { used: 0, total: 3 },
  personalHangar: { used: 12, total: 160, afterSend: 11 },
  clanHangar: { used: 0, reserved: 0, total: 160, afterSend: 1 },
  latestStartAt: new Date('2026-09-21T11:00:00Z'), canFinishBeforeSeasonEnd: true,
  shieldWouldDrop: { kind: 'NEWCOMER' as const, until: new Date('2026-09-21T12:00:00Z') },
};

describe('clan war decision surface', () => {
  it('explains shared capacity and where a leader selects a target', () => {
    show();
    expect(screen.getByText(/Galaxy Focus/i)).toBeInTheDocument();
    expect(screen.getByText(/160/)).toBeInTheDocument();
  });

  it('shows a waiting wave and the reason launch is blocked', () => {
    show(clanWarSchema.parse({ ...empty, operation: {
      id: 'op', status: 'ASSEMBLING', closeReason: null, leaderPlayerId: 'leader',
      target: { playerId: 'enemy', username: 'Rival', planetId: 'target',
        planetName: 'Vega', position: { x: 1, y: 2, z: 3 } },
      staging: { planetId: 'home', name: 'Home', position: { x: 0, y: 0, z: 0 } },
      createdAt: '2026-09-20T12:00:00Z', expiresAt: '2026-09-21T12:00:00Z',
      startedAt: null, resolvedAt: null, completedAt: null,
      contributions: [{ id: 'wave', playerId: 'member', username: 'Scout',
        originPlanetId: 'origin', originPlanetName: 'Origin', sourceKind: 'PHYSICAL',
        status: 'OUTBOUND', fleet: { DART: 3 }, bulk: 3, fuelPaid: 18,
        sentAt: '2026-09-20T12:01:00Z', arrivesAt: '2026-09-20T12:10:00Z',
        mine: false, canRecall: false }],
      pool: { combatHulls: 3, waves: 1, participants: 1 },
    } }), 'LEADER');
    expect(screen.getByText(/Scout · Origin/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start|launch/i })).toBeDisabled();
    expect(screen.getByText(/support.*arriv|destek filosu/i)).toBeInTheDocument();
  });

  /**
   * THE QUOTE ASKS ITSELF (B14). "Hesapla" was a button between the fleet and its
   * price: the route, the fuel and the refusals now follow the ships as they are picked.
   */
  it('quotes the wave by itself once ships are picked, with no button to press', async () => {
    const { api } = show(active, 'MEMBER', [origin]);
    const quote = vi.spyOn(api, 'quoteClanWar').mockResolvedValue(shieldQuote);
    expect(screen.queryByRole('button', { name: /check route|quote/i })).toBeNull();
    expect(send()).toHaveTextContent(/choose at least one ship/i);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more dart/i }));

    await waitFor(() => { expect(quote).toHaveBeenCalledWith({ originPlanetId: 'origin-a', fleet: { DART: 1 } }); });
    expect(await screen.findByText(/called back until the strike starts/i)).toBeInTheDocument();
  });

  it('holds the send until a protected commander acknowledges the shield, then sends on the hold', async () => {
    const { api } = show(active, 'MEMBER', [origin]);
    vi.spyOn(api, 'quoteClanWar').mockResolvedValue(shieldQuote);
    // Never settles: what is asserted is the request the hold sends.
    const contribute = vi.spyOn(api, 'contributeClanWar').mockReturnValue(new Promise<never>(() => undefined));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more dart/i }));

    await waitFor(() => { expect(send()).toHaveTextContent(/confirm the shield/i); });
    expect(send()).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /shield will end/i }));
    expect(send()).toBeEnabled();
    expect(send()).toHaveAttribute('data-hold');

    // The commit is held (K4); Enter twice is the keyboard's hold.
    fireEvent.keyDown(send(), { key: 'Enter' });
    fireEvent.keyDown(send(), { key: 'Enter' });
    await waitFor(() => {
      expect(contribute).toHaveBeenCalledWith({ originPlanetId: 'origin-a', fleet: { DART: 1 }, acknowledgeShieldLoss: true });
    });
  });

  it('clears a composed fleet when its origin world changes', async () => {
    show(active, 'MEMBER', [origin, other]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));
    expect(screen.getByRole('textbox', { name: /dart/i })).not.toHaveValue('0');

    await user.selectOptions(document.querySelector<HTMLSelectElement>('#clan-war-origin')!, 'origin-b');

    expect(screen.queryByRole('textbox', { name: /dart/i })).toBeNull();
    expect(send()).toHaveTextContent(/choose at least one ship/i);
    expect(send()).toBeDisabled();
  });

  it('keeps donation and fleet origins independent and caps a gift by world stock', async () => {
    show(active, 'MEMBER', [origin, other]);
    const user = userEvent.setup();
    const donor = document.querySelector<HTMLSelectElement>('#clan-war-donor')!;
    const fleetOrigin = document.querySelector<HTMLSelectElement>('#clan-war-origin')!;

    await user.selectOptions(donor, 'origin-b');

    expect(fleetOrigin).toHaveValue('origin-a');
    const alloy = screen.getByRole('spinbutton', { name: /^alloy/i });
    expect(alloy).toHaveAttribute('max', '8');
    await waitFor(() => expect(donor).toHaveValue('origin-b'));
  });

  it('does not ask an unprotected leader to acknowledge shield loss', () => {
    show(launchReady, 'LEADER', [origin]);

    expect(screen.queryByRole('checkbox', { name: /shield will end/i })).toBeNull();
    expect(screen.getByRole('button', { name: /start joint attack/i })).toBeEnabled();
  });

  it('requires acknowledgement when the authoritative launch view says the shield will drop', async () => {
    const protectedWar = clanWarSchema.parse({ ...launchReady, operation: {
      ...launchReady.operation!,
      startShieldWouldDrop: { kind: 'RECOVERY', until: '2026-09-21T12:00:00Z' },
    } });
    show(protectedWar, 'LEADER', [origin]);
    const launch = screen.getByRole('button', { name: /start joint attack/i });

    expect(launch).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('checkbox', { name: /shield will end/i }));
    expect(launch).toBeEnabled();
  });
});

/**
 * THE LEADER CHOOSES WHEN THE JOINT STRIKE LANDS. Review 2026-09-22, finding #2 · plan §15.5a.
 *
 * The rungs are worth nothing without the arrival they move, so the server hands the panel the
 * combined leg at full speed and the row divides it — the leader watches "lands in" change.
 */
describe('choosing when the joint strike lands', () => {
  const timed = (strikeMinutes: number | null) => clanWarSchema.parse({ ...launchReady, operation: {
    ...launchReady.operation!,
    pool: { ...launchReady.operation!.pool, strikeMinutes },
  } });

  it('offers the speeds and moves the arrival with them', async () => {
    show(timed(60), 'LEADER', [origin]);
    const row = document.querySelector<HTMLElement>('[data-clan-pace]');
    expect(row).toBeTruthy();
    const rungs = within(row!).getAllByRole('radio');
    expect(rungs.length).toBeGreaterThan(1);
    expect(rungs[0]).toBeChecked();

    const eta = document.querySelector<HTMLElement>('[data-clan-strike-eta]')!;
    const atFullSpeed = eta.textContent;
    await userEvent.setup().click(rungs[rungs.length - 1]!);
    expect(eta.textContent).not.toBe(atFullSpeed);
  });

  it('sends the chosen speed with the launch', async () => {
    const { api } = show(timed(60), 'LEADER', [origin]);
    const started = vi.spyOn(api, 'startClanWar').mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    const rungs = within(document.querySelector<HTMLElement>('[data-clan-pace]')!).getAllByRole('radio');
    await user.click(rungs[1]!);
    await user.click(screen.getByRole('button', { name: /start joint attack/i }));

    expect(started).toHaveBeenCalledWith(false, 0.75);
  });

  it('shows no speeds until a wave is staged to time', () => {
    show(timed(null), 'LEADER', [origin]);
    expect(document.querySelector('[data-clan-pace]')).toBeNull();
    expect(document.querySelector('[data-clan-strike-eta]')).toBeNull();
  });
});
