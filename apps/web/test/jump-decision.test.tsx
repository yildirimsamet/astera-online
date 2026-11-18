import { FIRST_SEASON_START, STARTER, type VesselProgress } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { migrationViewSchema, vesselSchema, type MigrationView } from '../src/api/starterSchemas.js';
import { compact } from '../src/lib/format.js';
import { LandingChoice } from '../src/starter/LandingChoice.js';
import { MigrationPanel } from '../src/starter/MigrationPanel.js';
import { releaseJump } from '../src/starter/jump.js';
import { landingSheetOpen } from '../src/starter/tutorial/landingSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { urlOf, wireVessel } from './starterVesselFixture.js';

afterEach(() => { cleanup(); releaseJump(); vi.useRealTimers(); });

const LOOP: VesselProgress = {
  modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 },
  facts: ['FIRST_MINING_SENT', 'FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'],
};
const view = (over: Record<string, unknown> = {}) => ({
  block: null,
  target: { shard: 'EU-1', name: 'Vantage', seasonEndsAt: '2027-01-01T00:00:00.000Z' },
  cargo: { alloy: 1200, crystal: 300, deuterium: 50, fleet: { DART: 3 } },
  fill: { alloy: 0.6, crystal: 0.3, deuterium: 1, ships: 0.5 },
  full: false,
  left: { alloy: 0, crystal: 0, deuterium: 0, ships: 0 },
  choices: [{ index: 1, x: 100, y: 0, z: 0, neighbours: 0 }],
  ...over,
});
const harness = (migration: object) => {
  const fetcher = vi.fn((input: RequestInfo | URL) => {
    const url = urlOf(input);
    const body = url.endsWith('/api/starter/migration') ? migration : {};
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  });
  const api = new Api({ fetch: fetcher as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { fetcher, wrap: (children: React.ReactNode) => (
    <QueryClientProvider client={queries}><ApiProvider api={api}><ToastProvider>{children}</ToastProvider></ApiProvider></QueryClientProvider>
  ) };
};
const ship = () => vesselSchema.parse(wireVessel({ progress: LOOP }));
const income = { alloy: 120, crystal: 45, deuterium: 0 };

/**
 * THE JUMP, DECIDED ON THE GAME KIT (plan 2026-11-13 §4.4, Faz 3). Top to bottom: the hold, staying,
 * landing, what stays behind, the season, the action. The inputs of the choice, never the answer.
 */
describe('the jump decision panel', () => {
  it('reads top to bottom: the hold, staying, landing, what stays behind, then the action', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel vessel={ship()} income={income} onJump={vi.fn()} />));
    const order = ['jump-hold', 'jump-stay', 'jump-land', 'jump-behind'].map(id => screen.getByTestId(id));
    const action = await screen.findByRole('button', { name: /Prepare the jump/u });
    for (const [a, b] of [...order, action].slice(0, -1).map((el, i) => [el, [...order, action][i + 1]!] as const)) {
      expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('shows each store of the hold against its ceiling and how fast it fills aboard', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel vessel={ship()} income={income} onJump={vi.fn()} />));
    const alloy = within(await screen.findByTestId('hold-alloy')).getByRole('group', { name: /alloy/iu });
    expect(alloy).toHaveTextContent(`${compact(1200)}/${compact(STARTER.carry.alloy)}`);
    expect(alloy).toHaveTextContent(`+${compact(120)}`);
    expect(within(screen.getByTestId('hold-deuterium')).getByRole('group')).toHaveAttribute('data-full');
    const ships = within(screen.getByTestId('hold-ships')).getByRole('progressbar');
    expect(ships).toHaveAttribute('aria-valuenow', '3');
    expect(ships).toHaveAttribute('aria-valuemax', String(STARTER.carry.ships));
  });

  it('says what staying is worth, and how the hold fills one tap away', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel vessel={ship()} income={income} onJump={vi.fn()} />));
    const stay = await screen.findByTestId('jump-stay');
    expect(stay).toHaveTextContent(`${String(STARTER.outputMult)}×`);
    expect(stay).not.toHaveTextContent(/first hunt/iu);
    fireEvent.click(within(stay).getByRole('button', { name: /How the hold fills/u }));
    expect(stay).toHaveTextContent(/first hunt/iu);
    expect(stay).toHaveTextContent(/mining/iu);
  });

  it('says, once the hold is full, that staying fills it no more', async () => {
    const { wrap } = harness(view({ full: true }));
    render(wrap(<MigrationPanel vessel={ship()} income={income} onJump={vi.fn()} />));
    const stay = await screen.findByTestId('jump-stay');
    await waitFor(() => { expect(within(stay).getByTestId('hold-full')).toHaveTextContent(/Hold full: new earnings stay aboard/u); });
    expect(stay).not.toHaveTextContent(`${String(STARTER.outputMult)}×`);
  });

  it('says what lands with the hold and the protection in numbers, the rules one tap away', async () => {
    const { wrap } = harness(view());
    render(wrap(<MigrationPanel vessel={ship()} income={income} onJump={vi.fn()} />));
    const land = await screen.findByTestId('jump-land');
    const pack = FIRST_SEASON_START.resources;
    const ships = Object.values(FIRST_SEASON_START.fleet).reduce((sum, count) => sum + count, 0);
    expect(land).toHaveTextContent(`${pack.alloy.toLocaleString('en')} alloy`);
    expect(land).toHaveTextContent(`${pack.crystal.toLocaleString('en')} crystal`);
    expect(land).toHaveTextContent(`${String(ships)} ships`);
    expect(land).toHaveTextContent(/Shield 72 h/u);
    expect(land).toHaveTextContent(/Core 1–6/u);
    expect(land).toHaveTextContent(/Silent Space 30 h/u);
    expect(land).not.toHaveTextContent(/pirates does not/iu);
    fireEvent.click(within(land).getByRole('button', { name: /How your world is kept/u }));
    expect(land).toHaveTextContent(/pirates does not/iu);
  });

  // Plan 2026-11-13 §4.4 and the UI standard (≤ 55 words a screen): the facts are read, the rules opened.
  // The panel scrolls under the ship over about two screens and the audit counts each screen as it
  // scrolls (checked in the browser); here the whole panel is held under its measured 62 + a little.
  it('keeps the whole decision within its word budget', async () => {
    const { wrap } = harness(view({ full: true, left: { alloy: 6714, crystal: 1250, deuterium: 0, ships: 0 } }));
    render(wrap(<MigrationPanel vessel={ship()} income={income} onJump={vi.fn()} />));
    const panel = await screen.findByTestId('migration-panel');
    await screen.findByTestId('jump-left');
    // Counted the way the UI audit counts: tokens of shown text that carry a letter or a digit.
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    let count = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      count += (node.textContent ?? '').split(/\s+/u).filter(token => /[\p{L}\p{N}]/u.test(token)).length;
    }
    expect(count).toBeLessThanOrEqual(64);
  });

  it('keeps what stays aboard beside what is lost', async () => {
    const { wrap } = harness(view({ left: { alloy: 500, crystal: 0, deuterium: 0, ships: 1 } }));
    render(wrap(<MigrationPanel vessel={ship()} income={income} onJump={vi.fn()} />));
    const behind = await screen.findByTestId('jump-behind');
    await waitFor(() => { expect(within(behind).getByTestId('jump-left')).toBeInTheDocument(); });
    // Only what is really lost is named: no "0 crystal".
    expect(within(behind).getByTestId('jump-left')).toHaveTextContent(/^Lost: 500 alloy, 1 ship\.$/u);
    expect(within(behind).getByTestId('jump-stays')).toHaveTextContent(/repairs and research stay aboard/iu);
  });
});

