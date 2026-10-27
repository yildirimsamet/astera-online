import { circleAim, gimbalAim } from './aim.js';
import { segmentObstacles } from './collision.js';
import { classTuning } from './classes.js';
import { ARENA_PROGRESSION, statsOf } from './progression.js';
import { sweptHull } from './hull.js';
import { ARENA_TUNING as T } from './tuning.js';
import { alive, sameSide, type Impact, type Pilot, type Projectile, type SmokePuff, type CargoDrop } from './pilot.js';
import { RING12 } from './vec.js';
import { pilotInSight } from './visibility.js';
import type { ArenaLayout, FlightState, Vec3 } from './types.js';

/** The slice of a world combat needs; keeps this module free of world orchestration. */
export interface CombatWorld {
  layout: ArenaLayout; tick: number; pilot: Pilot; drones: Pilot[]; previous: FlightState; dronePrevious: FlightState[];
  projectiles: Projectile[]; ghosts: Projectile[]; smoke: SmokePuff[]; impacts: Impact[]; cargoDrops: CargoDrop[];
  bulletCursor: number; ghostCursor: number; impactCursor: number; shots: number;
  /** See ArenaWorld.aimHorizon. */
  aimHorizon: number;
}

// Deterministic spread pattern, in units of spreadBase (pairs: x, y).
const SPREAD = [0, 0, 0.35, 0.1, -0.25, 0.2, 0.15, -0.4, -0.6, -0.1, 0.5, 0.45, -0.2, -0.65, 0.1, 0.7,
  0.65, -0.4, -0.45, 0.4, 0.3, -0.2, -0.1, 0.25];
export const SPREAD_PATTERN: readonly number[] = Object.freeze([...SPREAD]);
const RADII = Array.from({ length: SPREAD.length / 2 }, (_, i) => {
  const x = SPREAD[i * 2] ?? 0; const y = SPREAD[i * 2 + 1] ?? 0;
  return Math.sqrt(x * x + y * y);
});
/** The widest shot of the pattern, in units of spreadBase: every shot lands inside this cone (the reticle's ring). */
export const SPREAD_REACH = Math.max(...RADII);

/** Where the reticle's ring is true (owner 2026-10-24): the spread a pilot sees drawn is the spread at 500 m. */
export const RING_DISTANCE = 500;
/** How far off the line the widest shot lands at `distance` metres: the ring's radius out there. */
export function spreadAt(spreadBase: number, distance: number): number {
  if (!Number.isFinite(spreadBase) || !Number.isFinite(distance) || spreadBase < 0 || distance < 0) return 0;
  // A cone of a degree or two: the angle is its own tangent (no transcendentals in the shared simulation).
  return distance * SPREAD_REACH * spreadBase;
}

/** Where accuracy is read: a ship-sized target (4 m round) dead ahead, anywhere 200–400 m out. */
export const HIT_REFERENCE = Object.freeze({ radius: 4, near: 200, far: 400 });
/**
 * Accuracy as a share (owner 2026-10-24, "accuracy oranı"): of the pattern the guns fire, how much
 * lands on the reference target aimed dead centre, averaged over its distances. It comes from the
 * same cone the guns use, so it grows smoothly as a level narrows it.
 */
export function hitShare(spreadBase: number): number {
  if (!Number.isFinite(spreadBase) || spreadBase < 0) return 0;
  const { radius, near, far } = HIT_REFERENCE;
  const each = RADII.map(r => {
    if (r * spreadBase === 0) return 1;
    // A shot this far off the line stays on the target out to `reach` metres (a cone of a degree or
    // two: the angle is its own tangent, and the shared simulation stays free of transcendentals).
    const reach = radius / (r * spreadBase);
    return Math.min(1, Math.max(0, (reach - near) / (far - near)));
  });
  return each.reduce((sum, n) => sum + n, 0) / each.length;
}

export function impact(world: CombatWorld, x: number, y: number, z: number, kind: Impact['kind']): void {
  const hit = world.impacts[world.impactCursor++ % world.impacts.length]; if (!hit) return;
  hit.p.x = x; hit.p.y = y; hit.p.z = z; hit.age = 0; hit.kind = kind; hit.active = true;
}

const bend = { x: 0, y: 0, z: 0 };
const velocity = { x: 0, y: 0, z: 0 };
const ahead = { x: 0, y: 0, z: 0 };

