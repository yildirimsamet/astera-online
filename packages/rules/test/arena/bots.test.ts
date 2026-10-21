import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, createInput, createSandboxWorld, stepSandboxWorld, type ArenaWorld, type BotRole, type Pilot,
} from '../../src/arena/index.js';
import { thinkBot } from '../../src/arena/bots.js';

const rest = createInput();
const alive = (p: Pilot): boolean => p.phase === 'flying' || p.phase === 'fuelOut';
function run(world: ArenaWorld, seconds: number, each?: () => void): void {
  for (let i = 0; i < seconds * T.tickRate; i++) {
    stepSandboxWorld(world, rest);
    each?.();
  }
}

describe('sandbox bots', () => {
  it('fly a minute in the real layout without NaN, leaving the disc or sitting dead in space', () => {
    const world = createSandboxWorld();
    world.pilot.cloak = 99999;
    expect(world.drones.length).toBe(3);
    const moved = new Map<number, number>();
    run(world, 60, () => {
      for (const bot of world.drones) {
        expect(Number.isFinite(bot.p.x + bot.p.y + bot.p.z + bot.q.w)).toBe(true);
        expect(Math.sqrt(bot.p.x * bot.p.x + bot.p.z * bot.p.z)).toBeLessThanOrEqual(T.arenaRadius);
        if (alive(bot)) moved.set(bot.id, (moved.get(bot.id) ?? 0) + bot.s / T.tickRate);
      }
    });
    for (const bot of world.drones) expect(moved.get(bot.id) ?? 0).toBeGreaterThan(300);
  });

  it('include a miner that lands on a crystal and fills its hold', () => {
    const world = createSandboxWorld();
    world.pilot.cloak = 99999;
    const miner = world.drones.find(bot => world.brains.get(bot.id)?.role === 'miner');
    if (!miner) throw new Error('no miner bot');
    let mined = false;
    const start = miner.cargo;
    run(world, 120, () => { if (miner.mining && miner.cargo > start) mined = true; });
    expect(mined).toBe(true);
  });

  it('include a hunter that attacks a visible pilot and leaves a cloaked one alone', () => {
    const visible = createSandboxWorld();
    visible.pilot.shield = 0;
    const hunter = visible.drones.find(bot => visible.brains.get(bot.id)?.role === 'hunter');
    if (!hunter) throw new Error('no hunter bot');
    hunter.p.x = visible.pilot.p.x; hunter.p.y = visible.pilot.p.y; hunter.p.z = visible.pilot.p.z - 500;
    run(visible, 25);
    expect(visible.pilot.hull).toBeLessThan(T.hull);

    const hidden = createSandboxWorld();
    hidden.pilot.shield = 0;
    const stalker = hidden.drones.find(bot => hidden.brains.get(bot.id)?.role === 'hunter');
    if (!stalker) throw new Error('no hunter bot');
    stalker.p.x = hidden.pilot.p.x; stalker.p.y = hidden.pilot.p.y; stalker.p.z = hidden.pilot.p.z - 500;
    run(hidden, 25, () => { hidden.pilot.cloak = 99999; });
    expect(hidden.pilot.hull).toBe(T.hull);
  });
});

/**
 * Owner 2026-10-21: bots join the shared room, fight each other as well as the pilots,
 * respawn like a pilot does, and are a little less sharp, accurate and stubborn than
 * they were — a little, not simple.
 */
const only = (world: ArenaWorld, role: BotRole): Pilot => {
  const bot = world.drones.find(b => world.brains.get(b.id)?.role === role);
  if (!bot) throw new Error(`no ${role} bot`);
  const index = world.drones.indexOf(bot);
  world.dronePrevious = world.dronePrevious.slice(index, index + 1);
  world.drones = [bot];
  for (const id of [...world.brains.keys()]) if (id !== bot.id) world.brains.delete(id);
  return bot;
};
const place = (p: Pilot, z: number): void => { Object.assign(p.p, { x: 0, y: 0, z }); p.q = { x: 0, y: 0, z: 0, w: 1 }; p.shield = 0; };

