import type { ShipClass } from './classes.js';
import { levelOf, shipStats } from './progression.js';
import { emptyHold } from './farms.js';
import { createFlightState } from './flight.js';
import { ARENA_TUNING as T } from './tuning.js';
import { flightRanks, type FlightRanks } from './ranks.js';
import type { FlightInput, FlightState, Vec3 } from './types.js';

/**
 * `signature`: the A slot (Y4c), one press. `signatureTarget`: the pilot a shield or repair is
 * meant for, its own id for oneself; the missile ignores it and flies at its lock.
 */
export interface ArenaIntent extends FlightInput {
  fire?: boolean; smoke?: boolean; cloak?: boolean; turboBurst?: boolean; signature?: boolean; signatureTarget?: number;
  /** The B slot's illusion and radar sweep (Y4d), one press each. */
  illusion?: boolean; radar?: boolean;
}
/** The B slot (plan 14 §4): one tactic chosen before the sortie. */
export const TACTICS = ['smoke', 'cloak', 'illusion', 'radar'] as const;
export type Tactic = typeof TACTICS[number];
export type PilotPhase = 'flying' | 'fuelOut' | 'dead' | 'extracted' | 'towed';
export interface Pilot extends FlightState {
  /** Server-owned clan identity, frozen at launch; two null identities are never allies. */
  clanId: string | null;
  /** Repair power is the caster's, fixed when the buff starts on this recipient. */
  mendPower: number;
  /**
   * `shield` is the spawn shield, in ticks: nothing gets through while it lasts. The shield
   * layer is separate (owner 2026-10-21): `shieldHp` of `shieldMax` hit points, from a skill,
   * that take damage before the hull and do not refill in flight. `ammo`: rounds left.
   */
  /** The class it flies (Y4): its speed, turn, hull, guns, tank, hold and magazine (`classes.ts`). */
  ship: ShipClass;
  /** Effective ranks frozen at launch, shared with the owning client's prediction. */
  ranks: FlightRanks;
  /**
   * Y4c. `tactic`: its B slot. `signatureCooldown`: ticks until the A slot works again.
   * `lockTarget`/`lockTicks`: the ship the Akıncı is locking and for how long (-1, 0: none).
   * `threat`: what aims at this ship (0 nothing, 1 a lock building, 2 locked, 3 a missile on its
   * way) and from where. `ward`, `mend`: ticks left of a shield (its hit points are `shieldHp`)
   * and of a repair.
   */
  tactic: Tactic; signatureCooldown: number; lockTarget: number; lockTicks: number;
  threat: number; threatX: number; threatY: number; threatZ: number; ward: number; mend: number;
  /**
   * Y4d. `tacticCooldown`: ticks until an illusion or a radar sweep works again (smoke and cloak
   * keep their own). `decoy`: id of this pilot's live copy (-1: none); `scan`: ticks its sweep has left.
   * A copy is a ship of its own: `decoyOf` names its pilot (-1 on every real ship), `decoyLife`
   * ticks it has left, `decoyHp` the damage that breaks it. None of the three leaves the room.
   * `decoyFrom`, `decoyAlong`: where it was cast and the heading then, the line it mirrors about.
   */
  tacticCooldown: number; decoy: number; scan: number; decoyOf: number; decoyLife: number; decoyHp: number;
  decoyFrom: Vec3; decoyAlong: Vec3;
  id: number; hull: number; shield: number; shieldHp: number; shieldMax: number; ammo: number; cloak: number; cloakCooldown: number;
  smokeCooldown: number; smokeEmit: number; turboCharge: number; turboDelay: number;
  turboBurst: number; turboActive: boolean; nextShot: number; gun: number;
  /** Total units aboard; always the sum of `hold`, which keeps them by farm kind. */
  cargo: number; hold: number[]; hits: number; kills: number; lastDamage: number; lastAttacker: number; extraction: number;
  rescue: number; respawn: number; shots: number; linkLost: number; mining: boolean; phase: PilotPhase;
  /**
   * Y6b. `level`: the ship's level, 1–20; its numbers are `statsOf(pilot)`. `bot`: a room's own
   * ship, never worth XP. `pilotKills`, `assists`: pilots this one brought down, and helped down
   * (it hurt them in the last assistSeconds). `recentHits`: who hurt this ship lately, and when.
   */
  level: number; bot: boolean; pilotKills: number; assists: number; recentHits: { id: number; tick: number }[];
}
/** `damage`: its shooter's class damage, fixed when fired. */
export interface Projectile { p: Vec3; previous: Vec3; v: Vec3; life: number; owner: number; damage: number; clanId?: string | null }
/** The Akıncı's missile: homes on `target` (-1 once it lost it, then flies straight) until `life` runs out. */
export interface Missile { p: Vec3; previous: Vec3; v: Vec3; life: number; owner: number; target: number; damage: number; clanId?: string | null }
export interface SmokePuff { p: Vec3; age: number; active: boolean; owner: number }
/** A farm piece to fly through. `field` pieces float in the zone and grow back; the rest fell out of a wreck. */
/** `claim`: id of the ship pulling it in (the cargo magnet), -1 while it floats free. */
export interface CargoDrop { p: Vec3; amount: number; active: boolean; age: number; field: boolean; kind: number; claim: number }
/** `hologram`: an illusion's copy breaking (Y4d). */
export interface Impact { p: Vec3; age: number; kind: 'ship' | 'rock' | 'shield' | 'explosion' | 'hologram'; active: boolean }

