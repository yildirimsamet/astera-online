import { segmentObstacles, type ArenaLayout, type Vec3 } from '@astera/rules/arena';

/**
 * PINGS (owner 2026-10-22, the PUBG / Siege mark): hold anywhere on the screen, a wheel of four
 * calls opens, and the chosen one marks the spot under the finger for five seconds. The mark is
 * a point in the world, so every viewer draws it from where they stand. The arena has no teams
 * yet (free for all), so a mark is the pilot's own; a team would share the same point.
 */
export const PING_KINDS = ['enemy', 'farm', 'go', 'danger'] as const;
export type PingKind = (typeof PING_KINDS)[number];

export const PING_LIFE = 5;
const MAX_PINGS = 3;
/** How far the finger's line looks for something to mark, and where it marks open space. */
const REACH = 3000;
const OPEN = 600;

/** The wheel's slice under an offset from its centre (screen px, y down): enemy on top, clockwise. */
export function pingSector(dx: number, dy: number, deadZone: number): PingKind | null {
  if (Math.hypot(dx, dy) < deadZone) return null;
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'enemy' : 'go';
  return dx > 0 ? 'farm' : 'danger';
}

/** The first surface along the finger's line from the eye (just in front of it), else open space. */
export function pingTarget(layout: ArenaLayout, eye: Vec3, dir: Vec3): Vec3 {
  const t = segmentObstacles(layout, eye.x, eye.y, eye.z, eye.x + dir.x * REACH, eye.y + dir.y * REACH, eye.z + dir.z * REACH, 0);
  const at = t <= 1 ? Math.max(0, t * REACH - 2) : OPEN;
  return { x: eye.x + dir.x * at, y: eye.y + dir.y * at, z: eye.z + dir.z * at };
}

export interface Ping { kind: PingKind; p: Vec3; at: number }

export function createPings() {
  let marks: Ping[] = [];
  return {
    add(kind: PingKind, p: Vec3, now: number): void { marks = [{ kind, p, at: now }, ...marks].slice(0, MAX_PINGS); },
    /** The marks still showing at `now` (seconds), newest first. */
    live(now: number): Ping[] { return marks.filter(m => now - m.at <= PING_LIFE); },
  };
}
