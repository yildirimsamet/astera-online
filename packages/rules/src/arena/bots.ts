import { CLASS_STATS } from './classes.js';
import { assistSteer, leadPoint } from './aim.js';
import { nearestObstacle, segmentObstacles, surfaceGap, type Contact } from './collision.js';
import { sampleAssist } from './controls.js';
import { ARENA_TUNING as T } from './tuning.js';
import { alive, type ArenaIntent, type Pilot, type SmokePuff } from './pilot.js';
import { pilotInSight } from './visibility.js';
import { toLocal } from './vec.js';
import type { Rng } from '../types.js';
import type { ArenaLayout, Vec3 } from './types.js';

export type BotRole = 'hunter' | 'miner' | 'patrol';
export type BotMode = 'roam' | 'engage' | 'extend' | 'approach' | 'mine' | 'flee' | 'extract';
export interface BotBrain {
  role: BotRole; mode: BotMode; target: number; goal: number; timer: number; wander: Vec3; burst: number;
  /** Ticks spent close to the target without a firing line; a long tangle ends in an extension. */
  close: number;
}
export interface BotWorld {
  layout: ArenaLayout; tick: number; pilot: Pilot; drones: Pilot[]; smoke: SmokePuff[];
  minerals: number[]; dry: boolean[]; brains: Map<number, BotBrain>; random: Rng;
}

export const createBrain = (role: BotRole): BotBrain =>
  ({ role, mode: role === 'miner' ? 'approach' : 'roam', target: -1, goal: -1, timer: 0, wander: { x: 0, y: 0, z: 0 }, burst: 0, close: 0 });

const local = { x: 0, y: 0, z: 0 };
const avoid: Contact = { index: -1, nx: 0, ny: 0, nz: 0, depth: 0 };
const probe = { x: 0, y: 0, z: 0 };
const leadOut = { x: 0, y: 0, z: 0 };
const velocity = { x: 0, y: 0, z: 0 };
const magnet = { x: 0, y: 0 };
const clamp = (v: number): number => Math.max(-1, Math.min(1, v));

/** Stick command that turns the nose towards a world point. */
function steerTo(out: ArenaIntent, bot: Pilot, x: number, y: number, z: number, gain = 3): void {
  toLocal(local, bot.q, x - bot.p.x, y - bot.p.y, z - bot.p.z);
  if (local.z <= 1) {
    out.steerX = local.x < 0 ? 1 : -1;
    out.steerY = local.y > 0 ? -0.6 : 0.6;
    return;
  }
  out.steerX = clamp(-local.x / local.z * gain);
  out.steerY = clamp(-local.y / local.z * gain);
}

/** The band by the rim and the ceiling that `avoidance` turns every bot back out of. */
const nearEdge = (layout: ArenaLayout, p: { x: number; y: number; z: number }): boolean =>
  Math.sqrt(p.x * p.x + p.z * p.z) > layout.radius - 350 || Math.abs(p.y) > layout.halfHeight - 160;

/** Looks ahead along the heading and steers away from rock, the rim and the ceiling. */
function avoidance(world: BotWorld, bot: Pilot, out: ArenaIntent, ignore: number): void {
  const q = bot.q;
  const fx = 2 * (q.x * q.z + q.w * q.y); const fy = 2 * (q.y * q.z - q.w * q.x); const fz = 1 - 2 * (q.x * q.x + q.y * q.y);
  for (const ahead of [bot.s * 0.6 + 20, bot.s * 1.4 + 45]) {
    probe.x = bot.p.x + fx * ahead; probe.y = bot.p.y + fy * ahead; probe.z = bot.p.z + fz * ahead;
    const index = nearestObstacle(world.layout, probe, T.shipHitRadius + 22, avoid);
    if (index < 0 || index === ignore) continue;
    toLocal(local, bot.q, avoid.nx, avoid.ny, avoid.nz);
    // Push the nose along the escape normal; if it points straight back, break sideways.
    out.steerX = clamp(-local.x * 3 + (Math.abs(local.x) + Math.abs(local.y) < 0.2 ? 1 : 0));
    out.steerY = clamp(-local.y * 3);
    out.throttle = Math.min(out.throttle, 0.45);
    out.fire = false;
    return;
  }
  if (nearEdge(world.layout, bot.p)) {
    steerTo(out, bot, bot.p.x * 0.2, 0, bot.p.z * 0.2, 2);
  }
}

function pickWander(world: BotWorld, brain: BotBrain): void {
  const fields = world.layout.fields;
  const field = fields[Math.floor(world.random() * fields.length)];
  const jitter = (): number => (world.random() * 2 - 1) * 420;
  brain.wander.x = (field?.p.x ?? 0) * 0.85 + jitter();
  brain.wander.y = (world.random() * 2 - 1) * 160;
  brain.wander.z = (field?.p.z ?? 0) * 0.85 + jitter();
  brain.timer = T.tickRate * (14 + world.random() * 10);
}

