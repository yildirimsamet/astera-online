import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { galaxySchema, trafficSchema, type Contact } from '../src/api/schemas.js';
import { ContactFocus } from '../src/galaxy/FocusPanel.js';
import { Reading, Unwatched } from '../src/ui/Clarity.js';

/**
 * THE ONE LIE THIS UI IS NOT ALLOWED TO TELL.
 *
 * There are two different kinds of nothing in this game:
 *   UNKNOWN  — you looked, and their Veil beat your Telescope. Information.
 *   absent   — you are not watching them at all. Not information.
 *
 * The server already refuses to send a `fleet` key for a planet you do not watch;
 * these tests are the client half of that same guarantee. Collapsing the two
 * would tell a player they had checked when they never had.
 */
describe('the fog, as rendered', () => {
  it('parses a planet you do not watch with no fleet reading at all', () => {
    const parsed = galaxySchema.parse({
      you: { planetId: 'p1', playerId: 'pl1' },
      planets: [
        {
          id: 'p2',
          name: 'Grimhold',
          owner: 'Sable',
          position: { x: 0, y: 0, z: 0 },
          coreTier: 2,
          satellites: [],
          shielded: false,
          isSelf: false,
        },
      ],
    });

    expect(parsed.planets[0]!.fleet).toBeUndefined();
  });

  it('shows an unwatched planet as unwatched, never as unknown', () => {
    render(<Unwatched />);
    expect(screen.getByText(/no watch assigned/i)).toBeInTheDocument();
    expect(screen.queryByText(/unreadable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/UNKNOWN/)).not.toBeInTheDocument();
  });

  it('shows a veiled reading as unreadable — you looked and could not tell', () => {
    render(<Reading status="UNKNOWN" staleMinutes={0} etaMinutes={null} state="BLIND" />);
    expect(screen.getByText(/unreadable/i)).toBeInTheDocument();
    expect(screen.queryByText(/no watch assigned/i)).not.toBeInTheDocument();
  });

  /**
   * The interesting state. "HOME, 18 minutes ago" is a completely different bet
   * from "HOME, live", and dropping the age would erase the decision.
   */
  it('never shows a stale reading without its age', () => {
    render(<Reading status="HOME" staleMinutes={18} etaMinutes={null} state="INTERMITTENT" />);
    expect(screen.getByText(/FLEET HOME/)).toBeInTheDocument();
    expect(screen.getByText(/18m ago/)).toBeInTheDocument();
  });

  it('shows a live reading as live rather than as zero minutes ago', () => {
    render(<Reading status="AWAY" staleMinutes={0} etaMinutes={null} state="CLEAR" />);
    expect(screen.getByText(/live/)).toBeInTheDocument();
  });

  /** The return ETA is bought at clarity +2 and must not leak below it. */
  it('shows a return ETA only when the reading carries one', () => {
    const { rerender } = render(
      <Reading status="AWAY" staleMinutes={0} etaMinutes={24} state="FULL" />,
    );
    expect(screen.getByText(/back in 24m/)).toBeInTheDocument();

    rerender(<Reading status="AWAY" staleMinutes={0} etaMinutes={null} state="CLEAR" />);
    expect(screen.queryByText(/back in/)).not.toBeInTheDocument();
  });

  it('labels clarity for anyone who cannot see the bars', () => {
    render(<Reading status="HOME" staleMinutes={0} etaMinutes={null} state="DEGRADED" />);
    expect(screen.getByRole('img', { name: /clarity degraded/i })).toBeInTheDocument();
  });
});

/**
 * WHAT A CONTACT IS ALLOWED TO CARRY. D24.
 *
 * Other people's craft are visible now — real hulls, real positions, their own
 * neon — and the one thing that stayed private is where they came from and where
 * they are going. The server enforces that by omission, and this is the client
 * half of the same guarantee: the parsed shape has no field a route could be drawn
 * from, so a modified client has nothing to reach for.
 */