/**
 * Best gun direction towards a visible pilot off the nose; false keeps the guns fixed.
 * Players aim with the circle (a target on its lead point beats one pinned to the rim);
 * bots keep the narrow gimbal.
 */
function gimbal(world: CombatWorld, shooter: Pilot, out: Vec3, circle: boolean): boolean {
  let best = -2; let found = false;
  for (let j = 0; j <= world.drones.length; j++) {
    const target = j === 0 ? world.pilot : world.drones[j - 1];
    if (!target || sameSide(shooter, target) || !alive(target)) continue;
    const q = target.q;
    velocity.x = 2 * (q.x * q.z + q.w * q.y) * target.s; velocity.y = 2 * (q.y * q.z - q.w * q.x) * target.s;
    velocity.z = (1 - 2 * (q.x * q.x + q.y * q.y)) * target.s;
    let rank = 0;
    if (circle) {
      ahead.x = target.p.x + velocity.x * world.aimHorizon; ahead.y = target.p.y + velocity.y * world.aimHorizon;
      ahead.z = target.p.z + velocity.z * world.aimHorizon;
      const mode = circleAim(bend, shooter, ahead, velocity);
      if (mode === 0) continue;
      if (mode === 1) rank = 2;
    } else if (!gimbalAim(bend, shooter, target.p, velocity)) continue;
    const sq = shooter.q;
    const facing = rank + bend.x * 2 * (sq.x * sq.z + sq.w * sq.y) + bend.y * 2 * (sq.y * sq.z - sq.w * sq.x)
      + bend.z * (1 - 2 * (sq.x * sq.x + sq.y * sq.y));
    if (facing > best && pilotInSight(world, shooter, target)) { best = facing; out.x = bend.x; out.y = bend.y; out.z = bend.z; found = true; }
  }
  return found;
}

const aim = { x: 0, y: 0, z: 0 };

/**
 * Fires when the gun is ready. Authoritative shots enter `projectiles`; prediction
 * (`ghost`) only draws a local tracer that can never deal damage. `circle`: a player's
 * guns (the aim circle); bots pass false.
 */
export function shoot(world: CombatWorld, pilot: Pilot, ghost: boolean, circle: boolean): void {
  if (world.tick < pilot.nextShot || pilot.ammo < 1) return;
  if (pilot.nextShot < world.tick - 1) pilot.nextShot = world.tick;
  const gun = statsOf(pilot);
  pilot.nextShot += T.tickRate / gun.fireRate;
  pilot.ammo -= 1; pilot.shield = 0; pilot.cloak = 0;
  pilot.shots++; if (pilot === world.pilot) world.shots++;
  const q = pilot.q;
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  const rx = 1 - 2 * (q.y * q.y + q.z * q.z); const ry = 2 * (q.x * q.y + q.w * q.z); const rz = 2 * (q.x * q.z - q.w * q.y);
  const ux = 2 * (q.x * q.y - q.w * q.z); const uy = 1 - 2 * (q.x * q.x + q.z * q.z); const uz = 2 * (q.y * q.z + q.w * q.x);
  const bent = gimbal(world, pilot, aim, circle);
  if (!bent) { aim.x = fx; aim.y = fy; aim.z = fz; }
  const side = pilot.gun % 2 === 0 ? -1.2 : 1.2; pilot.gun++;
  const seed = (Math.imul(world.tick + pilot.id * 13, 17) >>> 0) % (SPREAD.length / 2) * 2;
  // Two guns converge on the nose line at convergeDist; a gimballed shot goes straight to the lead.
  const sx = (SPREAD[seed] ?? 0) * gun.spreadBase - (bent ? 0 : side / T.convergeDist);
  const sy = (SPREAD[seed + 1] ?? 0) * gun.spreadBase + (bent ? 0 : 0.6 / T.convergeDist);
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
  // An illusion's copy fires blanks in its pilot's name (Y4d): light that hurts no one.
  bullet.clanId = pilot.clanId; bullet.life = T.projectileLife; bullet.owner = pilot.decoyOf >= 0 ? pilot.decoyOf : pilot.id; bullet.damage = pilot.decoyOf >= 0 ? 0 : gun.damage;
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
    drop.kind = chunk[0]; drop.amount = chunk[1]; drop.active = true; drop.age = 0; drop.claim = -1; k++;
  }
}

