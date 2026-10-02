import { MULTI_WORLD } from '@astera/rules';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildOrderView, PlanetView } from '../src/api/schemas.js';
import { PlanetScreen } from '../src/screens/PlanetScreen.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { ApiError } from '../src/api/client.js';
import { describeError } from '../src/i18n/errors.js';
import { planetView } from './fixtures.js';

/**
 * THE REPAIR STATION, IN THE BASE. Owner instruction, 2026-09-30: *"Tershane ve Hangar'ın
 * altına 2 kolonu kaplayacak şekilde yatay bir tasarım … bu Tamirhane'ye tıklayınca içine
 * giricez ve tamirhane menüsü açılacak."*
 *
 * The Fleet tab of the Base holds the Shipyard and the Hangar, and the station sits under
 * them. Its card says at a glance what waits and what is being worked on; pressing it opens
 * the station itself — not a level-up, because the station has no ladder — where the
 * damaged ships are chosen, priced, repaired, and the queue is watched and cancelled.
 */

const NOW = Date.parse('2026-09-30T12:00:00.000Z');
const MIN = 60_000;

type Lot = NonNullable<PlanetView['dock']>['lots'][number];

const talon: Lot = {
  id: 'lot-2', hull: 'TALON', count: 2, damageBp: 3500, repairing: false, orderId: null,
  cost: { alloy: 551, crystal: 230, deuterium: 2 }, minutes: 2.5,
};
const warden: Lot = {
  id: 'lot-3', hull: 'WARDEN', count: 1, damageBp: 8800, repairing: false, orderId: null,
  cost: { alloy: 335, crystal: 134, deuterium: 0 }, minutes: 1.5,
};
const ballista: Lot = {
  id: 'lot-1', hull: 'BALLISTA', count: 1, damageBp: 6400, repairing: true, orderId: 'r-1',
  cost: { alloy: 1_273, crystal: 488, deuterium: 4 }, minutes: 5,
};

const job = (over: Partial<BuildOrderView> = {}): BuildOrderView => ({
  id: 'r-1',
  queue: 'REPAIR',
  slot: 0,
  kind: 'REPAIR',
  subject: 'BALLISTA',
  count: 1,
  startedAt: new Date(NOW - 2 * MIN),
  finishesAt: new Date(NOW + 3 * MIN),
  cost: { alloy: 1_273, crystal: 488, deuterium: 4 },
  ...over,
} as BuildOrderView);

const world = (
  over: Partial<Omit<PlanetView, 'planet'>> = {},
  stock: Partial<PlanetView['planet']> = {},
): PlanetView => planetView(
  {
    buildings: { CORE: 6, REFINERY: 3, EXTRACTOR: 3, VAULT: 1, SHIPYARD: 4, HANGAR: 2 },
    fleet: { DART: 12 },
    score: { wealth: 10_000, dominion: 0 },
    rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion,
    fleetDocked: { TALON: 2, WARDEN: 1, BALLISTA: 1 },
    dock: {
      lots: [ballista, talon, warden],
      waiting: { cost: { alloy: 886, crystal: 364, deuterium: 2 }, minutes: 4 },
      pct: 100,
    },
    queues: { CONSTRUCTION: [], YARD: [], REPAIR: [job()] },
    ...over,
  },
  { alloy: 900_000, crystal: 400_000, deuterium: 10_000, alloyCap: 2_000_000, crystalCap: 900_000, ...stock },
);

let current: PlanetView = world();
type MutationMock = (variables: unknown, options?: unknown) => void;
const startRepair = vi.fn<MutationMock>();
/** Whether a start is on its way, as the mutation reports it. */
let startPending = false;
const cancelRepair = vi.fn<MutationMock>();
const refetch = vi.fn();

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    usePlanet: () => ({ data: current, dataUpdatedAt: Date.now(), isPending: false, refetch }),
    useGalaxy: () => ({ data: undefined }),
    useIntel: () => ({ data: undefined }),
    usePending: () => ({ data: undefined }),
    useReports: () => ({ data: undefined }),
    useUpgrade: () => ({ mutate: vi.fn(), isPending: false }),
    useCollect: () => ({ mutate: vi.fn(), isPending: false }),
    useBuild: () => ({ mutate: vi.fn(), isPending: false }),
    useCompleteResearch: () => ({ mutate: vi.fn(), isPending: false }),
    useInstallSatellite: () => ({ mutate: vi.fn(), isPending: false }),
    useRaiseInstrument: () => ({ mutate: vi.fn(), isPending: false }),
    useCancelBuildOrder: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildDeathStar: () => ({ mutate: vi.fn(), isPending: false }),
    useBuildInterceptor: () => ({ mutate: vi.fn(), isPending: false }),
    useStartRepair: () => ({ mutate: startRepair, isPending: startPending }),
    useCancelRepair: () => ({ mutate: cancelRepair, isPending: false }),
  };
});

