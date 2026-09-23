import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { matchupsAgainst, type ClassReading, type Fleet } from '@astera/rules';
import { matchupHint } from '../../src/lib/matchup.js';
import { MatchupLine } from '../../src/v2/kit/MatchupLine.js';

/**
 * THE COUNTER CYCLE, WHERE THE WING IS CHOSEN. Spec B6 (docs/ui-v2/gozlemevi.md).
 *
 * One line, class emblems on it: what the probe read of the wall, what to bring
 * against it, and what the reading left open. `matchupsAgainst` does the reading;
 * this only words it, with the launch sheet's own sentences.
 */

const lanceMajority: ClassReading = { kind: 'DOMINANT', cls: 'LANCE' };
const split: ClassReading = { kind: 'SHARES', shares: { LANCE: 60, BULWARK: 30, SKIRMISHER: 10 } };
const none: Fleet = {};

const wall = (container: HTMLElement): string =>
  container.querySelector('[data-matchup-wall]')?.textContent ?? '';

describe('the hint', () => {
  it('names the class to bring when the wing does not carry it', () => {
    expect(matchupHint(matchupsAgainst(none, lanceMajority)!)).toEqual({ kind: 'BRING', cls: 'BULWARK' });
  });

  it('warns a single-class wing that already carries it about the unread part', () => {
    expect(matchupHint(matchupsAgainst({ RAMPART: 10 }, lanceMajority)!)).toEqual({ kind: 'SINGLE' });
  });

  it('points a mixed reading at a stronger probe', () => {
    expect(matchupHint(matchupsAgainst(none, { kind: 'EVEN' })!)).toEqual({ kind: 'PROBE' });
  });

  it('says nothing when the wing already answers a fully read wall', () => {
    expect(matchupHint(matchupsAgainst({ RAMPART: 10, DART: 5 }, split)!)).toBeNull();
  });
});

describe('the matchup line', () => {
  it('reads a majority as a floor and says the rest is open', () => {
    const { container } = render(<MatchupLine wing={none} reading={lanceMajority} />);
    expect(wall(container)).toBe('Mostly Lance — more than half · Bring Bulwark · the remainder is unread and may counter you');
    expect(container.querySelector('[data-class="LANCE"] svg')).not.toBeNull();
    expect(container.querySelector('[data-class="BULWARK"] svg')).not.toBeNull();
  });

  it('reads an even wall as having no single counter', () => {
    const { container } = render(<MatchupLine wing={none} reading={{ kind: 'EVEN' }} />);
    expect(wall(container)).toBe('Mixed defence — no single hard counter · a probe two Shipyard levels up reveals the split');
  });

  it('reads a full split class by class, dropping none of them', () => {
    const { container } = render(<MatchupLine wing={none} reading={split} />);
    expect(wall(container)).toBe('Read split · Lance 60% · Bulwark 30% · Skirmisher 10% · Bring Bulwark');
  });

  it('leaves a class the probe measured at nothing off the wall', () => {
    const { container } = render(
      <MatchupLine wing={none} reading={{ kind: 'SHARES', shares: { LANCE: 70, BULWARK: 30, SKIRMISHER: 0 } }} />,
    );
    expect(wall(container)).toContain('Lance 70% · Bulwark 30%');
    expect(container.querySelector('[data-class="SKIRMISHER"]')).toBeNull();
  });

  it('says why an unread wall is unread', () => {
    const { container } = render(<MatchupLine wing={none} reading={{ kind: 'UNREAD' }} />);
    expect(wall(container)).toBe('Shape of the wall not read · Their Veil is stronger than the Shipyard that sent the probe.');
  });

  it('draws nothing without a reading, or over a wall with nothing that fires', () => {
    expect(render(<MatchupLine wing={none} reading={undefined} />).container.innerHTML).toBe('');
    expect(render(<MatchupLine wing={none} reading={{ kind: 'NONE' }} />).container.innerHTML).toBe('');
  });

  it('says what each class the wing carries meets there', () => {
    const { container } = render(<MatchupLine wing={{ RAMPART: 10 }} reading={lanceMajority} />);
    expect(container.querySelector('[data-matchup-wing]')?.textContent).toBe('Bulwark strong 50% · weak 0%');
    expect(wall(container)).toContain('Your wing is single-class — its counter may be in the unread part');
  });
});
