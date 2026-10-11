import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { formationLodParts } from '../src/galaxy/Fleets.js';
import { HULL_MODEL } from '../src/ui/assets.js';

describe('geometry-only formation LODs', () => {
  it('draws the low geometry with the native full surface maps instead of a white loader default', () => {
    const low = new THREE.Group();
    const lowGeometry = new THREE.BoxGeometry();
    low.add(new THREE.Mesh(lowGeometry, new THREE.MeshStandardMaterial()));
    const map = new THREE.Texture(), native = new THREE.MeshStandardMaterial({ map, roughness: 0.23, metalness: 0.8 });
    const full = [{ geometry: new THREE.SphereGeometry(), material: native, matrix: new THREE.Matrix4() }];
    const parts = formationLodParts(low, HULL_MODEL.DART, full);
    expect(parts[0]?.geometry).toBe(lowGeometry);
    expect(parts[0]?.material).toBe(native);
    expect(native.roughness).toBe(0.23);
    expect(native.map).toBe(map);
  });
});
