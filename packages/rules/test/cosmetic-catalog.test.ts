import { describe, expect, it } from 'vitest';
import { COSMETIC_IDS, COSMETICS, cosmeticById, cosmeticsInCategory, canEquipCosmetic, shipCosmeticForHull, cosmeticCategoriesFor } from '../src/cosmeticCatalog.js';

describe('multi-category cosmetics', () => {
  it('keeps stable unique identities and separates cosmetic slots', () => {
    expect(new Set(COSMETIC_IDS).size).toBe(COSMETIC_IDS.length);
    expect(cosmeticsInCategory('RING')).toHaveLength(3);
    expect(cosmeticsInCategory('ENGINE')).toHaveLength(4);
    expect(cosmeticById('engine-titan')).toMatchObject({ category: 'ENGINE', style: 'titan', free: false });
    expect(cosmeticsInCategory('FLAG').filter(item => !item.free)).toHaveLength(8);
    expect(cosmeticsInCategory('FLAG').filter(item => item.free)).toHaveLength(2);
    expect(cosmeticsInCategory('SHIP')).toHaveLength(4);
    expect(cosmeticsInCategory('MINER')).toEqual([]);
    expect(cosmeticById('probe-ufo')).toMatchObject({ category: 'PROBE', model: '/assets/models/probes/probe_ufo.glb' });
  });
  it('binds the four commissioned models to their approved hulls, never to another hull', () => {
    for (const [id, hull, name] of [
      ['ship-red-dragon', 'CORSAIR', 'red-dragon'],
      ['ship-scorpion', 'VIPER', 'scorpion'],
      ['ship-shark', 'CITADEL', 'shark'],
      ['ship-stingray', 'LEVIATHAN', 'stingray'],
    ] as const) {
      const item = shipCosmeticForHull(hull, id);
      expect(item).toMatchObject({ category: 'SHIP', hull, free: false,
        model: `/assets/models/ships/skins/${name}/model.glb`,
        lodModel: `/assets/models/ships/skins/${name}/model_lod.glb`,
        previewModel: `/assets/models/ships/skins/${name}/model_preview.glb`,
      });
      expect(shipCosmeticForHull('DART', id)).toBeNull();
      expect(canEquipCosmetic(id, 'SHIP', [])).toBe(false);
      expect(canEquipCosmetic(id, 'SHIP', [id])).toBe(true);
    }
    for (const id of ['ring-aurora', 'constructor', 'missing', null, undefined]) {
      expect(shipCosmeticForHull('CORSAIR', id)).toBeNull();
    }
  });
  it('hides empty catalogue categories and inventory categories with no accessible skins', () => {
    expect(cosmeticCategoriesFor()).toEqual(['PLANET', 'RING', 'SHIP', 'PROBE', 'ENGINE', 'FLAG']);
    expect(cosmeticCategoriesFor([])).toEqual(['FLAG']);
    expect(cosmeticCategoriesFor(['missing', '__proto__'])).toEqual(['FLAG']);
    expect(cosmeticCategoriesFor(['ring-aurora', 'ship-scorpion'])).toEqual(['RING', 'SHIP', 'FLAG']);
    expect(cosmeticCategoriesFor(['planet-ice', 'probe-ufo'])).toEqual(['PLANET', 'PROBE', 'FLAG']);
  });
  it('rejects unknown/prototype keys and incompatible equipment', () => {
    for (const id of ['__proto__', 'constructor', 'missing']) expect(cosmeticById(id)).toBeNull();
    expect(canEquipCosmetic('ring-aurora', 'ENGINE', ['ring-aurora'])).toBe(false);
    expect(canEquipCosmetic('ring-aurora', 'RING', [])).toBe(false);
    expect(canEquipCosmetic('ring-aurora', 'RING', ['ring-aurora'])).toBe(true);
    expect(canEquipCosmetic(null, 'RING', [])).toBe(true);
    expect(canEquipCosmetic('flag-vanguard', 'FLAG', [])).toBe(true);
    for (const item of COSMETICS) expect(cosmeticById(item.id)).toEqual(item);
  });
});
