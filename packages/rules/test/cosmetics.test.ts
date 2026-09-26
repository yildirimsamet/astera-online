import { describe, expect, it } from 'vitest';
import {
  PLANET_SKIN_IDS,
  PLANET_SKINS,
  planetSkinAppearance,
  planetSkinById,
  planetSkinStatus,
} from '../src/index.js';

describe('planet skin catalogue', () => {
  it('publishes eight stable planet products in elemental and country collections', () => {
    expect(PLANET_SKIN_IDS).toEqual([
      'planet-lava', 'planet-ice', 'planet-toxic', 'planet-desert',
      'planet-turkey', 'planet-germany', 'planet-france', 'planet-spain',
    ]);
    expect(Object.keys(PLANET_SKINS).sort()).toEqual([...PLANET_SKIN_IDS].sort());

    const attachments = {
      'planet-lava': ['lava-arch', 'lava-pillar', 'lava-spikes', 'lava-volcano'],
      'planet-ice': ['ice-arch', 'ice-cave', 'ice-pillar', 'ice-spikes'],
      'planet-toxic': ['toxic-eggs', 'toxic-flower', 'toxic-mushroom', 'toxic-spike'],
      'planet-desert': ['desert-bones', 'desert-hill', 'desert-monument-1', 'desert-monument-2'],
    } as const;
    const palettes = new Set<string>();
    for (const id of Object.keys(attachments) as (keyof typeof attachments)[]) {
      const skin = planetSkinById(id);
      expect(skin?.id).toBe(id);
      expect(skin?.target).toBe('PLANET');
      expect(skin?.recipeVersion).toBe(2);
      expect(skin?.recipe.baseModelId).toBe('intact-planet');
      expect(skin?.recipe.includedAttachments.map((attachment) => attachment.assetId))
        .toEqual(attachments[id]);
      expect(skin?.recipe.includedAttachments.map((attachment) => attachment.placementId))
        .toEqual(['surface-primary', 'surface-secondary', 'surface-tertiary', 'surface-quaternary']);
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

  it('keeps each authored country look as a distinct equipable product', () => {
    for (const country of ['turkey', 'germany', 'france', 'spain'] as const) {
      const id = `planet-${country}` as const;
      const skin = planetSkinById(id);
      expect(skin?.id).toBe(id);
      expect(skin?.target).toBe('PLANET');
      expect(planetSkinAppearance(id, 'NORMAL')).toEqual({
        baseModelId: `country-${country}`,
        finish: { kind: 'AUTHORED' },
        includedAttachments: [],
      });
      expect(planetSkinAppearance(id, 'RECOVERY_SHIELD')).toEqual(
        planetSkinAppearance(id, 'NORMAL'),
      );
    }
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
