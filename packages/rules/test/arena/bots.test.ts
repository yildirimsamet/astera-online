import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, CLASS_STATS, createInput, createSandboxWorld, stepSandboxWorld, type ArenaWorld, type BotRole, type Pilot,
} from '../../src/arena/index.js';
import { thinkBot } from '../../src/arena/bots.js';
import { layoutWith, sphere } from './helpers.js';

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

  it('leave a deposit by the rim alone: the rim guard would turn the miner back from it forever', () => {
    // Measured 2026-10-22: a rock vein at 5010 m on the 5200 m disc kept a miner circling for 120 s.
    const rim = sphere(0, 4980, 0, 0, 20, 'crystal');
    const inner = sphere(1, 3800, 0, 0, 20, 'crystal');
    const world = createSandboxWorld({ layout: layoutWith([rim, inner], 5200, 1300) });
    const miner = only(world, 'miner');
    place(miner, 0); miner.p.x = 4600;
    const brain = world.brains.get(miner.id);
    if (!brain) throw new Error('no brain');
    thinkBot(world, miner, brain, createInput());
    expect(brain.goal).toBe(inner.id);
  });

  it('mine in the open and leave the veins inside buildings to the pilots (V6d)', () => {
    // Steering by avoidance alone, a miner would hang on a building's wall trying to reach a vein in it.
    const indoors = sphere(0, 4100, 0, 0, 15, 'crystal');
    const open = sphere(1, 3000, 0, 0, 20, 'crystal');
    const outpost = { id: 0, kind: 'outpost' as const, p: { x: 4000, y: 0, z: 0 }, ux: 1, uz: 0, scale: 380, colliders: [], decks: [] };
    const world = createSandboxWorld({ layout: { ...layoutWith([indoors, open], 5200, 1300), structures: [outpost] } });
    const miner = only(world, 'miner');
    place(miner, 0); miner.p.x = 4600;
    const brain = world.brains.get(miner.id);
    if (!brain) throw new Error('no brain');
    thinkBot(world, miner, brain, createInput());
    expect(brain.goal).toBe(open.id);
  });

  it('include a hunter that attacks a visible pilot and leaves a cloaked one alone', () => {
    // The hunter alone: a miner born at the same mouth is a nearer, equally fair target.
    const visible = createSandboxWorld();
    visible.pilot.shield = 0;
    const hunter = only(visible, 'hunter');
    hunter.p.x = visible.pilot.p.x; hunter.p.y = visible.pilot.p.y; hunter.p.z = visible.pilot.p.z - 500;
    run(visible, 25);
    expect(visible.pilot.hull).toBeLessThan(T.hull);

    const hidden = createSandboxWorld();
    hidden.pilot.shield = 0;
    const stalker = only(hidden, 'hunter');
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
  // Open space: the real layout's hub sits on the start point and turned this into a test of bouncing.
  const world = createSandboxWorld({ layout: layoutWith([], 8000, 8000) });
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
    // Open space on the rim: the hub's structures at the origin now cut the bot's sight.
    place(world.pilot, 300); place(hunter, 0); world.pilot.p.x = 2700; hunter.p.x = 2700;
    hunter.hull = CLASS_STATS[hunter.ship].hull * 0.42; hunter.lastDamage = world.tick;
    const brain = world.brains.get(hunter.id);
    if (!brain) throw new Error('no brain');
    thinkBot(world, hunter, brain, createInput());
    expect(brain.mode).toBe('flee');
  });

  it('shoot a little worse than before, but still kill a pilot who flies straight', () => {
    // Measured in open space (2026-10-21): with the old 6 m ball, dead in 13.1 s flying straight
    // and 270 hull lost weaving for 30 s; with the Y2 hull 16.7 s and 260. Weaving still saves you.
    // At 80 m/s (KG-X25) a weave moves the hull less: tracking at 2.7 killed the weaver in 22.6 s;
    // at 1.8, 16.9 s straight and 28.1 s weaving. The owner kept 80/160 knowing weaving buys less.
    // Y4: the hunter flies the Akıncı (117 hull a second, 80 before) at a 72 m/s Kılavuz: 12.3 s
    // straight, 18.8 s weaving — the same tracking, the times shorter by the damage.
    const straight = duel(false);
    const weaving = duel(true);
    expect(straight.killedAt).toBeGreaterThan(9);
    expect(straight.killedAt).toBeLessThan(16);
    expect(weaving.killedAt).toBeGreaterThan(straight.killedAt * 1.4);
  });
});