describe('traffic, as parsed', () => {
  const contact = (over: Record<string, unknown> = {}) => ({
    id: 'c1',
    kind: 'fleet',
    from: { x: 0, y: 0, z: 0 },
    to: { x: 100, y: 0, z: 0 },
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 60_000).toISOString(),
    ...over,
  });

  it('parses a fleet with no route and no clock on it', () => {
    const parsed = trafficSchema.parse({ contacts: [contact()] });
    expect(parsed.contacts[0]!.route).toBeUndefined();
    expect(parsed.contacts[0]!.minutesRemaining).toBeUndefined();
  });

  /** The kind is public — it is what decides the neon colour, and nothing else. */
  it('keeps the kind, because the neon says it out loud', () => {
    for (const kind of ['fleet', 'probe', 'mining'] as const) {
      expect(trafficSchema.parse({ contacts: [contact({ kind })] }).contacts[0]!.kind).toBe(kind);
    }
  });

  it('refuses a kind the renderer has no style for', () => {
    expect(() => trafficSchema.parse({ contacts: [contact({ kind: 'incoming' })] })).toThrow();
  });

  /** The drill is the stated exception: its leg and its clock are everyone's. */
  it('parses a mining run with its whole leg and its time left', () => {
    const parsed = trafficSchema.parse({
      contacts: [
        contact({
          kind: 'mining',
          route: {
            from: { x: 0, y: 0, z: 0 },
            to: { x: 400, y: 0, z: 0 },
            departAt: new Date().toISOString(),
            arriveAt: new Date(Date.now() + 600_000).toISOString(),
          },
          minutesRemaining: 9.5,
        }),
      ],
    });
    expect(parsed.contacts[0]!.route?.to).toEqual({ x: 400, y: 0, z: 0 });
    expect(parsed.contacts[0]!.minutesRemaining).toBe(9.5);
  });
});

/**
 * WHAT A CONTACT'S PANEL IS ALLOWED TO SAY.
 *
 * The parsing tests above prove the clock never arrives; these prove the interface
 * does not imply one anyway. Every other focus rail in the game — your fleet, your
 * probe, a mining run — puts a countdown on the right of the rail, and the pending
 * strip sits immediately below with another one. So a foreign fleet whose rail held
 * only a craft count was read as owning the strip's figure: the owner reported
 * "somebody else's fleet shows the countdown of the last craft I focused."
 *
 * The rail therefore names the absence in the slot where the clock would be. That
 * is the D24 boundary made visible rather than merely enforced.
 */
describe('a foreign contact, as rendered', () => {
  const contact = (over: Partial<Contact> = {}): Contact => ({
    id: 'c1',
    kind: 'fleet',
    from: { x: 0, y: 0, z: 0 },
    to: { x: 100, y: 0, z: 0 },
    startAt: new Date(),
    endAt: new Date(Date.now() + 60_000),
    fleet: { WASP: 8 },
    ...over,
  });

  const show = (c: Contact) =>
    render(
      <ContactFocus contact={c} open onToggle={() => undefined} onClose={() => undefined} />,
    );

  it('says the arrival is unknown rather than leaving the clock slot empty', () => {
    show(contact());
    expect(screen.getByText(/arrival unknown/i)).toBeInTheDocument();
    expect(screen.getByText(/^unknown$/i)).toBeInTheDocument();
  });

  it('never renders a figure that could be mistaken for an ETA', () => {
    const { container } = show(contact());
    // No "12m", "1h 04m" or "2d 3h" anywhere in the panel — the only numbers a
    // contact may carry are counts of craft.
    expect(container.textContent).not.toMatch(/\d+\s*(m\b|h\b|d\b)/);
    expect(screen.getByText(/8 craft/)).toBeInTheDocument();
  });

  /**
   * A BATTLE IS NOT TRAFFIC. D52.
   *
   * The engagement is public now, so the rail has to agree with the picture above
   * it: a squadron putting missiles into a world is not "somebody moving", and this
   * is the one moment a contact's clock IS known to everybody — because the fleet is
   * already standing on the world it is hitting.
   */
  it('says a raid is landing rather than that somebody is moving', () => {
    const now = Date.now();
    show(
      contact({
        engagement: {
          arriveAt: new Date(now),
          endsAt: new Date(now + 10_000),
          target: { x: 600, y: 0, z: 0 },
        },
      }),
    );
    expect(screen.getByText(/a raid is landing/i)).toBeInTheDocument();
    expect(screen.getByText(/under fire/i)).toBeInTheDocument();
    expect(screen.queryByText(/somebody is moving/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/arrival unknown/i)).not.toBeInTheDocument();
  });

  /** What it still does NOT say: whose it is, or who is going to win. */
  it('still withholds the attacker while the battle is on screen', () => {
    const now = Date.now();
    const { container } = show(
      contact({
        engagement: {
          arriveAt: new Date(now),
          endsAt: new Date(now + 10_000),
          target: { x: 600, y: 0, z: 0 },
        },
      }),
    );
    expect(container.textContent).toMatch(/whose it is/i);
    expect(container.textContent).toMatch(/neither is who wins/i);
  });

  it('is unchanged for a probe, which carries no clock either', () => {
    show(contact({ kind: 'probe', fleet: {} }));
    expect(screen.getByText(/arrival unknown/i)).toBeInTheDocument();
    expect(screen.getByText(/unattributed/i)).toBeInTheDocument();
  });

  /** The drill is the stated exception: its clock is everyone's. D19. */
  it('still shows a mining run its clock, because that race is public', () => {
    show(contact({ kind: 'mining', craft: 3, minutesRemaining: 12, fleet: undefined }));
    expect(screen.queryByText(/arrival unknown/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('12m').length).toBeGreaterThan(0);
  });
});
