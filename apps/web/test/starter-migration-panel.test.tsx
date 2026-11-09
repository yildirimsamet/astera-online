import { z } from 'zod';
import { STARTER, type VesselProgress } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { vesselSchema, type MigrationView } from '../src/api/starterSchemas.js';
import { LandingChoice } from '../src/starter/LandingChoice.js';
import { jumpHoldsSession, releaseJump } from '../src/starter/jump.js';
import { MigrationPanel } from '../src/starter/MigrationPanel.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { urlOf, wireVessel } from './starterVesselFixture.js';

afterEach(cleanup);

const THRUST: VesselProgress = { modules: { REFINERY: 1, DRIVE_THRUST: 1, DEUTERIUM_PLANT: 2 }, facts: [], parts: 3, fuel: 40 };

const view = (over: Partial<Record<keyof MigrationView, unknown>> = {}) => ({
  block: { code: 'MIGRATION_NOT_READY' },
  target: { shard: 'EU-1', name: 'Vantage', seasonEndsAt: '2027-01-01T00:00:00.000Z' },
  fuel: { loaded: 40, needed: STARTER.fuelForJump, canLoad: true },
  cargo: { alloy: 2000, crystal: 300, deuterium: 50, fleet: { DART: 6 } },
  left: { alloy: 3000, crystal: 0, deuterium: 30, ships: 2 },
  choices: [],
  ...over,
});

class Refusal { constructor(readonly error: string) {} }

const harness = (migration: object | (() => object), ask: (url: string, init?: RequestInit) => unknown = () => ({})) => {
  const fetcher = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);
    const asked: unknown = url.includes('/api/starter/migration') ? (typeof migration === 'function' ? migration() : migration) : ask(url, init);
    // An answer may be held back, to see what happens while the press waits on it.
    return Promise.resolve(asked).then((body: unknown) => new Response(
      JSON.stringify(body instanceof Refusal ? { error: body.error, message: body.error } : body),
      { status: body instanceof Refusal ? 409 : 200, headers: { 'content-type': 'application/json' } },
    ));
  });
  const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { fetcher, wrap: (children: React.ReactNode) => (
    <QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  ) };
};

const shipWith = (progress: VesselProgress, deuterium = 200) => vesselSchema.parse(wireVessel({ progress, deuterium }));

