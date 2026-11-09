import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCommanderHull, createCommanderExhaust, createCommanderExhaustMaterial, commanderExhaustScale } from '../src/galaxy/commanderAppearance.js';
import { ESCORT_LENGTH, FLEET_CRAFT } from '../src/galaxy/flightVisual.js';
import { PARK } from '../src/galaxy/parkedShip.js';
import { CRAFT_SCALE } from '../src/galaxy/scene.js';

describe('commander presence in the galaxy', () => {
  it('doubles the parked and travelling hulls while keeping the orbit and return scale consistent', () => {
    expect(PARK.length).toBeCloseTo(1.4);
    expect(PARK.radius).toBe(1.7);
    expect(ESCORT_LENGTH).toBeCloseTo(2.3);
    expect(ESCORT_LENGTH * FLEET_CRAFT * CRAFT_SCALE).toBeCloseTo(1.656);
  });

  it('gives the galaxy its own clear-coated materials while preserving the cached hull, textures and glow', () => {
    const source = new THREE.Group();
    const geometry = new THREE.BoxGeometry(); const map = new THREE.Texture();
    const paint = new THREE.MeshStandardMaterial({ color: '#527584', roughness: 0.8, metalness: 0.65, map });
    const hull = new THREE.Mesh(geometry, paint); hull.name = 'hull';
    const wing = new THREE.Mesh(geometry, paint); wing.name = 'wing'; source.add(hull, wing);
    const built = createCommanderHull(source);
    const copy = built.scene.getObjectByName('hull'); const other = built.scene.getObjectByName('wing');
    if (!(copy instanceof THREE.Mesh) || !(other instanceof THREE.Mesh) || !(copy.material instanceof THREE.MeshPhysicalMaterial)) throw new Error('No polished hull');
    expect(copy.geometry).toBe(geometry);
    expect(copy.material).not.toBe(paint);
    expect(copy.material).toBe(other.material);
    expect(copy.material.map).toBe(map);
    expect(copy.material.color.equals(paint.color)).toBe(true);
    expect(copy.material.clearcoat).toBeGreaterThan(0.5);
    expect(copy.material.clearcoatRoughness).toBeLessThanOrEqual(0.2);
    expect(copy.material.roughness).toBeLessThan(paint.roughness);
    expect(paint.roughness).toBe(0.8);
    const clonedDispose = vi.spyOn(copy.material, 'dispose'); const cachedDispose = vi.spyOn(paint, 'dispose');
    const textureDispose = vi.spyOn(map, 'dispose'); const geometryDispose = vi.spyOn(geometry, 'dispose');
    built.dispose();
    expect(clonedDispose).toHaveBeenCalledOnce();
    expect(cachedDispose).not.toHaveBeenCalled(); expect(textureDispose).not.toHaveBeenCalled(); expect(geometryDispose).not.toHaveBeenCalled();
  });

  it('anchors a tapered 3D exhaust behind each nozzle with a visible tail on all three classes', () => {
    const geometry = createCommanderExhaust(); geometry.computeBoundingBox();
    expect(geometry.boundingBox?.max.z).toBeCloseTo(0);
    expect(geometry.boundingBox?.min.z).toBeCloseTo(-1);
    expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true);
    const normals = geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) expect(new THREE.Vector3().fromBufferAttribute(normals, i).length()).toBeCloseTo(1);
    const material = createCommanderExhaustMaterial();
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(THREE.FrontSide);
    material.dispose();
    for (const nozzle of [0.02, 0.048, 0.06]) {
      const scale = commanderExhaustScale(nozzle);
      expect(scale[2]).toBeGreaterThanOrEqual(0.32);
      expect(scale[2]).toBeLessThanOrEqual(0.65);
      expect(scale[0]).toBeGreaterThan(0);
    }
    geometry.dispose();
  });
});
