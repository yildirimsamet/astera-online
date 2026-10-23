#!/usr/bin/env node
/**
 * Brings the Rift's enterable structures (Codex, Blender MCP: assets/source/yarik/<name>/)
 * into the game (15-yarik-haritasi §3, §8). For each asset:
 *
 *   collider  node `collider` (or `lod0`, the v1 deliveries) → packages/rules/src/arena/
 *             structures.generated.ts: welded, quantised to int16 of the bounding radius, checked
 *             closed (every edge on exactly two triangles) after quantising. The simulation
 *             collides against exactly these triangles on every peer.
 *   render    nodes lod0/lod1/lod2 → apps/web/public/assets/arena/yarik/<name>.glb: WebP
 *             textures, meshopt-compressed geometry, the collider and empties dropped. Then
 *             re-encode their maps to KTX2 on the VPS (tools/arena-ktx2.mjs glbs-prepare/-pack):
 *             webp decodes to full RGBA, and the Rift's ~745 MB of it killed a phone's renderer.
 *   metadata  <name>.json (entrances, deposits, pads, deck, route centrelines, and for kit
 *             pieces ports and cargo; metres, glTF Y-up) → the same generated file, for
 *             placement, tests and the map.
 *
 * Usage: node --max-old-space-size=2048 tools/yarik-structures.mjs [name ...]
 * The generated file always holds every finished asset folder; names limit which render glbs
 * are rebuilt (the slow part).
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(realpathSync(join(ROOT, 'node_modules/@gltf-transform/cli/package.json')));
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { meshopt, prune, dedup, textureCompress } = require('@gltf-transform/functions');
const { MeshoptEncoder } = require('meshoptimizer');
const sharp = require('sharp');

const NAMES = readdirSync(join(ROOT, 'assets/source/yarik'), { withFileTypes: true }).map(d => d.name).sort()
  // Only finished deliveries: a folder still being written has no model or metadata yet.
  .filter(name => existsSync(join(ROOT, 'assets/source/yarik', name, `${name}.glb`)) && existsSync(join(ROOT, 'assets/source/yarik', name, `${name}.json`)))
  // A delivery still under review stays out: YARIK_SKIP=halka_harabe,kayalik_1
  .filter(name => !(process.env.YARIK_SKIP ?? '').split(',').includes(name));
/** The render glbs to rebuild: the named ones, or every one. */
const REBUILD = process.argv.slice(2).length > 0 ? process.argv.slice(2) : NAMES;
for (const name of REBUILD) if (!NAMES.includes(name)) fail(`${name}: no finished asset folder (glb + json)`);
const SOURCE = join(ROOT, 'assets/source/yarik');
const RENDER = join(ROOT, 'apps/web/public/assets/arena/yarik');
const GENERATED = join(ROOT, 'packages/rules/src/arena/structures.generated.ts');
const QUANT = 32767;
/** Keeps every quantised corner inside the unit ball. */
const SHRINK = 0.9999;
const RENDER_NODES = new Set(['lod0', 'lod1', 'lod2']);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
function fail(message) { throw new Error(`yarik-structures: ${message}`); }

/** The node's triangles in model space (its world matrix applied), as flat arrays. */
function triangles(node) {
  const mesh = node.getMesh();
  if (!mesh) fail(`${node.getName()} has no mesh`);
  const m = node.getWorldMatrix();
  const positions = []; const indices = [];
  for (const prim of mesh.listPrimitives()) {
    const p = prim.getAttribute('POSITION').getArray();
    const base = positions.length / 3;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i]; const y = p[i + 1]; const z = p[i + 2];
      positions.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
    }
    const index = prim.getIndices()?.getArray();
    const count = index ? index.length : p.length / 3;
    for (let k = 0; k < count; k++) indices.push(base + (index ? index[k] : k));
  }
  return { positions, indices };
}

/**
 * Quantise to int16 of the bounding radius, weld corners that land on the same lattice point,
 * drop triangles that collapse, and refuse anything that is not closed afterwards.
 */
/**
 * Quantising can leave a triangle with its three corners on one line: no area, so the game's
 * mesh drops it (mesh.ts), and the two triangles along its long edge would meet a T-junction.
 * Each such sliver goes, and the triangle across its long edge splits at the middle corner.
 */
function splitSlivers(indices, corners) {
  const at = i => [corners[i * 3], corners[i * 3 + 1], corners[i * 3 + 2]];
  const flat = (a, b, c) => {
    const [p, q, r] = [at(a), at(b), at(c)];
    const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]]; const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
    return u[1] * v[2] - u[2] * v[1] === 0 && u[2] * v[0] - u[0] * v[2] === 0 && u[0] * v[1] - u[1] * v[0] === 0;
  };
  const tris = [];
  for (let t = 0; t < indices.length; t += 3) tris.push([indices[t], indices[t + 1], indices[t + 2]]);
  for (let guard = 0; guard < 64; guard++) {
    const s = tris.findIndex(([a, b, c]) => flat(a, b, c));
    if (s < 0) break;
    const [a, b, c] = tris[s];
    // The middle corner lies between the other two: the longest side is the one without it.
    const d2 = (i, j) => { const p = at(i); const q = at(j); return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; };
    const [x, y, m] = [[a, b, c], [b, c, a], [c, a, b]].sort((l, r) => d2(r[0], r[1]) - d2(l[0], l[1]))[0];
    tris.splice(s, 1);
    // The neighbour runs the long edge the other way round: y → x.
    const n = tris.findIndex(tri => [0, 1, 2].some(k => tri[k] === y && tri[(k + 1) % 3] === x));
    if (n < 0) continue;
    const k = [0, 1, 2].find(i => tris[n][i] === y && tris[n][(i + 1) % 3] === x);
    const far = tris[n][(k + 2) % 3];
    tris.splice(n, 1, [y, m, far], [m, x, far]);
  }
  return tris.flat();
}

