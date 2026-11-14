import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildOrderView, PlanetView } from '../src/api/schemas.js';
import type { MaintenanceSelection, RepairRequest } from '../src/api/client.js';
import i18n from '../src/i18n/index.js';
import { haptic } from '../src/lib/haptics.js';
import { playSound } from '../src/lib/sound.js';
import type * as Sound from '../src/lib/sound.js';
import type * as Haptics from '../src/lib/haptics.js';
import { RepairStationCard, RepairStationSheet } from '../src/screens/RepairStation.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

vi.mock('../src/lib/sound.js', async (original) => ({ ...await original<typeof Sound>(), playSound: vi.fn() }));
vi.mock('../src/lib/haptics.js', async (original) => ({ ...await original<typeof Haptics>(), haptic: vi.fn() }));

const mutations = vi.hoisted(() => ({
  maintenance: vi.fn<(input: { planetId: string; action: string; selection: MaintenanceSelection; key: string }, callbacks: unknown) => void>(),
  repair: vi.fn<(input: { planetId: string; request: RepairRequest; key?: string }, callbacks: unknown) => void>(),
  cancel: vi.fn(),
}));
vi.mock('../src/api/queries.js', () => ({
  useMaintenance: () => ({ mutate: mutations.maintenance, isPending: false }),
  useStartRepair: () => ({ mutate: mutations.repair, isPending: false }),
  useCancelRepair: () => ({ mutate: mutations.cancel, isPending: false }),
}));

type Lot = NonNullable<PlanetView['dock']>['lots'][number];
const lot = (over: Partial<Lot> = {}): Lot => ({
  id: 'lot-1', hull: 'TALON', count: 3, damageBp: 3500, remainderBp: 0, repairing: false, orderId: null,
  cost: { alloy: 551, crystal: 230, deuterium: 2 }, minutes: 2.5, ...over,
});
const job = (over: Partial<BuildOrderView> = {}): BuildOrderView => ({
  id: 'r-1', queue: 'REPAIR', slot: 0, kind: 'REPAIR', subject: 'BALLISTA', count: 1,
  startedAt: new Date(Date.now() - 60_000), finishesAt: new Date(Date.now() + 180_000),
  cost: { alloy: 1_273, crystal: 488, deuterium: 4 }, ...over,
} as BuildOrderView);
const dock = (lots: Lot[], pct = 100): NonNullable<PlanetView['dock']> => ({
  lots, pct, waiting: { cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 0 },
});
const queues = (repairs: BuildOrderView[]) => ({ CONSTRUCTION: [], YARD: [], REPAIR: repairs });

const held = { alloy: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000 };
const open = (planet: PlanetView) => render(
  <ToastProvider><RepairStationSheet planet={planet} held={held} onClose={vi.fn()} /></ToastProvider>,
);
const cardOf = (over: { lots?: Lot[]; repairs?: BuildOrderView[] } = {}, onOpen = vi.fn()) => render(
  <RepairStationCard dock={dock(over.lots ?? [lot()])} repairs={over.repairs ?? [job()]} highlighted={false} onOpen={onOpen} />,
);

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en');
});

/**
 * THE REPAIR STATION ON THE GAME KIT (G2-f, 2026-11-14). The card is a door half the height it
 * was, the workshop's picture behind it; the station opens on the place that needs a decision,
 * the places are tabs, repair-or-scrap is a lever, and the two commitments are holds — a repair
 * spends (one second), a scrap is final (a second and a half).
 */
describe('the Repair Station card on the kit', () => {
  it('is one door that answers with its own sound and opens the station', async () => {
    const onOpen = vi.fn();
    cardOf({}, onOpen);
    const card = document.getElementById('row-REPAIR_STATION');
    expect(card).toHaveClass('gk-scard');
    const door = within(card!).getByRole('button', { name: /^Repair Station/ });
    expect(door).toHaveAttribute('data-own-sound');
    await userEvent.click(door);
    expect(onOpen).toHaveBeenCalledOnce();
    expect(playSound).toHaveBeenCalledWith('tap');
    expect(haptic).toHaveBeenCalledWith('tap');
  });

  it('wears the warning on its queue fill only when the queue is full', () => {
    const { unmount } = cardOf();
    expect(document.querySelector('[data-queue-fill]')).toHaveTextContent('Queue 1/3');
    expect(document.querySelector('[data-queue-fill]')).not.toHaveAttribute('data-tone');
    unmount();
    cardOf({ repairs: [job(), job({ id: 'r-2', slot: 1 }), job({ id: 'r-3', slot: 2 })] });
    expect(document.querySelector('[data-queue-fill]')).toHaveAttribute('data-tone', 'warn');
  });

  it('is drawn on the kit, not the v2 plates', () => {
    cardOf();
    expect(document.querySelector('#row-REPAIR_STATION .rounded-control, #row-REPAIR_STATION .font-v2-ui, #row-REPAIR_STATION .text-v2-ink-3, #row-REPAIR_STATION .rounded-chip')).toBeNull();
    expect(document.getElementById('row-REPAIR_STATION')).not.toHaveClass('font-v2-ui');
  });
});

