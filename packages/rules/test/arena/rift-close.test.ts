import { describe, expect, it } from 'vitest';
import {
  ARENA_ECONOMY as E, ARENA_PROTOCOL, ARENA_TUNING as T, collapseRift, decodeArenaSnapshot, createFlightState, createInput, createPilot, createSandboxWorld, stepAsteriumStorm, stepSandboxWorld,
  type ArenaWorld, type Vec3,
} from '../../src/arena/index.js';
import { layoutWith } from './helpers.js';

/**
 * THE YARIK CLOSES (owner 2026-11-27): it opens twice a day; when a window ends, whoever is still inside has
 * `riftGraceMinutes` to fly out, and then every ship there is lost as if destroyed. Nothing of that hour is left
 * for the next opening: the storm's Asteryum goes with it.
 */
const ASTERIUM = 3;
const ring = (count: number, radius: number): Vec3[] =>
  Array.from({ length: count }, (_, i) => ({ x: Math.cos(i / count * 2 * Math.PI) * radius, y: 0, z: Math.sin(i / count * 2 * Math.PI) * radius }));

function room(): ArenaWorld {
  const world = createSandboxWorld({ bots: 0, seed: 4100, layout: layoutWith([], 5000, 3000, ring(40, 1000)) });
  world.pilot.phase = 'towed';
  return world;
}
const join = (world: ArenaWorld, id: number) => {
  const pilot = createPilot(id); pilot.p.x = id * 40; world.drones.push(pilot); world.dronePrevious.push(createFlightState()); return pilot;
};

describe('the Yarık closing', () => {
  it('gives five minutes to fly out', () => {
    expect(E.riftGraceMinutes).toBe(5);
  });

  it('destroys every ship still inside, its hold aboard for the report, and names them', () => {
    const world = room();
    const flying = join(world, 1); flying.hold = [40, 0, 0, 2]; flying.cargo = 42;
    const dry = join(world, 2); dry.phase = 'fuelOut';
    const home = join(world, 3); home.phase = 'extracted';
    const lost = collapseRift(world);
    expect(lost).toEqual([1, 2]);
    expect([flying.phase, dry.phase, home.phase]).toEqual(['dead', 'dead', 'extracted']);
    expect([flying.hull, dry.hull]).toEqual([0, 0]);
    expect(flying.hold).toEqual([40, 0, 0, 2]);
    // An explosion where each one was; no wreck is strewn into a room nobody may enter.
    expect(world.impacts.filter(i => i.active && i.kind === 'explosion')).toHaveLength(2);
    expect(world.cargoDrops.some(d => d.active && !d.field)).toBe(false);
  });

  it('breaks through a raised shield', () => {
    const world = room();
    const shielded = join(world, 1); shielded.shieldHp = 500; shielded.shieldMax = 500; shielded.shield = 90;
    collapseRift(world);
    expect(shielded.phase).toBe('dead');
  });

  it('takes the illusions with their pilots', () => {
    const world = room();
    const owner = join(world, 1);
    const copy = createPilot(2); copy.decoyOf = owner.id; owner.decoy = copy.id; copy.decoyLife = 100; copy.decoyHp = 100;
    world.drones.push(copy); world.dronePrevious.push(createFlightState());
    expect(collapseRift(world)).toEqual([1]);
    stepSandboxWorld(world, createInput());
    expect(world.drones.some(ship => ship.decoyOf >= 0)).toBe(false);
  });

  it('clears the storm\'s Asteryum, so the next opening finds none', () => {
    const world = room();
    join(world, 1);
    world.asteriumStorm = true;
    for (let i = 0; i < 10 * T.tickRate; i++) stepAsteriumStorm(world);
    expect(world.cargoDrops.some(d => d.active && d.kind === ASTERIUM)).toBe(true);
    const field = world.cargoDrops.filter(d => d.active && d.kind !== ASTERIUM).length;
    world.asteriumStorm = false;
    collapseRift(world);
    expect(world.cargoDrops.some(d => d.active && d.kind === ASTERIUM)).toBe(false);
    expect(world.cargoDrops.filter(d => d.active && d.kind !== ASTERIUM)).toHaveLength(field);
    expect([world.stormOpen, world.stormDebt]).toEqual([false, 0]);
  });

  it('does nothing in an empty room', () => {
    expect(collapseRift(room())).toEqual([]);
  });
});

describe('the closing is new to the room (protocol 20)', () => {
  it('tells a page on 19 to reload: it knows neither the `rift` message nor the bigger holds', () => {
    expect(ARENA_PROTOCOL).toBe(20);
    expect(decodeArenaSnapshot).toBeTypeOf('function');
  });
});
