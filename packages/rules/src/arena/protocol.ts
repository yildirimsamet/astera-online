import { ARENA_LAYOUT } from './layout.js';
import { CLASS_STATS, SHIP_CLASSES } from './classes.js';
import { PHASES, TACTICS, createPilot, type Pilot } from './pilot.js';
import { ARENA_TUNING as T } from './tuning.js';
import { FARM_KINDS } from './farms.js';
import type { ArenaFeed } from './feed.js';
import { ARENA_POOLS } from './pools.js';

/**
 * 5 (V6g, 2026-10-23): bullets, smoke, impacts, cargo and crystals travel as change (`feed.ts`).
 * 6: other ships travel trimmed and in two tiers (docs/komutan-gemisi/18-kademeli-gorunurluk-plani.md).
 * 7: full rows split at REMOTE_NEAR_RANGE; the middle tier comes every MID_EVERY ticks.
 * 8: the pilot's own row carries its class (Y4); `hello` names it, the roster carries everyone's.
 * 9: signatures and the B slot (Y4c): `hello` names the tactic, input carries the A slot and its
 *    target, the own row its cooldown, lock and warning, other rows a shield and a repair, the feed missiles.
 * 10: the last tactics (Y4d): illusion and radar sweep. The own row carries the tactic cooldown, its
 *    copy and its sweep; the snapshot the ships the pilot's sweep marks; impacts a hologram break.
 */
export const ARENA_PROTOCOL = 10;
/** Other ships one snapshot carries, every tier together: the nearest first (owner: room seats / 2). */
export const MAX_REMOTE_PILOTS = 50;
/**
 * Full rows every snapshot to REMOTE_NEAR_RANGE, every MID_EVERY ticks to REMOTE_FULL_RANGE; far rows
 * to REMOTE_FAR_RANGE. A ship keeps its tier inside ± REMOTE_BAND of each edge.
 */
export const REMOTE_NEAR_RANGE = 800;
export const REMOTE_FULL_RANGE = 1600;
export const REMOTE_FAR_RANGE = 2400;
export const REMOTE_BAND = 50;
/** Far rows go out on ticks that are a multiple of this (5 Hz), and when a ship first becomes far. */
export const FAR_EVERY = 6;
/** Middle rows go out on ticks that are a multiple of this (7.5 Hz): inside interpDelay, so never flown on. */
export const MID_EVERY = 4;
/** Numbers per full remote row and per far row. */
export const REMOTE_WIDTH = 21;
export const FAR_WIDTH = 10;
/** Seats one room may be configured with (`ARENA_SEATS`), and the roster rows a client takes: those, an illusion each, and the bots. */
export const ARENA_MAX_SEATS = 120;
export const ARENA_ROSTER_MAX = ARENA_MAX_SEATS * 2 + 8;
/** Numbers per packed pilot. The phase is always the last one, the class just before it. */
export const PILOT_WIDTH = 67;

/** Numeric tuples preserve full self precision and bound prototype traffic. The shared rows are an `ArenaFeed`. */
export interface ArenaSnapshot extends ArenaFeed {
  kind: 'snap'; tick: number; ack: number; self: number[];
  /** Full rows (`packRemote`): to REMOTE_NEAR_RANGE every snapshot, to REMOTE_FULL_RANGE every MID_EVERY ticks; far rows (`packFar`) every FAR_EVERY ticks. */
  others: number[][]; mid: number[][]; far: number[][];
  /** Ids of the ships the pilot's own radar sweep marks (Y4d): sent and marked wherever they are. */
  scan: number[];
}

