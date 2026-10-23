import { aimCone, type AimCone } from './aim.js';
import { CLASS_STATS, type ShipClass } from './classes.js';
import { segmentObstacles } from './collision.js';
import { firstShip, impact, strike, type CombatWorld } from './combat.js';
import { alive, sameSide, type ArenaIntent, type Missile, type Pilot } from './pilot.js';
import { ARENA_TUNING as T } from './tuning.js';
import { hiddenBySmoke, pilotInSight } from './visibility.js';

/**
 * The A slot (Y4c, plan 14 §4, owner 2026-10-23): each class's signature. The Akıncı locks a
 * ship held in its aim circle and sends a homing missile; the Muhafız raises a shield that
 * swallows hits; the Kılavuz repairs. Shield and repair are aimed at a friend, or at oneself.
 */
export const SIGNATURE_COOLDOWN: Readonly<Record<ShipClass, number>> = Object.freeze({ akinci: 14, muhafiz: 22, kilavuz: 20 });

export interface SignatureWorld extends CombatWorld { missiles: Missile[]; missileCursor: number }

const LOCK_TICKS = Math.round(T.lockTime * T.tickRate);
export const locked = (pilot: Pilot): boolean => pilot.lockTarget >= 0 && pilot.lockTicks >= LOCK_TICKS;
/** How far the lock has built, 0 to 1; 0 with no target. */
export const lockShare = (pilot: Pilot): number => pilot.lockTarget >= 0 ? Math.min(1, pilot.lockTicks / LOCK_TICKS) : 0;

const cone: AimCone = { ex: 0, ey: 0, ez: 0, ax: 0, ay: 0, az: 0, cos: 1 };

/** How near the middle of the shooter's aim circle a ship sits (cosine), or -2 outside it or beyond aimRange. */
function circleCos(shooter: Pilot, target: Pilot): number {
  const dx = target.p.x - shooter.p.x; const dy = target.p.y - shooter.p.y; const dz = target.p.z - shooter.p.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!(distance > 0) || distance > T.aimRange) return -2;
  const q = shooter.q;
  if (dx * 2 * (q.x * q.z + q.w * q.y) + dy * 2 * (q.y * q.z - q.w * q.x) + dz * (1 - 2 * (q.x * q.x + q.y * q.y)) <= 0) return -2;
  aimCone(cone, shooter);
  const ex = target.p.x - cone.ex; const ey = target.p.y - cone.ey; const ez = target.p.z - cone.ez;
  const cos = (ex * cone.ax + ey * cone.ay + ez * cone.az) / Math.sqrt(ex * ex + ey * ey + ez * ez);
  return cos >= cone.cos ? cos : -2;
}

const ships = (world: CombatWorld): Pilot[] => [world.pilot, ...world.drones];

/** How pressing each warning level is: a missile, then a held lock, a lock building, a radar sweep (Y4d). */
const URGENCY: readonly number[] = [0, 2, 3, 4, 1];
/** Warns `target` of what aims at it from (x, y, z); the most pressing warning this tick wins. */
export function warn(target: Pilot, threat: number, x: number, y: number, z: number): void {
  if ((URGENCY[threat] ?? 0) < (URGENCY[target.threat] ?? 0)) return;
  target.threat = threat; target.threatX = x; target.threatY = y; target.threatZ = z;
}

/**
 * An Akıncı's lock, each tick: it stays on a ship held in the circle and in sight, otherwise
 * moves to the one nearest the middle, and builds for lockTime. The ship is warned all along.
 */
export function stepLock(world: CombatWorld, pilot: Pilot): void {
  if (pilot.ship !== 'akinci') return;
  const held = (target: Pilot | undefined): target is Pilot =>
    target !== undefined && !sameSide(pilot, target) && alive(target) && circleCos(pilot, target) > -2 && pilotInSight(world, pilot, target);
  let target = ships(world).find(ship => ship.id === pilot.lockTarget);
  if (!held(target)) {
    target = undefined; let best = -2;
    for (const ship of ships(world)) {
      const cos = ship === pilot ? -2 : circleCos(pilot, ship);
      if (cos > best && held(ship)) { best = cos; target = ship; }
    }
    pilot.lockTicks = 0;
  }
  if (!target) { pilot.lockTarget = -1; return; }
  pilot.lockTarget = target.id; pilot.lockTicks = Math.min(LOCK_TICKS, pilot.lockTicks + 1);
  warn(target, locked(pilot) ? 2 : 1, pilot.p.x, pilot.p.y, pilot.p.z);
}

/** Who a shield or repair may go to: until the arena has friends (clans, plan 14 §12), only the caster. */
const friend = (caster: Pilot, id: number): Pilot | undefined => id === caster.id ? caster : undefined;

