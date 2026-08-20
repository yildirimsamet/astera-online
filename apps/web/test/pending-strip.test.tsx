import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PendingThread } from '../src/api/schemas.js';
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

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return { ...actual, usePending: () => ({ data: { pending: rows } }) };
});

const thread = (over: Partial<PendingThread> = {}): PendingThread => ({
  kind: 'fleet',
  targetName: 'Tharsis',
  minutesRemaining: 12,
  arriveAt: new Date(Date.now() + 12 * 60_000),
  leg: 'outbound',
  ...over,
});

const show = (pending: PendingThread[]) => {
  rows = pending;
  return render(<PendingStrip />);
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
});
