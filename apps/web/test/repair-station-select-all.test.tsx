import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepairStationSheet } from '../src/screens/RepairStation.js';
import { ToastProvider } from '../src/ui/Toast.js';
import type { PlanetView } from '../src/api/schemas.js';
import type { MaintenanceSelection, RepairRequest } from '../src/api/client.js';
import { planetView } from './fixtures.js';

const mutations = vi.hoisted(() => ({
  maintenance: vi.fn<(input: { planetId: string; action: string; selection: MaintenanceSelection; key: string }, callbacks: unknown) => void>(),
  repair: vi.fn<(input: { planetId: string; request: RepairRequest; key?: string }, callbacks: unknown) => void>(),
  cancel: vi.fn(), pending: false,
}));
vi.mock('../src/api/queries.js', () => ({
  useMaintenance: () => ({ mutate: mutations.maintenance, isPending: mutations.pending }),
  useStartRepair: () => ({ mutate: mutations.repair, isPending: false }),
  useCancelRepair: () => ({ mutate: mutations.cancel, isPending: false }),
}));
const held = { alloy: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000 };
const world = () => planetView({ fleet: { DART: 6, CORSAIR: 3, COURIER: 8 },
  fleetDamage: [{ hull: 'DART', count: 2, damageBp: 0, remainderBp: 0.25 },
    { hull: 'CORSAIR', count: 3, damageBp: 7000, remainderBp: 0.5 }],
  dock: { pct: 100, lots: [], waiting: { cost: { alloy: 0, crystal: 0, deuterium: 0 }, minutes: 0 } },
  queues: { CONSTRUCTION: [], YARD: [], REPAIR: [] } });
const content = (planet: PlanetView) => <ToastProvider><RepairStationSheet planet={planet} held={held} onClose={vi.fn()} /></ToastProvider>;
const all = () => screen.getByRole('button', { name: 'Select all' });
const counts = () => screen.getAllByRole('textbox').map(input => Number(input.getAttribute('value'))).sort((a, b) => a - b);
beforeEach(() => { vi.clearAllMocks(); mutations.pending = false; });

