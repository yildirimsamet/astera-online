import { describe, expect, it } from 'vitest';
import {
  ARENA_LAYOUT, ARENA_TUNING as T, createInput, createPilot, createSandboxWorld, stepSandboxWorld,
  type ArenaIntent, type ArenaLayout, type ArenaWorld, type ShipClass,
} from '../../src/arena/index.js';
import { layoutWith, sphere } from './helpers.js';

const intent = (patch: Partial<ArenaIntent> = {}): ArenaIntent => ({ ...createInput(), ...patch });
const crystalField: ArenaLayout = layoutWith([sphere(0, 0, 0, 80, 20, 'crystal'), sphere(1, 0, 0, -80, 20, 'rock')]);

function soloWorld(layout: ArenaLayout = ARENA_LAYOUT): ArenaWorld {
  const world = createSandboxWorld({ bots: 0, layout });
  world.pilot.p.x = 0; world.pilot.p.y = 0; world.pilot.p.z = 0;
  world.pilot.q.x = 0; world.pilot.q.y = 0; world.pilot.q.z = 0; world.pilot.q.w = 1;
  return world;
}

function landOn(world: ArenaWorld, land = false): void {
  const slow = intent({ throttle: 0.12, land });
  for (let i = 0; i < 900 && !world.pilot.landed; i++) stepSandboxWorld(world, slow);
  if (!world.pilot.landed) throw new Error('never landed');
}

describe('mining a crystal by landing on it', () => {
  it('fills the hold at mineRate, drains the crystal and drops the spawn shield', () => {
    const world = soloWorld(crystalField);
    expect(world.pilot.shield).toBeGreaterThan(0);
    expect(world.minerals).toEqual([T.crystalReserve]);
    landOn(world);
    const cargo = world.pilot.cargo;
    const reserve = world.minerals[0] ?? 0;
    const hold = intent({ throttle: 0 });
    for (let i = 0; i < 2 * T.tickRate; i++) stepSandboxWorld(world, hold);
    expect(world.pilot.cargo - cargo).toBeCloseTo(2 * T.mineRate, 6);
    expect(reserve - (world.minerals[0] ?? 0)).toBeCloseTo(2 * T.mineRate, 6);
    expect(world.pilot.shield).toBe(0);
    expect(world.pilot.mining).toBe(true);
  });

  it('stops when the hold is full or the crystal is dry, and the crystal grows back', () => {
    const world = soloWorld(crystalField);
    landOn(world);
    world.pilot.cargo = T.cargoCapacity - 1;
    const hold = intent({ throttle: 0 });
    for (let i = 0; i < T.tickRate; i++) stepSandboxWorld(world, hold);
    expect(world.pilot.cargo).toBe(T.cargoCapacity);
    expect(world.pilot.mining).toBe(false);
    world.pilot.cargo = 0;
    world.minerals[0] = 0.01;
    stepSandboxWorld(world, hold);
    expect(world.minerals[0]).toBe(0);
    expect(world.pilot.cargo).toBeCloseTo(0.01, 9);
    for (let i = 0; i < 5; i++) {
      stepSandboxWorld(world, hold);
      expect(world.pilot.mining).toBe(false);
      expect(world.pilot.cargo).toBeCloseTo(0.01, 9);
    }
    world.pilot.landed = 0;
    world.pilot.p.z = -400;
    const before = world.minerals[0];
    for (let i = 0; i < 4 * T.tickRate; i++) stepSandboxWorld(world, hold);
    expect(world.minerals[0]).toBeCloseTo(before + 4 * T.crystalRegen, 6);
  });

  it('turbo on the ground is a take-off: an ambushed miner lifts off and boosts away at once', () => {
    const world = soloWorld(crystalField);
    landOn(world);
    const boost = intent({ throttle: 0, turbo: true });
    stepSandboxWorld(world, boost);
    expect(world.pilot.landed).toBe(0);
    expect(world.pilot.turboActive).toBe(true);
    const charge = world.pilot.turboCharge;
    for (let i = 0; i < T.tickRate; i++) stepSandboxWorld(world, boost);
    expect(world.pilot.landed).toBe(0);
    expect(world.pilot.s).toBeGreaterThan(T.speedMax);
    expect(world.pilot.turboCharge).toBeLessThan(charge);
  });

  it('a turbo press without enough charge leaves a landed ship where it is', () => {
    const world = soloWorld(crystalField);
    landOn(world);
    world.pilot.turboCharge = T.turboMinStart / 2;
    stepSandboxWorld(world, intent({ throttle: 0, turbo: true }));
    expect(world.pilot.landed).toBeGreaterThan(0);
    expect(world.pilot.turboActive).toBe(false);
  });

  it('does not mine plain rock', () => {
    const world = soloWorld(crystalField);
    world.pilot.q.y = 1; world.pilot.q.w = 0;
    // Plain rock takes a ship down only on LAND (owner 2026-10-21).
    landOn(world, true);
    expect(world.pilot.landed).toBe(2);
    for (let i = 0; i < T.tickRate; i++) stepSandboxWorld(world, intent());
    expect(world.pilot.cargo).toBe(0);
    expect(world.pilot.mining).toBe(false);
  });
});

