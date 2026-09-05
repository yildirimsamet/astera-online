import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PIRATE, type Fleet } from '@astera/rules';
import { PirateFocus } from '../src/galaxy/FocusPanel.js';
import type { PirateContact } from '../src/api/schemas.js';

/**
 * THE PIRATE RAIL. D150.
 *
 * The rail's job is to DESCRIBE the target and offer the commitment — the same
 * shape `PlanetFocus` has, and the same shape `AsteroidFocus` has: something is
 * passing through, it is worth something, it will not be there later.
 *
 * IT USED TO BE THE COMMITMENT SURFACE AS WELL, and that is what changed. It
 * carried its own fleet picker, its own fuel line and its own send button — a
 * second, thinner copy of `LaunchSheet` that had lost the hull stats, the cargo,
 * the hangar, the ships already away and the confirmation step. The picker moved
 * to the sheet the whole game already uses; what stays here is what only the rail
 * can say.
 *
 * D124 IS STILL THE STANDARD FOR THAT HALF. The level, the damage handicap, the
 * deadline and the rendezvous exist nowhere else in the interface — if any of them
 * is missing, a commander is being asked to price a fight blind and the system is
 * a lottery rather than a decision.
 */

const identified = (over: Partial<PirateContact> = {}): PirateContact => ({
  id: 'mJtQH0vR5cP8sN2xK7dL4A',
  callsign: 'mJtQ',
  zone: 'IDENTIFIED',
  at: { x: 100, y: 0, z: 0 },
  expiresInMinutes: 180,
  reachMinutes: 12,
  reach: [
    { hull: 'DART', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } },
    { hull: 'COURIER', minutes: 20, distance: 900, at: { x: 900, y: 0, z: 0 } },
    { hull: 'RAMPART', minutes: 40, distance: 900, at: { x: 900, y: 0, z: 0 } },
  ],
  level: 3,
  fleet: { TEMPEST: 1, DART: 2 },
  damageMult: PIRATE.damageMult[3],
  mass: 'MEDIUM',
  ...over,
});

const panel = (
  pirate: PirateContact,
  fleetAtHome: Fleet,
  onAttack = vi.fn(),
  over: { raiding?: boolean } = {},
) => {
  const result = render(
    <PirateFocus
      pirate={pirate}
      fleetAtHome={fleetAtHome}
      onClose={vi.fn()}
      onAttack={onAttack}
      raiding={over.raiding ?? false}
      open
      onToggle={vi.fn()}
    />,
  );
  return { ...result, onAttack };
};

describe('the pirate rail', () => {
  it('states the damage handicap as a number, not as a vibe', () => {
    panel(identified(), { DART: 10 });
    // 0.75 at level 3 → "25% less damage". The exact figure, because the whole
    // point of publishing it is that the player can price the fight against it.
    expect(screen.getByText(/25/)).toBeTruthy();
  });

  /**
   * THE BEST CASE THIS WORLD COULD MANAGE, and it is labelled as one.
   *
   * The rail quotes the soonest rendezvous anything standing here could keep; the
   * SHEET quotes the exact minute for the wing actually picked, because that is
   * where the choice is made. Two surfaces, two questions — "could I reach it at
   * all" and "when will THIS fleet get there".
   */
  it('quotes the soonest rendezvous this world could keep', () => {
    panel(identified(), { DART: 10, RAMPART: 4 });
    expect(screen.getAllByText(/12m/).length).toBeGreaterThan(0);
  });

  it('names the crew it can actually see', () => {
    panel(identified(), { DART: 10 });
    expect(screen.getByTitle(/Tempest/i)).toBeTruthy();
    expect(screen.getByText(/mJtQ/)).toBeTruthy();
  });

  it('says nothing about a crew it cannot see', () => {
    /*
      A Radar contact is a question mark. Level, roster and handicap are the
      Telescope's product and this rail may not invent any of them — a panel that
      filled in a plausible level would be the interface claiming sight it does not
      have, which is the one thing the fog may never do.
    */
    panel(
      { ...identified(), zone: 'CONTACT', level: undefined, fleet: undefined, damageMult: undefined },
      { DART: 10 },
    );
    expect(screen.queryByText(/25/)).toBeNull();
    expect(screen.queryByTitle(/Tempest/i)).toBeNull();
  });

  /**
   * THE COMMITMENT IS ONE TAP AWAY, AND IT IS THE GAME'S OWN COMMITMENT SURFACE.
   *
   * `LaunchSheet` — the same screen a raid on a world opens — carries the picker,
   * the hull stats, the cargo, the fuel against the tank and the confirmation. The
   * rail's only job is to open it.
   */
  it('opens the launch sheet rather than committing a fleet itself', async () => {
    const { onAttack } = panel(identified(), { DART: 7, COURIER: 2 });
    await userEvent.click(screen.getByRole('button', { name: /attack/i }));
    expect(onAttack).toHaveBeenCalledTimes(1);
    // The rail no longer decides what goes: it never had the stats to decide with.
    expect(screen.queryByRole('textbox', { name: /How many Dart/i })).toBeNull();
  });

  it('will not offer a launch from a world with nothing standing on it', async () => {
    const { onAttack } = panel(identified(), {});
    const refusal = screen.getByRole('button', { name: /No ships at home/i });
    expect(refusal).toHaveProperty('disabled', true);
    await userEvent.click(refusal);
    expect(onAttack).not.toHaveBeenCalled();
  });

  /** A Prospector cannot fly an attack, so a world holding only miners has none. */
  it('counts only hulls that can actually fly an attack', () => {
    panel(identified(), { PROSPECTOR: 3 });
    expect(screen.getByRole('button', { name: /No ships at home/i }))
      .toHaveProperty('disabled', true);
  });

  it('says a raid is already out rather than offering a second one', () => {
    panel(identified(), { DART: 10 }, vi.fn(), { raiding: true });
    expect(screen.queryByRole('button', { name: /attack/i })).toBeNull();
    expect(screen.getByText(/already has a raid/i)).toBeTruthy();
  });

  /**
   * A PIRATE OUT OF SIGHT IS STILL A TARGET. D160.
   *
   * No circle is covering it, so the rail says exactly that — and then offers the
   * launch anyway, because that is the whole point of remembering it. What the line
   * must NOT claim is that the figures are stale: they are the lane's current state,
   * on the same terms a discovered rock reports its remaining ore.
   */
  it('offers the raid on a remembered pirate, and says it is out of sight', () => {
    const { onAttack } = panel(identified({ remembered: true }), { DART: 10 });
    expect(screen.getByText(/not on your sensors now/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /attack/i })).toHaveProperty('disabled', false);
    expect(onAttack).not.toHaveBeenCalled();
  });

  /** And a pirate a circle IS covering is never marked out of sight. */
  it('says nothing about sensors while a circle is covering it', () => {
    panel(identified(), { DART: 10 });
    expect(screen.queryByText(/not on your sensors now/i)).toBeNull();
  });

  /** The deadline is the reason to hurry, so it leads and it turns red near the end. */
  it('states the deadline, and marks it when it is nearly up', () => {
    const { unmount } = panel(identified({ expiresInMinutes: 180 }), { DART: 10 });
    expect(screen.getAllByText(/3h/).length).toBeGreaterThan(0);
    unmount();

    panel(identified({ expiresInMinutes: 12 }), { DART: 10 });
    expect(document.querySelector('.text-threat')).toBeTruthy();
  });
});
