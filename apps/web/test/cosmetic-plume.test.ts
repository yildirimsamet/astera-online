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

it('gives Tempest a tight arc channel and Prism a beam that fans out downstream, both closing at the tail', () => {
  for (const style of ['tempest', 'prism'] as const) {
    const geometry = createPlumeGeometry(style);
    expect(geometry.index!.count / 3, style).toBeLessThanOrEqual(style === 'tempest' ? 1538 : 1536);
    expect(plumeRadius(1, style), style).toBe(0);
    expect(plumeRadius(0, style), style).toBeLessThan(plumeRadius(.2, style));
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.z, style).toBeLessThan(0);
    geometry.dispose();
  }
  expect(plumeRadius(.6, 'prism')).toBeGreaterThan(plumeRadius(.15, 'prism') * 1.3);
  expect(plumeRadius(.6, 'prism')).toBeGreaterThan(plumeRadius(.6, 'aurora'));
  expect(plumeRadius(.3, 'tempest')).toBeLessThan(plumeRadius(.3, 'aurora'));
  expect(plumeRadius(.3, 'tempest')).toBeGreaterThan(plumeRadius(.3, 'singularity'));
});

it('reserves just one extra two-triangle patch for Tempest map lightning', () => {
  const tempest = createPlumeGeometry('tempest');
  const prism = createPlumeGeometry('prism');
  const uv = tempest.getAttribute('uv');
  let flashVertices = 0;
  for (let i = 0; i < uv.count; i++) if (uv.getX(i) >= 4) flashVertices++;
  expect(flashVertices).toBe(4);
  expect(tempest.index!.count - prism.index!.count).toBe(6);
  tempest.dispose(); prism.dispose();
});

it('gives Mach shock pinches, Pulsar a short teardrop jet and Ion a needle throat into a long widening wake', () => {
  const tail = (style: 'aurora' | 'mach' | 'pulsar' | 'ion') => {
    const geometry = createPlumeGeometry(style);
    geometry.computeBoundingBox();
    const z = geometry.boundingBox!.min.z;
    geometry.dispose();
    return z;
  };
  for (const style of ['mach', 'pulsar', 'ion'] as const) {
    const geometry = createPlumeGeometry(style);
    expect(geometry.index!.count / 3, style).toBeLessThanOrEqual(1536);
    expect(plumeRadius(1, style), style).toBe(0);
    expect(plumeRadius(0, style), style).toBeLessThan(plumeRadius(.15, style));
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.z, style).toBeLessThan(0);
    geometry.dispose();
  }
  // Mach: a few soft diamonds down the first half of the jet, gentler than Helios' twelve chambers.
  const samples = Array.from({ length: 121 }, (_, i) => plumeRadius(i * .005, 'mach'));
  const pinches = samples.filter((r, i) => i > 0 && i < samples.length - 1 && r < samples[i - 1]! && r < samples[i + 1]!).length;
  expect(pinches).toBeGreaterThanOrEqual(3);
  expect(pinches).toBeLessThanOrEqual(5);
  // Pulsar: fattest just behind the nozzle, and the shortest flame in the shop.
  const pulsar = Array.from({ length: 101 }, (_, i) => plumeRadius(i / 100, 'pulsar'));
  const aurora = Array.from({ length: 101 }, (_, i) => plumeRadius(i / 100, 'aurora'));
  expect(pulsar.indexOf(Math.max(...pulsar))).toBeLessThan(aurora.indexOf(Math.max(...aurora)));
  expect(tail('pulsar')).toBeGreaterThan(tail('aurora') * .8);
  // Ion: a needle at the nozzle, a wake that keeps widening, the longest flame.
  expect(plumeRadius(.05, 'ion')).toBeLessThan(plumeRadius(.05, 'aurora') * .7);
  expect(plumeRadius(.6, 'ion')).toBeGreaterThan(plumeRadius(.15, 'ion') * 1.3);
  expect(tail('ion')).toBeLessThan(tail('aurora'));
});
