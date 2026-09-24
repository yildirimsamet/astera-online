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
  render(<ResearchConstellation stars={stars} selected={selected} onSelect={onSelect} dimStrategic />);

describe('the research constellation', () => {
  it('draws a star for every project and rings the selected one', () => {
    show();
    expect(document.querySelectorAll('[data-star]')).toHaveLength(16);
    expect(document.querySelector('[data-star="SHIP_POWER"]')).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-star="SHIP_ARMOR"]')).toHaveAttribute('aria-pressed', 'false');
  });

  it('draws the level, the lock and the lane on the star itself', () => {
    show();
    expect(document.querySelector('[data-star="SHIP_POWER"]')).toHaveAttribute('data-level', '2');
    expect(document.querySelector('[data-star="ISOTOPE_SPECTROMETRY"]')).toHaveAttribute('data-level', '0');
    expect(document.querySelector('[data-star="SHIP_PROPULSION"]')).toHaveAttribute('data-locked', '');
    expect(document.querySelector('[data-star="SHIP_ARMOR"]')).toHaveAttribute('data-running', '');
  });

  it('names a prerequisite in another group under the star', () => {
    show();
    expect(document.querySelector('[data-star="SHIP_PROPULSION"]')).toHaveTextContent('← Dense Fuel Cells');
  });

  it('draws a line for each prerequisite inside a group', () => {
    show();
    expect(document.querySelectorAll('[data-constellation] line').length).toBeGreaterThan(0);
  });

  it('selects on a tap', async () => {
    const onSelect = vi.fn();
    show('SHIP_POWER', onSelect);
    await userEvent.click(screen.getByRole('button', { name: /Dense Fuel Cells/ }));
    expect(onSelect).toHaveBeenCalledWith('DENSE_FUEL_CELLS');
  });
});
