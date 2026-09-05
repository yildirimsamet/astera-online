import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Contact, MiningRun, PendingThread } from '../src/api/schemas.js';
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
let contacts: Contact[] = [];

vi.mock('../src/api/queries.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../src/api/queries.js');
  return {
    ...actual,
    usePending: () => ({ data: { pending: rows } }),
    useMining: () => ({ data: { runs } }),
    useTraffic: () => ({ data: { contacts } }),
  };
});

/** The one contact shape this file needs: an id, a bearing window and a kind. */
const contact = (over: Partial<Contact> = {}): Contact => ({
  id: 'mission-9',
  kind: 'unknown',
  from: { x: 0, y: 0, z: 0 },
  to: { x: 1, y: 0, z: 1 },
  startAt: new Date(Date.now() - 30_000),
  endAt: new Date(Date.now() + 30_000),
  inbound: true,
  ...over,
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
  asteroidId: 'mJt7YvxMZEC5S7yYQ32SYw',
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
  onFocus?: (
    focus:
      | { kind: 'thread'; key: string }
      | { kind: 'run'; id: string }
      | { kind: 'contact'; id: string },
  ) => void,
  seen: Contact[] = [],
) => {
  rows = pending;
  runs = miningRuns;
  contacts = seen;
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

  /**
   * AND IT NAMES THE WORLD IT IS COMING FOR. D97/D134.
   *
   * A commander holds up to four worlds. "Inbound fleet · 6 min" does not say
   * where to move the garrison, and the target is the defender's OWN world — the
   * radar ladder sells the attacker's side, never this. It was simply absent.
   */
  it('names which of your worlds an inbound fleet is aimed at', () => {
    show([thread({ kind: 'incoming', targetPlanetId: 'w2', targetName: 'Kestrel-3' })]);
    expect(screen.getByText(/kestrel-3/i)).toBeInTheDocument();
  });

  /** And Radar L5's origin sits beside it rather than replacing it. */
  it('keeps the origin beside the world when the radar has earned one', () => {
    show([thread({
      kind: 'incoming', targetPlanetId: 'w2', targetName: 'Kestrel-3', originName: 'Vesper-1',
    })]);
    const row = screen.getByText(/kestrel-3/i);
    expect(row.textContent).toMatch(/vesper-1/i);
  });

  /**
   * A CLIENT AHEAD OF ITS SERVER STILL READS. The old build put the literal
   * sentence "inbound fleet" in `targetName`, so the world is printed only when
   * the id that proves it is a real world arrives with it.
   */
  it('falls back to the anonymous warning without a target id', () => {
    show([thread({ kind: 'incoming', targetName: 'inbound fleet' })]);
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('says so plainly when there is nothing in flight', () => {
    show([]);
    expect(screen.getByText(/nothing in flight/i)).toBeInTheDocument();
  });

  /** The reported bug: drills live in `mining.runs`, not in `pending`. */
  it('counts a drill as in flight when the mission list is empty', () => {
    show([], [run()]);
    expect(screen.queryByText(/nothing in flight/i)).not.toBeInTheDocument();
    expect(screen.getByText(/your drills.*asteroid/i)).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: /your drills.*asteroid/i }));
    expect(onFocus).toHaveBeenCalledWith({ kind: 'run', id: 'run-1' });
    expect(screen.queryByRole('dialog', { name: /in flight/i })).not.toBeInTheDocument();
  });

  /**
   * THE ROW A DEFENDER MOST WANTS TO PRESS. D162 — owner report.
   *
   * An inbound warning has no `path` and never will: a defender is not sold the
   * attacker's route at any radar level (D123). But the craft itself is often on
   * their disc — inside a radar circle as a question mark, inside a telescope one
   * as the fleet — and pressing the warning did nothing at all. The join is
   * `contactId`, which is the same key the contact list already publishes for that
   * craft.
   */
  it('focuses the inbound craft the disc is already drawing', async () => {
    const onFocus = vi.fn();
    show(
      [thread({
        kind: 'incoming',
        targetPlanetId: 'w2',
        targetName: 'Kestrel-3',
        contactId: 'mission-9',
      })],
      [],
      onFocus,
      [contact()],
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /open flights/i }));
    await user.click(screen.getByRole('button', { name: /kestrel-3/i }));
    expect(onFocus).toHaveBeenCalledWith({ kind: 'contact', id: 'mission-9' });
  });

  /**
   * AND NOT OTHERWISE. A warning whose craft is outside every circle has nothing
   * to look at, so the row stays a statement rather than becoming a control that
   * moves the camera to empty space — which is the fog being enforced by the
   * contact query, exactly where it belongs.
   */
  it('offers no focus when the inbound craft is on nobody\'s sensors', async () => {
    const onFocus = vi.fn();
    show(
      [thread({
        kind: 'incoming',
        targetPlanetId: 'w2',
        targetName: 'Kestrel-3',
        contactId: 'mission-9',
      })],
      [],
      onFocus,
      [],
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /open flights/i }));
    expect(screen.queryByRole('button', { name: /kestrel-3/i })).toBeNull();
    expect(onFocus).not.toHaveBeenCalled();
  });

  it('does not count completed mining rows as airborne', () => {
    show([], [run({ status: 'done' })]);
    expect(screen.getByText(/nothing in flight/i)).toBeInTheDocument();
  });
});