describe('extraction on a gate deck', () => {
  it('extracts after a full stop held for exitHold seconds without damage', () => {
    const world = soloWorld();
    const exit = ARENA_LAYOUT.exits[1];
    if (!exit) throw new Error('missing exit');
    world.pilot.p.x = exit.x; world.pilot.p.y = exit.y + 1; world.pilot.p.z = exit.z;
    world.pilot.cargo = 30;
    for (let i = 0; i < T.exitHold * T.tickRate - 1; i++) stepSandboxWorld(world, intent());
    expect(world.pilot.phase).toBe('flying');
    expect(world.pilot.shield).toBe(0);
    stepSandboxWorld(world, intent());
    expect(world.pilot.phase).toBe('extracted');
  });
});

describe('aim circle in combat (owner 2026-10-21: 8.5°, the guns follow inside it)', () => {
  function duel(x: number, cloak = false, ship: ShipClass = 'kilavuz'): number {
    const world = soloWorld(layoutWith());
    world.pilot.shield = 0;
    const target = createPilot(9, ship);
    target.p.x = x; target.p.z = 300;
    if (cloak) target.cloak = 10 * T.tickRate;
    world.drones.push(target);
    world.dronePrevious.push({ ...target, p: { ...target.p }, q: { ...target.q } });
    const fire = intent({ fire: true });
    for (let i = 0; i < T.tickRate; i++) {
      target.cloak = cloak ? 10 * T.tickRate : 0;
      stepSandboxWorld(world, fire);
    }
    for (let i = 0; i < T.tickRate; i++) stepSandboxWorld(world, intent());
    return world.pilot.hits;
  }

  it('lands near-miss shots on a visible target just off the nose', () => {
    // Half the one-second burst at 300 m, tail-on: shots meet the drawn hull plus hitPad (Y2),
    // no longer a 12 m ball, so the 1.5° spread loses a few.
    expect(duel(12)).toBeGreaterThanOrEqual(4);
  });

  it('does not bend shots outside the circle or towards a cloaked ship', () => {
    // 55 m at 300 m is 10.4° off the nose: beyond the 8.5° circle.
    expect(duel(55)).toBe(0);
    // The Akıncı: the Kılavuz's 8.9 m wings (Y4b) would reach the unbent shots on their own.
    expect(duel(12, true, 'akinci')).toBe(0);
  });
});

/** Owner 2026-10-27: "antreman modundaki bot sayısını 20 yap". The roles take turns past three. */
describe('the practice room', () => {
  it('flies twenty bots, every role among them, each its own ship', () => {
    expect(T.practiceBots).toBe(20);
    const world = createSandboxWorld({ bots: T.practiceBots });
    const bots = world.drones.filter(drone => drone.bot);
    expect(bots).toHaveLength(20);
    expect(world.brains.size).toBe(20);
    expect(new Set([...world.brains.values()].map(brain => brain.role))).toEqual(new Set(['hunter', 'miner', 'patrol']));
    expect(new Set(bots.map(bot => bot.id)).size).toBe(20);
    expect(world.nextId).toBe(21);
    for (let i = 0; i < 300; i++) stepSandboxWorld(world, intent());
    expect(world.drones.filter(drone => drone.bot)).toHaveLength(20);
  });

  it('still opens the default room with one bot per role', () => {
    expect(createSandboxWorld().brains.size).toBe(3);
  });
});
