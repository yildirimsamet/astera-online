import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PROSPECTOR, groundSlots, hangarCapacity, hullFuelRate } from '@astera/rules';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { planetView } from './fixtures.js';

/**
 * HOW MANY, AND THE ONE HULL WHERE THE ANSWER IS NOT "AS MANY AS YOU CAN AFFORD".
 *
 * The quantity picker must expose every valid integer and respect the one hull
 * whose answer is not simply "as many as you can afford": the Prospector is also
 * rationed to `PROSPECTOR.max`.
 *
 * A control that offers what will be refused is worse than one that refuses early:
 * it teaches the player a rule that is not true, and then contradicts them.
 *
 * The server is still the authority (Principle 1 — the client never decides an
 * outcome); these assertions are about the OFFER matching the rule, which is a
 * separate job from enforcing it. The enforcement has its own tests, against a
 * real database, in `apps/server/test/mining.test.ts`.
 */

const rich = (
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  stock: Partial<PlanetView['planet']> = {},
): PlanetView =>
  planetView(
    {
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4, HANGAR: 0 },
      orbitSlots: 3,
      fleet: {},
      fleetAway: {},
      score: { wealth: 10_000, dominion: 0 },
      ...over,
    },
    {
      alloy: 900_000,
      crystal: 400_000,
      alloyCap: 2_000_000,
      crystalCap: 900_000,
      ...stock,
    },
  );

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: current, dataUpdatedAt: Date.now(), isPending: false, refetch }),
    useGalaxy: () => ({ data: undefined }),
    useIntel: () => ({ data: undefined }),
    usePending: () => ({ data: undefined }),
    useReports: () => ({ data: undefined }),
    useUpgrade: () => ({ mutate: upgrade, isPending: false }),
    useBuild: () => ({ mutate: build, isPending: false }),
    useCompleteResearch: () => ({ mutate: completeResearch, isPending: false }),
    useInstallSatellite: () => ({ mutate: vi.fn(), isPending: false }),
    useRaiseInstrument: () => ({ mutate: vi.fn(), isPending: false }),
    useCancelBuildOrder: () => ({ mutate: cancelOrder, isPending: false }),
    useBuildDeathStar: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildInterceptor: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

let current: PlanetView = rich();
type MutationMock = (variables: unknown, options?: unknown) => void;

const build = vi.fn<MutationMock>();
const cancelOrder = vi.fn<MutationMock>();
const upgrade = vi.fn<MutationMock>();
const completeResearch = vi.fn<MutationMock>();
const refetch = vi.fn();

function expectMutationCallbacks(value: unknown): void {
  if (typeof value !== 'object' || value === null) {
    throw new Error('mutation callbacks were not supplied');
  }
  expect(typeof Reflect.get(value, 'onSuccess')).toBe('function');
  expect(typeof Reflect.get(value, 'onError')).toBe('function');
}

