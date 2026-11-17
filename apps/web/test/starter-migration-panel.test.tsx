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
import { compact } from '../src/lib/format.js';

const income = { alloy: 0, crystal: 0, deuterium: 0 };

afterEach(cleanup);

/** The first loop done (plan 2026-11-13 §5.1). */
const LOOP: VesselProgress = {
  modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 },
  facts: ['FIRST_MINING_SENT', 'FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'],
};

const view = (over: Partial<Record<keyof MigrationView, unknown>> = {}) => ({
  block: null,
  target: { shard: 'EU-1', name: 'Vantage', seasonEndsAt: '2027-01-01T00:00:00.000Z' },
  cargo: { alloy: 2000, crystal: 300, deuterium: 50, fleet: { DART: 6 } },
  fill: { alloy: 1, crystal: 0.3, deuterium: 1, ships: 1 },
  full: false,
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

const shipWith = (progress: VesselProgress = LOOP) => vesselSchema.parse(wireVessel({ progress, deuterium: 200 }));

/**
 * THE INPUTS OF THE CHOICE, NOT THE ANSWER (plan 2026-11-13 §4.4). The panel says what the hold takes
 * against what a jump carries, what stays behind and what the season says; no drive, part or tank.
 */
describe('the jump panel', () => {
  it('shows each resource of the hold against what a jump carries, and no tank or parts', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel income={income} vessel={shipWith()} onJump={vi.fn()} />));
    expect(await screen.findByTestId('hold-alloy')).toHaveTextContent(`${compact(2000)}/${compact(STARTER.carry.alloy)}`);
    expect(screen.getByTestId('hold-crystal')).toHaveTextContent(`300/${compact(STARTER.carry.crystal)}`);
    expect(screen.getByTestId('hold-ships')).toHaveTextContent(`6/${String(STARTER.carry.ships)}`);
    expect(screen.queryByTestId('tank-level')).toBeNull();
    expect(screen.queryByTestId('parts-count')).toBeNull();
    expect(screen.queryByTestId('plan-DRIVE_HULL')).toBeNull();
  });

  it('says what the first loop still asks while the drive is not up, and offers no jump', async () => {
    const { wrap } = harness(view({ block: { code: 'MIGRATION_NOT_READY' } }));
    render(wrap(<MigrationPanel income={income} vessel={shipWith({ ...LOOP, facts: ['FIRST_MINING_SENT'] })} onJump={vi.fn()} />));
    expect(await screen.findByTestId('jump-block')).toHaveTextContent(/mining run/iu);
    expect(screen.queryByRole('button', { name: /Prepare the jump/u })).toBeNull();
  });

  it('says when the hold is full that more is not carried', async () => {
    const { wrap } = harness(view({ full: true, fill: { alloy: 1, crystal: 1, deuterium: 0.2, ships: 0.5 } }));
    render(wrap(<MigrationPanel income={income} vessel={shipWith()} onJump={vi.fn()} />));
    expect(await screen.findByTestId('hold-full')).toHaveTextContent(/hold is full/iu);
  });

  /**
   * THE LOSS IS SAID WHILE IT CAN STILL BE SPENT (player test: 14,306 alloy and 3 ships lost, seen
   * only on the last screen). The panel where the jump is prepared names what will stay behind.
   */
  it('names what will stay behind, and that repairs stay aboard, before the jump', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel income={income} vessel={shipWith()} onJump={vi.fn()} />));
    expect(await screen.findByTestId('jump-left')).toHaveTextContent('Stays behind and is lost: 3,000 alloy, 0 crystal, 30 Deuterium, 2 ships.');
    expect(screen.getByTestId('jump-stays')).toHaveTextContent(/repairs and research stay aboard/iu);
  });

  it('opens the choice once nothing stands in the way', async () => {
    const onJump = vi.fn();
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel income={income} vessel={shipWith()} onJump={onJump} />));
    fireEvent.click(await screen.findByRole('button', { name: /Prepare the jump/u }));
    expect(onJump).toHaveBeenCalledOnce();
  });

  it('gives the season reason and keeps the ship playing', async () => {
    const { wrap } = harness(view({ block: { code: 'MIGRATION_SEASON_WAIT', daysLeft: 3 } }));
    render(wrap(<MigrationPanel income={income} vessel={shipWith()} onJump={vi.fn()} />));
    expect(await screen.findByTestId('jump-block')).toHaveTextContent(/3 days/u);
    expect(screen.queryByRole('button', { name: /Prepare the jump/u })).toBeNull();
  });

  it('says the Prospector has to come home first', async () => {
    const { wrap } = harness(view({ block: { code: 'MIGRATION_FLEET_OUT', flying: 1 } }));
    render(wrap(<MigrationPanel income={income} vessel={shipWith()} onJump={vi.fn()} />));
    expect(await screen.findByTestId('jump-block')).toBeInTheDocument();
  });

  it('says at once that no galaxy has room', async () => {
    const { wrap } = harness(view({ target: null, block: { code: 'NO_FRONTIER' } }));
    render(wrap(<MigrationPanel income={income} vessel={shipWith()} onJump={vi.fn()} />));
    expect(await screen.findByTestId('jump-outlook')).toHaveTextContent(/No galaxy has room/u);
    expect(screen.queryByTestId('jump-block')).toBeNull();
  });

  it('says the season has stopped taking ships', async () => {
    const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
    const { wrap } = harness(view({ target: { shard: 'EU-1', name: 'Vantage', seasonEndsAt: inHours(72) } }));
    render(wrap(<MigrationPanel income={income} vessel={shipWith()} onJump={vi.fn()} />));
    expect(await screen.findByTestId('jump-outlook')).toHaveTextContent(/next season/u);
  });

  it('says nothing about the season when it has room', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel income={income} vessel={shipWith()} onJump={vi.fn()} />));
    await screen.findByTestId('hold-alloy');
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
    const landing = { placement: { shard: 'EU-1', shardName: 'Vantage', seasonId: 's', planetId: 'p', playerId: 'c', position: { x: 1, y: 2, z: 3 } }, cargo: { alloy: 1, crystal: 1, deuterium: 1, fleet: {} } };
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
    const landing = { placement: { shard: 'EU-1', shardName: 'Vantage', seasonId: 's', planetId: 'p', playerId: 'c', position: { x: 1, y: 2, z: 3 } }, cargo: { alloy: 1, crystal: 1, deuterium: 1, fleet: {} } };
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