/**
 * WHICH WAY IT IS POINTING, AND HOW FAR IT HAS GOT. D142, owner instruction.
 *
 * "12m" is the same string for a fleet two minutes from a target and a fleet two
 * minutes from home carrying the loot, and those are opposite situations. The leg
 * says which — and the KIND of flight leads the row as a glyph, because a raid, a
 * probe, a transfer and a mining run were four sentences that differed only in
 * their wording.
 */
describe('the leg a craft is on', () => {
  const path = (from: number, to: number) => ({
    from: { x: 0, y: 0, z: 0 },
    to: { x: 10, y: 0, z: 10 },
    departAt: new Date(Date.now() - from * 60_000),
    arriveAt: new Date(Date.now() + to * 60_000),
  });

  const markLeft = (): number => Number.parseFloat(
    document.querySelector<HTMLElement>('[data-flight-mark]')!.style.left,
  );

  it('puts an almost-arrived craft near the far end', () => {
    show([thread({ path: path(9, 1) })]);
    expect(markLeft()).toBeGreaterThan(80);
  });

  it('puts a just-launched craft near home', () => {
    show([thread({ path: path(1, 9) })]);
    expect(markLeft()).toBeLessThan(20);
  });

  /**
   * A RETURNING CRAFT RUNS BACK TOWARD HOME. Drawing it left to right would put a
   * fleet carrying loot further from home the closer it got.
   */
  it('brings a returning craft back toward the solid end', () => {
    show([thread({ leg: 'return', path: path(9, 1) })]);
    expect(markLeft()).toBeLessThan(20);
  });

  /**
   * THE FOG, DRAWN AS FOG (D123). The server sends no `path` for an inbound
   * attack — its origin is what Radar L5 sells — so there is no honest position,
   * and the bar says it does not know rather than inventing one.
   */
  it('refuses to place an inbound fleet it cannot see', () => {
    show([thread({ kind: 'incoming', targetName: 'inbound fleet' })]);
    expect(document.querySelector('[data-flight-bar]')).toHaveAttribute('data-known', 'false');
  });

  it('knows where a mining run is on the leg it is actually flying', () => {
    show([], [run({
      status: 'returning',
      arriveAt: new Date(Date.now() - 9 * 60_000),
      homeAt: new Date(Date.now() + 1 * 60_000),
    })]);
    expect(document.querySelector('[data-flight-bar]')).toHaveAttribute('data-known', 'true');
    // Nearly home on the RETURN span, not nine minutes past an outbound arrival.
    expect(markLeft()).toBeLessThan(20);
  });

  it('leads each row with the glyph for what kind of flight it is', async () => {
    show([thread(), thread({ kind: 'probe' })]);
    await userEvent.setup().click(screen.getByRole('button', { name: /flights/i }));
    expect(document.querySelector('[data-flight-mark-kind="fleet"]')).toBeInTheDocument();
    expect(document.querySelector('[data-flight-mark-kind="probe"]')).toBeInTheDocument();
  });
});