const show = (
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  focusGroup: 'grow' | 'orbit' | 'defend' | 'reach' = 'reach',
  stock: Partial<PlanetView['planet']> = {},
) => {
  current = rich(over, stock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PlanetScreen focusGroup={focusGroup} />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

describe('strategic hardware hierarchy', () => {
  it('keeps an unbuilt Death Star inside Fleet instead of leading every planet visit', async () => {
    const view = show({}, 'grow');
    expect(view.container.querySelector('[data-strategic-state]')).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: 'Fleet' }));
    expect(view.container.querySelector('[data-strategic-state="LOCKED"]')).not.toBeNull();
  });

  it('raises a live strategic asset above every tab because it is now planet state', () => {
    const view = show({
      strategic: {
        id: 'asset-1',
        status: 'READY',
        readyAt: null,
        remainingSeconds: 0,
      },
    }, 'grow');
    const forge = view.container.querySelector('[data-strategic-state="READY"]');
    const tabs = screen.getByRole('tab', { name: 'Production' }).parentElement?.parentElement ?? null;
    expect(forge).not.toBeNull();
    expect(tabs).not.toBeNull();
    if (!forge || !tabs) throw new Error('strategic state and tabs must both render');
    expect(forge.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('the two build queues', () => {
  it('shows both independent lanes, the server clock and the exact cancellation refund', async () => {
    cancelOrder.mockClear();
    const now = Date.now();
    show({
      queues: {
        CONSTRUCTION: [{
          id: 'construction-1',
          queue: 'CONSTRUCTION',
          slot: 0,
          kind: 'BUILDING',
          subject: 'CORE',
          count: 1,
          startedAt: new Date(now - 10_000),
          finishesAt: new Date(now + 50_000),
          cost: { alloy: 101, crystal: 45, deuterium: 3 },
        }],
        YARD: [{
          id: 'yard-1',
          queue: 'YARD',
          slot: 0,
          kind: 'HULL',
          subject: 'DART',
          count: 2,
          startedAt: new Date(now - 5_000),
          finishesAt: new Date(now + 55_000),
          cost: { alloy: 480, crystal: 0, deuterium: 0 },
        }],
      },
    }, 'grow');

    /*
      THE LIST BECAME A TIMELINE. Owner instruction: a segment forty pixels wide
      carries the RENDER rather than the name, so what is asserted is the shape —
      one segment per order, the lane's ending, and the name surviving as the
      accessible label a screen reader hears.
    */
    const queues = screen.getByRole('region', { name: 'Build queues' });
    expect(within(queues).getByText('Construction')).toBeInTheDocument();
    expect(within(queues).getByText('Yard')).toBeInTheDocument();
    const segments = queues.querySelectorAll('[data-segment]');
    expect(segments).toHaveLength(2);
    expect(segments[0]?.getAttribute('aria-label') ?? '').toMatch(/Command Core/);
    expect(segments[1]?.getAttribute('aria-label') ?? '').toMatch(/Dart/);
    expect(within(queues).getByText('×2')).toBeInTheDocument();
    // Both lanes now say when their work ends, which no screen used to carry.
    expect(queues.querySelectorAll('[data-lane-ends]')).toHaveLength(2);

    const [cancel] = within(queues).getAllByRole('button', { name: /^Cancel / });
    expect(cancel).toHaveAttribute(
      'title',
      'Refund: 50 alloy · 22 crystal · 1 Deuterium',
    );
    await userEvent.click(cancel!);
    expect(cancelOrder).toHaveBeenCalledOnce();
    expect(cancelOrder.mock.calls[0]?.[0]).toBe('construction-1');
    expectMutationCallbacks(cancelOrder.mock.calls[0]?.[1]);
  });

  it('does not offer a fake cancellation before the placement response supplies an id', () => {
    cancelOrder.mockClear();
    show({
      queues: {
        CONSTRUCTION: [{
          id: 'optimistic-1',
          queue: 'CONSTRUCTION',
          slot: 0,
          kind: 'BUILDING',
          subject: 'REFINERY',
          count: 1,
          cost: { alloy: 100, crystal: 25, deuterium: 0 },
          optimistic: true,
        }],
        YARD: [],
      },
    }, 'grow');

    /*
      An order the server has not acknowledged has no clock and no id, so the strip
      draws its segment and offers no cancel at all — a control that could only ever
      send a guaranteed 404 is worse than no control.
    */
    const queues = screen.getByRole('region', { name: 'Build queues' });
    expect(queues.querySelectorAll('[data-segment]')).toHaveLength(1);
    expect(queues.querySelector('[data-cancel]')).toBeNull();
    expect(queues.querySelector('[data-lane-ends]')).toBeNull();
    expect(cancelOrder).not.toHaveBeenCalled();
  });

  it('shows the durable level while keeping the next projected order actionable', async () => {
    upgrade.mockClear();
    const now = Date.now();
    const view = show({
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4 },
      queues: {
        CONSTRUCTION: [{
          id: 'refinery-1',
          queue: 'CONSTRUCTION',
          slot: 0,
          kind: 'BUILDING',
          subject: 'REFINERY',
          count: 1,
          startedAt: new Date(now),
          finishesAt: new Date(now + 60_000),
          cost: { alloy: 100, crystal: 25, deuterium: 0 },
        }],
        YARD: [],
      },
    }, 'grow');

    const row = view.container.querySelector('#row-REFINERY [data-progression-state]');
    expect(row).toHaveAttribute('data-progression-state', 'queued');
    expect(row).toHaveTextContent('L3');
    expect(row).toHaveTextContent('1 order queued');
    await userEvent.click(within(row as HTMLElement).getByRole('button', { name: /about alloy refinery/i }));
    await userEvent.click(screen.getByRole('button', { name: /raise to l5/i }));
    expect(upgrade).toHaveBeenCalledOnce();
    expect(upgrade.mock.calls[0]?.[0]).toBe('REFINERY');
    expectMutationCallbacks(upgrade.mock.calls[0]?.[1]);
  });

  it('keeps a repeatable hull actionable while an earlier batch is queued', () => {
    const now = new Date();
    const view = show({
      fleet: { DART: 2 },
      queues: {
        CONSTRUCTION: [],
        YARD: [{
          id: 'wasp-batch-1',
          queue: 'YARD',
          slot: 0,
          kind: 'HULL',
          subject: 'DART',
          count: 3,
          startedAt: now,
          finishesAt: new Date(now.getTime() + 60_000),
          cost: { alloy: 720, crystal: 0, deuterium: 0 },
        }],
      },
    }, 'reach');
    const row = view.container.querySelector('#row-DART [data-progression-state]');
    expect(row).toHaveAttribute('data-progression-state', 'queued');
    expect(row).toHaveTextContent('3 units queued');
    expect(within(row as HTMLElement).getByRole('button', { name: /about dart/i })).toBeInTheDocument();
  });

  it('wakes at the server-named completion instant instead of waiting for a poll', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
    refetch.mockClear();
    const startsAt = new Date(Date.now() - 1_000);
    const finishesAt = new Date(Date.now() + 2_000);
    const view = show({
      queues: {
        CONSTRUCTION: [{
          id: 'core-wake',
          queue: 'CONSTRUCTION',
          slot: 0,
          kind: 'BUILDING',
          subject: 'CORE',
          count: 1,
          startedAt: startsAt,
          finishesAt,
          cost: { alloy: 81, crystal: 23, deuterium: 0 },
        }],
        YARD: [],
      },
    }, 'grow');

    act(() => { vi.advanceTimersByTime(2_049); });
    expect(refetch).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2); });
    expect(refetch).toHaveBeenCalledOnce();

    // The first read can beat the one-second worker poll and return the same
    // still-active order. Keep reconciling instead of leaving it at 00:00 until
    // an SSE event or a page reload happens to rescue the screen.
    act(() => { vi.advanceTimersByTime(1_001); });
    expect(refetch).toHaveBeenCalledTimes(2);
    view.unmount();
    vi.useRealTimers();
  });

});

