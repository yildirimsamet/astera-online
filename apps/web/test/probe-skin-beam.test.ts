import { cosmeticById } from '@astera/rules';
import { expect, it } from 'vitest';
import { createProbeBeamGeometry, hasProbeSkinBeam } from '../src/galaxy/probeSkinBeam.js';
import { HULL_MODEL, MODEL } from '../src/ui/assets.js';

it('includes the beam in both the UFO flight and inspection assets', () => {
  const ufo = cosmeticById('probe-ufo');
  expect(ufo?.model).toBeTruthy();
  expect(ufo?.previewModel).toBeTruthy();
  expect(hasProbeSkinBeam(ufo?.model ?? '')).toBe(true);
  expect(hasProbeSkinBeam(ufo?.previewModel ?? '')).toBe(true);
});

it('does not give a normal probe, ship or unrecognized asset the UFO appearance', () => {
  for (const url of [MODEL.probe, MODEL.deathStar, ...Object.values(HULL_MODEL), '', '__proto__',
    '/assets/models/probes/probe_ufo.glb.old', '/assets/models/probes/probe_ufo_unknown.glb']) {
    expect(hasProbeSkinBeam(url), url).toBe(false);
  }
});

it('forms a small downward widening volume below the centered craft without a closed bright floor', () => {
  const geometry = createProbeBeamGeometry();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  expect(box?.max.y).toBeLessThan(0);
  expect(box?.min.y).toBeLessThan(-1);
  const positions = geometry.getAttribute('position');
  const top = [], bottom = [];
  for (let index = 0; index < positions.count; index++) {
    const y = positions.getY(index);
    const radius = Math.hypot(positions.getX(index), positions.getZ(index));
    if (Math.abs(y - (box?.max.y ?? 0)) < .0001) top.push(radius);
    if (Math.abs(y - (box?.min.y ?? 0)) < .0001) bottom.push(radius);
  }
  expect(Math.max(...bottom)).toBeGreaterThan(Math.max(...top) * 3);
  expect(Math.max(...bottom)).toBeLessThan(.65);
  expect(geometry.parameters.openEnded).toBe(true);
  expect((geometry.index?.count ?? Infinity) / 3).toBeLessThanOrEqual(800);
  geometry.dispose();
});