describe('the drive panel', () => {
  it('shows the tank in units and offers to load what can be loaded', async () => {
    const { wrap, fetcher } = harness(view());
    render(wrap(<MigrationPanel vessel={shipWith(THRUST)} onJump={vi.fn()} />));
    expect(await screen.findByTestId('tank-level')).toHaveTextContent(`40/${String(STARTER.fuelForJump)}`);
    // The advisor's "load fuel" points here (plan F3).
    expect(screen.getByRole('button', { name: /Load all/u }).getAttribute('data-guide')).toBe('fuel');
    fireEvent.click(screen.getByRole('button', { name: /Load all/u }));
    await waitFor(() => { expect(fetcher.mock.calls.some(([url]) => urlOf(url).includes('/api/starter/fuel'))).toBe(true); });
    const call = fetcher.mock.calls.find(([url]) => urlOf(url).includes('/api/starter/fuel'))!;
    expect(JSON.parse(z.string().parse(call[1]?.body))).toEqual({ amount: 50 });
  });

  it('names what the tank waits for instead of showing a dead control', async () => {
    const { wrap } = harness(view({ fuel: { loaded: 0, needed: 90, canLoad: false } }));
    render(wrap(<MigrationPanel vessel={shipWith({ ...THRUST, modules: { REFINERY: 1 }, fuel: 0 })} onJump={vi.fn()} />));
    expect(await screen.findByTestId('tank-locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Load/u })).toBeNull();
  });

  it('says how the parts come, and counts them', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel vessel={shipWith({ ...THRUST, parts: 1 })} onJump={vi.fn()} />));
    expect(await screen.findByTestId('parts-count')).toHaveTextContent(`1/${String(STARTER.parts.needed)}`);
  });

  /**
   * A HUNT IS OFFERED ONLY WHERE THERE IS ONE (player test D-03). Before the drive hull can be ordered
   * no part is on the map, and the panel still said "send a probe to a wreck or an outpost".
   */
  it('says when the parts will show, before they are on the map', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel vessel={shipWith({ ...THRUST, modules: { REFINERY: 1 }, parts: 0 })} onJump={vi.fn()} />));
    const hint = await screen.findByTestId('parts-seen');
    expect(hint.textContent).toContain('They show on the map once the drive hull can be repaired.');
    expect(hint.textContent).not.toMatch(/send a probe/iu);
  });

  /**
   * THE LOSS IS SAID WHILE IT CAN STILL BE SPENT (player test: 14,306 alloy and 3 ships lost, seen
   * only on the last screen). The panel where the jump is prepared names what will stay behind.
   */
  it('names what will stay behind, and what a jump can carry, before the jump', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel vessel={shipWith(THRUST)} onJump={vi.fn()} />));
    expect(await screen.findByTestId('jump-left')).toHaveTextContent('Stays behind and is lost: 3,000 alloy, 0 crystal, 30 Deuterium, 2 ships.');
    expect(screen.getByTestId('jump-carry')).toHaveTextContent(
      `A jump carries at most ${STARTER.carry.alloy.toLocaleString('en')} alloy, ${STARTER.carry.crystal.toLocaleString('en')} crystal, ${String(STARTER.carry.deuterium)} Deuterium and ${String(STARTER.carry.ships)} ships.`);
  });

  it('opens the choice once nothing stands in the way', async () => {
    const onJump = vi.fn();
    const { wrap } = harness(view({ block: null, fuel: { loaded: 90, needed: 90, canLoad: true } }));
    render(wrap(<MigrationPanel vessel={shipWith({ ...THRUST, fuel: 90 })} onJump={onJump} />));
    fireEvent.click(await screen.findByRole('button', { name: /Prepare the jump/u }));
    expect(onJump).toHaveBeenCalledOnce();
  });

  it('gives the season reason and keeps the ship playing', async () => {
    const { wrap } = harness(view({ block: { code: 'MIGRATION_SEASON_WAIT', daysLeft: 3 }, fuel: { loaded: 90, needed: 90, canLoad: true } }));
    render(wrap(<MigrationPanel vessel={shipWith({ ...THRUST, fuel: 90 })} onJump={vi.fn()} />));
    expect(await screen.findByTestId('jump-block')).toHaveTextContent(/3 days/u);
    expect(screen.queryByRole('button', { name: /Prepare the jump/u })).toBeNull();
  });
});

/**
 * THE LAST STRETCH AS ONE PLAN (plan 2026-11-08 F7, moment 15): both engines, the fuel and what holds
 * the jump, in the panel where it is prepared; and the season or a full frontier said before the
 * tank is full (moment 16), with what the player can do meanwhile.
 */
