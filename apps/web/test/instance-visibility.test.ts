import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createInstanceVisibility, updateVisibleMembers } from '../src/galaxy/instanceVisibility.js';

const sphere = (x: number, radius = 1) => ({ position: [x, 0, -10] as const, radius });
const camera = () => { const c = new THREE.PerspectiveCamera(90, 1, 1, 100); c.updateMatrixWorld(); return c; };

it('compacts spheres conservatively and retains identity across empty and restored views', () => {
  const state = createInstanceVisibility<ReturnType<typeof sphere>>();
  const c = camera(), object = new THREE.Object3D();
  const nodes = [sphere(100), sphere(0), sphere(10.8)];
  expect(updateVisibleMembers(state, c, object, nodes, 1)).toBe(true);
  expect(state.members).toEqual([nodes[1], nodes[2]]);
  expect(updateVisibleMembers(state, c, object, nodes, 1)).toBe(false);
  c.position.x = 200; c.updateMatrixWorld();
  updateVisibleMembers(state, c, object, nodes, 1);
  expect(state.members).toEqual([]);
  c.position.x = 0; c.updateMatrixWorld();
  updateVisibleMembers(state, c, object, nodes, 1);
  expect(state.members).toEqual([nodes[1], nodes[2]]);
});

it('invalidates for projection, parent transforms and replaced data', () => {
  const state = createInstanceVisibility<ReturnType<typeof sphere>>();
  const c = camera(), parent = new THREE.Group(), object = new THREE.Object3D();
  parent.add(object);
  const nodes = [sphere(0), sphere(15)];
  updateVisibleMembers(state, c, object, nodes, 1);
  expect(state.members).toHaveLength(1);
  c.aspect = 2; c.updateProjectionMatrix();
  updateVisibleMembers(state, c, object, nodes, 1);
  expect(state.members).toHaveLength(2);
  parent.position.x = 200;
  updateVisibleMembers(state, c, object, nodes, 1);
  expect(state.members).toHaveLength(0);
  parent.position.x = 0;
  updateVisibleMembers(state, c, object, [sphere(5)], 1);
  expect(state.members[0]?.position[0]).toBe(5);
});

it('keeps the maximum shield breath at the frustum boundary', () => {
  const state = createInstanceVisibility<ReturnType<typeof sphere>>();
  const nodes = [sphere(10 + Math.SQRT2 * 1.006)];
  const c = camera(), object = new THREE.Object3D();
  updateVisibleMembers(state, c, object, nodes, 1);
  expect(state.members).toHaveLength(0);
  updateVisibleMembers(state, c, object, nodes, 1.012);
  expect(state.members).toHaveLength(1);
});
