import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { planetSurfaceProbes } from '../src/galaxy/planetSkinAttachments.js';

const fixtures = {
  indexed: () => new THREE.SphereGeometry(1, 24, 16),
  unindexed: () => new THREE.IcosahedronGeometry(1, 3),
  seams: () => new THREE.BoxGeometry(1.2, 1.2, 1.2),
  fractured: () => new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, Math.PI / 3, Math.PI * 2 / 3),
  ranged: () => {
    const geometry = new THREE.SphereGeometry(1, 24, 16);
    geometry.setDrawRange(48, 720);
    return geometry;
  },
};

describe('planet surface query', () => {
  it('avoids a full native triangle scan for each of the 384 surface directions', () => {
    const geometry = new THREE.SphereGeometry(1, 48, 32);
    const native = vi.spyOn(THREE.Mesh.prototype, 'raycast');
    try {
      expect(planetSurfaceProbes(geometry).length).toBeGreaterThan(300);
      expect(native).not.toHaveBeenCalled();
    } finally {
      native.mockRestore();
      geometry.dispose();
    }
  });

  it.each(Object.entries(fixtures))('keeps the exact native surface radius and face normal for %s geometry', (_, create) => {
    const geometry = create();
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    const ray = new THREE.Raycaster();
    try {
      const probes = planetSurfaceProbes(geometry);
      expect(probes.length).toBeGreaterThan(20);
      for (const probe of probes) {
        ray.set(probe.direction.clone().multiplyScalar(4), probe.direction.clone().negate());
        const expected = ray.intersectObject(mesh, false)[0];
        expect(expected).toBeDefined();
        expect(probe.radius).toBe(expected!.point.dot(probe.direction));
        expect(probe.normal.toArray()).toEqual(expected!.face!.normal.clone().normalize().toArray());
      }
    } finally {
      material.dispose();
      geometry.dispose();
    }
  });

  it.each(['indexed', 'unindexed'] as const)('preserves shared %s geometry and returns the same cached probes', (kind) => {
    const geometry = fixtures[kind]();
    geometry.addGroup(0, 12, 0);
    const attributes = Object.entries(geometry.attributes).map(([name, attribute]) => ({
      name, attribute, values: Array.from(attribute.array),
      version: attribute instanceof THREE.InterleavedBufferAttribute ? attribute.data.version : attribute.version,
    }));
    const index = geometry.index;
    const indices = index ? Array.from(index.array) : null;
    const groups = geometry.groups.map(group => ({ ...group }));
    const drawRange = { ...geometry.drawRange };
    const boundingBox = geometry.boundingBox;
    const dispose = vi.spyOn(geometry, 'dispose');
    try {
      const probes = planetSurfaceProbes(geometry);
      expect(planetSurfaceProbes(geometry)).toBe(probes);
      for (const before of attributes) {
        expect(geometry.getAttribute(before.name)).toBe(before.attribute);
        expect(Array.from(before.attribute.array)).toEqual(before.values);
        const version = before.attribute instanceof THREE.InterleavedBufferAttribute
          ? before.attribute.data.version : before.attribute.version;
        expect(version).toBe(before.version);
      }
      expect(geometry.index).toBe(index);
      expect(geometry.index ? Array.from(geometry.index.array) : null).toEqual(indices);
      expect(geometry.groups).toEqual(groups);
      expect(geometry.drawRange).toEqual(drawRange);
      expect(geometry.boundingBox).toBe(boundingBox);
      expect(dispose).not.toHaveBeenCalled();
    } finally {
      dispose.mockRestore();
      geometry.dispose();
    }
  });
});
