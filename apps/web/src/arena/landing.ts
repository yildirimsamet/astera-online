import { ARENA_TUNING as T, closestSurface, surfaceGap, toLocal, type ArenaLayout, type ArenaObstacle, type FlightState, type SurfacePoint, type Vec3 } from '@astera/rules/arena';

/**
 * Landing assist: one tap picks a touchdown point on the nearest surface ahead and flies
 * the ship onto it at landing speed. It only produces stick, throttle and the LAND bit
 * (rock and buildings take a ship down only with it), so the shared simulation, the
 * server and prediction all see an ordinary pilot input.
 */
export interface LandingTarget { index: number; point: Vec3; normal: Vec3 }
export type LandingPhase = 'idle' | 'approach' | 'landed';

/** LAND and the touchdown ring are offered only at landing speed or slower (owner 2026-10-21). */
export const landingOffered = (ship: { s: number; landed: number }): boolean => ship.landed === 0 && ship.s <= T.landSpeed;

const local = { x: 0, y: 0, z: 0 };
const REACH = 260;

const near: SurfacePoint = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };

/** Nearest point of one collider's real surface to `from`, lifted by the hull's belly, with its normal. */
function surfacePoint(layout: ArenaLayout, o: ArenaObstacle, from: Vec3, out: LandingTarget): void {
  if (!closestSurface(layout, o.id, from, Infinity, near)) return;
  out.point = { x: near.x + near.nx * T.bodyRadius, y: near.y + near.ny * T.bodyRadius, z: near.z + near.nz * T.bodyRadius };
  out.normal = { x: near.nx, y: near.ny, z: near.nz };
}

/**
 * The surface a tap on LAND would land on: whatever sits closest to the reticle within
 * reach, a live crystal preferred (that is what a farmer is aiming at), or anything the
 * hull is already touching distance of. Null when there is nothing to land on.
 */
export function findLandingTarget(layout: ArenaLayout, ship: FlightState, crystalLive?: (index: number) => boolean): LandingTarget | null {
  const q = ship.q;
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  let best: ArenaObstacle | undefined; let bestScore = -Infinity;
  for (const o of layout.obstacles) {
    const vx = o.p.x - ship.p.x; const vy = o.p.y - ship.p.y; const vz = o.p.z - ship.p.z;
    const centre = Math.hypot(vx, vy, vz);
    // The bounding ball rules a collider out cheaply; what counts is its real surface (Y2).
    if (centre - o.radius > REACH) continue;
    const surface = surfaceGap(layout, o.id, ship.p, REACH);
    if (surface > REACH) continue;
    const facing = centre > 0 ? (vx * fx + vy * fy + vz * fz) / centre : 1;
    const near = surface < 30;
    if (!near && facing < 0.9) continue;
    const crystal = o.kind === 'crystal' && (crystalLive?.(o.id) ?? true);
    const score = facing * 2 + (crystal ? 0.3 : 0) - Math.max(0, surface) / 600 + (near ? 0.5 : 0);
    if (score > bestScore) { bestScore = score; best = o; }
  }
  if (!best) return null;
  const target: LandingTarget = { index: best.id, point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } };
  surfacePoint(layout, best, ship.p, target);
  return target;
}

export function createLandingAssist() {
  let phase: LandingPhase = 'idle';
  let target: LandingTarget | null = null;
  let started = 0;
  return {
    get phase(): LandingPhase { return phase; },
    get target(): LandingTarget | null { return target; },
    begin(layout: ArenaLayout, ship: FlightState, now: number, crystalLive?: (index: number) => boolean): boolean {
      target = findLandingTarget(layout, ship, crystalLive);
      if (!target) return false;
      phase = 'approach'; started = now;
      return true;
    },
    cancel(): void { phase = 'idle'; target = null; },
    /**
     * Steers towards the touchdown point and sets the landing throttle. Returns false
     * (and stops) when the pilot takes over, the ship lands or the approach times out.
     */
    steer(ship: FlightState & { landed: number }, stickMagnitude: number, now: number, out: { x: number; y: number; throttle: number }): boolean {
      if (ship.landed) { phase = 'landed'; target = null; return false; }
      if (phase !== 'approach' || !target) return false;
      if (stickMagnitude > 0.4 || now - started > 14000) { phase = 'idle'; target = null; return false; }
      const dx = target.point.x - ship.p.x; const dy = target.point.y - ship.p.y; const dz = target.point.z - ship.p.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      toLocal(local, ship.q, dx, dy, dz);
      if (local.z <= 1) { out.x = local.x < 0 ? 1 : -1; out.y = local.y > 0 ? -0.5 : 0.5; }
      else {
        out.x = Math.max(-1, Math.min(1, -local.x / local.z * 2.4));
        out.y = Math.max(-1, Math.min(1, -local.y / local.z * 2.4));
      }
      // Fast while far, landing speed for the last stretch: the touch is always gentle.
      out.throttle = distance > 120 ? 0.5 : distance > 45 ? 0.28 : 0.15;
      return true;
    },
    distance(ship: FlightState): number {
      if (!target) return 0;
      return Math.hypot(target.point.x - ship.p.x, target.point.y - ship.p.y, target.point.z - ship.p.z);
    },
    reset(): void { phase = 'idle'; target = null; },
  };
}
export type LandingAssist = ReturnType<typeof createLandingAssist>;
