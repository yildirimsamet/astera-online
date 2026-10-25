import { gimbalAim } from './aim.js';
import { segmentObstacles } from './collision.js';
import { ARENA_TUNING as T } from './tuning.js';
import { alive, type Impact, type Pilot, type Projectile, type SmokePuff, type CargoDrop } from './pilot.js';
import { RING12 } from './vec.js';
import { pilotVisible } from './visibility.js';
import type { ArenaLayout, FlightState, Vec3 } from './types.js';

/** The slice of a world combat needs; keeps this module free of world orchestration. */
export interface CombatWorld {
  layout: ArenaLayout; tick: number; pilot: Pilot; drones: Pilot[]; previous: FlightState; dronePrevious: FlightState[];
  projectiles: Projectile[]; ghosts: Projectile[]; smoke: SmokePuff[]; impacts: Impact[]; cargoDrops: CargoDrop[];
  bulletCursor: number; ghostCursor: number; impactCursor: number; shots: number;
}

// Deterministic spread pattern, in units of spreadBase (pairs: x, y).
const SPREAD = [0, 0, 0.35, 0.1, -0.25, 0.2, 0.15, -0.4, -0.6, -0.1, 0.5, 0.45, -0.2, -0.65, 0.1, 0.7,
  0.65, -0.4, -0.45, 0.4, 0.3, -0.2, -0.1, 0.25];

export function impact(world: CombatWorld, x: number, y: number, z: number, kind: Impact['kind']): void {
  const hit = world.impacts[world.impactCursor++ % world.impacts.length]; if (!hit) return;
  hit.p.x = x; hit.p.y = y; hit.p.z = z; hit.age = 0; hit.kind = kind; hit.active = true;
}

const bend = { x: 0, y: 0, z: 0 };
const velocity = { x: 0, y: 0, z: 0 };

/** Best gimbal direction towards a visible pilot off the nose; false keeps the guns fixed. */
function gimbal(world: CombatWorld, shooter: Pilot, out: Vec3): boolean {
  let best = -2; let found = false;
  for (let j = 0; j <= world.drones.length; j++) {
    const target = j === 0 ? world.pilot : world.drones[j - 1];
    if (!target || target === shooter || !alive(target) || !pilotVisible(world, shooter, target)) continue;
    const q = target.q;
    velocity.x = 2 * (q.x * q.z + q.w * q.y) * target.s; velocity.y = 2 * (q.y * q.z - q.w * q.x) * target.s;
    velocity.z = (1 - 2 * (q.x * q.x + q.y * q.y)) * target.s;
    if (!gimbalAim(bend, shooter, target.p, velocity)) continue;
    const sq = shooter.q;
    const facing = bend.x * 2 * (sq.x * sq.z + sq.w * sq.y) + bend.y * 2 * (sq.y * sq.z - sq.w * sq.x)
      + bend.z * (1 - 2 * (sq.x * sq.x + sq.y * sq.y));
    if (facing > best) { best = facing; out.x = bend.x; out.y = bend.y; out.z = bend.z; found = true; }
  }
  return found;
}

const aim = { x: 0, y: 0, z: 0 };

/**
 * Fires when the gun is ready. Authoritative shots enter `projectiles`; prediction
 * (`ghost`) only draws a local tracer that can never deal damage.
 */
