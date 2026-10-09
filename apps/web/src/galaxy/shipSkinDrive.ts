import type { ShipSkinId } from '@astera/rules';
import type { Vec3Tuple } from './scene.js';
import { createPlumeGeometry } from './cosmeticPlume.js';

interface Drive {
  readonly slots: readonly { readonly position: Vec3Tuple; readonly yaw: number }[];
  readonly width: number;
  readonly length: number;
}

/** Measured surface points, centered and normalized to one unit, nose on +Z. */
export const SHIP_SKIN_DRIVES: Record<ShipSkinId, Drive> = {
  'ship-red-dragon': { slots: [{ position: [0, -.032, -.405], yaw: 0 }], width: .26, length: .24 },
  'ship-scorpion': { slots: [
    { position: [-.06, -.10, -.310], yaw: 0 }, { position: [.06, -.10, -.310], yaw: 0 },
  ], width: .17, length: .20 },
  'ship-shark': { slots: [
    { position: [-.318, -.065, .100], yaw: .08 }, { position: [.318, -.109, .123], yaw: -.08 },
  ], width: .13, length: .23 },
  'ship-stingray': { slots: [
    { position: [-.10, -.05, -.063], yaw: 0 }, { position: [.10, -.05, -.063], yaw: 0 },
  ], width: .15, length: .22 },
};

/** Scale the mesh, not these vertices: shader deformation then scales with the nozzle. */
export function createShipDriveGeometry() {
  const geometry = createPlumeGeometry('aurora');
  geometry.translate(0, 0, .48);
  return geometry;
}
