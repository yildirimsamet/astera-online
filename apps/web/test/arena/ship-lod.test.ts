import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LOD_FADE, ShipDetail, ditherMaterial, ditherUniforms, injectDither, lodLevel } from '../../src/arena/render/detail.js';

/**
 * Y3: a far ship is drawn from a lighter level of detail, and the change never pops — the
 * two levels cross-dissolve through a screen-door dither for LOD_FADE seconds.
 */
describe('choosing a level of detail', () => {
  it('draws the full hull up close and the lighter ones farther out, in ship lengths', () => {
    expect(lodLevel(0, 2, 3)).toBe(0);
    expect(lodLevel(0, 12, 3)).toBe(1);
    expect(lodLevel(0, 40, 3)).toBe(2);
  });

  it('holds a level across a band, so a ship hovering at a threshold does not flicker', () => {
    const edge = lodLevel(0, 7.9, 3);
    expect(edge).toBe(0);
    expect(lodLevel(1, 7.9, 3)).toBe(1);
    expect(lodLevel(0, 8.1, 3)).toBe(0);
    expect(lodLevel(1, 6, 3)).toBe(0);
  });

  it('never asks for a level the model does not have', () => {
    expect(lodLevel(0, 400, 1)).toBe(0);
    expect(lodLevel(0, 400, 2)).toBe(1);
  });
});

const level = (): { group: THREE.Group; materials: THREE.MeshStandardMaterial[] } => {
  const material = ditherMaterial(new THREE.MeshStandardMaterial());
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BufferGeometry(), material));
  return { group, materials: [material] };
};
const fade = (material: THREE.Material | undefined): { fade: number; side: number } => {
  const uniforms = material ? ditherUniforms(material) : null;
  if (!uniforms) throw new Error('no dither uniforms');
  return { fade: uniforms.lodFade.value, side: uniforms.lodSide.value };
};

describe('a ship changing level', () => {
  it('starts on the full hull, alone and undithered', () => {
    const levels = [level(), level(), level()];
    new ShipDetail(levels);
    expect(levels.map(l => l.group.visible)).toEqual([true, false, false]);
    expect(fade(levels[0]?.materials[0])).toEqual({ fade: 1, side: 0 });
  });

  it('dissolves from one level into the next, then hides the old one', () => {
    const levels = [level(), level(), level()];
    const detail = new ShipDetail(levels);
    detail.update(12, 0);
    expect(levels.map(l => l.group.visible)).toEqual([true, true, false]);
    detail.update(12, LOD_FADE / 2);
    expect(fade(levels[1]?.materials[0]).fade).toBeCloseTo(0.5, 5);
    expect(fade(levels[1]?.materials[0]).side).toBe(0);
    expect(fade(levels[0]?.materials[0])).toEqual({ fade: fade(levels[1]?.materials[0]).fade, side: 1 });
    detail.update(12, LOD_FADE);
    expect(levels.map(l => l.group.visible)).toEqual([false, true, false]);
    expect(fade(levels[1]?.materials[0])).toEqual({ fade: 1, side: 0 });
    expect(detail.level).toBe(1);
  });

  it('finishes one dissolve before starting the next', () => {
    const levels = [level(), level(), level()];
    const detail = new ShipDetail(levels);
    detail.update(12, 0);
    detail.update(60, LOD_FADE / 4);
    expect(levels.map(l => l.group.visible)).toEqual([true, true, false]);
    detail.update(60, LOD_FADE);
    detail.update(60, 0);
    expect(levels.map(l => l.group.visible)).toEqual([false, true, true]);
  });

  it('does nothing for a model with one level', () => {
    const only = level();
    const detail = new ShipDetail([only]);
    detail.update(400, 1);
    expect(only.group.visible).toBe(true);
    expect(detail.level).toBe(0);
  });
});

describe('the dither', () => {
  it('discards by a screen-door pattern and shares one program across ships', () => {
    const material = ditherMaterial(new THREE.MeshStandardMaterial({ roughness: 0.3 }));
    const uniforms = ditherUniforms(material);
    if (!uniforms) throw new Error('no dither uniforms');
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, fragmentShader: '#include <common>\nvoid main() {\n#include <clipping_planes_fragment>\n}' };
    injectDither(shader, uniforms);
    expect(shader.fragmentShader).toContain('discard');
    expect(shader.fragmentShader).toContain('#include <clipping_planes_fragment>');
    expect(shader.uniforms.lodFade).toBe(uniforms.lodFade);
    expect(material.customProgramCacheKey()).toBe(ditherMaterial(new THREE.MeshStandardMaterial()).customProgramCacheKey());
    expect(material.roughness).toBe(0.3);
  });

  it('is not on a material it was not put on', () => {
    expect(ditherUniforms(new THREE.MeshStandardMaterial())).toBeNull();
  });
});
