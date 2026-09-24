import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BaseSwitch } from '../../src/v2/hud/BaseSwitch.js';

/**
 * K6: RESEARCH LIVES ON THE BASE. "Üs sekmesinin üstünde 'Bu dünya | Araştırma'
 * segmenti" — the mock's two Base pages share one switch at the top, and the research
 * is still the commander's, which the research page says itself.
 */
describe('the Base switch', () => {
  it('offers this world and research, with the page it is on selected', async () => {
    const onChange = vi.fn();
    render(<BaseSwitch value="world" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'This world' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Research' }));
    expect(onChange).toHaveBeenCalledWith('research');
  });
});

describe('the galaxy hosts it on both Base pages', () => {
  const source = readFileSync('src/screens/GalaxyView.tsx', 'utf8');

  it('heads the world page and the research page with the same switch', () => {
    const world = source.slice(source.indexOf("{panel === 'planet' && planet.data && ("), source.indexOf('<PlanetScreen'));
    const research = source.slice(source.indexOf("{panel === 'research' && ("), source.indexOf('<ResearchPanel'));
    expect(world).toMatch(/<BaseSwitch value="world" onChange=\{openBase\} \/>/);
    expect(research).toMatch(/<BaseSwitch value="research" onChange=\{openBase\} \/>/);
  });
});
