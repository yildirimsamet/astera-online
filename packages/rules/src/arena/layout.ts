import { mulberry32 } from '../rng.js';
import type { Rng } from '../types.js';
import { ARENA_CATALOG, catalogMeshes, type CatalogFamily } from './catalog.js';
import { blueprintPoses, type Blueprint } from './blueprints.js';
import { PLANS } from './plans.js';
import { arenaMeshes, STRUCTURE_CATALOG, STRUCTURE_MESH_BASE } from './structures.js';
import { closestSurface } from './collision.js';
import type { SurfacePoint } from './mesh.js';
import { ARENA_TUNING as T } from './tuning.js';
import type { ArenaDust, ArenaField, ArenaLayout, ArenaObstacle, ArenaStructure, FlightState, MeshObstacle, Quaternion, StructureKind, Vec3 } from './types.js';

export const ARENA_SEED = 20261008;

// Unit directions every 30°, written out: the shared simulation never calls trig.
const S3 = 0.8660254037844386;
const DIRECTION: Readonly<Record<number, readonly [number, number]>> = {
  0: [1, 0], 30: [S3, 0.5], 60: [0.5, S3], 90: [0, 1], 120: [-0.5, S3], 150: [-S3, 0.5],
  180: [-1, 0], 210: [-S3, -0.5], 240: [-0.5, -S3], 270: [0, -1], 300: [0.5, -S3], 330: [S3, -0.5],
};
const at = (angle: number, radius: number, y: number): Vec3 => {
  const [x, z] = DIRECTION[angle] ?? [1, 0];
  return { x: x * radius, y, z: z * radius };
};
const C15 = 0.9659258262890683; const S15 = 0.25881904510252074;
/** `at`, turned a further 15°: the half-way directions. */
const atHalf = (angle: number, radius: number, y: number): Vec3 => {
  const p = at(angle, radius, y);
  return { x: p.x * C15 - p.z * S15, y, z: p.x * S15 + p.z * C15 };
};

interface Zone { p: Vec3; radius: number }

/** How big an obstacle looks: a rock's mean radius in metres, a sphere's or box's own radius. */
export function obstacleSize(layout: ArenaLayout, o: ArenaObstacle): number {
  return o.shape === 'mesh' ? o.scale * (layout.meshes[o.mesh]?.mean ?? 1) : o.radius;
}

/** Mesh-space direction from a crystal's centre to its shards: the end that grows outwards. */
function glowAxis(index: number): Vec3 {
  const entry = ARENA_CATALOG[index]; const mesh = catalogMeshes()[index];
  const axis = { x: 0, y: 0, z: 0 };
  if (!entry || !mesh) return axis;
  for (let t = entry.glowFrom * 3; t < mesh.indices.length; t++) {
    const v = (mesh.indices[t] ?? 0) * 3;
    axis.x += mesh.positions[v] ?? 0; axis.y += mesh.positions[v + 1] ?? 0; axis.z += mesh.positions[v + 2] ?? 0;
  }
  const length = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
  if (length > 0) { axis.x /= length; axis.y /= length; axis.z /= length; }
  return axis;
}

/** The yaw that turns local +Z onto the horizontal unit direction (fx, fz). Half-angle by square root. */
function yawTo(fx: number, fz: number): Quaternion {
  if (fz < -0.999999999) return { x: 0, y: 1, z: 0, w: 0 };
  const w = Math.sqrt((1 + fz) / 2);
  return { x: 0, y: fx / (2 * w), z: 0, w };
}
/** v turned by q (unit). */
function rotate(q: Quaternion, x: number, y: number, z: number): Vec3 {
  const tx = 2 * (q.y * z - q.z * y); const ty = 2 * (q.z * x - q.x * z); const tz = 2 * (q.x * y - q.y * x);
  return { x: x + q.w * tx + (q.y * tz - q.z * ty), y: y + q.w * ty + (q.z * tx - q.x * tz), z: z + q.w * tz + (q.x * ty - q.y * tx) };
}

/**
 * Builds the whole arena from one seed with arithmetic only, so every peer derives the
 * identical collider set. The Rift (15-yarik-haritasi §4.1): structures are placed first —
 * the heart, the cave, the station, the wreck and the three exit docks — then rock is
 * scattered around them, kept out of entrances, exit zones and structure approaches.
 */
