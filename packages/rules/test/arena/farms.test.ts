import { describe, expect, it } from 'vitest';
import {
  ARENA_CATALOG, ARENA_LAYOUT, ARENA_TUNING as T, FARM_POINTS, FIELD_GROUP_SIZE, FIELD_SPAWNS, buildArenaLayout, createInput,
  createSandboxWorld, holdPoints, obstacleSize, pickFieldSpawn, scatter, stepSandboxWorld, surfaceGap, type ArenaWorld, type CargoDrop, type Vec3,
} from '../../src/arena/index.js';
import { layoutWith, sphere } from './helpers.js';

/**
 * Farms are what the zone is played for: alloy, crystal and deuterium. Ore floats free
 * in lone pieces and clusters; deposits sit on rock; a destroyed hold falls where it died.
 */
const ALLOY = 0; const CRYSTAL = 1; const DEUTERIUM = 2;
const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const spots: Vec3[] = Array.from({ length: T.fieldGroups + 6 }, (_, i) => ({ x: i * 200 - 2000, y: 0, z: 900 }));
const idle = createInput();
const FIELD_SLOTS = T.fieldGroups * FIELD_GROUP_SIZE;

function openWorld(): ArenaWorld {
  const world = createSandboxWorld({ bots: 0, layout: layoutWith([], 3000, 3000, spots) });
  world.pilot.p.x = 0; world.pilot.p.y = 0; world.pilot.p.z = -900;
  world.pilot.q.x = 0; world.pilot.q.y = 0; world.pilot.q.z = 0; world.pilot.q.w = 1;
  return world;
}
const group = (world: ArenaWorld, g: number): CargoDrop[] => world.cargoDrops.slice(g * FIELD_GROUP_SIZE, (g + 1) * FIELD_GROUP_SIZE);
const wreckDrops = (world: ArenaWorld): CargoDrop[] => world.cargoDrops.slice(FIELD_SLOTS);
const seconds = (world: ArenaWorld, s: number): void => { for (let i = 0; i < s * T.tickRate; i++) stepSandboxWorld(world, idle); };
const take = (world: ArenaWorld, drop: CargoDrop): void => { Object.assign(world.pilot.p, drop.p); stepSandboxWorld(world, idle); };
const away = (world: ArenaWorld): void => { world.pilot.p.x = 0; world.pilot.p.y = 0; world.pilot.p.z = -900; };

describe('farm values', () => {
  it('scores a hold by kind, rarer worth more, in whole points', () => {
    expect(FARM_POINTS).toEqual([1, 2, 3]);
    expect(holdPoints([10, 5, 2])).toBe(10 + 10 + 6);
    expect(holdPoints([0.6, 0.6, 0])).toBe(1);
    expect(holdPoints([])).toBe(0);
  });

  it('draws every field spawn by weight across the whole roll', () => {
    expect(pickFieldSpawn(0)).toBe(FIELD_SPAWNS[0]);
    expect(pickFieldSpawn(0.999999)).toBe(FIELD_SPAWNS[FIELD_SPAWNS.length - 1]);
    const seen = new Set(Array.from({ length: 100 }, (_, i) => pickFieldSpawn(i / 100)));
    expect(seen.size).toBe(FIELD_SPAWNS.length);
    for (const spawn of FIELD_SPAWNS) expect(spawn.pieces).toBeLessThanOrEqual(FIELD_GROUP_SIZE);
  });
});

