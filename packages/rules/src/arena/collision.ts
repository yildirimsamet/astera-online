import { queryObstacles } from './grid.js';
import { hullCapsule, hullReach, hullThinnest, type Capsule } from './hull.js';
import { createMesh, meshClosestPoint, meshRay, meshSegmentClosest, type ArenaMesh, type SegmentPoint, type SurfacePoint } from './mesh.js';
import type { FlightTuning } from './tuning.js';
import type { ArenaLayout, ArenaObstacle, FlightState, Quaternion, Vec3 } from './types.js';

export interface Contact { index: number; nx: number; ny: number; nz: number; depth: number }

const SKIN = 1e-7;
const nearby: number[] = [];
const contact: Contact = { index: -1, nx: 0, ny: 0, nz: 0, depth: 0 };

/**
 * A box or mesh obstacle in its own space: world = p + R·(local·s), R row-major. A box is
 * collided as its twelve triangles, so a capsule meets it with the same code as a rock.
 */
interface Frame { mesh: ArenaMesh; s: number; m: Float64Array }
const frames = new WeakMap<ArenaObstacle, Frame>();

/** Box corner i has +x when bit 0 is set, +y bit 1, +z bit 2; faces wound outwards. */
const BOX_TRIANGLES = [1, 3, 7, 1, 7, 5, 0, 4, 6, 0, 6, 2, 2, 6, 7, 2, 7, 3, 0, 1, 5, 0, 5, 4, 4, 5, 7, 4, 7, 6, 0, 2, 3, 0, 3, 1];

function frameOf(layout: ArenaLayout, o: ArenaObstacle): Frame | null {
  if (o.shape === 'sphere') return null;
  let frame = frames.get(o);
  if (frame) return frame;
  if (o.shape === 'box') {
    const corners: number[] = [];
    for (let i = 0; i < 8; i++) corners.push(i & 1 ? o.hx : -o.hx, i & 2 ? o.hy : -o.hy, i & 4 ? o.hz : -o.hz);
    frame = { mesh: createMesh(corners, BOX_TRIANGLES), s: 1, m: Float64Array.of(o.ux, 0, -o.uz, 0, 1, 0, o.uz, 0, o.ux) };
  } else {
    const mesh = layout.meshes[o.mesh];
    if (!mesh) return null;
    const q = o.q;
    frame = { mesh, s: o.scale, m: Float64Array.of(
      1 - 2 * (q.y * q.y + q.z * q.z), 2 * (q.x * q.y - q.w * q.z), 2 * (q.x * q.z + q.w * q.y),
      2 * (q.x * q.y + q.w * q.z), 1 - 2 * (q.x * q.x + q.z * q.z), 2 * (q.y * q.z - q.w * q.x),
      2 * (q.x * q.z - q.w * q.y), 2 * (q.y * q.z + q.w * q.x), 1 - 2 * (q.x * q.x + q.y * q.y)) };
  }
  frames.set(o, frame);
  return frame;
}

const la = { x: 0, y: 0, z: 0 };
const lb = { x: 0, y: 0, z: 0 };

/** World point → obstacle space. */
function toFrame(out: Vec3, o: ArenaObstacle, f: Frame, x: number, y: number, z: number): void {
  const m = f.m; const dx = x - o.p.x; const dy = y - o.p.y; const dz = z - o.p.z;
  out.x = ((m[0] ?? 0) * dx + (m[3] ?? 0) * dy + (m[6] ?? 0) * dz) / f.s;
  out.y = ((m[1] ?? 0) * dx + (m[4] ?? 0) * dy + (m[7] ?? 0) * dz) / f.s;
  out.z = ((m[2] ?? 0) * dx + (m[5] ?? 0) * dy + (m[8] ?? 0) * dz) / f.s;
}

