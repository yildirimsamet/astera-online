import { mulberry32 } from '../rng.js';
import type { Rng } from '../types.js';
import { createBrain, thinkBot, type BotBrain, type BotRole } from './bots.js';
import type { ShipClass } from './classes.js';
import { shipTuning, statsOf } from './progression.js';
import { abilityStats } from './ranks.js';
import { scatter, shoot, stepGhosts, stepProjectiles, impact } from './combat.js';
import { createInput } from './controls.js';
import { FIELD_GROUP_SIZE, pickFieldSpawn } from './farms.js';
import { createFlightState, stepFlight } from './flight.js';
import { ARENA_LAYOUT, spawnFlight } from './layout.js';
import { alive, copyFlight, createPilot, type ArenaIntent, type CargoDrop, type Impact, type Missile, type Pilot,
  type Projectile, type SmokePuff, type Tactic } from './pilot.js';
import { ageEffects, ARENA_POOLS } from './pools.js';
import { castSignature, stepLock, stepMissiles, stepSignatureTimers } from './signatures.js';
import { castTactic, dissolveDecoys, stepDecoy, stepScans, type Scan } from './tactics.js';
import { RING12 } from './vec.js';
import { ARENA_TUNING as T } from './tuning.js';
import type { ArenaLayout, FlightState, SteeringSettings, Vec3 } from './types.js';

export { pilotVisible } from './visibility.js';
export type { ArenaIntent, Pilot } from './pilot.js';

export interface ArenaWorld {
  layout: ArenaLayout;
  pilot: Pilot; previous: FlightState; drones: Pilot[]; dronePrevious: FlightState[];
  brains: Map<number, BotBrain>; random: Rng;
  /** Remaining reserve per deposit, in `layout.deposits` order. */
  minerals: number[];
  /** A crystal mined dry rests until it grows back to half its reserve. */
  dry: boolean[];
  tick: number; droneInput: ArenaIntent; neutralInput: ArenaIntent;
  projectiles: Projectile[]; ghosts: Projectile[]; smoke: SmokePuff[];
  cargoDrops: CargoDrop[]; impacts: Impact[]; missiles: Missile[];
  /** The entrance the next arrival takes (`nextEntry`). */
  entryCursor: number; bulletCursor: number; ghostCursor: number; smokeCursor: number; missileCursor: number;
  impactCursor: number; damageSide: number; shots: number;
  /** The id the next ship to join gets: a pilot or an illusion's copy (Y4d). */
  nextId: number;
  /** Radar sweeps running (Y4d). */
  scans: Scan[];
  /** Per field group: the farm spot it grew on (-1 while taken) and seconds since it was emptied. */
  fieldSpots: number[]; fieldTimers: number[];
  /**
   * Seconds the other ships stand behind this world's own pilot: 0 on the server and in the
   * sandbox. The client sets its aim horizon here so its predicted tracers aim where the
   * server will fly the real shot (KG-T16).
   */
  aimHorizon: number;
}

/** `ship`, `tactic`: the class and B slot the world's own pilot flies (the sandbox's choice). */
export interface WorldOptions { bots?: number; layout?: ArenaLayout; seed?: number; ship?: ShipClass; tactic?: Tactic }

const point = (): Vec3 => ({ x: 0, y: 0, z: 0 });
const projectile = (): Projectile => ({ p: point(), previous: point(), v: point(), life: 0, owner: -1, damage: 0 });
const ROLES: readonly BotRole[] = ['hunter', 'miner', 'patrol'];
/** Each bot flies the ship built for its role: the hunter the Akıncı, the miner the Muhafız's hold, the patrol the Kılavuz. */
export const ROLE_SHIPS: Readonly<Record<BotRole, ShipClass>> = { hunter: 'akinci', miner: 'muhafiz', patrol: 'kilavuz' };

/**
 * The entrance for the next arrival, dealt round robin (owner 2026-10-23): two arrivals in a
 * row never share one. In the 48-bot study most first contacts were at the entrance just used.
 * Teams, when the arena has them, arrive together through one entrance.
 */