export function packPilot(p: Pilot): number[] {
  return [p.id, p.p.x, p.p.y, p.p.z, p.q.x, p.q.y, p.q.z, p.q.w, p.s, p.throttle, p.omegaYaw, p.omegaPitch, p.fuel,
    p.landed, p.nx, p.ny, p.nz, p.landThrottle, p.liftoff, p.bump, p.kx, p.ky, p.kz,
    p.hull, p.shield, p.cloak, p.cloakCooldown, p.smokeCooldown, p.smokeEmit, p.turboCharge, p.turboDelay, p.turboBurst,
    Number(p.turboActive), p.nextShot, p.gun, p.cargo, p.hits, p.kills, p.lastDamage, p.lastAttacker, p.extraction,
    p.rescue, p.respawn, p.shots, p.linkLost, Number(p.mining), p.tacticCooldown, p.decoy, p.scan, TACTICS.indexOf(p.tactic), p.signatureCooldown, p.lockTarget, p.lockTicks,
    p.threat, p.threatX, p.threatY, p.threatZ, p.ward, p.mend, p.ammo, p.shieldHp, p.shieldMax, p.hold[0] ?? 0, p.hold[1] ?? 0, p.hold[2] ?? 0,
    SHIP_CLASSES.indexOf(p.ship), PHASES.indexOf(p.phase)];
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
  out.tacticCooldown = next(); out.decoy = next(-1); out.scan = next();
  out.tactic = TACTICS[next()] ?? 'smoke'; out.signatureCooldown = next(); out.lockTarget = next(-1); out.lockTicks = next();
  out.threat = next(); out.threatX = next(); out.threatY = next(); out.threatZ = next(); out.ward = next(); out.mend = next();
  out.ammo = next(); out.shieldHp = next(); out.shieldMax = next();
  out.hold = [next(), next(), next()];
  out.ship = SHIP_CLASSES[next()] ?? 'kilavuz';
  out.phase = PHASES[next()] ?? 'flying';
  return out;
}

/** `n` to the nearest 1 / `k` (k = 10, 100, 1000…). */
const round = (n: number, k: number): number => Math.round(n * k) / k;

/**
 * Another ship as it is drawn: place, heading, motion, landing, hull, flags (spawn shield, turbo,
 * mining, shield raised, repairing), gun and shot count (muzzle flash and sound), phase. What only its own pilot reads —
 * fuel, ammunition, hold, cooldowns — never leaves the room. A cloaked ship is never sent.
 */
export function packRemote(p: Pilot): number[] {
  return [p.id, round(p.p.x, 100), round(p.p.y, 100), round(p.p.z, 100), round(p.q.x, 1e4), round(p.q.y, 1e4), round(p.q.z, 1e4), round(p.q.w, 1e4),
    round(p.s, 10), round(p.throttle, 100), round(p.omegaYaw, 1000), round(p.omegaPitch, 1000),
    p.landed, round(p.nx, 1000), round(p.ny, 1000), round(p.nz, 1000), round(p.hull, 10),
    Number(p.shield > 0) | Number(p.turboActive) << 1 | Number(p.mining) << 2 | Number(p.ward > 0) << 3 | Number(p.mend > 0) << 4,
    p.gun, p.shots, PHASES.indexOf(p.phase)];
}

export function unpackRemote(v: readonly number[], out: Pilot): Pilot {
  const at = (i: number, fallback = 0): number => v[i] ?? fallback;
  out.id = at(0); out.p.x = at(1); out.p.y = at(2); out.p.z = at(3);
  out.q.x = at(4); out.q.y = at(5); out.q.z = at(6); out.q.w = at(7, 1);
  out.s = at(8); out.throttle = at(9); out.omegaYaw = at(10); out.omegaPitch = at(11);
  out.landed = at(12); out.nx = at(13); out.ny = at(14, 1); out.nz = at(15); out.hull = at(16);
  const flags = at(17); out.shield = flags & 1; out.turboActive = (flags & 2) !== 0; out.mining = (flags & 4) !== 0; out.cloak = 0;
  // Only whether a shield or repair runs: how much is left is its own pilot's business.
  out.ward = (flags & 8) !== 0 ? 1 : 0; out.mend = (flags & 16) !== 0 ? 1 : 0;
  out.gun = at(18); out.shots = at(19); out.phase = PHASES[at(20)] ?? 'flying';
  return out;
}

/** A ship 1.6–2.4 km out: place to 10 cm, heading, speed, and turbo / mining / landed. Always flying. */
export function packFar(p: Pilot): number[] {
  return [p.id, round(p.p.x, 10), round(p.p.y, 10), round(p.p.z, 10), round(p.q.x, 1000), round(p.q.y, 1000), round(p.q.z, 1000), round(p.q.w, 1000),
    round(p.s, 10), Number(p.turboActive) | Number(p.mining) << 1 | Number(p.landed > 0) << 2];
}

