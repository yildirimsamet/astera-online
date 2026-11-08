import type { TFunction } from 'i18next';
import type { GalaxyPlanet } from '../api/schemas.js';
import type { GalaxyTarget } from '../v2/hud/GalaxyCorners.js';

type Outpost = Pick<GalaxyPlanet, 'id' | 'name' | 'body' | 'coreLevel' | 'hasPart' | 'firstHunt'>;

/**
 * THE MAP'S OUTPOST LIST (plan §5.2, F4d): the ship's first hunt leads it and says so, a part's outpost
 * comes next, and the galaxy's others follow in the order they came.
 */
export function outpostFinderTargets(planets: readonly Outpost[], t: TFunction): GalaxyTarget[] {
  const rank = (world: Outpost): number => world.firstHunt ? 0 : world.hasPart ? 1 : 2;
  return planets.filter(world => world.body === 'OUTPOST').toSorted((a, b) => rank(a) - rank(b)).map(world => {
    const level = t('starter.readout.level', { level: Math.max(1, world.coreLevel) });
    return {
      kind: 'planet' as const,
      id: world.id,
      label: world.name,
      detail: world.hasPart ? t('starter.jump.partHere') : world.firstHunt ? t('starter.readout.firstHunt', { level }) : level,
    };
  });
}