function expectMutationCallbacks(value: unknown): void {
  if (typeof value !== 'object' || value === null) throw new Error('mutation callbacks were not supplied');
  expect(typeof Reflect.get(value, 'onSuccess')).toBe('function');
  expect(typeof Reflect.get(value, 'onError')).toBe('function');
}

/** One of the callbacks a mutation was handed, to play the server's answer through it. */
function callbackOf(options: unknown, name: string): (arg: unknown) => void {
  const fn: unknown = typeof options === 'object' && options !== null ? Reflect.get(options, name) : undefined;
  if (typeof fn !== 'function') throw new Error(`no ${name} callback`);
  return (arg) => { Reflect.apply(fn, undefined, [arg]); };
}

const show = (view: PlanetView = world(), focusItem?: string) => {
  current = view;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <PlanetScreen focusGroup="reach" {...(focusItem ? { focusItem } : {})} />
      </ToastProvider>
    </QueryClientProvider>,
  );
};

const card = (): HTMLElement => {
  const row = document.getElementById('row-REPAIR_STATION');
  if (!row) throw new Error('no Repair Station card');
  return row;
};

const openStation = async (): Promise<HTMLElement> => {
  await userEvent.click(within(card()).getByRole('button'));
  return screen.getByRole('dialog', { name: 'Repair Station' });
};

beforeEach(() => {
  // jsdom has no layout, so no `scrollIntoView`; a named row is scrolled to (see `locked-rows`).
  Element.prototype.scrollIntoView = vi.fn();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  startRepair.mockReset();
  cancelRepair.mockReset();
  startPending = false;
  refetch.mockReset();
});

afterEach(() => { vi.useRealTimers(); });

