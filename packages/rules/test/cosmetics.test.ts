import { describe, expect, it } from 'vitest';
import {
  PLANET_SKIN_IDS,
  PLANET_SKINS,
  planetSkinAppearance,
  planetSkinById,
  planetSkinStatus,
} from '../src/index.js';

describe('planet skin catalogue', () => {
  it('publishes four stable, distinct planet products with independent palette recipes', () => {
    expect(PLANET_SKIN_IDS).toEqual([
      'planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert',
    ]);
    expect(Object.keys(PLANET_SKINS).sort()).toEqual([...PLANET_SKIN_IDS].sort());

    const palettes = new Set<string>();
    for (const id of PLANET_SKIN_IDS) {
      const skin = planetSkinById(id);
      expect(skin?.id).toBe(id);
      expect(skin?.target).toBe('PLANET');
      expect(skin?.recipeVersion).toBe(1);
      expect(skin?.recipe.baseModelId).toBe('intact-planet');
      expect(skin?.recipe.includedAttachments).toEqual([]);
      expect(skin?.recipe.finish.kind).toBe('PALETTE');
      expect(skin?.recipe.statusVariants).toEqual({
        RECOVERY_SHIELD: { baseModelId: 'fractured-planet' },
      });
      if (skin?.recipe.finish.kind === 'PALETTE') palettes.add(skin.recipe.finish.paletteId);

      const normal = planetSkinAppearance(id, 'NORMAL');
      const struck = planetSkinAppearance(id, 'RECOVERY_SHIELD');
      expect(normal?.baseModelId).toBe('intact-planet');
      expect(struck?.baseModelId).toBe('fractured-planet');
      expect(struck?.finish).toEqual(normal?.finish);
      expect(struck?.includedAttachments).toEqual(normal?.includedAttachments);
    }
    expect([...palettes].sort()).toEqual(['desert', 'ice', 'lava', 'toxic']);
  });

  it('rejects unknown and inherited property names at the catalogue boundary', () => {
    for (const id of ['', 'planet-unknown', 'PLANET-LAVA', '__proto__', 'constructor', 'toString']) {
      expect(planetSkinById(id)).toBeNull();
      expect(planetSkinAppearance(id, 'NORMAL')).toBeNull();
      expect(planetSkinAppearance(id, 'RECOVERY_SHIELD')).toBeNull();
    }
  });

  it('uses only an active struck-world recovery shield for the fractured model', () => {
    const now = new Date('2026-09-18T12:00:00Z');
    expect(planetSkinStatus(null, now)).toBe('NORMAL');
    expect(planetSkinStatus(new Date('2026-09-18T12:00:00Z'), now)).toBe('NORMAL');
    expect(planetSkinStatus(new Date('2026-09-18T18:00:00Z'), now)).toBe('RECOVERY_SHIELD');
  });
});
