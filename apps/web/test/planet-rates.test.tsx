import { render, screen, within } from '@testing-library/react';
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
 * Every figure already carries `/h`, so the heading was restating a suffix the eye
 * had just read.
 *
 * AND THE STORE MOVED UNDER ITS RATE (E5, the mock's Base: "+1,24b /sa · depo %62 ·
 * güvenli %35"). One column per resource: what comes in, how full the store is, and
 * how much of it a raid cannot take — the Vault's slice, bracketed with its shield
 * as D190 settled, on a bar a third of the width.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const world = (stock: Parameters<typeof planetView>[1] = {}) =>
  planetView(
    { buildings: { CORE: 6, REFINERY: 7, EXTRACTOR: 5, VAULT: 2, SHIPYARD: 1, DEUTERIUM_PLANT: 4 } },
    { alloyPerHour: 1043, crystalPerHour: 420, deuteriumPerHour: 37, ...stock },
  );

const column = (id: 'alloy' | 'crystal' | 'deuterium'): HTMLElement => {
  const found = screen.getByTestId('planet-rates').querySelector<HTMLElement>(`[data-resource="${id}"]`);
  expect(found, `no ${id} column`).not.toBeNull();
  return found!;
};

describe('the production row states all three hourly rates', () => {
  it('quotes deuterium beside alloy and crystal', () => {
    render(<PlanetHero planet={world()} />);
    expect(screen.getByTestId('rate-alloy')).toHaveTextContent(compact(1043));
    expect(screen.getByTestId('rate-crystal')).toHaveTextContent(compact(420));
    expect(screen.getByTestId('rate-deuterium')).toHaveTextContent(compact(37));
  });

  /**
   * A world with no plant still reads zero rather than dropping the column: a rate
   * that disappears reads as "this world cannot make fuel", and the honest answer
   * is "it does not make any YET" — which is a reason to build the plant.
   */
  it('reads zero, rather than vanishing, on a world with no plant', () => {
    render(<PlanetHero planet={planetView()} />);
    expect(screen.getByTestId('rate-deuterium')).toHaveTextContent('0');
  });

  it('drops the heading the suffix already carries', () => {
    render(<PlanetHero planet={world()} />);
    expect(screen.queryByText('Per hour')).not.toBeInTheDocument();
  });

  it('draws one row per resource', () => {
    render(<PlanetHero planet={world()} />);
    const row = screen.getByTestId('planet-rates');
    expect(row.querySelectorAll('[data-resource]')).toHaveLength(3);
    expect(row.querySelectorAll('[data-testid^="rate-"]')).toHaveLength(3);
  });
});

/**
 * THE STORE ROWS (owner, 2026-09-24): back to one full-width row per resource, as the
 * store was drawn before the redesign — its figures, its cells, and the part a raid
 * cannot take bracketed under the Vault's shield; the rate at the row's end. In three
 * narrow columns the bracket read as a square.
 */
describe('the store rows', () => {
  it('reads each store as held of cap beside its cells', () => {
    render(<PlanetHero planet={world({
      alloy: 620,
      alloyCap: 1000,
      vaultProtected: { alloy: 350, crystal: 0, deuterium: 0 },
    })} />);
    const alloy = column('alloy');
    expect(within(alloy).getByTestId('store-alloy')).toHaveTextContent(`${compact(620)}/${compact(1000)}`);
    expect(alloy.querySelectorAll('[data-cell]')).toHaveLength(12);
    expect(alloy.querySelector('[data-safe]')).toHaveAttribute('data-safe-cells', '4');
  });

  /** H2 and K2: a full store is a gap you can close — yellow, never the red of a threat. */
  it('says a full store is full, in the colour of a gap', () => {
    render(<PlanetHero planet={world({ crystal: 1200, crystalCap: 1000 })} />);
    const crystal = column('crystal');
    expect(within(crystal).getByTestId('store-crystal')).toHaveClass('text-v2-warn');
    expect(crystal.querySelector('[data-full-cap]')).not.toBeNull();
    expect(crystal.querySelector('.text-v2-hostile')).toBeNull();
  });

  it('draws no bracket where the Vault keeps nothing', () => {
    render(<PlanetHero planet={world({ vaultProtected: { alloy: 500, crystal: 100, deuterium: 0 } })} />);
    expect(column('deuterium').querySelector('[data-safe]')).toBeNull();
    expect(column('alloy').querySelector('[data-safe]')).not.toBeNull();
  });

  it('states the rule of the bracket once, under the rows', () => {
    render(<PlanetHero planet={world()} />);
    expect(screen.getAllByText(/the bracket under the shield is safe from a raid/)).toHaveLength(1);
  });

  it('names the whole store for a screen reader', () => {
    render(<PlanetHero planet={world({
      alloy: 620,
      alloyCap: 1000,
      vaultProtected: { alloy: 350, crystal: 0, deuterium: 0 },
    })} />);
    expect(column('alloy')).toHaveAttribute('aria-label', expect.stringMatching(/620 of 1,000 alloy, 350 protected/));
  });
});