/** The A slot pressed: a missile at the lock, or a shield or repair on its target. Nothing is spent when it cannot go. */
export function castSignature(world: SignatureWorld, pilot: Pilot, input: ArenaIntent): void {
  if (!input.signature || pilot.signatureCooldown > 0) return;
  if (pilot.ship === 'akinci') {
    if (!locked(pilot)) return;
    const missile = world.missiles[world.missileCursor++ % world.missiles.length];
    if (!missile) return;
    const q = pilot.q;
    const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
    const nose = T.bodyLength / 2 + 1;
    missile.p.x = pilot.p.x + fx * nose; missile.p.y = pilot.p.y + fy * nose; missile.p.z = pilot.p.z + fz * nose;
    missile.previous.x = missile.p.x; missile.previous.y = missile.p.y; missile.previous.z = missile.p.z;
    missile.v.x = fx * T.missileSpeed; missile.v.y = fy * T.missileSpeed; missile.v.z = fz * T.missileSpeed;
    missile.life = T.missileLife; missile.owner = pilot.id; missile.target = pilot.lockTarget;
    pilot.lockTarget = -1; pilot.lockTicks = 0; pilot.shield = 0; pilot.cloak = 0;
  } else {
    const target = friend(pilot, input.signatureTarget ?? -1);
    if (!target) return;
    if (pilot.ship === 'muhafiz') {
      target.shieldHp = T.wardHp; target.shieldMax = T.wardHp; target.ward = Math.round(T.wardDuration * T.tickRate);
    } else target.mend = Math.round(T.mendDuration * T.tickRate);
  }
  pilot.signatureCooldown = Math.round(SIGNATURE_COOLDOWN[pilot.ship] * T.tickRate);
}

/** A shield that runs out drops; a repair mends its share, half while the ship is under fire. */
export function stepSignatureTimers(world: CombatWorld, pilot: Pilot): void {
  pilot.signatureCooldown = Math.max(0, pilot.signatureCooldown - 1);
  if (pilot.ward > 0 && --pilot.ward === 0) { pilot.shieldHp = 0; pilot.shieldMax = 0; }
  if (pilot.mend > 0) {
    const hurt = world.tick - pilot.lastDamage < T.mendHurtWindow * T.tickRate;
    const share = T.mendHp / (T.mendDuration * T.tickRate) * (hurt ? T.mendHurtFactor : 1);
    pilot.hull = Math.min(CLASS_STATS[pilot.ship].hull, pilot.hull + share);
    pilot.mend--;
  }
}

const hit = { t: 2 };

/**
 * Missiles, once a tick: each turns towards its target at most missileTurn, then flies; it
 * bursts on the first ship or rock in its path. A target that cloaks, hides in smoke or dies is
 * lost: the missile flies straight on until it burns out.
 */
export function stepMissiles(world: SignatureWorld): void {
  const cosStep = T.missileTurnCos; const sinStep = Math.sqrt(1 - cosStep * cosStep);
  for (const missile of world.missiles) {
    if (missile.life <= 0) continue;
    const target = missile.target >= 0 ? ships(world).find(ship => ship.id === missile.target) : undefined;
    if (!target || !alive(target) || target.cloak > 0 || hiddenBySmoke(world.smoke, missile.p, target.p)) missile.target = -1;
    else {
      const ux = missile.v.x / T.missileSpeed; const uy = missile.v.y / T.missileSpeed; const uz = missile.v.z / T.missileSpeed;
      let dx = target.p.x - missile.p.x; let dy = target.p.y - missile.p.y; let dz = target.p.z - missile.p.z;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (length > 0) {
        dx /= length; dy /= length; dz /= length;
        const cos = ux * dx + uy * dy + uz * dz;
        let nx = dx; let ny = dy; let nz = dz;
        if (cos < cosStep) {
          // Turn by `step` within the plane of the heading and the target.
          let wx = dx - ux * cos; let wy = dy - uy * cos; let wz = dz - uz * cos;
          const w = Math.sqrt(wx * wx + wy * wy + wz * wz);
          if (w > 0) { wx /= w; wy /= w; wz /= w; nx = ux * cosStep + wx * sinStep; ny = uy * cosStep + wy * sinStep; nz = uz * cosStep + wz * sinStep; }
          else { nx = ux; ny = uy; nz = uz; }
        }
        missile.v.x = nx * T.missileSpeed; missile.v.y = ny * T.missileSpeed; missile.v.z = nz * T.missileSpeed;
      }
    }
    missile.previous.x = missile.p.x; missile.previous.y = missile.p.y; missile.previous.z = missile.p.z;
    missile.p.x += missile.v.x / T.tickRate; missile.p.y += missile.v.y / T.tickRate; missile.p.z += missile.v.z / T.tickRate;
    missile.life = Math.max(0, missile.life - 1 / T.tickRate);
    const victim = firstShip(world, missile, hit);
    const rock = segmentObstacles(world.layout, missile.previous.x, missile.previous.y, missile.previous.z, missile.p.x, missile.p.y, missile.p.z, 0);
    const t = Math.min(hit.t, rock);
    if (t <= 1) {
      impact(world, missile.previous.x + (missile.p.x - missile.previous.x) * t, missile.previous.y + (missile.p.y - missile.previous.y) * t,
        missile.previous.z + (missile.p.z - missile.previous.z) * t, 'explosion');
      if (victim && rock > hit.t && victim.shield === 0) strike(world, victim, T.missileDamage, missile.owner);
      missile.life = 0; missile.target = -1;
      continue;
    }
    if (missile.life <= 0) { missile.target = -1; continue; }
    if (missile.target >= 0 && target) warn(target, 3, missile.p.x, missile.p.y, missile.p.z);
  }
}
