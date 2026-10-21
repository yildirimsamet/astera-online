import * as THREE from 'three';

/**
 * ONE DRAW PER HULL PART ACROSS EVERY FORMATION (owner, 2026-10-20).
 *
 * The evening recording drew ~750 calls a frame with 55 commanders in the sky: each formation
 * submitted a body and an outline for every hull type it carried, so the cost grew with the
 * number of players. Here one instanced mesh per part carries every formation's ships, and a
 * formation only writes its ships' world matrices into it, once per frame.
 *
 * A FRAME IS A NUMBER. The first write of a new frame empties the batch, and `settle` empties
 * the batches nobody wrote — so it does not matter whether the layer's own frame callback runs
 * before or after the formations' (R3F orders same-priority callbacks by subscription).
 */
const FIRST_CAPACITY = 16;

export interface HullBatchSource {
  geometry: THREE.BufferGeometry;
  /** Owned by the batch from here on: disposed with it. The geometry is shared and never is. */
  material: THREE.Material | THREE.Material[];
  renderOrder: number;
  name: string;
}

/** A formation holds this and writes through `write`; it never touches the fields itself. */
export interface HullBatch {
  mesh: THREE.InstancedMesh;
  key: string;
  users: number;
  frame: number;
  cursor: number;
}

const noRaycast = (): void => undefined;

function instanced(source: HullBatchSource, capacity: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(source.geometry, source.material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = source.renderOrder;
  mesh.name = source.name;
  mesh.raycast = noRaycast;
  return mesh;
}

export function createHullBatches() {
  const root = new THREE.Group();
  root.name = 'hull-batches';
  const batches = new Map<string, HullBatch>();

  const grow = (batch: HullBatch): void => {
    const old = batch.mesh;
    const mesh = instanced({ geometry: old.geometry, material: old.material, renderOrder: old.renderOrder, name: old.name },
      old.instanceMatrix.count * 2);
    mesh.instanceMatrix.array.set(old.instanceMatrix.array);
    root.remove(old);
    root.add(mesh);
    old.dispose();
    batch.mesh = mesh;
  };

  return {
    root,

    /** The batch for `key`, made by `make` the first time anybody asks for it. */
    acquire(key: string, make: () => HullBatchSource): HullBatch {
      const existing = batches.get(key);
      if (existing) {
        existing.users += 1;
        return existing;
      }
      const batch: HullBatch = { mesh: instanced(make(), FIRST_CAPACITY), key, users: 1, frame: Number.NaN, cursor: 0 };
      batches.set(key, batch);
      root.add(batch.mesh);
      return batch;
    },

    release(batch: HullBatch): void {
      if (batches.get(batch.key) !== batch) return;
      batch.users -= 1;
      if (batch.users > 0) return;
      batches.delete(batch.key);
      root.remove(batch.mesh);
      const materials = Array.isArray(batch.mesh.material) ? batch.mesh.material : [batch.mesh.material];
      materials.forEach((material) => { material.dispose(); });
      batch.mesh.dispose();
    },

    write(batch: HullBatch, frame: number, matrix: THREE.Matrix4): void {
      if (batch.frame !== frame) {
        batch.frame = frame;
        batch.cursor = 0;
      }
      if (batch.cursor >= batch.mesh.instanceMatrix.count) grow(batch);
      const mesh = batch.mesh;
      mesh.setMatrixAt(batch.cursor, matrix);
      batch.cursor += 1;
      mesh.count = batch.cursor;
      mesh.visible = true;
      const matrices = mesh.instanceMatrix;
      matrices.clearUpdateRanges();
      matrices.addUpdateRange(0, batch.cursor * 16);
      matrices.needsUpdate = true;
    },

    /** Empty every batch nobody has written in `frame`. */
    settle(frame: number): void {
      for (const batch of batches.values()) {
        if (batch.frame === frame) continue;
        batch.frame = frame;
        batch.cursor = 0;
        batch.mesh.count = 0;
        batch.mesh.visible = false;
      }
    },
  };
}

export type HullBatches = ReturnType<typeof createHullBatches>;

/** Three skips a hidden parent's children; a batch outside that parent has to ask. */
export function shownInScene(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}
