import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  COMBAT,
  DEATH_STAR,
  HULLS,
  PROSPECTOR,
  groundSlots,
  hangarCapacity,
  hullBulk,
  hullFuelRate,
} from '@astera/rules';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { openAllBands, planetView } from './fixtures.js';
import { AcademyLessonContext } from '../src/onboarding/lessonScope.js';
import { duration } from '../src/lib/time.js';
import { factor } from '../src/lib/format.js';

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
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4 },
      orbitSlots: 3,
      fleet: {},
      fleetAway: {},
      score: { wealth: 10_000, dominion: 0 },
      // Room enough that the purse, not the Hangar, is what these tests are about.
      capacity: { hangar: hangarCapacity(10), hangarUsed: 0, ground: groundSlots(6), groundUsed: 0 },
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
    useCollect: () => ({ mutate: vi.fn(), isPending: false }),
    useBuild: () => ({ mutate: build, isPending: false }),
    useCompleteResearch: () => ({ mutate: completeResearch, isPending: false }),
    useInstallSatellite: () => ({ mutate: vi.fn(), isPending: false }),
    useRaiseInstrument: () => ({ mutate: vi.fn(), isPending: false }),
    useCancelBuildOrder: () => ({ mutate: cancelOrder, isPending: false }),
    useBuildDeathStar: () => ({ mutate: buildDeathStar, isPending: false }),
    useBuildInterceptor: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

let current: PlanetView = rich();
type MutationMock = (variables: unknown, options?: unknown) => void;

