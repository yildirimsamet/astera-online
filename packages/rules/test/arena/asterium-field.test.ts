import { describe, expect, it } from 'vitest';
import {
  ARENA_POOLS, ARENA_PROTOCOL, ASTERIUM_STORM, PILOT_WIDTH, createPilot, packPilot, unpackPilot, ARENA_TUNING as T, FARM_KINDS, FIELD_GROUP_SIZE, createInput, createSandboxWorld,
  emptyHold, extractAsterium, pickFieldSpawn, scatter, stepAsteriumStorm, stepSandboxWorld, type ArenaWorld, type CargoDrop, type Vec3,
} from '../../src/arena/index.js';
import { layoutWith } from './helpers.js';

/** R7 (plan §3.2): Asteryum is the zone's fourth farm, and it grows only while the storm blows. */
const ASTERIUM = 3;
const HOUR = 3600 * T.tickRate;
/** Forty clear spots in the heart (1 km out) and twenty past it (3 km out). */
const ring = (count: number, radius: number): Vec3[] =>
  Array.from({ length: count }, (_, i) => ({ x: Math.cos(i / count * 2 * Math.PI) * radius, y: 0, z: Math.sin(i / count * 2 * Math.PI) * radius }));
const spots: Vec3[] = [...ring(40, 1000), ...ring(20, 3000)];
const idle = createInput();

function openWorld(storm: boolean, pilots = 1, seed = 4100): ArenaWorld {
  const world = createSandboxWorld({ bots: 0, seed, layout: layoutWith([], 5000, 3000, spots) });
  world.asteriumStorm = storm;
  world.pilot.p.x = 0; world.pilot.p.y = 0; world.pilot.p.z = -900;
  for (let i = 1; i < pilots; i++) world.drones.push(createPilot(100 + i));
  return world;
}

const stormPieces = (world: ArenaWorld): CargoDrop[] => world.cargoDrops.filter((drop) => drop.active && drop.kind === ASTERIUM);

/** Runs the storm `ticks` long; every `every` seconds a pilot takes every piece out. Returns the units taken. */
function fly(world: ArenaWorld, ticks: number, every = 30): number {
  let taken = 0;
  for (let i = 1; i <= ticks; i++) {
    stepAsteriumStorm(world);
    if (i % (every * T.tickRate) !== 0) continue;
    for (const drop of stormPieces(world)) { taken += drop.amount; drop.active = false; drop.amount = 0; }
  }
  return taken;
}

describe('Asteryum, the fourth farm', () => {
  it('is kind 3, and every hold has room for it', () => {
    expect(FARM_KINDS).toEqual(['alloy', 'crystal', 'deuterium', 'asterium']);
    expect(emptyHold()).toEqual([0, 0, 0, 0]);
  });

  it('is never one of the ordinary field groups, at any roll', () => {
    for (let i = 0; i < 1000; i++) expect(pickFieldSpawn(i / 1000).kind).not.toBe(ASTERIUM);
  });
});

