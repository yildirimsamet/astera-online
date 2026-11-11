import { expect, it } from 'vitest';
import { eyeMarkerScale, planetMarkerLayout } from '../src/galaxy/planetMarkerLayout.js';

it.each([7, 80, 400])('shrinks only the mobile foreign triangles and closed eyes by another two pixels at depth %s', depth => {
  const body = { radius: 0.7, intel: 'REMEMBERED' as const, isOwned: false, isCapital: false };
  const pixel = 2 * depth * Math.tan(Math.PI / 8) / 812;
  const desktop = planetMarkerLayout(body, depth, 812, 45);
  const mobile = planetMarkerLayout(body, depth, 812, 45, true);
  expect((desktop.pinScale - mobile.pinScale) * 0.2 / pixel).toBeCloseTo(2, 8);
  expect((desktop.pinWidthScale - mobile.pinWidthScale) * 0.13 * Math.sqrt(3) / pixel).toBeCloseTo(2, 8);
  expect((desktop.eyeSize - mobile.eyeSize) / pixel).toBeCloseTo(2, 8);
  const owned = { ...body, isOwned: true, isCapital: true };
  expect(planetMarkerLayout(owned, depth, 812, 45, true).pinScale).toBe(planetMarkerLayout(owned, depth, 812, 45).pinScale);
  expect(mobile.pinScale).toBeGreaterThan(0);
  expect(mobile.pinWidthScale).toBeGreaterThan(0);
  expect(planetMarkerLayout(body, depth, 812, 45, false)).toEqual(desktop);
});

it('preserves the shared sizing law used by colony fault badges', () => {
  const depth = 7, radius = 0.7;
  const pixel = 2 * depth * Math.tan(Math.PI / 8) / 812;
  expect(eyeMarkerScale(depth, radius, 812, 45) * radius * 0.5 / pixel).toBeCloseTo(9 + 22 / (1 + depth / 25));
});

it.each([7, 40, 80, 400])('reduces foreign/neutral triangles and closed eyes by two CSS pixels at depth %s', depth => {
  const pixel = 2 * depth * Math.tan(Math.PI / 8) / 812;
  const body = { radius: 0.7, intel: 'REMEMBERED' as const, isOwned: false, isCapital: false };
  const layout = planetMarkerLayout(body, depth, 812, 45);
  const oldPinHeight = 4 + 6 / (1 + depth / 25);
  const oldEye = 9 + 22 / (1 + depth / 25);
  const triangleWidth = 0.13 * Math.sqrt(3);
  expect(layout.pinScale * 0.2 / pixel).toBeCloseTo(oldPinHeight - 2, 8);
  expect(layout.pinWidthScale * triangleWidth / pixel).toBeCloseTo(oldPinHeight * triangleWidth / 0.2 - 2, 8);
  expect(layout.eyeSize / pixel).toBeCloseTo(oldEye - 2, 8);
  const owned = planetMarkerLayout({ ...body, isOwned: true, isCapital: true }, depth, 812, 45);
  expect(owned.pinScale * 0.2 / pixel).toBeCloseTo(oldPinHeight, 8);
});

it.each([7, 40, 80, 400])('keeps eyes and pins readable alongside text at depth %s', depth => {
  for (const radius of [0.3, 0.7, 1.2]) {
    const pixel = 2 * depth * Math.tan(Math.PI / 8) / 812;
    const layout = planetMarkerLayout({ radius, intel: 'UNKNOWN', isOwned: false, isCapital: false }, depth, 812, 45);
    expect(layout.eyeSize / pixel).toBeGreaterThanOrEqual(7);
    expect(layout.eyeSize / pixel).toBeLessThanOrEqual(29);
    expect(layout.pinScale * 0.2 / pixel).toBeGreaterThanOrEqual(2);
    expect(layout.pinScale * 0.2 / pixel).toBeLessThanOrEqual(8);
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
  expect(sizes[0]!.eye).toBeGreaterThan(23);
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
