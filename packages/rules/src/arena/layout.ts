import { mulberry32 } from '../rng.js';
import type { Rng } from '../types.js';
import { ARENA_TUNING as T } from './tuning.js';
import type { ArenaField, ArenaLayout, ArenaObstacle, ArenaStructure, FlightState, StructureKind, Vec3 } from './types.js';

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

interface Zone { p: Vec3; radius: number }

/**
 * Builds the whole arena from one seed with arithmetic only, so every peer derives the
 * identical collider set. Structures are placed first; rock is then scattered around
 * them with keep-out zones for entrances, exit decks and structure approaches.
 */
export function buildArenaLayout(seed: number): ArenaLayout {
  const random: Rng = mulberry32(seed);
  const obstacles: ArenaObstacle[] = [];
  const structures: ArenaStructure[] = [];
  const fields: ArenaField[] = [];
  const zones: Zone[] = [];
  const r = T.shipHitRadius;

  const entries: Vec3[] = [{ x: 0, y: T.centerSplit, z: 0 }, at(90, T.ringRadius, 0), at(210, T.ringRadius, 20), at(330, T.ringRadius, -20)];
  const exits: Vec3[] = [{ x: 0, y: -T.centerSplit, z: 0 }, at(30, T.ringRadius, -30), at(150, T.ringRadius, 30), at(270, T.ringRadius, 0)];
  for (const entry of entries) zones.push({ p: entry, radius: T.spawnClear + 30 });
  for (const exit of exits) zones.push({ p: exit, radius: T.exitRadius + 140 });

  const sphere = (kind: ArenaObstacle['kind'], p: Vec3, radius: number): number => {
    obstacles.push({ id: obstacles.length, kind, shape: 'sphere', p, radius });
    return obstacles.length - 1;
  };
  /** A box given in a structure's local frame (local +X = (ux, uz), local +Z = (-uz, ux)). */
  const box = (origin: Vec3, ux: number, uz: number, lx: number, ly: number, lz: number,
    hx: number, hy: number, hz: number, turn: readonly [number, number] = [1, 0]): number => {
    // `turn` rotates the box relative to the structure frame (e.g. a 45° octagon half).
    const bx = ux * turn[0] - uz * turn[1]; const bz = uz * turn[0] + ux * turn[1];
    obstacles.push({ id: obstacles.length, kind: 'structure', shape: 'box',
      p: { x: origin.x + lx * ux - lz * uz, y: origin.y + ly, z: origin.z + lx * uz + lz * ux },
      hx, hy, hz, ux: bx, uz: bz, radius: Math.sqrt(hx * hx + hy * hy + hz * hz) });
    return obstacles.length - 1;
  };
  const structure = (kind: StructureKind, p: Vec3, ux: number, uz: number, scale: number,
    colliders: number[], decks: number[], keepOut: number): void => {
    structures.push({ id: structures.length, kind, p, ux, uz, scale, colliders, decks });
    zones.push({ p, radius: keepOut });
  };

  // Hub: an octagonal disc (two square slabs, one turned 45°) around a tall spire.
  {
    const o = { x: 0, y: 0, z: 0 };
    const a = box(o, 1, 0, 0, 0, 0, 140, 18, 140);
    const b = box(o, 1, 0, 0, 0, 0, 140, 18, 140, [Math.SQRT1_2, Math.SQRT1_2]);
    const spire = box(o, 1, 0, 0, 0, 0, 26, 120, 26);
    structure('hub', o, 1, 0, 150, [a, b, spire], [a, b], 430);
  }

  // Exit gates: a deck under the exit point between two pylons, facing the hub.
  for (const exit of exits) {
    const planar = Math.sqrt(exit.x * exit.x + exit.z * exit.z);
    const ux = planar > 0 ? exit.z / planar : 1; const uz = planar > 0 ? -exit.x / planar : 0;
    const deckCentre = { x: exit.x, y: exit.y - r - 5, z: exit.z };
    const deck = box(deckCentre, ux, uz, 0, 0, 0, 48, 5, 48);
    const left = box(deckCentre, ux, uz, -62, 60, 0, 6, 65, 6);
    const right = box(deckCentre, ux, uz, 62, 60, 0, 6, 65, 6);
    structure('gate', deckCentre, ux, uz, 48, [deck, left, right], [deck], 0);
  }

  // Outposts: an open hangar bay facing the hub, with a landing roof and a mast.
  for (const [angle, radius, y] of [[60, 1150, 80], [300, 1150, -60]] as const) {
    const centre = at(angle, radius, y);
    const [cx, cz] = DIRECTION[angle] ?? [1, 0];
    const ux = cz; const uz = -cx; // local +Z points away from the hub
    const floor = box(centre, ux, uz, 0, 0, 0, 70, 6, 50);
    const roof = box(centre, ux, uz, 0, 54, 0, 70, 6, 50);
    const back = box(centre, ux, uz, 0, 27, 46, 70, 21, 4);
    const sideA = box(centre, ux, uz, -66, 27, 8, 4, 21, 42);
    const sideB = box(centre, ux, uz, 66, 27, 8, 4, 21, 42);
    const mast = box(centre, ux, uz, 0, 95, 70, 16, 95, 16);
    structure('outpost', centre, ux, uz, 70, [floor, roof, back, sideA, sideB, mast], [floor, roof], 260);
  }

  // A derelict capital ship broken in two, with a fly-through gap under its spine.
  {
    const centre = at(180, 1500, 40);
    const ux = 0.6; const uz = 0.8;
    const bow = box(centre, ux, uz, -150, 0, 0, 90, 28, 32);
    const stern = box(centre, ux, uz, 110, 0, 0, 70, 34, 38);
    const spine = box(centre, ux, uz, -10, 40, 0, 60, 6, 10);
    const bridge = box(centre, ux, uz, 150, 50, 0, 20, 16, 14);
    structure('wreck', centre, ux, uz, 240, [bow, stern, spine, bridge], [bow, stern], 300);
  }

  // Relays on the lanes from the outer entrances towards the hub.
  for (const angle of [90, 210, 330]) {
    const p = at(angle, 900, 40);
    const mast = sphere('structure', p, 16);
    structure('relay', p, 1, 0, 16, [mast], [], 90);
  }

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
      const reach = o.radius + radius + (o.shape === 'box' ? 30 : gap);
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

  // Dense belts between the outer entrances and exits: tight, dark, easy to get lost in.
  for (const [angle, y] of [[0, 60], [120, -40], [240, 20]] as const) {
    const field: ArenaField = { p: at(angle, 1250, y), radius: 380, height: 190, dense: true };
    fields.push(field);
    let rocks = 0; let crystals = 0;
    for (let attempt = 0; attempt < 6000 && (rocks < 125 || crystals < 5); attempt++) {
      const x = random() * 2 - 1; const h = random() * 2 - 1; const z = random() * 2 - 1;
      if (x * x + h * h + z * z > 1) continue;
      const p = { x: field.p.x + x * field.radius, y: field.p.y + h * field.height, z: field.p.z + z * field.radius };
      const crystal = crystals < 5 && attempt % 7 === 3;
      if (!crystal && rocks >= 125) continue;
      const u = random();
      const radius = crystal ? 12 + 10 * u : 5 + 35 * u * u;
      if (!free(p, radius, 3)) continue;
      sphere(crystal ? 'crystal' : 'rock', p, radius);
      if (crystal) crystals++; else rocks++;
    }
  }

  // Landmark rocks big enough to land a squadron on, each veined with two crystals.
  for (let placed = 0, attempt = 0; placed < 5 && attempt < 400; attempt++) {
    const x = (random() * 2 - 1) * 2100; const z = (random() * 2 - 1) * 2100;
    const planar = Math.sqrt(x * x + z * z);
    if (planar < 650 || planar > 2100) continue;
    const p = { x, y: (random() * 2 - 1) * 240, z };
    const radius = 110 + 90 * random();
    if (!free(p, radius, 60)) continue;
    const giant = sphere('rock', p, radius);
    for (let vein = 0, tries = 0; vein < 2 && tries < 60; tries++) {
      const dir = { x: 0, y: 0, z: 0 };
      unit(dir);
      const size = 13 + 9 * random();
      const reach = radius + size + 0.05;
      const c = { x: p.x + dir.x * reach, y: p.y + dir.y * reach, z: p.z + dir.z * reach };
      if (!free(c, size, 3, giant)) continue;
      sphere('crystal', c, size);
      vein++;
    }
    placed++;
  }

  // Sparse rock across the whole disc, thicker towards the reference plane.
  for (let placed = 0, attempt = 0; placed < 245 && attempt < 9000; attempt++) {
    const x = (random() * 2 - 1) * T.arenaRadius; const z = (random() * 2 - 1) * T.arenaRadius;
    const y = (random() + random() - 1) * T.arenaHalfHeight * 0.75;
    const u = random();
    const radius = 8 + 62 * u * u * u;
    const p = { x, y, z };
    if (!free(p, radius, 12)) continue;
    sphere('rock', p, radius);
    placed++;
  }

  // A few exposed crystals in open space: rich, but anyone can see you there.
  for (let placed = 0, attempt = 0; placed < 4 && attempt < 800; attempt++) {
    const x = (random() * 2 - 1) * 2000; const z = (random() * 2 - 1) * 2000;
    const p = { x, y: (random() * 2 - 1) * 200, z };
    const radius = 16 + 8 * random();
    if (!free(p, radius, 120)) continue;
    sphere('crystal', p, radius);
    placed++;
  }

  // Field farm spots, last so every collider above keeps its seed. Open space and
  // belt edges alike, spaced apart so one pass never sweeps a whole cluster.
  const farmSpots: Vec3[] = [];
  for (let attempt = 0; farmSpots.length < T.farmSpots && attempt < 20000; attempt++) {
    const x = random() * 2 - 1; const z = random() * 2 - 1; const y = random() * 2 - 1;
    if (x * x + z * z > 1) continue;
    const p = { x: x * (T.arenaRadius - 120), y: y * T.arenaHalfHeight * 0.55, z: z * (T.arenaRadius - 120) };
    if (!free(p, 8 + T.clusterRadius, 20) || farmSpots.some(q => {
      const dx = q.x - p.x; const dy = q.y - p.y; const dz = q.z - p.z;
      return dx * dx + dy * dy + dz * dz < 90 * 90;
    })) continue;
    farmSpots.push(p);
  }

  // Ore veins on landable rock: alloy is common, deuterium rare. Picked from rock
  // already placed, so the colliders above never move.
  const veinable = obstacles.filter(o => o.kind === 'rock' && o.radius >= 14 && o.radius <= 45).map(o => o.id);
  for (let i = veinable.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [veinable[i], veinable[j]] = [veinable[j] ?? 0, veinable[i] ?? 0];
  }
  const crystals = obstacles.flatMap(o => o.kind === 'crystal' ? [o.id] : []);
  const alloy = veinable.slice(0, T.alloyDeposits);
  const deuterium = veinable.slice(T.alloyDeposits, T.alloyDeposits + T.deuteriumDeposits);

  return {
    version: 3, radius: T.arenaRadius, halfHeight: T.arenaHalfHeight, entries, exits, obstacles, structures, fields, farmSpots,
    deposits: [...crystals, ...alloy, ...deuterium],
    depositKinds: [...crystals.map(() => 1), ...alloy.map(() => 0), ...deuterium.map(() => 2)],
  };
}

export const ARENA_LAYOUT: Readonly<ArenaLayout> = buildArenaLayout(ARENA_SEED);

export function spawnFlight(state: FlightState, random: Rng, layout: ArenaLayout = ARENA_LAYOUT): number {
  if (layout.entries.length === 0) throw new Error('Arena needs at least one entrance');
  const index = Math.min(layout.entries.length - 1, Math.floor(random() * layout.entries.length));
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
