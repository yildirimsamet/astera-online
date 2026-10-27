import { statsOf } from './progression.js';
import { clampToArena, segmentObstacles } from './collision.js';
import { impact, shoot, type CombatWorld } from './combat.js';
import { createFlightState } from './flight.js';
import { alive, copyFlight, createPilot, sameSide, type ArenaIntent, type Pilot } from './pilot.js';
import { warn } from './signatures.js';
import { ARENA_TUNING as T } from './tuning.js';
import { abilityStats } from './ranks.js';
import type { Quaternion, Vec3 } from './types.js';

/**
 * The B slot's last two tactics (Y4d, plan 14 §4). Illusion: a copy born inside the ship flies
 * the mirror of its pilot (right is left, up is down), looks and fires like the ship (blanks) and
 * breaks like a hologram. Radar sweep: every enemy in the arena marked for a few seconds, the landed behind
 * rock too, never the cloaked or a copy; the scanned are warned, from where the sweep came.
 */
export interface Scan { owner: number; ticks: number; x: number; y: number; z: number; targets: number[] }
export interface TacticWorld extends CombatWorld { nextId: number; scans: Scan[] }

/** The level a scanned ship is warned at (`Pilot.threat`). */
export const SCANNED = 4;
const ships = (world: CombatWorld): Pilot[] => [world.pilot, ...world.drones];
const ticks = (seconds: number): number => Math.round(seconds * T.tickRate);

/** The copy takes the ship's place, heading, speed and everything another pilot can see of it. */
function castIllusion(world: TacticWorld, pilot: Pilot): void {
  const copy = createPilot(world.nextId++, pilot.ship, pilot.tactic, pilot.level);
  copy.ranks = { ...pilot.ranks }; copy.clanId = pilot.clanId; copy.mendPower = pilot.mendPower;
  copyFlight(copy, pilot);
  copy.hull = pilot.hull; copy.shield = pilot.shield; copy.shieldHp = pilot.shieldHp; copy.shieldMax = pilot.shieldMax;
  copy.ward = pilot.ward; copy.mend = pilot.mend; copy.turboCharge = pilot.turboCharge; copy.turboActive = pilot.turboActive;
  copy.turboDelay = pilot.turboDelay; copy.gun = pilot.gun; copy.nextShot = pilot.nextShot;
  copy.decoyOf = pilot.id; copy.decoyLife = ticks(abilityStats(pilot.ship, 'illusion', pilot.ranks.tactic).duration); copy.decoyHp = statsOf(pilot).hull * T.decoyHullShare;
  copy.shots = pilot.shots; Object.assign(copy.decoyFrom, pilot.p);
  const q = pilot.q; const along = copy.decoyAlong;
  along.x = 2 * (q.x * q.z + q.w * q.y); along.y = 2 * (q.y * q.z - q.w * q.x); along.z = 1 - 2 * (q.x * q.x + q.y * q.y);
  const length = Math.sqrt(along.x * along.x + along.y * along.y + along.z * along.z) || 1;
  along.x /= length; along.y /= length; along.z /= length;
  const previous = createFlightState(); copyFlight(previous, copy);
  world.drones.push(copy); world.dronePrevious.push(previous);
  pilot.decoy = copy.id;
}

/** Every enemy now in the arena, wherever it hides; not the cloaked, not a copy. */
function castRadar(world: TacticWorld, pilot: Pilot): void {
  const duration = abilityStats(pilot.ship, 'radar', pilot.ranks.tactic).duration;
  const targets = ships(world).filter(ship => !sameSide(pilot, ship) && ship.decoyOf < 0 && alive(ship) && ship.cloak === 0);
  world.scans = world.scans.filter(scan => scan.owner !== pilot.id);
  world.scans.push({ owner: pilot.id, ticks: ticks(duration), x: pilot.p.x, y: pilot.p.y, z: pilot.p.z, targets: targets.map(ship => ship.id) });
  for (const target of targets) warn(target, SCANNED, pilot.p.x, pilot.p.y, pilot.p.z);
  pilot.scan = ticks(duration);
}

/** The B slot pressed for an illusion or a sweep: nothing is spent when it cannot go. */
export function castTactic(world: TacticWorld, pilot: Pilot, input: ArenaIntent): void {
  if (pilot.tacticCooldown > 0) return;
  if (input.illusion && pilot.tactic === 'illusion') { castIllusion(world, pilot); pilot.tacticCooldown = ticks(abilityStats(pilot.ship, 'illusion', pilot.ranks.tactic).cooldown); }
  else if (input.radar && pilot.tactic === 'radar') { castRadar(world, pilot); pilot.tacticCooldown = ticks(abilityStats(pilot.ship, 'radar', pilot.ranks.tactic).cooldown); }
}

