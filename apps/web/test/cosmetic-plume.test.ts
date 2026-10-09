import { expect, it } from 'vitest';
import { plumeRadius, plumeOpacity, createPlumeGeometry } from '../src/galaxy/cosmeticPlume.js';
it('starts narrow at the nozzle, blooms downstream and dissolves at both ends', () => {
  expect(plumeRadius(0)).toBeLessThan(plumeRadius(.22));
  expect(plumeRadius(1)).toBe(0);
  expect(plumeOpacity(0)).toBe(0);
  expect(plumeOpacity(1)).toBe(0);
  expect(plumeOpacity(.2)).toBeGreaterThan(.5);
});
it('is a bounded volume around the exhaust axis rather than intersecting flat cards', () => {
  const geometry = createPlumeGeometry();
  geometry.computeBoundingBox();
  expect(geometry.boundingBox!.max.z).toBeLessThan(0);
  expect(geometry.boundingBox!.min.x).toBeLessThan(-.1);
  expect(geometry.boundingBox!.max.y).toBeGreaterThan(.1);
  expect(geometry.index!.count / 3).toBeLessThan(1600);
  geometry.dispose();
});

it('gives solar exhaust shock chambers and the void exhaust a narrower silhouette', () => {
  expect(plumeRadius(.2, 'singularity')).toBeLessThan(plumeRadius(.2, 'aurora') * .7);
  const solar = [.12, .18, .24, .3].map(t => plumeRadius(t, 'helios'));
  expect(Math.max(...solar) / Math.min(...solar)).toBeGreaterThan(1.5);
});

it('gives Titan a shorter restrained rocket volume with a cheaper fixed geometry budget', () => {
  const geometry = createPlumeGeometry('titan');
  const original = createPlumeGeometry('aurora');
  geometry.computeBoundingBox();
  original.computeBoundingBox();
  expect(geometry.index!.count / 3).toBeLessThanOrEqual(800);
  expect(geometry.boundingBox!.min.z).toBeGreaterThan(original.boundingBox!.min.z);
  expect(plumeRadius(.3, 'titan')).toBeLessThan(plumeRadius(.3, 'aurora'));
  expect(plumeRadius(1, 'titan')).toBe(0);
  expect(geometry.getAttribute('aEnvelope').getX(0)).toBe(0);
  geometry.dispose(); original.dispose();
});
