import { CLASS_STATS } from './classes.js';
import { impact, type CombatWorld } from './combat.js';
import { createFlightState } from './flight.js';
import { alive, copyFlight, createPilot, sameSide, type ArenaIntent, type Pilot } from './pilot.js';
import { warn } from './signatures.js';
import { ARENA_TUNING as T } from './tuning.js';

/**
 * The B slot's last two tactics (Y4d, plan 14 §4). Illusion: a copy born inside the ship flies
 * the mirror of its pilot's stick, looks and fires like the ship (blanks) and breaks like a
 * hologram. Radar sweep: every enemy in the arena marked for a few seconds, the landed behind
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
  const copy = createPilot(world.nextId++, pilot.ship, pilot.tactic);
  copyFlight(copy, pilot);
  copy.hull = pilot.hull; copy.shield = pilot.shield; copy.shieldHp = pilot.shieldHp; copy.shieldMax = pilot.shieldMax;
  copy.ward = pilot.ward; copy.mend = pilot.mend; copy.turboCharge = pilot.turboCharge; copy.turboActive = pilot.turboActive;
  copy.turboDelay = pilot.turboDelay; copy.gun = pilot.gun; copy.nextShot = pilot.nextShot;
  copy.decoyOf = pilot.id; copy.decoyLife = ticks(T.illusionDuration); copy.decoyHp = CLASS_STATS[pilot.ship].hull * T.decoyHullShare;
  const previous = createFlightState(); copyFlight(previous, copy);
  world.drones.push(copy); world.dronePrevious.push(previous);
  pilot.decoy = copy.id;
}

/** Every enemy now in the arena, wherever it hides; not the cloaked, not a copy. */
function castRadar(world: TacticWorld, pilot: Pilot): void {
  const targets = ships(world).filter(ship => !sameSide(pilot, ship) && ship.decoyOf < 0 && alive(ship) && ship.cloak === 0);
  world.scans = world.scans.filter(scan => scan.owner !== pilot.id);
  world.scans.push({ owner: pilot.id, ticks: ticks(T.radarDuration), x: pilot.p.x, y: pilot.p.y, z: pilot.p.z, targets: targets.map(ship => ship.id) });
  for (const target of targets) warn(target, SCANNED, pilot.p.x, pilot.p.y, pilot.p.z);
  pilot.scan = ticks(T.radarDuration);
}

/** The B slot pressed for an illusion or a sweep: nothing is spent when it cannot go. */
export function castTactic(world: TacticWorld, pilot: Pilot, input: ArenaIntent): void {
  if (pilot.tacticCooldown > 0) return;
  if (input.illusion && pilot.tactic === 'illusion') { castIllusion(world, pilot); pilot.tacticCooldown = ticks(T.illusionCooldown); }
  else if (input.radar && pilot.tactic === 'radar') { castRadar(world, pilot); pilot.tacticCooldown = ticks(T.radarCooldown); }
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

/** The intent a copy flies: its pilot's, mirrored — right is left, up is down; throttle, turbo and trigger alike. */
export function mirrorIntent(out: ArenaIntent, input: ArenaIntent): ArenaIntent {
  out.steerX = -input.steerX; out.steerY = -input.steerY; out.throttle = input.throttle; out.turbo = input.turbo;
  out.assistX = 0; out.assistY = 0; out.fire = input.fire === true; out.land = false;
  out.smoke = false; out.cloak = false; out.turboBurst = input.turboBurst === true; out.signature = false; out.illusion = false; out.radar = false;
  return out;
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