export function shoot(world: CombatWorld, pilot: Pilot, ghost: boolean): void {
  if (world.tick < pilot.nextShot || pilot.fuel < T.shotFuelCost) return;
  if (pilot.nextShot < world.tick - 1) pilot.nextShot = world.tick;
  pilot.nextShot += T.tickRate / T.fireRate;
  pilot.fuel = Math.max(0, pilot.fuel - T.shotFuelCost); pilot.shield = 0; pilot.cloak = 0;
  pilot.shots++; if (pilot === world.pilot) world.shots++;
  const q = pilot.q;
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const rx = 1 - 2 * (q.y * q.y + q.z * q.z); const ry = 2 * (q.x * q.y + q.w * q.z); const rz = 2 * (q.x * q.z - q.w * q.y);
  const ux = 2 * (q.x * q.y - q.w * q.z); const uy = 1 - 2 * (q.x * q.x + q.z * q.z); const uz = 2 * (q.y * q.z + q.w * q.x);
  const bent = gimbal(world, pilot, aim);
  if (!bent) { aim.x = fx; aim.y = fy; aim.z = fz; }
  const side = pilot.gun % 2 === 0 ? -1.2 : 1.2; pilot.gun++;
  const seed = (Math.imul(world.tick + pilot.id * 13, 17) >>> 0) % (SPREAD.length / 2) * 2;
  // Two guns converge on the nose line at convergeDist; a gimballed shot goes straight to the lead.
  const sx = (SPREAD[seed] ?? 0) * T.spreadBase - (bent ? 0 : side / T.convergeDist);
  const sy = (SPREAD[seed + 1] ?? 0) * T.spreadBase + (bent ? 0 : 0.6 / T.convergeDist);
  const dx = aim.x + rx * sx + ux * sy; const dy = aim.y + ry * sx + uy * sy; const dz = aim.z + rz * sx + uz * sy;
  const speed = T.muzzleSpeed / Math.sqrt(dx * dx + dy * dy + dz * dz);
  const pool = ghost ? world.ghosts : world.projectiles;
  if (pool.length === 0) return;
  const bullet = ghost ? pool[world.ghostCursor++ % pool.length] : pool[world.bulletCursor++ % pool.length];
  if (!bullet) return;
  bullet.p.x = pilot.p.x + fx * 4 + rx * side - ux * 0.6; bullet.p.y = pilot.p.y + fy * 4 + ry * side - uy * 0.6;
  bullet.p.z = pilot.p.z + fz * 4 + rz * side - uz * 0.6;
  bullet.previous.x = bullet.p.x; bullet.previous.y = bullet.p.y; bullet.previous.z = bullet.p.z;
  bullet.v.x = dx * speed + fx * pilot.s; bullet.v.y = dy * speed + fy * pilot.s; bullet.v.z = dz * speed + fz * pilot.s;
  bullet.life = T.projectileLife; bullet.owner = pilot.id;
}

/** Segment/sphere intersection uses relative motion, preventing tunnelling. */
export function swept(bullet: Projectile, p: Vec3, previous: Vec3, radius: number): number {
  const x = bullet.previous.x - previous.x; const y = bullet.previous.y - previous.y; const z = bullet.previous.z - previous.z;
  const dx = bullet.p.x - bullet.previous.x - (p.x - previous.x);
  const dy = bullet.p.y - bullet.previous.y - (p.y - previous.y); const dz = bullet.p.z - bullet.previous.z - (p.z - previous.z);
  const c = x * x + y * y + z * z - radius * radius; if (c <= 0) return 0;
  const a = dx * dx + dy * dy + dz * dz; const b = x * dx + y * dy + z * dz;
  if (a === 0 || b >= 0) return 2;
  const d = b * b - a * c; if (d < 0) return 2;
  const t = (-b - Math.sqrt(d)) / a; return t >= 0 && t <= 1 ? t : 2;
}

/**
 * A lost hold falls out where the ship died: each kind in dropChunk pieces, all of
 * them on one small ring round the wreck, close enough to sweep in a single pass.
 */
export function scatter(world: CombatWorld, pilot: Pilot): void {
  const chunks: [kind: number, amount: number][] = [];
  pilot.hold.forEach((units, kind) => {
    for (let left = units; left > 1e-9; left -= T.dropChunk) chunks.push([kind, Math.min(T.dropChunk, left)]);
  });
  pilot.cargo = 0; pilot.hold = pilot.hold.map(() => 0);
  let k = 0;
  for (const drop of world.cargoDrops) {
    const chunk = chunks[k];
    if (!chunk) break;
    if (drop.active || drop.field) continue;
    const [dx, dz] = RING12[Math.floor(k * RING12.length / chunks.length) % RING12.length] ?? [1, 0];
    drop.p.x = pilot.p.x + dx * T.scatterRadius * 0.85;
    drop.p.y = pilot.p.y + (k % 2 === 0 ? -1 : 1) * T.scatterRadius * 0.45;
    drop.p.z = pilot.p.z + dz * T.scatterRadius * 0.85;
    drop.kind = chunk[0]; drop.amount = chunk[1]; drop.active = true; drop.age = 0; k++;
  }
}

