import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createHullBatches, shownInScene } from '../src/galaxy/hullBatches.js';

/*
  OWNER, 2026-10-20: the evening recording drew ~750 calls a frame, and most of them were fleets —
  every formation submitted a body and an outline for every hull type it carried, so the cost grew
  with the number of commanders in the sky. One batch per hull part now carries every formation's
  ships; a formation only writes its ships' world matrices into it.
*/
const geometry = new THREE.BoxGeometry();
const at = (x: number) => new THREE.Matrix4().makeTranslation(x, 0, 0);
const xOf = (mesh: THREE.InstancedMesh, index: number) => {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix).x;
};
const make = (material = new THREE.MeshBasicMaterial()) => () => ({ geometry, material, renderOrder: 999, name: 'formation-hull-bodies-low' });

describe('one draw per hull part across every formation', () => {
  it('collects two formations into one mesh, in the order they wrote', () => {
    const batches = createHullBatches();
    const first = batches.acquire('dart', make());
    const second = batches.acquire('dart', make());
    expect(second).toBe(first);
    batches.write(first, 1, at(1));
    batches.write(second, 1, at(2));
    batches.write(second, 1, at(3));
    const meshes = batches.root.children;
    expect(meshes).toHaveLength(1);
    expect(first.mesh.count).toBe(3);
    expect([0, 1, 2].map((index) => xOf(first.mesh, index))).toEqual([1, 2, 3]);
    expect(first.mesh.name).toBe('formation-hull-bodies-low');
    expect(first.mesh.renderOrder).toBe(999);
    expect(first.mesh.frustumCulled).toBe(false);
  });

  it('starts every frame empty instead of appending to the last one', () => {
    const batches = createHullBatches();
    const batch = batches.acquire('dart', make());
    batches.write(batch, 1, at(1));
    batches.write(batch, 1, at(2));
    batches.write(batch, 2, at(5));
    expect(batch.mesh.count).toBe(1);
    expect(xOf(batch.mesh, 0)).toBe(5);
  });

  it('hides a batch nobody wrote this frame, whether it settles before or after the writers', () => {
    const batches = createHullBatches();
    const written = batches.acquire('dart', make());
    const idle = batches.acquire('viper', make());
    batches.write(idle, 1, at(1));
    // Settled first: the writers that follow in the same frame still count.
    batches.settle(2);
    batches.write(written, 2, at(1));
    expect(written.mesh.count).toBe(1);
    expect(written.mesh.visible).toBe(true);
    expect(idle.mesh.count).toBe(0);
    expect(idle.mesh.visible).toBe(false);
    // Settled last: what was written this frame is kept.
    batches.write(written, 3, at(4));
    batches.settle(3);
    expect(written.mesh.count).toBe(1);
    expect(xOf(written.mesh, 0)).toBe(4);
  });

  it('grows past its capacity without losing the ships already written', () => {
    const batches = createHullBatches();
    const batch = batches.acquire('dart', make());
    const before = batch.mesh;
    for (let index = 0; index < 40; index++) batches.write(batch, 1, at(index));
    expect(batch.mesh.count).toBe(40);
    expect(batch.mesh).not.toBe(before);
    expect(batches.root.children).toEqual([batch.mesh]);
    expect(xOf(batch.mesh, 0)).toBe(0);
    expect(xOf(batch.mesh, 39)).toBe(39);
  });

  it('uploads only the instances written this frame', () => {
    const batches = createHullBatches();
    const batch = batches.acquire('dart', make());
    batches.write(batch, 1, at(1));
    batches.write(batch, 1, at(2));
    const ranges = batch.mesh.instanceMatrix.updateRanges;
    expect(ranges).toEqual([{ start: 0, count: 32 }]);
    expect(batch.mesh.instanceMatrix.version).toBeGreaterThan(0);
  });

  it('frees the batch and the material it made when its last formation leaves, never the shared geometry', () => {
    const batches = createHullBatches();
    const material = new THREE.MeshBasicMaterial();
    let disposed = 0;
    material.addEventListener('dispose', () => { disposed += 1; });
    let geometryDisposed = 0;
    geometry.addEventListener('dispose', () => { geometryDisposed += 1; });
    const first = batches.acquire('dart', make(material));
    batches.acquire('dart', make());
    batches.release(first);
    expect(batches.root.children).toHaveLength(1);
    expect(disposed).toBe(0);
    batches.release(first);
    expect(batches.root.children).toHaveLength(0);
    expect(disposed).toBe(1);
    expect(geometryDisposed).toBe(0);
    const again = batches.acquire('dart', make());
    expect(again).not.toBe(first);
  });

  it('never answers a raycast: the formation hit box owns the press', () => {
    const batches = createHullBatches();
    const batch = batches.acquire('dart', make());
    batches.write(batch, 1, at(0));
    const hits: THREE.Intersection[] = [];
    batch.mesh.raycast(new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1)), hits);
    expect(hits).toHaveLength(0);
  });
});

describe('a formation hidden by any parent writes nothing', () => {
  it('follows visibility up the tree', () => {
    const scene = new THREE.Scene();
    const contact = new THREE.Group();
    const anchor = new THREE.Group();
    scene.add(contact);
    contact.add(anchor);
    expect(shownInScene(anchor)).toBe(true);
    contact.visible = false;
    expect(shownInScene(anchor)).toBe(false);
    contact.visible = true;
    anchor.visible = false;
    expect(shownInScene(anchor)).toBe(false);
  });
});
