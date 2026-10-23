import { describe, expect, it } from 'vitest';
import {
  closestSurface, STRUCTURE_CATALOG, structureMeshes, type ArenaLayout, type MeshObstacle, type Vec3,
} from '../../src/arena/index.js';
import type { SurfacePoint } from '../../src/arena/mesh.js';
import { layoutWith } from './helpers.js';

/**
 * Owner 2026-10-22 (items 7 and 8): caves and abandoned buildings you fly into, and nothing you
 * can fly *through* by mistake. The game collides against exactly the delivered collider; these
 * tests read it the way the simulation does (15-yarik-haritasi §3).
 */
const SHIP = 6;
/** Where a route may run: the capsule plus room to turn and pass (tunnels are 60–90 m across). */
const ROUTE_CLEAR = 25;

/** Each structure placed off the origin and turned, as a level would place it. */
function placed(key: string): { layout: ArenaLayout; to: (p: readonly [number, number, number]) => Vec3 } {
  const index = STRUCTURE_CATALOG.findIndex(e => e.key === key);
  const entry = STRUCTURE_CATALOG[index];
  const mesh = structureMeshes()[index];
  if (!entry || !mesh) throw new Error(`no ${key}`);
  // A 90° yaw about +Y: (x, y, z) → (z, y, −x).
  const q = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
  const centre = { x: 400, y: -120, z: -900 };
  const o: MeshObstacle = { id: 0, kind: 'structure', shape: 'mesh', p: centre, q, scale: entry.radius, mesh: index, radius: entry.radius * mesh.radius };
  const layout = { ...layoutWith([o], 6000, 3000), meshes: structureMeshes() };
  return { layout, to: ([x, y, z]) => ({ x: centre.x + z, y: centre.y + y, z: centre.z - x }) };
}
const surface = (): SurfacePoint => ({ x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false });
const probe = (layout: ArenaLayout, p: Vec3): SurfacePoint => {
  const out = surface();
  if (!closestSurface(layout, 0, p, Infinity, out)) throw new Error('no surface');
  return out;
};
/** Points every ≤ 8 m along a polyline. */
function samples(line: readonly (readonly [number, number, number])[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]; const b = line[i + 1];
    if (!a || !b) continue;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 8));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, a[2] + (b[2] - a[2]) * k / n]);
  }
  return out;
}

describe('the structure catalog', () => {
  it('holds the cave, the dock, the station, the heart, the wreck and its ring, Gangut, the two cliffs and the two new caves, besides the kit', () => {
    expect(STRUCTURE_CATALOG.map(e => e.key).filter(k => !k.startsWith('kit_')).sort())
      .toEqual(['enkaz', 'gangut', 'halka_harabe', 'iskele', 'kayalik_1', 'kayalik_4', 'kovuk', 'petek', 'sessiz_liman', 'yarik_kalbi', 'yarik_kanyonu']);
  });

  it('decodes each collider to one closed surface wound outwards (positive volume)', () => {
    structureMeshes().forEach(mesh => {
      const edges = new Map<string, number>();
      let volume = 0;
      for (let t = 0; t < mesh.indices.length; t += 3) {
        const v = [mesh.indices[t] ?? 0, mesh.indices[t + 1] ?? 0, mesh.indices[t + 2] ?? 0];
        for (let e = 0; e < 3; e++) {
          const a = v[e] ?? 0; const b = v[(e + 1) % 3] ?? 0;
          const key = a < b ? `${String(a)}:${String(b)}` : `${String(b)}:${String(a)}`;
          edges.set(key, (edges.get(key) ?? 0) + 1);
        }
        const p = v.map(i => [mesh.positions[i * 3] ?? 0, mesh.positions[i * 3 + 1] ?? 0, mesh.positions[i * 3 + 2] ?? 0]);
        const [a, b, c] = p as [number[], number[], number[]];
        volume += ((a[0] ?? 0) * ((b[1] ?? 0) * (c[2] ?? 0) - (b[2] ?? 0) * (c[1] ?? 0)) - (a[1] ?? 0) * ((b[0] ?? 0) * (c[2] ?? 0) - (b[2] ?? 0) * (c[0] ?? 0))
          + (a[2] ?? 0) * ((b[0] ?? 0) * (c[1] ?? 0) - (b[1] ?? 0) * (c[0] ?? 0))) / 6;
      }
      expect([...edges.values()].every(count => count === 2)).toBe(true);
      expect(volume).toBeGreaterThan(0);
    });
  });
});