export const PHASES: readonly PilotPhase[] = ['flying', 'fuelOut', 'dead', 'extracted', 'towed'];

export function copyFlight(out: FlightState, state: FlightState): void {
  out.p.x = state.p.x; out.p.y = state.p.y; out.p.z = state.p.z;
  out.q.x = state.q.x; out.q.y = state.q.y; out.q.z = state.q.z; out.q.w = state.q.w;
  out.s = state.s; out.throttle = state.throttle; out.omegaYaw = state.omegaYaw;
  out.omegaPitch = state.omegaPitch; out.fuel = state.fuel; out.landed = state.landed;
  out.nx = state.nx; out.ny = state.ny; out.nz = state.nz; out.landThrottle = state.landThrottle;
  out.liftoff = state.liftoff; out.bump = state.bump; out.kx = state.kx; out.ky = state.ky; out.kz = state.kz;
}

export const createPilot = (id: number, ship: ShipClass = 'kilavuz', tactic: Tactic = 'smoke', level = 1): Pilot => ({ ...createFlightState(),
  clanId: null, mendPower: 0,
  fuel: shipStats(ship, level).fuelTank, ship, id, hull: shipStats(ship, level).hull, level: levelOf(level), ranks: flightRanks(ship, tactic, {}),
  bot: false, pilotKills: 0, assists: 0, recentHits: [],
  tactic, signatureCooldown: 0, lockTarget: -1, lockTicks: 0, threat: 0, threatX: 0, threatY: 0, threatZ: 0, ward: 0, mend: 0,
  tacticCooldown: 0, decoy: -1, scan: 0, decoyOf: -1, decoyLife: 0, decoyHp: 0, decoyFrom: { x: 0, y: 0, z: 0 }, decoyAlong: { x: 0, y: 0, z: 0 },
  shield: id === 0 ? T.spawnShield * T.tickRate : 0, shieldHp: 0, shieldMax: 0, ammo: shipStats(ship, level).ammoCapacity, cloak: 0, cloakCooldown: 0,
  smokeCooldown: 0, smokeEmit: 0, turboCharge: T.turboCharge, turboDelay: 0,
  turboBurst: 0, turboActive: false, nextShot: 0, gun: 0, cargo: 0, hold: emptyHold(), hits: 0, kills: 0,
  lastDamage: -100000, lastAttacker: -1, extraction: 0, rescue: 0, respawn: 0, shots: 0, linkLost: 0,
  mining: false, phase: 'flying' });

export const alive = (pilot: Pilot): boolean => pilot.phase === 'flying' || pilot.phase === 'fuelOut';

/** One clan, or a ship and its own illusion: neither aims at, locks, hits nor sweeps the other. */
export const sameSide = (a: Pilot, b: Pilot): boolean => a === b || a.decoyOf === b.id || b.decoyOf === a.id
  || (a.clanId !== null && a.clanId === b.clanId);
