import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PendingThread } from '../../src/api/schemas.js';
import { ToastProvider } from '../../src/ui/Toast.js';
import { FleetSheet } from '../../src/v2/hud/FleetSheet.js';

/**
 * THE FLEET TAB. Spec B4 and the "every surface's new place" table: the flight
 * board (`PendingStrip`'s roster) and the flight bays (`Bays`) under the dock's
 * Fleet tab. The full E4 page with B10/B11 arrives in F3; until then this is the
 * same roster, with the same focus and recall, in the new sheet.
 */

let rows: PendingThread[] = [];

vi.mock('../../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../src/api/queries.js');
  return {
    ...actual,
    usePending: () => ({ data: { pending: rows } }),
    useMining: () => ({ data: { runs: [] } }),
    useTraffic: () => ({ data: { contacts: [] } }),
    useRecallMining: () => ({ mutate: vi.fn(), isPending: false }),
    useRecallFlight: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

const own: PendingThread = {
  id: 'mission-1',
  kind: 'transfer',
  targetName: 'Hollow',
  minutesRemaining: 12,
  arriveAt: new Date(Date.now() + 12 * 60_000),
  leg: 'outbound',
  path: {
    from: { x: 0, y: 0, z: 0 },
    to: { x: 1, y: 0, z: 0 },
    departAt: new Date(Date.now() - 60_000),
    arriveAt: new Date(Date.now() + 12 * 60_000),
  },
};

const sheet = (onFocus = vi.fn(), onClose = vi.fn()) => render(
  <ToastProvider>
    <FleetSheet flight={{ used: 1, total: 4 }} onFocus={onFocus} onClose={onClose} />
  </ToastProvider>,
);

describe('the fleet tab', () => {
  it('heads the roster with the flight bays', () => {
    rows = [own];
    sheet();
    expect(screen.getByRole('dialog', { name: 'Fleet' })).toBeInTheDocument();
    expect(screen.getByText('1 of 4 flight bays in use')).toBeInTheDocument();
    expect(screen.getByText('Transfer → Hollow')).toBeInTheDocument();
  });

  it('closes itself and frames a craft when its row is pressed', async () => {
    rows = [own];
    const onFocus = vi.fn();
    const onClose = vi.fn();
    sheet(onFocus, onClose);
    await userEvent.click(screen.getByText('Transfer → Hollow'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('says so when nothing is up', () => {
    rows = [];
    sheet();
    expect(screen.getByText(/nothing|Nothing/)).toBeInTheDocument();
  });
});