/** One tick of straight flight; the client runs it too between snapshots. */
export function advance(bullet: Projectile): void {
  bullet.previous.x = bullet.p.x; bullet.previous.y = bullet.p.y; bullet.previous.z = bullet.p.z;
  bullet.p.x += bullet.v.x / T.tickRate; bullet.p.y += bullet.v.y / T.tickRate; bullet.p.z += bullet.v.z / T.tickRate;
  bullet.life -= 1 / T.tickRate;
}

/** Earliest ship along a shot's path this tick (a bullet or a missile), or none. Writes the fraction into `hit`. */
export function firstShip(world: CombatWorld, bullet: { p: Vec3; previous: Vec3; owner: number; clanId?: string | null }, hit: { t: number }): Pilot | undefined {
  let victim: Pilot | undefined; hit.t = 2;
  for (let j = 0; j <= world.drones.length; j++) {
    const target = j === 0 ? world.pilot : world.drones[j - 1];
    const previous = j === 0 ? world.previous : world.dronePrevious[j - 1];
    if (!target || !previous || target.id === bullet.owner || target.decoyOf === bullet.owner || (bullet.clanId != null && bullet.clanId === target.clanId) || !alive(target)) continue;
    const contact = sweptHull(bullet, target, previous.p, classTuning(target.ship));
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
      struck ? (struck.shield > 0 || struck.shieldHp > 0 ? 'shield' : 'ship') : 'rock');
    bullet.life = 0;
    if (!struck || struck.shield > 0 || bullet.damage <= 0) continue;
    strike(world, struck, bullet.damage, bullet.owner);
  }
}

/**
 * One hit on a ship outside its spawn shield. A raised shield takes it whole (owner 2026-10-23):
 * the hit that breaks it stops there and the hull feels only the next one.
 */
export function strike(world: CombatWorld, struck: Pilot, damage: number, owner: number): void {
  if (struck.shieldHp > 0) {
    struck.shieldHp = Math.max(0, struck.shieldHp - damage);
    if (struck.shieldHp === 0) { struck.shieldMax = 0; struck.ward = 0; }
  } else struck.hull = Math.max(0, struck.hull - damage);
  struck.lastDamage = world.tick; struck.extraction = 0; struck.lastAttacker = owner;
  const attacker = shipById(world, owner);
  if (attacker) attacker.hits++;
  // A copy takes the hit like a ship, its bar falling, and breaks once it has had its share: no kill, no wreck.
  if (struck.decoyOf >= 0) { struck.decoyHp = struck.hull === 0 ? 0 : Math.max(0, struck.decoyHp - damage); return; }
  if (owner !== struck.id) remember(struck, owner, world.tick);
  if (struck.hull === 0) {
    struck.phase = 'dead'; struck.respawn = T.tickRate * T.botRespawn; struck.landed = 0; struck.mining = false;
    scatter(world, struck);
    impact(world, struck.p.x, struck.p.y, struck.p.z, 'explosion');
    if (attacker) attacker.kills++;
    // XP counts pilots only: a bot is a kill on the board and nothing more (owner 2026-10-23).
    if (struck.bot) return;
    if (attacker) attacker.pilotKills++;
    const since = world.tick - ARENA_PROGRESSION.assistSeconds * T.tickRate;
    for (const hit of struck.recentHits) if (hit.id !== owner && hit.tick >= since) { const helper = shipById(world, hit.id); if (helper) helper.assists++; }
  }
}

const shipById = (world: CombatWorld, id: number): Pilot | undefined => id === world.pilot.id ? world.pilot : world.drones.find(drone => drone.id === id);
/** Who hurt a ship and when, the latest few: the assists at its death. */
function remember(struck: Pilot, owner: number, tick: number): void {
  const known = struck.recentHits.find(hit => hit.id === owner);
  if (known) { known.tick = tick; return; }
  if (struck.recentHits.length >= 8) {
    const stalest = struck.recentHits.reduce((at, hit, i, all) => hit.tick < (all[at]?.tick ?? Infinity) ? i : at, 0);
    struck.recentHits.splice(stalest, 1);
  }
  struck.recentHits.push({ id: owner, tick });
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
