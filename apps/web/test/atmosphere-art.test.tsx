import { MOBILE_HULLS, RESEARCH_PROJECT_IDS } from '@astera/rules';
import { HULL_ART } from '../src/ui/assets.js';
import { existsSync } from 'node:fs';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ATMOSPHERE, RESEARCH_SCENES, cardScene } from '../src/ui/atmosphere.js';
import { AtmosphereImage, CardArtwork } from '../src/ui/AtmosphereArt.js';

describe('complete scene artwork', () => {
  it('gives every research project a unique served landscape environment', () => {
    expect(Object.keys(RESEARCH_SCENES).sort()).toEqual([...RESEARCH_PROJECT_IDS].sort());
    const scenes = RESEARCH_PROJECT_IDS.map(id => RESEARCH_SCENES[id].src);
    expect(new Set(scenes).size).toBe(RESEARCH_PROJECT_IDS.length);
    for (const src of scenes) expect(existsSync(`public${src}`), src).toBe(true);
  });
  it('gives every mobile hull and the Prospector its own served foreground spacecraft scene', () => {
    const scenes = [...MOBILE_HULLS, 'PROSPECTOR' as const].map(id => {
      const original = HULL_ART[id];
      const scene = cardScene(original);
      expect(scene, id).toBeDefined();
      expect(scene?.src, id).not.toBe(original);
      expect(scene?.fit, id).toBe('contain');
      expect(existsSync(`public${scene?.src}`), id).toBe(true);
      return scene?.src;
    });
    expect(new Set(scenes).size).toBe(scenes.length);
  });

  it('covers every base building, instrument, defense tier and orbital asset with its own complete scene', () => {
    const families = ['general/command_core', 'general/vault', 'general/shipyard', 'general/hangar',
      'resources/alloy_refinery', 'resources/crystal_extractor', 'resources/deuterium_refinery',
      'general/telescope', 'general/radar', 'general/shield', 'general/veil',
      'general/thorn', 'general/harpoon', 'general/bastion'];
    for (const family of families) {
      const paths = [1, 2, 3].map(tier => `/assets/images/${family}_${tier}.${family.includes('deuterium') ? 'webp' : 'png'}`);
      const scenes = paths.map(path => cardScene(path));
      expect(scenes.every(scene => scene !== undefined), family).toBe(true);
      expect(new Set(scenes.map(scene => scene?.src)).size, family).toBe(3);
      for (const scene of scenes) expect(existsSync(`public${scene?.src}`), scene?.src).toBe(true);
    }
    for (const path of ['/assets/images/general/repair_station_1.png',
      '/assets/images/general/anti-strategic-battery.png', '/assets/images/ships/death_star.png',
      ...[1,2,3,4].map(tier => `/assets/images/sattelites/sattelite_type_${tier}.png`)]) {
      const scene = cardScene(path);
      expect(scene, path).toBeDefined();
      expect(existsSync(`public${scene?.src}`), path).toBe(true);
    }
  });
  it('ships every referenced backdrop and its source record', () => {
    for (const art of Object.values(ATMOSPHERE)) {
      expect(existsSync(`public${art.src}`), art.src).toBe(true);
    }
    expect(existsSync('../../assets/source/atmosphere/provenance.json')).toBe(true);
  });

  it('maps a known building to its own scene, never a different object', () => {
    expect(cardScene('/assets/images/general/command_core_1.png')?.src).toContain('core-t1');
    expect(cardScene('/assets/images/resources/alloy_refinery_1.png')?.src).toContain('refinery-t1');
    expect(cardScene('/assets/images/resources/crystal_extractor_1.png')?.src).toContain('extractor-t1');
    expect(cardScene('/assets/images/resources/deuterium_refinery_1.webp')?.src).toContain('deuterium-t1');
    expect(cardScene('/assets/images/general/shipyard_1.png')?.src).toContain('shipyard-t1');
    expect(cardScene('/assets/images/general/hangar_1.png')?.src).toContain('hangar-t1');
  });

  it('preserves unknown assets and missing art', () => {
    for (const src of [undefined, null, '', '/assets/images/general/command_core_4.png', '/assets/images/unrelated.png']) {
      expect(cardScene(src)).toBeUndefined();
    }
  });

  it('renders one finished image without layering the old PNG on top', () => {
    const view = render(<CardArtwork src="/assets/images/general/command_core_1.png" locked={false} unowned={false} />);
    expect(view.container.querySelectorAll('img')).toHaveLength(1);
    expect(view.container.querySelector('img')).toHaveAttribute('data-complete-scene', '');
    expect(view.container.querySelector('img')?.getAttribute('src')).toContain('core-t1');
  });

  it('restores the original object if its scene fails, then follows a different subject', () => {
    const view = render(<CardArtwork src="/assets/images/general/command_core_1.png" locked={false} unowned={false} />);
    const img = view.container.querySelector('img')!;
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', '/assets/images/general/command_core_1.png');
    expect(img).not.toHaveAttribute('data-complete-scene');
    view.rerender(<CardArtwork src="/assets/images/resources/alloy_refinery_1.png" locked={false} unowned={false} />);
    expect(img.getAttribute('src')).toContain('refinery-t1');
    expect(img).toHaveAttribute('data-complete-scene');
  });

  it('dims only the locked artwork, and keeps a supported tier intact', () => {
    const view = render(<CardArtwork src="/assets/images/general/command_core_1.png" locked unowned />);
    expect(view.container.querySelector('img')).toHaveAttribute('data-art-state', 'locked');
    view.rerender(<CardArtwork src="/assets/images/general/command_core_1.png" locked={false} unowned />);
    expect(view.container.querySelector('img')).toHaveAttribute('data-art-state', 'unowned');
  });
});

describe('decorative atmosphere', () => {
  it('is hidden from readers and cannot capture presses', () => {
    const view = render(<AtmosphereImage art={ATMOSPHERE.fleet} />);
    const img = view.container.querySelector('img');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(img).toHaveAttribute('draggable', 'false');
    expect(img).toHaveClass('pointer-events-none');
  });

  it('leaves a clean surface on failure and recovers when the art changes', () => {
    const view = render(<AtmosphereImage art={ATMOSPHERE.fleet} />);
    fireEvent.error(view.container.querySelector('img')!);
    expect(view.container.querySelector('img')).toBeNull();
    view.rerender(<AtmosphereImage art={ATMOSPHERE.intel} />);
    expect(view.container.querySelector('img')).toHaveAttribute('src', ATMOSPHERE.intel.src);
  });
});
