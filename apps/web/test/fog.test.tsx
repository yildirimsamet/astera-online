import { cleanup, render, screen } from '@testing-library/react';
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
          coreLevel: 5,
          intel: 'RESOLVED' as const,
          state: { kind: 'NORMAL' as const },
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
    const parsed = trafficSchema.parse({ contacts: [contact({ fleet: { WASP: 12, LANCE: 3 } })] });
    expect(parsed.contacts[0]!.route).toBeUndefined();
    expect(parsed.contacts[0]!.minutesRemaining).toBeUndefined();
    expect(parsed.contacts[0]!.fleet).toEqual({ WASP: 12, LANCE: 3 });
  });

  it('keeps a blind engagement effect-only, with no craft disclosure to render', () => {
    const now = Date.now();
    const parsed = trafficSchema.parse({
      contacts: [
        contact({
          kind: 'unknown',
          from: { x: 600, y: 0, z: 0 },
          to: { x: 600, y: 0, z: 0 },
          effectOnly: true,
          engagement: {
            arriveAt: new Date(now).toISOString(),
            endsAt: new Date(now + 10_000).toISOString(),
            target: { x: 600, y: 0, z: 0 },
          },
        }),
      ],
    });
    const [battle] = parsed.contacts;
    expect(battle?.effectOnly).toBe(true);
    expect(battle?.mass).toBeUndefined();
    expect(battle?.silhouette).toBeUndefined();
    expect(battle?.from).toEqual(battle?.to);
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
    mass: 'MEDIUM',
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

  it('states an early Radar threat in words without inventing an arrival time', () => {
    show(contact({ kind: 'unknown', mass: undefined, inbound: true }));
    expect(screen.getByText(/this contact is coming for you/i)).toBeInTheDocument();
    expect(screen.getByText(/aimed at you · no arrival time/i)).toBeInTheDocument();
    expect(screen.getByText(/arrival time is delivered separately/i)).toBeInTheDocument();
    expect(screen.queryByText(/arrives in \d/i)).not.toBeInTheDocument();
  });

  it('does not claim an unidentified contact has a readable craft type or size', () => {
    show(contact({ kind: 'unknown', mass: undefined }));
    expect(screen.getByText(/movement only/i)).toBeInTheDocument();
    expect(screen.queryByText(/identify the craft type/i)).not.toBeInTheDocument();
  });

  /**
   * RADAR L5 NAMES THE KIND, AND THE PANEL SAYS WHERE THAT CAME FROM.
   *
   * The top of the radar ladder pays out on ordinary traffic, not only on a raid
   * aimed at you. It must not read as SIGHT: the heading stays "Unidentified" and
   * the line names the instrument, because a panel that presented a radar return
   * as a look would be claiming an instrument the caller does not have.
   */
  it('names the kind a maxed Radar read, without claiming to see it', () => {
    show(contact({ kind: 'unknown', mass: undefined, silhouette: 'probe' }));
    expect(screen.getByText(/radar reads it as a probe/i)).toBeInTheDocument();
    expect(screen.getByText(/^unidentified$/i)).toBeInTheDocument();
    // Still no roster, and still no clock.
    expect(screen.queryByText(/arrives in \d/i)).not.toBeInTheDocument();
  });

  it('says nothing about the kind when the Radar has not earned it', () => {
    show(contact({ kind: 'unknown', mass: undefined }));
    expect(screen.queryByText(/radar reads it as/i)).not.toBeInTheDocument();
  });

  it('never renders a figure that could be mistaken for an ETA', () => {
    const { container } = show(contact());
    // No "12m", "1h 04m" or "2d 3h" anywhere in the panel.
    expect(container.textContent).not.toMatch(/\d+\s*(m\b|h\b|d\b)/);
  });

  /** Radar remains an estimate until Telescope sight supplies a manifest. */
  it('states the Radar size and never invents a hull', () => {
    const { container } = show(contact());
    expect(screen.getByText(/sizeable force/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/wasp/i);
    expect(container.textContent).toMatch(/no manifest at this range/i);
  });

  it('lists exact hulls and total craft when Telescope sight supplies a manifest', () => {
    const { container } = show(contact({ fleet: { WASP: 12, LANCE: 3 } }));
    expect(screen.getByText(/15 craft/i)).toBeInTheDocument();
    expect(container.textContent).toMatch(/12 Wasp/i);
    expect(container.textContent).toMatch(/3 Lance/i);
    expect(container.textContent).not.toMatch(/no manifest at this range/i);
  });

  it('reads a committed fleet as heavier, and a scout party as lighter', () => {
    show(contact({ mass: 'HEAVY' }));
    expect(screen.getByText(/heavy force/i)).toBeInTheDocument();
    cleanup();
    show(contact({ mass: 'LIGHT' }));
    expect(screen.getByText(/light contact/i)).toBeInTheDocument();
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
    expect(container.textContent).toMatch(/who wins are not/i);
  });

  it('is unchanged for a probe, which carries no clock either', () => {
    show(contact({ kind: 'probe', mass: undefined }));
    expect(screen.getByText(/arrival unknown/i)).toBeInTheDocument();
    expect(screen.getByText(/unattributed/i)).toBeInTheDocument();
  });

  /** The drill is the stated exception: its clock is everyone's. D19. */
  it('still shows a mining run its clock, because that race is public', () => {
    show(contact({ kind: 'mining', craft: 3, minutesRemaining: 12, mass: undefined }));
    expect(screen.queryByText(/arrival unknown/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('12m').length).toBeGreaterThan(0);
  });
});