/** Obstacle-space direction → world, into the normal of `out`. */
function normalToWorld(out: { nx: number; ny: number; nz: number }, f: Frame, x: number, y: number, z: number): void {
  const m = f.m;
  out.nx = (m[0] ?? 0) * x + (m[1] ?? 0) * y + (m[2] ?? 0) * z;
  out.ny = (m[3] ?? 0) * x + (m[4] ?? 0) * y + (m[5] ?? 0) * z;
  out.nz = (m[6] ?? 0) * x + (m[7] ?? 0) * y + (m[8] ?? 0) * z;
}

const pair: SegmentPoint = { sx: 0, sy: 0, sz: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
const surface: SurfacePoint = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };

/** Is a mesh-space point inside the mesh's root box? */
function inRoot(mesh: ArenaMesh, p: Vec3): boolean {
  const b = mesh.bounds;
  return p.x >= (b[0] ?? 0) && p.x <= (b[3] ?? 0) && p.y >= (b[1] ?? 0) && p.y <= (b[4] ?? 0) && p.z >= (b[2] ?? 0) && p.z <= (b[5] ?? 0);
}

/**
 * How far capsule a→b (radius r, world) overlaps obstacle o, with the world direction out
 * of it in `out`; 0 when clear. A capsule buried deeper than its radius is found through
 * its midpoint and pushed out through the nearest face.
 */
function capsuleDepth(layout: ArenaLayout, o: ArenaObstacle, ax: number, ay: number, az: number,
  bx: number, by: number, bz: number, r: number, out: Contact): number {
  if (o.shape === 'sphere') {
    const dx = bx - ax; const dy = by - ay; const dz = bz - az;
    const length2 = dx * dx + dy * dy + dz * dz;
    const t = length2 > 0 ? Math.max(0, Math.min(1, ((o.p.x - ax) * dx + (o.p.y - ay) * dy + (o.p.z - az) * dz) / length2)) : 0;
    const ex = ax + dx * t - o.p.x; const ey = ay + dy * t - o.p.y; const ez = az + dz * t - o.p.z;
    const reach = o.radius + r;
    const d2 = ex * ex + ey * ey + ez * ez;
    if (d2 >= reach * reach) return 0;
    const d = Math.sqrt(d2);
    if (d > 0) { out.nx = ex / d; out.ny = ey / d; out.nz = ez / d; } else { out.nx = 0; out.ny = 1; out.nz = 0; }
    return reach - d;
  }
  const f = frameOf(layout, o);
  if (!f) return 0;
  toFrame(la, o, f, ax, ay, az); toFrame(lb, o, f, bx, by, bz);
  const lr = r / f.s;
  if (meshSegmentClosest(f.mesh, la.x, la.y, la.z, lb.x, lb.y, lb.z, lr, pair)) {
    const depth = pair.inside ? lr + pair.d : lr - pair.d;
    if (depth <= 0) return 0;
    normalToWorld(out, f, pair.nx, pair.ny, pair.nz);
    return depth * f.s;
  }
  la.x = (la.x + lb.x) / 2; la.y = (la.y + lb.y) / 2; la.z = (la.z + lb.z) / 2;
  if (!inRoot(f.mesh, la) || !meshClosestPoint(f.mesh, la.x, la.y, la.z, Infinity, surface) || !surface.inside) return 0;
  normalToWorld(out, f, surface.nx, surface.ny, surface.nz);
  return (lr + surface.d) * f.s;
}

const capsule: Capsule = { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, r: 0 };
const probe: Contact = { index: -1, nx: 0, ny: 0, nz: 0, depth: 0 };

/** Writes into `out` every obstacle the hull at p could touch, plus `margin`; returns the count. */
export function hullCandidates(layout: ArenaLayout, p: Vec3, margin: number, tuning: FlightTuning, out: number[]): number {
  const reach = hullReach(tuning) + margin;
  return queryObstacles(layout, p.x - reach, p.y - reach, p.z - reach, p.x + reach, p.y + reach, p.z + reach, out);
}

/**
 * Pushes the hull (centre p, turned by q) out of every candidate obstacle it overlaps and
 * reports the deepest contact. The heading never changes here.
 */