// Plan 2026-11-06 §7.3-4 (Faz 4.6): the address beside an old starter neighbour says who is near.
describe('landing beside an old neighbour', () => {
  it('names the old neighbour on that address, and only there', () => {
    const choices = [{ index: 1, x: 100, y: 0, z: 0, neighbours: 0 }, { index: 2, x: 900, y: 0, z: 0, neighbours: 2, friend: 'Vela' }, { index: 3, x: 2000, y: 0, z: 0, neighbours: 6 }];
    const { wrap } = harness(view({ choices }));
    render(wrap(<LandingChoice view={view({ choices }) as unknown as MigrationView} onCancel={vi.fn()} onLanded={vi.fn()} />));
    const radios = screen.getAllByRole('radio');
    expect(radios[1]).toHaveTextContent('Old neighbour Vela is near');
    expect(radios[1]).toHaveAccessibleName(/Old neighbour Vela is near/u);
    expect(radios[0]).not.toHaveTextContent(/Old neighbour/u);
  });
});

// Item 24: the landing is the player's own choice; the guide says nothing over it.
describe('choosing where to land', () => {
  it('tells the guide it is open, and that it has closed', () => {
    const { wrap } = harness(view());
    const { unmount } = render(wrap(<LandingChoice view={migrationViewSchema.parse(view())} onCancel={vi.fn()} onLanded={vi.fn()} />));
    expect(landingSheetOpen()).toBe(true);
    unmount();
    expect(landingSheetOpen()).toBe(false);
  });
});

/** The jump is the heaviest act of the ship: the final hold, 1.5 s (owner 2026-11-13, §10.7-10). */
describe('the jump itself', () => {
  it('leaves only on a final hold of a second and a half', async () => {
    const { fetcher, wrap } = harness(view());
    render(wrap(<LandingChoice view={view() as unknown as MigrationView} onCancel={vi.fn()} onLanded={vi.fn()} />));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hold = screen.getByRole('button', { name: /Jump/u });
    const migrated = () => fetcher.mock.calls.filter(([input]) => urlOf(input).endsWith('/api/starter/migrate'));
    fireEvent.pointerDown(hold, { button: 0 });
    await vi.advanceTimersByTimeAsync(1400);
    fireEvent.pointerUp(hold);
    expect(migrated()).toHaveLength(0);
    fireEvent.pointerDown(hold, { button: 0 });
    await vi.advanceTimersByTimeAsync(1500);
    fireEvent.pointerUp(hold);
    await waitFor(() => { expect(migrated()).toHaveLength(1); });
  });
});
