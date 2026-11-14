import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FAULT } from '@astera/rules';
import type { FaultView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { FaultSheet } from '../src/screens/FaultSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

const mutate = vi.fn();
vi.mock('../src/api/queries.js', () => ({
  useRepairFault: () => ({ mutate, isPending: false }),
}));

const fault = (over: Partial<FaultView> = {}): FaultView => ({
  id: 'f-1',
  kind: 'REFINERY_OUTAGE',
  startedAt: new Date(0),
  cost: { alloy: 600, crystal: 200, deuterium: 0 },
  repair: null,
  ...over,
});

const show = (
  target: FaultView,
  faults: FaultView[] = [target],
  stock: Parameters<typeof planetView>[1] = { alloy: 10_000, crystal: 10_000 },
  over: Parameters<typeof planetView>[0] = {},
) => render(
  <ToastProvider>
    <FaultSheet fault={target} planet={planetView({ ...over, faults }, stock)} onClose={vi.fn()} />
  </ToastProvider>,
);

beforeEach(async () => {
  mutate.mockReset();
  await i18n.changeLanguage('en');
});

/**
 * THE FAULT SHEET ON THE GAME KIT (G2-d, 2026-11-14). The player's moment: "is it worth
 * mending?" — what the fault takes an hour beside what the crew costs, then a repair that
 * cannot be cancelled, so it is a one-second hold (the kit's weight for what spends).
 */
describe('the fault sheet', () => {
  it('starts a repair with a one-second hold, never a tap', async () => {
    show(fault());
    const hold = screen.getByRole('button', { name: /^Repair/ });
    expect(hold).toHaveClass('gk-hold');
    await userEvent.click(hold);
    expect(mutate).not.toHaveBeenCalled();
    hold.focus();
    await userEvent.keyboard('{Enter}{Enter}');
    expect(mutate).toHaveBeenCalledWith({ planetId: 'p1', faultId: 'f-1' }, expect.anything());
  });

  it('says before the hold that a repair cannot be cancelled', () => {
    show(fault());
    expect(screen.getByText('Repairs cannot be cancelled once started.')).toBeInTheDocument();
  });

  it('a hold with every crew out says so on its face', () => {
    const busy = (id: string, kind: FaultView['kind'], slot: number) => fault({ id, kind, repair: { slot, readyAt: new Date(Date.now() + 600_000) } });
    const target = fault();
    show(target, [target, busy('a', 'VAULT_LEAK', 0), busy('b', 'CORE_OUTAGE', 1), busy('c', 'TELESCOPE_FAULT', 2)]);
    expect(screen.getByRole('button', { name: `All ${String(FAULT.repairSlots)} crews are out` })).toBeDisabled();
  });

  it('a hold the store cannot pay says so on its face', () => {
    show(fault(), undefined, { alloy: 100, crystal: 10_000 });
    expect(screen.getByRole('button', { name: 'Not enough in the store' })).toBeDisabled();
  });

  it('puts what the fault takes an hour beside what the repair costs', () => {
    show(fault());
    const ledger = document.querySelector('[data-fault-ledger]');
    expect(ledger?.querySelector('[data-fault-toll]')?.textContent).toMatch(/alloy/);
    expect(ledger?.querySelector('[data-fault-price] .gk-cost')).not.toBeNull();
    // how long, as a range beside the price; the exact time is drawn when the crew starts
    expect(ledger?.querySelector('[data-fault-price]')?.textContent).toMatch(/\d–\d+(\.\d+)? min$/);
    expect(screen.getByText('The exact time is set when the repair starts.')).toBeInTheDocument();
  });

  it('quotes the hour as a figure: what is not being made, or what leaks into orbit', () => {
    show(fault(), undefined, { alloy: 10_000, crystal: 10_000, alloyPerHour: 0, nominalAlloyPerHour: 1_770 });
    expect(document.querySelector('[data-fault-toll]')?.textContent).toBe('What it is taking1,770/halloy not being made');
  });

  it('a dark deuterium refinery quotes its hour as a figure too', () => {
    show(fault({ kind: 'PLANT_OUTAGE' }), undefined, { alloy: 10_000, crystal: 10_000, nominalDeuteriumPerHour: 240 });
    expect(document.querySelector('[data-fault-toll]')?.textContent).toContain('240/h');
    expect(document.querySelector('[data-fault-toll]')?.textContent).toMatch(/deuterium/);
  });

  it('the head says how many crews are free', () => {
    const target = fault();
    show(target, [target, fault({ id: 'b', kind: 'VAULT_LEAK', repair: { slot: 0, readyAt: new Date(Date.now() + 600_000) } })]);
    expect(screen.getByText(`${String(FAULT.repairSlots - 1)}/${String(FAULT.repairSlots)} crews free`)).toBeInTheDocument();
  });

  it('a colony’s sheet shows its loyalty as the hero draws it, and how long it has', () => {
    show(fault(), undefined, undefined, { loyalty: { value: 62, minutesLeft: 840 } });
    const loyalty = document.querySelector('[data-fault-loyalty]');
    expect(loyalty?.querySelector('[data-loyalty-bar]')).not.toBeNull();
    expect(loyalty?.textContent).toContain('62%');
    expect(loyalty?.textContent).toMatch(/14h/);
  });

  it('a capital, whose loyalty cannot move, has no loyalty block', () => {
    show(fault(), undefined, undefined, { loyalty: null });
    expect(document.querySelector('[data-fault-loyalty]')).toBeNull();
  });

  it('a fault that stops a capability rather than a number still prices its repair', () => {
    show(fault({ kind: 'SHIPYARD_REVOLT' }));
    const ledger = document.querySelector('[data-fault-ledger]');
    expect(ledger?.querySelector('[data-fault-toll]')).toBeNull();
    expect(ledger?.querySelector('[data-fault-price] .gk-cost')).not.toBeNull();
  });

  it('a crew at work shows its clock and its crew, and no hold', () => {
    show(fault({ repair: { slot: 1, readyAt: new Date(Date.now() + 5 * 60_000) } }));
    expect(screen.queryByRole('button', { name: /^Repair/ })).toBeNull();
    expect(document.querySelector('[data-fault-running] .gk-timer')).not.toBeNull();
    expect(screen.getByText(/Crew 2/)).toBeInTheDocument();
  });

  it('is drawn on the kit, not the old plates', () => {
    show(fault());
    expect(document.querySelector('.plate, .legend, .text-faint, .text-dim')).toBeNull();
  });
});
