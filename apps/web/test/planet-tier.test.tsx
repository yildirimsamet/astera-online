import { render, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { coreTier } from '@astera/rules';
import { PlanetHero } from '../src/ui/PlanetHero.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

/**
 * A COMMANDER COULD NOT READ THEIR OWN WORLD'S TIER. Owner report.
 *
 * *"Benim gezegenlerimin tier'ı kaç görebileceğim bir alan yok."*
 *
 * The tier is the figure the whole galaxy is sorted by — the disc draws a world's
 * size from it, every dossier states it, and since D168 it is what decides who a
 * commander may fight. It was on screen for every world EXCEPT the ones the player
 * owns: the intel dossier prints a foreign world's `developmentValue`, the
 * leaderboard prints a rival's, and the planet sheet — the surface a commander
 * spends their whole session on — printed nothing.
 *
 * That is the wrong way round for D168 in particular. The attack band is measured
 * on the tallest Core a commander holds ANYWHERE, so "which of my worlds is my
 * tallest, and what tier does that make me" is a question the rule asks of the
 * player and the interface refused to answer. A commander whose colony has grown
 * past their capital cannot see that it has.
 *
 * It goes under the world's portrait, in the sheet's smallest type: a fact, not a
 * heading. `docs/visual-design.md` — if a figure is drawn, do not also write it;
 * the portrait says WHICH world, this says how far along it is.
 */

const at = (core: number) => planetView({ buildings: { CORE: core, REFINERY: 1, EXTRACTOR: 1 } });

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('a commander can read their own world’s tier', () => {
  it.each([
    [1, 1],
    [3, 1],
    [4, 2],
    [9, 3],
    [12, 4],
    [13, 5],
  ])('states Core %i as tier %i', (core, tier) => {
    expect(coreTier(core)).toBe(tier);
    const view = render(<PlanetHero planet={at(core)} />);
    const mark = view.container.querySelector('[data-planet-tier]');
    expect(mark, 'the planet sheet states no tier').not.toBeNull();
    expect(mark).toHaveTextContent(new RegExp(`\\b${String(tier)}\\b`));
  });

  /**
   * BOTH SHAPES OF THE HERO, because the sheet a world opens in is the compact
   * one and the full one is what a wider surface draws. A figure that appeared in
   * only one of them would be a fact that comes and goes with the layout.
   */
  it('states it in the compact sheet too', () => {
    const view = render(<PlanetHero planet={at(9)} compact />);
    expect(view.container.querySelector('[data-planet-tier]')).toHaveTextContent(/\b3\b/);
  });

  /** Under the portrait, which is what the owner asked for and where it belongs. */
  it.each([false, true])('puts it under the world’s portrait (compact: %s)', (compact) => {
    const view = render(<PlanetHero planet={at(9)} compact={compact} />);
    const subject = view.container.querySelector('[data-planet-portrait]');
    expect(subject, 'the portrait is not marked').not.toBeNull();
    expect(within(subject as HTMLElement).getByText(/\b3\b/)).toBeInTheDocument();
  });

  /**
   * IT IS THE SHEET'S SMALLEST TYPE. The portrait is the subject; this is a
   * caption under it. `--text-micro` is the step the scale reserves for exactly
   * this — a unit, a count, a stamp — and anything larger competes with the
   * world's own name two centimetres away.
   */
  it.each([false, true])('sets it in micro type (compact: %s)', (compact) => {
    const view = render(<PlanetHero planet={at(9)} compact={compact} />);
    expect(view.container.querySelector('[data-planet-tier]')).toHaveClass('text-micro');
  });

  it.each(['tr', 'en'])('names the figure in %s', async (lang) => {
    await i18n.changeLanguage(lang);
    const view = render(<PlanetHero planet={at(9)} />);
    expect(view.container.querySelector('[data-planet-tier]')?.textContent ?? '')
      .toBe(i18n.t('planetHero.tier', { tier: 3 }));
    await i18n.changeLanguage('en');
  });

  /**
   * A WORLD WITH NO CORE ROW STILL HAS A TIER. `coreTier` floors at 1, and a
   * sheet that printed "Tier 0" — or nothing — for a world mid-capture would be
   * stating something the rules never produce.
   */
  it('floors a world with no Core at tier 1', () => {
    const view = render(<PlanetHero planet={planetView({ buildings: {} })} />);
    expect(view.container.querySelector('[data-planet-tier]')).toHaveTextContent(/\b1\b/);
  });
});
