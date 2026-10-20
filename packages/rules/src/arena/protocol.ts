import { ARENA_LAYOUT } from './layout.js';
import { PHASES, createPilot, type Pilot } from './pilot.js';
import { ARENA_TUNING as T } from './tuning.js';
import { FARM_KINDS, FIELD_GROUP_SIZE } from './farms.js';

export const ARENA_PROTOCOL = 3;
export const MAX_REMOTE_PILOTS = 12;
/** Numbers per packed pilot. The phase is always the last one. */
export const PILOT_WIDTH = 50;

/** Numeric tuples preserve full self precision and bound prototype traffic. */
export interface ArenaSnapshot {
  kind: 'snap'; tick: number; ack: number; self: number[]; others: number[][];
  bullets: number[][]; smoke: number[][]; cargo: number[][]; impacts: number[][];
  /** Remaining reserve per crystal, in layout order. */
  minerals: number[];
  /** 1 while a crystal rests dry (until it regrows to half), in layout order. */
  dry: number[];
}

export function packPilot(p: Pilot): number[] {
  return [p.id, p.p.x, p.p.y, p.p.z, p.q.x, p.q.y, p.q.z, p.q.w, p.s, p.throttle, p.omegaYaw, p.omegaPitch, p.fuel,
    p.landed, p.nx, p.ny, p.nz, p.landThrottle, p.liftoff, p.bump, p.kx, p.ky, p.kz,
    p.hull, p.shield, p.cloak, p.cloakCooldown, p.smokeCooldown, p.smokeEmit, p.turboCharge, p.turboDelay, p.turboBurst,
    Number(p.turboActive), p.nextShot, p.gun, p.cargo, p.hits, p.kills, p.lastDamage, p.lastAttacker, p.extraction,
    p.rescue, p.respawn, p.shots, p.linkLost, Number(p.mining), p.hold[0] ?? 0, p.hold[1] ?? 0, p.hold[2] ?? 0, PHASES.indexOf(p.phase)];
}

export function unpackPilot(values: readonly number[], out: Pilot = createPilot(values[0] ?? 0)): Pilot {
  let i = 0;
  const next = (fallback = 0): number => values[i++] ?? fallback;
  out.id = next();
  out.p.x = next(); out.p.y = next(); out.p.z = next();
  out.q.x = next(); out.q.y = next(); out.q.z = next(); out.q.w = next(1);
  out.s = next(); out.throttle = next(); out.omegaYaw = next(); out.omegaPitch = next(); out.fuel = next();
  out.landed = next(); out.nx = next(); out.ny = next(1); out.nz = next(); out.landThrottle = next(); out.liftoff = next();
  out.bump = next(); out.kx = next(); out.ky = next(); out.kz = next();
  out.hull = next(); out.shield = next(); out.cloak = next(); out.cloakCooldown = next(); out.smokeCooldown = next();
  out.smokeEmit = next(); out.turboCharge = next(); out.turboDelay = next(); out.turboBurst = next();
  out.turboActive = next() === 1; out.nextShot = next(); out.gun = next(); out.cargo = next(); out.hits = next();
  out.kills = next(); out.lastDamage = next(-100000); out.lastAttacker = next(-1); out.extraction = next();
  out.rescue = next(); out.respawn = next(); out.shots = next(); out.linkLost = next(); out.mining = next() === 1;
  out.hold = [next(), next(), next()];
  out.phase = PHASES[next()] ?? 'flying';
  return out;
}

function numbers(value: unknown, count: number): value is number[] {
  return Array.isArray(value) && value.length === count && value.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 100000000);
}
function rows(value: unknown, count: number, max: number): value is number[][] {
  return Array.isArray(value) && value.length <= max && value.every((row: unknown) => numbers(row, count));
}
function validPilot(value: number[]): boolean {
  const id = value[0] ?? -1; const phase = value[PILOT_WIDTH - 1] ?? -1; const landed = value[13] ?? -1;
  return Number.isInteger(id) && id >= 0 && Number.isInteger(phase) && phase >= 0 && phase < PHASES.length
    && Number.isInteger(landed) && landed >= 0 && landed <= ARENA_LAYOUT.obstacles.length
    && (value[12] ?? -1) >= 0 && (value[12] ?? T.fuelTank + 1) <= T.fuelTank
    && (value[23] ?? -1) >= 0 && (value[23] ?? T.hull + 1) <= T.hull
    && value.slice(PILOT_WIDTH - 4, PILOT_WIDTH - 1).every(units => units >= 0 && units <= T.cargoCapacity + 1e-6);
}

/** Malformed packets never reach renderer, HUD or reconciliation. */
export function decodeArenaSnapshot(value: unknown): ArenaSnapshot | null {
  if (typeof value !== 'object' || value === null || !('kind' in value) || value.kind !== 'snap'
    || !('tick' in value) || typeof value.tick !== 'number' || !Number.isSafeInteger(value.tick) || value.tick < 0
    || !('ack' in value) || typeof value.ack !== 'number' || !Number.isSafeInteger(value.ack) || value.ack < 0
    || !('self' in value) || !numbers(value.self, PILOT_WIDTH) || !validPilot(value.self)
    || !('others' in value) || !rows(value.others, PILOT_WIDTH, MAX_REMOTE_PILOTS) || !value.others.every(validPilot)
    || !('bullets' in value) || !rows(value.bullets, 12, 512)
    || !('smoke' in value) || !rows(value.smoke, 6, 64)
    || !('cargo' in value) || !rows(value.cargo, 7, T.fieldGroups * FIELD_GROUP_SIZE + T.wreckDrops)
    || !value.cargo.every(row => FARM_KINDS[row[6] ?? -1] !== undefined)
    || !('impacts' in value) || !rows(value.impacts, 6, 48)
    || !('minerals' in value) || !numbers(value.minerals, ARENA_LAYOUT.deposits.length)
    || !value.minerals.every(n => n >= 0 && n <= T.crystalReserve)
    || !('dry' in value) || !numbers(value.dry, ARENA_LAYOUT.deposits.length) || !value.dry.every(n => n === 0 || n === 1)) return null;
  return { kind: 'snap', tick: value.tick, ack: value.ack, self: value.self, others: value.others,
    bullets: value.bullets, smoke: value.smoke, cargo: value.cargo, impacts: value.impacts, minerals: value.minerals, dry: value.dry };
}
