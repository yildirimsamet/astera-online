import { expect, it } from 'vitest';
import { cosmeticEffectRecipe } from '../src/galaxy/cosmeticEffects.js';
it('has distinct bounded geometric recipes rather than recolours', () => {
  const aurora = cosmeticEffectRecipe('aurora');
  const helios = cosmeticEffectRecipe('helios');
  const singularity = cosmeticEffectRecipe('singularity');
  expect(new Set([aurora.bands, helios.bands, singularity.bands]).size).toBe(3);
  expect(new Set([aurora.motion, helios.motion, singularity.motion]).size).toBe(3);
  for (const recipe of [aurora, helios, singularity]) {
    expect(recipe.bands).toBeLessThanOrEqual(5);
    expect(recipe.particles).toBeLessThanOrEqual(128);
    expect(recipe.radius).toBeGreaterThan(1);
  }
});
it('makes Titan a distinct rocket recipe without allocated CPU particles', () => {
  const titan = cosmeticEffectRecipe('titan');
  expect(titan.motion).toBe(10);
  expect(titan.particles).toBe(0);
  expect(titan.colour).toBe('#ff8f47');
});
