import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepairStationSheet } from '../src/screens/RepairStation.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';
import type { MaintenanceSelection, RepairRequest } from '../src/api/client.js';
import { shipScrapReturn, HONOR_BENEFIT_THRESHOLDS_V1, honorBenefits } from '@astera/rules';
import { full } from '../src/lib/format.js';

const mutations = vi.hoisted(() => ({ maintenance: vi.fn<(input: { planetId: string; action: string;
  selection: MaintenanceSelection; key: string }, callbacks: { onSuccess: () => void; onError: (error: Error) => void }) => void>(),
  repair: vi.fn<(input: { planetId: string; request: RepairRequest; key?: string },
    callbacks: { onSuccess: () => void; onError: (error: Error) => void }) => void>(), cancel: vi.fn() }));
vi.mock('../src/api/queries.js', () => ({
  useMaintenance: () => ({ mutate: mutations.maintenance, isPending: false }),
  useStartRepair: () => ({ mutate: mutations.repair, isPending: false }),
  useCancelRepair: () => ({ mutate: mutations.cancel, isPending: false }),
}));
const world = () => planetView({ fleet: { DART: 3 }, fleetDamage: [{ hull: 'DART', count: 2, damageBp: 5000, remainderBp: 0.25 }],
  dock: { lots: [], waiting: { cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 0 }, pct: 100 },
  queues: { CONSTRUCTION: [], YARD: [], REPAIR: [] } });
const held = { alloy: 100_000, crystal: 100_000, deuterium: 100_000 };
const draw = (planet = world()) => render(<ToastProvider><RepairStationSheet planet={planet} held={held} onClose={vi.fn()} /></ToastProvider>);
beforeEach(() => { vi.clearAllMocks(); });