export function separate(p: Vec3, q: Quaternion, layout: ArenaLayout, candidates: readonly number[], count: number,
  tuning: FlightTuning, out: Contact): boolean {
  out.index = -1; out.depth = 0;
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (let k = 0; k < tuning.capsules.length; k++) {
      hullCapsule(q, k, tuning, capsule);
      for (let c = 0; c < count; c++) {
        const index = candidates[c] ?? -1;
        const o = layout.obstacles[index];
        if (!o) continue;
        const depth = capsuleDepth(layout, o, p.x + capsule.ax, p.y + capsule.ay, p.z + capsule.az,
          p.x + capsule.bx, p.y + capsule.by, p.z + capsule.bz, capsule.r, probe);
        if (depth <= 0) continue;
        p.x += probe.nx * (depth + SKIN); p.y += probe.ny * (depth + SKIN); p.z += probe.nz * (depth + SKIN);
        moved = true;
        if (depth > out.depth || out.index < 0) {
          out.index = index; out.depth = depth; out.nx = probe.nx; out.ny = probe.ny; out.nz = probe.nz;
        }
      }
    }
    if (!moved) break;
  }
  return out.index >= 0;
}

/**
 * Gap between the hull and one obstacle, in metres: negative while overlapping, Infinity when
 * nothing of it is within `reach`. A landed ship settles by this much onto its rock.
 */