describe('the Repair Station sheet on the kit', () => {
  it('opens on the place that needs a decision', () => {
    const selected = () => screen.getByRole('tab', { selected: true });
    // wounded ships at home come first
    const a = open(planetView({ fleet: { DART: 3 }, fleetDamage: [{ hull: 'DART', count: 2, damageBp: 5000 }], dock: dock([lot()]), queues: queues([]) }));
    expect(selected()).toHaveTextContent(/^Hangar/);
    a.unmount();
    // then ships waiting in the workshop
    const b = open(planetView({ fleet: {}, dock: dock([lot()]), queues: queues([]) }));
    expect(selected()).toHaveTextContent(/^Workshop/);
    b.unmount();
    // then the queue, when all that is docked is already being worked on
    const c = open(planetView({ fleet: {}, dock: dock([lot({ repairing: true, orderId: 'r-1' })]), queues: queues([job()]) }));
    expect(selected()).toHaveTextContent(/^Queue/);
    c.unmount();
    // and the hangar when there is nothing at all
    open(planetView({ fleet: {}, dock: dock([]), queues: queues([]) }));
    expect(selected()).toHaveTextContent(/^Hangar/);
  });

  it('counts on its tabs what waits for a decision, and the queue its fill', () => {
    open(planetView({ fleet: { DART: 3 }, fleetDamage: [{ hull: 'DART', count: 2, damageBp: 5000 }],
      dock: dock([lot(), lot({ id: 'lot-2', repairing: true, orderId: 'r-1', count: 1 })]), queues: queues([job()]) }));
    expect(screen.getByRole('tab', { name: 'Hangar · 2 damaged ships' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Workshop · 3 ships waiting' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Queue 1/3' })).toBeInTheDocument();
  });

  it('keeps the queue under its own tab, with its cancels', async () => {
    open(planetView({ fleet: {}, dock: dock([lot(), lot({ id: 'lot-2', hull: 'BALLISTA', repairing: true, orderId: 'r-1', count: 1 })]), queues: queues([job()]) }));
    expect(screen.queryByTestId('repair-job')).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: /^Queue/ }));
    const running = screen.getByTestId('repair-job');
    expect(running).toHaveTextContent(/Ballista/);
    expect(within(running).getByRole('button', { name: /^Cancel/ })).toHaveAttribute('data-own-sound');
    expect(screen.queryByTestId('health-group')).toBeNull();
  });

  it('turns between repair and scrap with a lever', async () => {
    open(planetView({ fleet: { DART: 4 }, fleetDamage: [{ hull: 'DART', count: 1, damageBp: 5000 }], dock: dock([]), queues: queues([]) }));
    expect(screen.getByRole('radio', { name: 'Repair' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByTestId('health-group')).toHaveLength(1);
    await userEvent.click(screen.getByRole('radio', { name: 'Scrap' }));
    expect(playSound).toHaveBeenCalledWith('lever', expect.anything());
    // scrapping weighs every ship, the whole ones too
    expect(screen.getAllByTestId('health-group')).toHaveLength(2);
  });

  it('starts a repair with a one-second hold, never a tap', async () => {
    open(planetView({ fleet: {}, dock: dock([lot()]), queues: queues([]) }));
    await userEvent.click(screen.getByRole('button', { name: 'Select all Talon' }));
    const hold = screen.getByRole('button', { name: /^Repair 3 ships/ });
    expect(hold).toHaveClass('gk-hold');
    await userEvent.click(hold);
    expect(mutations.repair).not.toHaveBeenCalled();
    hold.focus();
    await userEvent.keyboard('{Enter}{Enter}');
    expect(mutations.repair).toHaveBeenCalledWith(expect.objectContaining({ request: { lots: [
      { id: 'lot-1', count: 3, damageBp: 3500, remainderBp: 0 }] } }), expect.anything());
  });

  it('says what a scrap gives back before a final hold, and only the hold scraps', async () => {
    open(planetView({ fleet: { DART: 4 }, fleetDamage: [], dock: dock([]), queues: queues([]) }));
    await userEvent.click(screen.getByRole('radio', { name: 'Scrap' }));
    await userEvent.click(screen.getByRole('button', { name: 'Select all Dart' }));
    const returned = screen.getByText('Resources returned').parentElement;
    expect(returned?.querySelectorAll('img')).toHaveLength(3);
    const hold = screen.getByRole('button', { name: /^Scrap 4 ships/ });
    expect(hold).toHaveClass('gk-hold', 'gk-btn--danger');
    await userEvent.click(hold);
    expect(mutations.maintenance).not.toHaveBeenCalled();
    hold.focus();
    await userEvent.keyboard('{Enter}{Enter}');
    expect(mutations.maintenance).toHaveBeenCalledWith(expect.objectContaining({ action: 'SCRAP',
      selection: { source: 'HOME', groups: [{ hull: 'DART', count: 4, damageBp: 0, remainderBp: 0 }] } }), expect.anything());
  });

  it('a dead commitment says why on its face', async () => {
    const { unmount } = open(planetView({ fleet: {}, dock: dock([lot()]), queues: queues([]) }));
    expect(screen.getByRole('button', { name: 'Choose ships to repair' })).toBeDisabled();
    unmount();
    open(planetView({ fleet: {}, workshopRadiation: true, dock: dock([lot()]), queues: queues([]) }));
    await userEvent.click(screen.getByRole('radio', { name: 'Repair' }));
    await userEvent.click(screen.getByRole('button', { name: 'Select all Talon' }));
    expect(screen.getByRole('button', { name: 'Closed by radiation' })).toBeDisabled();
  });

  it('in the workshop the work order has a third stop: back to the hangar, a plain press', async () => {
    open(planetView({ fleet: {}, dock: dock([lot()]), queues: queues([]) }));
    // one commitment at a time in the footer: the way back is not a second button beside the repair
    expect(screen.queryByRole('button', { name: /hangar/i })).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Return' }));
    expect(screen.getByRole('button', { name: 'Select ships' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Select all Talon' }));
    const back = screen.getByRole('button', { name: 'Return to hangar' });
    expect(back).toHaveAttribute('data-own-sound');
    // the way back is free: no repair price beside it
    expect(screen.getByTestId('repair-total').querySelector('.gk-cost')).toBeNull();
    await userEvent.click(back);
    expect(mutations.maintenance).toHaveBeenCalledWith(expect.objectContaining({ action: 'RETURN',
      selection: { source: 'DOCK', lots: [{ id: 'lot-1', count: 3 }] } }), expect.anything());
  });

  it('the hangar has no way back to offer: its work order is repair or scrap', () => {
    open(planetView({ fleet: { DART: 3 }, fleetDamage: [{ hull: 'DART', count: 2, damageBp: 5000 }], dock: dock([]), queues: queues([]) }));
    expect(screen.getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Repair', 'Scrap']);
  });

  it('under radiation the workshop opens on the way back, the one order it still takes', async () => {
    open(planetView({ fleet: {}, workshopRadiation: true, dock: dock([lot()]), queues: queues([]) }));
    expect(screen.getByRole('radio', { name: 'Return' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Select all Talon' }));
    expect(screen.getByRole('button', { name: 'Return to hangar' })).toBeEnabled();
  });

  it('moving to the workshop is a plain press that says what to do first', async () => {
    open(planetView({ fleet: { DART: 3 }, fleetDamage: [{ hull: 'DART', count: 2, damageBp: 5000 }], dock: dock([]), queues: queues([]) }));
    expect(screen.getByRole('button', { name: 'Select ships' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Select all Dart' }));
    const move = screen.getByRole('button', { name: 'Move to workshop' });
    expect(move).toHaveAttribute('data-own-sound');
    await userEvent.click(move);
    expect(mutations.maintenance).toHaveBeenCalledWith(expect.objectContaining({ action: 'DOCK' }), expect.anything());
  });

  it('wears the workshop’s picture in its head and says there what a repair costs the player', () => {
    open(planetView({ fleet: {}, dock: dock([lot()], 75), queues: queues([]) }));
    const head = document.querySelector('[data-sheet-header]');
    expect(head?.querySelector('img[data-atmosphere-image]')).toHaveAttribute('src', '/assets/images/atmosphere/repair-v2.webp');
    expect(head).toHaveTextContent('You pay 75% now.');
    expect(document.querySelector('[data-repair-hero]')).toBeNull();
  });

  it('puts a group already on the cradle after the ships still to choose, as one line with nothing to choose', () => {
    open(planetView({ fleet: {}, dock: dock([lot({ id: 'busy', hull: 'BALLISTA', count: 1, repairing: true, orderId: 'r-1' }), lot()]), queues: queues([job()]) }));
    const [first, last] = screen.getAllByTestId('health-group');
    expect(first).toHaveTextContent(/Talon/);
    expect(last).toHaveTextContent(/Ballista/);
    expect(last).toHaveTextContent('Repair reserved');
    expect(last).not.toHaveTextContent(/available/);
    expect(last?.querySelector('.gk-hgroup__foot')).toBeNull();
  });

  it('draws no price until a ship is chosen', async () => {
    open(planetView({ fleet: {}, dock: dock([lot()]), queues: queues([]) }));
    const total = screen.getByTestId('repair-total');
    expect(total.querySelector('.gk-cost')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Select all Talon' }));
    expect(total.querySelector('.gk-cost')).not.toBeNull();
  });

  it('names a queued job by its ships, the station already saying it is a repair', () => {
    open(planetView({ fleet: {}, dock: dock([lot({ hull: 'BALLISTA', count: 1, repairing: true, orderId: 'r-1' })]), queues: queues([job()]) }));
    const running = screen.getByTestId('repair-job');
    expect(running.querySelector('.gk-job__title')).toHaveTextContent(/^Ballista ×1$/);
  });

  it('is drawn on the kit, not the v2 plates', () => {
    open(planetView({ fleet: {}, dock: dock([lot()]), queues: queues([job()]) }));
    expect(document.querySelector('[role=dialog] .rounded-control, [role=dialog] .text-v2-ink-3, [role=dialog] .text-micro')).toBeNull();
  });
});
