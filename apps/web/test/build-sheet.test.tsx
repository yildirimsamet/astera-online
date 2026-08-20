import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PROSPECTOR } from '@blindspace/rules';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * HOW MANY, AND THE ONE HULL WHERE THE ANSWER IS NOT "AS MANY AS YOU CAN AFFORD".
 *
 * The quantity picker offered a fixed `1 · 5 · 25 · Max` for every hull. That is
 * right for warships and wrong for the Prospector, which is rationed to
 * `PROSPECTOR.max` — so the sheet was offering to build twenty-five of something a
 * planet may hold three of, and the server refused on the way through.
 *
 * A control that offers what will be refused is worse than one that refuses early:
 * it teaches the player a rule that is not true, and then contradicts them.
 *
 * The server is still the authority (Principle 1 — the client never decides an
 * outcome); these assertions are about the OFFER matching the rule, which is a
 * separate job from enforcing it. The enforcement has its own tests, against a
 * real database, in `apps/server/test/mining.test.ts`.
 */

const rich = (over: Partial<Omit<PlanetView, 'planet'>> = {}): PlanetView =>
  planetView(
    {
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4 },
      orbitSlots: 3,
      fleet: {},
      fleetAway: {},
      score: { wealth: 10_000, dominion: 0 },
      ...over,
    },
    { alloy: 900_000, crystal: 400_000, alloyCap: 2_000_000, crystalCap: 900_000 },
  );

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: current, dataUpdatedAt: Date.now(), isPending: false }),
    useGalaxy: () => ({ data: undefined }),
    useIntel: () => ({ data: undefined }),
    usePending: () => ({ data: undefined }),
    useReports: () => ({ data: undefined }),
    useUpgrade: () => ({ mutate: vi.fn(), isPending: false }),
    useBuild: () => ({ mutate: build, isPending: false }),
    useInstallSatellite: () => ({ mutate: vi.fn(), isPending: false }),
    useRaiseInstrument: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

let current: PlanetView = rich();
const build = vi.fn();

