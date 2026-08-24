import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HULLS } from '@astera/rules';
import { compact } from '../src/lib/format.js';
import { TransferSheet } from '../src/screens/TransferSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

const mutate = vi.fn();
vi.mock('../src/api/queries.js', () => ({
  useTransfer: () => ({ mutate, isPending: false }),
}));

const target = {
  id: 'colony-1',
  name: 'Haven',
  owner: 'Commander',
  kind: 'COLONY' as const,
  controller: { kind: 'PLAYER' as const, playerId: 'player-1', displayName: 'Commander' },
  position: { x: 100, y: 0, z: 0 },
  coreTier: 2,
  satellites: [],
  shielded: false,
  isSelf: false,
  state: { kind: 'NORMAL' as const },
  isOwned: true,
  isCapital: false,
};

describe('world transfer sheet', () => {
  beforeEach(() => mutate.mockReset());

  it('shows cargo capacity and updates the defence left at origin', async () => {
    const user = userEvent.setup();
    const planet = planetView({
      fleet: { WASP: 2, HAULER: 1 },
      ground: { THORN: 3 },
    }, {
      id: 'capital-1',
      alloy: 10_000,
      crystal: 5_000,
      deuterium: 500,
    });
    render(
      <ToastProvider>
        <TransferSheet
          target={target}
          planet={planet}
          onClose={vi.fn()}
          onLaunched={vi.fn()}
        />
      </ToastProvider>,
    );

    expect(screen.getByText(/6 craft remain at origin/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'More Wasp' }));
    expect(screen.getByText(/5 craft remain at origin/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More Hauler' }));
    expect(screen.getByText(new RegExp(`0 / ${compact(HULLS.HAULER.cargo)}`, 'i'))).toBeInTheDocument();
    const alloy = screen.getByRole('slider', { name: /Alloy/i });
    // One Hauler's hold, off the constant — the slider's ceiling IS the cargo.
    const hold = String(HULLS.HAULER.cargo);
    expect(alloy).toHaveAttribute('max', hold);
    fireEvent.change(alloy, { target: { value: hold } });
    expect(alloy).toHaveValue(hold);
    expect(screen.getByRole('button', { name: /transfer — no recall/i })).toBeEnabled();
  });
});