describe('manual repair station actions', () => {
  it('shows the Honor price after research and sends the reviewed tier on repair', async () => {
    const benefit = { version: 1 as const, score: 75_000_000, thresholds: HONOR_BENEFIT_THRESHOLDS_V1,
      ...honorBenefits(75_000_000, HONOR_BENEFIT_THRESHOLDS_V1) };
    const lot = { id: 'wounded', hull: 'DART' as const, count: 1, damageBp: 5000, remainderBp: 0,
      repairing: false, orderId: null, minutes: 10, cost: { alloy: 10, crystal: 0, deuterium: 0 } };
    draw(planetView({ fleet: {}, honorBenefits: benefit,
      dock: { pct: 50, lots: [lot], waiting: { cost: lot.cost, minutes: 10 } } }));
    await userEvent.type(within(screen.getByTestId('health-group')).getByRole('textbox'), '1');
    expect(screen.getByText('Honor benefit: −10%')).toBeVisible();
    expect(screen.getByText('After research: 50% base repair share')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /Repair 1/ }));
    expect(mutations.repair.mock.calls[0]?.[0].request).toMatchObject({ expectedHonorTier: 2 });
  });
  it.each([1, 2])('shows positive damage for sub-bp wounds in a repair job with %s lots', count => {
    const lots = Array.from({ length: count }, (_, index) => ({ id: `wounded-${String(index)}`,
      hull: 'DART' as const, count: 1, damageBp: 0, remainderBp: 0.25,
      repairing: true, orderId: 'repair', minutes: 0.01, cost: { alloy: 1, crystal: 1, deuterium: 0 } }));
    draw(planetView({ fleet: {}, dock: { pct: 100, lots,
      waiting: { cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 0 } },
      queues: { CONSTRUCTION: [], YARD: [], REPAIR: [{ id: 'repair', queue: 'REPAIR', slot: 0,
        kind: 'REPAIR', subject: 'DART', count, startedAt: new Date(),
        finishesAt: new Date(Date.now() + 60_000), cost: { alloy: count, crystal: count, deuterium: 0 } }] } }));
    expect(within(screen.getByTestId('repair-job')).queryAllByText('0% damaged')).toHaveLength(0);
    expect(within(screen.getByTestId('repair-job')).getAllByText('1% damaged')).toHaveLength(count);
  });
  it('reuses the scrap intent when a lost response is retried after reopening its confirmation', async () => {
    draw(planetView({ ...world(), fleet: { DART: 4 }, fleetDamage: [] }));
    await userEvent.click(screen.getByRole('tab', { name: 'Scrap' }));
    await userEvent.type(within(screen.getByTestId('health-group')).getByRole('textbox'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Scrap ships' }));
    await userEvent.click(screen.getByTestId('confirm-commit'));
    const [first, callbacks] = mutations.maintenance.mock.calls[0]!;
    act(() => { callbacks.onError(new Error('Response lost after commit')); });
    await userEvent.click(screen.getByRole('button', { name: 'Keep ships' }));
    await userEvent.click(screen.getByRole('button', { name: 'Scrap ships' }));
    await userEvent.click(screen.getByTestId('confirm-commit'));
    expect(mutations.maintenance.mock.calls[1]?.[0]).toEqual(first);
  });
  it('shows zero resource returns explicitly for a barely surviving ship', async () => {
    draw(planetView({ ...world(), fleet: { DART: 1 }, fleetDamage: [{ hull: 'DART', count: 1, damageBp: 9999, remainderBp: 0.75 }] }));
    await userEvent.click(screen.getByRole('tab', { name: 'Scrap' }));
    await userEvent.type(within(screen.getByTestId('health-group')).getByRole('textbox'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Scrap ships' }));
    const resources = screen.getByText('Resources returned').parentElement;
    if (!resources) throw new Error('Missing resource return confirmation');
    expect(within(resources).getAllByText('0')).toHaveLength(3);
  });
  it('keeps an evacuation selection usable while radiation changes the docked ships’ health', async () => {
    const lot = { id: 'wounded', hull: 'DART' as const, count: 2, damageBp: 5000, remainderBp: 0.25,
      repairing: false, orderId: null, minutes: 10, cost: { alloy: 10, crystal: 0, deuterium: 0 } };
    const dock = { pct: 100, lots: [lot], waiting: { cost: lot.cost, minutes: 10 } };
    const planet = planetView({ fleet: {}, workshopRadiation: true, dock });
    const { rerender } = draw(planet);
    await userEvent.type(within(screen.getByTestId('health-group')).getByRole('textbox'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Return to hangar' }));
    const [first, callbacks] = mutations.maintenance.mock.calls[0]!;
    act(() => { callbacks.onError(new Error('Response lost after commit')); });
    const next = { ...planet, dock: { ...dock, lots: [{ ...lot, damageBp: 9000, remainderBp: 0.75 }] } };
    rerender(<ToastProvider><RepairStationSheet planet={next} held={held} onClose={vi.fn()} /></ToastProvider>);
    expect(screen.getByRole('button', { name: 'Return to hangar' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Return to hangar' }));
    expect(mutations.maintenance.mock.calls[1]?.[0]).toEqual(first);
    expect(mutations.maintenance).toHaveBeenCalledWith(expect.objectContaining({ action: 'RETURN',
      selection: { source: 'DOCK', lots: [{ id: 'wounded', count: 1 }] } }), expect.any(Object));
    rerender(<ToastProvider><RepairStationSheet planet={{ ...next, workshopRadiation: false }} held={held} onClose={vi.fn()} /></ToastProvider>);
    expect(screen.getByText(/Ship health changed/)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('0');
    expect(mutations.repair).not.toHaveBeenCalled();
  });
  it('clears the old selection and scrap confirmation when the displayed planet changes', async () => {
    const first = world();
    const { rerender } = draw(first);
    await userEvent.click(screen.getByRole('tab', { name: 'Scrap' }));
    await userEvent.type(within(screen.getAllByTestId('health-group').at(-1)!).getByRole('textbox'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Scrap ships' }));
    expect(screen.getByTestId('confirm-commit')).toBeInTheDocument();
    const next = { ...first, planet: { ...first.planet, id: 'another-world', name: 'Other world' } };
    rerender(<ToastProvider><RepairStationSheet planet={next} held={held} onClose={vi.fn()} /></ToastProvider>);
    expect(screen.queryByTestId('confirm-commit')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Repair' })).toHaveAttribute('aria-selected', 'true');
    for (const input of screen.getAllByRole('textbox')) expect(input).toHaveValue('0');
    expect(mutations.maintenance).not.toHaveBeenCalled();
  });
  it('explains the selection limit instead of silently disabling a large selection', () => {
    draw(planetView({ ...world(), fleet: { DART: 51 }, fleetDamage: Array.from({ length: 51 }, (_, index) =>
      ({ hull: 'DART' as const, count: 1, damageBp: index + 1 })) }));
    for (const input of screen.getAllByRole('textbox')) fireEvent.change(input, { target: { value: '1' } });
    expect(screen.getByRole('button', { name: 'Move to workshop' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Choose at most 50 health groups per action.');
  });
  it('explains radiation closure while keeping return to hangar available', async () => {
    draw(planetView({ ...world(), workshopRadiation: true, dock: { pct: 100,
      lots: [{ id: 'wounded', hull: 'DART', count: 2, damageBp: 5000, remainderBp: 0.25,
        repairing: false, orderId: null, minutes: 10, cost: { alloy: 10, crystal: 0, deuterium: 0 } }],
      waiting: { cost: { alloy: 10, crystal: 0, deuterium: 0 }, minutes: 10 } } }));
    expect(screen.getByRole('status')).toHaveTextContent(/Radiation/);
    await userEvent.click(screen.getByRole('tab', { name: 'Workshop' }));
    await userEvent.type(within(screen.getAllByTestId('health-group')[0]!).getByRole('textbox'), '1');
    expect(screen.getByRole('button', { name: 'Repair 1 ship' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Return to hangar' })).toBeEnabled();
    await userEvent.click(screen.getByRole('tab', { name: 'Scrap' }));
    await userEvent.type(within(screen.getAllByTestId('health-group')[0]!).getByRole('textbox'), '1');
    expect(screen.getByRole('button', { name: 'Scrap ships' })).toBeDisabled();
  });
  it('transfers only the explicitly selected wounded quantity without starting a paid repair', async () => {
    draw();
    const group = screen.getAllByTestId('health-group')[0]!;
    await userEvent.type(within(group).getByRole('textbox'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Move to workshop' }));
    expect(mutations.maintenance).toHaveBeenCalledWith(expect.objectContaining({ action: 'DOCK',
      selection: { source: 'HOME', groups: [{ hull: 'DART', count: 1, damageBp: 5000, remainderBp: 0.25 }] } }), expect.any(Object));
    expect(mutations.maintenance.mock.calls[0]?.[0]).toHaveProperty('key', expect.any(String));
    expect(mutations.repair).not.toHaveBeenCalled();
  });

  it('keeps the same repair intent and health quote when retrying after a lost response', async () => {
    draw(planetView({ fleet: {}, dock: { pct: 100, lots: [{ id: 'wounded', hull: 'DART', count: 2,
      damageBp: 5000, remainderBp: 0.25, repairing: false, orderId: null, minutes: 10,
      cost: { alloy: 10, crystal: 0, deuterium: 0 } }],
      waiting: { cost: { alloy: 10, crystal: 0, deuterium: 0 }, minutes: 10 } } }));
    expect(screen.getByRole('tab', { name: 'Workshop' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.type(within(screen.getAllByTestId('health-group')[0]!).getByRole('textbox'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Repair 1 ship' }));
    const [first, callbacks] = mutations.repair.mock.calls[0]!;
    expect(first.key).toEqual(expect.any(String));
    expect(first).toMatchObject({ request: { lots: [{ id: 'wounded', count: 1,
      damageBp: 5000, remainderBp: 0.25 }] } });
    act(() => { callbacks.onError(new Error('Response lost')); });
    await userEvent.click(screen.getByRole('button', { name: 'Repair 1 ship' }));
    expect(mutations.repair.mock.calls[1]?.[0]).toEqual(first);
  });

  it('requires a confirmation showing resource returns before scrapping a healthy ship', async () => {
    draw();
    await userEvent.click(screen.getByRole('tab', { name: 'Scrap' }));
    const group = screen.getAllByTestId('health-group').at(-1)!;
    await userEvent.type(within(group).getByRole('textbox'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Scrap ships' }));
    expect(mutations.maintenance).not.toHaveBeenCalled();
    expect(screen.getByText('Resources returned')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('confirm-commit'));
    expect(mutations.maintenance).toHaveBeenCalledWith(expect.objectContaining({ action: 'SCRAP',
      selection: { source: 'HOME', groups: [{ hull: 'DART', count: 1, damageBp: 0, remainderBp: 0 }] } }), expect.any(Object));
  });

  it('shows the exact resource return in the irreversible confirmation', async () => {
    draw(planetView({ ...world(), fleet: { CITADEL: 1000 }, fleetDamage: [] }));
    await userEvent.click(screen.getByRole('tab', { name: 'Scrap' }));
    await userEvent.type(within(screen.getByTestId('health-group')).getByRole('textbox'), '1000');
    await userEvent.click(screen.getByRole('button', { name: 'Scrap ships' }));
    const refund = shipScrapReturn({ CITADEL: 1000 }, []);
    expect(screen.getByText(full(refund.alloy))).toBeInTheDocument();
    expect(screen.getByText(full(refund.crystal))).toBeInTheDocument();
  });
});
