import { runInNewContext } from 'node:vm';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { commanderEscortsReady } from '../../../tools/commander-sight-visual.mjs';

// Playwright serializes the predicate into the page too: no module closures may be required.
function ready(scene?: THREE.Group, minimum = 2): unknown {
  return runInNewContext(`(${commanderEscortsReady.toString()})(${String(minimum)})`, {
    window: { __galaxy: scene ? { scene } : undefined },
  });
}

function escort(loaded = false) {
  const group = new THREE.Group();
  group.name = 'flight-escort';
  const hit = new THREE.Mesh();
  hit.name = 'escort-hit-target';
  group.add(hit, new THREE.Group()); // Html's group exists even while the model is missing.
  if (loaded) group.add(new THREE.Mesh());
  return group;
}

describe('the visual recovery check requires real commander models', () => {
  it('rejects a missing scene', () => { expect(ready()).toBe(false); });

  it('rejects empty escorts even though their hit targets and labels exist', () => {
    const scene = new THREE.Group();
    scene.add(escort(), escort());
    expect(ready(scene)).toBe(false);
  });

  it('waits for every escort model, not just one', () => {
    const scene = new THREE.Group();
    scene.add(escort(true), escort());
    expect(ready(scene)).toBe(false);
    scene.children[1]!.add(new THREE.Mesh());
    expect(ready(scene)).toBe(true);
  });

  it('supports the single-escort fixture without passing when no escort exists', () => {
    const scene = new THREE.Group();
    expect(ready(scene, 1)).toBe(false);
    scene.add(escort(true));
    expect(ready(scene, 1)).toBe(true);
    expect(ready(scene)).toBe(false);
  });
});
