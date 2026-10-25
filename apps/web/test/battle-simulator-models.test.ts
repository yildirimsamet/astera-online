import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { battleModelParts } from '../src/battle-simulator/sceneModels.js';

describe('battle models retain authored node transforms', () => {
  it('keeps quantised geometry intact and carries node transforms in the instance matrix', () => {
    const geometry = new THREE.BufferGeometry();
    const original = new Uint16Array([0, 0, 0, 65535, 0, 0, 0, 65535, 65535]);
    geometry.setAttribute('position', new THREE.BufferAttribute(original.slice(), 3, true));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.scale.set(3, 2, 5); mesh.position.set(1, 2, 3);
    const scene = new THREE.Group(); scene.add(mesh);
    const parts = battleModelParts(scene, '+z');
    expect(parts).toHaveLength(1);
    expect(parts[0]!.geometry).toBe(geometry);
    expect(geometry.attributes.position!.array).toEqual(original);
    const positions = geometry.attributes.position!;
    const points = Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(parts[0]!.matrix));
    const bounds = new THREE.Box3().setFromPoints(points), size = bounds.getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(1);
    expect(bounds.getCenter(new THREE.Vector3()).length()).toBeCloseTo(0);
    expect(parts[0]!.material).not.toBe(mesh.material);
  });

  it('reuses full-detail paint on a geometry-only LOD while preserving its simpler geometry', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1), bare = new THREE.MeshStandardMaterial({ color: '#ffffff' });
    const paint = new THREE.MeshStandardMaterial({ color: '#d02d2d', roughness: .6 });
    const scene = new THREE.Group(); scene.add(new THREE.Mesh(geometry, bare));
    const parts = battleModelParts(scene, '+z', undefined, [paint]);
    const material = Array.isArray(parts[0]!.material) ? parts[0]!.material[0]! : parts[0]!.material;
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    if (material instanceof THREE.MeshStandardMaterial) expect(material.color.getHexString()).toBe('d02d2d');
    expect(material).not.toBe(paint);
    expect(parts[0]!.geometry).toBe(geometry);
  });
});
