import { queryObstacles } from './grid.js';
import type { FlightTuning } from './tuning.js';
import type { ArenaLayout, ArenaObstacle, FlightState, Vec3 } from './types.js';

export interface Contact { index: number; nx: number; ny: number; nz: number; depth: number }

const SKIN = 1e-7;
const nearby: number[] = [];
const contact: Contact = { index: -1, nx: 0, ny: 0, nz: 0, depth: 0 };

/**
 * Pushes a sphere at p (radius r) out of one obstacle. Returns the penetration depth
 * (0 when clear) and writes the outward normal into `out`. `fx..fz` resolves a centre
 * that sits exactly on a rock's centre.
 */
function pushOut(p: Vec3, r: number, o: ArenaObstacle, fx: number, fy: number, fz: number, out: Contact): number {
  if (o.shape === 'sphere') {
    const dx = p.x - o.p.x; const dy = p.y - o.p.y; const dz = p.z - o.p.z;
    const reach = o.radius + r;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= reach * reach) return 0;
    const d = Math.sqrt(d2);
    let nx = -fx; let ny = -fy; let nz = -fz;
    if (d > 0) { nx = dx / d; ny = dy / d; nz = dz / d; }
    else if (nx === 0 && ny === 0 && nz === 0) ny = 1;
    p.x = o.p.x + nx * (reach + SKIN); p.y = o.p.y + ny * (reach + SKIN); p.z = o.p.z + nz * (reach + SKIN);
    out.nx = nx; out.ny = ny; out.nz = nz;
    return reach - d;
  }
  const dx = p.x - o.p.x; const dz = p.z - o.p.z;
  let lx = dx * o.ux + dz * o.uz; let ly = p.y - o.p.y; let lz = -dx * o.uz + dz * o.ux;
  const qx = Math.max(-o.hx, Math.min(o.hx, lx)); const qy = Math.max(-o.hy, Math.min(o.hy, ly));
  const qz = Math.max(-o.hz, Math.min(o.hz, lz));
  const ex = lx - qx; const ey = ly - qy; const ez = lz - qz;
  const d2 = ex * ex + ey * ey + ez * ez;
  let nlx = 0; let nly = 0; let nlz = 0; let depth: number;
  if (d2 > 0) {
    if (d2 >= r * r) return 0;
    const d = Math.sqrt(d2);
    nlx = ex / d; nly = ey / d; nlz = ez / d;
    lx = qx + nlx * (r + SKIN); ly = qy + nly * (r + SKIN); lz = qz + nlz * (r + SKIN);
    depth = r - d;
  } else {
    // Centre inside the box: leave through the face with the least penetration.
    const px = o.hx - Math.abs(lx); const py = o.hy - Math.abs(ly); const pz = o.hz - Math.abs(lz);
    if (px <= py && px <= pz) { nlx = lx >= 0 ? 1 : -1; lx = nlx * (o.hx + r + SKIN); depth = px + r; }
    else if (py <= pz) { nly = ly >= 0 ? 1 : -1; ly = nly * (o.hy + r + SKIN); depth = py + r; }
    else { nlz = lz >= 0 ? 1 : -1; lz = nlz * (o.hz + r + SKIN); depth = pz + r; }
  }
  p.x = o.p.x + lx * o.ux - lz * o.uz; p.y = o.p.y + ly; p.z = o.p.z + lx * o.uz + lz * o.ux;
  out.nx = nlx * o.ux - nlz * o.uz; out.ny = nly; out.nz = nlx * o.uz + nlz * o.ux;
  return depth;
}

const probe: Contact = { index: -1, nx: 0, ny: 0, nz: 0, depth: 0 };
const point: Vec3 = { x: 0, y: 0, z: 0 };