describe('the departure plan', () => {
  const GATE = { REFINERY: 4, EXTRACTOR: 3, SURVEY: 2, SHIPYARD: 1, HANGAR: 2, TELESCOPE: 1, RADAR: 1 };
  const facts: VesselProgress['facts'] = ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN'];
  const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  const order = (subject: string, hours: number) => ({
    id: subject, queue: 'CONSTRUCTION', subject, stage: 1, count: 1, startedAt: new Date().toISOString(), readyAt: inHours(hours), cost: { alloy: 0, crystal: 0, deuterium: 0 },
  });
  const planShip = (progress: VesselProgress, over: Record<string, unknown> = {}) =>
    vesselSchema.parse(wireVessel({ progress, deuterium: 0, ...over }));

  it('calls an engine on the queue queued, never ready', async () => {
    const { wrap } = harness(view());
    const vessel = planShip({ modules: { ...GATE, DEUTERIUM_PLANT: 2 }, facts, parts: 3, fuel: 0 },
      { queue: [order('DRIVE_HULL', 3), order('DRIVE_THRUST', 7)] });
    render(wrap(<MigrationPanel vessel={vessel} onJump={vi.fn()} />));
    expect(await screen.findByTestId('plan-DRIVE_HULL')).toHaveTextContent(/Queued · done in \d/u);
    expect(screen.getByTestId('plan-DRIVE_THRUST')).toHaveTextContent(/Queued · done in \d/u);
    expect(screen.getByTestId('plan-DRIVE_THRUST')).not.toHaveTextContent(/Repaired/u);
  });

  it('says what an engine still waits for', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel vessel={planShip({ modules: { ...GATE, DEUTERIUM_PLANT: 2, DRIVE_HULL: 1 }, facts, parts: 1, fuel: 0 })} onJump={vi.fn()} />));
    expect(await screen.findByTestId('plan-DRIVE_HULL')).toHaveTextContent(/Repaired/u);
    expect(screen.getByTestId('plan-DRIVE_THRUST')).toHaveTextContent(/Waits for/u);
  });

  it('says when the fuel is aboard, that flights slow it, and what holds the jump', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel vessel={planShip({ modules: { ...GATE, DEUTERIUM_PLANT: 2, DRIVE_HULL: 1, DRIVE_THRUST: 1 }, facts, parts: 3, fuel: 20 })} onJump={vi.fn()} />));
    expect(await screen.findByTestId('plan-fuel')).toHaveTextContent(/20\/90 aboard · full in \dh/u);
    expect(screen.getByTestId('plan-flights')).toHaveTextContent(/no Deuterium is flown/u);
    expect(screen.getByTestId('plan-waits')).toHaveTextContent(/fuel is what holds the jump/u);
  });

  it('shows what the second plant would gain while the first runs alone', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel vessel={planShip({ modules: { ...GATE, DEUTERIUM_PLANT: 1 }, facts, parts: 0, fuel: 20 })} onJump={vi.fn()} />));
    expect(await screen.findByTestId('plan-lever')).toHaveTextContent(/With Deuterium Refinery 2: full in/u);
  });

  it('says the optional repairs stay aboard', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel vessel={planShip({ modules: { ...GATE, DEUTERIUM_PLANT: 2 }, facts, parts: 0, fuel: 0 })} onJump={vi.fn()} />));
    expect(await screen.findByTestId('plan-optional')).toHaveTextContent(/optional repairs left/u);
  });

  it('says at once, tank or no tank, that no galaxy has room', async () => {
    const { wrap } = harness(view({ target: null }));
    render(wrap(<MigrationPanel vessel={shipWith(THRUST)} onJump={vi.fn()} />));
    expect(await screen.findByTestId('jump-outlook')).toHaveTextContent(/No galaxy has room/u);
  });

  it('says before the tank is full that the season has stopped taking ships', async () => {
    const { wrap } = harness(view({ target: { shard: 'EU-1', name: 'Vantage', seasonEndsAt: inHours(72) } }));
    render(wrap(<MigrationPanel vessel={shipWith(THRUST)} onJump={vi.fn()} />));
    expect(await screen.findByTestId('jump-outlook')).toHaveTextContent(/next season/u);
  });

  it('says nothing early when the season has room for the plan', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel vessel={shipWith(THRUST)} onJump={vi.fn()} />));
    await screen.findByTestId('tank-level');
    expect(screen.queryByTestId('jump-outlook')).toBeNull();
  });
});

