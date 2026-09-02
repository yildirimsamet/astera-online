import { distance, type Vec3 } from '@astera/rules';

export interface LocationSight {
  sensors: readonly { at: Vec3; identify: number }[];
  remembered: ReadonlyMap<string, unknown>;
}

/** A world can be named as a destination only through ownership, current sight or probe memory. */
export function locationIsKnown(
  planetId: string,
  position: Vec3,
  owned: boolean,
  sight: LocationSight,
): boolean {
  return owned
    || sight.remembered.has(planetId)
    || sight.sensors.some((post) => distance(post.at, position) <= post.identify);
}
