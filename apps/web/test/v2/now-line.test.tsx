import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BuildOrderView, Contact, MiningRun, PendingThread } from '../../src/api/schemas.js';
import i18n from '../../src/i18n/index.js';
import { nowEntries, type NowInput } from '../../src/lib/nowLine.js';
import { buildOrderLabel } from '../../src/lib/orders.js';
import { NowLine } from '../../src/v2/hud/NowLine.js';

/**
 * THE NOW LINE. Spec B2 (docs/ui-v2/gozlemevi.md).
 *
 * One line under the top bar: a dot (red only for an enemy), what it is, and the
 * countdown, with "+N" for the rest. It is gone when nothing is timed. A tap
 * opens every timer, each with its countdown and the clock time it lands at.
 */

const NOW = Date.parse('2026-09-23T12:00:00Z');
const at = (ms: number): Date => new Date(NOW + ms);

const thread = (kind: PendingThread['kind'], ms: number): PendingThread => ({
  kind,
  targetName: 'Kestrel',
  targetPlanetId: 'p-1',
  minutesRemaining: ms / 60_000,
  arriveAt: at(ms),
});

const flying = (kind: PendingThread['kind'], id: string, ms: number): PendingThread => ({
  ...thread(kind, ms),
  id,
  path: {
    from: { x: 0, y: 0, z: 0 },
    to: { x: 1, y: 0, z: 1 },
    departAt: at(-60_000),
    arriveAt: at(ms),
  },
});

const drill: MiningRun = {
  id: 'run-1', targetKind: 'asteroid', asteroidId: 'rock-1', debrisFieldId: null,
  status: 'outbound', craft: 2, departAt: at(-60_000), arriveAt: at(480_000),
  homeAt: null, intercept: { x: 1, y: 0, z: 1 }, minedAlloy: 0,
  minedCrystal: 0, minedDeuterium: 0, recalledAt: null,
};

const visibleContact: Contact = {
  id: 'mission-9', kind: 'unknown', from: { x: 0, y: 0, z: 0 },
  to: { x: 1, y: 0, z: 1 }, startAt: at(-60_000), endAt: at(600_000), inbound: true,
};

const refinery: BuildOrderView = {
  id: 'o-1',
  queue: 'CONSTRUCTION',
  slot: 0,
  kind: 'BUILDING',
  subject: 'REFINERY',
  count: 1,
  startedAt: at(-3_600_000),
  finishesAt: at(120_000),
  cost: { alloy: 1, crystal: 0, deuterium: 0 },
};

/** The sheet's open state belongs to the shell; closed unless a test opens it. */
const closed = () => ({ open: false, onOpen: vi.fn(), onClose: vi.fn() });

const entries = (over: Partial<NowInput>) => nowEntries({
  now: NOW, threads: [], runs: [], builds: [], research: [], events: [], shieldUntil: null, ...over,
});
const sheetEntries = (over: Partial<NowInput>) => nowEntries({
  now: NOW, threads: [], runs: [], builds: [], research: [], events: [], shieldUntil: null, ...over,
}, 'sheet');

