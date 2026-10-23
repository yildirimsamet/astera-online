import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/rng.js';
import {
  ARENA_CATALOG, ARENA_LAYOUT, ARENA_SEED, arenaMeshes, ARENA_TUNING as T, buildArenaLayout, catalogMeshes, closestSurface, createFlightState,
  forwardVector, hullCandidates, hullGap, nearestObstacle, obstacleSize, openPorts, PLANS, separate, spawnFlight, STRUCTURE_CATALOG, surfaceGap, type MeshObstacle, type Vec3,
} from '../../src/arena/index.js';

const L = ARENA_LAYOUT;
const horizontal = (p: Vec3): number => Math.sqrt(p.x * p.x + p.z * p.z);
const distance = (a: Vec3, b: Vec3): number => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
/** Rock, giants and crystals: the catalog shapes (the structures are their own models). */
const shapes = L.obstacles.filter((o): o is MeshObstacle => o.shape === 'mesh' && o.kind !== 'structure');
const familyOf = (o: MeshObstacle): string | undefined => ARENA_CATALOG[o.mesh]?.family;
const giants = shapes.filter(o => familyOf(o) === 'giant');
/** A crystal vein grown on a giant: the one pair of shapes allowed to touch. */
const onGiant = (a: MeshObstacle, b: MeshObstacle): boolean =>
  (familyOf(a) === 'giant' && b.kind === 'crystal') || (familyOf(b) === 'giant' && a.kind === 'crystal');

/** Owner 2026-10-22 (items 4, 5, 7, 8): 15-yarik-haritasi §4.1. */
const kinds = (kind: string) => L.structures.filter(s => s.kind === kind);
const STRUCTURES = L.obstacles.filter((o): o is MeshObstacle => o.shape === 'mesh' && o.kind === 'structure');
const entryOf = (o: MeshObstacle) => STRUCTURE_CATALOG[o.mesh - ARENA_CATALOG.length];
/** A structure's own point (metres, its frame) in the level: turned by its quaternion, moved to it. */
function world(o: MeshObstacle, [x, y, z]: readonly [number, number, number]): Vec3 {
  const { x: qx, y: qy, z: qz, w: qw } = o.q;
  const tx = 2 * (qy * z - qz * y); const ty = 2 * (qz * x - qx * z); const tz = 2 * (qx * y - qy * x);
  return { x: o.p.x + x + qw * tx + (qy * tz - qz * ty), y: o.p.y + y + qw * ty + (qz * tx - qx * tz), z: o.p.z + z + qw * tz + (qx * ty - qy * tx) };
}