export function hullGap(layout: ArenaLayout, index: number, p: Vec3, q: Quaternion, tuning: FlightTuning, reach = tuning.bodyLength): number {
  const o = layout.obstacles[index];
  if (!o) return Infinity;
  let gap = Infinity;
  for (let k = 0; k < tuning.capsules.length; k++) {
    hullCapsule(q, k, tuning, capsule);
    const ax = p.x + capsule.ax; const ay = p.y + capsule.ay; const az = p.z + capsule.az;
    const bx = p.x + capsule.bx; const by = p.y + capsule.by; const bz = p.z + capsule.bz;
    if (o.shape === 'sphere') {
      const depth = capsuleDepth(layout, o, ax, ay, az, bx, by, bz, capsule.r + reach, probe);
      if (depth > 0) gap = Math.min(gap, reach - depth);
      continue;
    }
    const f = frameOf(layout, o);
    if (!f) continue;
    toFrame(la, o, f, ax, ay, az); toFrame(lb, o, f, bx, by, bz);
    if (!meshSegmentClosest(f.mesh, la.x, la.y, la.z, lb.x, lb.y, lb.z, (capsule.r + reach) / f.s, pair)) continue;
    gap = Math.min(gap, (pair.inside ? -pair.d : pair.d) * f.s - capsule.r);
  }
  return gap;
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

const candidates: number[] = [];

/**
 * Moves the ship in sub-steps no longer than half its thinnest capsule's radius, so no
 * surface can be skipped; everything the hull could reach this tick is gathered once.
 * Motion is the heading times speed plus a decaying knock-back velocity.
 * A slow touch (at or under `landSpeed`) lands on a deposit, or on anything while LAND
 * is held (owner 2026-10-21: rocks and buildings only on request). Otherwise the ship bounces
 * off with restitution and friction (see the bounce below). The heading itself never changes here.
 */
export function moveFlight(state: FlightState, layout: ArenaLayout, fx: number, fy: number, fz: number,
  dt: number, tuning: FlightTuning, land = false): void {
  state.bump = 0;
  const p = state.p;
  let vx = fx * state.s + state.kx; let vy = fy * state.s + state.ky; let vz = fz * state.s + state.kz;
  if (state.liftoff > 0) { vx += state.nx * tuning.liftSpeed; vy += state.ny * tuning.liftSpeed; vz += state.nz * tuning.liftSpeed; }
  const distance = Math.sqrt(vx * vx + vy * vy + vz * vz) * dt;
  const count = hullCandidates(layout, p, distance + 1, tuning, candidates);
  const thinnest = hullThinnest(tuning);
  const steps = count === 0 ? 1 : Math.max(1, Math.ceil(distance / (thinnest * 0.5)));
  const sx = vx * dt / steps; const sy = vy * dt / steps; const sz = vz * dt / steps;
  for (let i = 0; i < steps; i++) {
    p.x += sx; p.y += sy; p.z += sz;
    if (count === 0 || !separate(p, state.q, layout, candidates, count, tuning, contact)) continue;
    const nx = contact.nx; const ny = contact.ny; const nz = contact.nz;
    const approach = -(vx * nx + vy * ny + vz * nz);
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speed > 0 && speed <= tuning.landSpeed && state.liftoff === 0 && (land || layout.deposits.includes(contact.index))) {
      state.landed = contact.index + 1;
      state.nx = nx; state.ny = ny; state.nz = nz;
      state.s = 0; state.kx = 0; state.ky = 0; state.kz = 0;
      state.landThrottle = state.throttle; state.omegaYaw = 0; state.omegaPitch = 0;
      break;
    }
    if (approach <= 0) continue;
    // Bounce (owner 2026-10-21): an impulse with restitution and friction. Only the part of the
    // velocity into the surface springs back, and harder hits spring back proportionally more.
    // Friction takes a share of that impulse off the sliding part, never more than it has:
    // a graze slides on, head-on loses its forward speed.
    const spring = tuning.bounceMin + (tuning.bounceMax - tuning.bounceMin) * approach / (approach + tuning.bounceHalf);
    const tx = vx + nx * approach; const ty = vy + ny * approach; const tz = vz + nz * approach;
    const slide = Math.sqrt(tx * tx + ty * ty + tz * tz);
    const keep = slide > 0 ? Math.max(0, 1 - tuning.scrapeFriction * (1 + spring) * approach / slide) : 0;
    const out = spring * approach;
    vx = tx * keep + nx * out; vy = ty * keep + ny * out; vz = tz * keep + nz * out;
    // The heading never turns: what still lies along it stays forward speed, the rest is
    // knock-back that decays. A take-off's lift is not the ship's own motion.
    state.s = Math.max(0, vx * fx + vy * fy + vz * fz);
    if (state.s < tuning.stopEpsilon) state.s = 0;
    const lift = state.liftoff > 0 ? tuning.liftSpeed : 0;
    state.kx = vx - fx * state.s - state.nx * lift; state.ky = vy - fy * state.s - state.ny * lift; state.kz = vz - fz * state.s - state.nz * lift;
    state.bump = Math.max(state.bump, Math.min(1, approach / 60));
    // The rest of this tick's motion is spent: the next tick moves with the new velocity.
    break;
  }
  const decay = Math.max(0, 1 - dt * tuning.knockDecay);
  state.kx *= decay; state.ky *= decay; state.kz *= decay;
  if (state.kx * state.kx + state.ky * state.ky + state.kz * state.kz < 0.09) { state.kx = 0; state.ky = 0; state.kz = 0; }
  clampToArena(p, tuning.shipHitRadius, layout);
}

/**
 * A landed ship that levels onto the surface normal swings its hull: lower it along the
 * normal until the hull rests on the rock, then clear anything it now touches.
 */
export function settleLanded(state: FlightState, layout: ArenaLayout, tuning: FlightTuning): void {
  const gap = hullGap(layout, state.landed - 1, state.p, state.q, tuning);
  if (Number.isFinite(gap)) { state.p.x -= state.nx * gap; state.p.y -= state.ny * gap; state.p.z -= state.nz * gap; }
  const count = hullCandidates(layout, state.p, 1, tuning, candidates);
  if (count > 0) separate(state.p, state.q, layout, candidates, count, tuning, contact);
}

/**
 * First fraction t∈[0,1] at which the segment a→b enters any obstacle (spheres and boxes
 * grown by `grow`), or 2 when it misses everything. Slab test for boxes, quadratic for
 * spheres, the mesh's own tree for mesh obstacles.
 */
