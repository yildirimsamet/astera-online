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

export function interceptorsOf(planet: PlanetView): readonly StrategicAsset[] {
  return planet.interceptors ?? (planet.interceptor ? [planet.interceptor] : []);
}

export const readyDeathStar = (planet: PlanetView): StrategicAsset | undefined =>
  deathStarsOf(planet).find((asset) => asset.status === 'READY');

/**
 * HOW FAR A STRATEGIC BUILD HAS COME, 0–100. `readyAt` is the live clock and wins;
 * `remainingSeconds` is frozen at the full duration while the clock runs, so it is only
 * read for a paused build, which has no clock.
 */
export function buildShare(
  asset: Pick<StrategicAsset, 'status' | 'readyAt' | 'remainingSeconds'>,
  totalMinutes: number,
  now: number,
): number {
  if (asset.status === 'READY') return 100;
  const left = asset.readyAt
    ? asset.readyAt.getTime() - now
    : (asset.remainingSeconds ?? totalMinutes * 60) * 1000;
  return Math.max(0, Math.min(100, 100 * (1 - left / (totalMinutes * 60_000))));
}