/** Separates a ship sphere from everything it overlaps; reports the deepest contact. */
export function separate(p: Vec3, r: number, layout: ArenaLayout, fx: number, fy: number, fz: number, out: Contact): boolean {
  out.index = -1; out.depth = 0;
  for (let pass = 0; pass < 4; pass++) {
    const count = queryObstacles(layout, p.x - r, p.y - r, p.z - r, p.x + r, p.y + r, p.z + r, nearby);
    let moved = false;
    for (let k = 0; k < count; k++) {
      const index = nearby[k] ?? -1;
      const o = layout.obstacles[index];
      if (!o) continue;
      const depth = pushOut(p, r, o, fx, fy, fz, probe);
      if (depth <= 0) continue;
      moved = true;
      if (depth > out.depth || out.index < 0) {
        out.index = index; out.depth = depth; out.nx = probe.nx; out.ny = probe.ny; out.nz = probe.nz;
      }
    }
    if (!moved) break;
  }
  return out.index >= 0;
}

/** Keeps a sphere inside the flat disc; outward motion slides along the rim or ceiling. */
export function clampToArena(p: Vec3, r: number, layout: ArenaLayout): boolean {
  let clamped = false;
  const rim = Math.max(0, layout.radius - r);
  const planar = Math.sqrt(p.x * p.x + p.z * p.z);
  if (planar > rim && planar > 0) { const scale = rim / planar; p.x *= scale; p.z *= scale; clamped = true; }
  const ceiling = Math.max(0, layout.halfHeight - r);
  if (p.y > ceiling) { p.y = ceiling; clamped = true; }
  if (p.y < -ceiling) { p.y = -ceiling; clamped = true; }
  return clamped;
}

/**
 * Moves the ship in sub-steps no longer than half its radius, so no collider can be
 * skipped. Motion is the heading times speed plus a decaying knock-back velocity.
 * Touching anything at or under `landSpeed` lands. Faster, the ship bounces: it gets
 * pushed off along the surface normal in proportion to how hard it came in, and loses
 * forward speed in proportion to how head-on the hit was. A graze barely nudges it.
 * The heading itself never changes here.
 */
export function moveFlight(state: FlightState, layout: ArenaLayout, fx: number, fy: number, fz: number,
  dt: number, r: number, tuning: FlightTuning): void {
  state.bump = 0;
  const p = state.p;
  let vx = fx * state.s + state.kx; let vy = fy * state.s + state.ky; let vz = fz * state.s + state.kz;
  if (state.liftoff > 0) { vx += state.nx * tuning.liftSpeed; vy += state.ny * tuning.liftSpeed; vz += state.nz * tuning.liftSpeed; }
  const distance = Math.sqrt(vx * vx + vy * vy + vz * vz) * dt;
  const steps = Math.max(1, Math.ceil(distance / (r * 0.5)));
  const sx = vx * dt / steps; const sy = vy * dt / steps; const sz = vz * dt / steps;
  for (let i = 0; i < steps; i++) {
    p.x += sx; p.y += sy; p.z += sz;
    if (!separate(p, r, layout, fx, fy, fz, contact)) continue;
    const nx = contact.nx; const ny = contact.ny; const nz = contact.nz;
    const approach = -(vx * nx + vy * ny + vz * nz);
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speed > 0 && speed <= tuning.landSpeed && state.liftoff === 0) {
      state.landed = contact.index + 1;
      state.nx = nx; state.ny = ny; state.nz = nz;
      state.s = 0; state.kx = 0; state.ky = 0; state.kz = 0;
      state.landThrottle = state.throttle; state.omegaYaw = 0; state.omegaPitch = 0;
      break;
    }
    if (approach <= 0) continue;
    // Bounce: drop the inward part of the knock, then push off with restitution.
    const kIn = state.kx * nx + state.ky * ny + state.kz * nz;
    if (kIn < 0) { state.kx -= nx * kIn; state.ky -= ny * kIn; state.kz -= nz * kIn; }
    const push = approach * tuning.bounce;
    state.kx += nx * push; state.ky += ny * push; state.kz += nz * push;
    const headOn = Math.max(0, Math.min(1, -(fx * nx + fy * ny + fz * nz)));
    state.s *= 1 - headOn * tuning.bounceLoss;
    if (state.s < tuning.stopEpsilon) state.s = 0;
    state.bump = Math.max(state.bump, Math.min(1, approach / 60));
    // The rest of this tick's motion is spent: the next tick moves with the new velocity.
    break;
  }
  const decay = Math.max(0, 1 - dt * tuning.knockDecay);
  state.kx *= decay; state.ky *= decay; state.kz *= decay;
  if (state.kx * state.kx + state.ky * state.ky + state.kz * state.kz < 0.09) { state.kx = 0; state.ky = 0; state.kz = 0; }
  clampToArena(p, r, layout);
}

