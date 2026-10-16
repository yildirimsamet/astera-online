import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ShipHealthInventory } from '../src/ui/ShipHealthInventory.js';
import { homeMaintenanceRows } from '../src/lib/maintenanceInventory.js';

describe('ship health inventory decisions', () => {
  it('never labels a wounded civilian ship as combat ready', () => {
    render(<ShipHealthInventory rows={homeMaintenanceRows({ PROSPECTOR: 1 }, [{ hull: 'PROSPECTOR', count: 1, damageBp: 1000 }])}
      quantities={{}} onQuantity={vi.fn()} />);
    expect(screen.queryByText('Combat ready')).not.toBeInTheDocument();
    expect(screen.getByText('Unarmed in the line')).toBeInTheDocument();
  });
  it('lists wounds separately with real quantities and selects nothing automatically', async () => {
    const rows = homeMaintenanceRows({ DART: 5 }, [{ hull: 'DART', count: 2, damageBp: 5000, remainderBp: 0.25 }]);
    const choose = vi.fn();
    render(<ShipHealthInventory rows={rows} quantities={{}} onQuantity={choose} />);
    const groups = screen.getAllByTestId('health-group');
    expect(groups).toHaveLength(2);
    expect(within(groups[0]!).getByRole('textbox')).toHaveValue('0');
    expect(within(groups[1]!).getByRole('textbox')).toHaveValue('0');
    await userEvent.click(within(groups[0]!).getByRole('button', { name: /select all/i }));
    expect(choose).toHaveBeenLastCalledWith(rows[0]!.key, 2);
  });

  it('labels critical ships as unable to fight and preserves the distinction just above 5%', () => {
    const rows = homeMaintenanceRows({ DART: 2 }, [{ hull: 'DART', count: 1, damageBp: 9500 },
      { hull: 'DART', count: 1, damageBp: 9499, remainderBp: 1 - Number.EPSILON }]);
    render(<ShipHealthInventory rows={rows} quantities={{}} onQuantity={vi.fn()} />);
    expect(screen.getByText('Cannot fight')).toBeInTheDocument();
    expect(screen.getByText('Above 5% HP')).toBeInTheDocument();
  });

  it('does not offer quantity controls for ships reserved by an ongoing repair', () => {
    const [row] = homeMaintenanceRows({ DART: 1 }, [{ hull: 'DART', count: 1, damageBp: 1000 }]);
    render(<ShipHealthInventory rows={[{ ...row!, busy: true }]} quantities={{}} onQuantity={vi.fn()} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Repair reserved')).toBeInTheDocument();
  });
});
