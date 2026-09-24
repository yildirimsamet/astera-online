import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RESEARCH_PROJECT_IDS } from '@astera/rules';
import { StarField } from '../../src/v2/kit/StarField.js';
import { Sheet } from '../../src/ui/kit/Sheet.js';
import { PlanetHero } from '../../src/ui/PlanetHero.js';
import { ResearchConstellation } from '../../src/v2/hud/ResearchConstellation.js';
import { planetView } from '../fixtures.js';

/**
 * THE SKY, WHERE THE MOCK HAS IT. Owner, 2026-09-24: the research map in the mock sits
 * on the galaxy — stars, a haze of nebula — and so does the world at the top of the
 * Base. Only those two: "komple scrollable arkaplan'a eklenmeyecek, sadece gezegenimin
 * olduğu section'a ve araştırma takımyıldızlarının olduğu section'a". Still and cheap
 * (no per-frame cost over the live scene), and the same every time it opens.
 */
describe('the star field', () => {
  it('draws a sky of stars, decoration only', () => {
    const view = render(<StarField />);
    const sky = view.container.querySelector('[data-sky]');
    expect(sky).toHaveAttribute('aria-hidden', 'true');
    expect(sky?.querySelectorAll('circle').length).toBeGreaterThan(80);
  });

  it('is the same sky every time it is drawn', () => {
    const first = render(<StarField />).container.innerHTML;
    const second = render(<StarField />).container.innerHTML;
    expect(second).toBe(first);
  });

  it('keeps its stars round on any shape of section', () => {
    const view = render(<StarField />);
    const svg = view.container.querySelector('[data-sky] svg');
    expect(svg).not.toHaveAttribute('viewBox');
    expect(view.container.querySelector('circle')?.getAttribute('cx')).toMatch(/%$/);
  });
});

describe('where the sky is drawn', () => {
  it('behind the world at the top of the Base', () => {
    const view = render(<PlanetHero planet={planetView()} />);
    expect(view.container.querySelector('[data-planet-subject] [data-sky]')).not.toBeNull();
    expect(view.container.querySelectorAll('[data-sky]')).toHaveLength(1);
  });

  it('behind the research map', () => {
    const stars = RESEARCH_PROJECT_IDS.map((id) => ({ id, name: id, level: 0, maxLevel: 1, locked: false, running: false }));
    const view = render(<ResearchConstellation stars={stars} selected={null} onSelect={vi.fn()} />);
    expect(view.container.querySelector('[data-constellation] [data-sky]')).not.toBeNull();
  });

  it('never behind a whole scrolling sheet', () => {
    render(<Sheet title="Base" onClose={vi.fn()}>body</Sheet>);
    expect(screen.getByRole('dialog').querySelector('[data-sky]')).toBeNull();
  });
});