describe('the zone layout', () => {
  it('places the same clear farm spots on every peer, inside the disc and outside every collider and gate zone', () => {
    // A kit room's cargo bay is inside the building's bounding ball: there the real walls count.
    expect(buildArenaLayout(20261008).farmSpots).toEqual(ARENA_LAYOUT.farmSpots);
    expect(ARENA_LAYOUT.farmSpots).toHaveLength(T.farmSpots);
    for (const p of ARENA_LAYOUT.farmSpots) {
      expect(Math.hypot(p.x, p.z)).toBeLessThan(T.arenaRadius - 40);
      expect(Math.abs(p.y)).toBeLessThan(T.arenaHalfHeight - 40);
      for (const o of ARENA_LAYOUT.obstacles) {
        if (o.kind === 'structure') expect(surfaceGap(ARENA_LAYOUT, o.id, p)).toBeGreaterThan(T.clusterRadius + 5);
        else expect(distance(p, o.p)).toBeGreaterThan(o.radius + T.clusterRadius + 5);
      }
      for (const gate of [...ARENA_LAYOUT.exits, ...ARENA_LAYOUT.entries]) expect(distance(p, gate)).toBeGreaterThan(T.exitRadius);
    }
  });

  it('veins landable rock with alloy and deuterium next to the crystal formations', () => {
    const L = ARENA_LAYOUT;
    expect(L.depositKinds).toHaveLength(L.deposits.length);
    const of = (kind: number) => L.deposits.filter((_, i) => L.depositKinds[i] === kind).map(id => L.obstacles[id]);
    expect(of(CRYSTAL).every(o => o?.kind === 'crystal')).toBe(true);
    expect(of(ALLOY)).toHaveLength(T.alloyDeposits);
    expect(of(DEUTERIUM)).toHaveLength(T.deuteriumDeposits);
    for (const o of [...of(ALLOY), ...of(DEUTERIUM)]) {
      if (o?.shape !== 'mesh') throw new Error('a veined rock is a scanned rock (Y2)');
      expect(o.kind).toBe('rock');
      // Field rock a ship can land on, never a landmark giant.
      expect(ARENA_CATALOG[o.mesh]?.family).toBe('rock');
      expect(obstacleSize(L, o)).toBeGreaterThanOrEqual(14);
      expect(obstacleSize(L, o)).toBeLessThanOrEqual(45);
    }
    expect(new Set(L.deposits).size).toBe(L.deposits.length);
    expect(buildArenaLayout(20261008).depositKinds).toEqual(L.depositKinds);
  });
});

describe('mining a deposit', () => {
  it('fills the hold with the deposit\'s own kind', () => {
    const layout = { ...layoutWith([sphere(0, 0, 0, 80, 20, 'rock')]), deposits: [0], depositKinds: [DEUTERIUM] };
    const world = createSandboxWorld({ bots: 0, layout });
    world.pilot.p.x = 0; world.pilot.p.y = 0; world.pilot.p.z = 0;
    world.pilot.q.x = 0; world.pilot.q.y = 0; world.pilot.q.z = 0; world.pilot.q.w = 1;
    const slow = { ...createInput(), throttle: 0.12 };
    for (let i = 0; i < 900 && !world.pilot.landed; i++) stepSandboxWorld(world, slow);
    expect(world.pilot.landed).toBe(1);
    seconds(world, 2);
    expect(world.pilot.hold[DEUTERIUM]).toBeGreaterThan(0);
    expect(world.pilot.hold[ALLOY]).toBe(0);
    expect(world.pilot.cargo).toBeCloseTo(world.pilot.hold[DEUTERIUM] ?? -1, 9);
  });
});