describe('arena layout v6: the Rift', () => {
  it('is generated identically on every peer from one seed', () => {
    expect(buildArenaLayout(ARENA_SEED)).toEqual(L);
    expect(buildArenaLayout(ARENA_SEED + 1).obstacles).not.toEqual(L.obstacles);
    L.obstacles.forEach((o, i) => { expect(o.id).toBe(i); });
  });

  it('is the v6 Rift: 13 km across the disc, ±2000 m high, a tank that crosses it (16-yarik-v6 §3)', () => {
    expect(T.arenaRadius).toBe(13000);
    expect(T.arenaHalfHeight).toBe(2000);
    // Rim → heart → exit at full throttle with a third of the tank left for farming.
    const burn = T.idleBurn + T.throttleBurn;
    expect((12500 + 10000) / T.speedMax * burn).toBeLessThan(T.fuelTank * 2 / 3);
    expect(L.radius).toBe(T.arenaRadius);
    expect(L.halfHeight).toBe(T.arenaHalfHeight);
  });

  it('has twelve ways in on the rim and four exits on the 10 km ring, every entry ≥ 2500 m from every exit', () => {
    expect(L.entries).toHaveLength(12);
    expect(L.exits).toHaveLength(4);
    for (const entry of L.entries) expect(horizontal(entry)).toBeGreaterThan(12000);
    for (const exit of L.exits) expect(Math.abs(horizontal(exit) - 10000)).toBeLessThan(300);
    for (const p of [...L.entries, ...L.exits]) expect(Math.abs(p.y)).toBeLessThan(T.arenaHalfHeight - 100);
    for (const entry of L.entries) for (const exit of L.exits) expect(distance(entry, exit)).toBeGreaterThanOrEqual(2500);
  });

  it('keeps every collider inside the boundary and never stacks two rocks into each other', () => {
    for (const o of L.obstacles) {
      expect(horizontal(o.p) + o.radius).toBeLessThanOrEqual(T.arenaRadius);
      expect(Math.abs(o.p.y) + o.radius).toBeLessThanOrEqual(T.arenaHalfHeight);
    }
    // Sweep along x: only pairs whose x gap is under the two radii can touch.
    const byX = [...shapes].sort((a, b) => a.p.x - b.p.x);
    const widest = Math.max(...shapes.map(o => o.radius));
    for (let i = 0; i < byX.length; i++) {
      const a = byX[i];
      if (!a) continue;
      for (let j = i + 1; j < byX.length; j++) {
        const b = byX[j];
        if (!b || b.p.x - a.p.x > a.radius + widest) break;
        if (onGiant(a, b)) continue;
        if (distance(a.p, b.p) < a.radius + b.radius) expect(distance(a.p, b.p)).toBeGreaterThanOrEqual(a.radius + b.radius);
      }
    }
  });

  it('keeps entrances clear so nobody is born inside a rock', () => {
    for (const entry of L.entries) {
      for (const o of L.obstacles) expect(distance(entry, o.p) - o.radius).toBeGreaterThanOrEqual(T.spawnClear);
    }
  });

  it('stands every exit on a dock: its deck right under the exit point, level, and nothing else in the zone', () => {
    const docks = kinds('dock');
    expect(docks).toHaveLength(4);
    const near = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
    for (const exit of L.exits) {
      const dock = docks.find(d => distance(d.p, exit) < 120);
      const index = dock?.colliders[0] ?? -1;
      expect(closestSurface(L, index, exit, Infinity, near)).toBe(true);
      expect(near.inside).toBe(false);
      expect(near.d).toBeCloseTo(T.shipHitRadius, 0);
      expect(near.ny).toBeGreaterThan(0.95);
      for (const o of L.obstacles) {
        if (o.id === index) continue;
        expect(distance(exit, o.p) - o.radius).toBeGreaterThan(T.exitRadius);
      }
    }
  });

  it('builds the heart, the cave, the station and the wreck; no box hangars, relays or gate pylons', () => {
    expect(kinds('hub')).toHaveLength(1);
    expect(kinds('cave')).toHaveLength(1);
    expect(kinds('station')).toHaveLength(1);
    expect(kinds('wreck')).toHaveLength(1);
    expect(L.structures.map(s => s.kind).every(k => ['hub', 'cave', 'canyon', 'honeycomb', 'station', 'wreck', 'dock', 'outpost', 'refinery', 'annex', 'yard'].includes(k))).toBe(true);
    // Owner item 7: nothing you fly through. Every structure is one closed delivered model.
    expect(L.obstacles.some(o => o.shape === 'box')).toBe(false);
    const modelOf = (kind: string) => kinds(kind).map(s => s.colliders.map(id => L.obstacles[id]).map(o => (o?.shape === 'mesh' ? entryOf(o)?.key : undefined)));
    expect(modelOf('hub')).toEqual([['yarik_kalbi']]);
    expect(modelOf('wreck')).toEqual([['enkaz', 'halka_harabe']]);
    expect(horizontal(kinds('hub')[0]?.p ?? { x: 9, y: 0, z: 0 })).toBe(0);
    for (const key of ['kovuk', 'sessiz_liman', 'iskele']) expect(STRUCTURES.some(o => entryOf(o)?.key === key)).toBe(true);
  });

  it('rings the heart with its districts 4–6 km out, 60° apart, on different levels', () => {
    const cave = kinds('cave')[0]; const station = kinds('station')[0]; const wreck = kinds('wreck')[0];
    expect(cave?.p.y).toBeGreaterThan(250);
    expect(station?.p.y).toBeLessThan(-250);
    const sites = [cave, station, wreck].map(s => s?.p ?? { x: 0, y: 0, z: 0 });
    for (const p of sites) expect(horizontal(p)).toBeGreaterThan(4000);
    for (const p of sites) expect(horizontal(p)).toBeLessThan(6500);
    for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) {
      expect(distance(sites[i] ?? { x: 0, y: 0, z: 0 }, sites[j] ?? { x: 0, y: 0, z: 0 })).toBeGreaterThan(4000);
    }
    // Every exit lies out beyond the middle ring, 4–6.5 km from the nearest district.
    const belt = L.fields.find(f => f.dense && f.radius >= 700)?.p ?? { x: 0, y: 0, z: 0 };
    for (const exit of L.exits) expect(Math.min(...[...sites, belt].map(p => distance(exit, p)))).toBeLessThan(6500);
  });

  // 16-yarik-v6 §4: Enkaz Mezarlığı is the broken warship and, beside it, the broken ring.
  it('lays the broken ring beside the wreck: its way through and both ends clear, its cargo a farm spot', () => {
    const [wreck] = kinds('wreck');
    if (!wreck) throw new Error('no wreck');
    const parts = wreck.colliders.map(id => L.obstacles[id]).filter((o): o is MeshObstacle => o?.shape === 'mesh');
    const ring = parts.find(o => entryOf(o)?.key === 'halka_harabe');
    const hull = parts.find(o => entryOf(o)?.key === 'enkaz');
    if (!ring || !hull) throw new Error('no ring or hull');
    const contact = { index: -1, depth: 0, nx: 0, ny: 0, nz: 0 };
    expect(distance(ring.p, hull.p)).toBeGreaterThan(ring.radius + hull.radius + 100);
    expect(distance(ring.p, hull.p)).toBeLessThan(1200);
    for (const mouth of entryOf(ring)?.entrances ?? []) {
      for (let k = 0; k <= 150; k += 10) {
        const p = world(ring, [mouth.p[0] + mouth.d[0] * k, mouth.p[1] + mouth.d[1] * k, mouth.p[2] + mouth.d[2] * k]);
        expect(nearestObstacle(L, p, 31, contact), `ring mouth at ${JSON.stringify(p)}`).toBe(-1);
      }
    }
    const cargo = (entryOf(ring)?.cargo ?? []).map(c => world(ring, c));
    expect(cargo.length).toBeGreaterThan(0);
    for (const c of cargo) expect(L.farmSpots.some(p => distance(p, c) < 0.01)).toBe(true);
  });

  // Brief 3: two more caves that chase differently from Kovuk, so where to flee is a decision.
  it('sets Yarık Kanyonu in the crystal belt\'s heart and Petek on its held site, main ends to the heart, every way in clear', () => {
    const one = (kind: string, key: string): MeshObstacle => {
      const found = kinds(kind);
      expect(found, kind).toHaveLength(1);
      const [o] = (found[0]?.colliders ?? []).map(id => L.obstacles[id]).filter((c): c is MeshObstacle => c?.shape === 'mesh');
      if (!o || entryOf(o)?.key !== key) throw new Error(`${kind} is not ${key}`);
      return o;
    };
    const canyon = one('canyon', 'yarik_kanyonu');
    const comb = one('honeycomb', 'petek');
    // The canyon sits in Kristal Kuşağı (300°, 5.2 km); Petek on the site held at 180°.
    expect(distance(canyon.p, { x: 2600, y: 0, z: -4503.3 })).toBeLessThan(150);
    expect(distance(comb.p, { x: -5200, y: 100, z: 0 })).toBeLessThan(150);
    const contact = { index: -1, depth: 0, nx: 0, ny: 0, nz: 0 };
    for (const o of [canyon, comb]) {
      const entry = entryOf(o);
      // The main end (+Z) looks at the heart.
      const [front] = entry?.entrances ?? [];
      if (!front) throw new Error('no front');
      const tip = world(o, front.d); const d = { x: tip.x - o.p.x, z: tip.z - o.p.z };
      expect((-d.x * o.p.x - d.z * o.p.z) / horizontal(o.p)).toBeGreaterThan(0.95);
      for (const mouth of entry?.entrances ?? []) {
        for (let k = 0; k <= 150; k += 10) {
          const p = world(o, [mouth.p[0] + mouth.d[0] * k, mouth.p[1] + mouth.d[1] * k, mouth.p[2] + mouth.d[2] * k]);
          expect(nearestObstacle(L, p, 31, contact), `${entry?.key ?? '?'} mouth at ${JSON.stringify(p)}`).toBe(-1);
        }
      }
    }
    // Crystal on the canyon walls: veins grow at its ore points.
    const ore = (entryOf(canyon)?.deposits ?? []).map(d => world(canyon, d.p));
    expect(ore.length).toBeGreaterThanOrEqual(6);
    const crystals = shapes.filter(o => o.kind === 'crystal');
    expect(ore.filter(p => crystals.some(c => distance(c.p, p) < 40)).length).toBeGreaterThanOrEqual(4);
  });

  it('keeps an open lane from the heart to every district: the fast, visible way (owner item 8, §4)', () => {
    const contact = { index: -1, depth: 0, nx: 0, ny: 0, nz: 0 };
    const belt = L.fields.find(f => f.dense && f.radius >= 700);
    const ends: [Vec3, number][] = [
      ...['station', 'cave', 'wreck', 'yard'].map(kind => { const s = kinds(kind)[0]; return [s?.p ?? { x: 0, y: 0, z: 0 }, (s?.scale ?? 0) + 120] as [Vec3, number]; }),
      [belt?.p ?? { x: 0, y: 0, z: 0 }, belt?.radius ?? 0],
    ];
    expect(ends.every(([p]) => horizontal(p) > 2000)).toBe(true);
    for (const [end, short] of ends) {
      const length = distance(end, { x: 0, y: 0, z: 0 });
      for (let d = 450; d < length - short; d += 25) {
        const p = { x: end.x * d / length, y: end.y * d / length, z: end.z * d / length };
        expect(nearestObstacle(L, p, 100, contact), `lane at ${JSON.stringify(p)}`).toBe(-1);
      }
    }
  });

  it('leaves every route through the cave and the station clear of every collider in the level', () => {
    const contact = { index: -1, depth: 0, nx: 0, ny: 0, nz: 0 };
    let checked = 0;
    // A kit port closed by a cap is a dead end, not a route: its plate sits at the cap's origin.
    const caps = STRUCTURES.filter(o => entryOf(o)?.key === 'kit_cap').map(o => o.p);
    const capped = (point: readonly [number, number, number] | undefined, o: MeshObstacle): boolean =>
      point !== undefined && caps.some(c => distance(c, world(o, point)) < 1);
    for (const o of STRUCTURES) {
      const entry = entryOf(o);
      for (const line of entry?.paths ?? []) {
        if (capped(line[0], o) || capped(line[line.length - 1], o)) continue;
        for (let i = 0; i + 1 < line.length; i++) {
          const a = line[i]; const b = line[i + 1];
          if (!a || !b) continue;
          const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 10));
          for (let k = 0; k < n; k++) {
            const p = world(o, [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, a[2] + (b[2] - a[2]) * k / n]);
            expect(nearestObstacle(L, p, 31, contact), `route of ${entry?.key ?? '?'} at ${JSON.stringify(p)}`).toBe(-1);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('veins the cave\'s ore points with crystal deposits you mine inside', () => {
    const cave = STRUCTURES.find(o => entryOf(o)?.key === 'kovuk');
    if (!cave) throw new Error('no cave');
    const inside = L.deposits.filter((index, slot) => {
      const o = L.obstacles[index];
      return L.depositKinds[slot] === 1 && o !== undefined && distance(o.p, cave.p) < cave.radius;
    });
    expect(inside.length).toBeGreaterThanOrEqual(6);
  });

  it('mixes dense belts, sparse rock and mineable crystal formations', () => {
    const rocks = shapes.filter(o => o.kind === 'rock');
    expect(rocks.length).toBeGreaterThanOrEqual(700);
    const crystals = L.deposits.filter((_, i) => L.depositKinds[i] === 1);
    expect(crystals.length).toBeGreaterThanOrEqual(30);
    for (const index of crystals) expect(L.obstacles[index]?.kind).toBe('crystal');
    const dense = L.fields.filter(f => f.dense);
    expect(dense.length).toBeGreaterThanOrEqual(3);
    const inside = (p: Vec3): boolean => dense.some(f => distance(p, f.p) < f.radius);
    const denseVolume = dense.reduce((sum, f) => sum + 4 / 3 * Math.PI * f.radius * f.radius * f.height, 0);
    const total = Math.PI * T.arenaRadius * T.arenaRadius * 2 * T.arenaHalfHeight;
    const inDense = shapes.filter(o => inside(o.p)).length;
    expect(inDense / denseVolume).toBeGreaterThan(4 * (shapes.length - inDense) / (total - denseVolume));
    expect(crystals.filter(i => { const c = L.obstacles[i]; return c !== undefined && inside(c.p); }).length).toBeGreaterThan(0);
  });

  it('makes the heart the richest place to farm, and leaves quiet pockets far out (16-yarik-v6 §6)', () => {
    expect(L.farmSpots.length).toBe(T.farmSpots);
    const heart = L.farmSpots.filter(p => horizontal(p) < 2000).length;
    const frontier = L.farmSpots.filter(p => horizontal(p) > 7000);
    expect(heart / L.farmSpots.length).toBeGreaterThan(0.2);
    // Per square kilometre the heart is many times richer than the frontier.
    const heartArea = Math.PI * 2 * 2; const frontierArea = Math.PI * (12.5 * 12.5 - 7 * 7);
    expect(heart / heartArea).toBeGreaterThan(6 * frontier.length / frontierArea);
    // A frontier spot is a pocket: rock all round it to farm behind, or a room in an outpost.
    expect(frontier.length / L.farmSpots.length).toBeGreaterThan(0.25);
    const rooms = kinds('outpost').flatMap(b => b.colliders.map(id => L.obstacles[id]));
    const sheltered = frontier.filter(p => shapes.filter(o => o.kind === 'rock' && distance(o.p, p) < 220).length >= 6
      || rooms.some(o => o !== undefined && distance(o.p, p) < 1));
    expect(sheltered.length / frontier.length).toBeGreaterThan(0.8);
  });

  it('spawns reproducibly at an entrance, facing horizontally towards the centre', () => {
    const randomA = mulberry32(23);
    const randomB = mulberry32(23);
    const forward = { x: 0, y: 0, z: 0 };
    const observed = new Set<number>();
    for (let i = 0; i < 200; i++) {
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
    expect(observed.size).toBe(L.entries.length);
  });
});

/**
 * V6d (16-yarik-v6-plani §6–7): buildings put together from the station kit. Each piece is its
 * own collider; a plan is closed when every port meets another piece's port or a cap.
 */
describe('arena layout v6: kit buildings', () => {
  const pieces = (kind: string): MeshObstacle[] => kinds(kind).flatMap(s => s.colliders.map(id => L.obstacles[id]))
    .filter((o): o is MeshObstacle => o?.shape === 'mesh');
  const contact = { index: -1, depth: 0, nx: 0, ny: 0, nz: 0 };

  it('closes every plan: each port meets exactly one port facing it', () => {
    for (const plan of Object.values(PLANS)) expect(openPorts(plan, STRUCTURE_CATALOG), plan.key).toEqual([]);
  });

  it('stands eight outposts in the frontier, apart, each with two ways in (§4)', () => {
    const outposts = kinds('outpost');
    expect(outposts).toHaveLength(8);
    for (const o of outposts) {
      expect(horizontal(o.p)).toBeGreaterThan(7500);
      expect(horizontal(o.p)).toBeLessThan(11500);
      expect(o.colliders.map(id => L.obstacles[id]).filter(c => c?.shape === 'mesh' && entryOf(c)?.key === 'kit_mouth')).toHaveLength(2);
      for (const other of outposts) if (other !== o) expect(distance(o.p, other.p)).toBeGreaterThan(3000);
      for (const d of L.dust) expect(distance(o.p, d.p)).toBeGreaterThan(d.radius + 600);
    }
  });

  // 16-yarik-v6 §2: six giant cliffs out in the frontier, each split by one deep crack to hide in.
  it('raises six giant cliffs in the frontier, both scans, apart from every building, their cracks open', () => {
    const cliffs = STRUCTURES.filter(o => entryOf(o)?.key.startsWith('kayalik_') ?? false);
    expect(cliffs).toHaveLength(6);
    expect(new Set(cliffs.map(o => entryOf(o)?.key))).toEqual(new Set(['kayalik_1', 'kayalik_4']));
    const exits = kinds('dock').map(s => s.p);
    const buildings = [...kinds('outpost'), ...kinds('annex'), ...kinds('yard'), ...kinds('cave'), ...kinds('station'), ...kinds('wreck')].map(s => s.p);
    for (const o of cliffs) {
      expect(horizontal(o.p)).toBeGreaterThan(7500);
      expect(horizontal(o.p) + o.radius).toBeLessThan(T.arenaRadius);
      for (const other of cliffs) if (other !== o) expect(distance(o.p, other.p)).toBeGreaterThan(3000);
      for (const p of [...exits, ...buildings]) expect(distance(o.p, p)).toBeGreaterThan(o.radius + 1500);
      for (const d of L.dust) expect(distance(o.p, d.p)).toBeGreaterThan(d.radius + o.radius + 600);
      // Nothing sits in front of either end of the crack: the way in is as clear as a kit mouth's.
      for (const mouth of entryOf(o)?.entrances ?? []) {
        for (let k = 0; k <= 150; k += 10) {
          const p = world(o, [mouth.p[0] + mouth.d[0] * k, mouth.p[1] + mouth.d[1] * k, mouth.p[2] + mouth.d[2] * k]);
          expect(nearestObstacle(L, p, 31, contact), `crack mouth at ${JSON.stringify(p)}`).toBe(-1);
        }
      }
    }
  });

  it('leaves half the outposts in ruin: a collapsed room behind a breached corridor, a third way in', () => {
    const keys = kinds('outpost').map(o => o.colliders.map(id => { const c = L.obstacles[id]; return c?.shape === 'mesh' ? entryOf(c)?.key : undefined; }));
    const ruins = keys.filter(k => k.includes('kit_room_collapsed'));
    expect(ruins).toHaveLength(4);
    for (const k of ruins) {
      expect(k).toContain('kit_corridor_broken');
      expect(k).not.toContain('kit_room');
    }
  });

  it('docks the harbour annex beside Sessiz Liman, off its lane: two farm rooms, three mouths and a breach (§7)', () => {
    const annexes = kinds('annex');
    expect(annexes).toHaveLength(1);
    const [annex] = annexes; const [station] = kinds('station');
    if (!annex || !station) throw new Error('missing annex or station');
    expect(distance(annex.p, station.p)).toBeGreaterThan(1000);
    expect(distance(annex.p, station.p)).toBeLessThan(2500);
    // Off the heart's lane to the harbour: past 300 m from the line, so the farm stays hidden.
    const along = (annex.p.x * station.p.x + annex.p.z * station.p.z) / horizontal(station.p);
    expect(Math.sqrt(horizontal(annex.p) ** 2 - along ** 2)).toBeGreaterThan(300);
    const keys = annex.colliders.map(id => { const c = L.obstacles[id]; return c?.shape === 'mesh' ? entryOf(c)?.key : undefined; });
    expect(keys.filter(k => k === 'kit_mouth')).toHaveLength(3);
    for (const key of ['kit_tee', 'kit_room', 'kit_room_collapsed', 'kit_corridor_broken']) expect(keys).toContain(key);
  });

  it('dresses every kit building: a dressing piece stands on a roof, its base on the host\'s top', () => {
    for (const b of [...kinds('outpost'), ...kinds('refinery'), ...kinds('annex'), ...kinds('yard')]) {
      const parts = b.colliders.map(id => L.obstacles[id]).filter((o): o is MeshObstacle => o?.shape === 'mesh');
      const dressing = parts.filter(o => entryOf(o)?.key.startsWith('kit_dressing_'));
      expect(dressing.length, b.kind).toBeGreaterThanOrEqual(1);
      // Standing on something: its base is sunk into the roof, so a metre above it is inside
      // another piece of the building, not in the air.
      for (const d of dressing) {
        const below = { x: d.p.x, y: d.p.y + 1, z: d.p.z };
        expect(parts.some(o => o !== d && surfaceGap(L, o.id, below) <= 0), `${b.kind} ${entryOf(d)?.key ?? ''}`).toBe(true);
      }
    }
  });

  it('raises Tersane on its held site, high: Gangut\'s ring, its way through on the heart line, a depot wing each side (§4)', () => {
    const yards = kinds('yard');
    expect(yards).toHaveLength(1);
    const [yard] = yards;
    if (!yard) throw new Error('no yard');
    expect(horizontal(yard.p)).toBeGreaterThan(4500);
    expect(horizontal(yard.p)).toBeLessThan(5500);
    expect(yard.p.y).toBeGreaterThan(150);
    const parts = yard.colliders.map(id => L.obstacles[id]).filter((o): o is MeshObstacle => o?.shape === 'mesh');
    const keys = parts.map(o => entryOf(o)?.key);
    expect(keys.filter(k => k === 'gangut')).toHaveLength(1);
    for (const key of ['kit_hall', 'kit_hangar', 'kit_tower_top']) expect(keys.filter(k => k === key), key).toHaveLength(2);
    expect(keys.filter(k => k === 'kit_mouth')).toHaveLength(4);
    const gangut = parts.find(o => entryOf(o)?.key === 'gangut');
    if (!gangut) throw new Error('no gangut');
    // Its first way in looks at the heart: the open lane runs straight through the hub.
    const [front] = entryOf(gangut)?.entrances ?? [];
    if (!front) throw new Error('gangut has no entrance');
    const tip = world(gangut, front.d); const d = { x: tip.x - gangut.p.x, z: tip.z - gangut.p.z };
    expect((-d.x * gangut.p.x - d.z * gangut.p.z) / horizontal(gangut.p)).toBeGreaterThan(0.95);
    for (const hall of parts.filter(o => entryOf(o)?.key === 'kit_hall')) {
      expect(distance(hall.p, gangut.p)).toBeGreaterThan(350);
      expect(distance(hall.p, gangut.p)).toBeLessThan(700);
    }
  });

  it('keeps the way in front of every kit way in (mouth, hangar maw, tower well) and Gangut\'s open for 150 m', () => {
    const mouths = L.obstacles.filter((o): o is MeshObstacle => o.shape === 'mesh' && ((entryOf(o)?.key.startsWith('kit_') ?? false) || entryOf(o)?.key === 'gangut'));
    expect(mouths.filter(o => entryOf(o)?.key === 'kit_mouth').length).toBeGreaterThanOrEqual(16);
    for (const o of mouths) {
      for (const mouth of entryOf(o)?.entrances ?? []) {
        for (let k = 0; k <= 150; k += 10) {
          const p = world(o, [mouth.p[0] + mouth.d[0] * k, mouth.p[1] + mouth.d[1] * k, mouth.p[2] + mouth.d[2] * k]);
          expect(nearestObstacle(L, p, 31, contact), `mouth at ${JSON.stringify(p)}`).toBe(-1);
        }
      }
    }
  });

  it('rings the heart with three refinery wings on three levels, each with four ways in (§4)', () => {
    const wings = kinds('refinery');
    expect(wings).toHaveLength(3);
    for (const w of wings) {
      expect(horizontal(w.p)).toBeGreaterThan(500);
      expect(horizontal(w.p)).toBeLessThan(1200);
      const keys = w.colliders.map(id => { const o = L.obstacles[id]; return o?.shape === 'mesh' ? entryOf(o)?.key : undefined; });
      expect(keys.filter(k => k === 'kit_mouth').length).toBeGreaterThanOrEqual(2);
      expect(keys).toContain('kit_hall');
      expect(keys).toContain('kit_hangar');
      expect(keys).toContain('kit_tower_top');
    }
    const levels = wings.map(w => w.p.y).sort((a, b) => a - b);
    expect((levels[1] ?? 0) - (levels[0] ?? 0)).toBeGreaterThanOrEqual(250);
    expect((levels[2] ?? 0) - (levels[1] ?? 0)).toBeGreaterThanOrEqual(250);
  });

  it('keeps half the heart\'s farm inside the wings, half out in the open (§6)', () => {
    const heart = L.farmSpots.filter(p => horizontal(p) < 2000);
    const cargo = pieces('refinery').flatMap(o => (entryOf(o)?.cargo ?? []).map(c => world(o, c)));
    const inside = heart.filter(p => cargo.some(c => distance(p, c) < 0.01)).length;
    expect(inside).toBeGreaterThanOrEqual(15);
    expect(heart.length - inside).toBeGreaterThanOrEqual(15);
  });

  it('farms inside: every cargo point is a farm spot, and the ore points grow crystals', () => {
    const inside = [...pieces('outpost'), ...pieces('refinery'), ...pieces('annex'), ...pieces('yard')];
    const cargo = inside.flatMap(o => (entryOf(o)?.cargo ?? []).map(c => world(o, c)));
    expect(cargo.length).toBeGreaterThanOrEqual(8);
    for (const c of cargo) expect(L.farmSpots.some(p => distance(p, c) < 0.01)).toBe(true);
    const ore = inside.flatMap(o => (entryOf(o)?.deposits ?? []).map(d => world(o, d.p)));
    expect(ore.length).toBeGreaterThanOrEqual(8);
    const crystals = L.deposits.filter((_, slot) => L.depositKinds[slot] === 1).map(i => L.obstacles[i]);
    const grown = ore.filter(p => crystals.some(c => c !== undefined && distance(c.p, p) < 30));
    expect(grown.length / ore.length).toBeGreaterThan(0.75);
  });
});

/** Y2: rocks are the scanned shapes the client draws, turned and scaled; they collide as drawn. */
describe('arena layout v5: mesh rock', () => {
  it('draws every rock, giant and crystal from its catalog family, turned by a unit quaternion', () => {
    expect(L.version).toBe(5);
    expect(L.meshes.slice(0, ARENA_CATALOG.length)).toEqual(catalogMeshes());
    expect(L.meshes).toBe(arenaMeshes());
    for (const o of L.obstacles) {
      if (o.kind === 'structure') continue;
      expect(o.shape).toBe('mesh');
    }
    for (const o of shapes) {
      const mesh = L.meshes[o.mesh];
      expect(mesh).toBeDefined();
      expect(Math.hypot(o.q.x, o.q.y, o.q.z, o.q.w)).toBeCloseTo(1, 12);
      expect(o.radius).toBeCloseTo(o.scale * (mesh?.radius ?? 0), 9);
      if (o.kind === 'crystal') expect(familyOf(o)).toBe('crystal');
      else expect(['rock', 'giant']).toContain(familyOf(o));
    }
    expect(giants.length).toBeGreaterThanOrEqual(4);
    for (const g of giants) expect(g.scale * (L.meshes[g.mesh]?.mean ?? 0)).toBeGreaterThan(100);
    // Shapes are spread, not one rock copied: every catalog shape is used.
    expect(new Set(shapes.map(o => o.mesh)).size).toBe(ARENA_CATALOG.length);
  });

  it('keeps the drawn surface on the collider within half a metre at the largest scale', () => {
    // The model and the collider share quantised corners; what remains is int16 rounding.
    const largest = Math.max(...shapes.map(o => o.scale));
    expect(largest * Math.sqrt(3) * 0.5 / 32767).toBeLessThan(0.5);
  });

  it('grows the giants\' crystal veins out of their real surface, shards outwards', () => {
    const near = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
    let veins = 0;
    for (const g of giants) {
      for (const c of shapes) {
        if (c.kind !== 'crystal' || distance(c.p, g.p) > c.radius + g.radius) continue;
        veins++;
        expect(closestSurface(L, g.id, c.p, Infinity, near)).toBe(true);
        // The crystal's centre sits just off the rock, its base sunk into it.
        const size = c.scale * (L.meshes[c.mesh]?.mean ?? 0);
        expect(near.inside).toBe(false);
        expect(near.d).toBeLessThan(size);
        // Its shards (the glow end) point away from the giant.
        const entry = ARENA_CATALOG[c.mesh]; const mesh = L.meshes[c.mesh];
        if (!entry || !mesh) continue;
        let gx = 0; let gy = 0; let gz = 0;
        for (let t = entry.glowFrom * 3; t < mesh.indices.length; t++) {
          const v = (mesh.indices[t] ?? 0) * 3;
          gx += mesh.positions[v] ?? 0; gy += mesh.positions[v + 1] ?? 0; gz += mesh.positions[v + 2] ?? 0;
        }
        const q = c.q;
        const wx = (1 - 2 * (q.y * q.y + q.z * q.z)) * gx + 2 * (q.x * q.y - q.w * q.z) * gy + 2 * (q.x * q.z + q.w * q.y) * gz;
        const wy = 2 * (q.x * q.y + q.w * q.z) * gx + (1 - 2 * (q.x * q.x + q.z * q.z)) * gy + 2 * (q.y * q.z - q.w * q.x) * gz;
        const wz = 2 * (q.x * q.z - q.w * q.y) * gx + 2 * (q.y * q.z + q.w * q.x) * gy + (1 - 2 * (q.x * q.x + q.y * q.y)) * gz;
        expect((wx * near.nx + wy * near.ny + wz * near.nz) / Math.hypot(wx, wy, wz)).toBeGreaterThan(0.7);
      }
    }
    expect(veins).toBeGreaterThanOrEqual(giants.length * 2);
  });

  it('measures the gap to a rock\'s real surface, not to its bounding ball', () => {
    const near = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
    for (const o of [...shapes.slice(0, 30), ...giants]) {
      expect(obstacleSize(L, o)).toBeCloseTo(o.scale * (L.meshes[o.mesh]?.mean ?? 0), 9);
      const from = { x: o.p.x + o.radius * 2, y: o.p.y, z: o.p.z };
      expect(closestSurface(L, o.id, from, Infinity, near)).toBe(true);
      const gap = surfaceGap(L, o.id, from);
      expect(gap).toBeCloseTo(near.d, 9);
      // The bounding ball is the nearest the surface can be; a real rock is usually further.
      expect(gap).toBeGreaterThanOrEqual(o.radius - 1e-9);
      expect(surfaceGap(L, o.id, from, gap - 1)).toBe(Infinity);
      // Just under a rock's surface is inside: no gap. (A shard tip is sharper than a right angle:
      // stepping back along the approach can come out through its other face.)
      if (o.kind === 'rock') expect(surfaceGap(L, o.id, { x: near.x - near.nx * 0.2, y: near.y - near.ny * 0.2, z: near.z - near.nz * 0.2 })).toBe(0);
    }
  });

  it('lets a hull pass 1 m off a real rock and stops it on touch', () => {
    const near = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
    const contact = { index: -1, depth: 0, nx: 0, ny: 0, nz: 0 };
    const candidates: number[] = [];
    const ship = createFlightState();
    // Not the veins on Kovuk's walls: "above" one of those is inside the cave's own rock.
    const cave = kinds('cave')[0];
    const loose = shapes.filter(o => !cave || distance(o.p, cave.p) > cave.scale);
    for (const o of [...loose.slice(0, 24), ...giants]) {
      // Approach from above the rock, along the surface normal there.
      const from = { x: o.p.x, y: o.p.y + o.radius * 1.5, z: o.p.z };
      expect(closestSurface(L, o.id, from, Infinity, near)).toBe(true);
      const at = (gap: number): void => {
        ship.p.x = near.x + near.nx * (T.bodyRadius + gap); ship.p.y = near.y + near.ny * (T.bodyRadius + gap); ship.p.z = near.z + near.nz * (T.bodyRadius + gap);
      };
      // Find where the hull itself is 1 m off (the nose or a wing may reach nearer than the belly).
      let lo = -T.bodyLength; let hi: number = T.bodyLength;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; at(mid); if (hullGap(L, o.id, ship.p, ship.q, T) < 1) lo = mid; else hi = mid; }
      at(hi);
      const clear = { ...ship.p };
      const count = hullCandidates(L, ship.p, 0, T, candidates);
      const others = candidates.slice(0, count).filter(i => i !== o.id);
      if (others.some(i => hullGap(L, i, ship.p, ship.q, T) < 1)) continue;
      expect(separate(ship.p, ship.q, L, candidates, count, T, contact)).toBe(false);
      expect(ship.p).toEqual(clear);
      at(hi - 1.3);
      const touching = hullCandidates(L, ship.p, 0, T, candidates);
      expect(separate(ship.p, ship.q, L, candidates, touching, T, contact)).toBe(true);
      expect(hullGap(L, o.id, ship.p, ship.q, T)).toBeGreaterThanOrEqual(-1e-6);
    }
  });
});
