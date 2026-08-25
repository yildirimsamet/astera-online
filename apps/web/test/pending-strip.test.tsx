import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MiningRun, PendingThread } from '../src/api/schemas.js';
import { PendingStrip } from '../src/shell/PendingStrip.js';

/**
 * THE COUNTDOWN AT THE FOOT OF THE SCREEN BELONGS TO YOU, AND HAS TO SAY SO.
 *
 * The strip is permanent — Design Law #1 made visible — and the focus rail opens
 * directly above it, so the two stack into one block of chrome. Focus anything that
 * is not yours, which is most of the disc, and the strip's figure was read as the
 * clock of whatever had just been tapped. The owner reported it against a foreign
 * fleet: "it shows the countdown of the last craft I focused."
 *
 * Nothing about what the strip SHOWS changed — the fog was never leaking, the row
 * was only unlabelled. These tests hold the label in place.
 */

let rows: PendingThread[] = [];
let runs: MiningRun[] = [];

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    usePending: () => ({ data: { pending: rows } }),
    useMining: () => ({ data: { runs } }),
  };
});

const thread = (over: Partial<PendingThread> = {}): PendingThread => ({
  kind: 'fleet',
  targetName: 'Tharsis',
  minutesRemaining: 12,
  arriveAt: new Date(Date.now() + 12 * 60_000),
  leg: 'outbound',
  ...over,
});

const run = (over: Partial<MiningRun> = {}): MiningRun => ({
  id: 'run-1',
  targetKind: 'asteroid',
  asteroidIndex: 7,
  debrisFieldId: null,
  status: 'outbound',
  craft: 2,
  departAt: new Date(Date.now() - 60_000),
  arriveAt: new Date(Date.now() + 8 * 60_000),
  homeAt: null,
  intercept: { x: 1, y: 0, z: 2 },
  minedAlloy: 0,
  minedCrystal: 0,
  minedDeuterium: 0,
  ...over,
});

const show = (
  pending: PendingThread[],
  miningRuns: MiningRun[] = [],
  onFocus?: (focus: { kind: 'thread'; key: string } | { kind: 'run'; id: string }) => void,
) => {
  rows = pending;
  runs = miningRuns;
  return render(<PendingStrip {...(onFocus ? { onFocus } : {})} />);
};

describe('the pending strip', () => {
  it('names an outbound fleet as yours', () => {
    show([thread()]);
    expect(screen.getByText(/your fleet → tharsis/i)).toBeInTheDocument();
  });

  it('names a returning fleet as yours', () => {
    show([thread({ leg: 'return' })]);
    expect(screen.getByText(/your fleet home from tharsis/i)).toBeInTheDocument();
  });

  it('names a probe as yours', () => {
    show([thread({ kind: 'probe' })]);
    expect(screen.getByText(/your probe → tharsis/i)).toBeInTheDocument();
  });

  /**
   * The one thread that is NOT yours is the one aimed at you, and it must not be
   * labelled as though you launched it.
   */
  it('does not claim an inbound fleet as yours', () => {
    show([thread({ kind: 'incoming', targetName: 'inbound fleet' })]);
    expect(screen.getByText(/inbound fleet/i)).toBeInTheDocument();
    expect(screen.queryByText(/^your /i)).not.toBeInTheDocument();
  });

  it('says so plainly when there is nothing in flight', () => {
    show([]);
    expect(screen.getByText(/nothing in flight/i)).toBeInTheDocument();
  });

  /** The reported bug: drills live in `mining.runs`, not in `pending`. */
  it('counts a drill as in flight when the mission list is empty', () => {
    show([], [run()]);
    expect(screen.queryByText(/nothing in flight/i)).not.toBeInTheDocument();
    expect(screen.getByText(/your drills.*asteroid 7/i)).toBeInTheDocument();
  });

  it('opens every airborne craft in a bottom sheet and focuses the chosen drill', async () => {
    const onFocus = vi.fn();
    show([thread({
      id: 'fleet-1',
      path: {
        from: { x: 0, y: 0, z: 0 },
        to: { x: 1, y: 0, z: 1 },
        departAt: new Date(Date.now() - 60_000),
        arriveAt: new Date(Date.now() + 12 * 60_000),
      },
    })], [run()], onFocus);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /open flights/i }));
    expect(screen.getByRole('dialog', { name: /in flight/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /your fleet.*tharsis/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /your drills.*asteroid 7/i }));
    expect(onFocus).toHaveBeenCalledWith({ kind: 'run', id: 'run-1' });
    expect(screen.queryByRole('dialog', { name: /in flight/i })).not.toBeInTheDocument();
  });

  it('does not count completed mining rows as airborne', () => {
    show([], [run({ status: 'done' })]);
    expect(screen.getByText(/nothing in flight/i)).toBeInTheDocument();
  });
});