export function nextEntry(world: ArenaWorld): number {
  const entry = world.entryCursor % Math.max(1, world.layout.entries.length);
  world.entryCursor = entry + 1;
  return entry;
}

function place(world: ArenaWorld, pilot: Pilot): void {
  if (world.layout.entries.length > 0) spawnFlight(pilot, world.random, world.layout, nextEntry(world));
}

/** Local or shared world. Holds no persistent rewards, repairs or galaxy economy. */
export function createSandboxWorld(options: WorldOptions = {}): ArenaWorld {
  const layout = options.layout ?? ARENA_LAYOUT;
  const pilot = createPilot(0, options.ship, options.tactic);
  const world: ArenaWorld = {
    layout, pilot, previous: createFlightState(), drones: [], dronePrevious: [], brains: new Map(),
    random: mulberry32(options.seed ?? 4100),
    minerals: layout.deposits.map(() => T.crystalReserve), dry: layout.deposits.map(() => false),
    tick: 0, droneInput: createInput(), neutralInput: createInput(),
    projectiles: Array.from({ length: ARENA_POOLS.bullets }, projectile), ghosts: Array.from({ length: ARENA_POOLS.ghosts }, projectile),
    smoke: Array.from({ length: ARENA_POOLS.smoke }, () => ({ p: point(), age: 0, active: false, owner: -1 })),
    impacts: Array.from({ length: ARENA_POOLS.impacts }, () => ({ p: point(), age: 0, kind: 'rock', active: false })),
    missiles: Array.from({ length: ARENA_POOLS.missiles }, () => ({ p: point(), previous: point(), v: point(), life: 0, owner: -1, target: -1, damage: T.missileDamage })),
    cargoDrops: Array.from({ length: ARENA_POOLS.cargo },
      (_, i) => ({ p: point(), amount: 0, active: false, age: 0, field: i < T.fieldGroups * FIELD_GROUP_SIZE, kind: 0, claim: -1 })),
    fieldSpots: Array.from({ length: T.fieldGroups }, () => -1), fieldTimers: Array.from({ length: T.fieldGroups }, () => 0),
    entryCursor: 0, bulletCursor: 0, ghostCursor: 0, smokeCursor: 0, missileCursor: 0, impactCursor: 0, damageSide: 0, shots: 0, aimHorizon: 0,
    nextId: 1, scans: [],
  };
  place(world, pilot);
  copyFlight(world.previous, pilot);
  for (let g = 0; g < T.fieldGroups; g++) growField(world, g);
  const count = Math.max(0, Math.floor(options.bots ?? ROLES.length));
  for (let i = 0; i < count; i++) {
    const role = ROLES[i % ROLES.length] ?? 'patrol';
    const bot = createPilot(i + 1, ROLE_SHIPS[role]);
    bot.bot = true;
    place(world, bot);
    if (role === 'miner') { bot.cargo = 80; bot.hold[1] = 80; }
    world.brains.set(bot.id, createBrain(role));
    world.drones.push(bot);
    const prior = createFlightState(); copyFlight(prior, bot); world.dronePrevious.push(prior);
  }
  world.nextId = count + 1;
  return world;
}

function respawnBot(world: ArenaWorld, bot: Pilot, brain: BotBrain): void {
  const id = bot.id;
  Object.assign(bot, createPilot(id, bot.ship), { bot: true });
  place(world, bot);
  if (brain.role === 'miner') { bot.cargo = 0; bot.hold = bot.hold.map(() => 0); }
  const fresh = createBrain(brain.role);
  Object.assign(brain, fresh, { wander: brain.wander });
}

