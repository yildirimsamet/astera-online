import { expect, it } from 'vitest';
import { SHIP_SKIN_IDS } from '@astera/rules';
import { SHIP_SKIN_DRIVES, createShipDriveGeometry } from '../src/galaxy/shipSkinDrive.js';

it('places paired whale jets at opposite wing tips and keeps every jet pointed aft', () => {
  const slots = SHIP_SKIN_DRIVES['ship-shark'].slots;
  expect(slots).toHaveLength(2);
  expect(slots[0]?.position[0]).toBeLessThan(-.28);
  expect(slots[1]?.position[0]).toBeGreaterThan(.28);
  // The authored wings have different pitch and sweep; a mirrored attachment floats.
  expect(Math.abs(slots[0]!.position[1] - slots[1]!.position[1])).toBeGreaterThan(.035);
  expect(Math.abs(slots[0]!.position[2] - slots[1]!.position[2])).toBeGreaterThan(.015);
  for (const id of SHIP_SKIN_IDS) for (const slot of SHIP_SKIN_DRIVES[id].slots) {
    expect(slot.position.every(Number.isFinite)).toBe(true);
    expect(Math.abs(slot.yaw)).toBeLessThan(.25);
  }
});

it('keeps the deformation in nozzle space, with a soft ignition at zero and a closed aft tip', () => {
  const geometry = createShipDriveGeometry();
  geometry.computeBoundingBox();
  expect(geometry.boundingBox?.max.z).toBeCloseTo(0);
  expect(geometry.boundingBox?.min.z).toBeCloseTo(-2.35);
  expect(geometry.boundingBox?.max.x).toBeGreaterThan(.15);
  const opacity = geometry.getAttribute('aEnvelope');
  expect(opacity.getX(0)).toBe(0);
  expect(opacity.getX(opacity.count - 1)).toBe(0);
  geometry.dispose();
});
