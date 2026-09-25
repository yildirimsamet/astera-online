import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { clanWarSchema } from '../src/api/schemas.js';
import { ClanDonateSheet } from '../src/screens/ClanDonateSheet.js';
import { ClanWarPanel, type WarSeatMember } from '../src/screens/ClanWarPanel.js';
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

const crew: WarSeatMember[] = [
  { playerId: 'leader', username: 'Vantage' },
  { playerId: 'member', username: 'Scout' },
];

function show(
  war = empty,
  role: 'LEADER' | 'MEMBER' = 'LEADER',
  worlds: readonly ReturnType<typeof planetView>[] = [],
  members: readonly WarSeatMember[] = crew,
  onOpenClanChat = vi.fn(),
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  render(<QueryClientProvider client={client}><ApiProvider api={api}>
    <ClanWarPanel war={war} role={role} mature worlds={worlds} members={members}
      selfPlayerId="leader" onOpenClanChat={onOpenClanChat} />
  </ApiProvider></QueryClientProvider>);
  return { api, client, onOpenClanChat };
}

/** The wave goes from its own launch page (E9 → B14): opened by "Send a wave". */
const openWave = async (): Promise<void> => {
  await userEvent.setup().click(screen.getByRole('button', { name: /^send a wave/i }));
};
/** The held commit of the wave page; its face carries the reason it cannot send. */
const send = (): HTMLElement => within(document.querySelector<HTMLElement>('[data-wave-commit]')!).getByRole('button');
/** The leader's held launch of the joint strike (K4). */
const strike = (): HTMLElement => within(document.querySelector<HTMLElement>('[data-strike-commit]')!).getByRole('button');
const hold = (button: HTMLElement): void => {
  fireEvent.keyDown(button, { key: 'Enter' });
  fireEvent.keyDown(button, { key: 'Enter' });
};

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
    expect(document.querySelector('[data-clan-hangar]')).toHaveTextContent(/160/);
  });

  it('shows a waiting wave and the reason launch is blocked, on the held launch itself', () => {
    show(clanWarSchema.parse({ ...empty, operation: {
      ...active.operation!,
      contributions: [{ id: 'wave', playerId: 'member', username: 'Scout',
        originPlanetId: 'origin', originPlanetName: 'Origin', sourceKind: 'PHYSICAL',
        status: 'OUTBOUND', fleet: { DART: 3 }, bulk: 3, fuelPaid: 18,
        sentAt: '2026-09-20T12:01:00Z', arrivesAt: '2026-09-20T12:10:00Z',
        mine: false, canRecall: false }],
      pool: { combatHulls: 3, waves: 1, participants: 1 },
    } }), 'LEADER');
    expect(screen.getByText(/Scout · Origin/)).toBeInTheDocument();
    expect(strike()).toBeDisabled();
    expect(strike()).toHaveTextContent(/support.*arriv/i);
  });

  /**
   * THE QUOTE ASKS ITSELF (B14). "Hesapla" was a button between the fleet and its
   * price: the route, the fuel and the refusals now follow the ships as they are picked.
   */
  it('quotes the wave by itself once ships are picked, with no button to press', async () => {
    const { api } = show(active, 'MEMBER', [origin]);
    const quote = vi.spyOn(api, 'quoteClanWar').mockResolvedValue(shieldQuote);
    await openWave();
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
    await openWave();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more dart/i }));

    await waitFor(() => { expect(send()).toHaveTextContent(/confirm the shield/i); });
    expect(send()).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /shield will end/i }));
    expect(send()).toBeEnabled();
    expect(send()).toHaveAttribute('data-hold');

    // The commit is held (K4); Enter twice is the keyboard's hold.
    hold(send());
    await waitFor(() => {
      expect(contribute).toHaveBeenCalledWith({ originPlanetId: 'origin-a', fleet: { DART: 1 }, acknowledgeShieldLoss: true });
    });
  });

  it('clears a composed fleet when its origin world changes', async () => {
    show(active, 'MEMBER', [origin, other]);
    await openWave();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /max.*dart/i }));
    expect(screen.getByRole('textbox', { name: /dart/i })).not.toHaveValue('0');

    await user.click(within(screen.getByRole('radiogroup', { name: /launch from/i })).getByRole('radio', { name: 'Origin B' }));

    expect(screen.queryByRole('textbox', { name: /dart/i })).toBeNull();
    expect(send()).toHaveTextContent(/choose at least one ship/i);
    expect(send()).toBeDisabled();
  });

  it('keeps donation and fleet origins independent and caps a gift by world stock', async () => {
    show(active, 'MEMBER', [origin, other]);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^donate/i }));
    const donation = screen.getByRole('dialog', { name: /donate/i });
    await user.click(within(within(donation).getByRole('radiogroup', { name: /pay from world/i })).getByRole('radio', { name: 'Origin B' }));

    const alloy = within(donation).getByRole('slider', { name: /alloy/i });
    expect(alloy).toHaveAttribute('max', '8');
    await user.click(within(donation).getByRole('button', { name: /close/i }));

    await openWave();
    expect(within(screen.getByRole('radiogroup', { name: /launch from/i })).getByRole('radio', { name: 'Origin A' }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it('sends a donation of what the sliders hold, from the chosen world', async () => {
    const { api } = show(active, 'MEMBER', [origin]);
    const donate = vi.spyOn(api, 'donateClanTreasury').mockReturnValue(new Promise<never>(() => undefined));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^donate/i }));
    const donation = screen.getByRole('dialog', { name: /donate/i });
    fireEvent.change(within(donation).getByRole('slider', { name: /alloy/i }), { target: { value: '30' } });
    await user.click(within(donation).getByRole('button', { name: /^donate/i }));
    expect(donate).toHaveBeenCalledWith(expect.objectContaining({
      planetId: 'origin-a',
      resources: { alloy: 30, crystal: 0, deuterium: 0 },
    }));
  });

  /**
   * WHAT IS SENT IS WHAT THE SLIDER SHOWS (review, 2026-09-25). The room a clanmate's gift
   * leaves shrinks while the sheet is open; the slider drew the smaller figure, and the press
   * sent the old one — a refusal for an amount nobody chose. Master's button refused an
   * over-limit gift; the v2 sheet lost that guard.
   */
  it('sends the gift as the slider shows it after the room shrinks, and nothing once it is gone', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
    const donate = vi.spyOn(api, 'donateClanTreasury').mockReturnValue(new Promise<never>(() => undefined));
    const sheet = (war: typeof empty) => (
      <QueryClientProvider client={client}><ApiProvider api={api}>
        <ClanDonateSheet war={war} worlds={[origin]} onClose={vi.fn()} />
      </ApiProvider></QueryClientProvider>
    );
    const { rerender } = render(sheet(empty));
    fireEvent.change(screen.getByRole('slider', { name: /alloy/i }), { target: { value: '30' } });

    rerender(sheet({ ...empty, room: { alloy: 12, crystal: 100, deuterium: 10 } }));
    await userEvent.click(screen.getByRole('button', { name: /^donate/i }));
    expect(donate).toHaveBeenLastCalledWith(expect.objectContaining({ resources: { alloy: 12, crystal: 0, deuterium: 0 } }));

    rerender(sheet({ ...empty, room: { alloy: 0, crystal: 100, deuterium: 10 } }));
    expect(screen.getByRole('button', { name: /^donate/i })).toBeDisabled();
  });

  it('does not ask an unprotected leader to acknowledge shield loss', () => {
    show(launchReady, 'LEADER', [origin]);

    expect(screen.queryByRole('checkbox', { name: /shield will end/i })).toBeNull();
    expect(strike()).toBeEnabled();
    expect(strike()).toHaveTextContent(/start joint attack/i);
  });

  it('requires acknowledgement when the authoritative launch view says the shield will drop', async () => {
    const protectedWar = clanWarSchema.parse({ ...launchReady, operation: {
      ...launchReady.operation!,
      startShieldWouldDrop: { kind: 'RECOVERY', until: '2026-09-21T12:00:00Z' },
    } });
    show(protectedWar, 'LEADER', [origin]);

    expect(strike()).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('checkbox', { name: /shield will end/i }));
    expect(strike()).toBeEnabled();
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

  it('sends the chosen speed with the held launch', async () => {
    const { api } = show(timed(60), 'LEADER', [origin]);
    const started = vi.spyOn(api, 'startClanWar').mockReturnValue(new Promise(() => undefined));
    const rungs = within(document.querySelector<HTMLElement>('[data-clan-pace]')!).getAllByRole('radio');
    await userEvent.setup().click(rungs[1]!);
    hold(strike());

    await waitFor(() => { expect(started).toHaveBeenCalledWith(false, 0.75); });
  });

  it('shows no speeds until a wave is staged to time', () => {
    show(timed(null), 'LEADER', [origin]);
    expect(document.querySelector('[data-clan-pace]')).toBeNull();
    expect(document.querySelector('[data-clan-strike-eta]')).toBeNull();
  });
});

