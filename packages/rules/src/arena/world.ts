import { mulberry32 } from '../rng.js';
import type { Rng } from '../types.js';
import { createBrain, thinkBot, type BotBrain, type BotRole } from './bots.js';
import { scatter, shoot, stepGhosts, stepProjectiles, impact } from './combat.js';
import { createInput } from './controls.js';
import { FIELD_GROUP_SIZE, pickFieldSpawn } from './farms.js';
import { createFlightState, stepFlight } from './flight.js';
import { ARENA_LAYOUT, spawnFlight } from './layout.js';
import { alive, copyFlight, createPilot, type ArenaIntent, type CargoDrop, type Impact, type Pilot,
  type Projectile, type SmokePuff } from './pilot.js';
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
  cargoDrops: CargoDrop[]; impacts: Impact[]; bulletCursor: number; ghostCursor: number; smokeCursor: number;
  impactCursor: number; damageSide: number; shots: number;
  /** Per field group: the farm spot it grew on (-1 while taken) and seconds since it was emptied. */
  fieldSpots: number[]; fieldTimers: number[];
}

export interface WorldOptions { bots?: number; layout?: ArenaLayout; seed?: number }

const point = (): Vec3 => ({ x: 0, y: 0, z: 0 });
const projectile = (): Projectile => ({ p: point(), previous: point(), v: point(), life: 0, owner: -1 });
const ROLES: readonly BotRole[] = ['hunter', 'miner', 'patrol'];

function place(world: ArenaWorld, pilot: Pilot): void {
  if (world.layout.entries.length > 0) spawnFlight(pilot, world.random, world.layout);
}

/** Local or shared world. Holds no persistent rewards, repairs or galaxy economy. */
export function createSandboxWorld(options: WorldOptions = {}): ArenaWorld {
  const layout = options.layout ?? ARENA_LAYOUT;
  const pilot = createPilot(0);
  const world: ArenaWorld = {
    layout, pilot, previous: createFlightState(), drones: [], dronePrevious: [], brains: new Map(),
    random: mulberry32(options.seed ?? 4100),
    minerals: layout.deposits.map(() => T.crystalReserve), dry: layout.deposits.map(() => false),
    tick: 0, droneInput: createInput(), neutralInput: createInput(),
    projectiles: Array.from({ length: 512 }, projectile), ghosts: Array.from({ length: 64 }, projectile),
    smoke: Array.from({ length: 96 }, () => ({ p: point(), age: 0, active: false, owner: -1 })),
    impacts: Array.from({ length: 48 }, () => ({ p: point(), age: 0, kind: 'rock', active: false })),
    cargoDrops: Array.from({ length: T.fieldGroups * FIELD_GROUP_SIZE + T.wreckDrops },
      (_, i) => ({ p: point(), amount: 0, active: false, age: 0, field: i < T.fieldGroups * FIELD_GROUP_SIZE, kind: 0 })),
    fieldSpots: Array.from({ length: T.fieldGroups }, () => -1), fieldTimers: Array.from({ length: T.fieldGroups }, () => 0),
    bulletCursor: 0, ghostCursor: 0, smokeCursor: 0, impactCursor: 0, damageSide: 0, shots: 0,
  };
  place(world, pilot);
  copyFlight(world.previous, pilot);
  for (let g = 0; g < T.fieldGroups; g++) growField(world, g);
  const count = Math.max(0, Math.min(ROLES.length, options.bots ?? ROLES.length));
  for (let i = 0; i < count; i++) {
    const bot = createPilot(i + 1);
    place(world, bot);
    const role = ROLES[i] ?? 'patrol';
    if (role === 'miner') { bot.cargo = 20; bot.hold[1] = 20; }
    world.brains.set(bot.id, createBrain(role));
    world.drones.push(bot);
    const prior = createFlightState(); copyFlight(prior, bot); world.dronePrevious.push(prior);
  }
  return world;
}

