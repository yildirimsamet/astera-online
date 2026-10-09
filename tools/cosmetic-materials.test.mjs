import { describe, expect, it } from 'vitest';
import { polishSkinPixels, SKIN_PALETTES, skinFeatureLight } from './cosmetic-materials.mjs';

describe('restrained cosmetic surface accents', () => {
  it('preserves neutral armour and alpha without emitting light from the entire hull', () => {
    const source = new Uint8Array([72, 75, 77, 255, 160, 160, 160, 127, 0, 0, 0, 0]);
    const before = source.slice();
    for (const palette of Object.values(SKIN_PALETTES)) {
      const result = polishSkinPixels(source, palette);
      expect(result.color).toEqual(before);
      expect([...result.emissive]).toEqual([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
    }
    expect(source).toEqual(before);
  });
  it('lights existing cyan panel strips and gold machinery while keeping red paint non-emissive', () => {
    const result = polishSkinPixels(new Uint8Array([75, 189, 220, 255, 198, 131, 44, 255, 154, 40, 42, 255]), SKIN_PALETTES['red-dragon']);
    expect(result.emissive[2]).toBeGreaterThan(20);
    expect(result.emissive[4]).toBeGreaterThan(5);
    expect([...result.emissive.slice(8, 11)]).toEqual([0, 0, 0]);
    expect(result.color[8]).toBeGreaterThan(154);
  });
  it('gives every skin its own small accent palette, including UFO', () => {
    const panel = new Uint8Array([70, 180, 220, 255]);
    const appearances = Object.values(SKIN_PALETTES).map(palette => [...polishSkinPixels(panel, palette).color].join(','));
    expect(new Set(appearances).size).toBe(5);
    expect(SKIN_PALETTES.ufo).toBeDefined();
  });
  it('rejects incomplete pixel buffers rather than generating a corrupt texture', () => {
    expect(() => polishSkinPixels(new Uint8Array([1, 2, 3]), SKIN_PALETTES.ufo)).toThrow();
  });
  it('burns at the measured eyes and scorpion needle, with no light beyond their surface regions', () => {
    for (const [name, point] of [
      ['red-dragon', [-.372, .0015, -.039]], ['shark', [-.398, -.024, .035]],
      ['stingray', [.049, -.006, .246]], ['scorpion', [.044, -.114, .267]],
      ['scorpion', [0, .275, -.08]],
    ]) {
      expect(Math.max(...skinFeatureLight(name, point))).toBeGreaterThan(150);
      expect(skinFeatureLight(name, [0, 0, 0])).toEqual([0, 0, 0]);
      expect(skinFeatureLight(name, [1, 1, 1])).toEqual([0, 0, 0]);
    }
    expect(skinFeatureLight('ufo', [0, 0, 0])).toEqual([0, 0, 0]);
    expect(skinFeatureLight('red-dragon', [-.285, .029, -.045])).toEqual([0, 0, 0]);
  });
});