export function segmentObstacles(layout: ArenaLayout, ax: number, ay: number, az: number,
  bx: number, by: number, bz: number, grow: number): number {
  const count = queryObstacles(layout, Math.min(ax, bx) - grow, Math.min(ay, by) - grow, Math.min(az, bz) - grow,
    Math.max(ax, bx) + grow, Math.max(ay, by) + grow, Math.max(az, bz) + grow, nearby);
  let first = 2;
  for (let k = 0; k < count; k++) {
    const o = layout.obstacles[nearby[k] ?? -1];
    if (!o) continue;
    let t: number;
    if (o.shape === 'sphere') t = segmentSphere(ax, ay, az, bx, by, bz, o.p, o.radius + grow);
    else if (o.shape === 'box') t = segmentBox(ax, ay, az, bx, by, bz, o, grow);
    else {
      const f = frameOf(layout, o);
      if (!f) continue;
      toFrame(la, o, f, ax, ay, az); toFrame(lb, o, f, bx, by, bz);
      t = meshRay(f.mesh, la.x, la.y, la.z, lb.x, lb.y, lb.z);
    }
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

/**
 * Nearest surface point of obstacle `index` to p within `reach`, with the direction out of
 * the surface there (world). False when nothing of it is that close.
 */
export function closestSurface(layout: ArenaLayout, index: number, p: Vec3, reach: number, out: SurfacePoint): boolean {
  const o = layout.obstacles[index];
  if (!o) return false;
  if (o.shape === 'sphere') {
    const dx = p.x - o.p.x; const dy = p.y - o.p.y; const dz = p.z - o.p.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d - o.radius > reach) return false;
    if (d > 0) { out.nx = dx / d; out.ny = dy / d; out.nz = dz / d; } else { out.nx = 0; out.ny = 1; out.nz = 0; }
    out.x = o.p.x + out.nx * o.radius; out.y = o.p.y + out.ny * o.radius; out.z = o.p.z + out.nz * o.radius;
    out.d = Math.abs(d - o.radius); out.inside = d < o.radius;
    return true;
  }
  const f = frameOf(layout, o);
  if (!f) return false;
  toFrame(la, o, f, p.x, p.y, p.z);
  if (!meshClosestPoint(f.mesh, la.x, la.y, la.z, reach / f.s, surface)) return false;
  const m = f.m; const x = surface.x * f.s; const y = surface.y * f.s; const z = surface.z * f.s;
  out.x = o.p.x + (m[0] ?? 0) * x + (m[1] ?? 0) * y + (m[2] ?? 0) * z;
  out.y = o.p.y + (m[3] ?? 0) * x + (m[4] ?? 0) * y + (m[5] ?? 0) * z;
  out.z = o.p.z + (m[6] ?? 0) * x + (m[7] ?? 0) * y + (m[8] ?? 0) * z;
  normalToWorld(out, f, surface.nx, surface.ny, surface.nz);
  out.d = surface.d * f.s; out.inside = surface.inside;
  return true;
}

const near: SurfacePoint = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };

/**
 * Distance from p to obstacle `index`'s real surface, 0 inside it, Infinity beyond `reach`.
 * A rock is no ball (Y2): its centre minus its bounding radius is only the nearest it can be.
 */
export function surfaceGap(layout: ArenaLayout, index: number, p: Vec3, reach = Infinity): number {
  if (!closestSurface(layout, index, p, reach, near)) return Infinity;
  return near.inside ? 0 : near.d;
}

/** Nearest obstacle surface within `reach` of p, for steering away (bots); −1 when clear. */
export function nearestObstacle(layout: ArenaLayout, p: Vec3, reach: number, out: Contact): number {
  const count = queryObstacles(layout, p.x - reach, p.y - reach, p.z - reach, p.x + reach, p.y + reach, p.z + reach, nearby);
  out.index = -1; out.depth = reach;
  for (let k = 0; k < count; k++) {
    const index = nearby[k] ?? -1;
    if (!closestSurface(layout, index, p, reach, near)) continue;
    const gap = near.inside ? 0 : near.d;
    if (gap >= reach) continue;
    if (gap < out.depth || out.index < 0) {
      out.index = index; out.depth = gap; out.nx = near.nx; out.ny = near.ny; out.nz = near.nz;
    }
  }
  return out.index;
}
