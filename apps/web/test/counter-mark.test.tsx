import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { COMBAT, HULLS } from '@astera/rules';
import { ClassChip, CounterCycle, CounterLine, MatchupMark } from '../src/ui/CounterMark.js';
import i18n from '../src/i18n/index.js';

/**
 * THE RULE THAT DECIDES EVERY FIGHT, ON THE SCREEN WHERE IT IS BET ON. D124.
 *
 * Before these components, `HullClass` appeared ZERO times in `apps/web/src`. The
 * counter multipliers were printed in exactly one place — `CombatFormula`, inside a
 * battle report — which taught a commander the single most important rule in the
 * game as a post-mortem, after the fleet was already gone.
 *
 * Worse than silence, the interface implied the opposite. Ships are banded by
 * FAMILY (Offensive · Defensive · Special · Cargo), a purchasing taxonomy that runs
 * at right angles to the combat one: Pike is Offensive, Rampart is Defensive, and
 * the Rampart beats the Pike. So the tests below check both that the relation is
 * shown and that it is shown as something OTHER than the family.
 *
 * NOTHING HERE MAY HARD-CODE A MULTIPLIER. Every expectation reads `COMBAT`, so a
 * balance pass that re-cuts `strongMult` moves the interface with it instead of
 * leaving a screen quietly teaching last season's rule.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('the class chip', () => {
  it('names the class and marks it for the surfaces that style by it', () => {
    render(<ClassChip cls="BULWARK" />);
    const chip = screen.getByTestId('class-chip');
    expect(chip).toHaveAttribute('data-class', 'BULWARK');
    expect(chip).toHaveTextContent('Bulwark');
  });

  /**
   * The class is NOT the family, and a Pike is the proof: Offensive in the
   * shipyard, Lance in a fight, and beaten by the "Defensive" Rampart.
   */
  it('says something the shipyard band does not', () => {
    render(<ClassChip cls={HULLS.PIKE.cls} />);
    expect(screen.getByTestId('class-chip')).toHaveAttribute('data-class', 'LANCE');
    expect(HULLS.PIKE.family).toBe('OFFENSIVE');
    expect(HULLS.RAMPART.family).toBe('DEFENSIVE');
  });

  it('carries a glyph, so the shape reads before the word does', () => {
    const view = render(<ClassChip cls="SKIRMISHER" />);
    expect(view.container.querySelector('svg')).not.toBeNull();
  });
});

describe('one hull against one known enemy class', () => {
  it('marks a strong match with the multiplier the resolver will apply', () => {
    render(<MatchupMark attacker="SKIRMISHER" defender="BULWARK" />);
    const mark = screen.getByTestId('matchup');
    expect(mark).toHaveAttribute('data-matchup', 'strong');
    expect(mark).toHaveTextContent(String(COMBAT.strongMult));
  });

  it('marks a weak match', () => {
    render(<MatchupMark attacker="LANCE" defender="BULWARK" />);
    const mark = screen.getByTestId('matchup');
    expect(mark).toHaveAttribute('data-matchup', 'weak');
    expect(mark).toHaveTextContent(String(COMBAT.weakMult));
  });

  it('marks an even match without pretending it is an advantage', () => {
    render(<MatchupMark attacker="LANCE" defender="LANCE" />);
    expect(screen.getByTestId('matchup')).toHaveAttribute('data-matchup', 'even');
  });

  /**
   * A SUPPORT HULL DOES NOT FIRE AT ALL — `counterMult` returns 0, not a weak
   * match. Drawing it as "weak" would tell a commander an Atlas contributes
   * something to a battle line, which is how a fleet arrives with no escort.
   */
  it('says a support hull has no attack rather than a bad one', () => {
    render(<MatchupMark attacker="SUPPORT" defender="LANCE" />);
    expect(screen.getByTestId('matchup')).toHaveAttribute('data-matchup', 'none');
  });
});

describe('what a hull beats and what beats it', () => {
  it('states both directions, because only one of them is the danger', () => {
    render(<CounterLine cls="SKIRMISHER" />);
    expect(screen.getByTestId('counter-strong')).toHaveTextContent('Bulwark');
    expect(screen.getByTestId('counter-weak')).toHaveTextContent('Lance');
  });

  it('gives support its own sentence instead of a rung it does not have', () => {
    render(<CounterLine cls="SUPPORT" />);
    expect(screen.queryByTestId('counter-strong')).toBeNull();
    expect(screen.queryByTestId('counter-weak')).toBeNull();
    expect(screen.getByTestId('counter-support')).toBeInTheDocument();
  });
});

describe('the cycle drawn whole', () => {
  it('draws all three rungs', () => {
    const view = render(<CounterCycle />);
    for (const cls of ['SKIRMISHER', 'BULWARK', 'LANCE']) {
      expect(view.container.querySelector(`[data-rung="${cls}"]`), cls).not.toBeNull();
    }
  });

  it('lights the rung it is asked to, so a hull sheet can point at its own', () => {
    const view = render(<CounterCycle highlight="LANCE" />);
    expect(view.container.querySelector('[data-rung="LANCE"]'))
      .toHaveAttribute('data-current', 'true');
    expect(view.container.querySelector('[data-rung="BULWARK"]'))
      .not.toHaveAttribute('data-current');
  });
});
