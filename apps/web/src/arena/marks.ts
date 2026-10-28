/**
 * Enemy brackets, edge arrows and the lead mark reach this far, no further (owner 2026-10-21):
 * a ship beyond it is the pilot's own to spot.
 */
import { SCANNED, alive, sameSide, type Pilot } from '@astera/rules/arena';

export const MARK_RANGE = 700;
/** Enemy brackets on screen at once, nearest first: the room may send fifty ships, the HUD marks a dozen. */
export const ENEMY_MARKS = 12;

/**
 * Does an enemy at `distance` metres get a bracket or an edge arrow? A landed pilot that is not
 * mining is quiet beyond 320 m. One our radar sweep marks (Y4d) is marked wherever it is.
 */
export const enemyMarked = (drone: { landed: number; mining: boolean }, distance: number, scanned = false): boolean =>
  scanned || (distance <= MARK_RANGE && (!drone.landed || drone.mining || distance <= 320));

/** Is the warning on the pilot pointed at on screen? A lock or a missile is; a radar sweep is only told (owner 2026-10-27). */
export const threatPointed = (threat: number): boolean => threat > 0 && threat !== SCANNED;

/** Seconds a ship that went behind rock keeps its marks at the point it was last seen (owner 2026-10-22). */
export const LAST_SEEN = 2;

/** A support tap has a generous touch radius, but can select only a living real friend. */
export function friendTarget(self: Pilot, candidates: readonly { pilot: Pilot; x: number; y: number; behind: boolean }[], x: number, y: number): number | null {
  let target: number | null = null; let nearest = 40 ** 2;
  for (const c of candidates) {
    if (c.behind || c.pilot.id === self.id || c.pilot.decoyOf >= 0 || !alive(c.pilot) || !sameSide(self, c.pilot)) continue;
    const distance = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (distance < nearest) { nearest = distance; target = c.pilot.id; }
  }
  return target;
}

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

/** The screen's free middle band, clear of the HUD above, the thumbs below and our own hull. */
export interface Band { width: number; top: number; bottom: number }
export interface EdgeMark { x: number; y: number; angle: number; side: 'left' | 'right' }

/**
 * Clamps an off-screen point to an ellipse inside the free band. `sideways` puts a point behind
 * on the side it lies towards rather than at the bottom, where it sat on our ship's nose among
 * the targets ahead (F13); `side` lets a name lean inwards, off the throttle (F10).
 */
export function edgePoint(px: number, py: number, behind: boolean, margin: number, band: Band, sideways = false): EdgeMark {
  const cx = band.width / 2; const cy = (band.top + band.bottom) / 2;
  const rx = band.width / 2 - margin - 18; const ry = (band.bottom - band.top) / 2;
  let dx = px - cx; let dy = py - cy;
  if (behind) { dx = -dx; dy = -dy; if (Math.abs(dx) + Math.abs(dy) < 1) dy = 1; }
  if (behind && sideways) {
    const sign = dx < 0 ? -1 : 1;
    return { x: cx + sign * rx, y: cy + Math.max(-ry / 4, Math.min(ry / 4, dy * 0.2)), angle: sign < 0 ? Math.PI : 0, side: sign < 0 ? 'left' : 'right' };
  }
  const k = 1 / Math.max(1e-6, Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)));
  return { x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx), side: dx < 0 ? 'left' : 'right' };
}