describe('choosing where to land', () => {
  const choices = [
    { index: 1, x: 100, y: 0, z: 0, neighbours: 0 },
    { index: 2, x: 900, y: 0, z: 300, neighbours: 4 },
    { index: 3, x: -900, y: 0, z: 300, neighbours: 12 },
  ];
  const parsed = () => ({ ...view({ block: null, choices }) } as unknown as MigrationView);

  it('offers the three addresses, each saying how many worlds stand near it', () => {
    const { wrap } = harness({});
    render(wrap(<LandingChoice view={parsed()} onCancel={vi.fn()} onLanded={vi.fn()} />));
    const rows = screen.getAllByRole('radio');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAccessibleName(/0/u);
    expect(rows[2]).toHaveAccessibleName(/12/u);
  });

  it('names where it lands, what comes down, and what is lost, before the press', () => {
    const { wrap } = harness({});
    render(wrap(<LandingChoice view={parsed()} onCancel={vi.fn()} onLanded={vi.fn()} />));
    const text = document.body.textContent;
    expect(text).toContain('Vantage');
    expect(text).toMatch(/2,?000/u);
    expect(screen.getByTestId('jump-warning')).toHaveTextContent(/The ship is spent/u);
    expect(screen.getByTestId('jump-left')).toHaveTextContent(/3,?000/u);
  });

  it('stays open on the new addresses when the chosen one has gone', async () => {
    const onCancel = vi.fn();
    let offered = choices;
    const { wrap } = harness(() => view({ block: null, choices: offered }), () => {
      offered = [{ index: 7, x: 10, y: 0, z: 0, neighbours: 1 }];
      return new Refusal('LANDING_GONE');
    });
    render(wrap(<LandingChoice view={parsed()} onCancel={onCancel} onLanded={vi.fn()} />));
    fireEvent.click(screen.getAllByRole('radio')[2]!);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hold = await screen.findByRole('button', { name: /Jump/u });
    fireEvent.pointerDown(hold);
    await vi.advanceTimersByTimeAsync(1500);
    fireEvent.pointerUp(hold);
    vi.useRealTimers();
    await waitFor(() => { expect(screen.getAllByRole('radio')).toHaveLength(1); });
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'true');
    await waitFor(() => { expect(document.body.textContent).toMatch(/address/iu); });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('closes on any other refusal: the panel says why', async () => {
    const onCancel = vi.fn();
    const { wrap } = harness(view({ block: null, choices }), () => new Refusal('NO_FRONTIER'));
    render(wrap(<LandingChoice view={parsed()} onCancel={onCancel} onLanded={vi.fn()} />));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hold = screen.getByRole('button', { name: /Jump/u });
    fireEvent.pointerDown(hold);
    await vi.advanceTimersByTimeAsync(1500);
    fireEvent.pointerUp(hold);
    vi.useRealTimers();
    await waitFor(() => { expect(onCancel).toHaveBeenCalledOnce(); });
  });

  it('sends the chosen address and hands the landing back', async () => {
    const onLanded = vi.fn();
    const landing = { placement: { shard: 'EU-1', shardName: 'Vantage', seasonId: 's', planetId: 'p', playerId: 'c' }, cargo: { alloy: 1, crystal: 1, deuterium: 1, fleet: {} } };
    const { wrap, fetcher } = harness({}, () => landing);
    render(wrap(<LandingChoice view={parsed()} onCancel={vi.fn()} onLanded={onLanded} />));
    fireEvent.click(screen.getAllByRole('radio')[2]!);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hold = screen.getByRole('button', { name: /Jump/u });
    fireEvent.pointerDown(hold);
    await vi.advanceTimersByTimeAsync(1500);
    fireEvent.pointerUp(hold);
    vi.useRealTimers();
    await waitFor(() => { expect(onLanded).toHaveBeenCalledOnce(); });
    const call = fetcher.mock.calls.find(([url]) => urlOf(url).includes('/api/starter/migrate'))!;
    expect(JSON.parse(z.string().parse(call[1]?.body))).toEqual({ slot: 3 });
  });

  it('holds the session from the press, and still hands the landing back once the sheet has gone', async () => {
    const onLanded = vi.fn();
    const landing = { placement: { shard: 'EU-1', shardName: 'Vantage', seasonId: 's', planetId: 'p', playerId: 'c' }, cargo: { alloy: 1, crystal: 1, deuterium: 1, fleet: {} } };
    let answer: ((value: unknown) => void) | undefined;
    const { wrap } = harness({}, () => new Promise(resolve => { answer = resolve; }));
    const { unmount } = render(wrap(<LandingChoice view={parsed()} onCancel={vi.fn()} onLanded={onLanded} />));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hold = screen.getByRole('button', { name: /Jump/u });
    fireEvent.pointerDown(hold);
    await vi.advanceTimersByTimeAsync(1500);
    fireEvent.pointerUp(hold);
    vi.useRealTimers();
    expect(jumpHoldsSession()).toBe(true);
    unmount();
    answer?.(landing);
    await waitFor(() => { expect(onLanded).toHaveBeenCalledOnce(); });
    releaseJump();
  });

  it('lets go of the session when the jump is refused', async () => {
    const { wrap } = harness(view({ block: null, choices }), () => new Refusal('NO_FRONTIER'));
    render(wrap(<LandingChoice view={parsed()} onCancel={vi.fn()} onLanded={vi.fn()} />));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hold = screen.getByRole('button', { name: /Jump/u });
    fireEvent.pointerDown(hold);
    await vi.advanceTimersByTimeAsync(1500);
    fireEvent.pointerUp(hold);
    vi.useRealTimers();
    await waitFor(() => { expect(jumpHoldsSession()).toBe(false); });
  });
});
