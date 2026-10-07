import { VIEW, type Vec3 } from '@astera/rules';
import type { TFunction } from 'i18next';
import type { PublicMonument } from '../api/schemas.js';
import { monumentName } from '../i18n/names.js';
import type { GalaxyTarget } from '../v2/hud/GalaxyCorners.js';
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

/**
 * THE MONUMENT FINDER, IN LAST SEASON'S ORDER. Owner, 2026-10-07: "sıralama geçen sezondaki ilk 5
 * kullanıcının sıralamasına göre yapılsın."
 *
 * Rank N stands on monument N (owner, 2026-10-06; `monumentHonorees`), so last season's order IS
 * the ordinal order — sorting by it also keeps an unnamed monument in its rank's place. The server
 * sends the rows unordered, which is why the finder used to read in whatever order they came.
 */
export function monumentFinderTargets(monuments: readonly PublicMonument[], t: TFunction): GalaxyTarget[] {
  return [...monuments].sort((a, b) => a.ordinal - b.ordinal).map((monument) => ({
    kind: 'monument' as const,
    id: monument.id,
    label: monumentName(monument.ordinal),
    detail: monument.controller.kind === 'PLAYER' ? monument.controller.name
      : monument.controller.kind === 'CLAN' ? `[${monument.controller.tag}] ${monument.controller.name}`
        : t(monument.emptySince ? 'monument.empty' : 'monument.neutral'),
  }));
}
