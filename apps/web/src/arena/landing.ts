import { ARENA_TUNING as T, toLocal, type ArenaLayout, type ArenaObstacle, type FlightState, type Vec3 } from '@astera/rules/arena';

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

/** Nearest point of one collider's surface to `from`, lifted by the hull radius, with its normal. */
function surfacePoint(o: ArenaObstacle, from: Vec3, out: LandingTarget): void {
  if (o.shape === 'sphere') {
    let nx = from.x - o.p.x; let ny = from.y - o.p.y; let nz = from.z - o.p.z;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const reach = o.radius + T.shipHitRadius;
    out.point = { x: o.p.x + nx * reach, y: o.p.y + ny * reach, z: o.p.z + nz * reach };
    out.normal = { x: nx, y: ny, z: nz };
    return;
  }
  const dx = from.x - o.p.x; const dz = from.z - o.p.z;
  const lx = dx * o.ux + dz * o.uz; const ly = from.y - o.p.y; const lz = -dx * o.uz + dz * o.ux;
  const qx = Math.max(-o.hx, Math.min(o.hx, lx)); const qy = Math.max(-o.hy, Math.min(o.hy, ly)); const qz = Math.max(-o.hz, Math.min(o.hz, lz));
  let ex = lx - qx; let ey = ly - qy; let ez = lz - qz;
  let el = Math.hypot(ex, ey, ez);
  if (el === 0) { ey = 1; el = 1; }
  ex /= el; ey /= el; ez /= el;
  const px = qx + ex * T.shipHitRadius; const py = qy + ey * T.shipHitRadius; const pz = qz + ez * T.shipHitRadius;
  out.point = { x: o.p.x + px * o.ux - pz * o.uz, y: o.p.y + py, z: o.p.z + px * o.uz + pz * o.ux };
  out.normal = { x: ex * o.ux - ez * o.uz, y: ey, z: ex * o.uz + ez * o.ux };
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
    const surface = centre - o.radius;
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
  surfacePoint(best, ship.p, target);
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