export function unpackFar(v: readonly number[], out: Pilot): Pilot {
  const at = (i: number, fallback = 0): number => v[i] ?? fallback;
  out.id = at(0); out.p.x = at(1); out.p.y = at(2); out.p.z = at(3);
  out.q.x = at(4); out.q.y = at(5); out.q.z = at(6); out.q.w = at(7, 1); out.s = at(8);
  const flags = at(9); out.turboActive = (flags & 1) !== 0; out.mining = (flags & 2) !== 0;
  // The obstacle it sits on is not sent; any landed ship reads as landed.
  out.landed = (flags & 4) !== 0 ? Math.max(1, out.landed) : 0;
  out.cloak = 0; out.phase = 'flying';
  return out;
}

function numbers(value: unknown, count: number): value is number[] {
  return Array.isArray(value) && value.length === count && value.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 100000000);
}
/** A whole number naming a slot of a pool of `size`. */
function slot(value: number | undefined, size: number): boolean {
  return value !== undefined && Number.isInteger(value) && value >= 0 && value < size;
}
function slots(value: unknown, size: number): value is number[] {
  return Array.isArray(value) && value.length <= size && value.every((n: unknown) => typeof n === 'number' && slot(n, size));
}
function rows(value: unknown, count: number, max: number): value is number[][] {
  return Array.isArray(value) && value.length <= max && value.every((row: unknown) => numbers(row, count));
}
/** Bounded by the pilot's own class: its tank, hull, magazine and hold. */
function validPilot(value: number[]): boolean {
  const id = value[0] ?? -1; const phase = value[PILOT_WIDTH - 1] ?? -1; const landed = value[13] ?? -1;
  const ship = SHIP_CLASSES[value[PILOT_WIDTH - 2] ?? -1]; if (!ship) return false;
  const most = CLASS_STATS[ship];
  const ammo = value[PILOT_WIDTH - 8] ?? -1; const shieldHp = value[PILOT_WIDTH - 7] ?? -1; const shieldMax = value[PILOT_WIDTH - 6] ?? -1;
  const fuel = value[12] ?? -1; const hull = value[23] ?? -1;
  const tactic = value[PILOT_WIDTH - 18] ?? -1; const threat = value[PILOT_WIDTH - 14] ?? -1; const decoy = value[PILOT_WIDTH - 20] ?? -2;
  return Number.isInteger(id) && id >= 0 && Number.isInteger(decoy) && decoy >= -1 && Number.isInteger(tactic) && tactic >= 0 && tactic < TACTICS.length
    && Number.isInteger(threat) && threat >= 0 && threat <= 4 && Number.isInteger(phase) && phase >= 0 && phase < PHASES.length
    && Number.isInteger(landed) && landed >= 0 && landed <= ARENA_LAYOUT.obstacles.length
    && fuel >= 0 && fuel <= most.fuelTank && hull >= 0 && hull <= most.hull
    && ammo >= 0 && ammo <= most.ammoCapacity && shieldMax >= 0 && shieldHp >= 0 && shieldHp <= shieldMax
    && value.slice(PILOT_WIDTH - 5, PILOT_WIDTH - 2).every(units => units >= 0 && units <= most.cargoCapacity + 1e-6);
}
/** The sturdiest class's hull: another ship's row says nothing of its class. */
const MOST_HULL = Math.max(...SHIP_CLASSES.map(ship => CLASS_STATS[ship].hull));

