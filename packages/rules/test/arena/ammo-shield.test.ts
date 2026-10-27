import { describe, expect, it } from 'vitest';
import {
  ARENA_TUNING as T, createInput, createPilot, createSandboxWorld, stepSandboxWorld, type ArenaIntent, type ArenaWorld, type Pilot,
} from '../../src/arena/index.js';
import { layoutWith } from './helpers.js';

/**
 * Owner 2026-10-21: hull, shield, fuel and ammunition are four separate things. A flight
 * starts with a full magazine that does not refill in flight, and a shot no longer burns
 * fuel. A shield (from a skill) is its own layer of hit points: damage takes it first.
 */
const intent = (patch: Partial<ArenaIntent> = {}): ArenaIntent => ({ ...createInput(), ...patch });

function range(): ArenaWorld {
  const world = createSandboxWorld({ bots: 0, layout: layoutWith() });
  world.pilot.p.x = 0; world.pilot.p.y = 0; world.pilot.p.z = 0;
  world.pilot.q.x = 0; world.pilot.q.y = 0; world.pilot.q.z = 0; world.pilot.q.w = 1;
  world.pilot.shield = 0;
  return world;
}
/** A still target 200 m dead ahead: most of a burst lands. */
function target(world: ArenaWorld): Pilot {
  const pilot = createPilot(9);
  pilot.p.z = 200;
  world.drones.push(pilot);
  world.dronePrevious.push({ ...pilot, p: { ...pilot.p }, q: { ...pilot.q } });
  return pilot;
}
function burst(world: ArenaWorld, seconds: number): void {
  const fire = intent({ fire: true });
  for (let i = 0; i < seconds * T.tickRate; i++) stepSandboxWorld(world, fire);
  for (let i = 0; i < T.tickRate; i++) stepSandboxWorld(world, intent());
}

describe('ammunition', () => {
  it('starts every pilot with a full magazine and no shield', () => {
    const pilot = createPilot(3);
    expect(T.ammoCapacity).toBe(480);
    expect(pilot.ammo).toBe(T.ammoCapacity);
    expect(pilot.shieldHp).toBe(0);
    expect(pilot.shieldMax).toBe(0);
  });

  it('spends one round per shot and no fuel', () => {
    const world = range();
    const fuel = world.pilot.fuel;
    const idle = range();
    burst(world, 1);
    for (let i = 0; i < 2 * T.tickRate; i++) stepSandboxWorld(idle, intent());
    expect(world.pilot.shots).toBe(T.fireRate);
    expect(world.pilot.ammo).toBe(T.ammoCapacity - T.fireRate);
    // Flying burns the same with the trigger held or not.
    expect(fuel - world.pilot.fuel).toBeCloseTo(fuel - idle.pilot.fuel, 9);
  });

  it('cannot fire with an empty magazine, and fires its last round', () => {
    const world = range();
    world.pilot.ammo = 1;
    burst(world, 1);
    expect(world.pilot.shots).toBe(1);
    expect(world.pilot.ammo).toBe(0);
    burst(world, 1);
    expect(world.pilot.shots).toBe(1);
  });
});

describe('shield layer', () => {
  it('takes the damage before the hull, and the rest goes to the hull', () => {
    const world = range();
    const enemy = target(world);
    enemy.shieldMax = 50; enemy.shieldHp = 50;
    burst(world, 1);
    const hits = world.pilot.hits;
    expect(hits).toBeGreaterThan(5);
    expect(enemy.shieldHp).toBe(0);
    expect(enemy.hull).toBe(T.hull - (hits * T.damage - 50));
  });

  it('keeps the hull whole while the shield holds', () => {
    const world = range();
    const enemy = target(world);
    enemy.shieldMax = 1000; enemy.shieldHp = 1000;
    burst(world, 1);
    expect(world.pilot.hits).toBeGreaterThan(0);
    expect(enemy.hull).toBe(T.hull);
    expect(enemy.shieldHp).toBe(1000 - world.pilot.hits * T.damage);
    // Damage taken on the shield is still damage: it breaks an extraction hold.
    expect(enemy.lastDamage).toBeGreaterThan(0);
  });

  it('is not the spawn shield: a spawn-shielded ship takes nothing, shield layer or not', () => {
    const world = range();
    const enemy = target(world);
    enemy.shield = 10 * T.tickRate; enemy.shieldMax = 50; enemy.shieldHp = 50;
    burst(world, 1);
    expect(enemy.shieldHp).toBe(50);
    expect(enemy.hull).toBe(T.hull);
  });
});
