import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { FleetCards } from '../src/ui/FleetCards.js';
import { FLEET_FAMILY_ORDER } from '../src/lib/roster.js';
import { hullLabel } from '../src/i18n/names.js';

/**
 * WHAT THE COMMANDER OWNS, AS PICTURES, UNDER THE TWO VERDICTS. D170.
 *
 * REDESIGNED SMALLER AND FOLDED. Owner instruction: three to five hulls in each
 * band filled the sheet, so the block that was supposed to answer "what have I
 * got" at a glance had to be scrolled past instead. The card is gone — no plate,
 * no padding, no second line — and what is left is a 16px thumbnail, an 8px name
 * and the two figures, wrapped rather than gridded so a short name costs a short
 * chip. The bands fold on top of that, one open, the rest carrying their counts.
 *
 * The planet sheet said what stood on the ground and what the shield held, and
 * then stopped — a commander wanting to know what they actually FLY had to open
 * the fleet tab and read nineteen rows. The whole force is a fact about this
 * world, so it belongs on the world's own sheet, and it is DRAWN rather than
 * written because D142 is explicit: quantities a player must judge are drawn.
 *
 * THE SPLIT IS THE POINT. A hull count on its own answers nothing — six Darts
 * are a defence if they are standing here and an exposure if they are three hours
 * out. Home and away are therefore separate figures on the same card, never a
 * total the reader has to take apart.
 */

const fleet = { DART: 6, VIPER: 2, COURIER: 4 } as const;
const away = { DART: 2, COURIER: 4 } as const;

/** The fold remembers itself per device, so each test starts from the seed. */
beforeEach(() => {
  try { window.localStorage.clear(); } catch { /* a private window is fine */ }
});

/** Most of these assertions are about a chip, not about the fold in front of it. */
const openEveryBand = () => {
  for (const band of screen.getAllByTestId(/^fleet-band-/)) {
    const heading = band.querySelector('button');
    if (heading?.getAttribute('aria-expanded') === 'false') fireEvent.click(heading);
  }
};

describe('the fleet cards on the planet sheet', () => {
  it('draws one chip per hull in an open band, and none for the rest', () => {
    render(<FleetCards fleet={fleet} fleetAway={away} />);
    openEveryBand();
    expect(screen.getByTestId('fleet-card-DART')).toBeInTheDocument();
    expect(screen.getByTestId('fleet-card-VIPER')).toBeInTheDocument();
    expect(screen.getByTestId('fleet-card-COURIER')).toBeInTheDocument();
    expect(screen.queryByTestId('fleet-card-CATACLYSM')).not.toBeInTheDocument();
  });

  /** Owned means owned: a hull that is entirely away still has a card. */
  it('keeps a chip for a hull whose every craft is in the air', () => {
    render(<FleetCards fleet={{ DART: 0 }} fleetAway={{ DART: 3 }} />);
    openEveryBand();
    const card = screen.getByTestId('fleet-card-DART');
    expect(card).toHaveTextContent('3');
  });

  it('states home and away as separate figures, never one total', () => {
    render(<FleetCards fleet={fleet} fleetAway={away} />);
    openEveryBand();
    const dart = screen.getByTestId('fleet-card-DART');
    // Six standing here, two of this commander's Darts out — eight owned.
    expect(dart).toHaveTextContent('6');
    expect(dart).toHaveTextContent('2');
    const courier = screen.getByTestId('fleet-card-COURIER');
    expect(courier).toHaveTextContent('4');
  });

  /** A hull with nothing in the air says so by omission, not with a zero. */
  it('draws no away figure for a hull that is entirely home', () => {
    render(<FleetCards fleet={{ VIPER: 2 }} fleetAway={{}} />);
    openEveryBand();
    expect(screen.queryByTestId('fleet-away-VIPER')).not.toBeInTheDocument();
    expect(screen.getByTestId('fleet-home-VIPER')).toHaveTextContent('2');
  });

  it('draws nothing at all when the commander owns no craft', () => {
    const { container } = render(<FleetCards fleet={{}} fleetAway={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * `roster.ts` is the only statement of the order, and this surface reads it
   * rather than restating it — the Fleet tab and the launch picker already do.
   */
  it('bands the chips in the roster order and skips the empty bands', () => {
    render(<FleetCards fleet={{ CATACLYSM: 1, COURIER: 1, DART: 1 }} fleetAway={{}} />);
    const bands = screen.getAllByTestId(/^fleet-band-/).map((el) => el.dataset.family);
    const expected = FLEET_FAMILY_ORDER.filter((f) => bands.includes(f));
    expect(bands).toEqual(expected);
    expect(bands).not.toContain('DEFENSIVE');
  });

  it('names every hull in the reader’s language', () => {
    render(<FleetCards fleet={{ DART: 1 }} fleetAway={{}} />);
    openEveryBand();
    expect(screen.getByTestId('fleet-card-DART')).toHaveTextContent(hullLabel('DART'));
  });
});

describe('the bands fold', () => {
  /**
   * ONE OPEN, THE REST SHUT AND COUNTED. The same shape the Fleet tab and the
   * launch picker already use, for the same reason: four headings and a total is
   * a shape a commander can read in one glance, where twenty chips is a list they
   * have to scroll.
   */
  it('opens the first band and shuts the others', () => {
    render(<FleetCards fleet={{ DART: 2, BASTION: 1, COURIER: 1 }} fleetAway={{}} />);
    const bands = screen.getAllByTestId(/^fleet-band-/);
    expect(bands.length).toBeGreaterThan(1);
    expect(bands[0]?.querySelector('button')).toHaveAttribute('aria-expanded', 'true');
    for (const band of bands.slice(1)) {
      expect(band.querySelector('button')).toHaveAttribute('aria-expanded', 'false');
    }
  });

  /** A shut band still says how many craft are under it — that is the whole point. */
  it('carries its own count while it is shut', () => {
    // A Dart as well, so Cargo is not the first band and therefore starts shut.
    render(<FleetCards fleet={{ DART: 1, COURIER: 4 }} fleetAway={{ COURIER: 3 }} />);
    const cargo = screen.getByTestId('fleet-band-CARGO');
    expect(cargo.querySelector('button')).toHaveAttribute('aria-expanded', 'false');
    expect(cargo).toHaveTextContent('7');
    expect(screen.queryByTestId('fleet-card-COURIER')).not.toBeInTheDocument();
  });

  it('opens a shut band when its heading is pressed', async () => {
    render(<FleetCards fleet={{ DART: 1, COURIER: 4 }} fleetAway={{}} />);
    const heading = screen.getByTestId('fleet-band-CARGO').querySelector('button');
    await userEvent.click(heading as HTMLElement);
    expect(screen.getByTestId('fleet-card-COURIER')).toBeInTheDocument();
  });
});

describe('where the chips sit', () => {
  it('is under the defence and shield verdicts on the planet sheet', () => {
    const hero = readFileSync(resolve(__dirname, '../src/ui/PlanetHero.tsx'), 'utf8');
    expect(hero).toMatch(/FleetCards/);
  });
});
