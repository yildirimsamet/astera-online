import * as THREE from 'three';
import { expect, it } from 'vitest';
import { normalizedCosmeticModel } from '../src/galaxy/cosmeticModel.js';

it('fits differently scaled models into the same preview without compressing their shape or changing the source', () => {
  for (const units of [.01, 1, 100]) {
    const scene = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2));
    body.scale.setScalar(units); body.position.set(7 * units, 3 * units, 2 * units); scene.add(body);
    for (const facing of [undefined, '-x'] as const) {
      const model = normalizedCosmeticModel(scene, facing);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(1.7, 5);
      expect(box.getCenter(new THREE.Vector3()).length()).toBeLessThan(.00001);
      expect(size.y / Math.max(size.x, size.z)).toBeCloseTo(.25, 5);
      expect(body.position.x).toBe(7 * units);
      expect(body.scale.x).toBe(units);
    }
  }
});
