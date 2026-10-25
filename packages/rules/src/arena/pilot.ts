import { emptyHold } from './farms.js';
import { createFlightState } from './flight.js';
import { ARENA_TUNING as T } from './tuning.js';
import type { FlightInput, FlightState, Vec3 } from './types.js';

export interface ArenaIntent extends FlightInput { fire?: boolean; smoke?: boolean; cloak?: boolean; turboBurst?: boolean }
export type PilotPhase = 'flying' | 'fuelOut' | 'dead' | 'extracted' | 'towed';
export interface Pilot extends FlightState {
  id: number; hull: number; shield: number; cloak: number; cloakCooldown: number;
  smokeCooldown: number; smokeEmit: number; turboCharge: number; turboDelay: number;
  turboBurst: number; turboActive: boolean; nextShot: number; gun: number;
  /** Total units aboard; always the sum of `hold`, which keeps them by farm kind. */
  cargo: number; hold: number[]; hits: number; kills: number; lastDamage: number; lastAttacker: number; extraction: number;
  rescue: number; respawn: number; shots: number; linkLost: number; mining: boolean; phase: PilotPhase;
}
export interface Projectile { p: Vec3; previous: Vec3; v: Vec3; life: number; owner: number }
export interface SmokePuff { p: Vec3; age: number; active: boolean; owner: number }
/** A farm piece to fly through. `field` pieces float in the zone and grow back; the rest fell out of a wreck. */
export interface CargoDrop { p: Vec3; amount: number; active: boolean; age: number; field: boolean; kind: number }
export interface Impact { p: Vec3; age: number; kind: 'ship' | 'rock' | 'shield' | 'explosion'; active: boolean }

export const PHASES: readonly PilotPhase[] = ['flying', 'fuelOut', 'dead', 'extracted', 'towed'];

export function copyFlight(out: FlightState, state: FlightState): void {
  out.p.x = state.p.x; out.p.y = state.p.y; out.p.z = state.p.z;
  out.q.x = state.q.x; out.q.y = state.q.y; out.q.z = state.q.z; out.q.w = state.q.w;
  out.s = state.s; out.throttle = state.throttle; out.omegaYaw = state.omegaYaw;
  out.omegaPitch = state.omegaPitch; out.fuel = state.fuel; out.landed = state.landed;
  out.nx = state.nx; out.ny = state.ny; out.nz = state.nz; out.landThrottle = state.landThrottle;
  out.liftoff = state.liftoff; out.bump = state.bump; out.kx = state.kx; out.ky = state.ky; out.kz = state.kz;
}

export const createPilot = (id: number): Pilot => ({ ...createFlightState(), id, hull: T.hull,
  shield: id === 0 ? T.spawnShield * T.tickRate : 0, cloak: 0, cloakCooldown: 0,
  smokeCooldown: 0, smokeEmit: 0, turboCharge: T.turboCharge, turboDelay: 0,
  turboBurst: 0, turboActive: false, nextShot: 0, gun: 0, cargo: 0, hold: emptyHold(), hits: 0, kills: 0,
  lastDamage: -100000, lastAttacker: -1, extraction: 0, rescue: 0, respawn: 0, shots: 0, linkLost: 0,
  mining: false, phase: 'flying' });

export const alive = (pilot: Pilot): boolean => pilot.phase === 'flying' || pilot.phase === 'fuelOut';