const show = (over: Partial<Omit<PlanetView, 'planet'>> = {}) => {
  current = rich(over);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PlanetScreen focusGroup="reach" />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

/**
 * Open the build sheet for a hull, the way a player does: find that hull's row and
 * press its own BUILD control. Every row on the tab carries one, so the button has
 * to be found relative to the NAME rather than by index — an index would silently
 * start testing a different hull the day a band is reordered.
 */
async function openSheet(name: string): Promise<void> {
  const user = userEvent.setup();
  const heading = screen.getByRole('heading', { name });
  let node: HTMLElement | null = heading;
  let button: HTMLButtonElement | null = null;
  while (node && !button) {
    node = node.parentElement;
    button =
      [...(node ? node.querySelectorAll('button') : [])].find(
        (b) => b.textContent.trim().toLowerCase() === 'build',
      ) ?? null;
  }
  if (!button) throw new Error(`no build control in the ${name} row`);
  await user.click(button);
}

/** The quantity buttons currently on offer, in order. */
const steps = (): string[] =>
  screen
    .getAllByRole('button')
    .map((b) => b.textContent.trim())
    .filter((t) => /^\d+$/.test(t) || /^Max \d+$/.test(t));

describe('the quantity picker', () => {
  it('offers the full ladder for a warship', async () => {
    show();
    await openSheet('Wasp');
    const offered = steps();
    expect(offered).toContain('1');
    expect(offered).toContain('5');
    expect(offered).toContain('25');
    expect(offered.some((s) => s.startsWith('Max'))).toBe(true);
  });

  /** THE COMPLAINT, ASSERTED: three is the limit, so nothing above three is offered. */
  it('never offers more Prospectors than a planet may hold', async () => {
    show();
    await openSheet('Prospector');
    for (const n of steps()) {
      const value = Number(n.replace('Max ', ''));
      expect(value, `the picker offered ${n}, over the cap`).toBeLessThanOrEqual(PROSPECTOR.max);
    }
    expect(steps()).not.toContain('5');
    expect(steps()).not.toContain('25');
    expect(steps()).toContain(`Max ${String(PROSPECTOR.max)}`);
  });

  it('shrinks the offer as craft are built', async () => {
    show({ fleet: { PROSPECTOR: 2 } });
    await openSheet('Prospector');
    const offered = steps().map((s) => Number(s.replace('Max ', '')));
    expect(Math.max(...offered)).toBe(1);
  });

  /**
   * THE ONE THAT NEEDED A NEW FIELD ON THE PAYLOAD.
   *
   * `fleet` is what is standing on the ground, and craft that are away mining are
   * not in it. Counting only that, the sheet would cheerfully offer three more to
   * somebody whose three were in the air — and the server, which counts what you
   * OWN, would refuse every one of them.
   */
  it('counts craft that are away mining, not just the ones at home', async () => {
    show({ fleet: {}, fleetAway: { PROSPECTOR: PROSPECTOR.max } });
    await openSheet('Prospector');
    expect(steps()).toEqual([]);
    expect(screen.getByText(/the limit/i)).toBeInTheDocument();
  });

  it('says why there is nothing to choose, rather than showing an empty row', async () => {
    show({ fleet: { PROSPECTOR: PROSPECTOR.max } });
    await openSheet('Prospector');
    expect(screen.getByText(/already hold/i)).toBeInTheDocument();
    expect(steps()).toEqual([]);
  });

  /** And it states the holding, so the number is never a surprise. */
  it('shows how many are held against the cap while there is still room', async () => {
    show({ fleet: { PROSPECTOR: 1 } });
    await openSheet('Prospector');
    expect(screen.getByText(new RegExp(`1 of ${String(PROSPECTOR.max)} held`, 'i'))).toBeInTheDocument();
  });

  /** No duplicate rungs: a ceiling that lands on 1 must not offer "1 · Max 1". */
  it('never offers the same number twice', async () => {
    show({ fleet: { PROSPECTOR: PROSPECTOR.max - 1 } });
    await openSheet('Prospector');
    const values = steps().map((s) => Number(s.replace('Max ', '')));
    expect(new Set(values).size).toBe(values.length);
  });

  /**
   * A HULL YOU CANNOT AFFORD DOES NOT OPEN A SHEET AT ALL. D26.
   *
   * The row's control goes to the SHORT state, which is `disabled` and states the
   * shortfall in words — so the answer to "why can I not build this" is on the row
   * itself and never behind a tap. This is asserted rather than assumed because the
   * quantity picker's ceiling is `Math.max(1, room)`: it always offers at least one
   * button, and if the sheet WERE reachable while short, that button would invite a
   * purchase the player cannot make.
   */
  it('does not open at all for a hull the planet cannot afford', async () => {
    current = planetView(
      { buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4 }, fleet: {} },
      { alloy: 0, crystal: 0 },
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <PlanetScreen focusGroup="reach" />
        </ToastProvider>
      </QueryClientProvider>,
    );

    await expect(openSheet('Wasp')).rejects.toThrow(/no build control/);
    // The control is present, disabled, and says what is wrong.
    const short = screen.getAllByRole('button', { name: /short/i });
    expect(short.length).toBeGreaterThan(0);
    expect(short[0]).toBeDisabled();
    // And nothing opened, so there is no picker to press.
    expect(steps()).toEqual([]);
  });

  it('builds the number that was chosen', async () => {
    build.mockClear();
    show();
    const user = userEvent.setup();
    await openSheet('Prospector');
    await user.click(screen.getByRole('button', { name: `Max ${String(PROSPECTOR.max)}` }));
    const act = screen.getByRole('button', { name: new RegExp(`Build ${String(PROSPECTOR.max)}`, 'i') });
    await user.click(within(act).getByText(new RegExp(`Build ${String(PROSPECTOR.max)}`, 'i')).closest('button') ?? act);
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({ hull: 'PROSPECTOR', count: PROSPECTOR.max }),
      expect.anything(),
    );
  });
});
