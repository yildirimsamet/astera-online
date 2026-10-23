import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, copyFlight, createInput, createPilot, createSandboxWorld, scatter, stepSandboxWorld,
  type ArenaWorld, type CargoDrop, type Pilot, type Vec3,
} from '../../src/arena/index.js';
import { layoutWith } from './helpers.js';

/**
 * Owner 2026-10-22: loose ore and the pieces a kill drops are pulled in like a magnet when a
 * ship passes near. The first to pull takes it; a piece is never split between two players.
 */
const idle = createInput();
const tick = (world: ArenaWorld, n = 1): void => { for (let i = 0; i < n; i++) stepSandboxWorld(world, idle); };
const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** An empty open space, the field ore far away, the pilot parked at the origin. */
function openWorld(): ArenaWorld {
  const world = createSandboxWorld({ bots: 0, layout: layoutWith([], 3000, 3000, [{ x: 2500, y: 0, z: 2500 }]) });
  for (const drop of world.cargoDrops) drop.active = false;
  park(world.pilot, { x: 0, y: 0, z: 0 });
  return world;
}
function park(pilot: Pilot, p: Vec3): void {
  Object.assign(pilot.p, p); Object.assign(pilot.q, { x: 0, y: 0, z: 0, w: 1 });
  pilot.s = 0; pilot.throttle = 0; pilot.shield = 0;
}
/** A second ship flown by nobody (neutral input): it sits where it is put. */
function rival(world: ArenaWorld, p: Vec3): Pilot {
  const other = createPilot(7);
  park(other, p);
  const prior = createPilot(7); copyFlight(prior, other);
  world.drones.push(other); world.dronePrevious.push(prior);
  return other;
}
/** A loose wreck piece (not field ore) at `p`. */
function piece(world: ArenaWorld, p: Vec3, amount = 6, kind = 0): CargoDrop {
  const drop = world.cargoDrops.find(d => !d.field && !d.active);
  if (!drop) throw new Error('no wreck slot');
  Object.assign(drop.p, p); drop.amount = amount; drop.kind = kind; drop.active = true; drop.age = 0;
  return drop;
}

