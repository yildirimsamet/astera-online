import { expect, it } from 'vitest';
import { cosmeticsInCategory, type CosmeticStyle } from '@astera/rules';
import { cosmeticEffectRecipe, effectFragment, effectProgram, effectVertex } from '../src/galaxy/cosmeticEffects.js';
import { prismShardTransforms, saturnRingProfile } from '../src/galaxy/cosmeticRings.js';
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

const LEGACY: readonly CosmeticStyle[] = ['aurora', 'helios', 'singularity', 'titan', 'vanguard', 'orbit', 'reaper', 'ravager', 'serpent', 'phoenix', 'ironfang'];
const styles = (category: 'RING' | 'ENGINE' | 'FLAG') => cosmeticsInCategory(category).map(item => item.style!);

it('gives every catalogued style its own recipe instead of silently falling back to Aurora', () => {
  for (const category of ['RING', 'ENGINE', 'FLAG'] as const) {
    const motions = styles(category).map(style => cosmeticEffectRecipe(style).motion);
    expect(new Set(motions).size, category).toBe(motions.length);
  }
  for (const style of styles('RING')) {
    const recipe = cosmeticEffectRecipe(style);
    expect(recipe.particles, style).toBeLessThanOrEqual(128);
    expect(recipe.radius, style).toBeGreaterThan(1);
    expect(recipe.radius, style).toBeLessThan(2.2);
  }
});

it('leaves every product sold before this wave on its original shared program', () => {
  for (const style of LEGACY) for (const kind of [0, 1, 2]) {
    expect(effectProgram(style, kind)).toEqual({ vertexShader: effectVertex, fragmentShader: effectFragment });
  }
});

it('isolates each new ring and engine in its own program, so one faulty driver path cannot blank the others', () => {
  const rings = ['saturn', 'prism', 'inferno', 'nebula'] as const;
  const programs = rings.map(style => effectProgram(style, 0).fragmentShader);
  expect(new Set(programs).size).toBe(rings.length);
  for (const [style, kind] of [...rings.map(style => [style, 0] as const), ['tempest', 1], ['prism', 1]] as const) {
    expect(effectProgram(style, kind).fragmentShader, style).not.toBe(effectFragment);
  }
  expect(effectProgram('tempest', 1).fragmentShader).not.toBe(effectProgram('prism', 1).fragmentShader);
  expect(effectProgram('prism', 1).fragmentShader).not.toBe(effectProgram('prism', 0).fragmentShader);
});

it('gilds only the paid standards of the new wave; the included ones stay plain cloth', () => {
  const wave = ['sovereign', 'kraken', 'oni', 'voideye', 'valkyrie', 'scarab', 'stag', 'horizon', 'tiger', 'scorpion'] as const;
  for (const style of wave) expect(cosmeticEffectRecipe(style).sheen, style).toBe(true);
  for (const style of ['bastion', 'meridian'] as const) expect(cosmeticEffectRecipe(style).sheen, style).toBe(false);
  for (const style of [...wave, 'bastion', 'meridian'] as const) {
    expect(effectProgram(style, 2).fragmentShader).not.toBe(effectFragment);
    expect(effectProgram(style, 2).fragmentShader).toContain('uSheen');
  }
});

it('builds the Saturn profile from real ring anatomy: faint C ring, dense B ring, Cassini and Encke gaps', () => {
  const profile = saturnRingProfile(256);
  expect(profile).toHaveLength(256 * 4);
  const density = (r: number) => profile[Math.min(255, Math.floor(r * 256)) * 4 + 3]! / 255;
  const average = (from: number, to: number) => {
    let sum = 0, n = 0;
    for (let r = from; r < to; r += 1 / 512) { sum += density(r); n++; }
    return sum / n;
  };
  // Saturn's own proportions from the C ring's inner edge to the F ring.
  const cRing = average(.03, .24), bRing = average(.3, .62), cassini = average(.665, .71), aRing = average(.74, .88);
  expect(bRing).toBeGreaterThan(.7);
  expect(cRing).toBeLessThan(bRing * .45);
  expect(cassini).toBeLessThan(bRing * .2);
  expect(aRing).toBeGreaterThan(cassini * 3);
  expect(aRing).toBeLessThan(bRing);
  expect(Math.min(...[.89, .894, .898].map(density))).toBeLessThan(aRing * .5);
  expect(density(0)).toBe(0);
  expect(density(.999)).toBeLessThan(.08);
  expect(saturnRingProfile(256)).toEqual(profile);
});

it('lays the Prism shards in one bounded, deterministic band', () => {
  const shards = prismShardTransforms();
  expect(shards.length).toBeGreaterThanOrEqual(90);
  expect(shards.length).toBeLessThanOrEqual(160);
  for (const shard of shards) {
    const radius = Math.hypot(shard.position[0], shard.position[2]);
    expect(radius).toBeGreaterThan(1.2);
    expect(radius).toBeLessThan(2.1);
    expect(Math.abs(shard.position[1])).toBeLessThan(.2);
    expect(shard.scale).toBeGreaterThan(0);
    expect(shard.scale).toBeLessThan(.09);
  }
  expect(prismShardTransforms()).toEqual(shards);
  // A crystal cloud with real thickness, so the belt still reads when seen nearly edge-on.
  expect(Math.max(...shards.map(shard => Math.abs(shard.position[1])))).toBeGreaterThan(.1);
});