function nearestVisible(world: BotWorld, bot: Pilot, range: number): Pilot | undefined {
  let best: Pilot | undefined; let bestDistance = range * range;
  for (let j = 0; j <= world.drones.length; j++) {
    const other = j === 0 ? world.pilot : world.drones[j - 1];
    if (!other || other === bot || !alive(other)) continue;
    const dx = other.p.x - bot.p.x; const dy = other.p.y - bot.p.y; const dz = other.p.z - bot.p.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestDistance && pilotInSight(world, bot, other)) { bestDistance = d; best = other; }
  }
  return best;
}

function engage(world: BotWorld, bot: Pilot, brain: BotBrain, target: Pilot, out: ArenaIntent, eager: boolean): void {
  const q = target.q;
  velocity.x = 2 * (q.x * q.z + q.w * q.y) * target.s; velocity.y = 2 * (q.y * q.z - q.w * q.x) * target.s;
  velocity.z = (1 - 2 * (q.x * q.x + q.y * q.y)) * target.s;
  const dx = target.p.x - bot.p.x; const dy = target.p.y - bot.p.y; const dz = target.p.z - bot.p.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // A slow, readable aiming wobble keeps the bot beatable.
  const wobble = ((world.tick + bot.id * 37) % 90) / 45 - 1;
  const ex = wobble * T.botAimWobble; const ey = -wobble * T.botAimWobble * 0.55;
  if (leadPoint(leadOut, bot, target.p, velocity)) steerTo(out, bot, bot.p.x + leadOut.x + ex, bot.p.y + leadOut.y + ey, bot.p.z + leadOut.z, T.botTurnGain);
  else steerTo(out, bot, target.p.x, target.p.y, target.p.z, T.botTurnGain);
  out.throttle = distance > 700 ? 1 : distance > 220 ? 0.8 : 0.5;
  out.turbo = eager && distance > 750 && bot.turboCharge > 1.5;
  toLocal(local, bot.q, leadOut.x, leadOut.y, leadOut.z);
  // On target while the lead sits inside the hull's apparent size, never tighter than 2.9°.
  const cone = Math.max(0.05, T.shipHitRadius * T.botHullAim / Math.max(1, distance));
  const onTarget = local.z > 0 && local.x * local.x + local.y * local.y < local.z * local.z * cone * cone;
  brain.burst = (brain.burst + 1) % Math.round(T.tickRate * T.botBurstCycle);
  const inBurst = brain.burst < T.tickRate * T.botBurstOn;
  const clear = segmentObstacles(world.layout, bot.p.x, bot.p.y, bot.p.z, target.p.x, target.p.y, target.p.z, 0) > 1;
  out.fire = onTarget && inBurst && clear && distance < T.botFireRange;
  // Two ships circling each other never line up: after a while in a tight tangle, open
  // the range straight ahead and come back for another pass.
  brain.close = distance < T.botTangleRange && !onTarget ? brain.close + 1 : 0;
  if (brain.close > T.botTangle * T.tickRate) { brain.mode = 'extend'; brain.timer = T.botExtend * T.tickRate; brain.close = 0; }
  assistSteer(magnet, bot, target.p, velocity, out.steerX, out.steerY, out.fire);
  sampleAssist(out, magnet.x, magnet.y);
  // Badly hurt and chased: smoke, turbo away and break the line of fire.
  if (bot.hull < CLASS_STATS[bot.ship].hull * T.botFleeHull && world.tick - bot.lastDamage < T.tickRate * 2) {
    brain.mode = 'flee'; brain.timer = T.tickRate * 6;
  }
}

/**
 * True inside a structure's bounds (the cave, a kit building): bots mine in the open. Steering
 * by avoidance alone, a miner would hang on the walls; and the inside is the pilots' quiet farm.
 */
function indoors(layout: ArenaLayout, p: Vec3): boolean {
  return layout.structures.some(s => {
    const dx = p.x - s.p.x; const dy = p.y - s.p.y; const dz = p.z - s.p.z;
    return dx * dx + dy * dy + dz * dz < s.scale * s.scale;
  });
}

function nearestCrystal(world: BotWorld, bot: Pilot): number {
  let best = -1; let bestDistance = Infinity;
  world.layout.deposits.forEach((index, slot) => {
    const crystal = world.layout.obstacles[index];
    // A vein in the edge band is out of reach: the edge guard would turn the miner back forever.
    if (!crystal || world.dry[slot] || (world.minerals[slot] ?? 0) < 8 || nearEdge(world.layout, crystal.p) || indoors(world.layout, crystal.p)) return;
    const dx = crystal.p.x - bot.p.x; const dy = crystal.p.y - bot.p.y; const dz = crystal.p.z - bot.p.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestDistance) { bestDistance = d; best = index; }
  });
  return best;
}