function respawnBot(world: ArenaWorld, bot: Pilot, brain: BotBrain): void {
  const id = bot.id;
  Object.assign(bot, createPilot(id));
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
    if (pilot.phase !== 'flying' || !pilot.landed) continue;
    const slot = world.layout.deposits.indexOf(pilot.landed - 1);
    const kind = world.layout.depositKinds[slot] ?? 0;
    if (slot < 0 || world.dry[slot] || pilot.cargo >= T.cargoCapacity) continue;
    const reserve = world.minerals[slot] ?? 0;
    const amount = Math.min(T.mineRate / T.tickRate, reserve, T.cargoCapacity - pilot.cargo);
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
      drop.active = k < spawn.pieces; drop.kind = spawn.kind; drop.amount = drop.active ? spawn.amount : 0; drop.age = 0;
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

function stepPilot(world: ArenaWorld, pilot: Pilot, input: ArenaIntent, settings: SteeringSettings | undefined, predictOnly: boolean): void {
  if (!alive(pilot)) return;
  const dt = 1 / T.tickRate;
  pilot.shield = Math.max(0, pilot.shield - 1); pilot.cloak = Math.max(0, pilot.cloak - 1);
  pilot.cloakCooldown = Math.max(0, pilot.cloakCooldown - 1); pilot.smokeCooldown = Math.max(0, pilot.smokeCooldown - 1);
  const powered = pilot.fuel > 0 && pilot.phase === 'flying';
  if (powered && input.smoke && pilot.smokeCooldown === 0) { pilot.smokeEmit = T.smokeEmitDuration * T.tickRate; pilot.smokeCooldown = T.smokeCooldown * T.tickRate; }
  if (powered && input.cloak && pilot.cloakCooldown === 0) { pilot.cloak = T.cloakDuration * T.tickRate; pilot.cloakCooldown = T.cloakCooldown * T.tickRate; }
  if (powered && input.turboBurst) pilot.turboBurst = T.turboTapBurst * T.tickRate;
  // On the ground turbo is a take-off (stepFlight lifts off): the escape from a mining ambush.
  const turbo = powered && (input.turbo || pilot.turboBurst > 0) && pilot.turboCharge > 0
    && (pilot.turboActive || pilot.turboCharge >= T.turboMinStart);
  pilot.turboActive = turbo;
  if (turbo) { pilot.turboCharge = Math.max(0, pilot.turboCharge - dt); pilot.turboDelay = T.turboRegenDelay * T.tickRate; }
  else if (pilot.turboDelay > 0) pilot.turboDelay--;
  else pilot.turboCharge = Math.min(T.turboCharge, pilot.turboCharge + T.turboRegen * dt * (pilot.landed ? T.landedTurboRegenMul : 1));
  pilot.turboBurst = Math.max(0, pilot.turboBurst - 1);
  const held = input.turbo; input.turbo = turbo;
  if (pilot.phase === 'fuelOut') {
    // Out of fuel: no pilot input at all; the hull coasts to a stop.
    const throttle = input.throttle; const steerX = input.steerX; const steerY = input.steerY;
    input.throttle = 0; input.steerX = 0; input.steerY = 0;
    stepFlight(pilot, input, world.layout, settings);
    input.throttle = throttle; input.steerX = steerX; input.steerY = steerY;
  } else stepFlight(pilot, input, world.layout, settings);
  input.turbo = held;
  if (powered && input.fire) shoot(world, pilot, predictOnly);
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

function pickupAndExit(world: ArenaWorld, pilot: Pilot): void {
  for (const drop of world.cargoDrops) {
    if (!drop.active || pilot.phase !== 'flying' || pilot.cargo >= T.cargoCapacity) continue;
    const x = drop.p.x - pilot.p.x; const y = drop.p.y - pilot.p.y; const z = drop.p.z - pilot.p.z;
    if (x * x + y * y + z * z > T.pickupRadius * T.pickupRadius) continue;
    const collected = Math.min(drop.amount, T.cargoCapacity - pilot.cargo);
    pilot.cargo += collected; pilot.hold[drop.kind] = (pilot.hold[drop.kind] ?? 0) + collected; drop.amount -= collected; pilot.shield = 0;
    if (drop.amount <= 1e-9) { drop.amount = 0; drop.active = false; drop.age = 0; }
  }
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
  stepPilot(world, world.pilot, input, settings, false);
  input.smoke = false; input.cloak = false; input.turboBurst = false;
  for (let i = 0; i < world.drones.length; i++) {
    const drone = world.drones[i]; const previous = world.dronePrevious[i];
    if (!drone || !previous) continue;
    copyFlight(previous, drone);
    const brain = world.brains.get(drone.id);
    if (!brain) { stepPilot(world, drone, controlled?.get(drone.id) ?? world.neutralInput, pilotSettings?.get(drone.id), false); continue; }
    if (!alive(drone)) {
      if (--drone.respawn <= 0) { respawnBot(world, drone, brain); copyFlight(previous, drone); }
      continue;
    }
    thinkBot(world, drone, brain, world.droneInput);
    drone.fuel = T.fuelTank;
    stepPilot(world, drone, world.droneInput, undefined, false);
    if (drone.phase === 'extracted') drone.respawn = T.botRespawn * T.tickRate;
  }
  stepProjectiles(world);
  for (const puff of world.smoke) { if (puff.active) { puff.age += 1 / T.tickRate; if (puff.age >= T.smokeLife) puff.active = false; } }
  for (const hit of world.impacts) {
    if (hit.active) { hit.age += 1 / T.tickRate; if (hit.age >= (hit.kind === 'explosion' ? 1.35 : 0.35)) hit.active = false; }
  }
  for (const drop of world.cargoDrops) {
    if (!drop.field && drop.active) { drop.age += 1 / T.tickRate; if (drop.age >= T.dropLife) drop.active = false; }
  }
  stepField(world);
  mineAndRegrow(world);
  for (let j = 0; j <= world.drones.length; j++) {
    const pilot = j === 0 ? world.pilot : world.drones[j - 1];
    if (pilot && alive(pilot)) pickupAndExit(world, pilot);
  }
  world.tick++;
}

export function stepSandboxWorld(world: ArenaWorld, input: ArenaIntent, settings?: SteeringSettings): void {
  stepWorld(world, input, settings);
}

/** The same combat rules run once per server tick for every connected pilot. */
export function stepArenaWorld(world: ArenaWorld, inputs: ReadonlyMap<number, ArenaIntent>, settings?: ReadonlyMap<number, SteeringSettings>): void {
  stepWorld(world, world.neutralInput, undefined, inputs, settings);
  for (const input of inputs.values()) { input.smoke = false; input.cloak = false; input.turboBurst = false; }
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