export function buildArenaLayout(seed: number): ArenaLayout {
  const random: Rng = mulberry32(seed);
  const obstacles: ArenaObstacle[] = [];
  const structures: ArenaStructure[] = [];
  const fields: ArenaField[] = [];
  const zones: Zone[] = [];
  const r = T.shipHitRadius;
  const meshes = arenaMeshes();
  const family: Record<CatalogFamily, number[]> = { rock: [], giant: [], crystal: [] };
  ARENA_CATALOG.forEach((entry, index) => family[entry.family].push(index));

  // v6 (16-yarik-v6-plani §3–4): twelve mouths on the rim at the half-way angles, four exits on
  // the 10 km ring, each out beyond the middle ring (Liman; Kovuk–Petek; Enkaz; Kanyon–Tersane).
  const entries: Vec3[] = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
    .map((angle, i) => atHalf(angle, 12500, [0, 160, -120, 80, -200, 40][i % 6] ?? 0));
  const exits: Vec3[] = [at(60, 10000, -350), at(150, 10000, 300), at(240, 10000, -250), at(330, 10000, 150)];
  for (const entry of entries) zones.push({ p: entry, radius: T.spawnClear + 30 });
  for (const exit of exits) zones.push({ p: exit, radius: T.exitRadius + 140 });

  /** A uniformly random rotation: a point drawn in the 4-ball, pushed out to its surface. */
  const turn = (): Quaternion => {
    for (;;) {
      const x = random() * 2 - 1; const y = random() * 2 - 1; const z = random() * 2 - 1; const w = random() * 2 - 1;
      const length = Math.sqrt(x * x + y * y + z * z + w * w);
      if (length > 0.05 && length <= 1) return { x: x / length, y: y / length, z: z / length, w: w / length };
    }
  };
  /**
   * A catalog shape the client draws as it is (Y2: visual = collision), `size` being its
   * mean radius in metres. Not yet placed: `place` keeps it once it fits.
   */
  const shape = (kind: 'rock' | 'crystal', mesh: number, p: Vec3, size: number, q: Quaternion): ArenaObstacle => {
    const model = meshes[mesh];
    const scale = size / (model?.mean ?? 1);
    return { id: obstacles.length, kind, shape: 'mesh', p, q, scale, mesh, radius: scale * (model?.radius ?? 1) };
  };
  /** A uniformly random unit pair: a half-angle's cosine and sine for a free twist. */
  const twist = (): [number, number] => {
    for (;;) {
      const c = random() * 2 - 1; const s = random() * 2 - 1; const l = Math.sqrt(c * c + s * s);
      if (l > 0.05 && l <= 1) return [c / l, s / l];
    }
  };
  const pick = (from: CatalogFamily): number => family[from][Math.floor(random() * family[from].length)] ?? 0;
  const place = (o: ArenaObstacle): number => { obstacles.push(o); return o.id; };
  const structure = (kind: StructureKind, p: Vec3, ux: number, uz: number, scale: number,
    colliders: number[], decks: number[], keepOut: number): void => {
    structures.push({ id: structures.length, kind, p, ux, uz, scale, colliders, decks });
    zones.push({ p, radius: keepOut });
  };
  /** A delivered model (tools/yarik-structures.mjs) placed at p, local +Z turned onto (fx, fz). */
  const model = (key: string, p: Vec3, fx: number, fz: number): MeshObstacle => {
    const index = STRUCTURE_CATALOG.findIndex(e => e.key === key);
    const entry = STRUCTURE_CATALOG[index]; const mesh = meshes[STRUCTURE_MESH_BASE + index];
    if (!entry || !mesh) throw new Error(`Arena structure ${key} is missing from the catalog`);
    const o: MeshObstacle = { id: obstacles.length, kind: 'structure', shape: 'mesh', p, q: yawTo(fx, fz),
      scale: entry.radius, mesh: STRUCTURE_MESH_BASE + index, radius: entry.radius * mesh.radius };
    obstacles.push(o);
    return o;
  };
  /** A structure's own point (metres, its frame) in the level. */
  const local = (o: MeshObstacle, point: readonly [number, number, number]): Vec3 => {
    const v = rotate(o.q, point[0], point[1], point[2]);
    return { x: o.p.x + v.x, y: o.p.y + v.y, z: o.p.z + v.z };
  };
  /**
   * A kit building (V6d): each piece its own collider, the whole one structure, its plan +Z
   * turned onto (fx, fz). Rock keeps `keepOut` metres from p.
   */
  const building = (kind: StructureKind, plan: Blueprint, p: Vec3, fx: number, fz: number, keepOut: number): void => {
    const pieces = blueprintPoses(plan, p, fx, fz).map(pose => model(pose.key, pose.p, pose.fx, pose.fz));
    structure(kind, p, fz, -fx, keepOut, pieces.map(o => o.id), [], keepOut);
  };
  /**
   * A crystal grown out of a surface point (normal n), shards outwards: half-way rotation from
   * the shards' axis onto n, then a free twist about n.
   */
  const vein = (mesh: number, surface: { x: number; y: number; z: number; nx: number; ny: number; nz: number }, size: number): ArenaObstacle => {
    const g = glowAxis(mesh);
    let ax = g.y * surface.nz - g.z * surface.ny; let ay = g.z * surface.nx - g.x * surface.nz; let az = g.x * surface.ny - g.y * surface.nx;
    let aw = 1 + g.x * surface.nx + g.y * surface.ny + g.z * surface.nz;
    if (aw < 1e-6) { ax = -g.z; ay = 0; az = g.x; aw = 0; if (ax * ax + az * az < 1e-12) { ax = 1; az = 0; } }
    const al = Math.sqrt(ax * ax + ay * ay + az * az + aw * aw);
    ax /= al; ay /= al; az /= al; aw /= al;
    const [c, sn] = twist();
    const tx = surface.nx * sn; const ty = surface.ny * sn; const tz = surface.nz * sn;
    const q = { x: c * ax + tx * aw + ty * az - tz * ay, y: c * ay - tx * az + ty * aw + tz * ax,
      z: c * az + tx * ay - ty * ax + tz * aw, w: c * aw - tx * ax - ty * ay - tz * az };
    // The centre a third of its size off the surface: the crystal's own rock base sinks in.
    const p = { x: surface.x + surface.nx * size * 0.35, y: surface.y + surface.ny * size * 0.35, z: surface.z + surface.nz * size * 0.35 };
    return shape('crystal', mesh, p, size, q);
  };

  // Yarık Kalbi: the derelict relay station at the centre, its four landing pads the decks.
  const heart = model('yarik_kalbi', { x: 0, y: 0, z: 0 }, 0, 1);
  structure('hub', heart.p, 1, 0, heart.radius, [heart.id], [heart.id], 430);

  // Exit docks: the deck right under the exit point, the dock's front to the centre.
  const deckMark = STRUCTURE_CATALOG.find(e => e.key === 'iskele')?.deck?.p ?? [0, 0, 0];
  for (const exit of exits) {
    const planar = Math.sqrt(exit.x * exit.x + exit.z * exit.z);
    const fx = -exit.x / planar; const fz = -exit.z / planar;
    const deck = rotate(yawTo(fx, fz), deckMark[0], deckMark[1], deckMark[2]);
    const dock = model('iskele', { x: exit.x - deck.x, y: exit.y - r - deck.y, z: exit.z - deck.z }, fx, fz);
    structure('dock', dock.p, fz, -fx, dock.radius, [dock.id], [dock.id], 0);
  }

  // The middle ring, 60° apart: Kovuk (high) and Sessiz Liman (low), main mouths to the heart.
  const cave = model('kovuk', at(120, 5000, 450), 0.5, -S3);
  structure('cave', cave.p, -S3, -0.5, cave.radius, [cave.id], [], cave.radius + 120);
  const station = model('sessiz_liman', at(60, 5200, -400), -0.5, -S3);
  structure('station', station.p, -S3, 0.5, station.radius, [station.id], [], station.radius + 120);
  // Liman eki (§7): kit rooms 15° round from the harbour, off its lane, the front mouth to it.
  const annex = atHalf(60, 6000, -250);
  const ax = station.p.x - annex.x; const az = station.p.z - annex.z; const al = Math.sqrt(ax * ax + az * az);
  building('annex', PLANS.annex, annex, ax / al, az / al, 450);

  // Enkaz Mezarlığı: a derelict capital ship broken in two, its torn mid-ship face to the heart
  // and the fly-through gap under its spine.
  const wreck = model('enkaz', at(240, 5000, -300), 0.5, S3);
  // Beside it, off the heart's lane, the broken ring: its way through runs top to bottom.
  const ringAt = { x: wreck.p.x + S3 * 750, y: wreck.p.y + 150, z: wreck.p.z - 0.5 * 750 };
  const ring = model('halka_harabe', ringAt, 0.5, S3);
  zones.push({ p: ring.p, radius: ring.radius + 60 });
  structure('wreck', wreck.p, S3, -0.5, wreck.radius, [wreck.id, ring.id], [], wreck.radius + 60);
  // Yarık Kalbi Kompleksi (§4): three refinery wings between the open lanes, on three levels,
  // their front mouths to the heart: half the heart's farm is inside them.
  [30, 150, 270].forEach((angle, i) => {
    const [x, z] = DIRECTION[angle] ?? [1, 0];
    building('refinery', PLANS.refinery, at(angle, 800, [-300, 50, 400][i] ?? 0), -x, -z, 450);
  });
  // Tersane (§4, 0°, high): Gangut's ring station, its way through on the heart line, between
  // two kit depots on two levels, their mouths to the heart too.
  const yardAt = at(0, 5000, 300);
  const gangut = model('gangut', yardAt, -1, 0);
  const depots = ([[-440, -120, -40], [440, 160, -40]] as const).flatMap(([x, y, z]) =>
    blueprintPoses(PLANS.depot, { x: yardAt.x - z, y: yardAt.y + y, z: yardAt.z + x }, -1, 0)
      .map(pose => model(pose.key, pose.p, pose.fx, pose.fz).id));
  structure('yard', yardAt, 0, 1, 650, [gangut.id, ...depots], [], 650);
  // Brief 3, two more caves that chase differently from Kovuk, main ends to the heart. Yarık
  // Kanyonu: a winding fissure open to the sky in places, in the heart of Kristal Kuşağı (the
  // belt's rock and crystal grow round it). Petek: a honeycomb of cells, a maze, at 180°.
  const canyon = model('yarik_kanyonu', at(300, 5200, 0), -0.5, S3);
  structure('canyon', canyon.p, S3, 0.5, canyon.radius, [canyon.id], [], canyon.radius + 60);
  const comb = model('petek', at(180, 5200, 100), 1, 0);
  structure('honeycomb', comb.p, 0, -1, comb.radius, [comb.id], [], comb.radius + 60);
  // Two dust clouds in the outer frontier, between the exits (§5): blind past 350 m inside.
  const dust: ArenaDust[] = [{ p: atHalf(90, 9500, 200), radius: 650 }, { p: atHalf(270, 9500, -250), radius: 650 }];
  // Eight outposts in the frontier (§4): one on every 30° line that holds no exit, each a room
  // between two mouths along the line to the heart, so whoever farms inside has a back door. The
  // outer four are ruins: a breached corridor gives them a third.
  [0, 30, 90, 120, 180, 210, 270, 300].forEach((angle, i) => {
    const p = at(angle, i % 2 === 0 ? 9000 : 10500, [300, -400, 150, -250, 450, -150, 250, -350][i] ?? 0);
    const [x, z] = DIRECTION[angle] ?? [1, 0];
    building('outpost', i % 2 === 0 ? PLANS.outpost : PLANS.outpostRuin, p, -x, -z, 380);
  });
  // Six giant cliffs (§2) past the outposts on every other half-way line, the two scans in turn,
  // each one's deep crack running to the heart: a place to hide, not a place to farm.
  [0, 60, 120, 180, 240, 300].forEach((angle, i) => {
    const p = atHalf(angle, 11000, [250, -300, 100, -200, 350, -100][i] ?? 0);
    const planar = Math.sqrt(p.x * p.x + p.z * p.z);
    const cliff = model(i % 2 === 0 ? 'kayalik_1' : 'kayalik_4', p, -p.x / planar, -p.z / planar);
    zones.push({ p, radius: cliff.radius + 150 });
  });

  const inside = (p: Vec3, radius: number): boolean =>
    Math.sqrt(p.x * p.x + p.z * p.z) + radius <= T.arenaRadius - 10 && Math.abs(p.y) + radius <= T.arenaHalfHeight - 10;
  /** True when a sphere fits: inside the disc, outside every zone and clear of every collider. */
  const free = (p: Vec3, radius: number, gap: number, except = -1): boolean => {
    if (!inside(p, radius)) return false;
    for (const zone of zones) {
      const dx = p.x - zone.p.x; const dy = p.y - zone.p.y; const dz = p.z - zone.p.z;
      const reach = zone.radius + radius;
      if (dx * dx + dy * dy + dz * dz < reach * reach) return false;
    }
    for (const o of obstacles) {
      if (o.id === except) continue;
      const dx = p.x - o.p.x; const dy = p.y - o.p.y; const dz = p.z - o.p.z;
      const reach = o.radius + radius + gap;
      if (dx * dx + dy * dy + dz * dz < reach * reach) return false;
    }
    return true;
  };
  const unit = (out: Vec3): void => {
    for (;;) {
      const x = random() * 2 - 1; const y = random() * 2 - 1; const z = random() * 2 - 1;
      const length = Math.sqrt(x * x + y * y + z * z);
      if (length > 0.05 && length <= 1) { out.x = x / length; out.y = y / length; out.z = z / length; return; }
    }
  };

  // Ore points of the cave and the kit rooms: crystal veins on their walls, mined inside. Placed
  // without the zone check (they are inside the structure's own keep-out), but clear of everything
  // but their own structure, and never into a route's passing room: a vein too big for its wall
  // grows smaller, or not at all. `own` are the colliders of the host's own structure.
  const passing = r + 25;
  const veinsOf = (host: MeshObstacle, own: readonly number[]): void => {
    const entry = STRUCTURE_CATALOG[host.mesh - STRUCTURE_MESH_BASE];
    const routes = (entry?.paths ?? []).map(line => line.map(point => local(host, point)));
    // Its cargo bays: loose ore drifts a cluster's radius round each, never into a crystal.
    const bays = (entry?.cargo ?? []).map(point => local(host, point));
    const clearOfBays = (o: ArenaObstacle): boolean => bays.every(b => {
      const dx = o.p.x - b.x; const dy = o.p.y - b.y; const dz = o.p.z - b.z;
      const reach = o.radius + T.clusterRadius + 5;
      return dx * dx + dy * dy + dz * dz >= reach * reach;
    });
    const clearOfRoutes = (o: ArenaObstacle): boolean => routes.every(line => line.every((a, i) => {
      const b = line[i + 1];
      if (!b) return true;
      const ex = b.x - a.x; const ey = b.y - a.y; const ez = b.z - a.z;
      const length = ex * ex + ey * ey + ez * ez;
      const t = length > 0 ? Math.max(0, Math.min(1, ((o.p.x - a.x) * ex + (o.p.y - a.y) * ey + (o.p.z - a.z) * ez) / length)) : 0;
      const dx = o.p.x - a.x - ex * t; const dy = o.p.y - a.y - ey * t; const dz = o.p.z - a.z - ez * t;
      const reach = o.radius + passing;
      return dx * dx + dy * dy + dz * dz >= reach * reach;
    }));
    for (const mark of entry?.deposits ?? []) {
      const p = local(host, mark.p);
      // The catalog rounds directions to centimetres: unit again before it orients a crystal.
      const n = rotate(host.q, mark.d[0], mark.d[1], mark.d[2]);
      const length = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
      n.x /= length; n.y /= length; n.z /= length;
      const mesh = pick('crystal');
      // Down to 4 m: a canyon wall stands ~40 m off its route, where a bigger vein's ball won't fit.
      for (let size = 12 + 6 * random(); size >= 4; size *= 0.8) {
        const crystal = vein(mesh, { x: p.x, y: p.y, z: p.z, nx: n.x, ny: n.y, nz: n.z }, size);
        if (!clearOfRoutes(crystal) || !clearOfBays(crystal)) continue;
        if (obstacles.every(o => {
          if (own.includes(o.id)) return true;
          const dx = crystal.p.x - o.p.x; const dy = crystal.p.y - o.p.y; const dz = crystal.p.z - o.p.z;
          const reach = o.radius + crystal.radius + 3;
          return dx * dx + dy * dy + dz * dz >= reach * reach;
        })) place(crystal);
        break;
      }
    }
  };
  // Cargo points inside the kit rooms: loose ore drifts there (farm spots, below).
  const cargo: Vec3[] = [];
  for (const s of structures) {
    for (const id of s.colliders) {
      const host = obstacles[id];
      if (host?.shape !== 'mesh') continue;
      veinsOf(host, s.colliders);
      for (const point of STRUCTURE_CATALOG[host.mesh - STRUCTURE_MESH_BASE]?.cargo ?? []) cargo.push(local(host, point));
    }
  }

  // Dense belts: Kristal Kuşağı (big, crystal-rich) and six sheltered routes, one between each
  // pair of open lanes from the heart.
  const belts: readonly (readonly [Vec3, number, number, number, number])[] = [
    [at(300, 5200, 0), 900, 350, 420, 14],
    ...[30, 90, 150, 210, 270, 330].map((angle, i): readonly [Vec3, number, number, number, number] =>
      [at(angle, 2700 + 150 * (i % 3), [60, -40, 120, -100, 20, -60][i] ?? 0), 480, 220, 130, 5]),
  ];
  // Open lanes: from the heart straight to each district, kept free of rock. A chain of 120 m
  // keep-outs 40 m apart leaves ≥ 115 m round the centre line for any rock size.
  const laneEnds: Vec3[] = [];
  const lane = (to: Vec3, short: number): void => {
    const length = Math.sqrt(to.x * to.x + to.y * to.y + to.z * to.z);
    laneEnds.push(to);
    for (let d = 0; d < length - short; d += 40) zones.push({ p: { x: to.x * d / length, y: to.y * d / length, z: to.z * d / length }, radius: 120 });
  };
  for (const o of [station, cave, wreck, gangut, comb]) lane(o.p, o.radius + 60);
  const [crystalBelt] = belts;
  if (crystalBelt) lane(crystalBelt[0], crystalBelt[1]);
  for (const [centre, radius, height, rockCount, crystalCount] of belts) {
    const field: ArenaField = { p: centre, radius, height, dense: true };
    fields.push(field);
    let rocks = 0; let crystals = 0;
    for (let attempt = 0; attempt < 12000 && (rocks < rockCount || crystals < crystalCount); attempt++) {
      const x = random() * 2 - 1; const h = random() * 2 - 1; const z = random() * 2 - 1;
      if (x * x + h * h + z * z > 1) continue;
      const p = { x: field.p.x + x * field.radius, y: field.p.y + h * field.height, z: field.p.z + z * field.radius };
      const crystal = crystals < crystalCount && attempt % 7 === 3;
      if (!crystal && rocks >= rockCount) continue;
      const u = random();
      const o = shape(crystal ? 'crystal' : 'rock', pick(crystal ? 'crystal' : 'rock'), p, crystal ? 12 + 10 * u : 5 + 35 * u * u, turn());
      if (!free(p, o.radius, 3)) continue;
      place(o);
      if (crystal) crystals++; else rocks++;
    }
  }

  // Landmark rocks big enough to land a squadron on, each veined with two crystals that
  // grow out of the scanned surface itself, shards outwards.
  const draft: ArenaLayout = { version: 5, radius: T.arenaRadius, halfHeight: T.arenaHalfHeight, entries, exits, obstacles, meshes,
    structures, fields, dust, farmSpots: [], deposits: [], depositKinds: [] };
  const surface: SurfacePoint = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, d: 0, inside: false };
  for (let placed = 0, attempt = 0; placed < 14 && attempt < 1400; attempt++) {
    const x = (random() * 2 - 1) * 12000; const z = (random() * 2 - 1) * 12000;
    const planar = Math.sqrt(x * x + z * z);
    if (planar < 2000 || planar > 12000) continue;
    const p = { x, y: (random() * 2 - 1) * 800, z };
    // Both landmark scans take turns, so no two neighbours look like copies.
    const rock = shape('rock', family.giant[placed % family.giant.length] ?? 0, p, 110 + 90 * random(), turn());
    if (!free(p, rock.radius, 60)) continue;
    const giant = place(rock);
    for (let veins = 0, tries = 0; veins < 2 && tries < 60; tries++) {
      const dir = { x: 0, y: 0, z: 0 };
      unit(dir);
      const from = { x: p.x + dir.x * rock.radius * 2, y: p.y + dir.y * rock.radius * 2, z: p.z + dir.z * rock.radius * 2 };
      if (!closestSurface(draft, giant, from, Infinity, surface)) continue;
      const crystal = vein(pick('crystal'), surface, 13 + 9 * random());
      if (!free(crystal.p, crystal.radius, 3, giant)) continue;
      place(crystal);
      veins++;
    }
    placed++;
  }

  // Frontier pockets (§6): a loose shell of rock with room in the middle to farm behind it,
  // out where few pass. The centres become the frontier's farm spots; each dust cloud gets
  // its own first, 400 m apart, so the blind places are worth the trip.
  const pockets: Vec3[] = [];
  const cloudPockets = dust.length * 4;
  for (let attempt = 0; pockets.length < 46 && attempt < 4000; attempt++) {
    const cloud = pockets.length < cloudPockets && attempt < 1500 ? dust[pockets.length % dust.length] : undefined;
    let centre: Vec3;
    if (cloud) {
      const x = random() * 2 - 1; const y = random() * 2 - 1; const z = random() * 2 - 1;
      if (x * x + y * y + z * z > 1) continue;
      centre = { x: cloud.p.x + x * cloud.radius * 0.7, y: cloud.p.y + y * cloud.radius * 0.5, z: cloud.p.z + z * cloud.radius * 0.7 };
    } else {
      const x = (random() * 2 - 1) * 12000; const z = (random() * 2 - 1) * 12000;
      const planar = Math.sqrt(x * x + z * z);
      if (planar < 7500 || planar > 12000) continue;
      centre = { x, y: (random() * 2 - 1) * T.arenaHalfHeight * 0.6, z };
    }
    const spacing = cloud ? 400 : 900;
    if (!free(centre, 230, 0) || pockets.some(q => {
      const dx = q.x - centre.x; const dy = q.y - centre.y; const dz = q.z - centre.z;
      return dx * dx + dy * dy + dz * dz < spacing * spacing;
    })) continue;
    const dir = { x: 0, y: 0, z: 0 };
    let shell = 0;
    for (let tries = 0; shell < 9 + Math.floor(random() * 6) && tries < 80; tries++) {
      unit(dir);
      const reach = 120 + 80 * random();
      const p = { x: centre.x + dir.x * reach, y: centre.y + dir.y * reach * 0.6, z: centre.z + dir.z * reach };
      const u = random();
      const o = shape('rock', pick('rock'), p, 12 + 30 * u * u, turn());
      const dx = p.x - centre.x; const dy = p.y - centre.y; const dz = p.z - centre.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) - o.radius < 70 || !free(p, o.radius, 4)) continue;
      place(o);
      shell++;
    }
    if (shell >= 6) pockets.push(centre);
  }

  // Sparse rock across the whole disc (Dış Kuşak), thicker towards the reference plane.
  for (let placed = 0, attempt = 0; placed < 900 && attempt < 30000; attempt++) {
    const x = (random() * 2 - 1) * T.arenaRadius; const z = (random() * 2 - 1) * T.arenaRadius;
    const y = (random() + random() - 1) * T.arenaHalfHeight * 0.75;
    const u = random();
    const p = { x, y, z };
    const o = shape('rock', pick('rock'), p, 8 + 62 * u * u * u, turn());
    if (!free(p, o.radius, 12)) continue;
    place(o);
    placed++;
  }

  // A few exposed crystals in the heart: rich, but anyone can see you there.
  for (let placed = 0, attempt = 0; placed < 8 && attempt < 1600; attempt++) {
    const x = (random() * 2 - 1) * 2000; const z = (random() * 2 - 1) * 2000;
    const p = { x, y: (random() * 2 - 1) * 260, z };
    const o = shape('crystal', pick('crystal'), p, 16 + 8 * random(), turn());
    if (!free(p, o.radius, 120)) continue;
    place(o);
    placed++;
  }

  // Field farm spots, last so every collider above keeps its seed. The heart holds
  // a quarter (the richest open farming), the frontier its pockets, the middle ring the rest.
  // Spaced apart so one pass never sweeps a whole cluster.
  const farmSpots: Vec3[] = [];
  const heartSpots = Math.ceil(T.farmSpots * 0.25) - cargo.filter(p => Math.sqrt(p.x * p.x + p.z * p.z) < 2000).length;
  for (let attempt = 0; farmSpots.length < heartSpots && attempt < 20000; attempt++) {
    const x = random() * 2 - 1; const z = random() * 2 - 1; const y = random() * 2 - 1;
    if (x * x + z * z > 1) continue;
    const p = { x: x * 2000, y: y * 500, z: z * 2000 };
    if (!free(p, 8 + T.clusterRadius, 20) || farmSpots.some(q => {
      const dx = q.x - p.x; const dy = q.y - p.y; const dz = q.z - p.z;
      return dx * dx + dy * dy + dz * dz < 90 * 90;
    })) continue;
    farmSpots.push(p);
  }
  // Then every cargo room of the kit buildings, then the frontier pockets.
  farmSpots.push(...cargo);
  farmSpots.push(...pockets.slice(0, T.farmSpots - farmSpots.length));
  // The middle ring farms where the open lanes and the heart cannot see (§2 goal 1): in a dense
  // belt, or beyond the server's sight radius of every lane and of the open heart.
  const sheltered = (p: Vec3): boolean => fields.some(f => {
    const dx = (p.x - f.p.x) / f.radius; const dy = (p.y - f.p.y) / f.height; const dz = (p.z - f.p.z) / f.radius;
    return f.dense && dx * dx + dy * dy + dz * dz < 1;
  }) || (Math.sqrt(p.x * p.x + p.z * p.z) > 2000 + T.aoiRadius && laneEnds.every(end => {
    const length = end.x * end.x + end.y * end.y + end.z * end.z;
    const t = Math.max(0, Math.min(1, (p.x * end.x + p.y * end.y + p.z * end.z) / length));
    const dx = p.x - end.x * t; const dy = p.y - end.y * t; const dz = p.z - end.z * t;
    return dx * dx + dy * dy + dz * dz > T.aoiRadius * T.aoiRadius;
  }));
  for (let attempt = 0; farmSpots.length < T.farmSpots && attempt < 40000; attempt++) {
    const x = random() * 2 - 1; const z = random() * 2 - 1; const y = random() * 2 - 1;
    const planar = Math.sqrt(x * x + z * z);
    if (planar > 1 || planar < 2000 / 7000) continue;
    const p = { x: x * 7000, y: y * T.arenaHalfHeight * 0.45, z: z * 7000 };
    if (!sheltered(p) || !free(p, 8 + T.clusterRadius, 20) || farmSpots.some(q => {
      const dx = q.x - p.x; const dy = q.y - p.y; const dz = q.z - p.z;
      return dx * dx + dy * dy + dz * dz < 90 * 90;
    })) continue;
    farmSpots.push(p);
  }

  // Ore veins on landable rock: alloy is common, deuterium rare. Picked from rock
  // already placed, so the colliders above never move.
  const veinable = obstacles.filter(o => o.kind === 'rock' && obstacleSize(draft, o) >= 14 && obstacleSize(draft, o) <= 45).map(o => o.id);
  for (let i = veinable.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [veinable[i], veinable[j]] = [veinable[j] ?? 0, veinable[i] ?? 0];
  }
  const crystals = obstacles.flatMap(o => o.kind === 'crystal' ? [o.id] : []);
  const alloy = veinable.slice(0, T.alloyDeposits);
  const deuterium = veinable.slice(T.alloyDeposits, T.alloyDeposits + T.deuteriumDeposits);

  return {
    ...draft, farmSpots,
    deposits: [...crystals, ...alloy, ...deuterium],
    depositKinds: [...crystals.map(() => 1), ...alloy.map(() => 0), ...deuterium.map(() => 2)],
  };
}

