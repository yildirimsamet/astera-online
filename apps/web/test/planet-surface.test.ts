import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { NIGHT_FLOOR, planetSurface } from '../src/galaxy/planetSurface.js';

/**
 * A WORLD'S SURFACE ON THE DISC AND ON ITS CARD (F9). Owner, 2026-09-25: "gezegenimin
 * bile dibinden bakıyom ama yarısı zifiri karanlık" — the scene's ambient light barely
 * reaches the night side, so half of every world read as a hole.
 *
 * One surface for the disc and the card: matte (a planet is not a polished ball), and
 * never black — the night side keeps a floor of its own colour, dimmed with the world
 * like the rest of it, so the terminator still reads and the half away from the light
 * is a darker world rather than nothing.
 */
const authored = () => {
  const map = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({
    map,
    normalMap: new THREE.Texture(),
    roughnessMap: new THREE.Texture(),
    metalnessMap: new THREE.Texture(),
    metalness: 1,
    roughness: 1,
  });
  return { material, map };
};

describe('a world’s surface', () => {
  it('is matte, whatever the model was exported with', () => {
    const surface = planetSurface(authored().material, true) as THREE.MeshStandardMaterial;
    expect(surface.metalness).toBe(0);
    expect(surface.metalnessMap).toBeNull();
  });

  it('keeps a floor of its own colour on the night side', () => {
    const { material, map } = authored();
    const surface = planetSurface(material, true) as THREE.MeshStandardMaterial;
    expect(surface.emissiveMap).toBe(map);
    expect(surface.emissive.r).toBeCloseTo(NIGHT_FLOOR);
    expect(NIGHT_FLOOR).toBeGreaterThan(0.1);
    expect(NIGHT_FLOOR).toBeLessThan(0.4);
  });

  /** A dimmed world (unread, a stranger's) is dimmed on its night side too, not lit by the floor. */
  it('dims the floor with the world’s own tint', () => {
    const surface = planetSurface(authored().material, false);
    const shader = { fragmentShader: '#include <emissivemap_fragment>\n', vertexShader: '', uniforms: {} };
    surface.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    expect(shader.fragmentShader).toMatch(/totalEmissiveRadiance \*= vColor\.rgb/);
  });

  it('drops the tiled detail maps when seen small, and keeps them up close', () => {
    const lite = planetSurface(authored().material, false) as THREE.MeshStandardMaterial;
    expect(lite.normalMap).toBeNull();
    expect(lite.roughnessMap).toBeNull();
    const full = planetSurface(authored().material, true) as THREE.MeshStandardMaterial;
    expect(full.normalMap).not.toBeNull();
    expect(full.roughnessMap).not.toBeNull();
  });

  it('never touches the model’s own material', () => {
    const { material } = authored();
    planetSurface(material, false);
    expect(material.metalness).toBe(1);
    expect(material.normalMap).not.toBeNull();
  });
});
