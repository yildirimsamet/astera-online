import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlanetHero } from '../src/ui/PlanetHero.js';
import { compact } from '../src/lib/format.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

/**
 * THE THIRD PRODUCER WAS MISSING FROM THE ONE PLACE THAT STATES OUTPUT. Owner
 * report, 2026-09-15: *"bu sectionda döteryum üretimi gözükmüyor."*
 *
 * The plate beside Firepower quoted alloy and crystal per hour under a "Per hour"
 * heading, and deuterium — the resource that decides whether a fleet can leave at
 * all — was not on it. A commander reading their own world's output could not
 * answer "how fast is my fuel arriving", which is the input to every dispatch.
 *
 * THE HEADING PAID FOR THE ROW. Owner instruction: drop the title, add the rate.
 * Every figure in the plate already carries `/h`, so the heading was restating a
 * suffix the eye had just read — and the plate sits in a fixed-height flex row
 * next to Firepower, where a fourth line would have pushed the sheet down.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const world = () =>
  planetView(
    { buildings: { CORE: 6, REFINERY: 7, EXTRACTOR: 5, VAULT: 2, SHIPYARD: 1, DEUTERIUM_PLANT: 4 } },
    { alloyPerHour: 1043, crystalPerHour: 420, deuteriumPerHour: 37 },
  );

describe('the planet sheet states all three hourly rates', () => {
  it('quotes deuterium beside alloy and crystal', () => {
    render(<PlanetHero planet={world()} compact />);
    expect(screen.getByTestId('rate-alloy')).toHaveTextContent(compact(1043));
    expect(screen.getByTestId('rate-crystal')).toHaveTextContent(compact(420));
    expect(screen.getByTestId('rate-deuterium')).toHaveTextContent(compact(37));
  });

  /**
   * A world with no plant still reads zero rather than dropping the row: a rate
   * that disappears reads as "this world cannot make fuel", and the honest answer
   * is "it does not make any YET" — which is a reason to build the plant.
   */
  it('reads zero, rather than vanishing, on a world with no plant', () => {
    render(<PlanetHero planet={planetView()} compact />);
    expect(screen.getByTestId('rate-deuterium')).toHaveTextContent('0');
  });

  it('drops the heading the suffix already carries', () => {
    render(<PlanetHero planet={world()} compact />);
    expect(screen.queryByText('Per hour')).not.toBeInTheDocument();
  });

  /** Three rows where three rows used to be a heading and two: the plate does not grow. */
  it('keeps the plate at three lines', () => {
    render(<PlanetHero planet={world()} compact />);
    const plate = screen.getByTestId('planet-rates');
    expect(plate.querySelectorAll('[data-testid^="rate-"]')).toHaveLength(3);
    expect(plate.querySelectorAll('p')).toHaveLength(3);
  });
});
