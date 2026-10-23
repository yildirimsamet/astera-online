import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ARENA_CATALOG, ARENA_LAYOUT, STRUCTURE_CATALOG, type MeshObstacle } from '@astera/rules/arena';
import { addLamp, lampLevel, withLamp } from '../../src/arena/render/stage.js';

/**
 * Owner 2026-10-22: inside the buildings the player could not tell a wall from a room. The ship
 * carries a lamp: full inside and at a structure, out in open space (the sun lights it there).
 * Not a scene light (owner, same day: no light that costs every pixel of every material): a few
 * lines in the structure materials' own shader, lit from the eye, one shared uniform.
 */
const L = ARENA_LAYOUT;
const piece = (key: string): MeshObstacle => {
  const o = L.obstacles.find((c): c is MeshObstacle => c.shape === 'mesh' && STRUCTURE_CATALOG[c.mesh - ARENA_CATALOG.length]?.key === key);
  if (!o) throw new Error(`no ${key}`);
  return o;
};

describe('the pilot lamp', () => {
  it('burns full inside a building and out in open space', () => {
    expect(lampLevel(L, piece('kit_room').p)).toBe(1);
    expect(lampLevel(L, piece('kit_hall').p)).toBe(1);
    expect(lampLevel(L, piece('kovuk').p)).toBe(1);
    expect(lampLevel(L, { x: 0, y: 1500, z: 0 })).toBe(0);
  });

  it('comes up as a building nears, never past full', () => {
    const room = piece('kit_room');
    const at = (d: number): number => lampLevel(L, { x: room.p.x, y: room.p.y + d, z: room.p.z });
    let last = 1;
    for (let d = 0; d <= 400; d += 20) {
      const level = at(d);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(last + 1e-9);
      last = level;
    }
    expect(at(400)).toBe(0);
  });
});

describe('the lamp in the structure shader', () => {
  const shader = (): { uniforms: Record<string, THREE.IUniform>; fragmentShader: string } => ({
    uniforms: {}, fragmentShader: 'uniform vec3 diffuse;\nvoid main() {\n#include <lights_fragment_end>\n}',
  });

  it('lights the structure from the eye after the scene lights, with one shared uniform', () => {
    const level = { value: 0.5 };
    const a = shader(); const b = shader();
    addLamp(a, level); addLamp(b, level);
    expect(a.uniforms.lampLevel).toBe(level);
    expect(b.uniforms.lampLevel).toBe(level);
    expect(a.fragmentShader).toContain('uniform float lampLevel;');
    // From the eye (view space origin), after the scene's own lights.
    expect(a.fragmentShader.indexOf('#include <lights_fragment_end>')).toBeLessThan(a.fragmentShader.indexOf('vViewPosition'));
  });

  it('gives lamp materials their own program, once however often a shared one is prepared', () => {
    const level = { value: 1 };
    const material = withLamp(withLamp(new THREE.MeshStandardMaterial(), level), level);
    expect(material.customProgramCacheKey().split('lamp')).toHaveLength(2);
    expect(new THREE.MeshStandardMaterial().customProgramCacheKey()).not.toContain('lamp');
  });
});
