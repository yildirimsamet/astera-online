// @vitest-environment node
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { describe, expect, it } from 'vitest';
import { HULL_MODEL, HULL_LOD_MODEL, MODEL_FACING, MODEL_POSE } from '../src/ui/assets.js';
import { posedCraft } from '../src/galaxy/model.js';
import { nativeEngineAnchors } from '../src/galaxy/engineAnchors.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// Decode the actual shipped geometry; pixel decoding belongs to the browser review.
loader.register(() => ({ name: 'EXT_texture_webp', loadTexture: () => Promise.resolve(new THREE.Texture()) }));

async function load(url: string) {
  const bytes = new Uint8Array(readFileSync(`public${url.split('?')[0]}`));
  const gltf = await loader.parseAsync(bytes.buffer, '');
  const craft = posedCraft(gltf.scene, MODEL_FACING[HULL_MODEL.DART]!, MODEL_POSE[HULL_MODEL.DART]);
  craft.updateWorldMatrix(true, true);
  return craft;
}

function positions(geometry: unknown): THREE.BufferAttribute | THREE.InterleavedBufferAttribute {
  if (!(geometry instanceof THREE.BufferGeometry)) throw new Error('No Dart geometry');
  const attribute: unknown = geometry.getAttribute('position');
  if (!(attribute instanceof THREE.BufferAttribute) && !(attribute instanceof THREE.InterleavedBufferAttribute)) throw new Error('No Dart positions');
  return attribute;
}

describe('the shipped Dart geometry', () => {
  it('keeps both tiers level, centred and equal in size with the pointed nose along +Z', async () => {
    const sizes = [];
    for (const url of [HULL_MODEL.DART, HULL_LOD_MODEL.DART]) {
      const craft = await load(url);
      const bounds = new THREE.Box3().setFromObject(craft);
      const size = bounds.getSize(new THREE.Vector3());
      expect(size.z).toBeCloseTo(1, 4);
      expect(size.y).toBeLessThan(0.23);
      expect(bounds.getCenter(new THREE.Vector3()).x).toBeCloseTo(0, 4);
      expect(bounds.getCenter(new THREE.Vector3()).z).toBeCloseTo(0, 4);
      sizes.push(size.toArray());
      const nose = new THREE.Box3(), stern = new THREE.Box3();
      craft.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        const position = positions(node.geometry);
        for (let i = 0; i < position.count; i++) {
          const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
          expect(point.toArray().every(Number.isFinite)).toBe(true);
          if (point.z > 0.45) nose.expandByPoint(point);
          if (point.z < -0.45) stern.expandByPoint(point);
        }
      });
      expect(nose.isEmpty()).toBe(false);
      expect(stern.isEmpty()).toBe(false);
      expect(nose.getSize(new THREE.Vector3()).x).toBeLessThan(stern.getSize(new THREE.Vector3()).x * 0.5);
    }
    for (let axis = 0; axis < 3; axis++) expect(sizes[0]?.[axis]).toBeCloseTo(sizes[1]![axis]!, 3);
  });

  it('attaches every jet to a nozzle rim with a recessed throat in both tiers', async () => {
    const ports = nativeEngineAnchors(HULL_MODEL.DART);
    expect(ports).toHaveLength(4);
    for (const url of [HULL_MODEL.DART, HULL_LOD_MODEL.DART]) {
      const craft = await load(url);
      for (const port of ports ?? []) {
        const ray = new THREE.Raycaster(new THREE.Vector3(port[0], port[1], -0.6), new THREE.Vector3(0, 0, 1));
        const hit = ray.intersectObject(craft, true)[0];
        const rim = new THREE.Box3();
        craft.traverse(node => {
          if (!(node instanceof THREE.Mesh)) return;
          const position = positions(node.geometry);
          for (let i = 0; i < position.count; i++) {
            const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
            if (Math.hypot(point.x - port[0], point.y - port[1]) < 0.05) rim.expandByPoint(point);
          }
        });
        expect(hit, `${url}: nozzle ${port.join(',')} misses the hull`).toBeDefined();
        // The centre ray enters the bell; the flame starts at its outer lip.
        expect(hit!.point.z - port[2]).toBeGreaterThanOrEqual(0);
        expect(hit!.point.z - port[2]).toBeLessThan(0.05);
        expect(rim.min.z).toBeCloseTo(port[2], 2);
      }
    }
  });
});
