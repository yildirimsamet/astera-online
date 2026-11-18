import { VESSEL_HULLS, openingProgress } from '@astera/rules';
import { cleanup, render, screen } from '@testing-library/react';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadHero } from '../src/starter/heroPreload.js';
import { HERO_SIZES, heroArt, heroPlaceholder, heroSrcSet } from '../src/starter/shipScreen.js';
import { ShipHero } from '../src/starter/ShipHero.js';

vi.mock('../src/lib/sound.js', () => ({ playSound: vi.fn() }));
afterEach(() => { cleanup(); });

const LOOKS = ['WRECKED', 'PATCHED', 'RENEWED'] as const;
const onDisk = (url: string) => existsSync(join(__dirname, '../public', url));

/**
 * THE SHIP'S PAINTING IS THERE WHEN ITS PAGE OPENS (owner phone playtest 2026-11-19): it came in late, a
 * black frame while the page moved on under it. A phone that draws it narrow takes a lighter copy, a blur
 * of it stands in until it lands, and the player's own hull is fetched while the galaxy is up.
 */
describe('the ship\'s painting', () => {
  it('comes in two widths for every hull and look, both on disk', () => {
    for (const hull of VESSEL_HULLS) {
      for (const look of LOOKS) {
        const [small, large] = heroSrcSet(hull, look).split(', ');
        expect(small).toMatch(/-720\.webp 720w$/u);
        expect(large).toBe(`${heroArt(hull, look)} 1000w`);
        expect(onDisk(small!.split(' ')[0]!)).toBe(true);
        expect(onDisk(heroArt(hull, look))).toBe(true);
      }
    }
  });

  it('has a tiny blur of every hull and look that stands in at once', () => {
    for (const hull of VESSEL_HULLS) {
      for (const look of LOOKS) {
        const blur = heroPlaceholder(hull, look);
        expect(blur).toMatch(/^data:image\/webp;base64,/u);
        expect(blur.length).toBeLessThan(600);
      }
    }
  });

  it('draws the blur under the painting, and asks for the painting first and in the width it is shown', () => {
    render(<ShipHero id="ship-1" progress={openingProgress()} selected="REFINERY" onSelect={vi.fn()} />);
    const [blur, painting] = [...screen.getByTestId('ship-hero').querySelectorAll('img')];
    expect(blur?.getAttribute('src')).toMatch(/^data:image\/webp;base64,/u);
    expect(blur?.getAttribute('aria-hidden')).toBe('true');
    expect(painting?.getAttribute('srcset')).toMatch(/720w, .*1000w$/u);
    expect(painting?.getAttribute('sizes')).toBe(HERO_SIZES);
    expect(painting?.getAttribute('fetchpriority')).toBe('high');
  });

  it('fetches every look of a hull once, ahead of its page', () => {
    const asked = preloadHero('WEDGE');
    expect(asked).toEqual(LOOKS.map(look => heroSrcSet('WEDGE', look)));
    expect(preloadHero('WEDGE')).toEqual([]);
  });
});