/*
  THE STORM, PILOT BY PILOT (owner 2026-11-25: "yarık'a giren pilot başı dynamic bir sistem … bazen 1 bazen 2 …
  kişi başı 6-15 civarı … ortalarda çıktığını söyleyelim"). The rate is the room's secret; where is the heart.
*/
describe('the Asteryum Fırtınası', () => {
  it('makes nothing while it is calm, and nothing in an empty zone', () => {
    expect(fly(openWorld(false), HOUR)).toBe(0);
    const empty = openWorld(true);
    empty.pilot.phase = 'towed';
    expect(fly(empty, HOUR)).toBe(0);
  });

  it('opens with pieces already out, each of one or two units, in the heart of the zone', () => {
    const world = openWorld(true, 3);
    stepAsteriumStorm(world);
    const out = stormPieces(world);
    expect(out.length).toBeGreaterThanOrEqual(2);
    for (const drop of out) {
      expect([1, 2]).toContain(drop.amount);
      expect(Math.hypot(drop.p.x, drop.p.z)).toBeLessThanOrEqual(ASTERIUM_STORM.heart);
    }
  });

  it('pays every pilot 6 to 15 units an hour, alone or in a crowd', () => {
    for (const pilots of [1, 2, 4, 8, 12]) {
      const perPilot = fly(openWorld(true, pilots), HOUR) / pilots;
      expect(perPilot, `${String(pilots)} pilots`).toBeGreaterThanOrEqual(6);
      expect(perPilot, `${String(pilots)} pilots`).toBeLessThanOrEqual(15);
    }
  });

  it('draws both sizes of piece', () => {
    const world = openWorld(true, 8);
    const sizes = new Set<number>();
    for (let i = 1; i <= HOUR; i++) {
      stepAsteriumStorm(world);
      for (const drop of stormPieces(world)) { sizes.add(drop.amount); drop.active = false; }
    }
    expect([...sizes].sort()).toEqual([1, 2]);
  });

  it('keeps one piece out per pilot, at least two and at most eight, however long nobody takes them', () => {
    for (const [pilots, most] of [[1, 2], [5, 5], [20, 8]] as const) {
      const world = openWorld(true, pilots);
      for (let i = 0; i < HOUR; i++) {
        stepAsteriumStorm(world);
        expect(stormPieces(world).length).toBeLessThanOrEqual(most);
      }
      expect(stormPieces(world).length).toBe(most);
    }
  });

  it('never grows two pieces on one spot, nor on a field group\'s', () => {
    const world = openWorld(true, 8);
    for (let i = 0; i < 10 * 60 * T.tickRate; i++) {
      stepAsteriumStorm(world);
      const at = stormPieces(world).map((drop) => `${String(Math.round(drop.p.x))},${String(Math.round(drop.p.z))}`);
      expect(new Set(at).size).toBe(at.length);
      for (const spot of world.fieldSpots) {
        if (spot < 0) continue;
        const p = spots[spot];
        if (p) expect(at).not.toContain(`${String(Math.round(p.x))},${String(Math.round(p.z))}`);
      }
      if (i % (60 * T.tickRate) === 0) for (const drop of stormPieces(world)) drop.active = false;
    }
  });

  it('is never grown over by a field group regrowing on its spot', () => {
    const world = openWorld(true, 8);
    stepAsteriumStorm(world);
    const held = new Set(world.stormSpots.filter((spot) => spot >= 0));
    expect(held.size).toBeGreaterThan(0);
    // Nobody flies, so the storm's pieces stay where they are while every field group is emptied and regrows.
    world.pilot.phase = 'towed'; world.drones = []; world.dronePrevious = [];
    for (let round = 0; round < 15; round++) {
      for (let i = 0; i < T.fieldGroups * FIELD_GROUP_SIZE; i++) { const drop = world.cargoDrops[i]; if (drop) drop.active = false; }
      for (let i = 0; i <= (T.fieldFarmRespawn + 1) * T.tickRate; i++) stepSandboxWorld(world, idle);
      for (const spot of world.fieldSpots) expect(held.has(spot)).toBe(false);
    }
  });

  it('leaves what is out when it ends, and grows nothing more', () => {
    const world = openWorld(true, 4);
    fly(world, 5 * 60 * T.tickRate, 600);
    const out = stormPieces(world).length;
    expect(out).toBeGreaterThan(0);
    world.asteriumStorm = false;
    fly(world, HOUR, 3600 * 2);
    expect(stormPieces(world).length).toBe(out);
  });

  it('has slots of its own that never age out and that a wreck never fills', () => {
    expect(ARENA_POOLS.cargo).toBe(T.fieldGroups * FIELD_GROUP_SIZE + T.wreckDrops + ASTERIUM_STORM.maxPieces);
    const world = openWorld(true, 2);
    stepAsteriumStorm(world);
    const out = stormPieces(world).length;
    // Nobody left to take them or to grow more: what is out simply stays, past a wreck piece's life.
    world.pilot.phase = 'towed'; world.drones = []; world.dronePrevious = [];
    for (let i = 0; i < (T.dropLife + 5) * T.tickRate; i++) stepSandboxWorld(world, idle);
    expect(stormPieces(world).length).toBe(out);
    world.pilot.hold = [0, 0, 0, 4]; world.pilot.cargo = 4;
    scatter(world, world.pilot);
    expect(world.cargoDrops.filter((drop) => drop.active && !drop.field && drop.kind === ASTERIUM).reduce((sum, drop) => sum + drop.amount, 0)).toBeCloseTo(4, 9);
  });
});

describe('extractAsterium: what an exit carries home, in whole units, outside the daily cap', () => {
  it('reads only the fourth slot and drops fractions', () => {
    expect(extractAsterium([100, 50, 20, 7.9])).toBe(7);
    expect(extractAsterium([100, 50, 20])).toBe(0);
    expect(extractAsterium([0, 0, 0, -3])).toBe(0);
  });
});

describe('the own row carries the Asteryum slot (protocol 17)', () => {
  it('packs and unpacks all four hold slots', () => {
    expect(ARENA_PROTOCOL).toBeGreaterThanOrEqual(17);
    const pilot = createPilot(7);
    pilot.hold = [1, 2, 3, 4];
    const row = packPilot(pilot);
    expect(row).toHaveLength(PILOT_WIDTH);
    expect(unpackPilot(row).hold).toEqual([1, 2, 3, 4]);
  });
});

describe('the storm\'s slots are new to the room (protocol 19)', () => {
  it('tells a page on 18 to reload: its pool is shorter', () => {
    expect(ARENA_PROTOCOL).toBe(19);
  });
});

describe('A3 a lost ship spills its Asteryum like any cargo', () => {
  it('drops the fourth slot as Asteryum pieces another pilot can take', () => {
    const world = openWorld(false);
    world.pilot.hold = [0, 0, 0, 4]; world.pilot.cargo = 4;
    scatter(world, world.pilot);
    const spilled = world.cargoDrops.filter((drop) => drop.active && !drop.field && drop.kind === ASTERIUM);
    expect(spilled.reduce((sum, drop) => sum + drop.amount, 0)).toBeCloseTo(4, 9);
    expect(world.pilot.hold).toEqual([0, 0, 0, 0]);
  });
});