/**
 * THE WAR ROOM AT A GLANCE. E9, the mock: the operation is a line from the gathering to the
 * target with every wave on it, named; the five seats carry each commander's share of the
 * strike; the clan hangar is drawn in the allies' colour rather than stated as a sentence.
 */
describe('the war room at a glance', () => {
  const twoWaves = clanWarSchema.parse({ ...empty, hangar: { used: 120, reserved: 40, total: 160 }, operation: {
    ...active.operation!,
    contributions: [
      { id: 'w1', playerId: 'a', username: 'Scout', originPlanetId: 'o1', originPlanetName: 'Origin A', sourceKind: 'PHYSICAL',
        status: 'OUTBOUND', fleet: { DART: 3 }, bulk: 3, fuelPaid: 18, sentAt: '2026-09-20T12:01:00Z',
        arrivesAt: '2099-09-20T12:10:00Z', mine: false, canRecall: false },
      { id: 'w2', playerId: 'b', username: 'Mira', originPlanetId: 'o2', originPlanetName: 'Origin B', sourceKind: 'PHYSICAL',
        status: 'STAGED', fleet: { DART: 9 }, bulk: 9, fuelPaid: 30, sentAt: '2026-09-20T12:01:00Z',
        arrivesAt: null, mine: false, canRecall: false },
    ],
    pool: { combatHulls: 12, waves: 2, participants: 2 },
  } });
  const four: WarSeatMember[] = [
    { playerId: 'leader', username: 'Vantage' },
    { playerId: 'a', username: 'Scout' },
    { playerId: 'b', username: 'Mira' },
    { playerId: 'c', username: 'Tarn' },
  ];

  it('leads with the target, ahead of the hangar and the treasury', () => {
    show(twoWaves, 'LEADER', [], four);
    const target = document.querySelector('[data-war-target]')!;
    const hangar = document.querySelector('[data-clan-hangar]')!;
    expect(target).toHaveTextContent('Vega');
    expect(target.compareDocumentPosition(hangar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('marks every wave on its way to the gathering point', () => {
    show(twoWaves, 'LEADER', [], four);
    expect(document.querySelectorAll('[data-war-target] [data-wave-marker]')).toHaveLength(2);
  });

  it('names both ends of the line and each wave still flying, with its ships and time', () => {
    show(twoWaves, 'LEADER', [], four);
    const line = document.querySelector<HTMLElement>('[data-war-line]')!;
    expect(within(line).getByText('Gather · Home')).toBeInTheDocument();
    expect(within(line).getByText('Target')).toBeInTheDocument();
    const label = line.querySelector<HTMLElement>('[data-wave-label]')!;
    expect(label).toHaveTextContent('Scout · 3');
    expect(label.textContent).toMatch(/\d/);
    // The staged wave waits at the gathering point: counted there, not labelled on its way.
    expect(within(line).getByText(/1 ready/)).toBeInTheDocument();
  });

  it('seats the whole crew — five seats, the empty one open', () => {
    show(twoWaves, 'LEADER', [], four);
    const seats = within(screen.getByRole('group', { name: /seats/i })).getAllByRole('button');
    expect(seats).toHaveLength(5);
    expect(seats.map((seat) => seat.textContent)).toEqual([
      expect.stringContaining('VA'), expect.stringContaining('SC'), expect.stringContaining('MI'),
      expect.stringContaining('TA'), expect.stringContaining('Empty'),
    ]);
    expect(seats[4]).toBeDisabled();
  });

  it('gives each commander their share of the strike, you in your colour', () => {
    show(twoWaves, 'LEADER', [], four);
    const seats = within(screen.getByRole('group', { name: /seats/i })).getAllByRole('button');
    const share = (seat: HTMLElement) => seat.querySelector<HTMLElement>('[data-seat-share]')?.style.width;
    expect(seats.slice(0, 4).map(share)).toEqual(['0%', '25%', '75%', '0%']);
    expect(seats[0]).toHaveAttribute('data-self');
    expect(seats[1]!.querySelector('[data-seat-share]')).toHaveClass('bg-v2-ally');
  });

  it('opens a commander’s wave from their seat, and says so when they have sent none', async () => {
    show(twoWaves, 'LEADER', [], four);
    const user = userEvent.setup();
    const seats = () => within(screen.getByRole('group', { name: /seats/i })).getAllByRole('button');
    await user.click(seats()[2]!);
    const card = document.querySelector<HTMLElement>('[data-seat-waves]')!;
    expect(card).toHaveTextContent('Mira · Origin B');
    expect(card).toHaveTextContent(/ready at staging/i);
    expect(seats()[2]).toHaveAttribute('aria-pressed', 'true');
    await user.click(seats()[3]!);
    expect(document.querySelector('[data-seat-waves]')).toHaveTextContent(/Tarn has not sent a wave/i);
  });

  it('draws the clan hangar in the allies’ colour, used then reserved', () => {
    show(twoWaves, 'LEADER', [], four);
    const hangar = document.querySelector<HTMLElement>('[data-clan-hangar]')!;
    expect(hangar.querySelector('[data-part="used"]')).toHaveClass('bg-v2-ally');
    expect(hangar.querySelector<HTMLElement>('[data-part="used"]')!.style.width).toBe('75%');
    expect(hangar.querySelector<HTMLElement>('[data-part="reserved"]')!.style.width).toBe('25%');
  });

  it('opens clan chat beside the send', async () => {
    const { onOpenClanChat } = show(twoWaves, 'LEADER', [], four);
    await userEvent.setup().click(screen.getByRole('button', { name: /clan chat/i }));
    expect(onOpenClanChat).toHaveBeenCalledTimes(1);
  });

  /** The spec's list of things not to do: no browser dropdowns, number boxes or checkboxes in the game. */
  it('uses none of the browser’s own form controls, in the room or its pages', async () => {
    show(active, 'LEADER', [origin, other]);
    const user = userEvent.setup();
    expect(document.querySelector('select, input[type="number"], input[type="checkbox"]')).toBeNull();
    await openWave();
    expect(document.querySelector('select, input[type="number"], input[type="checkbox"]')).toBeNull();
    await user.click(within(screen.getByRole('dialog', { name: /vega/i })).getByRole('button', { name: /close/i }));
    await user.click(screen.getByRole('button', { name: /^donate/i }));
    expect(document.querySelector('select, input[type="number"], input[type="checkbox"]')).toBeNull();
  });
});