/** A hunter 400 m behind a pilot who flies on; seconds to the kill (or 30) and hull lost. */
function duel(weave: boolean): { killedAt: number; lost: number } {
  const world = createSandboxWorld();
  const hunter = only(world, 'hunter');
  place(world.pilot, 0); place(hunter, -400);
  const input = createInput(); input.throttle = 0.6;
  for (let i = 0; i < 30 * T.tickRate; i++) {
    input.steerX = weave ? Math.sin(i / 25) * 0.7 : 0; input.steerY = weave ? Math.cos(i / 40) * 0.3 : 0;
    world.pilot.fuel = T.fuelTank;
    stepSandboxWorld(world, input);
    if (!alive(world.pilot)) return { killedAt: i / T.tickRate, lost: T.hull };
  }
  return { killedAt: 30, lost: T.hull - world.pilot.hull };
}

describe('room bots', () => {
  it('fight each other: a hunter with no pilot in sight attacks another bot', () => {
    const world = createSandboxWorld();
    world.pilot.cloak = 99999;
    const hunter = world.drones.find(b => world.brains.get(b.id)?.role === 'hunter');
    const patrol = world.drones.find(b => world.brains.get(b.id)?.role === 'patrol');
    if (!hunter || !patrol) throw new Error('no bots');
    // Open space on the rim, away from the hub's structures.
    place(hunter, -400); place(patrol, 0); hunter.p.x = 2700; patrol.p.x = 2703;
    const out = createInput();
    const brain = world.brains.get(hunter.id);
    if (!brain) throw new Error('no brain');
    thinkBot(world, hunter, brain, out);
    expect(brain.mode).toBe('engage');
    expect(brain.target).toBe(patrol.id);
    run(world, 40, () => { world.pilot.cloak = 99999; });
    expect(patrol.hull < T.hull || hunter.hull < T.hull || patrol.phase === 'dead').toBe(true);
  });

  it('fly again after the respawn delay once killed, like a pilot', () => {
    const world = createSandboxWorld();
    world.pilot.cloak = 99999;
    const patrol = world.drones.find(b => world.brains.get(b.id)?.role === 'patrol');
    if (!patrol) throw new Error('no patrol');
    Object.assign(patrol, { phase: 'dead', hull: 0, respawn: T.botRespawn * T.tickRate });
    run(world, T.botRespawn - 1);
    expect(patrol.phase).toBe('dead');
    run(world, 1.5);
    expect(patrol).toMatchObject({ phase: 'flying', hull: T.hull });
  });

  it('let a fleeing target go well before two kilometres', () => {
    const world = createSandboxWorld();
    const hunter = only(world, 'hunter');
    place(world.pilot, 1500); place(hunter, 0);
    const brain = world.brains.get(hunter.id);
    if (!brain) throw new Error('no brain');
    brain.mode = 'engage'; brain.target = world.pilot.id;
    thinkBot(world, hunter, brain, createInput());
    expect(brain.mode).toBe('roam');
  });

  it('break off sooner when badly hurt and still under fire', () => {
    const world = createSandboxWorld();
    const hunter = only(world, 'hunter');
    place(world.pilot, 300); place(hunter, 0);
    hunter.hull = T.hull * 0.42; hunter.lastDamage = world.tick;
    const brain = world.brains.get(hunter.id);
    if (!brain) throw new Error('no brain');
    thinkBot(world, hunter, brain, createInput());
    expect(brain.mode).toBe('flee');
  });

  it('shoot a little worse than before, but still kill a pilot who flies straight', () => {
    // Before the owner's request: dead in 21 s flying straight, 130 hull lost weaving for 30 s.
    const straight = duel(false);
    expect(straight.killedAt).toBeGreaterThan(24);
    expect(straight.killedAt).toBeLessThan(30);
    const weaving = duel(true);
    expect(weaving.lost).toBeGreaterThanOrEqual(50);
    expect(weaving.lost).toBeLessThanOrEqual(110);
  });
});