/**
 * Open the build sheet for a hull, the way a player does: find that hull's row and
 * press the compact row. The build commitment exists only in the sheet, so the row
 * to be found relative to the NAME rather than by index — an index would silently
 * start testing a different hull the day a band is reordered.
 */
async function openSheet(name: string): Promise<void> {
  const user = userEvent.setup();
  const heading = screen.getByRole('heading', { name });
  const row = heading.closest(`#row-${name.toUpperCase()}`)
    ?? heading.closest('[id^="row-"]');
  const button = row ? within(row as HTMLElement).getByRole('button', { name: new RegExp(`about ${name}`, 'i') }) : null;
  if (!button) throw new Error(`no detail control in the ${name} row`);
  await user.click(button);
}

describe('fleet holdings beside each hull name', () => {
  it('separates ships standing at home from ships that are away', () => {
    const view = show({ fleet: { DART: 5 }, fleetAway: { DART: 6 } });
    const row = view.container.querySelector('#row-DART');

    expect(row).toHaveTextContent('Dart');
    expect(row).toHaveTextContent('(Home: 5, Away: 6)');
  });

  it('shows zero explicitly when none of that hull are away', () => {
    const view = show({ fleet: { DART: 11 }, fleetAway: {} });
    const row = view.container.querySelector('#row-DART');

    expect(row).toHaveTextContent('(Home: 11, Away: 0)');
  });
});