describe('the cargo magnet', () => {
  it('pulls a piece a ship passes near: it flies to the hull and lands in the hold, whole', () => {
    const world = openWorld();
    const drop = piece(world, { x: T.magnetRadius - 5, y: 0, z: 0 }, 6, 2);
    const start = distance(drop.p, world.pilot.p);
    tick(world);
    // Pulled, not teleported: one tick in, it is on its way.
    expect(drop.active).toBe(true);
    expect(distance(drop.p, world.pilot.p)).toBeLessThan(start);
    tick(world, T.tickRate);
    expect(drop.active).toBe(false);
    expect(world.pilot.cargo).toBe(6);
    expect(world.pilot.hold[2]).toBe(6);
  });

  it('leaves a piece beyond magnetRadius where it is', () => {
    const world = openWorld();
    const drop = piece(world, { x: T.magnetRadius + 5, y: 0, z: 0 });
    tick(world, T.tickRate);
    expect(drop.active).toBe(true);
    expect(drop.p).toEqual({ x: T.magnetRadius + 5, y: 0, z: 0 });
    expect(world.pilot.cargo).toBe(0);
  });

  it('gives a pulled piece to the first puller only, even when a ship ends up closer', () => {
    const world = openWorld();
    const drop = piece(world, { x: T.magnetRadius - 5, y: 0, z: 0 });
    tick(world);
    const other = rival(world, { x: drop.p.x + 1, y: 0, z: 0 });
    tick(world, T.tickRate);
    expect(world.pilot.cargo).toBe(6);
    expect(other.cargo).toBe(0);
  });

  it('gives it to the nearer ship when two come in range on the same tick, and never splits it', () => {
    const world = openWorld();
    const drop = piece(world, { x: 0, y: 0, z: 0 }, 8);
    park(world.pilot, { x: 40, y: 0, z: 0 });
    const other = rival(world, { x: -30, y: 0, z: 0 });
    tick(world, T.tickRate);
    expect(drop.active).toBe(false);
    expect(other.cargo).toBe(8);
    expect(world.pilot.cargo).toBe(0);
  });

  it('does not pull a piece the hold cannot take whole; it stays, whole, for a ship that can', () => {
    const world = openWorld();
    world.pilot.cargo = T.cargoCapacity - 2; world.pilot.hold[0] = T.cargoCapacity - 2;
    const drop = piece(world, { x: 10, y: 0, z: 0 }, 6);
    tick(world, T.tickRate);
    expect(drop).toMatchObject({ active: true, amount: 6, p: { x: 10, y: 0, z: 0 } });
    expect(world.pilot.cargo).toBe(T.cargoCapacity - 2);
    const other = rival(world, { x: 30, y: 0, z: 0 });
    tick(world, T.tickRate);
    expect(other.cargo).toBe(6);
    expect(world.pilot.cargo).toBe(T.cargoCapacity - 2);
  });

  it('counts the pieces already on their way against the hold', () => {
    const world = openWorld();
    // Room for 6: the first piece of 4 is pulled; the second would only fit in part, so it stays whole.
    world.pilot.cargo = T.cargoCapacity - 6; world.pilot.hold[0] = T.cargoCapacity - 6;
    const a = piece(world, { x: 20, y: 0, z: 0 }, 4);
    const b = piece(world, { x: -20, y: 0, z: 0 }, 4);
    tick(world, T.tickRate);
    expect(world.pilot.cargo).toBe(T.cargoCapacity - 2);
    expect([a.active, b.active].filter(Boolean)).toHaveLength(1);
    const left = a.active ? a : b;
    expect(left.amount).toBe(4);
  });

  it('lets go when the puller dies: the piece stops where it is and anyone may pull it', () => {
    const world = openWorld();
    const drop = piece(world, { x: T.magnetRadius - 2, y: 0, z: 0 });
    tick(world);
    world.pilot.phase = 'dead';
    tick(world);
    const stopped = { ...drop.p };
    tick(world, 5);
    expect(drop.p).toEqual(stopped);
    expect(drop.active).toBe(true);
    const other = rival(world, { x: drop.p.x + 20, y: 0, z: 0 });
    tick(world, T.tickRate);
    expect(other.cargo).toBe(6);
  });

  it('lets go when the hold fills another way before the piece arrives: the hold never overflows', () => {
    const world = openWorld();
    const drop = piece(world, { x: T.magnetRadius - 2, y: 0, z: 0 }, 6);
    tick(world);
    world.pilot.cargo = T.cargoCapacity - 1; world.pilot.hold[0] = T.cargoCapacity - 1;
    tick(world, T.tickRate);
    expect(world.pilot.cargo).toBe(T.cargoCapacity - 1);
    expect(drop).toMatchObject({ active: true, amount: 6, claim: -1 });
  });

  it('catches a ship flying away at full turbo speed', () => {
    const world = openWorld();
    // Just passed it: in range after the ship's first step away.
    const drop = piece(world, { x: 0, y: 0, z: -(T.magnetRadius - 15) });
    const fast = createInput(); fast.throttle = 1;
    world.pilot.s = T.speedMax * T.turboSpeedMul; world.pilot.throttle = 1;
    for (let i = 0; i < 2 * T.tickRate && drop.active; i++) stepSandboxWorld(world, fast);
    expect(drop.active).toBe(false);
    expect(world.pilot.cargo).toBe(6);
  });

  it('pulls the pieces a destroyed hold drops, like loose ore', () => {
    const world = openWorld();
    const wreck = createPilot(9);
    park(wreck, { x: 0, y: 0, z: 200 });
    wreck.hold = [12, 0, 0]; wreck.cargo = 12;
    scatter(world, wreck);
    park(world.pilot, { x: 0, y: 0, z: 170 });
    tick(world, 2 * T.tickRate);
    expect(world.pilot.cargo).toBe(12);
    expect(world.cargoDrops.some(d => d.active)).toBe(false);
  });
});
