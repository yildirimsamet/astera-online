import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AsteroidFocus, DebrisFocus } from '../src/galaxy/FocusPanel.js';

/**
 * HOW MANY CRAFT GO, AND WHO DECIDES.
 *
 * Both panels used to send `worthSending` — everything at home, capped at what the
 * target could absorb — with no way to say otherwise. That silently spent the whole
 * squadron on the first thing tapped: a player who wanted one Prospector on a rock
 * and one on a wreck field could not do it, because the rock took all three and the
 * field was then unreachable until they came home.
 *
 * The default is unchanged, so the common case is still one tap. What is new is
 * that the default can be overridden, and these assertions are about the override
 * being real — the number on the button, the number in the callback, and the
 * clamping, all agreeing.
 */

const ROCK = {
  index: 7,
  level: 3,
  ore: 40_000,
  oreRemaining: 40_000,
  crystalShare: 0.4,
  radius: 400,
  period: 30,
  phase: 0.2,
  y: 0,
  speed: 9.2,
  appearsAt: 0,
  expiresAt: 999,
};

const FIELD = { id: 'f1', alloy: 9_000, crystal: 3_000, minutesLeft: 120 };

const shell = {
  onClose: vi.fn(),
  busy: false,
  open: true,
  onToggle: vi.fn(),
};

const rockPanel = (craftAvailable: number, onSend: (n: number) => void) =>
  render(
    <AsteroidFocus
      rock={ROCK}
      craftAvailable={craftAvailable}
      craftHold={300}
      derrick={false}
      derrickHold={780}
      minutesLeft={400}
      reachMinutes={12}
      worksRoom={100_000}
      run={undefined}
      onSend={onSend}
      {...shell}
    />,
  );

const wreckPanel = (craftAvailable: number, onSend: (n: number) => void) =>
  render(
    <DebrisFocus
      field={FIELD}
      planetName="Kestrel-12"
      craftAvailable={craftAvailable}
      craftHold={300}
      reachMinutes={9}
      worksRoom={100_000}
      run={undefined}
      onSend={onSend}
      {...shell}
    />,
  );

/** The picker's own buttons: one per craft the planet has at home. */
const options = (): HTMLElement[] =>
  screen.getAllByRole('button').filter((b) => /^[1-9]$/.test(b.textContent.trim()));

const sendButton = (): HTMLElement => screen.getByRole('button', { name: /^Send \d/ });

describe.each([
  ['an asteroid', rockPanel],
  ['a wreck field', wreckPanel],
])('choosing how many craft to send at %s', (_name, panel) => {
  it('offers one option per craft at home', () => {
    panel(3, vi.fn());
    expect(options().map((b) => b.textContent.trim())).toEqual(['1', '2', '3']);
  });

  /**
   * ONE CRAFT IS NOT A CHOICE. Showing a picker with a single option is a control
   * that cannot do anything, which is worse than no control at all.
   */
  it('does not offer a choice when there is only one craft', () => {
    panel(1, vi.fn());
    expect(options()).toHaveLength(0);
    expect(sendButton()).toHaveTextContent('Send 1');
  });

  it('sends the number that was chosen, not everything at home', async () => {
    const onSend = vi.fn();
    panel(3, onSend);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '1' }));
    expect(sendButton()).toHaveTextContent('Send 1');

    await user.click(sendButton());
    expect(onSend).toHaveBeenCalledWith(1);
  });

  it('marks the chosen option, so the state is visible before committing', async () => {
    panel(3, vi.fn());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '2' }));

    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-pressed', 'false');
  });

  /** The default is still the sensible one — the change adds a choice, not a chore. */
  it('starts on a real default and can be sent without touching the picker', async () => {
    const onSend = vi.fn();
    panel(3, onSend);
    const user = userEvent.setup();
    await user.click(sendButton());
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0]![0]).toBeGreaterThanOrEqual(1);
    expect(onSend.mock.calls[0]![0]).toBeLessThanOrEqual(3);
  });

  /**
   * The picker can never ask for craft that are not there. `PROSPECTOR.max` is
   * three, so this is a small list — but the clamp is what stops a stale choice
   * surviving a squadron leaving.
   */
  it('never offers more than are at home', () => {
    panel(2, vi.fn());
    expect(options().map((b) => b.textContent.trim())).toEqual(['1', '2']);
  });

  it('offers nothing at all with no craft at home', () => {
    panel(0, vi.fn());
    expect(options()).toHaveLength(0);
    expect(screen.getByRole('button', { name: /No .*at home/i })).toBeDisabled();
  });
});

/**
 * A target you are already working is not a target you can send more at — one run
 * per planet per rock, and per field (D19, D32). The picker must not appear there,
 * because it would offer a launch the server refuses with ALREADY_MINING.
 */
describe('a target already being worked', () => {
  const run = {
    id: 'r1',
    targetKind: 'asteroid' as const,
    asteroidIndex: 7,
    debrisFieldId: null,
    status: 'outbound' as const,
    craft: 2,
    departAt: new Date(),
    arriveAt: new Date(Date.now() + 600_000),
    homeAt: null,
    intercept: { x: 0, y: 0, z: 0 },
    minedAlloy: 0,
    minedCrystal: 0,
  };

  it('shows no picker on a rock you already have craft at', () => {
    render(
      <AsteroidFocus
        rock={ROCK}
        craftAvailable={3}
        craftHold={300}
        derrick={false}
        derrickHold={780}
        minutesLeft={400}
        reachMinutes={12}
        worksRoom={100_000}
        run={run}
        onSend={vi.fn()}
        {...shell}
      />,
    );
    expect(options()).toHaveLength(0);
    expect(screen.getByText(/already working this rock/i)).toBeInTheDocument();
  });
});