function validRemote(v: number[]): boolean {
  const id = v[0] ?? -1; const landed = v[12] ?? -1; const hull = v[16] ?? -1; const flags = v[17] ?? -1; const phase = v[REMOTE_WIDTH - 1] ?? -1;
  return Number.isInteger(id) && id >= 0 && Number.isInteger(landed) && landed >= 0 && landed <= ARENA_LAYOUT.obstacles.length
    && hull >= 0 && hull <= MOST_HULL && Number.isInteger(flags) && flags >= 0 && flags < 32
    && Number.isInteger(phase) && phase >= 0 && phase < PHASES.length;
}
function validFar(v: number[]): boolean {
  const id = v[0] ?? -1; const flags = v[FAR_WIDTH - 1] ?? -1;
  return Number.isInteger(id) && id >= 0 && Number.isInteger(flags) && flags >= 0 && flags < 8;
}
/** Pilot ids, at most MAX_REMOTE_PILOTS of them. */
function shipIds(value: unknown): value is number[] {
  return Array.isArray(value) && value.length <= MAX_REMOTE_PILOTS && value.every((n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0);
}
/** At most MAX_REMOTE_PILOTS ships between the tiers, each once. */
function ships(...tiers: number[][][]): boolean {
  const all = tiers.flat();
  return all.length <= MAX_REMOTE_PILOTS && new Set(all.map(row => row[0])).size === all.length;
}

/** Malformed packets never reach renderer, HUD or reconciliation. */
export function decodeArenaSnapshot(value: unknown): ArenaSnapshot | null {
  if (typeof value !== 'object' || value === null || !('kind' in value) || value.kind !== 'snap'
    || !('tick' in value) || typeof value.tick !== 'number' || !Number.isSafeInteger(value.tick) || value.tick < 0
    || !('ack' in value) || typeof value.ack !== 'number' || !Number.isSafeInteger(value.ack) || value.ack < 0
    || !('self' in value) || !numbers(value.self, PILOT_WIDTH) || !validPilot(value.self)
    || !('others' in value) || !rows(value.others, REMOTE_WIDTH, MAX_REMOTE_PILOTS) || !value.others.every(validRemote)
    || !('mid' in value) || !rows(value.mid, REMOTE_WIDTH, MAX_REMOTE_PILOTS) || !value.mid.every(validRemote)
    || !('far' in value) || !rows(value.far, FAR_WIDTH, MAX_REMOTE_PILOTS) || !value.far.every(validFar) || !ships(value.others, value.mid, value.far)
    || !('key' in value) || (value.key !== 0 && value.key !== 1)
    || !('bullets' in value) || !rows(value.bullets, 9, ARENA_POOLS.bullets) || !value.bullets.every(row => slot(row[0], ARENA_POOLS.bullets))
    || !('bulletsGone' in value) || !slots(value.bulletsGone, ARENA_POOLS.bullets)
    || !('smoke' in value) || !rows(value.smoke, 6, ARENA_POOLS.smoke) || !value.smoke.every(row => slot(row[0], ARENA_POOLS.smoke))
    || !('smokeGone' in value) || !slots(value.smokeGone, ARENA_POOLS.smoke)
    || !('impacts' in value) || !rows(value.impacts, 6, ARENA_POOLS.impacts)
    || !value.impacts.every(row => slot(row[0], ARENA_POOLS.impacts) && slot(row[5], 5))
    || !('cargo' in value) || !rows(value.cargo, 6, ARENA_POOLS.cargo)
    || !value.cargo.every(row => slot(row[0], ARENA_POOLS.cargo) && FARM_KINDS[row[5] ?? -1] !== undefined)
    || !('cargoGone' in value) || !slots(value.cargoGone, ARENA_POOLS.cargo)
    || !('minerals' in value) || !rows(value.minerals, 3, ARENA_LAYOUT.deposits.length)
    || !value.minerals.every(([i, reserve = -1, dry]) => slot(i, ARENA_LAYOUT.deposits.length) && reserve >= 0 && reserve <= T.crystalReserve
      && (dry === 0 || dry === 1))
    || !('missiles' in value) || !rows(value.missiles, 10, ARENA_POOLS.missiles) || !value.missiles.every(row => slot(row[0], ARENA_POOLS.missiles))
    || !('scan' in value) || !shipIds(value.scan)) return null;
  return { kind: 'snap', tick: value.tick, ack: value.ack, self: value.self, others: value.others, mid: value.mid, far: value.far, key: value.key,
    bullets: value.bullets, bulletsGone: value.bulletsGone, smoke: value.smoke, smokeGone: value.smokeGone, impacts: value.impacts,
    cargo: value.cargo, cargoGone: value.cargoGone, minerals: value.minerals, missiles: value.missiles, scan: value.scan };
}