describe('field ore', () => {
  it('opens with every group grown: one kind per group, a lone piece or a cluster round a free spot', () => {
    const world = openWorld();
    const anchors: Vec3[] = [];
    for (let g = 0; g < T.fieldGroups; g++) {
      const live = group(world, g).filter(drop => drop.active);
      const spawn = FIELD_SPAWNS.find(s => s.pieces === live.length && s.kind === live[0]?.kind && s.amount === live[0].amount);
      expect(spawn).toBeDefined();
      expect(live.every(drop => drop.field && drop.kind === live[0]?.kind)).toBe(true);
      const anchor = spots.find(spot => live.every(drop => distance(spot, drop.p) <= T.clusterRadius + 1e-9));
      expect(anchor).toBeDefined();
      if (anchor) anchors.push(anchor);
    }
    expect(new Set(anchors).size).toBe(T.fieldGroups);
    expect(wreckDrops(world).some(drop => drop.active || drop.field)).toBe(false);
  });

  it('goes into the hold by kind when flown through, and regrows only once the whole group is taken', () => {
    const world = openWorld();
    const g = Array.from({ length: T.fieldGroups }, (_, i) => i).find(i => group(world, i).filter(d => d.active).length > 1);
    if (g === undefined) throw new Error('no cluster opened; the seed changed');
    const pieces = group(world, g).filter(drop => drop.active);
    const kind = pieces[0]?.kind ?? -1;
    const total = pieces.reduce((sum, drop) => sum + drop.amount, 0);
    const [first, ...rest] = pieces;
    if (!first) throw new Error('empty cluster');
    const firstAmount = first.amount;
    take(world, first);
    expect(world.pilot.hold[kind]).toBe(firstAmount);
    away(world);
    seconds(world, T.fieldFarmRespawn + 1);
    expect(first.active).toBe(false);
    expect(rest.every(drop => drop.active)).toBe(true);
    for (const drop of rest) take(world, drop);
    expect(world.pilot.hold[kind]).toBeCloseTo(total, 9);
    expect(world.pilot.cargo).toBeCloseTo(total, 9);
    away(world);
    seconds(world, T.fieldFarmRespawn - 1);
    expect(group(world, g).some(drop => drop.active)).toBe(false);
    seconds(world, 1.1);
    expect(group(world, g).some(drop => drop.active)).toBe(true);
  });

  it('never times out like a wreck piece does', () => {
    const world = openWorld();
    const before = world.cargoDrops.slice(0, FIELD_SLOTS).map(drop => ({ ...drop, p: { ...drop.p } }));
    seconds(world, T.dropLife + 1);
    expect(world.cargoDrops.slice(0, FIELD_SLOTS)).toEqual(before);
  });

  // Owner 2026-10-22: a piece is never split between two players (magnet.test.ts).
  it('leaves a piece the hold cannot take whole where it is, whole', () => {
    const world = openWorld();
    const piece = world.cargoDrops.find(drop => drop.active);
    if (!piece) throw new Error('no piece');
    world.pilot.hold[ALLOY] = T.cargoCapacity - 2; world.pilot.cargo = T.cargoCapacity - 2;
    const amount = piece.amount;
    take(world, piece);
    expect(world.pilot.cargo).toBe(T.cargoCapacity - 2);
    expect(piece).toMatchObject({ active: true, amount });
  });
});

describe('a destroyed hold', () => {
  it('falls out by kind in dropChunk pieces on a small ring round the wreck, never into field slots', () => {
    const world = openWorld();
    const field = world.cargoDrops.slice(0, FIELD_SLOTS).map(drop => ({ ...drop, p: { ...drop.p } }));
    world.pilot.p.x = 400; world.pilot.p.y = 50; world.pilot.p.z = 400;
    world.pilot.hold = [25, 0, 7]; world.pilot.cargo = 32;
    scatter(world, world.pilot);
    expect(world.pilot.cargo).toBe(0);
    expect(world.pilot.hold).toEqual([0, 0, 0]);
    const pieces = wreckDrops(world).filter(drop => drop.active);
    const byKind = (kind: number) => pieces.filter(d => d.kind === kind).map(d => d.amount).sort((a, b) => a - b);
    expect(byKind(ALLOY)).toEqual([5, 10, 10]);
    expect(byKind(DEUTERIUM)).toEqual([7]);
    expect(byKind(CRYSTAL)).toEqual([]);
    for (const drop of pieces) {
      expect(drop.field).toBe(false);
      expect(distance(drop.p, world.pilot.p)).toBeGreaterThan(T.scatterRadius * 0.5);
      expect(distance(drop.p, world.pilot.p)).toBeLessThanOrEqual(T.scatterRadius + 1e-9);
    }
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i]; const b = pieces[j];
      if (a && b) expect(distance(a.p, b.p)).toBeGreaterThan(5);
    }
    expect(world.cargoDrops.slice(0, FIELD_SLOTS)).toEqual(field);
  });

  it('drops nothing for an empty hold, and keeps fractions of mined cargo', () => {
    const world = openWorld();
    scatter(world, world.pilot);
    expect(wreckDrops(world).some(drop => drop.active)).toBe(false);
    world.pilot.hold = [0, 12.5, 0]; world.pilot.cargo = 12.5;
    scatter(world, world.pilot);
    const pieces = wreckDrops(world).filter(drop => drop.active);
    expect(pieces.every(drop => drop.kind === CRYSTAL)).toBe(true);
    expect(pieces.reduce((sum, drop) => sum + drop.amount, 0)).toBeCloseTo(12.5, 9);
  });
});
