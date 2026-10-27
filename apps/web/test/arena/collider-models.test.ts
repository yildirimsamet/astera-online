import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ARENA_CATALOG, ARENA_LAYOUT, createSandboxWorld, decodeEntry, STRUCTURE_CATALOG, STRUCTURE_MESH_BASE, type ArenaObstacle } from '@astera/rules/arena';
import { emptyArenaAssets, prepare, type PreparedModel } from '../../src/arena/assets/load.js';
import { parseReferenceManifest } from '../../src/arena/assets/manifest.js';
import { catalogRock } from '../../src/arena/render/procedural.js';
import { buildRocks, farRing, RockBatch, rockLevel, rockLevels, structurePlacements } from '../../src/arena/render/stage.js';

/** Y2: the rock the pilot sees is the rock the simulation hits, drawn as it is. */
const descriptor = (model: string) => ({ model, uvFlip: false, rotateY: 0 });
const pack = (extra: Record<string, unknown>) => ({
  version: 2,
  ships: { hero: descriptor('/__ref/dist/a.glb'), rivals: [descriptor('/__ref/dist/b.glb')] },
  rocks: [descriptor('/__ref/dist/r.glb')], giants: [descriptor('/__ref/dist/g.glb')], crystals: [descriptor('/__ref/dist/c.glb')], shards: [],
  structures: {
    hub: descriptor('/__ref/dist/h.glb'), gate: descriptor('/__ref/dist/h.glb'), outpost: [], generator: descriptor('/__ref/dist/h.glb'),
    wreck: [], relay: descriptor('/__ref/dist/h.glb'), pad: descriptor('/__ref/dist/h.glb'),
  },
  props: { debris: [], cargo: descriptor('/__ref/dist/h.glb') },
  textures: {}, sky: { faces: Array(6).fill('/__ref/dist/s.webp'), env: Array(6).fill('/__ref/dist/s.webp') },
  fx: {}, sounds: {}, music: [], ...extra,
});

describe('collider models in the reference pack', () => {
  it('reads the colliders section, keyed by catalog shape and marked as unit space', () => {
    const manifest = parseReferenceManifest(pack({ colliders: { 'flint-01': { ...descriptor('/__ref/dist/v2/yarik/flint-01.glb'), unit: true } } }));
    expect(manifest?.colliders?.['flint-01']?.unit).toBe(true);
  });

  it('still reads a pack without colliders, and refuses a collider path outside the served folders', () => {
    expect(parseReferenceManifest(pack({}))).not.toBeNull();
    expect(parseReferenceManifest(pack({ colliders: { bad: { ...descriptor('/__ref/dist/../secret.glb'), unit: true } } }))).toBeNull();
  });
});

/** A one-triangle model off the origin: where `prepare` would move and scale it. */
const offCentre = (): THREE.Group => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0.1, 0.2, 0.3, 0.5, 0.2, 0.3, 0.1, 0.4, 0.3], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ normalMap: new THREE.Texture() })));
  return group;
};
const corners = (model: PreparedModel | null): number[] => Array.from(model?.parts[0]?.geometry.getAttribute('position').array ?? []);

describe('preparing a model', () => {
  it('keeps a unit-space collider model exactly as written: no recentring, no rescale', () => {
    const model = prepare(offCentre(), { ...descriptor('/__ref/dist/x.glb'), unit: true }, false, new Map(), 1);
    expect(corners(model).map(v => Math.fround(v))).toEqual([0.1, 0.2, 0.3, 0.5, 0.2, 0.3, 0.1, 0.4, 0.3].map(v => Math.fround(v)));
  });

  it('still centres and scales any other model to bounding radius 1', () => {
    const model = prepare(offCentre(), descriptor('/__ref/dist/x.glb'), false, new Map(), 1);
    expect(model?.radius).toBeCloseTo(1, 6);
    expect(corners(model).some(v => v < 0)).toBe(true);
  });

  it('flips the normal map\'s green channel the way GLTFLoader does for a mesh without tangents', () => {
    for (const uvFlip of [false, true]) {
      const model = prepare(offCentre(), { ...descriptor('/__ref/dist/x.glb'), uvFlip }, false, new Map(), 1);
      expect(model?.parts[0]?.material.normalScale.toArray()).toEqual([1, -1]);
    }
  });
});

