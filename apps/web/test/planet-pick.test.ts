import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { hitboxMaterialProps } from '../src/galaxy/hitboxDebug.js';
import { MODEL_PICK_SCALE } from '../src/galaxy/planetLod.js';
import { placeBodies, placePickSpheres, seat, settleMembers } from '../src/galaxy/planetPick.js';

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
 * A GROUP THAT DRAWS ONLY SOME OF ITS WORLDS (the master merge, 2026-09-25). A skin's far
 * billboards and its near models are compacted each pass — only the worlds in that range,
 * in view — so their instances are written in the frame loop, and the members of a slot
 * change as the camera moves. The same stale bounding sphere follows unless the pass
 * settles its members: record who sits where, and measure again when anyone moved.
 */
describe('a compacting group’s members', () => {
  const write = (mesh: THREE.InstancedMesh, index: number, x: number) => {
    mesh.setMatrixAt(index, new THREE.Matrix4().makeTranslation(x, 0, 0));
  };

  it('stay tappable when a pass seats someone new', () => {
    const mesh = pickMesh(3);
    const members: string[] = [];
    let changed = seat(members, 0, 'a');
    write(mesh, 0, 5);
    settleMembers(mesh, members, 1, changed);
    expect(tap(mesh, 5)).toBe(0);

    changed = seat(members, 0, 'c');
    write(mesh, 0, 55);
    settleMembers(mesh, members, 1, changed);
    expect(tap(mesh, 55)).toBe(0);
    expect(tap(mesh, 5)).toBeUndefined();
  });

  it('are the only ones drawn and picked when a pass seats fewer', () => {
    const mesh = pickMesh(3);
    const members: string[] = [];
    seat(members, 0, 'a');
    seat(members, 1, 'b');
    write(mesh, 0, 5);
    write(mesh, 1, 25);
    settleMembers(mesh, members, 2, true);
    const changed = seat(members, 0, 'a');
    settleMembers(mesh, members, 1, changed);
    expect(members).toEqual(['a']);
    expect(mesh.count).toBe(1);
    expect(tap(mesh, 25)).toBeUndefined();
  });

  it('is what both compacting groups settle through', () => {
    const skins = readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8');
    const field = readFileSync('src/galaxy/PlanetField.tsx', 'utf8');
    expect(skins).toMatch(/settleMembers\(hits\.current, hitNodes\.current, hitCount, /);
    expect(field).toMatch(/settleMembers\(mesh, visibleNodes\.current, drawn, /);
  });
});

/**
 * A PICK SPHERE COSTS NO DRAW (code review, 2026-09-25). An invisible material still made
 * the GPU walk ~96 triangles a world every frame. Neither three's raycaster nor R3F's
 * events look at `visible` — the Suspense-hidden worlds that stayed tappable proved it —
 * so an unpainted volume's MATERIAL is hidden (master's `hitboxMaterialProps`, taken in the
 * merge for every pick volume there is), and the sphere is still tapped.
 */
describe('a hidden pick sphere', () => {
  it('is still tapped', () => {
    const mesh = pickMesh(1);
    placePickSpheres(mesh, [node('a', 12)]);
    mesh.visible = false;
    expect(tap(mesh, 12)).toBe(0);
  });

  it('is drawn only while the pick volumes are painted', () => {
    expect(hitboxMaterialProps('planet', false).visible).toBe(false);
    expect(hitboxMaterialProps('planet', true).visible).toBe(true);
    const model = readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8');
    expect(model).toMatch(/name=\{`\$\{name\}-hits`\}[\s\S]{0,400}<HitboxMaterial kind="planet" \/>/);
  });
});

/**
 * A SPECK DOES NOT TURN (code review, 2026-09-25). Every drawn frame rewrote and
 * re-uploaded every world's matrix to turn it — a thousand worlds a frame while the
 * camera moves — and a world under twelve pixels across shows no turn at all. The far
 * tier is placed once per change of members; the others turn.
 */
describe('a world’s body', () => {
  it('is placed on its world, at its size, turned by its own phase and the clock', () => {
    const mesh = pickMesh(2);
    placeBodies(mesh, [node('a', 7)], 0);
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);
    const at = new THREE.Vector3();
    const scale = new THREE.Vector3();
    matrix.decompose(at, new THREE.Quaternion(), scale);
    expect(at.x).toBeCloseTo(7);
    expect(scale.x).toBeCloseTo(0.96);
    const later = new THREE.Matrix4();
    placeBodies(mesh, [node('a', 7)], 10);
    mesh.getMatrixAt(0, later);
    expect(later.equals(matrix)).toBe(false);
  });

  it('turns every frame only above the far tier', () => {
    const model = readFileSync('src/galaxy/PlanetSkinModel.tsx', 'utf8');
    expect(model).toMatch(/turning=\{lod !== 'far'\}/);
    expect(model).toMatch(/if \(!turning\) return;/);
  });
});
