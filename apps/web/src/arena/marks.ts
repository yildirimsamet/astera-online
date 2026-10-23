/**
 * Enemy brackets, edge arrows and the lead mark reach this far, no further (owner 2026-10-21):
 * a ship beyond it is the pilot's own to spot.
 */
export const MARK_RANGE = 700;
/** Enemy brackets on screen at once, nearest first: the room may send fifty ships, the HUD marks a dozen. */
export const ENEMY_MARKS = 12;

/**
 * Does an enemy at `distance` metres get a bracket or an edge arrow? A landed pilot that is not
 * mining is quiet beyond 320 m. One our radar sweep marks (Y4d) is marked wherever it is.
 */
export const enemyMarked = (drone: { landed: number; mining: boolean }, distance: number, scanned = false): boolean =>
  scanned || (distance <= MARK_RANGE && (!drone.landed || drone.mining || distance <= 320));

/** Seconds a ship that went behind rock keeps its marks at the point it was last seen (owner 2026-10-22). */
export const LAST_SEEN = 2;

export interface Sighting { x: number; y: number; z: number; at: number; level: number }

/**
 * Where to mark ship `id`, and how strongly: in sight, its live point at 1; behind rock, the
 * point it was last seen, fading to 0 over LAST_SEEN seconds; undefined once that has passed.
 */
export function sighting(memory: Map<number, Sighting>, id: number, inSight: boolean,
  p: { x: number; y: number; z: number }, time: number): Sighting | undefined {
  let seen = memory.get(id);
  if (inSight) {
    if (!seen) { seen = { x: 0, y: 0, z: 0, at: 0, level: 1 }; memory.set(id, seen); }
    seen.x = p.x; seen.y = p.y; seen.z = p.z; seen.at = time; seen.level = 1;
    return seen;
  }
  if (!seen) return undefined;
  seen.level = 1 - (time - seen.at) / LAST_SEEN;
  if (seen.level > 0) return seen;
  memory.delete(id);
  return undefined;
}
