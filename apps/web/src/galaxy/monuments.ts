import { VIEW, type Vec3 } from '@astera/rules';
import type { TFunction } from 'i18next';
import type { PublicMonument } from '../api/schemas.js';
import { monumentName } from '../i18n/names.js';
import type { GalaxyTarget } from '../v2/hud/GalaxyCorners.js';
import { monumentScale } from './MonumentModel.js';
import { DISC_RADIUS } from './scene.js';

/** Navigation follows public outer objects; settlement/planet placement still uses GALAXY.radius. */
export function monumentNavigationRadius(
  monuments: readonly { position: Vec3; difficulty?: PublicMonument['difficulty'] }[], clouds: readonly { center: Vec3; radius: number }[],
): number {
  return Math.max(DISC_RADIUS * 1.15,
    ...monuments.map(({ position, difficulty = 'LEGACY' }) => Math.hypot(position.x, position.y, position.z) / VIEW.scale + monumentScale(difficulty) / 2),
    ...clouds.map(({ center, radius }) => (Math.hypot(center.x, center.y, center.z) + radius) / VIEW.scale));
}

/**
 * Rank N stands on monument N. Ordinal order keeps unnamed monuments in their
 * rank's place; GalaxyReadout groups Hard above Easy and preserves that order
 * within each group (owner, 2026-10-10).
 *
 * The server sends rows unordered, so normalize before building the finder.
 */
export function monumentFinderTargets(monuments: readonly PublicMonument[], t: TFunction): GalaxyTarget[] {
  return [...monuments].sort((a, b) => a.ordinal - b.ordinal).map((monument) => ({
    kind: 'monument' as const,
    id: monument.id,
    difficulty: monument.difficulty,
    ordinal: monument.ordinal,
    label: monumentName(monument.ordinal),
    detail: monument.controller.kind === 'PLAYER' ? monument.controller.name
      : monument.controller.kind === 'CLAN' ? `[${monument.controller.tag}] ${monument.controller.name}`
        : t(monument.emptySince ? 'monument.empty' : 'monument.neutral'),
  }));
}
