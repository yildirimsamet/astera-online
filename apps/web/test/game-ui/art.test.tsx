import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DOCK_TABS } from '../../src/lib/dock.js';
import { ART_ICONS, ART_SIZES, ArtIcon, DOCK_ART, artIconSrc } from '../../src/game-ui/art.js';
import { GameKitGallery } from '../../src/v2/gallery/GameKitGallery.js';

/**
 * PAINTED ICONS. The Codex house style (owner 2026-11-12) for every icon drawn 40 px and
 * up; under that the kit's glyphs. Each id is a small WebP the page can fetch, and every
 * place in the dock has its painting.
 */

describe('the painted icons', () => {
  it('ships a small WebP for every painted icon', () => {
    for (const id of ART_ICONS) {
      const file = join('public', artIconSrc(id));
      expect(existsSync(file), id).toBe(true);
      expect(file.endsWith('.webp'), id).toBe(true);
      expect(statSync(file).size, id).toBeLessThan(40 * 1024);
    }
  });

  it('is never drawn under 40 px: smaller marks are glyphs', () => {
    expect(ART_SIZES.length).toBeGreaterThan(0);
    for (const size of ART_SIZES) expect(size).toBeGreaterThanOrEqual(40);
  });

  it('paints every place in the dock', () => {
    for (const tab of DOCK_TABS) expect(ART_ICONS).toContain(DOCK_ART[tab]);
  });

  it('draws as a decorative picture at its size, the words beside it carry the name', () => {
    const { container } = render(<ArtIcon id="menu-shop" size={56} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', artIconSrc('menu-shop'));
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('width', '56');
    expect(img).toHaveAttribute('height', '56');
  });

  it('shows every painted icon in the catalogue and paints the dock with them', () => {
    const { container } = render(<GameKitGallery view="ui-kit" />);
    const sheet = screen.getByRole('group', { name: 'Resimli ikonlar' });
    expect(within(sheet).getAllByTitle(/./)).toHaveLength(ART_ICONS.length);
    const dockArt = [...container.querySelectorAll('.gk-nav__art')].map((img) => img.getAttribute('src'));
    expect(dockArt.length).toBeGreaterThan(0);
    for (const src of dockArt) expect(src).toMatch(/^\/assets\/ui\/icons\/.+\.webp$/);
  });
});
