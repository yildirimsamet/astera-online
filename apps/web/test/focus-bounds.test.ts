import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import type { PendingThread } from '../src/api/schemas.js';
import { ownFlightFocusRadius } from '../src/galaxy/Fleets.js';
import { miningFocusRadius } from '../src/galaxy/MiningFlights.js';
import { markersFor, slotOffset } from '../src/galaxy/Squadrons.js';
import { towingFormation } from '../src/galaxy/towing.js';
import { CRAFT_SCALE } from '../src/galaxy/scene.js';
import { FLEET_CRAFT, hullVisualScale } from '../src/galaxy/flightVisual.js';
import { sightCameraDistance } from '../src/galaxy/follow.js';

const flight = (over: Partial<PendingThread> = {}): PendingThread => ({
  id: 'focus-review', kind: 'fleet', targetName: 'Vega', arriveAt: new Date(0), minutesRemaining: 1,
  fleet: { DART: 30, PIKE: 30, COURIER: 12 }, ...over,
});

it.each([{ DART: 30, PIKE: 30, COURIER: 12 }, { CATACLYSM: 100 }])('fits all enlarged fleet hulls in a portrait focus', fleet => {
  const thread = flight({ fleet });
  const base = FLEET_CRAFT * CRAFT_SCALE;
  const formation = towingFormation(fleet, undefined, base);
  const radius = ownFlightFocusRadius(thread);
  const camera = new PerspectiveCamera(45, 350 / 812, .1, 1000);
  camera.position.z = Math.max(7, sightCameraDistance(radius, camera.fov, camera.aspect));
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  for (const [index, marker] of formation.markers.entries()) {
    const at = formation.slots[index]!, half = hullVisualScale(marker.hull, base) / 2;
    for (const x of [-half, half]) for (const y of [-half, half]) for (const z of [-half, half]) {
      const projected = new Vector3(at[0] + x, at[1] + y, at[2] + z).project(camera);
      expect(Math.abs(projected.x)).toBeLessThan(1);
      expect(Math.abs(projected.y)).toBeLessThan(1);
      expect(Math.abs(projected.z)).toBeLessThan(1);
    }
  }
});

it('includes the captured ships behind a returning fleet', () => {
  const normal = flight({ fleet: { DART: 50, COURIER: 30 }, leg: 'return' });
  expect(ownFlightFocusRadius({ ...normal, towing: { COURIER: 20 } })).toBeGreaterThan(ownFlightFocusRadius(normal));
});

it('keeps small scouts close and makes room for an enlarged strategic ship', () => {
  const scout = ownFlightFocusRadius(flight({ kind: 'probe' }));
  const strategic = ownFlightFocusRadius(flight({ kind: 'death_star' }));
  expect(Math.max(7, sightCameraDistance(scout, 45, 350 / 812))).toBe(7);
  expect(sightCameraDistance(strategic, 45, 350 / 812)).toBeGreaterThan(7);
});

it('includes every Prospector in a large mining run', () => {
  const base = 0.26 * CRAFT_SCALE;
  const markers = markersFor({ PROSPECTOR: 100 });
  const radius = miningFocusRadius(100);
  expect(radius).toBeGreaterThan(miningFocusRadius(1));
  for (const [index] of markers.entries()) {
    expect(Math.hypot(...slotOffset(index, base * 1.5)) + base * Math.sqrt(3) / 2).toBeLessThanOrEqual(radius);
  }
});
