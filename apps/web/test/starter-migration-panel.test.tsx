import { z } from 'zod';
import { STARTER, type VesselProgress } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { vesselSchema, type MigrationView } from '../src/api/starterSchemas.js';
import { LandingChoice } from '../src/starter/LandingChoice.js';
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
    const body: unknown = url.includes('/api/starter/migration') ? (typeof migration === 'function' ? migration() : migration) : ask(url, init);
    const status = body instanceof Refusal ? 409 : 200;
    return Promise.resolve(new Response(JSON.stringify(body instanceof Refusal ? { error: body.error, message: body.error } : body), { status, headers: { 'content-type': 'application/json' } }));
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
});
