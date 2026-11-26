import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EVENT_GLYPH } from '../src/lib/nowLine.js';
import { GalaxyEventsGuide } from '../src/screens/GalaxyEventsGuide.js';
import i18n from '../src/i18n/index.js';
import { glyphPath } from './glyphPath.js';

vi.mock('../src/api/queries.js', () => ({
  useGalaxyEvents: () => ({ data: { events: [], next: null } }),
  useSeason: () => ({ data: { features: { moons: true, synthesis: true } } }),
}));

/*
  THE ASTERYUM FIRTINASI'S MARK (owner 2026-11-25: "kazma saçma, rüzgar gibi bir icon"). The storm is
  weather over the Yarık, not digging: it wears a whirling storm wherever it is named, the event chip
  on the galaxy, the Chronicle, the events guide and the laboratory.
*/
describe('the Asteryum storm\'s glyph', () => {
  it('is the storm on the galaxy\'s event chip and in the Chronicle', () => {
    expect(EVENT_GLYPH.ASTERIUM_STORM).toBe('storm');
  });

  it('is the storm on the events guide\'s card', async () => {
    await i18n.changeLanguage('tr');
    render(<GalaxyEventsGuide onClose={vi.fn()} />);
    const card = screen.getByRole('heading', { name: 'Asteryum Fırtınası' }).closest('article');
    expect(card?.querySelector('svg path')?.getAttribute('d')).toBe(glyphPath('storm'));
  });
});