describe('the quantity picker', () => {
  it('shows the Hangar and never offers more ships than fit', async () => {
    const hangar = hangarCapacity(0);
    show({
      fleet: { DART: hangar - 1 },
      capacity: {
        hangar,
        hangarUsed: hangar - 1,
        ground: groundSlots(6),
        groundUsed: 0,
      },
    });

    expect(screen.getByRole('heading', { name: 'Hangar' })).toBeInTheDocument();
    await openSheet('Dart');
    expect(screen.getByRole('textbox', { name: /dart quantity/i })).toHaveValue('1');
    expect(screen.getByRole('button', { name: /more dart/i })).toBeDisabled();
    /*
      THE SENTENCE BECAME A PICTURE. Owner instruction: this line used to carry the
      hull's footprint, the load and the ceiling as text, and none of the three
      questions it answers could be answered from it at a glance. `CapacityBar`
      draws them — so what is asserted here is the ANSWER the player came for,
      which is how many more fit, and that one Dart is drawn at its own width.
    */
    const room = document.querySelector('[data-fits]');
    expect(room).toHaveTextContent('1');
    expect(document.querySelector('[data-part="one"]')).toBeInTheDocument();
  });

  it('offers minus, plus and Max around a read-only quantity for a warship', async () => {
    show();
    await openSheet('Dart');
    expect(screen.getByRole('button', { name: /fewer dart/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /more dart/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /max dart/i })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: /dart quantity/i })).toHaveValue('1');
    expect(screen.getByRole('textbox', { name: /dart quantity/i })).toHaveAttribute('readonly');
  });

  /** THE COMPLAINT, ASSERTED: the ownership cap is also the picker's ceiling. */
  it('never offers more Prospectors than a planet may hold', async () => {
    show();
    await openSheet('Prospector');
    await userEvent.setup().click(screen.getByRole('button', { name: /max prospector/i }));
    expect(screen.getByRole('textbox', { name: /prospector quantity/i }))
      .toHaveValue(String(PROSPECTOR.max));
    expect(screen.getByRole('button', { name: /more prospector/i })).toBeDisabled();
  });

  it('shrinks the offer as craft are built', async () => {
    show({ fleet: { PROSPECTOR: PROSPECTOR.max - 1 } });
    await openSheet('Prospector');
    expect(screen.getByRole('textbox', { name: /prospector quantity/i })).toHaveValue('1');
    expect(screen.getByRole('button', { name: /max prospector/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /more prospector/i })).toBeDisabled();
  });

  /**
   * THE ONE THAT NEEDED A NEW FIELD ON THE PAYLOAD.
   *
   * `fleet` is what is standing on the ground, and craft that are away mining are
   * not in it. Counting only that, the row would cheerfully offer another one to
   * somebody whose craft were in the air — and the server, which counts what you
   * OWN, would refuse every one of them.
   */
  it('removes the row action when all owned Prospectors are away mining', () => {
    show({ fleet: {}, fleetAway: { PROSPECTOR: PROSPECTOR.max } });
    const row = screen.getByRole('heading', { name: 'Prospector' })
      .closest('#row-PROSPECTOR');
    expect(row).not.toBeNull();
    if (!(row instanceof HTMLElement)) throw new Error('Prospector row must render');
    expect(within(row).queryByRole('button', { name: /build/i })).toBeNull();
    expect(within(row).getByRole('status')).toHaveTextContent(
      new RegExp(`${String(PROSPECTOR.max)} / ${String(PROSPECTOR.max)}.*limit`, 'i'),
    );
  });

  it('shows the ownership limit instead of a false 2-to-3 gain or Build button', () => {
    show({ fleet: { PROSPECTOR: PROSPECTOR.max } });
    const row = screen.getByRole('heading', { name: 'Prospector' })
      .closest('#row-PROSPECTOR');
    expect(row).not.toBeNull();
    if (!(row instanceof HTMLElement)) throw new Error('Prospector row must render');
    expect(within(row).queryByRole('button', { name: /build/i })).toBeNull();
    expect(within(row).queryByText(String(PROSPECTOR.max + 1))).toBeNull();
    expect(within(row).getByRole('status')).toHaveTextContent(/limit/i);
  });

  /** And it states the holding, so the number is never a surprise. */
  it('shows how many are held against the cap while there is still room', async () => {
    show({ fleet: { PROSPECTOR: 1 } });
    await openSheet('Prospector');
    expect(screen.getByText(new RegExp(`1 of ${String(PROSPECTOR.max)} held`, 'i'))).toBeInTheDocument();
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
  it('opens for an unaffordable hull and explains the shortfall before commit', async () => {
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

    await openSheet('Dart');
    // The sheet remains informative while its commitment states the shortfall.
    const short = screen.getAllByRole('button', { name: /short/i });
    expect(short.length).toBeGreaterThan(0);
    expect(short[0]).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /quantity/i })).toBeInTheDocument();
  });

  it('increments large warship orders one at a time', async () => {
    show();
    await openSheet('Dart');
    const user = userEvent.setup();
    const more = screen.getByRole('button', { name: /more dart/i });
    await user.click(more);
    await user.click(more);
    expect(screen.getByRole('textbox', { name: /dart quantity/i })).toHaveValue('3');
  });

  it('builds the number that was chosen', async () => {
    build.mockClear();
    show();
    const user = userEvent.setup();
    await openSheet('Prospector');
    await user.click(screen.getByRole('button', { name: /max prospector/i }));
    const act = screen.getByRole('button', { name: new RegExp(`Build ${String(PROSPECTOR.max)}`, 'i') });
    await user.click(within(act).getByText(new RegExp(`Build ${String(PROSPECTOR.max)}`, 'i')).closest('button') ?? act);
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({ hull: 'PROSPECTOR', count: PROSPECTOR.max }),
      expect.anything(),
    );
  });
});