/** Lands-on-crystal mining. Dry crystals rest until they regrow to half. */
function mineAndRegrow(world: ArenaWorld): void {
  const mined = new Set<number>();
  for (let j = 0; j <= world.drones.length; j++) {
    const pilot = j === 0 ? world.pilot : world.drones[j - 1];
    if (!pilot) continue;
    pilot.mining = false;
    if (pilot.phase !== 'flying' || !pilot.landed || pilot.decoyOf >= 0) continue;
    const slot = world.layout.deposits.indexOf(pilot.landed - 1);
    const kind = world.layout.depositKinds[slot] ?? 0;
    const hold = statsOf(pilot).cargoCapacity;
    if (slot < 0 || world.dry[slot] || pilot.cargo >= hold) continue;
    const reserve = world.minerals[slot] ?? 0;
    const amount = Math.min(T.mineRate / T.tickRate, reserve, hold - pilot.cargo);
    if (amount <= 0) continue;
    pilot.cargo += amount; pilot.hold[kind] = (pilot.hold[kind] ?? 0) + amount; pilot.shield = 0; pilot.mining = true; mined.add(slot);
    world.minerals[slot] = reserve - amount;
    if (world.minerals[slot] <= 0) { world.minerals[slot] = 0; world.dry[slot] = true; }
  }
  for (let slot = 0; slot < world.minerals.length; slot++) {
    if (mined.has(slot)) continue;
    const next = Math.min(T.crystalReserve, (world.minerals[slot] ?? 0) + T.crystalRegen / T.tickRate);
    world.minerals[slot] = next;
    if (world.dry[slot] && next >= T.crystalReserve / 2) world.dry[slot] = false;
  }
}

/**
 * Grows field group `g` on a random farm spot no other group holds: a lone piece on
 * the spot itself, or a cluster spread round it at clusterRadius.
 */
function growField(world: ArenaWorld, g: number): void {
  const spots = world.layout.farmSpots;
  for (let attempt = 0; attempt < spots.length * 2; attempt++) {
    const index = Math.floor(world.random() * spots.length); const spot = spots[index];
    if (!spot || world.fieldSpots.includes(index)) continue;
    const spawn = pickFieldSpawn(world.random());
    for (let k = 0; k < FIELD_GROUP_SIZE; k++) {
      const drop = world.cargoDrops[g * FIELD_GROUP_SIZE + k]; if (!drop) continue;
      const [dx, dz] = spawn.pieces > 1 ? RING12[Math.floor(k * RING12.length / spawn.pieces) % RING12.length] ?? [0, 0] : [0, 0];
      drop.p.x = spot.x + dx * T.clusterRadius; drop.p.y = spot.y; drop.p.z = spot.z + dz * T.clusterRadius;
      drop.active = k < spawn.pieces; drop.kind = spawn.kind; drop.amount = drop.active ? spawn.amount : 0; drop.age = 0; drop.claim = -1;
    }
    world.fieldSpots[g] = index; world.fieldTimers[g] = 0;
    return;
  }
}

/** A group regrows fieldFarmRespawn seconds after its last piece is taken, never before. */
function stepField(world: ArenaWorld): void {
  for (let g = 0; g < T.fieldGroups; g++) {
    let live = false;
    for (let k = 0; k < FIELD_GROUP_SIZE; k++) if (world.cargoDrops[g * FIELD_GROUP_SIZE + k]?.active) live = true;
    if (live) continue;
    world.fieldSpots[g] = -1;
    world.fieldTimers[g] = (world.fieldTimers[g] ?? 0) + 1 / T.tickRate;
    if ((world.fieldTimers[g] ?? 0) >= T.fieldFarmRespawn - 1e-9) growField(world, g);
  }
}

