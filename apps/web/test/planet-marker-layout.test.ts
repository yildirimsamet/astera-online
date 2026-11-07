import { expect, it } from 'vitest';
import { planetMarkerLayout } from '../src/galaxy/planetMarkerLayout.js';

it.each([7, 40, 80, 400])('keeps eyes and pins readable alongside text at depth %s', depth => {
  for (const radius of [0.3, 0.7, 1.2]) {
    const pixel = 2 * depth * Math.tan(Math.PI / 8) / 812;
    const layout = planetMarkerLayout({ radius, intel: 'UNKNOWN', isOwned: false, isCapital: false }, depth, 812, 45);
    expect(layout.eyeSize / pixel).toBeGreaterThanOrEqual(9);
    expect(layout.eyeSize / pixel).toBeLessThanOrEqual(31);
    expect(layout.pinScale * 0.2 / pixel).toBeGreaterThanOrEqual(4);
    expect(layout.pinScale * 0.2 / pixel).toBeLessThanOrEqual(10);
    expect(layout.eyeOffset - layout.eyeSize / 2).toBeGreaterThan(radius);
    expect(layout.labelOffset).toBeGreaterThan(layout.eyeOffset + layout.eyeSize / 2);
  }
});

it('preserves depth with smooth size and ink changes instead of one flat pixel floor', () => {
  const body = { radius: 0.4, intel: 'UNKNOWN' as const, isOwned: false, isCapital: false };
  const depths = [7, 30, 60, 120, 400];
  const sizes = depths.map(depth => {
    const layout = planetMarkerLayout(body, depth, 812, 45);
    return { eye: layout.eyeSize / (2 * depth * Math.tan(Math.PI / 8) / 812), ink: layout.ink, grey: layout.grey };
  });
  for (let i = 1; i < sizes.length; i++) {
    expect(sizes[i]!.eye).toBeLessThan(sizes[i - 1]!.eye);
    expect(sizes[i]!.ink).toBeLessThan(sizes[i - 1]!.ink);
    expect(sizes[i]!.grey).toBeGreaterThan(sizes[i - 1]!.grey);
  }
  expect(sizes[0]!.eye).toBeGreaterThan(25);
  expect(sizes.at(-1)!.eye).toBeLessThan(10.5);
});

it('keeps icons close to a distant planet instead of multiplying the entire stand-off', () => {
  const depth = 400, pixel = 2 * depth * Math.tan(Math.PI / 8) / 812;
  const layout = planetMarkerLayout({ radius: 0.3, intel: 'UNKNOWN', isOwned: false, isCapital: false }, depth, 812, 45);
  expect(layout.eyeOffset / pixel).toBeLessThan(20);
});

it.each(['RESOLVED', 'REMEMBERED'] as const)('reserves the correct ordered stack for %s', intel => {
  const layout = planetMarkerLayout({ radius: 0.4, intel, isOwned: false, isCapital: false }, 80, 812, 45);
  const pinTop = layout.pinOffset + layout.pinScale * 0.1;
  expect(layout.labelOffset).toBeGreaterThan(pinTop);
  if (intel === 'REMEMBERED') expect(layout.eyeOffset - layout.eyeSize / 2).toBeGreaterThan(pinTop);
});