function collider(name, { positions, indices }) {
  let radius = 0;
  for (let i = 0; i < positions.length; i += 3) radius = Math.max(radius, Math.hypot(positions[i], positions[i + 1], positions[i + 2]));
  const scale = QUANT * SHRINK / radius;
  const id = new Map(); const corners = []; const welded = [];
  for (const v of indices) {
    const q = [0, 1, 2].map(k => Math.round(positions[v * 3 + k] * scale));
    const key = q.join(',');
    let n = id.get(key);
    if (n === undefined) { n = id.size; id.set(key, n); corners.push(...q); }
    welded.push(n);
  }
  let kept = [];
  for (let t = 0; t < welded.length; t += 3) {
    const [a, b, c] = [welded[t], welded[t + 1], welded[t + 2]];
    if (a !== b && b !== c && a !== c) kept.push(a, b, c);
  }
  kept = splitSlivers(kept, corners);
  const edges = new Map();
  for (let t = 0; t < kept.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = kept[t + e]; const b = kept[t + (e + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  const open = [...edges.values()].filter(count => count !== 2).length;
  if (open > 0) fail(`${name}: collider is not closed after quantising (${open} edges not on exactly two triangles)`);
  if (corners.length / 3 > 65535) fail(`${name}: ${corners.length / 3} corners do not fit uint16 indices`);
  return { radius, corners: Int16Array.from(corners), indices: Uint16Array.from(kept) };
}

const base64 = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('base64');
/** Little-endian bytes on any host, as the decoder in catalog.ts reads them. */
function littleEndian(array) {
  const out = Buffer.alloc(array.length * 2);
  for (let i = 0; i < array.length; i++) out.writeInt16LE(array[i], i * 2);
  return out;
}
const round = v => Math.round(v * 100) / 100;
const point = p => `[${p.map(round).join(', ')}]`;
const marks = list => `[${(list ?? []).map(m => `{ p: ${point(m.position)}, d: ${point(m.direction)} }`).join(', ')}]`;

async function render(name, doc) {
  for (const node of doc.getRoot().listNodes()) {
    if (!RENDER_NODES.has(node.getName())) node.dispose();
  }
  await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 88 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  mkdirSync(RENDER, { recursive: true });
  const path = join(RENDER, `${name}.glb`);
  await io.write(path, doc);
  return path;
}

const lines = [];
for (const name of NAMES) {
  const file = join(SOURCE, name, `${name}.glb`);
  const meta = JSON.parse(readFileSync(join(SOURCE, name, `${name}.json`), 'utf8'));
  const doc = await io.read(file);
  const nodes = doc.getRoot().listNodes();
  const shell = nodes.find(n => n.getName() === 'collider') ?? nodes.find(n => n.getName() === 'lod0');
  if (!shell) fail(`${name}: no collider or lod0 node`);
  const c = collider(name, triangles(shell));
  const out = REBUILD.includes(name) ? await render(name, doc) : 'render glb kept';
  const paths = (meta.paths ?? []).map(line => `[${line.map(point).join(', ')}]`).join(',\n      ');
  lines.push(`  { key: '${name}', radius: ${c.radius.toFixed(3)}, source: '${shell.getName()}',
    positions: '${base64(littleEndian(c.corners))}',
    indices: '${base64(c.indices)}',
    entrances: ${marks(meta.entrances)},
    deposits: ${marks(meta.deposits)},
    pads: ${marks(meta.pads)},
    deck: ${meta.deck ? `{ p: ${point(meta.deck.position)}, d: ${point(meta.deck.direction)} }` : 'null'},
    paths: [
      ${paths}
    ],
    ports: ${marks(meta.ports)},
    cargo: [${(meta.cargo ?? []).map(c => point(c.position ?? c)).join(', ')}] },`);
  console.log(`${name}: ${shell.getName()} ${c.indices.length / 3} triangles, ${c.corners.length / 3} corners, radius ${c.radius.toFixed(1)} m → ${out}`);
}
writeFileSync(GENERATED, `// Generated by tools/yarik-structures.mjs — do not edit by hand. Sources: assets/source/yarik
// (original procedural work, Codex via Blender MCP, 2026-10-22).
import type { StructureEntry } from './structures.js';

export const STRUCTURE_CATALOG: readonly StructureEntry[] = [
${lines.join('\n')}
];
`);
console.log(`wrote ${GENERATED}`);
