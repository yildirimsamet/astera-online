import { VIEW, type Vec3 } from '@astera/rules';
import { MONUMENT_SCALE } from './MonumentModel.js';
import { DISC_RADIUS } from './scene.js';

/** Navigation follows public outer objects; settlement/planet placement still uses GALAXY.radius. */
export function monumentNavigationRadius(
  monuments: readonly { position: Vec3 }[], clouds: readonly { center: Vec3; radius: number }[],
): number {
  const halfStructure = MONUMENT_SCALE / 2;
  return Math.max(DISC_RADIUS * 1.15,
    ...monuments.map(({ position }) => Math.hypot(position.x, position.y, position.z) / VIEW.scale + halfStructure),
    ...clouds.map(({ center, radius }) => (Math.hypot(center.x, center.y, center.z) + radius) / VIEW.scale));
}
