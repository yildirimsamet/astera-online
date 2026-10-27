import { existsSync, readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ATMOSPHERE } from '../../src/ui/atmosphere.js';
import { BaseSwitch } from '../../src/v2/hud/BaseSwitch.js';

/**
 * K6: RESEARCH LIVES ON THE BASE. "Üs sekmesinin üstünde 'Bu dünya | Araştırma'
 * segmenti" — the mock's two Base pages share one switch at the top, and the research
 * is still the commander's, which the research page says itself.
 */
describe('the Base switch', () => {
  it('offers the commander ship only when this session can enter the arena', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<BaseSwitch value="world" onChange={onChange} arenaAvailable={false} />);
    expect(screen.queryByRole('tab', { name: 'Commander ship' })).not.toBeInTheDocument();
    rerender(<BaseSwitch value="world" onChange={onChange} arenaAvailable />);
    await userEvent.click(screen.getByRole('tab', { name: 'Commander ship' }));
    expect(onChange).toHaveBeenCalledWith('ship');
  });
  it('offers this world and research, with the page it is on selected', async () => {
    const onChange = vi.fn();
    render(<BaseSwitch value="world" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'This world' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Research' }));
    expect(onChange).toHaveBeenCalledWith('research');
  });
  // Owner 2026-10-27: "bu tabların içindeki yazıların yanına renkli iconlar koy".
  it('marks each page with its own coloured glyph beside its word', () => {
    render(<BaseSwitch value="world" onChange={vi.fn()} arenaAvailable />);
    const glyphs = ['This world', 'Research', 'Commander ship'].map(name => {
      const glyph = screen.getByRole('tab', { name }).querySelector('svg');
      expect(glyph).toHaveAttribute('aria-hidden', 'true');
      return glyph?.getAttribute('class') ?? '';
    });
    const tones = glyphs.map(name => /text-v2-[a-z]+/.exec(name)?.[0]);
    expect(tones.every(Boolean)).toBe(true);
    expect(new Set(tones).size).toBe(3);
  });
});

describe('the galaxy hosts it on both Base pages', () => {
  const source = readFileSync('src/screens/GalaxyView.tsx', 'utf8');

  it('heads the world page and the research page with the same switch', () => {
    const world = source.slice(source.indexOf("{panel === 'planet' && planet.data && ("), source.indexOf('<PlanetScreen'));
    const research = source.slice(source.indexOf("{panel === 'research' && ("), source.indexOf('<ResearchPanel'));
    expect(world).toMatch(/<BaseSwitch value="world" onChange=\{openBase\} arenaAvailable=\{arenaAvailable\} \/>/);
    expect(research).toMatch(/<BaseSwitch value="research" onChange=\{openBase\} arenaAvailable=\{arenaAvailable\} \/>/);
  });

  // Owner 2026-10-27: this world and the commander ship had no header art; research did.
  it('heads all three pages with their own art', () => {
    const page = (start: string, end: string): string => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
    const world = page("{panel === 'planet' && planet.data && (", '<BaseSwitch');
    const ship = page("{panel === 'ship' && onEnterArena && (", '<BaseSwitch');
    expect(world).toMatch(/headerArt=\{ATMOSPHERE\.baseWorld\}/);
    expect(ship).toMatch(/headerArt=\{ATMOSPHERE\.commanderShip\}/);
    for (const head of [world, ship]) expect(head).not.toMatch(/quietTitle/);
    for (const art of [ATMOSPHERE.baseWorld, ATMOSPHERE.commanderShip]) expect(existsSync(`public${art.src}`)).toBe(true);
  });
});