export const ARENA_LAYOUT: Readonly<ArenaLayout> = buildArenaLayout(ARENA_SEED);

/** A spawn at `entrance` (a room deals them in turn: `nextEntry`), or at a random one. */
export function spawnFlight(state: FlightState, random: Rng, layout: ArenaLayout = ARENA_LAYOUT, entrance?: number): number {
  if (layout.entries.length === 0) throw new Error('Arena needs at least one entrance');
  const index = entrance !== undefined ? entrance % layout.entries.length : Math.min(layout.entries.length - 1, Math.floor(random() * layout.entries.length));
  const entry = layout.entries[index];
  if (!entry) throw new Error('Invalid arena entrance');
  // Uniform direction from a cube, then bounded jitter. No rejection loop or trig.
  const x = random() * 2 - 1;
  const y = random() * 2 - 1;
  const z = random() * 2 - 1;
  const norm = Math.sqrt(x * x + y * y + z * z);
  const distance = random() * T.spawnJitter;
  const scale = norm > 0 ? distance / norm : 0;
  state.p.x = entry.x + x * scale;
  state.p.y = entry.y + y * scale;
  state.p.z = entry.z + z * scale;
  // Horizontal heading towards the centre. Central entrance chooses +Z.
  const planar = Math.sqrt(entry.x * entry.x + entry.z * entry.z);
  const fx = planar > 0 ? -entry.x / planar : 0;
  const fz = planar > 0 ? -entry.z / planar : 1;
  state.q.x = 0;
  state.q.z = 0;
  if (fz < -0.999999999) { state.q.y = 1; state.q.w = 0; }
  else {
    state.q.w = Math.sqrt((1 + fz) / 2);
    state.q.y = fx / (2 * state.q.w);
  }
  state.s = 0;
  state.throttle = 0;
  state.omegaYaw = 0;
  state.omegaPitch = 0;
  state.landed = 0;
  state.liftoff = 0;
  return index;
}