/** `bot`: aims with the bot gimbal instead of the player's aim circle. */
function stepPilot(world: ArenaWorld, pilot: Pilot, input: ArenaIntent, settings: SteeringSettings | undefined, predictOnly: boolean,
  bot = false): void {
  if (!alive(pilot)) return;
  const dt = 1 / T.tickRate;
  pilot.shield = Math.max(0, pilot.shield - 1); pilot.cloak = Math.max(0, pilot.cloak - 1);
  pilot.cloakCooldown = Math.max(0, pilot.cloakCooldown - 1); pilot.smokeCooldown = Math.max(0, pilot.smokeCooldown - 1);
  pilot.tacticCooldown = Math.max(0, pilot.tacticCooldown - 1); pilot.scan = Math.max(0, pilot.scan - 1);
  const powered = pilot.fuel > 0 && pilot.phase === 'flying';
  stepSignatureTimers(world, pilot);
  if (!predictOnly) { stepLock(world, pilot); if (powered) { castSignature(world, pilot, input); castTactic(world, pilot, input); } }
  if (powered && input.smoke && pilot.tactic === 'smoke' && pilot.smokeCooldown === 0) {
    const skill = abilityStats(pilot.ship, 'smoke', pilot.ranks.tactic);
    pilot.smokeEmit = Math.round(skill.duration * T.tickRate); pilot.smokeCooldown = Math.round(skill.cooldown * T.tickRate);
  }
  if (powered && input.cloak && pilot.tactic === 'cloak' && pilot.cloakCooldown === 0) {
    const skill = abilityStats(pilot.ship, 'cloak', pilot.ranks.tactic);
    pilot.cloak = Math.round(skill.duration * T.tickRate); pilot.cloakCooldown = Math.round(skill.cooldown * T.tickRate);
  }
  if (powered && input.turboBurst) pilot.turboBurst = T.turboTapBurst * T.tickRate;
  // On the ground turbo is a take-off (stepFlight lifts off): the escape from a mining ambush.
  const turbo = powered && (input.turbo || pilot.turboBurst > 0) && pilot.turboCharge > 0
    && (pilot.turboActive || pilot.turboCharge >= T.turboMinStart);
  pilot.turboActive = turbo;
  if (turbo) { pilot.turboCharge = Math.max(0, pilot.turboCharge - dt); pilot.turboDelay = T.turboRegenDelay * T.tickRate; }
  else if (pilot.turboDelay > 0) pilot.turboDelay--;
  else {
    const skill = abilityStats(pilot.ship, 'turbo', pilot.ranks.turbo);
    pilot.turboCharge = Math.min(skill.duration, pilot.turboCharge + skill.duration / skill.cooldown * dt * (pilot.landed ? T.landedTurboRegenMul : 1));
  }
  pilot.turboBurst = Math.max(0, pilot.turboBurst - 1);
  const held = input.turbo; input.turbo = turbo;
  if (pilot.phase === 'fuelOut') {
    // Out of fuel: no pilot input at all; the hull coasts to a stop.
    const throttle = input.throttle; const steerX = input.steerX; const steerY = input.steerY;
    input.throttle = 0; input.steerX = 0; input.steerY = 0;
    stepFlight(pilot, input, world.layout, settings, shipTuning(pilot.ship, pilot.level));
    input.throttle = throttle; input.steerX = steerX; input.steerY = steerY;
  } else stepFlight(pilot, input, world.layout, settings, shipTuning(pilot.ship, pilot.level));
  input.turbo = held;
  if (powered && input.fire) shoot(world, pilot, predictOnly, !bot);
  if (pilot.smokeEmit > 0) {
    if (!predictOnly && pilot.smokeEmit % Math.max(1, Math.round(T.smokePuffInterval * T.tickRate)) === 0) {
      const puff = world.smoke[world.smokeCursor++ % world.smoke.length];
      if (puff) { puff.p.x = pilot.p.x; puff.p.y = pilot.p.y; puff.p.z = pilot.p.z; puff.active = true; puff.age = 0; puff.owner = pilot.id; }
    }
    pilot.smokeEmit--;
  }
  if (pilot.fuel === 0 && pilot.phase === 'flying') { pilot.phase = 'fuelOut'; pilot.rescue = T.fuelOutRescueDelay * T.tickRate; }
  if (pilot.phase === 'fuelOut') { pilot.rescue = Math.max(0, pilot.rescue - 1); if (!predictOnly && pilot.rescue === 0) { pilot.phase = 'towed'; scatter(world, pilot); } }
  if (pilot.linkLost > 0) { pilot.linkLost--; if (!predictOnly && pilot.linkLost === 0 && alive(pilot)) { pilot.phase = 'towed'; scatter(world, pilot); } }
}

