import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { combatValue, garrisonOf } from '@astera/rules';
import { PlanetHero } from '../src/ui/PlanetHero.js';
import { full } from '../src/lib/format.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

/**
 * THE PLANET SHEET SAID "POWER" AND MEANT WEALTH. D199, owner report.
 *
 * *"Gezegen'ime tıklayınca açılan menüde gösterilen güç … hiç bir halt anlamıyor."*
 *
 * It was `wealth()`: buildings, instruments, satellites, ships at home, guns and the
 * STORE. So it dropped while a building was under construction (the cost leaves the
 * store before the level counts), dropped when the fleet flew, and grew while ore
 * sat waiting to be raided — teaching the opposite of every lesson the game has.
 * It ranks nothing and nobody else sees it.
 *
 * The sheet now states what an enemy probe measures about this world: the
 * firepower of its defending line. The one unit every force figure in the game is
 * written in, learnt from the one world the commander knows exactly.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const armed = planetView({
  fleet: { DART: 4, ATLAS: 2, PROSPECTOR: 1 },
  ground: { THORN: 3 },
});

describe('the planet sheet states the world’s own firepower', () => {
  it('reads the defending line in the unit a probe reads it in', () => {
    render(<PlanetHero planet={armed} compact />);
    expect(screen.getByText('Firepower')).toBeInTheDocument();
    expect(screen.getByTestId('planet-firepower'))
      .toHaveTextContent(full(combatValue(garrisonOf(armed.fleet, armed.ground))));
  });

  it('does not grow with the ore waiting in the store', () => {
    const rich = planetView({ fleet: { DART: 4 } }, { alloy: 90_000, crystal: 40_000 });
    const poor = planetView({ fleet: { DART: 4 } }, { alloy: 10, crystal: 10 });
    const { unmount } = render(<PlanetHero planet={rich} compact />);
    const high = screen.getByTestId('planet-firepower').textContent;
    unmount();
    render(<PlanetHero planet={poor} compact />);
    expect(screen.getByTestId('planet-firepower').textContent).toBe(high);
  });

  it('is the same figure on the full sheet', () => {
    render(<PlanetHero planet={armed} />);
    expect(screen.getByTestId('planet-firepower'))
      .toHaveTextContent(full(combatValue(garrisonOf(armed.fleet, armed.ground))));
  });
});

describe('the defence verdict states what stands, never a judgement it cannot make', () => {
  /** "Held" against what? Five guns were "Held" in every era of every season. */
  it('never calls a line thin or held', () => {
    render(<PlanetHero planet={planetView({ ground: { THORN: 9 } })} compact />);
    expect(screen.getByTestId('planet-defence').textContent).not.toMatch(/Thin|Held/);
    expect(screen.getByTestId('planet-defence')).toHaveTextContent('9 guns');
  });

  it('says None when nothing on the world can fire', () => {
    render(<PlanetHero planet={planetView({ fleet: { ATLAS: 2 } })} compact />);
    expect(screen.getByTestId('planet-defence')).toHaveTextContent('None');
  });

  it('counts ships and guns that fire, and the transports that stand in the line', () => {
    render(<PlanetHero planet={armed} compact />);
    const defence = screen.getByTestId('planet-defence');
    expect(defence).toHaveTextContent('4 ships · 3 guns');
    expect(defence).toHaveTextContent('2 transports in the line');
  });
});
