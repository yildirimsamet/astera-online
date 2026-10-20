import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/rng.js';
import {
  ARENA_LAYOUT, ARENA_SEED, ARENA_TUNING as T, buildArenaLayout, createFlightState, forwardVector, spawnFlight,
  type ArenaObstacle, type Vec3,
} from '../../src/arena/index.js';

const L = ARENA_LAYOUT;
const horizontal = (p: Vec3): number => Math.sqrt(p.x * p.x + p.z * p.z);
const distance = (a: Vec3, b: Vec3): number => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
const spheres = L.obstacles.filter((o): o is Extract<ArenaObstacle, { shape: 'sphere' }> => o.shape === 'sphere');

describe('arena layout v2', () => {
  it('is generated identically on every peer from one seed', () => {
    expect(buildArenaLayout(ARENA_SEED)).toEqual(L);
    expect(buildArenaLayout(ARENA_SEED + 1).obstacles).not.toEqual(L.obstacles);
    L.obstacles.forEach((o, i) => { expect(o.id).toBe(i); });
  });

  it('is a flat disc with four entrances and four exits, one of each at the centre', () => {
    expect(L.radius).toBe(T.arenaRadius);
    expect(L.halfHeight).toBe(T.arenaHalfHeight);
    expect(L.entries).toHaveLength(4);
    expect(L.exits).toHaveLength(4);
    expect(L.entries.filter(p => horizontal(p) < 1)).toHaveLength(1);
    expect(L.exits.filter(p => horizontal(p) < 1)).toHaveLength(1);
    for (const p of [...L.entries, ...L.exits]) {
      if (horizontal(p) >= 1) expect(horizontal(p)).toBeCloseTo(T.ringRadius, 6);
      expect(Math.abs(p.y)).toBeLessThan(T.arenaHalfHeight - 100);
    }
    const keys = [...L.entries, ...L.exits].map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`);
    expect(new Set(keys).size).toBe(8);
  });

  it('keeps every collider inside the boundary and never stacks two rocks into each other', () => {
    for (const o of L.obstacles) {
      expect(horizontal(o.p) + o.radius).toBeLessThanOrEqual(T.arenaRadius);
      expect(Math.abs(o.p.y) + o.radius).toBeLessThanOrEqual(T.arenaHalfHeight);
    }
    for (let i = 0; i < spheres.length; i++) {
      for (let j = i + 1; j < spheres.length; j++) {
        const a = spheres[i]; const b = spheres[j];
        if (!a || !b) continue;
        expect(distance(a.p, b.p)).toBeGreaterThanOrEqual(a.radius + b.radius);
      }
    }
  });

  it('keeps entrances clear so nobody is born inside a rock', () => {
    for (const entry of L.entries) {
      for (const o of L.obstacles) expect(distance(entry, o.p) - o.radius).toBeGreaterThanOrEqual(T.spawnClear);
    }
  });

  it('gives every exit a gate with a landing deck under the exit point and nothing else in its zone', () => {
    const gates = L.structures.filter(s => s.kind === 'gate');
    expect(gates).toHaveLength(4);
    for (const exit of L.exits) {
      const gate = gates.find(g => g.decks.some(index => {
        const deck = L.obstacles[index];
        if (deck?.shape !== 'box') return false;
        const top = deck.p.y + deck.hy;
        return Math.abs(exit.y - T.shipHitRadius - top) < 1e-6
          && Math.abs(exit.x - deck.p.x) < deck.hx && Math.abs(exit.z - deck.p.z) < deck.hz;
      }));
      expect(gate, `exit ${JSON.stringify(exit)} has a deck`).toBeDefined();
      for (const o of L.obstacles) {
        if (gate?.colliders.includes(o.id)) continue;
        expect(distance(exit, o.p) - o.radius).toBeGreaterThan(T.exitRadius);
      }
    }
  });

  it('builds a hub, outposts with an interior bay, a wreck and landing decks on boxes', () => {
    expect(L.structures.filter(s => s.kind === 'hub')).toHaveLength(1);
    expect(L.structures.filter(s => s.kind === 'outpost').length).toBeGreaterThanOrEqual(2);
    expect(L.structures.filter(s => s.kind === 'wreck').length).toBeGreaterThanOrEqual(1);
    for (const s of L.structures) {
      expect(s.colliders.length).toBeGreaterThan(0);
      for (const index of s.decks) expect(L.obstacles[index]?.shape).toBe('box');
      expect(Math.abs(s.ux * s.ux + s.uz * s.uz - 1)).toBeLessThan(1e-9);
    }
    const bays = L.structures.filter(s => s.kind === 'outpost' && s.decks.some(deckIndex => {
      const deck = L.obstacles[deckIndex];
      return deck?.shape === 'box' && s.colliders.some(roofIndex => {
        const roof = L.obstacles[roofIndex];
        if (roof?.shape !== 'box' || roof === deck) return false;
        const gap = roof.p.y - roof.hy - (deck.p.y + deck.hy);
        return gap >= T.shipHitRadius * 3 && Math.abs(roof.p.x - deck.p.x) < deck.hx && Math.abs(roof.p.z - deck.p.z) < deck.hz;
      });
    }));
    expect(bays.length).toBeGreaterThanOrEqual(1);
  });

  it('mixes dense belts, sparse rock and mineable crystal formations', () => {
    const rocks = spheres.filter(o => o.kind === 'rock');
    expect(rocks.length).toBeGreaterThanOrEqual(350);
    const crystals = L.deposits.filter((_, i) => L.depositKinds[i] === 1);
    expect(crystals.length).toBeGreaterThanOrEqual(18);
    for (const index of crystals) expect(L.obstacles[index]?.kind).toBe('crystal');
    const dense = L.fields.filter(f => f.dense);
    expect(dense.length).toBeGreaterThanOrEqual(3);
    const inside = (p: Vec3): boolean => dense.some(f => distance(p, f.p) < f.radius);
    const denseVolume = dense.reduce((sum, f) => sum + 4 / 3 * Math.PI * f.radius * f.radius * f.height, 0);
    const total = Math.PI * T.arenaRadius * T.arenaRadius * 2 * T.arenaHalfHeight;
    const inDense = spheres.filter(o => inside(o.p)).length;
    expect(inDense / denseVolume).toBeGreaterThan(4 * (spheres.length - inDense) / (total - denseVolume));
    expect(crystals.filter(i => { const c = L.obstacles[i]; return c !== undefined && inside(c.p); }).length).toBeGreaterThan(0);
  });

  it('spawns reproducibly at an entrance, facing horizontally towards the centre', () => {
    const randomA = mulberry32(23);
    const randomB = mulberry32(23);
    const forward = { x: 0, y: 0, z: 0 };
    const observed = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const a = createFlightState();
      const b = createFlightState();
      const entry = spawnFlight(a, randomA);
      expect(spawnFlight(b, randomB)).toBe(entry);
      expect(a).toEqual(b);
      observed.add(entry);
      forwardVector(forward, a.q);
      expect(forward.y).toBeCloseTo(0, 12);
      const origin = L.entries[entry];
      if (!origin) throw new Error('spawn selected a nonexistent entrance');
      expect(distance(a.p, origin)).toBeLessThanOrEqual(T.spawnJitter + 1e-10);
      if (horizontal(origin) > 1) expect(forward.x * -origin.x + forward.z * -origin.z).toBeGreaterThan(0);
    }
    expect(observed.size).toBe(4);
  });
});
