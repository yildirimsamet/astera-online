import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PIRATE, type Fleet } from '@astera/rules';
import { PirateFocus } from '../src/galaxy/FocusPanel.js';
import type { PirateContact } from '../src/api/schemas.js';

/**
 * THE PIRATE RAIL. D150.
 *
 * The rail is where the whole feature becomes usable, and D124 is the standard it
 * has to meet: a rule the player cannot SEE is not a rule. The level, the damage
 * handicap, the deadline and the rendezvous all exist nowhere else in the
 * interface — if any of them is missing here, a commander is being asked to price
 * a fight blind and the system is a lottery rather than a decision.
 */

const identified = (over: Partial<PirateContact> = {}): PirateContact => ({
  id: 'mJtQH0vR5cP8sN2xK7dL4A',
  callsign: 'mJtQ',
  zone: 'IDENTIFIED',
  at: { x: 100, y: 0, z: 0 },
  expiresInMinutes: 180,
  reachMinutes: 12,
  reach: [
    { hull: 'DART', minutes: 12, distance: 900 },
    { hull: 'COURIER', minutes: 20, distance: 900 },
    { hull: 'RAMPART', minutes: 40, distance: 900 },
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
  onSend = vi.fn(),
  over: { deuterium?: number; bays?: number } = {},
) => {
  const result = render(
    <PirateFocus
      pirate={pirate}
      fleetAtHome={fleetAtHome}
      deuteriumAtHome={over.deuterium ?? 1_000_000}
      baysFree={over.bays ?? 3}
      onClose={vi.fn()}
      onSend={onSend}
      busy={false}
      raiding={false}
      open
      onToggle={vi.fn()}
    />,
  );
  return { ...result, onSend };
};

describe('the pirate rail', () => {
  it('states the damage handicap as a number, not as a vibe', () => {
    panel(identified(), { DART: 10 });
    // 0.75 at level 3 → "25% less damage". The exact figure, because the whole
    // point of publishing it is that the player can price the fight against it.
    expect(screen.getByText(/25/)).toBeTruthy();
  });

  it('quotes the flight time of the SLOWEST ship the player is sending', () => {
    /*
      A fleet flies at its slowest hull, so a Rampart in the selection changes the
      rendezvous — and it has to change the number on the button BEFORE the launch,
      or the player learns the rule by being refused.
    */
    const first = panel(identified(), { DART: 10 });
    expect(screen.getByRole('button', { name: /Send 10 · 12m/ })).toBeTruthy();
    first.unmount();

    panel(identified(), { RAMPART: 4 });
    expect(screen.getByRole('button', { name: /Send 4 · 40m/ })).toBeTruthy();
  });

  it('refuses a rendezvous that lands after the pirate has gone', async () => {
    const { onSend } = panel(
      identified({ expiresInMinutes: 5, reach: [{ hull: 'DART', minutes: 30, distance: 900 }] }),
      { DART: 10 },
    );
    // The refusal is written on the control itself — a disabled button with no
    // sentence is a rule the player meets and cannot read.
    const refusal = screen.getByRole('button', { name: /leaves the area/i });
    expect(refusal).toHaveProperty('disabled', true);
    await userEvent.click(refusal);
    expect(onSend).not.toHaveBeenCalled();
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
  });

  it('will not offer a launch from a world with nothing standing on it', async () => {
    const { onSend } = panel(identified(), {});
    const refusal = screen.getByRole('button', { name: /No ships at home/i });
    expect(refusal).toHaveProperty('disabled', true);
    await userEvent.click(refusal);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('sends exactly what is standing at home when the player commits', async () => {
    const { onSend } = panel(identified(), { DART: 7, COURIER: 2 });
    // The Courier is the slow one, so the quote is its row and not the Dart's.
    const send = screen.getByRole('button', { name: /Send 9 · 20m/ });
    await userEvent.click(send);
    expect(onSend).toHaveBeenCalledWith({ DART: 7, COURIER: 2 });
  });

  it('says a raid is already out rather than offering a second one', () => {
    render(
      <PirateFocus
        pirate={identified()}
        fleetAtHome={{ DART: 10 }}
        deuteriumAtHome={1_000_000}
        baysFree={3}
        onClose={vi.fn()}
        onSend={vi.fn()}
        busy={false}
        raiding
        open
        onToggle={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Send/ })).toBeNull();
    expect(screen.getByText(/already has a raid/i)).toBeTruthy();
  });
});

describe('choosing what to send', () => {
  /*
    THE COMPLAINT THIS GUARDS, IN THE PLAYER'S WORDS.

    "I click send fleet and everything on my planet leaves. I should be able to
    pick my ships like the sheet that opens when I plan an attack on a planet."

    The rail defaulted to the whole garrison and offered no control to change it,
    so the default WAS the behaviour. Committing a fleet is the bet this game is
    built on — it may not be something that happens to a player.
  */
  it('sends only the ships the player chose', async () => {
    const user = userEvent.setup();
    const { onSend } = panel(identified(), { DART: 10, RAMPART: 4 });

    const darts = screen.getByRole('textbox', { name: /How many Dart/i });
    await user.clear(darts);
    await user.type(darts, '3');
    // Three Darts plus the four Ramparts left at their default; the wing flies at
    // the Rampart's speed, so the quote is the slow one.
    await user.click(screen.getByRole('button', { name: /Send 7 · 40m/ }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0]![0]).toEqual({ DART: 3, RAMPART: 4 });
  });

  it('offers a control for every hull standing at the world', () => {
    panel(identified(), { DART: 10, RAMPART: 4 });
    expect(screen.getByRole('textbox', { name: /How many Dart/i })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /How many Rampart/i })).toBeTruthy();
  });

  it('says what the world keeps, in power rather than in hull count', () => {
    // D144: a garrison is measured in POWER — the bet is what leaves carved out
    // of what holds, and a count cannot say a world kept its Bulwarks.
    panel(identified(), { DART: 10, RAMPART: 4 });
    expect(screen.getByText(/savunma gücü|Defence left/i)).toBeTruthy();
  });
});

describe('quoting the rendezvous', () => {
  /*
    THE BUG THIS GUARDS.

    `reach` carries the world's Beacon and the commander's Propulsion; the panel
    only knows the catalogue. It used to match a raw catalogue speed against those
    effective figures by nearest absolute difference — so any Propulsion at all
    picked the wrong ship's row, and because an UNREACHABLE speed is left out of
    the table entirely the match slid onto a faster hull's row: the panel quoted an
    ETA, enabled Send, and `launchPirateRaid` refused with CANNOT_INTERCEPT.
  */
  it('reads the row for the slowest hull selected, not the nearest speed', () => {
    panel(identified(), { DART: 10, RAMPART: 4 });
    // Rampart is slowest, so its forty minutes is the quote — never the Dart's twelve.
    expect(screen.getByRole('button', { name: /Send 14 · 40m/ })).toBeTruthy();
  });

  it('refuses when the slowest hull has no rendezvous at all', async () => {
    /*
      A hull the server could not solve for is absent from the table, and a fleet
      flies at its slowest ship — so this fleet cannot get there. Offering a launch
      the server will refuse is the failure; the refusal belongs on the button.
    */
    const { onSend } = panel(
      identified({ reach: [{ hull: 'DART', minutes: 12, distance: 900 }] }),
      { DART: 10, RAMPART: 4 },
    );
    const refusal = screen.getByRole('button', { name: /slowest ship cannot catch|en yavaş gemi/i });
    expect(refusal).toHaveProperty('disabled', true);
    await userEvent.click(refusal);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('states the fuel the round trip costs, and refuses when the tank is short', async () => {
    // D136: full fuel or no launch. Discovering that as a toast after committing
    // is the refusal-at-the-gate this panel exists to prevent.
    const { onSend } = panel(identified(), { DART: 10 }, vi.fn(), { deuterium: 0 });
    const refusal = screen.getByRole('button', { name: /deuterium|döteryum/i });
    expect(refusal).toHaveProperty('disabled', true);
    await userEvent.click(refusal);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('refuses with a reason when no flight bay is free', async () => {
    const { onSend } = panel(identified(), { DART: 10 }, vi.fn(), { bays: 0 });
    const refusal = screen.getByRole('button', { name: /flight bay|uçuş yatağı/i });
    expect(refusal).toHaveProperty('disabled', true);
    await userEvent.click(refusal);
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('what an unidentified contact may say', () => {
  it('prints no level at all rather than inventing level zero', () => {
    // The schema allows 1-4. `level ?? 0` put "Level 0 pirates" over a title that
    // said "Unidentified contact" in the same breath.
    panel(
      { ...identified(), zone: 'CONTACT', level: undefined, fleet: undefined, damageMult: undefined },
      { DART: 10 },
    );
    expect(screen.queryByText(/Level 0|Seviye 0/i)).toBeNull();
  });
});

describe('a selection the player made', () => {
  it('survives the planet view refetching, clamped but never reset', async () => {
    /*
      The panel re-defaulted to the whole garrison on every change to the home
      fleet, and that view refetches on a timer, on every SSE wake and after any
      mutation. Forty Darts cut down to six jumped silently back to forty.
    */
    const user = userEvent.setup();
    const { onSend, rerender } = panel(identified(), { DART: 40 });
    const darts = screen.getByRole('textbox', { name: /How many Dart/i });
    await user.clear(darts);
    await user.type(darts, '6');

    // The same world, re-rendered with a fresh object identity — one refetch.
    rerender(
      <PirateFocus
        pirate={identified()}
        fleetAtHome={{ DART: 40 }}
        deuteriumAtHome={1_000_000}
        baysFree={3}
        onClose={vi.fn()}
        onSend={onSend}
        busy={false}
        raiding={false}
        open
        onToggle={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Send 6 · 12m/ }));
    expect(onSend).toHaveBeenCalledWith({ DART: 6 });
  });

  /**
   * A DIFFERENT PIRATE IS A DIFFERENT DECISION.
   *
   * "Untouched" is a fact about ONE target, and the clamp above is what makes
   * getting that wrong expensive: once the panel believes the player has chosen,
   * it never offers the default again. Two pirates visible from the same world
   * share a `fleetAtHome` — identical, and the same object out of the query cache
   * — so nothing in the reset's dependencies changes when the focus moves from one
   * to the other, and the second target opened holding the first one's selection
   * with the choice already marked as made.
   *
   * What the player then sees is a committed number they never picked, on the last
   * screen before a launch that cannot be recalled and at a target that shoots
   * back. The default is "everything at home" for a reason, and every target is
   * owed it once.
   */
  it('returns to the default when the focus moves to another pirate', async () => {
    const user = userEvent.setup();
    const { onSend, rerender } = panel(identified(), { DART: 40 });
    const darts = screen.getByRole('textbox', { name: /How many Dart/i });
    await user.clear(darts);
    await user.type(darts, '6');
    expect(screen.getByRole('button', { name: /Send 6 · 12m/ })).toBeTruthy();

    // The player taps a second pirate on the disc. Same world, same garrison.
    rerender(
      <PirateFocus
        pirate={identified({ id: 'A7bC2dE9fG4hJ6kL8mN0pQ', callsign: 'A7bC' })}
        fleetAtHome={{ DART: 40 }}
        deuteriumAtHome={1_000_000}
        baysFree={3}
        onClose={vi.fn()}
        onSend={onSend}
        busy={false}
        raiding={false}
        open
        onToggle={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Send 40 · 12m/ }));
    expect(onSend).toHaveBeenCalledWith({ DART: 40 });
  });
});
