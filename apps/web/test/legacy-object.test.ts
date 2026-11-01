import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCoin, buildMedal, buildPin } from '../src/legacy/procedural.js';
import { buildAward } from '../src/legacy/awardObject.js';
import { HULL_MODEL, HULL_LOD_MODEL, MODEL_FACING, MODEL_POSE } from '../src/ui/assets.js';
import { posedCraft } from '../src/galaxy/model.js';

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class {
  setMeshoptDecoder() { return this; }
  loadAsync() {
    const scene = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.6), new THREE.MeshStandardMaterial());
    scene.add(mesh);
    return Promise.resolve({ scene });
  }
} }));
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });

describe('upright relief faces', () => {
  it('maps the top and right of the visible coin/medallion face to texture top and right', () => {
    for (const root of [buildCoin('iron', 'S12', new Set()), buildMedal('iron', 'heart', new Set())]) {
      root.updateMatrixWorld(true);
      const mesh = root.getObjectByProperty('type', 'Mesh');
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      if (!(mesh instanceof THREE.Mesh)) throw new Error('No disc face');
      const geometry: unknown = mesh.geometry;
      if (!(geometry instanceof THREE.BufferGeometry)) throw new Error('No disc geometry');
      const position: unknown = geometry.getAttribute('position'), normal: unknown = geometry.getAttribute('normal'), uv: unknown = geometry.getAttribute('uv');
      if (!(position instanceof THREE.BufferAttribute) || !(normal instanceof THREE.BufferAttribute) || !(uv instanceof THREE.BufferAttribute)) throw new Error('No disc attributes');
      for (let i = 0; i < position.count; i++) {
        if (normal.getZ(i) < 0.9) continue;
        if (position.getY(i) > 0.1) expect(uv.getY(i)).toBeGreaterThan(0.5);
        if (position.getX(i) > 0.1) expect(uv.getX(i)).toBeGreaterThan(0.5);
      }
    }
  });
  it('builds the year badge with real layered metal, a laurel and a raised emblem', () => {
    const pin = buildPin('iron', '2026', new Set());
    for (const name of ['year-laurel', 'year-emblem', 'year-enamel']) expect(pin.getObjectByName(name)).toBeDefined();
  });
});

it('uses the full hull facing/pose for a LOD miniature and keeps its engine frame in the same unit space', async () => {
  const source = new THREE.Group();source.add(new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 0.6), new THREE.MeshStandardMaterial()));
  const full = HULL_MODEL.DART;
  const expected = posedCraft(source, MODEL_FACING[full]!, MODEL_POSE[full]);
  const award = await buildAward({ kind: 'craft', url: HULL_LOD_MODEL.DART, engines: full, flame: true, size: 0.7 }, 'bronze', null);
  const mount = award.engines?.mount;
  expect(mount).toBeDefined();
  if (!mount) throw new Error('No engine mount');
  const actual = mount.children[0]!;
  expected.updateMatrixWorld(true);actual.updateMatrixWorld(true);
  const expectedSize = new THREE.Box3().setFromObject(expected).getSize(new THREE.Vector3());
  // Compare its local graph, before display placement: a raw LOD must not bypass canonical posing.
  expect(actual.children[0]?.type).toBe(expected.children[0]?.type);
  expect(actual.children[0]?.rotation.toArray()).toEqual(expected.children[0]?.rotation.toArray());
  expect(expectedSize.z).toBeGreaterThan(expectedSize.x);
  award.dispose();
});


it('gives the supporter a raised turquoise heart and exposes its face upright', () => {
  const medal = buildMedal('gold', 'heart', new Set());
  const heart = medal.getObjectByName('supporter-heart');
  expect(heart).toBeInstanceOf(THREE.Mesh);
  if (!(heart instanceof THREE.Mesh) || !(heart.material instanceof THREE.MeshStandardMaterial)) throw new Error('No raised heart');
  expect(heart.material.color.g).toBeGreaterThan(heart.material.color.r);
  expect(heart.material.color.b).toBeGreaterThan(heart.material.color.r);
});

it('aims the Death Star visibly upward while its engines share the craft frame', async () => {
  const award = await buildAward({ kind: 'craft', url: '/assets/models/ships/death_star.glb', size: 0.66, flame: true }, 'gold', null);
  const mount = award.engines?.mount;
  if (!mount) throw new Error('No engine mount');
  const nose = new THREE.Vector3(0, 0, 1).applyEuler(mount.rotation);
  expect(nose.y).toBeGreaterThan(0.2);
  expect(nose.x).toBeGreaterThan(0.2);
  award.dispose();
});