describe('the Repair Station card', () => {
  it('is not there in a season dealt before the Repair Station', () => {
    show(world({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion - 1 }));
    expect(document.getElementById('row-REPAIR_STATION')).toBeNull();
  });

  it('sits under the Shipyard and the Hangar, before the Hangar room', () => {
    const view = show();
    const hangar = document.getElementById('row-HANGAR');
    const room = view.container.querySelector('[data-hangar-room]');
    expect(hangar).not.toBeNull();
    expect(room).not.toBeNull();
    expect(hangar!.compareDocumentPosition(card()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(card().compareDocumentPosition(room!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says what waits, what is under repair and how full the queue is', () => {
    show();
    expect(card()).toHaveTextContent(/Repair Station/);
    expect(card()).toHaveTextContent(/3 ships waiting/i);
    expect(card()).toHaveTextContent(/1 under repair/i);
    expect(card()).toHaveTextContent(/Queue 1\/3/i);
  });

  it('says no ship at this world is damaged when nothing waits', () => {
    show(world({ fleetDocked: {}, dock: { lots: [], waiting: { cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 0 }, pct: 100 }, queues: { CONSTRUCTION: [], YARD: [], REPAIR: [] } }));
    expect(card()).toHaveTextContent(/no damaged ships/i);
    expect(card()).not.toHaveTextContent(/waiting/i);
  });

  it('opens the station itself, not a level-up sheet', async () => {
    show();
    const station = await openStation();
    expect(station).toBeInTheDocument();
    expect(within(station).queryByRole('button', { name: /raise|upgrade/i })).toBeNull();
  });

  it('opens straight onto the station when a door outside names it', () => {
    show(world(), 'REPAIR_STATION');
    expect(screen.getByRole('dialog', { name: 'Repair Station' })).toBeInTheDocument();
  });

  it('is not opened by a door in a season dealt before the Repair Station', () => {
    show(world({ rulesetVersion: MULTI_WORLD.shipDamageRulesetVersion - 1 }), 'REPAIR_STATION');
    expect(screen.queryByRole('dialog', { name: 'Repair Station' })).toBeNull();
  });
});

describe('the Repair Station menu', () => {
  it('lists every waiting lot, chosen, with its damage and its price against a new ship', async () => {
    show();
    const station = await openStation();
    const rows = within(station).getAllByTestId('dock-lot');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/Talon/);
    expect(rows[0]).toHaveTextContent(/×2/);
    expect(rows[0]).toHaveTextContent(/35% damaged/i);
    expect(rows[0]).toHaveTextContent(/35% of a new ship/i);
    for (const row of rows) expect(within(row).getByRole('checkbox')).toBeChecked();
  });

  it('keeps a lot under repair out of the choice and shows it with its job', async () => {
    show();
    const station = await openStation();
    for (const row of within(station).getAllByTestId('dock-lot')) expect(row).not.toHaveTextContent(/Ballista/);
    const running = within(station).getAllByTestId('repair-job')[0]!;
    expect(running).toHaveTextContent(/Ballista/);
    expect(running).toHaveTextContent(/64% damaged/i);
  });

  it('repairs exactly the ships that were chosen', async () => {
    show();
    const station = await openStation();
    await userEvent.click(within(station).getByRole('checkbox', { name: /Warden/ }));
    await userEvent.click(within(station).getByRole('button', { name: /repair 2 ships/i }));
    expect(startRepair).toHaveBeenCalledWith({ planetId: 'p1', request: { lotIds: ['lot-2'] } }, expect.any(Object));
    expectMutationCallbacks(startRepair.mock.calls[0]?.[1]);
  });

  it('prices the choice beside the button, and moves it as the choice moves', async () => {
    show();
    const station = await openStation();
    const total = within(station).getByTestId('repair-total');
    expect(total).toHaveTextContent('886');
    expect(total).toHaveTextContent('364');
    expect(total).toHaveTextContent(/4m/);
    await userEvent.click(within(station).getByRole('checkbox', { name: /Warden/ }));
    expect(total).toHaveTextContent('551');
    expect(total).toHaveTextContent(/2m 30s/);
  });

  it('will not start with nothing chosen, and says what to do', async () => {
    show();
    const station = await openStation();
    await userEvent.click(within(station).getByRole('button', { name: /clear/i }));
    const commit = within(station).getByRole('button', { name: /choose ships to repair/i });
    expect(commit).toBeDisabled();
    await userEvent.click(within(station).getByRole('button', { name: /select all/i }));
    expect(within(station).getByRole('button', { name: /repair 3 ships/i })).toBeEnabled();
  });

  it('holds the repair while three jobs already run, and says why', async () => {
    show(world({
      queues: { CONSTRUCTION: [], YARD: [], REPAIR: [job(), job({ id: 'r-2', slot: 1 }), job({ id: 'r-3', slot: 2 })] },
    }));
    const station = await openStation();
    expect(within(station).getByRole('button', { name: /queue full/i })).toBeDisabled();
  });

  it('says when the purse will cover a repair it cannot pay for yet', async () => {
    show(world({}, { alloy: 100, crystal: 100, deuterium: 10_000, alloyPerHour: 600, crystalPerHour: 300 }));
    const station = await openStation();
    const commit = within(station).getByRole('button', { name: /enough/i });
    expect(commit).toBeDisabled();
  });

  it('says a fuel shortfall is short, since fuel has no rate to wait on', async () => {
    show(world({}, { deuterium: 0 }));
    const station = await openStation();
    expect(within(station).getByRole('button', { name: /not enough resources/i })).toBeDisabled();
  });

  it('holds the commit while a start is on its way', async () => {
    startPending = true;
    show();
    const station = await openStation();
    expect(within(station).getByRole('button', { name: /starting/i })).toBeDisabled();
  });

  it('says why the server refused a repair', async () => {
    show();
    const station = await openStation();
    await userEvent.click(within(station).getByRole('button', { name: /repair 3 ships/i }));
    const refusal = new ApiError('REPAIR_LOT_BUSY', 'Those ships are already under repair', 409, {});
    const onError = callbackOf(startRepair.mock.calls[0]?.[1], 'onError');
    act(() => { onError(refusal); });
    expect(await screen.findByText(describeError(refusal))).toBeInTheDocument();
  });

  /**
   * WHEN THE SHIPS COME BACK, NOT ONLY HOW LONG THE WORK TAKES. The lane is serial, so a job
   * ordered behind others starts when the last of them ends; the footer says when.
   */
  it('says when a repair ordered now would start behind the queue', async () => {
    show(world({
      queues: { CONSTRUCTION: [], YARD: [], REPAIR: [job(), job({ id: 'r-2', slot: 1, startedAt: new Date(NOW + 3 * MIN), finishesAt: new Date(NOW + 7 * MIN) })] },
    }));
    const station = await openStation();
    expect(within(station).getByTestId('repair-wait')).toHaveTextContent(/after the queue, in 7m 00s/i);
  });

  /**
   * A JOB PAST ITS END THAT THE SERVER HAS NOT SETTLED YET. The countdown has nothing left to
   * count, and "done in now" is not a sentence: it says it is finishing, and the wait for a
   * job behind it is not drawn at all — the lane frees the moment the worker settles it.
   */
  it('says a job past its end is finishing, and draws no wait behind it', async () => {
    show(world({ queues: { CONSTRUCTION: [], YARD: [], REPAIR: [job({ finishesAt: new Date(NOW - 1_000) })] } }));
    expect(card()).toHaveTextContent(/finishing/i);
    const station = await openStation();
    const [settling] = within(station).getAllByTestId('repair-job');
    expect(settling).toHaveTextContent(/finishing/i);
    expect(settling).not.toHaveTextContent(/done in/i);
    expect(within(station).queryByTestId('repair-wait')).toBeNull();
  });

  it('says nothing of a wait on an empty lane', async () => {
    show(world({ queues: { CONSTRUCTION: [], YARD: [], REPAIR: [] } }));
    const station = await openStation();
    expect(within(station).queryByTestId('repair-wait')).toBeNull();
  });

  it('shows the queue in order, with when each job ends or starts', async () => {
    show(world({
      queues: {
        CONSTRUCTION: [],
        YARD: [],
        REPAIR: [job(), job({ id: 'r-2', slot: 1, subject: 'ALL', count: 3, startedAt: new Date(NOW + 3 * MIN), finishesAt: new Date(NOW + 7 * MIN) })],
      },
    }));
    const station = await openStation();
    const [running, queued] = within(station).getAllByTestId('repair-job');
    expect(running).toHaveTextContent(/done in 3m/i);
    expect(queued).toHaveTextContent(/starts in 3m/i);
    expect(queued).toHaveTextContent(/mixed/i);
  });

  /** A job of several hulls is labelled "mixed" by the server; the menu says which ships it holds. */
  it('lists the ships a mixed job is repairing', async () => {
    const dart: Lot = { ...talon, id: 'lot-9', hull: 'DART', count: 3, damageBp: 2600, repairing: true, orderId: 'r-1' };
    show(world({
      dock: { lots: [{ ...ballista }, dart, warden], waiting: { cost: warden.cost, minutes: warden.minutes }, pct: 100 },
      queues: { CONSTRUCTION: [], YARD: [], REPAIR: [job({ subject: 'ALL', count: 4 })] },
    }));
    const station = await openStation();
    const [mixed] = within(station).getAllByTestId('repair-job');
    expect(mixed).toHaveTextContent(/mixed ships/i);
    expect(mixed).toHaveTextContent(/Ballista/);
    expect(mixed).toHaveTextContent(/64% damaged/i);
    expect(mixed).toHaveTextContent(/Dart/);
    expect(mixed).toHaveTextContent(/26% damaged/i);
  });

  it('cancels a job only after the confirm that names the refund', async () => {
    show();
    const station = await openStation();
    const running = within(station).getAllByTestId('repair-job')[0]!;
    await userEvent.click(within(running).getByRole('button', { name: /cancel/i }));
    expect(cancelRepair).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByTestId('confirm-commit'));
    expect(cancelRepair).toHaveBeenCalledWith({ planetId: 'p1', orderId: 'r-1' }, expect.any(Object));
  });

  it('teaches the rule where it is used: the line always, the arithmetic one tap deeper', async () => {
    show(world({ dock: { lots: [talon], waiting: { cost: talon.cost, minutes: talon.minutes }, pct: 75 } }));
    const station = await openStation();
    expect(station).toHaveTextContent(/more than 20% damaged/i);
    expect(station).not.toHaveTextContent(/half the price/i);
    await userEvent.click(within(station).getByRole('button', { name: /how it works/i }));
    expect(station).toHaveTextContent(/20% or less/i);
    expect(station).toHaveTextContent(/share of a new ship/i);
    expect(station).toHaveTextContent(/build time/i);
    expect(station).toHaveTextContent(/one after another/i);
    expect(station).toHaveTextContent(/half the price/i);
    expect(station).toHaveTextContent(/you pay 75%/i);
  });

  it('says there is nothing to repair when nothing waits', async () => {
    show(world({ fleetDocked: {}, dock: { lots: [], waiting: { cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 0 }, pct: 100 }, queues: { CONSTRUCTION: [], YARD: [], REPAIR: [] } }));
    const station = await openStation();
    expect(station).toHaveTextContent(/no damaged ships/i);
    expect(station).toHaveTextContent(/nothing under repair/i);
    expect(within(station).queryByRole('checkbox')).toBeNull();
  });
});

describe('the Base keeps up with the station', () => {
  it('wakes when a repair ends, so the ships come home without a poll', () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const view = show(world({ queues: { CONSTRUCTION: [], YARD: [], REPAIR: [job({ finishesAt: new Date(NOW + 2_000) })] } }));
    act(() => { vi.advanceTimersByTime(2_049); });
    expect(refetch).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2); });
    expect(refetch).toHaveBeenCalledOnce();
    view.unmount();
  });
});
