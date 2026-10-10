import { describe, expect, it } from 'vitest';
import { COSMETIC_IDS, COSMETICS, cosmeticById, cosmeticsInCategory, canEquipCosmetic, shipCosmeticForHull, cosmeticCategoriesFor } from '../src/cosmeticCatalog.js';

describe('multi-category cosmetics', () => {
  it('keeps stable unique identities and separates cosmetic slots', () => {
    expect(new Set(COSMETIC_IDS).size).toBe(COSMETIC_IDS.length);
    expect(cosmeticsInCategory('RING')).toHaveLength(7);
    expect(cosmeticsInCategory('ENGINE')).toHaveLength(6);
    expect(cosmeticById('engine-titan')).toMatchObject({ category: 'ENGINE', style: 'titan', free: false });
    expect(cosmeticsInCategory('FLAG').filter(item => !item.free)).toHaveLength(18);
    expect(cosmeticsInCategory('FLAG').filter(item => item.free)).toHaveLength(4);
    expect(cosmeticsInCategory('SHIP')).toHaveLength(4);
    expect(cosmeticsInCategory('MINER')).toEqual([]);
    expect(cosmeticById('probe-ufo')).toMatchObject({ category: 'PROBE', model: '/assets/models/probes/probe_ufo.glb' });
  });
  it('adds the second premium wave as their own styles, never as recolours of an existing one', () => {
    const wave = [
      ['ring-saturn', 'RING', 'saturn'], ['ring-prism', 'RING', 'prism'],
      ['ring-inferno', 'RING', 'inferno'], ['ring-nebula', 'RING', 'nebula'],
      ['engine-tempest', 'ENGINE', 'tempest'], ['engine-prism', 'ENGINE', 'prism'],
      ['flag-sovereign', 'FLAG', 'sovereign'], ['flag-kraken', 'FLAG', 'kraken'],
      ['flag-oni', 'FLAG', 'oni'], ['flag-voideye', 'FLAG', 'voideye'],
      ['flag-valkyrie', 'FLAG', 'valkyrie'], ['flag-scarab', 'FLAG', 'scarab'],
      ['flag-stag', 'FLAG', 'stag'], ['flag-horizon', 'FLAG', 'horizon'],
      ['flag-tiger', 'FLAG', 'tiger'], ['flag-scorpion', 'FLAG', 'scorpion'],
    ] as const;
    for (const [id, category, style] of wave) {
      expect(cosmeticById(id), id).toMatchObject({ category, style, free: false });
      expect(canEquipCosmetic(id, category, []), id).toBe(false);
      expect(canEquipCosmetic(id, category, [id]), id).toBe(true);
    }
    for (const category of ['RING', 'ENGINE', 'FLAG'] as const) {
      const styles = cosmeticsInCategory(category).map(item => item.style);
      expect(new Set(styles).size, category).toBe(styles.length);
      const accents = cosmeticsInCategory(category).filter(item => !item.free).map(item => item.accent);
      expect(new Set(accents).size, category).toBe(accents.length);
    }
  });
  it('includes two plain standards beside the original two, and never sells them', () => {
    for (const id of ['flag-bastion', 'flag-meridian']) {
      expect(cosmeticById(id)).toMatchObject({ category: 'FLAG', free: true });
      expect(canEquipCosmetic(id, 'FLAG', [])).toBe(true);
    }
    expect(cosmeticsInCategory('FLAG').filter(item => item.free).map(item => item.id))
      .toEqual(['flag-vanguard', 'flag-orbit', 'flag-bastion', 'flag-meridian']);
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
