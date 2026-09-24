import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { combatValue, garrisonOf } from '@astera/rules';
import { DefenceReadings, PlanetHero } from '../src/ui/PlanetHero.js';
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
 *
 * IT LEADS THE DEFENCE TAB (E5). The Base's hero is the world and its production, as
 * the mock draws it; what stands on the world, and what a raid could take from it,
 * is the question the Defence tab answers, so the readings open it.
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
    render(<DefenceReadings planet={armed} />);
    expect(screen.getByText('Firepower')).toBeInTheDocument();
    expect(screen.getByTestId('planet-firepower'))
      .toHaveTextContent(full(combatValue(garrisonOf(armed.fleet, armed.ground))));
  });

  it('does not grow with the ore waiting in the store', () => {
    const rich = planetView({ fleet: { DART: 4 } }, { alloy: 90_000, crystal: 40_000 });
    const poor = planetView({ fleet: { DART: 4 } }, { alloy: 10, crystal: 10 });
    const { unmount } = render(<DefenceReadings planet={rich} />);
    const high = screen.getByTestId('planet-firepower').textContent;
    unmount();
    render(<DefenceReadings planet={poor} />);
    expect(screen.getByTestId('planet-firepower').textContent).toBe(high);
  });

  it('is not on the world’s hero, which carries production', () => {
    render(<PlanetHero planet={armed} />);
    expect(screen.queryByTestId('planet-firepower')).toBeNull();
  });
});

describe('the defence verdict states what stands, never a judgement it cannot make', () => {
  /** "Held" against what? Five guns were "Held" in every era of every season. */
  it('never calls a line thin or held', () => {
    render(<DefenceReadings planet={planetView({ ground: { THORN: 9 } })} />);
    expect(screen.getByTestId('planet-defence').textContent).not.toMatch(/Thin|Held/);
    expect(screen.getByTestId('planet-defence')).toHaveTextContent('9 guns');
  });

  it('says None when nothing on the world can fire', () => {
    render(<DefenceReadings planet={planetView({ fleet: { ATLAS: 2 } })} />);
    expect(screen.getByTestId('planet-defence')).toHaveTextContent('None');
  });

  it('counts ships and guns that fire, and the transports that stand in the line', () => {
    render(<DefenceReadings planet={armed} />);
    const defence = screen.getByTestId('planet-defence');
    expect(defence).toHaveTextContent('4 ships · 3 guns');
    expect(defence).toHaveTextContent('2 transports in the line');
  });
});

/**
 * WHAT A RAID COULD TAKE, BESIDE WHAT WOULD STOP IT. The Store's "exposed" figure
 * left the hero with the bars; it answers the same question as the line and the
 * Aegis — is this world worth hitting — so it stands with them.
 */
describe('the exposed store stands with the defence', () => {
  it('states the ore outside the Vault, in the colour of a gap', () => {
    render(<DefenceReadings planet={planetView({}, { alloy: 900, crystal: 300, deuterium: 0, vaultFloor: 600 })} />);
    const exposed = screen.getByTestId('planet-exposed');
    expect(exposed).toHaveTextContent('600 exposed');
    expect(exposed.querySelector('.text-v2-warn')).not.toBeNull();
  });

  it('reads as covered when the Vault holds it all', () => {
    render(<DefenceReadings planet={planetView({}, { alloy: 100, crystal: 50, deuterium: 0, vaultFloor: 600 })} />);
    const exposed = screen.getByTestId('planet-exposed');
    expect(exposed).toHaveTextContent('0 exposed');
    expect(exposed.querySelector('.text-v2-self')).not.toBeNull();
  });
});
