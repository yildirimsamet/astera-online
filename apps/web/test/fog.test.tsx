import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { galaxySchema } from '../src/api/schemas.js';
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