const build = vi.fn<MutationMock>();
const buildDeathStar = vi.fn<MutationMock>();
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
  it('keeps the temporarily disabled Death Star forge display-none', async () => {
    const view = show({}, 'grow');
    expect(view.container.querySelector('[data-strategic-state]')).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: 'Fleet' }));
    expect(view.container.querySelector('[data-strategic-state="LOCKED"]')).toHaveClass('hidden');
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

  /**
   * THE STOCKPILE IS AN ACTION, NOT ONLY A RULES NUMBER.
   *
   * The server has always admitted a second weapon after the research, but the
   * forge hid its build control as soon as ANY weapon existed. That made the
   * researched capacity unreachable from the only surface that builds one.
   */
  it('offers the second weapon while one slot in a researched stockpile is free', async () => {
    buildDeathStar.mockClear();
    const base = rich();
    const ready = {
      id: 'asset-ready',
      status: 'READY' as const,
      readyAt: new Date(),
      remainingSeconds: 0,
    };
    const view = show(
      {
        buildings: { CORE: DEATH_STAR.requiredCore, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: DEATH_STAR.requiredShipyard },
        research: base.research.map((project) =>
          project.id === 'DEATH_STAR_PROTOCOL' || project.id === 'STRATEGIC_STOCKPILE'
            ? { ...project, level: 1, discovered: true, completed: true, available: false }
            : project),
        strategic: ready,
        deathStars: [ready],
      },
      'reach',
      {
        deuterium: DEATH_STAR.cost.deuterium * 2,
        deuteriumCap: DEATH_STAR.cost.deuterium * 4,
      },
    );

    const forge = view.container.querySelector<HTMLElement>('[data-strategic-state="READY"]');
    expect(forge).not.toBeNull();
    expect(forge).toHaveAttribute('data-strategic-count', '1');
    expect(forge).toHaveAttribute('data-strategic-capacity', '2');
    const button = within(forge!).getByRole('button', { name: 'Build' });
    expect(button).toBeEnabled();

    await userEvent.click(button);
    expect(buildDeathStar).toHaveBeenCalledOnce();
  });

  /**
   * A READY FIRST WEAPON MUST NOT HIDE THE SECOND ONE STILL BEING BUILT.
   * `remainingSeconds` is a frozen build-duration field; `readyAt` is the live
   * clock, so halfway through a build must draw halfway rather than two percent.
   */
  it('shows both weapons and derives the active build progress from readyAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T12:00:00.000Z'));
    try {
      const ready = {
        id: 'asset-ready',
        status: 'READY' as const,
        readyAt: new Date('2026-09-11T11:00:00.000Z'),
        remainingSeconds: 0,
      };
      const building = {
        id: 'asset-building',
        status: 'BUILDING' as const,
        readyAt: new Date(Date.now() + DEATH_STAR.buildMinutes * 30_000),
        // Deliberately frozen at the full duration, exactly as the server stores it.
        remainingSeconds: DEATH_STAR.buildMinutes * 60,
      };
      const view = show({
        strategic: ready,
        deathStars: [ready, building],
      });

      const forge = view.container.querySelector<HTMLElement>('[data-strategic-state="READY"]');
      expect(forge).toHaveAttribute('data-strategic-count', '2');
      expect(forge).toHaveTextContent(/1 ready.*1 building/i);
      expect(forge?.querySelector<HTMLElement>('[data-strategic-progress]'))
        .toHaveStyle({ width: '50%' });
    } finally {
      vi.useRealTimers();
    }
  });

  /** A ready first slot must not suppress the wake-up for the second slot. */
  it('refetches when a second stockpiled weapon reaches its readyAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T12:00:00.000Z'));
    refetch.mockClear();
    try {
      const ready = {
        id: 'asset-ready',
        status: 'READY' as const,
        readyAt: new Date(Date.now() - 60_000),
        remainingSeconds: 0,
      };
      const building = {
        id: 'asset-building',
        status: 'BUILDING' as const,
        readyAt: new Date(Date.now() + 2_000),
        remainingSeconds: DEATH_STAR.buildMinutes * 60,
      };
      const view = show({ strategic: ready, deathStars: [ready, building] });

      act(() => { vi.advanceTimersByTime(2_051); });
      expect(refetch).toHaveBeenCalledOnce();
      view.unmount();
    } finally {
      vi.useRealTimers();
    }
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
      THE LANES ARE RINGS (B12): one ring per order, filling as the head builds, the
      name surviving as the accessible label a screen reader hears.
    */
    const queues = screen.getByRole('region', { name: 'Build queues' });
    expect(within(queues).getByText('Construction')).toBeInTheDocument();
    expect(within(queues).getByText('Yard')).toBeInTheDocument();
    expect(queues.querySelectorAll('[data-ring]')).toHaveLength(2);
    const lanes = within(queues).getAllByRole('button');
    expect(lanes[0]?.getAttribute('aria-label') ?? '').toMatch(/Command Core/);
    expect(lanes[1]?.getAttribute('aria-label') ?? '').toMatch(/Dart/);
    expect(within(queues).getByText('×2')).toBeInTheDocument();

    /*
      A LANE IS A GLANCE; THE SHEET IS WHERE WORK IS UNDONE (B12). The tap opens the queue
      sheet, and both lanes say there when their work ends, which no screen used to carry.
    */
    await userEvent.click(lanes[0]!);
    const sheet = await screen.findByRole('dialog', { name: 'Build queues' });
    expect(sheet.querySelectorAll('[data-lane-ends]')).toHaveLength(2);

    /*
      THE PRICE MOVED FROM A TOOLTIP TO A SHEET. Owner report.

      It used to be a `title` attribute reading "Refund: 50 alloy · …" — a hover
      tooltip, on a game budgeted for a 350pt phone, where no such thing exists.
      So the half this control destroys was not merely unconfirmed on the target
      device, it never appeared at all. `irreversible-confirm.test.tsx` holds the
      sheet's own grammar; what this asserts is the wiring: one press asks, the
      confirmation fires, and the right order id reaches the mutation.
    */
    const [cancel] = within(sheet).getAllByRole('button', { name: /^Cancel / });
    expect(cancel).not.toHaveAttribute('title');
    await userEvent.click(cancel!);
    expect(cancelOrder, 'the first press cancelled without asking').not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('confirm-commit'));
    expect(cancelOrder).toHaveBeenCalledOnce();
    expect(cancelOrder.mock.calls[0]?.[0]).toBe('construction-1');
    expectMutationCallbacks(cancelOrder.mock.calls[0]?.[1]);
  });

  it('does not offer a fake cancellation before the placement response supplies an id', async () => {
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
    expect(queues.querySelectorAll('[data-ring]')).toHaveLength(1);
    await userEvent.click(within(queues).getAllByRole('button')[0]!);
    const sheet = await screen.findByRole('dialog', { name: 'Build queues' });
    expect(within(sheet).queryByRole('button', { name: /^Cancel / })).toBeNull();
    expect(sheet.querySelector('[data-lane-ends]')).toBeNull();
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
  // The Fleet tab's families fold; these tests are about the sheet behind a hull,
  // not about the fold, so they reach past it. See `ship-list-density.test.tsx`.
  await openAllBands(screen, user);
  const heading = screen.getByRole('heading', { name });
  const row = heading.closest(`#row-${name.toUpperCase()}`)
    ?? heading.closest('[id^="row-"]');
  const button = row ? within(row as HTMLElement).getByRole('button', { name: new RegExp(`about ${name}`, 'i') }) : null;
  if (!button) throw new Error(`no detail control in the ${name} row`);
  await user.click(button);
}

describe('fleet holdings beside each hull name', () => {
  /**
   * THE ROW NAMES WHAT IS AWAY, AND NOTHING ELSE.
   *
   * It used to print "(Home: 5, Away: 6)" beside the name while the gain line two
   * rows down said "You have 5 → 6" — the same fact twice, and between them they
   * left the NAME about fifty pixels at 350px. The owner's screenshot showed the
   * result: "E...", "P...", "K...".
   *
   * Away is the half a commander cannot read anywhere else on this screen, so away
   * is the half that stays.
   */
  it('names where the ships are, both halves of it', () => {
    const view = show({ fleet: { DART: 5 }, fleetAway: { DART: 6 } });
    const row = view.container.querySelector('#row-DART');

    expect(row).toHaveTextContent('Dart');
    /*
      BOTH FIGURES SINCE D170. It used to print the away half alone, on the
      grounds that the gain line below carries the total and home is the
      subtraction. The owner asked for the pair back — where a commander's craft
      ARE is what this tab is for — so the line states both and pays for it in
      WIDTH instead: `5 in · 6 out`, no labels spelled out and no parentheses.
    */
    expect(row).toHaveTextContent('5 in · 6 out');
    /*
      AND THE "You have 0 → 1" LINE IS GONE WITH IT. D170, owner instruction.

      It stated the same holding a second time, one line lower, in a different
      shape — and once the row above says `5 in · 6 out` there is nothing left for
      it to add. What a purchase does to the count is the one thing on a shipyard
      row a commander can work out without being told.
    */
    expect(row).not.toHaveTextContent(/You have/);
  });

  /**
   * NOTHING AWAY IS NOTHING TO SAY. "Away: 0" is a line of type spent telling a
   * commander that the ordinary thing is happening, on the row that has the least
   * width in the game to spend.
   */
  it('says nothing at all when none of that hull are away', () => {
    const view = show({ fleet: { DART: 11 }, fleetAway: {} });
    const row = view.container.querySelector('#row-DART');

    expect(row).not.toHaveTextContent(/away/i);
  });
});

describe('the quantity picker', () => {
  it.each(['darts', 'reinforcements'] as const)('offers the exact two-Dart lesson order on the first Build press in %s', async (lesson) => {
    current = rich();
    build.mockClear();
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><ToastProvider><AcademyLessonContext.Provider value={lesson}>
      <PlanetScreen focusGroup="reach" />
    </AcademyLessonContext.Provider></ToastProvider></QueryClientProvider>);
    await userEvent.click(document.querySelector('#row-DART button')!);
    expect(screen.getByRole('textbox', { name: /dart quantity/i })).toHaveValue('2');
    // The lesson's count is the whole offer: Max says two, and no reason pretends otherwise.
    expect(screen.getByRole('button', { name: /max dart/i })).toHaveTextContent('Max · 2');
    expect(document.querySelector('[data-fits]')).toBeNull();
    expect(screen.getByRole('button', { name: /fewer dart/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /more dart/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /build 2/i }));
    expect(build).toHaveBeenCalledWith({ hull: 'DART', count: 2 }, expect.anything());
  });
  /**
   * THE HANGAR IS BACK, AND THE STEPPER ANSWERS TO IT. 2026-09-18.
   *
   * A control that offers a ship the server will refuse teaches a rule that is not
   * true. The "+" stops at the last Dart that fits, and the sheet draws the room.
   */
  it('never offers more ships than the Hangar has room for', async () => {
    const hangar = hangarCapacity(1);
    const used = hangar - 2 * hullBulk('DART');
    show({
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4, HANGAR: 1 },
      fleet: { RAMPART: used / hullBulk('RAMPART') },
      capacity: { hangar, hangarUsed: used, hangarCeiling: 2, ground: groundSlots(6), groundUsed: 0 },
    });
    await openSheet('Dart');
    await userEvent.click(screen.getByRole('button', { name: /more dart/i }));
    expect(screen.getByRole('textbox', { name: /dart quantity/i })).toHaveValue('2');
    expect(screen.getByRole('button', { name: /more dart/i })).toBeDisabled();
    // Max says how many, and the line beside it what stops it there.
    expect(screen.getByRole('button', { name: /max dart/i })).toHaveTextContent('Max · 2');
    expect(document.querySelector('[data-fits]')).toHaveTextContent(/hangar/i);
  });

  it('says it is the purse that stops Max when the purse is what stops it', async () => {
    show({}, 'reach', { alloy: HULLS.DART.alloy * 3, crystal: 400_000 });
    await openSheet('Dart');
    expect(screen.getByRole('button', { name: /max dart/i })).toHaveTextContent('Max · 3');
    expect(document.querySelector('[data-fits]')).toHaveTextContent(/resources/i);
  });

  /** Seen on the phone: a Dart sheet said "14 of 2 held" — the berth line is the Prospector's alone. */
  it('keeps the berth line to the one hull that has berths', async () => {
    show({ fleet: { DART: 14 } });
    await openSheet('Dart');
    expect(screen.queryByText(/held/i)).toBeNull();
  });

  it('says the Hangar is full instead of offering a stepper', async () => {
    const hangar = hangarCapacity(1);
    show({
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4, HANGAR: 1 },
      fleet: { RAMPART: hangar / hullBulk('RAMPART') },
      capacity: { hangar, hangarUsed: hangar, hangarCeiling: 2, ground: groundSlots(6), groundUsed: 0 },
    });
    await openSheet('Dart');
    expect(screen.queryByRole('textbox', { name: /dart quantity/i })).toBeNull();
    // Said on the sheet in place of the stepper (the row behind it says it too).
    expect(screen.getAllByText(/hangar is full/i).length).toBeGreaterThan(1);
  });

  it('still draws the room a gun answers to', async () => {
    show({ capacity: { ground: groundSlots(6), groundUsed: 0 } }, 'defend');
    await openSheet('Thorn');
    expect(document.querySelector('[data-room-bar]')).toHaveTextContent(/ground room/i);
  });

  /** The order's own share of the room moves under the stepper: the rule teaching itself. */
  it('draws the room this order takes, in your colour', async () => {
    show({ fleet: { DART: 4 } });
    await openSheet('Dart');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more dart/i }));
    await user.click(screen.getByRole('button', { name: /more dart/i }));
    const room = document.querySelector<HTMLElement>('[data-room-bar]')!;
    expect(room).toHaveTextContent(/hangar room/i);
    expect(room.querySelector('[data-part="home"]')).not.toBeNull();
    expect(room.querySelector('[data-part="incoming"]')).not.toBeNull();
    expect(room.querySelector('[data-room-legend]')).toHaveTextContent(`this order ${String(3 * hullBulk('DART'))}`);
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
   * THE THIRD BERTH IS BOUGHT, AND THIS SCREEN IS WHERE IT IS SPENT. D170.
   *
   * `prospectorCeiling` has read the third rung of Prospector Holds since D170 and
   * `buildUnits` has honoured it — the picker did not, so the commander who paid
   * 6,000 alloy for the berth met a row that still said "2 / 2 · limit". Every
   * figure this row states — the ceiling, the offer, the held-of-max line — is the
   * commander's ceiling now, never the bare constant.
   */
  const withHolds = (
    level: number,
    over: Partial<Omit<PlanetView, 'planet'>> = {},
  ): Partial<Omit<PlanetView, 'planet'>> => ({
    research: rich().research.map((project) => (
      project.id === 'PROSPECTOR_HOLDS' ? { ...project, level } : project
    )),
    ...over,
  });

  it('offers the third berth the third rung of Prospector Holds bought', async () => {
    show(withHolds(3));
    await openSheet('Prospector');
    await userEvent.setup().click(screen.getByRole('button', { name: /max prospector/i }));
    expect(screen.getByRole('textbox', { name: /prospector quantity/i }))
      .toHaveValue(String(PROSPECTOR.max + 1));
  });

  it('states the bought ceiling on the row rather than the bare constant', () => {
    show(withHolds(3, { fleet: { PROSPECTOR: PROSPECTOR.max + 1 } }));
    const row = screen.getByRole('heading', { name: 'Prospector' })
      .closest('#row-PROSPECTOR');
    if (!(row instanceof HTMLElement)) throw new Error('Prospector row must render');
    expect(within(row).getByRole('status')).toHaveTextContent(
      new RegExp(`${String(PROSPECTOR.max + 1)} / ${String(PROSPECTOR.max + 1)}.*limit`, 'i'),
    );
  });

  it('still holds a commander at two while the rung is unbought', () => {
    show(withHolds(2, { fleet: { PROSPECTOR: PROSPECTOR.max } }));
    const row = screen.getByRole('heading', { name: 'Prospector' })
      .closest('#row-PROSPECTOR');
    if (!(row instanceof HTMLElement)) throw new Error('Prospector row must render');
    expect(within(row).queryByRole('button', { name: /build/i })).toBeNull();
    expect(within(row).getByRole('status')).toHaveTextContent(
      new RegExp(`${String(PROSPECTOR.max)} / ${String(PROSPECTOR.max)}.*limit`, 'i'),
    );
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
    // The sheet remains informative while its commitment says when it will be enough.
    const primary = document.querySelector<HTMLElement>('[data-build-sheet] [data-commit] button')!;
    expect(primary).toBeDisabled();
    expect(primary).toHaveTextContent(/enough/i);
    expect(document.querySelector('[data-build-sheet] [data-need-bar="alloy"]')).not.toBeNull();
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

/**
 * THE HULL OVER ITS OWN SKY. D1: the class, where the ships are, the art, and the six
 * figures under it; the price is the batch's, once, beside the commit.
 */
describe('the hull hero', () => {
  it('draws the hull with its class and where its ships are', async () => {
    show({ fleet: { DART: 14 }, fleetAway: { DART: 2 } });
    await openSheet('Dart');
    const hero = document.querySelector<HTMLElement>('[data-build-art]')!;
    expect(within(hero).getByRole('img', { name: 'Dart' })).toBeInTheDocument();
    expect(hero).toHaveTextContent(/skirmisher/i);
    expect(hero).toHaveTextContent('14 in · 2 out');
  });

  /** A gun never leaves, so "0 out" is a line that can only ever say nothing. */
  it('counts a gun as standing, not as in or out', async () => {
    show({ ground: { THORN: 3 } }, 'defend');
    await openSheet('Thorn');
    const hero = document.querySelector<HTMLElement>('[data-build-art]')!;
    expect(hero).toHaveTextContent('3 standing');
    expect(hero).not.toHaveTextContent(/out/);
  });

  it('lays the six figures under the art', async () => {
    show({});
    await openSheet('Dart');
    const art = document.querySelector('[data-build-art]');
    const stats = document.querySelector('[data-build-stats]');
    expect(art).toContainElement(stats as HTMLElement);
    expect(stats?.querySelectorAll('[data-stat]')).toHaveLength(6);
  });

  /** One price per sheet: the figure shown is the one the commit button quotes. */
  it('shows the order total once, beside the commit, and moves it with the count', async () => {
    show({});
    await openSheet('Dart');
    expect(document.querySelectorAll('[data-build-price]')).toHaveLength(1);
    expect(document.querySelector('[data-build-art] [data-build-price]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /more dart/i }));
    expect(document.querySelector('[data-build-price]')).toHaveTextContent(String(HULLS.DART.alloy * 2));
  });

  it('says how full the yard queue it joins is', async () => {
    show({});
    await openSheet('Dart');
    expect(document.querySelector('[data-build-sheet] [data-queue-fill]')).toHaveTextContent('0/3');
  });

  /** Progressive disclosure: the pitch is the fact, the detail one tap deeper. */
  it('keeps the long explanation one tap deeper', async () => {
    show({});
    await openSheet('Dart');
    expect(document.querySelector('[data-build-sheet] [data-item-detail]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /how it works/i }));
    expect(document.querySelector('[data-build-sheet] [data-item-detail]')?.textContent.length).toBeGreaterThan(40);
  });
});

/**
 * THE MATCHUP, WITH THE NUMBERS THE RESOLVER USES. D124: a rule taught as a post-mortem
 * is not decision support, so the multipliers stand where the hull is chosen.
 */
describe('the matchup on a hull sheet', () => {
  it('names what it beats and what beats it, with the multipliers', async () => {
    show({});
    await openSheet('Dart');
    expect(screen.getByTestId('counter-strong')).toHaveTextContent(/bulwark/i);
    expect(screen.getByTestId('counter-strong')).toHaveTextContent(factor(COMBAT.strongMult));
    expect(screen.getByTestId('counter-weak')).toHaveTextContent(/lance/i);
    expect(screen.getByTestId('counter-weak')).toHaveTextContent(factor(COMBAT.weakMult));
    // Weak is a gap to plan around, not a threat: warn, never hostile red.
    expect(screen.getByTestId('counter-weak').className).toMatch(/v2-warn/);
  });

  it('opens the whole cycle on a tap, with this hull lit', async () => {
    show({});
    await openSheet('Dart');
    expect(document.querySelector('[data-counter-cycle] [data-rung]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /class cycle/i }));
    expect(document.querySelector('[data-counter-cycle] [data-rung="SKIRMISHER"]')).toHaveAttribute('data-current', 'true');
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

    const fuel = document.querySelector('[data-stat="fuel"]');
    expect(fuel, 'the craft sheet says nothing about fuel').not.toBeNull();
    expect(fuel).toHaveTextContent(hullFuelRate('DART').toFixed(1));
    expect(fuel).toHaveTextContent(/fuel/i);
  });

  it('uses the authored fuel rate for heavier hulls', async () => {
    show();
    await openSheet('Rampart');

    expect(document.querySelector('[data-stat="fuel"]'))
      .toHaveTextContent(hullFuelRate('RAMPART').toFixed(1));
  });

  /** A gun never travels. A rate for one would invent a decision that cannot be made. */
  it('leaves the figure out for a hull that cannot travel', async () => {
    show({}, 'defend');
    await openSheet('Bastion');

    expect(document.querySelector('[data-stat="fuel"]')).toHaveTextContent('—');
  });
});

/** D184 removed the Hangar and its fleet ceiling. A mobile hull's legacy bulk is
 * therefore not a decision the Fleet craft sheet should expose. Ground units
 * still spend real ground capacity and keep the same figure on their sheet. */
/**
 * THE HANGAR ROW NAMES THE CORE ITS NEXT RUNG WAITS ON. 2026-09-18.
 *
 * The rungs open at Core 4, 7, 10, 13 and 16 — not one per Core level — so the
 * generic "Core L{{core + 1}}" would send a Core-5 commander to raise a Core 6
 * that buys them nothing.
 */
describe('the Hangar row', () => {
  const hangarWorld = (core: number, hangar: number) => show({
    buildings: { CORE: core, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4, HANGAR: hangar },
    capacity: { hangar: hangarCapacity(hangar), hangarUsed: 0, ground: groundSlots(core), groundUsed: 0 },
  });

  it('sits in the fleet group with the room it holds', () => {
    hangarWorld(6, 2);
    const row = document.querySelector('#row-HANGAR');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent(/Hangar/);
    expect(document.querySelector('[data-hangar-room]')).toHaveTextContent(String(hangarCapacity(2)));
  });

  /**
   * THE ROW ASKS NOTHING OF THE CORE ANY MORE. Owner decision, 2026-09-22 — a fleet-path commander
   * must be able to buy room without being pushed up the tier band for it, and the ore already
   * refuses what the gate used to (see `hangar-free-of-core.test.ts`).
   *
   * It used to name the gate — "Core L7" at Core 5 — which was the right screen for the rule that
   * existed. With no gate there is nothing to name, at any Core.
   */
  it('names no Core requirement, at any Core', () => {
    for (const core of [1, 5, 7, 16]) {
      hangarWorld(core, 2);
      expect(document.querySelector('#row-HANGAR'), `core ${String(core)}`)
        .not.toHaveTextContent('Core L');
    }
  });

  it('says the ladder is over at the top rung', () => {
    hangarWorld(20, 10);
    expect(document.querySelector('#row-HANGAR')).toHaveTextContent(/highest level/i);
  });
});

describe('the room figure on a craft sheet', () => {
  it('states the Hangar room a mobile craft takes', async () => {
    show();
    await openSheet('Dart');

    expect(document.querySelector('[data-stat="room"]')).toHaveTextContent(String(hullBulk('DART')));
  });

  it('keeps bulk where a ground unit still consumes capacity', async () => {
    show({}, 'defend');
    await openSheet('Bastion');

    expect(document.querySelector('[data-stat="room"]')).toHaveTextContent(String(hullBulk('BASTION')));
  });

  it('leaves six relevant figures on a mobile craft sheet', async () => {
    show();
    await openSheet('Dart');

    expect(document.querySelectorAll('[data-build-stats] [data-stat]')).toHaveLength(6);
  });
});

/**
 * THE QUEUED LEVEL, AND WHY THE TIME HAS TO READ THE SAME ONE THE PRICE DOES.
 *
 * `useBuildingAction` computes two levels: `level`, what stands today, and
 * `actionLevel`, what an order placed now would find once everything ahead of it
 * in the CONSTRUCTION queue has finished. The PRICE has always used the second
 * (`buildingCost(id, nextLevel)`) — and the TIME used the first.
 *
 * With nothing queued they are the same number and nothing showed. With a Core
 * already building, the row quoted the price of Core 8 beside the timer of Core 7,
 * and the server — which reads `context.projected.buildings[type]` for both —
 * committed to neither. That is the exact contradiction `lib/orderTime.ts` exists
 * to prevent, and D198 made it worse by putting a research multiplier on the same
 * figure: one wrong level now scales a discount too.
 */
describe('a building already in the queue', () => {
  it('quotes the price and the timer off the same projected level', async () => {
    const { buildingCost, buildingMinutes } = await import('@astera/rules');
    const now = Date.now();
    const view = show({
      buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4 },
      queues: {
        CONSTRUCTION: [{
          id: 'construction-1',
          queue: 'CONSTRUCTION',
          slot: 0,
          kind: 'BUILDING',
          subject: 'REFINERY',
          count: 1,
          startedAt: new Date(now - 10_000),
          finishesAt: new Date(now + 50_000),
          cost: buildingCost('REFINERY', 3),
        }],
        YARD: [],
      },
    }, 'grow');

    await openAllBands(screen, userEvent);
    const row = view.container.querySelector('#row-REFINERY');
    expect(row).not.toBeNull();
    // The order ahead lands Refinery 4, so a second order buys Refinery 5 — which
    // is the level the PRICE on this same row is already quoting.
    const spoken = within(row as HTMLElement).getByTestId('order-time').textContent;
    expect(spoken).toContain(duration(buildingMinutes('REFINERY', 5, {})));
    expect(spoken).not.toContain(duration(buildingMinutes('REFINERY', 4, {})));
  });
});
