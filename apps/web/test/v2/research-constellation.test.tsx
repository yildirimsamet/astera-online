import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RESEARCH_PROJECT_IDS, type ResearchProjectId } from '@astera/rules';
import { ResearchConstellation, type StarState } from '../../src/v2/hud/ResearchConstellation.js';

/**
 * THE RESEARCH CONSTELLATION. Spec E8 · K9: "Sırada ne var?" at one glance.
 *
 * A star per project: hollow at zero, brighter the higher its level, dim with a lock
 * while something stands in front of it; the one in the research lane pulses; the
 * selected one is ringed. A prerequisite in another group is named under the star.
 */
const stars: StarState[] = RESEARCH_PROJECT_IDS.map((id: ResearchProjectId) => ({
  id,
  name: id === 'DENSE_FUEL_CELLS' ? 'Dense Fuel Cells' : id,
  level: id === 'SHIP_POWER' ? 2 : 0,
  maxLevel: id === 'SHIP_POWER' ? 5 : 1,
  locked: id === 'SHIP_PROPULSION',
  running: id === 'SHIP_ARMOR',
}));

const show = (selected: ResearchProjectId | null = 'SHIP_POWER', onSelect = vi.fn()) =>
  render(<ResearchConstellation stars={stars} selected={selected} onSelect={onSelect} />);

describe('the research constellation', () => {
  it('draws a star for every project and rings the selected one', () => {
    show();
    expect(document.querySelectorAll('[data-star]')).toHaveLength(stars.length);
    expect(document.querySelector('[data-star="SHIP_POWER"]')).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-star="SHIP_ARMOR"]')).toHaveAttribute('aria-pressed', 'false');
  });

  /** A season dealt before a project has no star for it, and no line running to its empty spot. */
  it('draws no line to a project the season does not have', () => {
    const { unmount } = show();
    const all = document.querySelectorAll('[data-constellation] line').length;
    unmount();
    render(<ResearchConstellation stars={stars.filter((star) => star.id !== 'INDUSTRIAL')} selected={null} onSelect={vi.fn()} />);
    expect(document.querySelector('[data-star="INDUSTRIAL"]')).toBeNull();
    expect(document.querySelectorAll('[data-constellation] line')).toHaveLength(all - 1);
  });

  it('draws the level, the lock and the lane on the star itself', () => {
    show();
    expect(document.querySelector('[data-star="SHIP_POWER"]')).toHaveAttribute('data-level', '2');
    expect(document.querySelector('[data-star="ISOTOPE_SPECTROMETRY"]')).toHaveAttribute('data-level', '0');
    expect(document.querySelector('[data-star="SHIP_PROPULSION"]')).toHaveAttribute('data-locked', '');
    expect(document.querySelector('[data-star="SHIP_ARMOR"]')).toHaveAttribute('data-running', '');
  });

  /** Owner, 2026-09-24: every project's ring holds a star, whatever its level. */
  it('puts a star inside every project’s ring', () => {
    show();
    for (const node of document.querySelectorAll('[data-star]')) {
      expect(node.querySelector('[data-star-glyph]'), node.getAttribute('data-star') ?? '').not.toBeNull();
    }
  });

  it('names a prerequisite in another group under the star', () => {
    show();
    expect(document.querySelector('[data-star="SHIP_PROPULSION"]')).toHaveTextContent('← Dense Fuel Cells');
  });

  it('draws a line for each prerequisite inside a group', () => {
    show();
    expect(document.querySelectorAll('[data-constellation] line').length).toBeGreaterThan(0);
  });

  it('says which group each star stands in, and names every group', () => {
    show();
    expect(document.querySelector('[data-star="SHIP_ARMOR"]')).toHaveAttribute('data-group', 'doctrine');
    expect([...document.querySelectorAll('[data-region]')].map((region) => region.getAttribute('data-region')))
      .toEqual(['frontier', 'industry', 'doctrine', 'strategic']);
  });

  it('selects on a tap', async () => {
    const onSelect = vi.fn();
    show('SHIP_POWER', onSelect);
    await userEvent.click(screen.getByRole('button', { name: /Dense Fuel Cells/ }));
    expect(onSelect).toHaveBeenCalledWith('DENSE_FUEL_CELLS');
  });
});
