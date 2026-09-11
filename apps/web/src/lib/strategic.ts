import type { PlanetView } from '../api/schemas.js';

type StrategicAsset = NonNullable<PlanetView['strategic']>;

/**
 * EVERY DEATH STAR THE SERVER PUT ON THIS WORLD'S PAD.
 *
 * `strategic` remains the rolling-deploy headline for an older client/server
 * pair. A stockpiled world needs the full list: one ready weapon and one build
 * are two simultaneous facts, and neither may hide the other.
 */
export function deathStarsOf(planet: PlanetView): readonly StrategicAsset[] {
  return planet.deathStars ?? (planet.strategic ? [planet.strategic] : []);
}

export const readyDeathStar = (planet: PlanetView): StrategicAsset | undefined =>
  deathStarsOf(planet).find((asset) => asset.status === 'READY');