/** The image carries both comparison overlays: cost left, compact hull facts right. */
describe('craft facts over the hero art', () => {
  it('pins the cost to the image top-left without a Costs heading', async () => {
    show({});
    await openSheet('Dart');
    const art = document.querySelector('[data-build-art]');
    const price = document.querySelector('[data-build-price]');

    expect(art).not.toBeNull();
    expect(price).not.toBeNull();
    expect(art).toContainElement(price as HTMLElement);
    expect(price).toHaveClass('absolute', 'left-1', 'top-1');
    expect(within(price as HTMLElement).queryByText('Costs')).not.toBeInTheDocument();
  });

  it('pins the stat section to the image top-right at half scale', async () => {
    show({});
    await openSheet('Dart');
    const art = document.querySelector('[data-build-art]');
    const stats = document.querySelector('[data-build-stats]');

    expect(art).not.toBeNull();
    expect(stats).not.toBeNull();
    expect(art).toContainElement(stats as HTMLElement);
    expect(stats).toHaveClass('absolute', 'right-1', 'top-1', 'origin-top-right', 'scale-50');
  });

  /** One price per sheet: the figure shown is the one the commit button quotes. */
  it('shows the order total, and only once', async () => {
    show({});
    await openSheet('Dart');
    expect(document.querySelectorAll('[data-build-price]')).toHaveLength(1);
  });
});

/**
 * WHAT A HULL COSTS TO MOVE, ON THE CARD WHERE HULLS ARE COMPARED. Owner report.
 *
 * The craft sheet answers "what is this ship" in four figures — attack, hull,
 * speed, cargo — and since T6 a fifth decides whether a fleet can be flown at all.
 * It was in no screen in the game. A commander could see that a Bulwark is slow
 * and takes twelve Darts' worth of Hangar and had no way to learn, short of
 * packing one and reading the launch sheet, that it also burns twelve times a
 * Dart's deuterium to go anywhere.
 *
 * A RATE, over `FUEL.reference`, because a charge needs a destination and this
 * card has none. The launch and transfer sheets quote the charge itself.
 */
describe('the fuel a craft burns', () => {
  it('states the rate on the sheet where two hulls are compared', async () => {
    show();
    await openSheet('Dart');

    const fuel = document.querySelector('.stat-fuel');
    expect(fuel, 'the craft sheet says nothing about fuel').not.toBeNull();
    expect(fuel).toHaveTextContent(hullFuelRate('DART').toFixed(1));
    expect(fuel).toHaveTextContent(/fuel/i);
  });

  it('scales with the mass the Hangar already charges for', async () => {
    show();
    await openSheet('Rampart');

    expect(document.querySelector('.stat-fuel'))
      .toHaveTextContent(hullFuelRate('RAMPART').toFixed(1));
  });

  /** A gun never travels. A rate for one would invent a decision that cannot be made. */
  it('leaves the figure out for a hull that cannot travel', async () => {
    show({}, 'defend');
    await openSheet('Bastion');

    expect(document.querySelector('.stat-fuel')).toHaveTextContent('—');
  });
});
