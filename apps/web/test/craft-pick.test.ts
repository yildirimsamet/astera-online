import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { craftPickMatrix, createCraftPickScratch, raycastVisibleCraft, worldUnitsPerPixel } from '../src/galaxy/craftPick.js';

const cameraAt = (distance: number) => {
  const camera = new THREE.PerspectiveCamera(45, 1.5, 0.01, 10000);
  camera.position.z = distance;
  camera.updateMatrixWorld();
  return camera;
};

const bounds = new THREE.Box3(new THREE.Vector3(-.4, -.1, -.5), new THREE.Vector3(.4, .1, .5));
const pickMesh = (camera: THREE.Camera, positions: THREE.Vector3[]) => {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), positions.length);
  const scratch = createCraftPickScratch();
  positions.forEach((position, i) => {
    const local = new THREE.Matrix4().makeTranslation(position.x, position.y, position.z);
    mesh.setMatrixAt(i, craftPickMatrix(bounds, local, mesh.matrixWorld, camera, 800, scratch));
  });
  mesh.computeBoundingSphere();
  return mesh;
};
const hits = (mesh: THREE.Object3D, camera: THREE.Camera, world: THREE.Vector3) => {
  const ndc = world.clone().project(camera);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  return ray.intersectObject(mesh);
};

describe('screen-aware per-hull pick boxes', () => {
  it.each([2, 8, 30])('at range %s picks the hull and leaves a nearby planet accessible', distance => {
    const camera = cameraAt(distance);
    const mesh = pickMesh(camera, [new THREE.Vector3()]);
    expect(hits(mesh, camera, new THREE.Vector3(0, 0, 0))).toHaveLength(2);
    expect(hits(mesh, camera, new THREE.Vector3(.85, 0, -1))).toHaveLength(0);
  });

  it.each([2, 8, 30])('at range %s leaves a formation’s empty corners and gaps open', distance => {
    const camera = cameraAt(distance);
    camera.position.set(0, distance, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const mesh = pickMesh(camera, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-2, 0, -3), new THREE.Vector3(2, 0, -3)]);
    expect(hits(mesh, camera, new THREE.Vector3(2, 0, 0))).toHaveLength(0);
    expect(hits(mesh, camera, new THREE.Vector3(0, 0, -3))).toHaveLength(0);
    expect(hits(mesh, camera, new THREE.Vector3(-2, 0, -3)).length).toBeGreaterThan(0);
  });

  it('uses the posed bounds centre, parent scale and heading without mutating inputs', () => {
    const lifted = bounds.clone().translate(new THREE.Vector3(0, .4, 0));
    const original = lifted.clone();
    const local = new THREE.Matrix4().makeRotationY(Math.PI / 2).scale(new THREE.Vector3(2, 2, 2));
    const before = local.clone();
    const parent = new THREE.Matrix4().makeScale(3, 3, 3);
    const result = craftPickMatrix(lifted, local, parent, cameraAt(10), 800, createCraftPickScratch());
    expect(new THREE.Vector3().setFromMatrixPosition(result).y).toBeCloseTo(.8);
    expect(lifted.equals(original)).toBe(true);
    expect(local.equals(before)).toBe(true);
    expect(result.elements.every(Number.isFinite)).toBe(true);
  });

  it('keeps a small distant craft tappable and never uses a fixed world-space padding floor', () => {
    for (const distance of [2, 8, 30, 500]) {
      const camera = cameraAt(distance);
      const tiny = new THREE.Box3(new THREE.Vector3(-.001, -.001, -.001), new THREE.Vector3(.001, .001, .001));
      const matrix = craftPickMatrix(tiny, new THREE.Matrix4(), new THREE.Matrix4(), camera, 800, createCraftPickScratch());
      const size = new THREE.Vector3().setFromMatrixScale(matrix);
      expect(size.x / worldUnitsPerPixel(camera, new THREE.Vector3(), 800)).toBeCloseTo(16);
    }
  });

  it('measures pixels using camera depth, zoom and CSS viewport height', () => {
    const camera = cameraAt(10);
    const centre = worldUnitsPerPixel(camera, new THREE.Vector3(), 800);
    expect(worldUnitsPerPixel(camera, new THREE.Vector3(20, 0, 0), 800)).toBeCloseTo(centre);
    camera.zoom = 2;
    camera.updateProjectionMatrix();
    expect(worldUnitsPerPixel(camera, new THREE.Vector3(), 800)).toBeCloseTo(centre / 2);
    expect(worldUnitsPerPixel(camera, new THREE.Vector3(), 400)).toBeCloseTo(centre);
  });
});


describe('craft selection visibility', () => {
  it('does not intercept a planet while its hull or a Suspense ancestor is hidden', () => {
    const camera = cameraAt(8);
    const mesh = pickMesh(camera, [new THREE.Vector3()]);
    mesh.raycast = raycastVisibleCraft;
    const parent = new THREE.Group();
    parent.add(mesh);
    expect(hits(mesh, camera, new THREE.Vector3()).length).toBeGreaterThan(0);
    parent.visible = false;
    expect(hits(mesh, camera, new THREE.Vector3())).toHaveLength(0);
    parent.visible = true;
    mesh.visible = false;
    expect(hits(mesh, camera, new THREE.Vector3())).toHaveLength(0);
    mesh.visible = true;
    expect(hits(mesh, camera, new THREE.Vector3()).length).toBeGreaterThan(0);
  });
});
