import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DEATH_STAR,
  PROSPECTOR,
  groundSlots,
  hullBulk,
  hullFuelRate,
} from '@astera/rules';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import { openAllBands, planetView } from './fixtures.js';
import { AcademyLessonContext } from '../src/onboarding/lessonScope.js';
import { duration } from '../src/lib/time.js';

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

    /*
      THE PRICE MOVED FROM A TOOLTIP TO A SHEET. Owner report.

      It used to be a `title` attribute reading "Refund: 50 alloy · …" — a hover
      tooltip, on a game budgeted for a 350pt phone, where no such thing exists.
      So the half this control destroys was not merely unconfirmed on the target
      device, it never appeared at all. `irreversible-confirm.test.tsx` holds the
      sheet's own grammar; what this asserts is the wiring: one press asks, the
      confirmation fires, and the right order id reaches the mutation.
    */
    const [cancel] = within(queues).getAllByRole('button', { name: /^Cancel / });
    expect(cancel).not.toHaveAttribute('title');
    await userEvent.click(cancel!);
    expect(cancelOrder, 'the first press cancelled without asking').not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('confirm-commit'));
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
    expect(screen.getByRole('button', { name: /fewer dart/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /more dart/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /build 2/i }));
    expect(build).toHaveBeenCalledWith({ hull: 'DART', count: 2 }, expect.anything());
  });
  /**
   * THE CEILING THIS REPLACES. D184.
   *
   * This screen used to refuse the "+" once a world's Hangar was one hull from
   * full, and drew the room as a bar. The Hangar is gone: a fleet is braked by the
   * purse, so the stepper keeps climbing and there is no room card on a warship's
   * sheet at all. A gun still has one, and the case below it proves that.
   */
  it('never refuses a warship for room, however many are already standing', async () => {
    show({ fleet: { DART: 5_000 }, capacity: { ground: groundSlots(6), groundUsed: 0 } });
    await openSheet('Dart');
    expect(screen.getByRole('button', { name: /more dart/i })).toBeEnabled();
    expect(document.querySelector('[data-fits]')).toBeNull();
  });

  it('still draws the room a gun answers to', async () => {
    show({ capacity: { ground: groundSlots(6), groundUsed: 0 } }, 'defend');
    await openSheet('Thorn');
    expect(document.querySelector('[data-fits]')).not.toBeNull();
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

  it('pins the stat section to the image top-right, scaled down', async () => {
    show({});
    await openSheet('Dart');
    const art = document.querySelector('[data-build-art]');
    const stats = document.querySelector('[data-build-stats]');

    expect(art).not.toBeNull();
    expect(stats).not.toBeNull();
    expect(art).toContainElement(stats as HTMLElement);
    expect(stats).toHaveClass('absolute', 'right-1', 'top-1', 'origin-top-right', 'scale-[60%]');
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

  it('uses the authored fuel rate for heavier hulls', async () => {
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

/** D184 removed the Hangar and its fleet ceiling. A mobile hull's legacy bulk is
 * therefore not a decision the Fleet craft sheet should expose. Ground units
 * still spend real ground capacity and keep the same figure on their sheet. */
describe('the obsolete Hangar figure', () => {
  it('hides bulk on mobile Fleet craft sheets', async () => {
    show();
    await openSheet('Dart');

    expect(document.querySelector('.stat-room')).toBeNull();
  });

  it('keeps bulk where a ground unit still consumes capacity', async () => {
    show({}, 'defend');
    await openSheet('Bastion');

    expect(document.querySelector('.stat-room')).toHaveTextContent(String(hullBulk('BASTION')));
  });

  it('leaves five relevant figures on a mobile craft sheet', async () => {
    show();
    await openSheet('Dart');

    const strip = document.querySelector('[data-build-stats] .stats');
    expect(strip).not.toBeNull();
    expect(strip).toHaveClass('stats-card');
    expect(strip?.querySelectorAll('.stat')).toHaveLength(5);
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