function advance(bullet: Projectile): void {
  bullet.previous.x = bullet.p.x; bullet.previous.y = bullet.p.y; bullet.previous.z = bullet.p.z;
  bullet.p.x += bullet.v.x / T.tickRate; bullet.p.y += bullet.v.y / T.tickRate; bullet.p.z += bullet.v.z / T.tickRate;
  bullet.life -= 1 / T.tickRate;
}

/** Earliest ship along the bullet's path this tick, or none. Writes the fraction into `hit`. */
function firstShip(world: CombatWorld, bullet: Projectile, hit: { t: number }): Pilot | undefined {
  let victim: Pilot | undefined; hit.t = 2;
  for (let j = 0; j <= world.drones.length; j++) {
    const target = j === 0 ? world.pilot : world.drones[j - 1];
    const previous = j === 0 ? world.previous : world.dronePrevious[j - 1];
    if (!target || !previous || target.id === bullet.owner || !alive(target)) continue;
    const contact = swept(bullet, target.p, previous.p, T.shipHitRadius);
    if (contact < hit.t) { hit.t = contact; victim = target; }
  }
  return victim;
}

const hit = { t: 2 };

/** Authoritative bullets: rock and structures block them, ships take damage. */
export function stepProjectiles(world: CombatWorld): void {
  for (const bullet of world.projectiles) {
    if (bullet.life <= 0) continue;
    advance(bullet);
    const victim = firstShip(world, bullet, hit);
    const rock = segmentObstacles(world.layout, bullet.previous.x, bullet.previous.y, bullet.previous.z,
      bullet.p.x, bullet.p.y, bullet.p.z, 0);
    const t = Math.min(hit.t, rock);
    if (t > 1) continue;
    const struck = rock <= hit.t ? undefined : victim;
    impact(world, bullet.previous.x + (bullet.p.x - bullet.previous.x) * t,
      bullet.previous.y + (bullet.p.y - bullet.previous.y) * t, bullet.previous.z + (bullet.p.z - bullet.previous.z) * t,
      struck ? (struck.shield > 0 ? 'shield' : 'ship') : 'rock');
    bullet.life = 0;
    if (!struck || struck.shield > 0) continue;
    struck.hull = Math.max(0, struck.hull - T.damage); struck.lastDamage = world.tick; struck.extraction = 0;
    struck.lastAttacker = bullet.owner;
    const attacker = bullet.owner === world.pilot.id ? world.pilot : world.drones.find(drone => drone.id === bullet.owner);
    if (attacker) attacker.hits++;
    if (struck.hull === 0) {
      struck.phase = 'dead'; struck.respawn = T.tickRate * T.botRespawn; struck.landed = 0; struck.mining = false;
      scatter(world, struck);
      impact(world, struck.p.x, struck.p.y, struck.p.z, 'explosion');
      if (attacker) attacker.kills++;
    }
  }
}

/** Predicted tracers only: they stop at the first rock or ship and never deal damage. */
export function stepGhosts(world: CombatWorld): void {
  for (const bullet of world.ghosts) {
    if (bullet.life <= 0) continue;
    advance(bullet);
    firstShip(world, bullet, hit);
    const rock = segmentObstacles(world.layout, bullet.previous.x, bullet.previous.y, bullet.previous.z,
      bullet.p.x, bullet.p.y, bullet.p.z, 0);
    const t = Math.min(hit.t, rock);
    if (t > 1) continue;
    bullet.p.x = bullet.previous.x + (bullet.p.x - bullet.previous.x) * t;
    bullet.p.y = bullet.previous.y + (bullet.p.y - bullet.previous.y) * t;
    bullet.p.z = bullet.previous.z + (bullet.p.z - bullet.previous.z) * t;
    bullet.life = 0;
  }
}