const triangles = (geometry: THREE.BufferGeometry): number => (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;

describe('the stand-in drawn without a pack', () => {
  it('is the collider itself, with a crystal\'s shards as a separate glowing part', () => {
    ARENA_CATALOG.forEach((entry, index) => {
      const model = catalogRock(index);
      const { positions, indices } = decodeEntry(entry);
      const [rock, glow] = model.parts;
      if (!rock) throw new Error('no rock part');
      expect(Array.from(rock.geometry.getAttribute('position').array)).toEqual(Array.from(positions, v => Math.fround(v)));
      expect(triangles(rock.geometry)).toBe(entry.glowFrom);
      if (entry.family === 'crystal') {
        expect(glow?.glow).toBe(true);
        expect(triangles(glow?.geometry ?? rock.geometry)).toBe(indices.length / 3 - entry.glowFrom);
      } else expect(model.parts).toHaveLength(1);
    });
  });
});

const drawnRock = (o: ArenaObstacle): boolean => o.shape === 'mesh' && o.kind !== 'structure';

describe('rock and crystal batches', () => {
  it('draw every rock and crystal exactly once, at its collider\'s position, turn and scale', () => {
    const batches = buildRocks(emptyArenaAssets(), ARENA_LAYOUT);
    const drawn = new Map<number, THREE.Matrix4>();
    for (const batch of batches) for (const member of batch.members) {
      expect(drawn.has(member.id)).toBe(false);
      drawn.set(member.id, member.matrix);
    }
    const expected = ARENA_LAYOUT.obstacles.filter(drawnRock);
    expect(drawn.size).toBe(expected.length);
    const p = new THREE.Vector3(); const q = new THREE.Quaternion(); const s = new THREE.Vector3();
    for (const o of expected) {
      if (o.shape !== 'mesh') continue;
      drawn.get(o.id)?.decompose(p, q, s);
      expect(p.distanceTo(new THREE.Vector3(o.p.x, o.p.y, o.p.z))).toBeLessThan(1e-3);
      expect(Math.abs(q.dot(new THREE.Quaternion(o.q.x, o.q.y, o.q.z, o.q.w)))).toBeCloseTo(1, 6);
      expect(s.x).toBeCloseTo(o.scale, 6); expect(s.y).toBeCloseTo(o.scale, 6); expect(s.z).toBeCloseTo(o.scale, 6);
    }
  });

  it('use the pack\'s model for each catalog shape, and the collider stand-in for a shape the pack lacks', () => {
    const assets = emptyArenaAssets();
    const first = ARENA_CATALOG[0]; if (!first) throw new Error('empty catalog');
    const packed = catalogRock(0);
    assets.colliders.set(first.key, packed);
    const batches = buildRocks(assets, ARENA_LAYOUT);
    for (const batch of batches) {
      const index = ARENA_LAYOUT.obstacles[batch.members[0]?.id ?? -1];
      if (index?.shape !== 'mesh') throw new Error('batch of a non-mesh obstacle');
      expect(batch.members.every(m => { const o = ARENA_LAYOUT.obstacles[m.id]; return o?.shape === 'mesh' && o.mesh === index.mesh; })).toBe(true);
      if (index.mesh === 0) expect(batch.model).toBe(packed);
      else expect(batch.model).not.toBe(packed);
    }
    expect(batches.some(batch => batch.model === packed)).toBe(true);
  });

  it('cull each rock by its collider\'s bounding ball', () => {
    for (const batch of buildRocks(emptyArenaAssets(), ARENA_LAYOUT)) {
      for (const member of batch.members) expect(member.radius).toBe(ARENA_LAYOUT.obstacles[member.id]?.radius);
    }
  });
});

/** Owner 2026-10-22 (items 7, 8): the cave, the station and the docks drawn exactly where they collide. */
describe('the Rift structures on the stage', () => {
  it('places one model per structure collider, at its exact position and turn, in metres', () => {
    const placed = structurePlacements(ARENA_LAYOUT);
    const colliders = ARENA_LAYOUT.obstacles.filter(o => o.kind === 'structure' && o.shape === 'mesh');
    expect(placed).toHaveLength(colliders.length);
    for (const item of placed) {
      const o = ARENA_LAYOUT.obstacles[item.id];
      if (o?.shape !== 'mesh') throw new Error('not a mesh structure');
      expect(item.key).toBe(STRUCTURE_CATALOG[o.mesh - STRUCTURE_MESH_BASE]?.key);
      expect(item.position).toEqual(o.p);
      expect(item.turn).toEqual(o.q);
    }
    const count = (key: string): number => placed.filter(item => item.key === key).length;
    expect([count('kovuk'), count('sessiz_liman'), count('iskele')]).toEqual([1, 1, ARENA_LAYOUT.exits.length]);
  });
});

/**
 * Y3 (14-yarik-plani §14.1): rock levels of detail. Measured 2026-10-22 on the 5.2 km Rift:
 * looking in from the rim drew ~650 k triangles a frame, nearly all of it rock far away.
 * Near rock — anywhere a ship can reach it soon — is always the collider itself.
 */
describe('rock levels of detail', () => {
  // Over the corners the triangles use: a crystal's rock part shares its buffer with the shards.
  const radiusOf = (geometry: THREE.BufferGeometry): number => {
    const position = geometry.getAttribute('position');
    const corners = geometry.index ? Array.from(geometry.index.array) : position.array.map((_, i) => i).slice(0, position.count);
    let r = 0;
    for (const i of corners) r = Math.max(r, Math.hypot(position.getX(i), position.getY(i), position.getZ(i)));
    return r;
  };

  it('keeps the rock\'s size with far fewer triangles, and a crystal\'s shards as they are', () => {
    ARENA_CATALOG.forEach((entry, index) => {
      const model = catalogRock(index);
      const [rock, glow] = model.parts;
      if (!rock) throw new Error('no rock part');
      const levels = rockLevels(model);
      expect(levels).toHaveLength(2);
      levels.forEach((level, i) => {
        const [lighter, shards] = level.parts;
        if (!lighter) throw new Error('no level part');
        expect(triangles(lighter.geometry)).toBeLessThanOrEqual(triangles(rock.geometry) * (i === 0 ? 0.4 : 0.15));
        // The far level may lose a spike's tip: it is drawn 2.4 km off or more, in the fog.
        expect(radiusOf(lighter.geometry)).toBeGreaterThan(radiusOf(rock.geometry) * (i === 0 ? 0.95 : 0.85));
        expect(lighter.material).toBe(rock.material);
        if (entry.family === 'crystal') expect(shards?.geometry).toBe(glow?.geometry);
      });
    });
  });

  it('draws full detail wherever a ship can reach the rock within seconds, lighter only far off', () => {
    for (const radius of [5, 40, 250]) {
      expect(rockLevel(radius + 300, radius)).toBe(0);
      expect(rockLevel(radius + 300 + radius * 5 + 1, radius)).toBeGreaterThan(0);
      expect(rockLevel(20000, radius)).toBe(2);
      let last = 0;
      for (let d = 0; d < 8000; d += 50) { const level = rockLevel(d, radius); expect(level).toBeGreaterThanOrEqual(last); last = level; }
    }
  });

  it('puts each rock of a batch in the level its distance asks for', () => {
    const model = catalogRock(0);
    model.lods = rockLevels(model);
    const at = (id: number, x: number) => ({ id, x, y: 0, z: 0, radius: 10, slot: -1, tint: null, matrix: new THREE.Matrix4().makeTranslation(x, 0, 0) });
    const batch = new RockBatch(0, model, [at(0, 100), at(1, 2000), at(2, 6000), at(3, 120)]);
    batch.cull(new THREE.Vector3(), 10000, createSandboxWorld({ bots: 0 }));
    expect(batch.levels.map(level => level[0]?.count)).toEqual([2, 1, 1]);
    expect(batch.meshes).toHaveLength(3);
  });
});

describe('the far parallax rock', () => {
  it('lies wholly beyond the boundary, so nothing drawn without a collider is ever in reach (owner item 7)', () => {
    let seed = 7;
    const random = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const ring = farRing(13000, 2000, random);
    expect(ring).toHaveLength(90);
    for (const rock of ring) expect(Math.hypot(rock.x, rock.z) - rock.scale).toBeGreaterThan(13000 + 1000);
  });
});
