import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MODEL_PICK_SCALE } from '../src/galaxy/planetLod.js';
import { placePickSpheres } from '../src/galaxy/planetPick.js';

/**
 * A MODELLED WORLD CAN BE TAPPED WHEREVER IT IS (owner, 2026-09-25, on a phone: "bazı
 * gezegenlere tıklayabiliyorum bazılarına tıklayamıyorum ... bazen sanki hiç birine").
 *
 * Three.js tests a ray against an instanced mesh's BOUNDING SPHERE before any instance,
 * and computes that sphere once — at the first raycast — from whatever the instance
 * matrices were then. Placed per frame, a group raycast before its first frame kept a
 * sphere at the origin (nothing in it could be tapped, ever), and a group whose worlds
 * changed as the camera zoomed kept the sphere of its old members (the new ones could
 * not be tapped). The pick spheres are placed once per change of members, and the
 * bounding sphere is measured from them then.
 */
const node = (id: string, x: number) => ({ id, position: [x, 0, 0] as [number, number, number], radius: 1 });

const tap = (mesh: THREE.InstancedMesh, x: number): number | undefined => {
  const raycaster = new THREE.Raycaster(new THREE.Vector3(x, 0, 20), new THREE.Vector3(0, 0, -1));
  const hits: THREE.Intersection[] = [];
  mesh.raycast(raycaster, hits);
  return hits[0]?.instanceId;
};

const pickMesh = (capacity: number) =>
  new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial(), capacity);

describe('a modelled world’s pick spheres', () => {
  it('can be tapped far from the origin, the first time', () => {
    const mesh = pickMesh(4);
    placePickSpheres(mesh, [node('a', 40), node('b', -30)]);
    expect(tap(mesh, 40)).toBe(0);
    expect(tap(mesh, -30)).toBe(1);
  });

  it('can be tapped after its members change, as they do while the camera zooms', () => {
    const mesh = pickMesh(4);
    placePickSpheres(mesh, [node('a', 5)]);
    expect(tap(mesh, 5)).toBe(0);
    placePickSpheres(mesh, [node('a', 5), node('c', 55)]);
    expect(tap(mesh, 55)).toBe(1);
  });

  it('draws and picks only the members there are', () => {
    const mesh = pickMesh(4);
    placePickSpheres(mesh, [node('a', 5), node('c', 55)]);
    placePickSpheres(mesh, [node('a', 5)]);
    expect(mesh.count).toBe(1);
    expect(tap(mesh, 55)).toBeUndefined();
  });

  it('covers the billboard’s area, not just the body', () => {
    const mesh = pickMesh(1);
    placePickSpheres(mesh, [node('a', 0)]);
    // Inside the pick radius, outside the body's.
    expect(tap(mesh, MODEL_PICK_SCALE * 0.98)).toBe(0);
  });
});

/**
 * A PICK SPHERE COSTS NO DRAW (code review, 2026-09-25). An invisible material still made
 * the GPU walk ~96 triangles a world every frame. Neither three's raycaster nor R3F's
 * events look at `visible` — the Suspense-hidden worlds that stayed tappable proved it —
 * so the spheres are hidden unless the pick volumes are being painted, and still tapped.
 */
describe('a hidden pick sphere', () => {
  it('is still tapped', () => {
    const mesh = pickMesh(1);
    placePickSpheres(mesh, [node('a', 12)]);
    mesh.visible = false;
    expect(tap(mesh, 12)).toBe(0);
  });

  it('is drawn only while the pick volumes are painted', () => {
    const model = readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8');
    expect(model).toMatch(/name=\{`\$\{name\}-hits`\}[\s\S]{0,200}visible=\{paintHits\}/);
  });
});