describe('select all damaged ships in the Repair Station', () => {
  it('selects full damaged groups across hulls, including fractional wounds, without moving or repairing yet', async () => {
    render(content(world()));
    await userEvent.click(all());
    expect(counts()).toEqual([2, 3]);
    expect(within(screen.getByTestId('repair-total')).getByText('5 selected')).toBeVisible();
    expect(mutations.maintenance).not.toHaveBeenCalled();
    expect(mutations.repair).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Move to workshop' }));
    expect(mutations.maintenance).toHaveBeenCalledTimes(1);
    const input = mutations.maintenance.mock.calls[0]?.[0];
    expect(input?.action).toBe('DOCK');
    if (input?.selection.source !== 'HOME') throw new Error('Expected home selection');
    expect([...input.selection.groups].sort((a, b) => a.hull.localeCompare(b.hull))).toEqual([
      { hull: 'CORSAIR', count: 3, damageBp: 7000, remainderBp: 0.5 },
      { hull: 'DART', count: 2, damageBp: 0, remainderBp: 0.25 },
    ]);
    expect(mutations.repair).not.toHaveBeenCalled();
  });

  it('fills partial selections and supports clearing and selecting again', async () => {
    render(content(world()));
    await userEvent.type(screen.getAllByRole('textbox')[0]!, '1');
    await userEvent.click(all());
    expect(counts()).toEqual([2, 3]);
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(counts()).toEqual([0, 0]);
    expect(screen.getByRole('button', { name: 'Move to workshop' })).toBeDisabled();
    await userEvent.click(all());
    expect(counts()).toEqual([2, 3]);
  });

  it('leaves new arrivals unselected, and lets the user select the refreshed health groups explicitly', async () => {
    const initial = world();
    const view = render(content(initial));
    await userEvent.click(all());
    const next = { ...initial, fleet: { ...initial.fleet, ARGOSY: 4 },
      fleetDamage: [...initial.fleetDamage!, { hull: 'ARGOSY' as const, count: 4, damageBp: 1000, remainderBp: 0 }] };
    view.rerender(content(next));
    expect(counts()).toEqual([0, 2, 3]);
    await userEvent.click(all());
    expect(counts()).toEqual([2, 3, 4]);
    const changed = { ...next, fleetDamage: next.fleetDamage.map(lot => lot.hull === 'DART' ? { ...lot, remainderBp: 0.5 } : lot) };
    view.rerender(content(changed));
    expect(screen.getByRole('button', { name: 'Move to workshop' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Ship health changed');
    await userEvent.click(all());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(counts()).toEqual([2, 3, 4]);
  });

  it('selects only waiting workshop groups and leaves reserved repairs untouched', async () => {
    const lot = { id: 'waiting', hull: 'DART' as const, count: 3, damageBp: 5000, remainderBp: 0,
      repairing: false, orderId: null, minutes: 10, cost: { alloy: 10, crystal: 0, deuterium: 0 } };
    render(content(planetView({ fleet: {}, dock: { pct: 100,
      lots: [lot, { ...lot, id: 'busy', count: 8, repairing: true, orderId: 'repair-order' }],
      waiting: { cost: lot.cost, minutes: 10 } } })));
    await userEvent.click(all());
    expect(counts()).toEqual([3]);
    expect(screen.getByText('Repair reserved')).toBeVisible();
    expect(within(screen.getByTestId('repair-total')).getByText('3 selected')).toBeVisible();
    expect(mutations.repair).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Repair 3 ships' }));
    expect(mutations.repair).toHaveBeenCalledWith(expect.objectContaining({ request: { lots: [
      { id: 'waiting', count: 3, damageBp: 5000, remainderBp: 0 },
    ] } }), expect.any(Object));
  });

  it('keeps bulk selection disabled during a request and when there are no eligible ships', () => {
    mutations.pending = true;
    const view = render(content(world()));
    expect(all()).toBeDisabled();
    mutations.pending = false;
    view.rerender(content(planetView({ fleet: { DART: 10 }, fleetDamage: [] })));
    expect(all()).toBeDisabled();
    expect(mutations.maintenance).not.toHaveBeenCalled();
  });

  it('can move the full selection at the 50-group boundary', async () => {
    render(content(planetView({ ...world(), fleet: { DART: 50 }, fleetDamage: Array.from({ length: 50 }, (_, index) =>
      ({ hull: 'DART' as const, count: 1, damageBp: index + 1 })) })));
    await userEvent.click(all());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Move to workshop' }));
    expect(mutations.maintenance).toHaveBeenCalledTimes(1);
    const selection = mutations.maintenance.mock.calls[0]?.[0].selection;
    if (selection?.source !== 'HOME') throw new Error('Expected home selection');
    expect(selection.groups).toHaveLength(50);
    expect(selection.groups.every(group => group.count === 1)).toBe(true);
  });

  it('explicitly selects a usable first batch when distributed wounds exceed one request', async () => {
    render(content(planetView({ ...world(), fleet: { DART: 51 }, fleetDamage: Array.from({ length: 51 }, (_, index) =>
      ({ hull: 'DART' as const, count: 1, damageBp: index + 1, remainderBp: .25 })) })));
    await userEvent.click(screen.getByRole('button', { name: 'Select first 50 health groups' }));
    expect(counts()).toEqual([0, ...Array.from({ length: 50 }, () => 1)]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move to workshop' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Move to workshop' }));
    const selected = mutations.maintenance.mock.calls[0]?.[0].selection;
    if (selected?.source !== 'HOME') throw new Error('Expected home selection');
    expect(selected.groups).toHaveLength(50);
    expect(selected.groups.every(group => group.remainderBp === .25)).toBe(true);
  });

  it('keeps radiation restrictions and explicit scrap selection in place', async () => {
    render(content({ ...world(), workshopRadiation: true }));
    await userEvent.click(all());
    expect(screen.getByRole('button', { name: 'Move to workshop' })).toBeDisabled();
    await userEvent.click(screen.getByRole('tab', { name: 'Scrap' }));
    expect(screen.queryByRole('button', { name: 'Select all' })).not.toBeInTheDocument();
    expect(counts()).toEqual([0, 0, 0, 0]);
    expect(mutations.maintenance).not.toHaveBeenCalled();
  });
});