function nearestExit(world: BotWorld, bot: Pilot): number {
  let best = 0; let bestDistance = Infinity;
  world.layout.exits.forEach((exit, index) => {
    const dx = exit.x - bot.p.x; const dy = exit.y - bot.p.y; const dz = exit.z - bot.p.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestDistance) { bestDistance = d; best = index; }
  });
  return best;
}

function mine(world: BotWorld, bot: Pilot, brain: BotBrain, out: ArenaIntent): void {
  const attacked = world.tick - bot.lastDamage < T.tickRate * 2;
  if (attacked && brain.mode !== 'flee') { brain.mode = 'flee'; brain.timer = T.tickRate * 7; }
  if (brain.mode === 'flee') {
    out.throttle = 1; out.turbo = bot.turboCharge > 0.4; out.smoke = true;
    const q = bot.q;
    // Jink: alternate hard turns so a chaser cannot just hold the trigger.
    out.steerX = ((world.tick / 20) | 0) % 2 === 0 ? 0.8 : -0.8;
    out.steerY = 2 * (q.y * q.z - q.w * q.x) > 0.3 ? 0.5 : -0.2;
    if (--brain.timer <= 0) brain.mode = bot.cargo >= 40 ? 'extract' : 'approach';
    return;
  }
  if (bot.landed) {
    const onCrystal = world.layout.obstacles[bot.landed - 1]?.kind === 'crystal';
    if (onCrystal && bot.mining && bot.cargo < 70) { out.throttle = 0; brain.mode = 'mine'; return; }
    brain.mode = bot.cargo >= 40 ? 'extract' : 'approach'; brain.goal = -1;
    out.throttle = 0.7; return;
  }
  if (brain.mode === 'extract') {
    const exit = world.layout.exits[nearestExit(world, bot)];
    if (!exit) return;
    const dx = exit.x - bot.p.x; const dy = exit.y - bot.p.y; const dz = exit.z - bot.p.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    steerTo(out, bot, exit.x, exit.y, exit.z, 2.5);
    out.throttle = distance < T.exitRadius * 0.5 ? 0 : distance < 320 ? 0.2 : 0.85;
    if (distance >= 320) avoidance(world, bot, out, -1);
    return;
  }
  if (brain.goal < 0 || world.dry[world.layout.deposits.indexOf(brain.goal)]) brain.goal = nearestCrystal(world, bot);
  const crystal = world.layout.obstacles[brain.goal];
  if (!crystal) { out.throttle = 0.5; return; }
  // The real face, not the bounding ball (Y2): beyond 400 m the exact distance does not matter.
  const surface = surfaceGap(world.layout, brain.goal, bot.p, 400);
  steerTo(out, bot, crystal.p.x, crystal.p.y, crystal.p.z, 2.5);
  out.throttle = surface < 140 ? 0.12 : surface < 400 ? 0.4 : 0.9;
  brain.mode = 'approach';
  avoidance(world, bot, out, brain.goal);
}

/** One decision tick for a bot. Bots chase the nearest pilot they can see, bot or not. */
export function thinkBot(world: BotWorld, bot: Pilot, brain: BotBrain, out: ArenaIntent): void {
  out.steerX = 0; out.steerY = 0; out.throttle = 0.6; out.turbo = false; out.assistX = 0; out.assistY = 0;
  out.fire = false; out.smoke = false; out.cloak = false; out.turboBurst = false;
  if (brain.role === 'miner') { mine(world, bot, brain, out); return; }
  if (brain.mode === 'flee') {
    out.throttle = 1; out.turbo = bot.turboCharge > 0.4; out.smoke = true;
    out.steerX = ((world.tick / 24) | 0) % 2 === 0 ? 0.7 : -0.7;
    avoidance(world, bot, out, -1);
    if (--brain.timer <= 0) brain.mode = 'roam';
    return;
  }
  if (brain.mode === 'extend') {
    out.throttle = 1;
    avoidance(world, bot, out, -1);
    if (--brain.timer <= 0) brain.mode = 'roam';
    return;
  }
  const range = brain.role === 'hunter' ? T.botSightHunter : T.botSightPatrol;
  const target = nearestVisible(world, bot, brain.mode === 'engage' ? range * T.botChaseHold : range);
  if (target) {
    brain.mode = 'engage'; brain.target = target.id;
    engage(world, bot, brain, target, out, brain.role === 'hunter');
    avoidance(world, bot, out, -1);
    return;
  }
  brain.mode = 'roam'; brain.target = -1;
  if (--brain.timer <= 0) pickWander(world, brain);
  const w = brain.wander;
  steerTo(out, bot, w.x, w.y, w.z, 2);
  out.throttle = brain.role === 'hunter' ? 0.75 : 0.55;
  avoidance(world, bot, out, -1);
}
