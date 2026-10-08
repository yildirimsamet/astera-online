import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MiningRun, PendingThread } from '../src/api/schemas.js';
import { RunFocus, ThreadFocus } from '../src/galaxy/FocusPanel.js';

const run = (over: Partial<MiningRun> = {}): MiningRun => ({
  id: 'run', planetId: 'a81ac5c9-e6cd-452b-89ad-6b408fc864fb',
  targetKind: 'asteroid', asteroidId: 'mJt7YvxMZEC5S7yYQ32SYw', debrisFieldId: null,
  status: 'outbound', craft: 4, departAt: new Date(Date.now() - 60_000),
  arriveAt: new Date(Date.now() + 600_000), recalledAt: null, homeAt: null,
  intercept: { x: 100, y: 0, z: 0 }, minedAlloy: 0, minedCrystal: 0, minedDeuterium: 0,
  ...over,
});
const thread = (over: Partial<PendingThread> = {}): PendingThread => ({
  id: 'mission', kind: 'fleet', targetName: 'Tharsis', minutesRemaining: 10,
  arriveAt: new Date(Date.now() + 600_000), leg: 'outbound', fleet: { DART: 4 },
  recallable: true, ...over,
});

describe('recall from the selected craft', () => {
  it('recalls outbound Prospectors from their own detail', () => {
    const onRecall = vi.fn();
    render(<RunFocus run={run()} rock={undefined} wreck={undefined} minutesRemaining={10}
      onClose={vi.fn()} onToggle={vi.fn()} open onRecall={onRecall} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recall Prospectors' }));
    expect(onRecall).toHaveBeenCalledOnce();
  });

  it.each([
    { status: 'returning' as const }, { status: 'done' as const },
    { recalledAt: new Date() }, { recalledAt: undefined },
    { arriveAt: new Date(Date.now() - 1_000) },
  ])('does not offer a second or late Prospector recall (%j)', (over) => {
    render(<RunFocus run={run(over)} rock={undefined} wreck={undefined} minutesRemaining={0}
      onClose={vi.fn()} onToggle={vi.fn()} open onRecall={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Recall Prospectors' })).not.toBeInTheDocument();
  });

  it('disables a Prospector recall already being submitted', () => {
    render(<RunFocus run={run()} rock={undefined} wreck={undefined} minutesRemaining={10}
      onClose={vi.fn()} onToggle={vi.fn()} open onRecall={vi.fn()} recalling />);
    expect(screen.getByRole('button', { name: 'Recalling…' })).toBeDisabled();
  });

  it('recalls a fleet only when the server allows its recall', () => {
    const onRecall = vi.fn();
    render(<ThreadFocus thread={thread()} minutesRemaining={10}
      onClose={vi.fn()} onToggle={vi.fn()} open onRecall={onRecall} />);
    fireEvent.click(screen.getByRole('button', { name: 'Recall fleet' }));
    expect(onRecall).toHaveBeenCalledOnce();
  });

  it.each([
    { recallable: false }, { recallable: undefined }, { id: undefined },
    { leg: 'return' as const }, { kind: 'incoming' as const },
    { arriveAt: new Date(Date.now() - 1_000) },
  ])('does not invent permission to recall a flight (%j)', (over) => {
    render(<ThreadFocus thread={thread(over)} minutesRemaining={0}
      onClose={vi.fn()} onToggle={vi.fn()} open onRecall={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Recall fleet' })).not.toBeInTheDocument();
  });

  /**
   * THE LINE UNDER A FLIGHT SAYS WHAT IS TRUE OF THAT FLIGHT. Owner report, 2026-10-06: every
   * outbound fleet read "a launched fleet cannot be recalled" — right over the Recall button.
   */
  it('tells a recallable fleet it can still turn, never that it cannot', () => {
    render(<ThreadFocus thread={thread()} minutesRemaining={10}
      onClose={vi.fn()} onToggle={vi.fn()} open onRecall={vi.fn()} />);
    expect(screen.getByText(/can be turned home once/i)).toBeInTheDocument();
    expect(screen.queryByText(/cannot be recalled/i)).not.toBeInTheDocument();
  });

  /* Owner, 2026-10-08: a pirate raid turns too; once it can no longer, the engagement has begun. */
  it('names the engagement as what stops a pirate raid turning', () => {
    render(<ThreadFocus thread={thread({ kind: 'pirate', recallable: undefined })} minutesRemaining={10}
      onClose={vi.fn()} onToggle={vi.fn()} open onRecall={vi.fn()} />);
    expect(screen.getByText('The engagement has begun; this raid can no longer turn.')).toBeInTheDocument();
  });

  it('says plainly that a flight the server will not turn cannot be recalled', () => {
    render(<ThreadFocus thread={thread({ kind: 'probe', recallable: undefined })} minutesRemaining={10}
      onClose={vi.fn()} onToggle={vi.fn()} open onRecall={vi.fn()} />);
    expect(screen.getByText('This flight cannot be recalled.')).toBeInTheDocument();
    expect(screen.queryByText(/launched fleet/i)).not.toBeInTheDocument();
  });

  it('disables a fleet recall already being submitted', () => {
    render(<ThreadFocus thread={thread()} minutesRemaining={10}
      onClose={vi.fn()} onToggle={vi.fn()} open onRecall={vi.fn()} recalling />);
    expect(screen.getByRole('button', { name: 'Recalling' })).toBeDisabled();
  });
});