describe('the Now line', () => {
  it('is not in the page when nothing is timed', () => {
    const { container } = render(<NowLine entries={[]} now={NOW} {...closed()} />);
    expect(container.innerHTML).toBe('');
  });

  it('leads with an enemy, in red, and announces it once', () => {
    render(<NowLine entries={entries({ threads: [thread('transfer', 60_000), thread('incoming', 252_000)] })} now={NOW} {...closed()} />);
    const line = screen.getByRole('button', { name: /Most urgent timer/ });
    expect(line).toHaveAttribute('data-tone', 'hostile');
    expect(within(line).getByText('Inbound → Kestrel')).toHaveAttribute('aria-live', 'polite');
    expect(within(line).getByText('4m 12s')).toBeInTheDocument();
    expect(within(line).getByText('+1')).toBeInTheDocument();
  });

  /**
   * Owner, 2026-09-24: the mark beats on every timer, not only an enemy's — something is
   * running. Since G1-c (2026-11-14) the beat is the ring's, in its owner's colour.
   */
  it('beats the ring in front of every timer, yours and an enemy’s', () => {
    const { container, rerender } = render(
      <NowLine entries={entries({ threads: [thread('transfer', 60_000)] })} now={NOW} {...closed()} />,
    );
    const ring = () => container.querySelector('[data-now-line] .gk-timer');
    expect(ring()).toHaveAttribute('data-beat');
    expect(ring()).toHaveAttribute('data-tone', 'self');
    rerender(<NowLine entries={entries({ threads: [thread('incoming', 60_000)] })} now={NOW} {...closed()} />);
    expect(ring()).toHaveAttribute('data-beat');
    expect(ring()).toHaveAttribute('data-tone', 'hostile');
  });

  /**
   * The shell floats the line over the galaxy in a layer that lets presses through to the
   * scene (G1-c, found on the phone 2026-11-14: the plate could not be pressed): the plate
   * takes them back.
   */
  it('takes a press back from the pass-through layer it floats in', () => {
    const { container } = render(<NowLine entries={entries({ threads: [thread('transfer', 60_000)] })} now={NOW} {...closed()} />);
    expect(container.querySelector('[data-now-line]')?.className).toContain('[&_button]:pointer-events-auto');
  });

  /**
   * The plate floats in a layer of its own over the galaxy; the board it opens must not stay
   * in that layer, or the galaxy's cards draw over it (found on the phone, 2026-11-14).
   */
  it('opens the board over the whole game, not inside the layer the plate floats in', () => {
    const { container } = render(
      <div data-now-float=""><NowLine entries={entries({ threads: [thread('transfer', 60_000)] })} now={NOW} {...closed()} open /></div>,
    );
    const sheet = screen.getByRole('dialog', { name: 'Timers' });
    expect(container.querySelector('[data-now-float]')?.contains(sheet)).toBe(false);
  });

  it('marks the timer by what it is', () => {
    const { container, rerender } = render(<NowLine entries={entries({ threads: [thread('incoming', 60_000)] })} now={NOW} {...closed()} />);
    const mark = () => container.querySelector('[data-now-line] .gk-timer__ring')?.getAttribute('data-glyph');
    expect(mark()).toBe('siren');
    rerender(<NowLine entries={entries({ builds: [refinery] })} now={NOW} {...closed()} />);
    expect(mark()).toBe('up');
  });

  it('drains the ring over the flight’s whole, and guesses none it was not told', () => {
    const { container, rerender } = render(<NowLine entries={entries({ threads: [flying('transfer', 'transfer-1', 60_000)] })} now={NOW} {...closed()} />);
    const arc = () => container.querySelector('[data-now-line] .gk-timer__arc');
    // Left a minute ago, lands in one: half of the flight is still ahead.
    const length = Number(arc()?.getAttribute('stroke-dasharray'));
    expect(Number(arc()?.getAttribute('stroke-dashoffset'))).toBeCloseTo(length * 0.5);
    rerender(<NowLine entries={entries({ threads: [thread('transfer', 60_000)] })} now={NOW} {...closed()} />);
    expect(arc()).toBeNull();
  });

  it('draws your own timers in your colour', () => {
    render(<NowLine entries={entries({ threads: [thread('transfer', 60_000)] })} now={NOW} {...closed()} />);
    const line = screen.getByRole('button', { name: /Most urgent timer/ });
    expect(line).toHaveAttribute('data-tone', 'self');
    expect(within(line).queryByText(/^\+/)).toBeNull();
  });

  it('names work by what is being built', () => {
    render(<NowLine entries={entries({ builds: [refinery] })} now={NOW} {...closed()} />);
    expect(screen.getByText(buildOrderLabel(refinery))).toBeInTheDocument();
    expect(screen.getByText('Work finishing')).toBeInTheDocument();
    expect(screen.getByText('2m 00s')).toBeInTheDocument();
  });

  it('counts down in the reader’s language', async () => {
    render(<NowLine entries={entries({ threads: [thread('transfer', 252_000)] })} now={NOW} {...closed()} />);
    await act(async () => { await i18n.changeLanguage('tr'); });
    expect(screen.getByText('4 dk 12 sn')).toBeInTheDocument();
    await act(async () => { await i18n.changeLanguage('en'); });
  });

  it('opens every timer with the clock time each lands at', async () => {
    const list = entries({ threads: [thread('incoming', 252_000), thread('transfer', 600_000)], builds: [refinery] });
    const onOpen = vi.fn();
    const { rerender } = render(<NowLine entries={list} now={NOW} {...closed()} onOpen={onOpen} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Most urgent timer/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    rerender(<NowLine entries={list} now={NOW} {...closed()} open />);
    const sheet = screen.getByRole('dialog', { name: 'Timers' });
    expect(within(sheet).getAllByRole('listitem')).toHaveLength(3);
    expect(within(sheet).getAllByText(/^at /)).toHaveLength(3);
  });

  /**
   * ONLY THE RUNNING ORDER COUNTS DOWN. Owner report, 2026-10-06: every queued order wore a clock,
   * which read as three buildings going up at once — the Base's own lanes mark the rest "Queued".
   */
  it('lists the whole queue, counting down only the running order', () => {
    const next: BuildOrderView = { ...refinery, id: 'o-2', slot: 1, subject: 'EXTRACTOR', startedAt: at(120_000), finishesAt: at(900_000) };
    const last: BuildOrderView = { ...refinery, id: 'o-3', slot: 2, subject: 'VAULT', startedAt: at(900_000), finishesAt: at(2_400_000) };
    const input = { builds: [refinery, next, last] };
    render(<NowLine entries={entries(input)} sheet={sheetEntries(input)} now={NOW} {...closed()} open />);
    const sheet = screen.getByRole('dialog', { name: 'Timers' });
    const rows = within(sheet).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('2m 00s')).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/^at /)).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Work finishing')).toBeInTheDocument();
    expect(rows[0]!.querySelector('.gk-timer__ring')).toHaveAttribute('data-glyph', 'up');
    expect(rows[0]!.querySelector('.gk-timer__arc')).not.toBeNull();
    for (const row of rows.slice(1)) {
      // Its clock is not running yet: the ring holds no arc.
      expect(row.querySelector('.gk-timer__ring')).toHaveAttribute('data-glyph', 'up');
      expect(row.querySelector('.gk-timer__arc')).toBeNull();
      expect(within(row).getByText('Queued')).toBeInTheDocument();
      // A queued order is not finishing: it says when it starts.
      expect(within(row).getByText('Starts when the one ahead finishes')).toBeInTheDocument();
      expect(within(row).queryByText('Work finishing')).toBeNull();
      expect(within(row).queryByText(/^at /)).toBeNull();
      expect(within(row).queryByText(/\d+m \d+s/)).toBeNull();
    }
    // And the line says how many more the sheet holds.
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  /**
   * THE BOARD OF EVERY TIMER (G1-c): it opens under a painted stopwatch and says the order it
   * lists in, so an enemy an hour out above a transfer landing in a minute is a rule, not a
   * mistake. While something is coming for you the head is red.
   */
  it('opens under the stopwatch and says the order it lists in', () => {
    const { rerender } = render(<NowLine entries={entries({ threads: [thread('transfer', 60_000)] })} now={NOW} {...closed()} open />);
    let sheet = screen.getByRole('dialog', { name: 'Timers' });
    expect(sheet.querySelector('.gk-sheet__art')?.getAttribute('src')).toMatch(/hud-timers\.webp$/);
    expect(within(sheet).getByText('Enemies first, then the soonest')).toBeInTheDocument();
    expect(sheet.querySelector('.gk-sheet__head')).toHaveClass('gk-cut--self');
    rerender(<NowLine entries={entries({ threads: [thread('transfer', 60_000), thread('incoming', 3_600_000)] })} now={NOW} {...closed()} open />);
    sheet = screen.getByRole('dialog', { name: 'Timers' });
    expect(sheet.querySelector('.gk-sheet__head')).toHaveClass('gk-cut--hostile');
  });

  it.each([
    ['fleet', 'fleet-1', 'Your fleet'],
    ['probe', 'probe-1', 'Your probe'],
  ] as const)('focuses an owned %s from the timers sheet', async (kind, id, title) => {
    const onFocus = vi.fn();
    const onClose = vi.fn();
    render(<NowLine entries={entries({ threads: [flying(kind, id, 600_000)] })}
      now={NOW} {...closed()} open onClose={onClose} onFocus={onFocus} />);
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Timers' })).getByRole('button', { name: new RegExp(title, 'i') }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onFocus).toHaveBeenCalledWith({ kind: 'thread', key: id });
  });

  it('focuses an owned drill and leaves a build timer as plain information', async () => {
    const onFocus = vi.fn();
    render(<NowLine entries={entries({ runs: [drill], builds: [refinery] })}
      now={NOW} {...closed()} open onFocus={onFocus} />);
    const sheet = screen.getByRole('dialog', { name: 'Timers' });
    await userEvent.click(within(sheet).getByRole('button', { name: /your drills/i }));
    expect(onFocus).toHaveBeenCalledWith({ kind: 'run', id: 'run-1' });
    expect(within(sheet).queryByRole('button', { name: /alloy refinery/i })).toBeNull();
  });

  it('only offers an incoming craft when the galaxy can see its contact', async () => {
    const incoming = { ...thread('incoming', 600_000), contactId: 'mission-9' };
    const onFocus = vi.fn();
    const hidden = render(<NowLine entries={entries({ threads: [incoming] })}
      now={NOW} {...closed()} open onFocus={onFocus} />);
    let sheet = screen.getByRole('dialog', { name: 'Timers' });
    expect(within(sheet).queryByRole('button', { name: /Inbound/ })).toBeNull();

    hidden.rerender(<NowLine entries={entries({ threads: [incoming], contacts: [visibleContact] })}
      now={NOW} {...closed()} open onFocus={onFocus} />);
    sheet = screen.getByRole('dialog', { name: 'Timers' });
    await userEvent.click(within(sheet).getByRole('button', { name: /Inbound/ }));
    expect(onFocus).toHaveBeenCalledWith({ kind: 'contact', id: 'mission-9' });
  });
});