/** Sweeps age; those still running warn their marks again (the warning is rebuilt every tick). */
export function stepScans(world: TacticWorld): void {
  world.scans = world.scans.filter(scan => --scan.ticks > 0);
  for (const scan of world.scans) {
    for (const ship of ships(world)) if (scan.targets.includes(ship.id) && alive(ship) && ship.cloak === 0) warn(ship, SCANNED, scan.x, scan.y, scan.z);
  }
}

/** Ships `owner`'s sweep marks right now: alive and uncloaked. */
export function scanTargets(world: TacticWorld, owner: number): number[] {
  const marked = world.scans.filter(scan => scan.owner === owner).flatMap(scan => scan.targets);
  return ships(world).filter(ship => marked.includes(ship.id) && alive(ship) && ship.cloak === 0).map(ship => ship.id);
}

/**
 * A pose turned half round the line through `from` along the unit `along`: along it nothing
 * changes, across it everything flips (right is left, up is down). The copy is also rolled half
 * round its own nose, so where its pilot flies upright it does too. `out` may be the input.
 */
export function mirrorPose(from: Vec3, along: Vec3, p: Vec3, q: Quaternion, outP: Vec3, outQ: Quaternion): void {
  const fx = along.x; const fy = along.y; const fz = along.z;
  const dx = p.x - from.x; const dy = p.y - from.y; const dz = p.z - from.z;
  const d = 2 * (dx * fx + dy * fy + dz * fz);
  outP.x = from.x + d * fx - dx; outP.y = from.y + d * fy - dy; outP.z = from.z + d * fz - dz;
  // -(along, 0) ⊗ q ⊗ (0, 0, 1, 0): the half roll, then the half turn; signed so the copy is cast as q itself.
  const mx = q.y; const my = -q.x; const mz = q.w; const mw = -q.z;
  outQ.w = fx * mx + fy * my + fz * mz; outQ.x = fz * my - fx * mw - fy * mz;
  outQ.y = fx * mz - fy * mw - fz * mx; outQ.z = fy * mx - fx * my - fz * mw;
}

/**
 * A copy flies no stick of its own (owner 2026-10-24): every tick it is put at its pilot's mirror,
 * at its pilot's speed and turbo, so it cannot drift off it however its pilot flies. It fires as
 * its pilot fires, round for round; rock it is put into, or the arena's edge, breaks it.
 */
export function stepDecoy(world: TacticWorld, copy: Pilot, owner: Pilot): void {
  const x = copy.p.x; const y = copy.p.y; const z = copy.p.z;
  mirrorPose(copy.decoyFrom, copy.decoyAlong, owner.p, owner.q, copy.p, copy.q);
  copy.s = owner.s; copy.throttle = owner.throttle; copy.omegaYaw = -owner.omegaYaw; copy.omegaPitch = -owner.omegaPitch;
  copy.landed = 0; copy.mining = false; copy.turboActive = owner.turboActive; copy.turboCharge = owner.turboCharge;
  copy.shield = owner.shield; copy.ward = owner.ward; copy.mend = owner.mend; copy.shieldHp = owner.shieldHp; copy.shieldMax = owner.shieldMax;
  copy.fuel = statsOf(copy).fuelTank; copy.ammo = statsOf(copy).ammoCapacity;
  if (owner.shots > copy.shots) { copy.nextShot = world.tick; shoot(world, copy, false, true); copy.shots = owner.shots; }
  if (segmentObstacles(world.layout, x, y, z, copy.p.x, copy.p.y, copy.p.z, 0) <= 1 || clampToArena(copy.p, T.bodyRadius, world.layout)) copy.decoyHp = 0;
  copy.decoyLife--;
}

/**
 * Copies whose time is up, that took their share of damage, or whose pilot is gone, dead or has
 * flown on without them break like a hologram and leave the room.
 */
export function dissolveDecoys(world: TacticWorld): void {
  for (let i = world.drones.length - 1; i >= 0; i--) {
    const copy = world.drones[i];
    if (!copy || copy.decoyOf < 0) continue;
    const owner = ships(world).find(ship => ship.id === copy.decoyOf);
    const live = owner !== undefined && alive(owner) && owner.decoy === copy.id && alive(copy) && copy.decoyLife > 0 && copy.decoyHp > 0;
    if (live) continue;
    impact(world, copy.p.x, copy.p.y, copy.p.z, 'hologram');
    world.drones.splice(i, 1); world.dronePrevious.splice(i, 1);
    if (owner?.decoy === copy.id) owner.decoy = -1;
  }
}
