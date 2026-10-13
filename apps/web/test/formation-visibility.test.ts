import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createLocalVisibility, localSphereVisible, engineUnitsRadius, hullPartRadius } from '../src/galaxy/formationVisibility.js';
import { jetParticle } from '../src/galaxy/rocketJet.js';

it('tests current parent and camera transforms and always draws unknown bounds', () => {
  const state = createLocalVisibility();
  const c = new THREE.PerspectiveCamera(60, 1, 1, 100);
  const parent = new THREE.Group(), child = new THREE.Object3D();
  parent.add(child); parent.position.z = -10;
  expect(localSphereVisible(state, c, child, 2)).toBe(true);
  parent.position.x = 100;
  expect(localSphereVisible(state, c, child, 2)).toBe(false);
  expect(localSphereVisible(state, c, child, Infinity)).toBe(true);
  c.position.x = 100;
  expect(localSphereVisible(state, c, child, 2)).toBe(true);
});

it('includes authored part translation, scale and the outline extrusion in its bound', () => {
  const geometry = new THREE.BoxGeometry(1, 2, 3);
  geometry.translate(3, 0, 0);
  const matrix = new THREE.Matrix4().makeScale(2, 2, 2).setPosition(4, 0, 0);
  const radius = hullPartRadius(geometry, matrix);
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal');
  for (let i = 0; i < position.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(position, i)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(normal, i), 0.004).applyMatrix4(matrix);
    expect(point.length()).toBeLessThanOrEqual(radius);
  }
});

it('bounds the whole animated jet and camera-facing quad at all sampled ages', () => {
  const unit = { at: [3, 1, 2] as [number, number, number], nozzles: [[1, 0, -.5] as [number, number, number]], size: 4, colour: '#fff', intensity: 1, widthFactor: 2, lengthFactor: 3 };
  const radius = engineUnitsRadius([unit]);
  const p = { x: 0, y: 0, z: 0, width: 0, length: 0, age: 0, alpha: 0, frame: 0 };
  for (let t = 0; t < 100; t++) for (let i = 0; i < 24; i++) {
    jetParticle(i, 24, t * .037, p);
    const centre = new THREE.Vector3(p.x * .6 * unit.widthFactor, p.y * .6 * unit.widthFactor,
      (-.025 + (p.z + .025) * unit.lengthFactor) * .55).multiplyScalar(unit.size)
      .addScaledVector(new THREE.Vector3(...unit.nozzles[0]!), unit.size).add(new THREE.Vector3(...unit.at));
    const quad = .5 * unit.size * Math.hypot(p.width * .75 * unit.widthFactor, p.length * .65 * unit.lengthFactor);
    expect(centre.length() + quad).toBeLessThanOrEqual(radius);
  }
});