function inExitZone(world: ArenaWorld, pilot: Pilot): boolean {
  for (const exit of world.layout.exits) {
    const x = exit.x - pilot.p.x; const y = exit.y - pilot.p.y; const z = exit.z - pilot.p.z;
    if (x * x + y * y + z * z <= T.exitRadius * T.exitRadius) return true;
  }
  return false;
}

/**
 * The cargo magnet (owner 2026-10-22). A free piece is claimed by the first flying ship
 * within magnetRadius whose hold takes it whole, counting what that ship already pulls;
 * two on the same tick, the nearer. Nobody else can take a claimed piece and it is never
 * split. It homes on its puller faster than the puller flies and lands in the hold at the
 * hull. A puller that stops flying, or ends up far away, lets go: the piece stops, free.
 */
function stepMagnet(world: ArenaWorld): void {
  // An illusion's copy has no hold.
  const ships = [world.pilot, ...world.drones].filter(ship => ship.decoyOf < 0);
  const reach = T.magnetRadius * T.magnetRadius;
  const pulling = new Map<number, number>();
  const puller = (drop: CargoDrop): Pilot | undefined => ships.find(ship => ship.id === drop.claim && ship.phase === 'flying');
  for (const drop of world.cargoDrops) {
    if (!drop.active || drop.claim < 0) continue;
    const ship = puller(drop);
    const load = (ship ? pulling.get(ship.id) ?? 0 : 0) + drop.amount;
    if (!ship || squared(drop.p, ship.p) > 4 * reach || ship.cargo + load > statsOf(ship).cargoCapacity + 1e-9) { drop.claim = -1; continue; }
    pulling.set(ship.id, load);
  }
  for (const drop of world.cargoDrops) {
    if (!drop.active || drop.claim >= 0) continue;
    let best: Pilot | undefined; let nearest = reach;
    for (const ship of ships) {
      if (ship.phase !== 'flying' || ship.cargo + (pulling.get(ship.id) ?? 0) + drop.amount > statsOf(ship).cargoCapacity + 1e-9) continue;
      const d = squared(drop.p, ship.p);
      if (d > nearest || (best && d === nearest && ship.id > best.id)) continue;
      best = ship; nearest = d;
    }
    if (!best) continue;
    drop.claim = best.id;
    pulling.set(best.id, (pulling.get(best.id) ?? 0) + drop.amount);
  }
  for (const drop of world.cargoDrops) {
    const ship = drop.active && drop.claim >= 0 ? puller(drop) : undefined;
    if (!ship) continue;
    const x = ship.p.x - drop.p.x; const y = ship.p.y - drop.p.y; const z = ship.p.z - drop.p.z;
    const d = Math.sqrt(x * x + y * y + z * z);
    const step = (ship.s + T.magnetPull) / T.tickRate;
    if (d > step + T.shipHitRadius) { drop.p.x += x / d * step; drop.p.y += y / d * step; drop.p.z += z / d * step; continue; }
    ship.cargo += drop.amount; ship.hold[drop.kind] = (ship.hold[drop.kind] ?? 0) + drop.amount; ship.shield = 0;
    drop.amount = 0; drop.active = false; drop.age = 0; drop.claim = -1;
  }
}

const squared = (a: Vec3, b: Vec3): number => {
  const x = a.x - b.x; const y = a.y - b.y; const z = a.z - b.z;
  return x * x + y * y + z * z;
};

function extraction(world: ArenaWorld, pilot: Pilot): void {
  const inExit = inExitZone(world, pilot);
  if (inExit) pilot.shield = 0;
  if (inExit && pilot.s === 0 && pilot.lastDamage < world.tick) {
    pilot.extraction++;
    if (pilot.extraction >= T.exitHold * T.tickRate) { pilot.phase = 'extracted'; pilot.landed = 0; pilot.mining = false; }
  } else pilot.extraction = 0;
}