describe('flying into the structures, through the game collider', () => {
  for (const key of ['kovuk', 'sessiz_liman', 'yarik_kalbi', 'enkaz']) {
    it(`${key}: every route centreline runs in open space with room to pass`, () => {
      const entry = STRUCTURE_CATALOG.find(e => e.key === key);
      const { layout, to } = placed(key);
      expect(entry?.paths.length).toBeGreaterThanOrEqual(3);
      let tightest = Infinity;
      for (const line of entry?.paths ?? []) {
        for (const p of samples(line)) {
          const s = probe(layout, to(p));
          expect(s.inside).toBe(false);
          tightest = Math.min(tightest, s.d);
        }
      }
      expect(tightest).toBeGreaterThanOrEqual(ROUTE_CLEAR + SHIP);
    });

    it(`${key}: has at least three ways in, each open in front of its mouth`, () => {
      const entry = STRUCTURE_CATALOG.find(e => e.key === key);
      const { layout, to } = placed(key);
      expect(entry?.entrances.length).toBeGreaterThanOrEqual(3);
      for (const mouth of entry?.entrances ?? []) {
        const out = to([mouth.p[0] + mouth.d[0] * 40, mouth.p[1] + mouth.d[1] * 40, mouth.p[2] + mouth.d[2] * 40]);
        expect(probe(layout, out).inside).toBe(false);
      }
    });
  }

  it('kovuk: its ore points sit on the walls — just behind each one is solid rock', () => {
    const entry = STRUCTURE_CATALOG.find(e => e.key === 'kovuk');
    const { layout, to } = placed('kovuk');
    expect(entry?.deposits.length).toBeGreaterThanOrEqual(6);
    for (const d of entry?.deposits ?? []) {
      expect(probe(layout, to([d.p[0] - d.d[0] * 6, d.p[1] - d.d[1] * 6, d.p[2] - d.d[2] * 6])).inside).toBe(true);
      expect(probe(layout, to([d.p[0] + d.d[0] * 20, d.p[1] + d.d[1] * 20, d.p[2] + d.d[2] * 20])).inside).toBe(false);
    }
  });

  it('iskele: a ship can sit on the deck — solid under it, open above', () => {
    const entry = STRUCTURE_CATALOG.find(e => e.key === 'iskele');
    const { layout, to } = placed('iskele');
    const deck = entry?.deck;
    if (!deck) throw new Error('no deck');
    expect(probe(layout, to([deck.p[0], deck.p[1] - 2, deck.p[2]])).inside).toBe(true);
    const above = probe(layout, to([deck.p[0], deck.p[1] + SHIP, deck.p[2]]));
    expect(above.inside).toBe(false);
    expect(above.d).toBeLessThan(SHIP + 0.5);
  });
});

/**
 * V6d (16-yarik-v6-plani §7, brief 4 §1): kit pieces meet port to port. A port is a 70 m square
 * opening on the 20 m grid with a flush 10 m rim; inside, every way keeps 62 m clear.
 */
describe('the station kit', () => {
  const kit = STRUCTURE_CATALOG.filter(e => e.key.startsWith('kit_'));
  const axis = (d: readonly number[]): boolean => d.filter(v => Math.abs(v) === 1).length === 1 && d.filter(v => v === 0).length === 2;

  it('lists ports only on kit pieces, cargo on kit pieces and the two rings (Gangut, Halka Harabe)', () => {
    for (const entry of STRUCTURE_CATALOG) {
      if (entry.key.startsWith('kit_')) continue;
      expect(entry.ports).toEqual([]);
      if (entry.key !== 'gangut' && entry.key !== 'halka_harabe') expect(entry.cargo).toEqual([]);
    }
  });

  for (const entry of kit) {
    it(`${entry.key}: each port sits on the grid, faces along an axis, is open in front and framed solid`, () => {
      const { layout, to } = placed(entry.key);
      for (const port of entry.ports) {
        expect(axis(port.d)).toBe(true);
        for (const v of port.p) expect(Math.abs(v % 20)).toBeLessThan(0.05);
        const front = (k: number): [number, number, number] => [port.p[0] + port.d[0] * k, port.p[1] + port.d[1] * k, port.p[2] + port.d[2] * k];
        expect(probe(layout, to(front(20))).inside).toBe(false);
        // A cap is the armoured plate that closes a port: solid right behind it.
        expect(probe(layout, to(front(-2))).inside).toBe(entry.key === 'kit_cap');
        // The rim, 40 m out from the centre in the port plane, 2 m behind it: solid wall.
        const side: [number, number, number] = port.d[1] === 0 ? [0, 40, 0] : [40, 0, 0];
        const rim = front(-2);
        expect(probe(layout, to([rim[0] + side[0], rim[1] + side[1], rim[2] + side[2]])).inside).toBe(true);
      }
    });

  }
  // Gangut (Tersane's hub) holds its farm the kit's way: a vein on a wall, a cargo bay in the ring.
  for (const entry of [...kit, ...STRUCTURE_CATALOG.filter(e => e.key === 'gangut')]) {
    it(`${entry.key}: every route keeps 62 m clear, ore veins sit on walls, cargo floats with room round it`, () => {
      const { layout, to } = placed(entry.key);
      for (const line of entry.paths) {
        for (const p of samples(line)) {
          const s = probe(layout, to(p));
          expect(s.inside).toBe(false);
          expect(s.d).toBeGreaterThanOrEqual(31);
        }
      }
      for (const d of entry.deposits) {
        expect(probe(layout, to([d.p[0] - d.d[0] * 4, d.p[1] - d.d[1] * 4, d.p[2] - d.d[2] * 4])).inside).toBe(true);
        expect(probe(layout, to([d.p[0] + d.d[0] * 20, d.p[1] + d.d[1] * 20, d.p[2] + d.d[2] * 20])).inside).toBe(false);
      }
      for (const c of entry.cargo) {
        const s = probe(layout, to(c));
        expect(s.inside).toBe(false);
        expect(s.d).toBeGreaterThanOrEqual(40);
      }
    });
  }
});