/**
 * First fraction t∈[0,1] at which the segment a→b enters any obstacle grown by `grow`,
 * or 2 when it misses everything. Slab test for boxes, quadratic for spheres.
 */
export function segmentObstacles(layout: ArenaLayout, ax: number, ay: number, az: number,
  bx: number, by: number, bz: number, grow: number): number {
  const count = queryObstacles(layout, Math.min(ax, bx) - grow, Math.min(ay, by) - grow, Math.min(az, bz) - grow,
    Math.max(ax, bx) + grow, Math.max(ay, by) + grow, Math.max(az, bz) + grow, nearby);
  let first = 2;
  for (let k = 0; k < count; k++) {
    const o = layout.obstacles[nearby[k] ?? -1];
    if (!o) continue;
    const t = o.shape === 'sphere' ? segmentSphere(ax, ay, az, bx, by, bz, o.p, o.radius + grow)
      : segmentBox(ax, ay, az, bx, by, bz, o, grow);
    if (t < first) first = t;
  }
  return first;
}

export function segmentSphere(ax: number, ay: number, az: number, bx: number, by: number, bz: number,
  c: Vec3, radius: number): number {
  const x = ax - c.x; const y = ay - c.y; const z = az - c.z;
  const dx = bx - ax; const dy = by - ay; const dz = bz - az;
  const cc = x * x + y * y + z * z - radius * radius;
  if (cc <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz; const b = x * dx + y * dy + z * dz;
  if (a === 0 || b >= 0) return 2;
  const disc = b * b - a * cc;
  if (disc < 0) return 2;
  const t = (-b - Math.sqrt(disc)) / a;
  return t >= 0 && t <= 1 ? t : 2;
}

function segmentBox(ax: number, ay: number, az: number, bx: number, by: number, bz: number,
  o: Extract<ArenaObstacle, { shape: 'box' }>, grow: number): number {
  const rax = ax - o.p.x; const raz = az - o.p.z; const rbx = bx - o.p.x; const rbz = bz - o.p.z;
  const s0x = rax * o.ux + raz * o.uz; const s0y = ay - o.p.y; const s0z = -rax * o.uz + raz * o.ux;
  const s1x = rbx * o.ux + rbz * o.uz; const s1y = by - o.p.y; const s1z = -rbx * o.uz + rbz * o.ux;
  let enter = 0; let leave = 1;
  const axes: readonly [number, number, number][] = [[s0x, s1x - s0x, o.hx + grow], [s0y, s1y - s0y, o.hy + grow], [s0z, s1z - s0z, o.hz + grow]];
  for (const [start, delta, half] of axes) {
    if (delta === 0) { if (start < -half || start > half) return 2; continue; }
    let t0 = (-half - start) / delta; let t1 = (half - start) / delta;
    if (t0 > t1) { const swap = t0; t0 = t1; t1 = swap; }
    if (t0 > enter) enter = t0;
    if (t1 < leave) leave = t1;
    if (enter > leave) return 2;
  }
  return enter;
}

/** Nearest obstacle surface within `reach` of p, for steering away (bots); −1 when clear. */
export function nearestObstacle(layout: ArenaLayout, p: Vec3, reach: number, out: Contact): number {
  const count = queryObstacles(layout, p.x - reach, p.y - reach, p.z - reach, p.x + reach, p.y + reach, p.z + reach, nearby);
  out.index = -1; out.depth = reach;
  for (let k = 0; k < count; k++) {
    const index = nearby[k] ?? -1;
    const o = layout.obstacles[index];
    if (!o) continue;
    point.x = p.x; point.y = p.y; point.z = p.z;
    const depth = pushOut(point, reach, o, 0, 1, 0, probe);
    if (depth <= 0) continue;
    const gap = reach - depth;
    if (gap < out.depth || out.index < 0) {
      out.index = index; out.depth = gap; out.nx = probe.nx; out.ny = probe.ny; out.nz = probe.nz;
    }
  }
  return out.index;
}