function stepWorld(world: ArenaWorld, input: ArenaIntent, settings?: SteeringSettings,
  controlled?: ReadonlyMap<number, ArenaIntent>, pilotSettings?: ReadonlyMap<number, SteeringSettings>): void {
  copyFlight(world.previous, world.pilot);
  for (const ship of [world.pilot, ...world.drones]) ship.threat = 0;
  stepScans(world);
  stepPilot(world, world.pilot, input, settings, false);
  const oneShots = (): void => { input.smoke = false; input.cloak = false; input.turboBurst = false; input.signature = false; input.illusion = false; input.radar = false; };
  for (let i = 0; i < world.drones.length; i++) {
    const drone = world.drones[i]; const previous = world.dronePrevious[i];
    if (!drone || !previous) continue;
    copyFlight(previous, drone);
    if (drone.decoyOf >= 0) {
      // A copy joins after its pilot, so its pilot has flown this tick already.
      const owner = drone.decoyOf === world.pilot.id ? world.pilot : world.drones.find(ship => ship.id === drone.decoyOf);
      if (owner && alive(owner)) stepDecoy(world, drone, owner);
      continue;
    }
    const brain = world.brains.get(drone.id);
    if (!brain) { stepPilot(world, drone, controlled?.get(drone.id) ?? world.neutralInput, pilotSettings?.get(drone.id), false); continue; }
    if (!alive(drone)) {
      if (--drone.respawn <= 0) { respawnBot(world, drone, brain); copyFlight(previous, drone); }
      continue;
    }
    thinkBot(world, drone, brain, world.droneInput);
    // Bots never run dry: neither tank nor magazine is theirs to manage.
    drone.fuel = statsOf(drone).fuelTank; drone.ammo = statsOf(drone).ammoCapacity;
    stepPilot(world, drone, world.droneInput, undefined, false, true);
    if (drone.phase === 'extracted') drone.respawn = T.botRespawn * T.tickRate;
  }
  oneShots();
  stepProjectiles(world);
  stepMissiles(world);
  dissolveDecoys(world);
  ageEffects(world);
  for (const drop of world.cargoDrops) {
    if (!drop.field && drop.active) { drop.age += 1 / T.tickRate; if (drop.age >= T.dropLife) drop.active = false; }
  }
  stepField(world);
  mineAndRegrow(world);
  stepMagnet(world);
  for (let j = 0; j <= world.drones.length; j++) {
    const pilot = j === 0 ? world.pilot : world.drones[j - 1];
    if (pilot && alive(pilot) && pilot.decoyOf < 0) extraction(world, pilot);
  }
  world.tick++;
}

export function stepSandboxWorld(world: ArenaWorld, input: ArenaIntent, settings?: SteeringSettings): void {
  stepWorld(world, input, settings);
}

/** The same combat rules run once per server tick for every connected pilot. */
export function stepArenaWorld(world: ArenaWorld, inputs: ReadonlyMap<number, ArenaIntent>, settings?: ReadonlyMap<number, SteeringSettings>): void {
  stepWorld(world, world.neutralInput, undefined, inputs, settings);
  for (const input of inputs.values()) { input.smoke = false; input.cloak = false; input.turboBurst = false; input.signature = false; input.illusion = false; input.radar = false; }
}

/** Prediction changes motion/resources only; hits, mining and results remain authoritative. */
export function predictPilot(world: ArenaWorld, input: ArenaIntent, settings?: SteeringSettings): void {
  copyFlight(world.previous, world.pilot);
  stepPilot(world, world.pilot, input, settings, true);
  world.tick++;
}

/** Advances predicted tracers on the client; never touches authoritative state. */
export function stepPredictedTracers(world: ArenaWorld): void { stepGhosts(world); }

export function recoverPilot(world: ArenaWorld, pilot: Pilot): void {
  if (alive(pilot)) { scatter(world, pilot); pilot.phase = 'towed'; pilot.landed = 0; pilot.mining = false; }
}

export { copyFlight, createPilot, impact };
