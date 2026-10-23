#!/usr/bin/env node
/**
 * Builds the arena's collider catalog and the rock models drawn from it (Y2: the rock you
 * see is the rock you hit). Every source is merged, simplified, centred, scaled to bounding
 * radius 1 and quantised to int16; the catalog (packages/rules/src/arena/catalog.generated.ts)
 * and the GLB are written from the same quantised vertices, triangle for triangle, and the
 * GLB is read back and compared before anything is written.
 *
 * Crystals are a rock with glowing hexagonal shards, joined into one closed surface
 * (manifold-3d boolean union) so inside and outside stay well defined for the collider.
 *
 * Usage: node --max-old-space-size=3584 tools/arena-colliders.mjs <source dir> <refs dir>
 *   source dir  the Megascans / Fab GLBs named in SOURCES (Fab Standard License)
 *   refs dir    astera-refs: writes dist/v2/yarik/*.glb (full), dist/lite/v2/yarik/*.glb
 *               (half-size textures) and the `colliders` section of both manifests.
 * Simplifying and the self-crossing check are heavy: run it on the VPS, not the owner's PC.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Module from 'manifold-3d';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(realpathSync(join(ROOT, 'node_modules/@gltf-transform/cli/package.json')));
const { Document, NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTTextureWebP } = require('@gltf-transform/extensions');
const { simplify, weld } = require('@gltf-transform/functions');
const { MeshoptSimplifier } = require('meshoptimizer');
const sharp = require('sharp');

/** Field rock and landmark giants, by catalog key. `triangles` is the simplification target. */
const SOURCES = [
  { key: 'flint-01', family: 'rock', file: 'military_trenches_scatter_flint_rock_s_01_yfbmejis_low.glb', triangles: 1500, texture: 1024 },
  { key: 'flint-02', family: 'rock', file: 'military_trenches_scatter_flint_rock_s_02_yfbmdhgs_low.glb', triangles: 1500, texture: 1024 },
  { key: 'rock-07', family: 'rock', file: 'military_trenches_scatter_rock_s_07_ydzrche_mid.glb', triangles: 1800, texture: 1024 },
  { key: 'rock-09', family: 'rock', file: 'military_trenches_scatter_rock_s_09_ydxsbda_mid.glb', triangles: 1500, texture: 1024 },
  { key: 'nordic', family: 'rock', file: 'nordic_beach_rock_ukxkffifa_low.glb', triangles: 1500, texture: 1024 },
  // The Alaskan cliff scans cross themselves once simplified; they wait for a remesh-and-bake
  // pass (Y3). Until then the giants are the closed mid-detail scans.
  { key: 'nordic-giant', family: 'giant', file: 'nordic_beach_rock_ukxkffifa_mid.glb', triangles: 3000, texture: 2048 },
  { key: 'flint-giant', family: 'giant', file: 'military_trenches_scatter_flint_rock_s_01_yfbmejis_mid.glb', triangles: 3000, texture: 2048 },
];
/** Crystal deposits: a small rock grown with shards. */
const CRYSTALS = [
  { key: 'crystal-a', base: 'flint-01', seed: 11, shards: 6 },
  { key: 'crystal-b', base: 'rock-09', seed: 23, shards: 7 },
  { key: 'crystal-c', base: 'nordic', seed: 37, shards: 5 },
  { key: 'crystal-d', base: 'flint-02', seed: 41, shards: 8 },
];
const CRYSTAL_BASE_TRIANGLES = 500;
const QUANT = 32767;
/** Keeps every quantised corner inside the unit ball. */
const SHRINK = 0.9999;
/** Space tone: desaturate, darken and cool the ground-rock scans (sRGB, applied once here). */
const TONE = { saturation: 0.45, brightness: 0.74, tint: [0.93, 0.97, 1.05] };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function fail(message) { throw new Error(`arena-colliders: ${message}`); }

/** Every primitive of the file in world space, merged; plus the first material's images. */
async function readSource(file) {
  const doc = await io.read(file);
  const positions = []; const normals = []; const uvs = []; const indices = [];
  let material = null;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      material ??= prim.getMaterial();
      const p = prim.getAttribute('POSITION').getArray();
      const n = prim.getAttribute('NORMAL')?.getArray();
      const t = prim.getAttribute('TEXCOORD_0')?.getArray();
      const base = positions.length / 3;
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i]; const y = p[i + 1]; const z = p[i + 2];
        positions.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
        if (n) {
          const a = n[i]; const b = n[i + 1]; const c = n[i + 2];
          const nx = m[0] * a + m[4] * b + m[8] * c; const ny = m[1] * a + m[5] * b + m[9] * c; const nz = m[2] * a + m[6] * b + m[10] * c;
          const length = Math.hypot(nx, ny, nz) || 1;
          normals.push(nx / length, ny / length, nz / length);
        } else normals.push(0, 0, 0);
        if (t) uvs.push(t[(i / 3) * 2], t[(i / 3) * 2 + 1]); else uvs.push(0, 0);
      }
      const index = prim.getIndices()?.getArray();
      const count = index ? index.length : p.length / 3;
      for (let k = 0; k < count; k++) indices.push(base + (index ? index[k] : k));
    }
  }
  if (!material) fail(`${file}: no material`);
  // Scans arrive in parts whose shared borders differ in the last bits. Snapped to 1e-5 of the
  // model's size they become bit-identical, so the simplifier sees one closed shell, not loose
  // borders that it thins on each side separately.
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], positions[i + k]); max[k] = Math.max(max[k], positions[i + k]); }
  const step = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * 1e-5;
  for (let i = 0; i < positions.length; i++) positions[i] = Math.round(positions[i] / step) * step;
  const image = texture => texture ? Buffer.from(texture.getImage()) : null;
  return {
    mesh: { positions: Float32Array.from(positions), normals: Float32Array.from(normals), uvs: Float32Array.from(uvs), indices: Uint32Array.from(indices) },
    images: { map: image(material.getBaseColorTexture()), normal: image(material.getNormalTexture()), occlusion: image(material.getOcclusionTexture()) },
  };
}

/**
 * meshoptimizer through gltf-transform: UV seams collapse together, so the shell stays closed.
 * Collapsing a thin spot can push one face through another; the target then steps down 2 % at
 * a time until the surface no longer crosses itself (same input, same answer).
 */
async function simplifyMesh(mesh, triangles) {
  const current = mesh.indices.length / 3;
  if (current <= triangles) return { mesh, ratio: 1 };
  for (let attempt = 0; attempt < 12; attempt++) {
    const result = await simplifyOnce(mesh, Math.round(triangles * (1 - 0.02 * attempt)));
    const { corners, indices } = weldFloat(result.positions, result.indices);
    if (crossings(corners, indices) === 0) return { mesh: result, ratio: result.indices.length / 3 / current };
  }
  return fail(`no simplification near ${triangles} triangles without a self-crossing`);
}

/** Corners welded by exact position: positions per corner and triangles over them. */
function weldFloat(positions, source) {
  const id = new Map(); const corners = []; const indices = new Uint32Array(source.length);
  for (let k = 0; k < source.length; k++) {
    const i = source[k] * 3;
    const key = `${positions[i]},${positions[i + 1]},${positions[i + 2]}`;
    let n = id.get(key);
    if (n === undefined) { n = id.size; id.set(key, n); corners.push(positions[i], positions[i + 1], positions[i + 2]); }
    indices[k] = n;
  }
  return { corners: Float64Array.from(corners), indices };
}

/**
 * Pairs of triangles that cross each other (sharing no edge). A crossing makes a pocket the
 * inside test counts wrong; a pinch (two lobes on one edge) does not, so it is allowed.
 */
function crossings(p, indices) {
  const triangles = indices.length / 3;
  const box = new Float64Array(triangles * 6);
  for (let t = 0; t < triangles; t++) {
    for (let k = 0; k < 3; k++) {
      const a = p[indices[t * 3] * 3 + k]; const b = p[indices[t * 3 + 1] * 3 + k]; const c = p[indices[t * 3 + 2] * 3 + k];
      box[t * 6 + k] = Math.min(a, b, c); box[t * 6 + 3 + k] = Math.max(a, b, c);
    }
  }
  const order = Array.from({ length: triangles }, (_, t) => t).sort((a, b) => box[a * 6] - box[b * 6]);
  const corner = (t, e) => indices[t * 3 + e];
  const point = v => [p[v * 3], p[v * 3 + 1], p[v * 3 + 2]];
  /** Does segment a→b pass through the inside of triangle t (not just touch a shared corner)? */
  const pierces = (a, b, t, shared) => {
    const [o, d] = [point(a), point(b)].map((v, i, all) => i === 0 ? v : v.map((x, k) => x - all[0][k]));
    const v0 = point(corner(t, 0)); const v1 = point(corner(t, 1)); const v2 = point(corner(t, 2));
    const e1 = v1.map((x, k) => x - v0[k]); const e2 = v2.map((x, k) => x - v0[k]);
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-18) return false;
    const s = o.map((x, k) => x - v0[k]);
    const u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
    const k = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    const eps = 1e-9;
    if (u < -eps || v < -eps || u + v > 1 + eps || k < -eps || k > 1 + eps) return false;
    if (shared < 0) return true;
    const hit = o.map((x, i) => x + d[i] * k); const at = point(shared);
    return Math.hypot(hit[0] - at[0], hit[1] - at[1], hit[2] - at[2]) > 1e-7;
  };
  let found = 0;
  for (let i = 0; i < triangles; i++) {
    const a = order[i];
    for (let j = i + 1; j < triangles; j++) {
      const b = order[j];
      if (box[b * 6] > box[a * 6 + 3]) break;
      if (box[b * 6 + 1] > box[a * 6 + 4] || box[a * 6 + 1] > box[b * 6 + 4] || box[b * 6 + 2] > box[a * 6 + 5] || box[a * 6 + 2] > box[b * 6 + 5]) continue;
      const common = [0, 1, 2].map(e => corner(a, e)).filter(v => [0, 1, 2].some(e => corner(b, e) === v));
      if (common.length >= 2) continue;
      const shared = common.length === 1 ? common[0] : -1;
      let hit = false;
      for (let e = 0; e < 3 && !hit; e++) {
        hit = pierces(corner(a, e), corner(a, (e + 1) % 3), b, shared) || pierces(corner(b, e), corner(b, (e + 1) % 3), a, shared);
      }
      if (hit) found++;
    }
  }
  return found;
}

async function simplifyOnce(mesh, triangles) {
  const current = mesh.indices.length / 3;
  await MeshoptSimplifier.ready;
  const doc = new Document();
  const buffer = doc.createBuffer();
  const accessor = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', accessor(mesh.positions, 'VEC3'))
    .setAttribute('NORMAL', accessor(mesh.normals, 'VEC3'))
    .setAttribute('TEXCOORD_0', accessor(mesh.uvs, 'VEC2'))
    .setIndices(accessor(mesh.indices, 'SCALAR'));
  doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(prim)));
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: triangles / current, error: 0.05, lockBorder: false }));
  const out = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const positions = Float32Array.from(out.getAttribute('POSITION').getArray());
  return {
    positions,
    normals: Float32Array.from(out.getAttribute('NORMAL').getArray()),
    uvs: Float32Array.from(out.getAttribute('TEXCOORD_0').getArray()),
    indices: dropFolds(positions, out.getIndices().getArray()),
  };
}

/**
 * The simplifier can fold a thin spot into a flap: two triangles on the same three corners,
 * wound opposite ways, a sheet with no inside. The pair cancels edge for edge, so dropping
 * both leaves the shell closed (checkShell verifies it).
 */
function dropFolds(positions, indices) {
  const id = new Map();
  const corner = i => { const k = `${positions[i * 3]},${positions[i * 3 + 1]},${positions[i * 3 + 2]}`; let n = id.get(k); if (n === undefined) { n = id.size; id.set(k, n); } return n; };
  const seen = new Map(); const dropped = new Set();
  for (let t = 0; t < indices.length; t += 3) {
    const v = [corner(indices[t]), corner(indices[t + 1]), corner(indices[t + 2])];
    const set = [...v].sort((a, b) => a - b).join(',');
    const other = seen.get(set);
    if (other === undefined) { seen.set(set, { t, v }); continue; }
    const same = [0, 1, 2].some(r => other.v[0] === v[r] && other.v[1] === v[(r + 1) % 3] && other.v[2] === v[(r + 2) % 3]);
    if (same) fail(`a triangle repeats with the same winding (${t / 3})`);
    dropped.add(other.t); dropped.add(t); seen.delete(set);
  }
  const kept = [];
  for (let t = 0; t < indices.length; t += 3) if (!dropped.has(t)) kept.push(indices[t], indices[t + 1], indices[t + 2]);
  return Uint32Array.from(kept);
}

/**
 * Centre on the bounds of the corners the triangles use, scale to bounding radius SHRINK,
 * quantise. Positions become exact multiples of 1/QUANT.
 */
function quantise(positions, indices) {
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (const v of indices) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], positions[v * 3 + k]); max[k] = Math.max(max[k], positions[v * 3 + k]); }
  const centre = [0, 1, 2].map(k => (min[k] + max[k]) / 2);
  let radius = 0;
  for (const v of indices) radius = Math.max(radius, Math.hypot(positions[v * 3] - centre[0], positions[v * 3 + 1] - centre[1], positions[v * 3 + 2] - centre[2]));
  const scale = SHRINK / radius;
  const q = new Int16Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) q[i + k] = Math.round((positions[i + k] - centre[k]) * scale * QUANT);
  return q;
}

/** The catalog form: one entry per distinct quantised corner; triangles keep their order. */
function weldQuantised(q, indices) {
  const id = new Map(); const unique = []; const out = new Uint32Array(indices.length);
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k] * 3;
    const key = `${q[i]},${q[i + 1]},${q[i + 2]}`;
    let n = id.get(key);
    if (n === undefined) { n = id.size; id.set(key, n); unique.push(q[i], q[i + 1], q[i + 2]); }
    out[k] = n;
  }
  if (id.size > 65535) fail(`too many corners for uint16 indices (${id.size})`);
  return { positions: Int16Array.from(unique), indices: out };
}

/**
 * A closed, consistently wound, outward surface that never crosses itself: every directed
 * edge is used as often as its reverse (two lobes may touch on an edge), no zero-area triangle.
 */
function checkShell(key, positions, indices) {
  const directed = new Map();
  for (let t = 0; t < indices.length; t += 3) for (let e = 0; e < 3; e++) {
    const a = indices[t + e]; const b = indices[t + (e + 1) % 3];
    const edge = a * 65536 + b;
    directed.set(edge, (directed.get(edge) ?? 0) + 1);
  }
  let open = 0;
  for (const [edge, uses] of directed) {
    const a = Math.floor(edge / 65536); const b = edge % 65536;
    if (directed.get(b * 65536 + a) !== uses) open++;
  }
  const crossed = crossings(Float64Array.from(positions, v => v / QUANT), indices);
  let volume = 0; let flat = 0;
  const p = i => [positions[i * 3] / QUANT, positions[i * 3 + 1] / QUANT, positions[i * 3 + 2] / QUANT];
  for (let t = 0; t < indices.length; t += 3) {
    const [ax, ay, az] = p(indices[t]); const [bx, by, bz] = p(indices[t + 1]); const [cx, cy, cz] = p(indices[t + 2]);
    volume += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
    const ux = bx - ax; const uy = by - ay; const uz = bz - az; const vx = cx - ax; const vy = cy - ay; const vz = cz - az;
    const nx = uy * vz - uz * vy; const ny = uz * vx - ux * vz; const nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz <= 1e-24) flat++;
  }
  if (open || crossed || flat || !(volume > 0)) fail(`${key}: unmatched edges ${open}, self-crossings ${crossed}, zero-area ${flat}, volume ${volume}`);
}

/** Smooth normals over shared positions (seams included), area-weighted. */
function smoothNormals(q, indices) {
  const key = i => `${q[i * 3]},${q[i * 3 + 1]},${q[i * 3 + 2]}`;
  const sum = new Map();
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]].map(i => [q[i * 3], q[i * 3 + 1], q[i * 3 + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (let e = 0; e < 3; e++) {
      const k = key(indices[t + e]);
      const s = sum.get(k) ?? [0, 0, 0];
      s[0] += n[0]; s[1] += n[1]; s[2] += n[2]; sum.set(k, s);
    }
  }
  const out = new Float32Array(q.length);
  for (let i = 0; i < q.length / 3; i++) {
    const s = sum.get(key(i)) ?? [0, 1, 0];
    const length = Math.hypot(s[0], s[1], s[2]) || 1;
    out[i * 3] = s[0] / length; out[i * 3 + 1] = s[1] / length; out[i * 3 + 2] = s[2] / length;
  }
  return out;
}

const base64 = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('base64');
const toLittleEndian16 = array => { if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) fail('big-endian host'); return array; };

/** Toned albedo (ambient occlusion multiplied in) and the normal map, as WebP at `size`. */
async function textures(images, size) {
  const { saturation: s, brightness: b, tint } = TONE;
  const l = [0.2126, 0.7152, 0.0722];
  const matrix = [0, 1, 2].map(r => [0, 1, 2].map(c => tint[r] * b * ((r === c ? s : 0) + (1 - s) * l[c])));
  let albedo = null;
  if (images.map) {
    let pipeline = sharp(images.map).removeAlpha().resize(size, size, { fit: 'fill' });
    if (images.occlusion) {
      const ao = await sharp(images.occlusion).extractChannel(0).resize(size, size, { fit: 'fill' }).toColourspace('srgb').toBuffer();
      pipeline = sharp(await pipeline.toBuffer()).composite([{ input: ao, blend: 'multiply' }]);
    }
    albedo = await sharp(await pipeline.toBuffer()).recomb(matrix).webp({ quality: 86 }).toBuffer();
  }
  const normal = images.normal ? await sharp(images.normal).removeAlpha().resize(size, size, { fit: 'fill' }).webp({ quality: 92 }).toBuffer() : null;
  return { albedo, normal };
}

/** One GLB: part 0 is rock (textured), part 1 (crystals) glows. */
async function writeModel(path, key, parts, maps) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const accessor = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
  const rock = doc.createMaterial('rock').setRoughnessFactor(0.92).setMetallicFactor(0);
  if (maps.albedo) rock.setBaseColorTexture(doc.createTexture('albedo').setImage(maps.albedo).setMimeType('image/webp'));
  if (maps.normal) rock.setNormalTexture(doc.createTexture('normal').setImage(maps.normal).setMimeType('image/webp'));
  const glow = doc.createMaterial('crystal').setBaseColorFactor([0.62, 0.96, 1, 1]).setEmissiveFactor([0.21, 0.9, 1])
    .setRoughnessFactor(0.3).setMetallicFactor(0.1);
  const mesh = doc.createMesh(key);
  parts.forEach((part, i) => {
    const prim = doc.createPrimitive().setMaterial(i === 0 ? rock : glow)
      .setAttribute('POSITION', accessor(part.positions, 'VEC3'))
      .setAttribute('NORMAL', accessor(part.normals, 'VEC3'))
      .setIndices(accessor(part.positions.length / 3 > 65535 ? part.indices : Uint16Array.from(part.indices), 'SCALAR'));
    if (part.uvs) prim.setAttribute('TEXCOORD_0', accessor(part.uvs, 'VEC2'));
    mesh.addPrimitive(prim);
  });
  doc.createScene(key).addChild(doc.createNode(key).setMesh(mesh));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, await io.writeBinary(doc));
}

/** Read the GLB back: its triangles, in order, must be the catalog's (float32 of q/QUANT). */
async function verifyModel(path, entry) {
  const doc = await io.read(path);
  const corners = [];
  for (const prim of doc.getRoot().listMeshes()[0].listPrimitives()) {
    const p = prim.getAttribute('POSITION').getArray(); const index = prim.getIndices().getArray();
    for (const i of index) corners.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
  }
  const { positions: q, indices } = entry.data;
  if (corners.length !== indices.length * 3) fail(`${path}: ${corners.length / 3} corners, catalog has ${indices.length}`);
  let worst = 0;
  for (let k = 0; k < indices.length; k++) for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(corners[k * 3 + c] - q[indices[k] * 3 + c] / QUANT));
  if (worst > 1e-6) fail(`${path}: drawn surface is ${worst} off the collider`);
  return worst;
}

/** The drawn form of a quantised mesh: float corners, normals, UVs; same triangle order. */
function drawn(q, mesh, smooth) {
  const positions = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) positions[i] = q[i] / QUANT;
  return { positions, normals: smooth ? smoothNormals(q, mesh.indices) : mesh.normals, uvs: mesh.uvs, indices: mesh.indices };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Distance from the centre to the base rock's surface along a unit direction. */
function surfaceAlong(mesh, d) {
  const p = mesh.positions; let best = Infinity;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]].map(i => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
    if (Math.abs(det) < 1e-12) continue;
    const s = [-a[0], -a[1], -a[2]];
    const u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det; if (u < 0 || u > 1) continue;
    const qv = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = (d[0] * qv[0] + d[1] * qv[1] + d[2] * qv[2]) / det; if (v < 0 || u + v > 1) continue;
    const t2 = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) / det;
    if (t2 > 0 && t2 < best) best = t2;
  }
  return Number.isFinite(best) ? best : 0.5;
}

/** A rock (unit, dequantised) grown with hexagonal shards; one closed surface, rock triangles first. */
function crystal(wasm, base, spec) {
  const { Manifold, Mesh } = wasm;
  const random = mulberry32(spec.seed);
  const n = base.positions.length / 3;
  const vert = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) {
    vert.set([base.positions[i * 3], base.positions[i * 3 + 1], base.positions[i * 3 + 2], base.uvs[i * 2], base.uvs[i * 2 + 1]], i * 5);
  }
  const shell = new Mesh({ numProp: 5, vertProperties: vert, triVerts: Uint32Array.from(base.indices) });
  shell.merge();
  const rock = new Manifold(shell).asOriginal();
  if (rock.status() !== 'NoError') fail(`${spec.key}: base rock is not a closed manifold (${rock.status()})`);
  const rockID = rock.originalID();
  const unit = () => { for (;;) { const v = [random() * 2 - 1, random() * 2 - 1, random() * 2 - 1]; const l = Math.hypot(...v); if (l > 0.2 && l <= 1) return v.map(x => x / l); } };
  const axis = unit();
  const shards = [];
  for (let s = 0; s < spec.shards; s++) {
    const jitter = unit();
    const d = axis.map((a, k) => a + jitter[k] * 0.85); const dl = Math.hypot(...d); const dir = d.map(x => x / dl);
    const side = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u = [dir[1] * side[2] - dir[2] * side[1], dir[2] * side[0] - dir[0] * side[2], dir[0] * side[1] - dir[1] * side[0]];
    const ul = Math.hypot(...u); u = u.map(x => x / ul);
    const w = [dir[1] * u[2] - dir[2] * u[1], dir[2] * u[0] - dir[0] * u[2], dir[0] * u[1] - dir[1] * u[0]];
    const reach = surfaceAlong(base, dir);
    const radius = 0.07 + random() * 0.08; const length = 0.35 + random() * 0.6; const turn = random() * Math.PI / 3;
    const root = reach * 0.45; const top = reach + length; const apex = top + radius * 2.2;
    const points = [];
    for (let k = 0; k < 6; k++) {
      const angle = turn + k * Math.PI / 3; const c = Math.cos(angle); const sn = Math.sin(angle);
      for (const along of [root, top]) {
        const r = along === root ? radius * 0.8 : radius;
        points.push([0, 1, 2].map(i => dir[i] * along + (u[i] * c + w[i] * sn) * r));
      }
    }
    points.push(dir.map(x => x * apex));
    shards.push(Manifold.hull(points).asOriginal());
  }
  const joined = Manifold.union([rock, ...shards]);
  const out = joined.getMesh();
  const props = out.numProp;
  const rockTriangles = []; const shardTriangles = [];
  for (let r = 0; r < out.runOriginalID.length; r++) {
    const list = out.runOriginalID[r] === rockID ? rockTriangles : shardTriangles;
    for (let k = out.runIndex[r]; k < out.runIndex[r + 1]; k++) list.push(out.triVerts[k]);
  }
  const count = out.vertProperties.length / props;
  const positions = new Float32Array(count * 3); const uvs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    positions.set(out.vertProperties.subarray(i * props, i * props + 3), i * 3);
    if (props >= 5) uvs.set(out.vertProperties.subarray(i * props + 3, i * props + 5), i * 2);
  }
  return { positions, uvs, normals: new Float32Array(count * 3), indices: Uint32Array.from([...rockTriangles, ...shardTriangles]), glowFrom: rockTriangles.length / 3 };
}

/** Shards are drawn faceted: one vertex per triangle corner with the face normal. Positions are unchanged. */
function facet(q, indices) {
  const positions = new Float32Array(indices.length * 3); const normals = new Float32Array(indices.length * 3);
  for (let t = 0; t < indices.length; t += 3) {
    const c = [0, 1, 2].map(e => [q[indices[t + e] * 3], q[indices[t + e] * 3 + 1], q[indices[t + e] * 3 + 2]]);
    const u = c[1].map((v, k) => v - c[0][k]); const v = c[2].map((x, k) => x - c[0][k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(...n) || 1;
    for (let e = 0; e < 3; e++) { positions.set(c[e].map(x => x / QUANT), (t + e) * 3); normals.set(n.map(x => x / l), (t + e) * 3); }
  }
  return { positions, normals, uvs: null, indices: Uint32Array.from({ length: indices.length }, (_, i) => i) };
}

async function main() {
  const [sourceDir, refsDir] = process.argv.slice(2);
  if (!sourceDir || !refsDir) fail('usage: arena-colliders.mjs <source dir> <refs dir>');
  const wasm = await Module(); wasm.setup();
  const entries = []; const models = []; const bases = new Map();

  for (const source of SOURCES) {
    const { mesh: raw, images } = await readSource(join(sourceDir, source.file));
    const { mesh, ratio } = await simplifyMesh(raw, source.triangles);
    const q = quantise(mesh.positions, mesh.indices);
    const data = weldQuantised(q, mesh.indices);
    checkShell(source.key, data.positions, data.indices);
    // Heavy simplification leaves the source normals describing detail that is gone.
    const parts = [drawn(q, mesh, ratio < 0.5)];
    entries.push({ key: source.key, family: source.family, glowFrom: data.indices.length / 3, data });
    models.push({ key: source.key, parts, images, size: source.texture });
    console.log(`${source.key}: ${raw.indices.length / 3} → ${mesh.indices.length / 3} triangles, ${data.positions.length / 3} corners`);
    if (CRYSTALS.some(c => c.base === source.key)) {
      const small = await simplifyMesh(raw, CRYSTAL_BASE_TRIANGLES);
      const unit = quantise(small.mesh.positions, small.mesh.indices);
      const positions = Float32Array.from(unit, v => v / QUANT);
      bases.set(source.key, { mesh: { ...small.mesh, positions }, images });
    }
  }

  for (const spec of CRYSTALS) {
    const base = bases.get(spec.base) ?? fail(`${spec.key}: no base ${spec.base}`);
    const grown = crystal(wasm, base.mesh, spec);
    const q = quantise(grown.positions, grown.indices);
    const data = weldQuantised(q, grown.indices);
    checkShell(spec.key, data.positions, data.indices);
    const rockPart = { indices: grown.indices.subarray(0, grown.glowFrom * 3) };
    const shardPart = grown.indices.subarray(grown.glowFrom * 3);
    const rockDrawn = drawn(q, { ...grown, indices: rockPart.indices }, true);
    entries.push({ key: spec.key, family: 'crystal', glowFrom: grown.glowFrom, data });
    models.push({ key: spec.key, parts: [rockDrawn, facet(q, shardPart)], images: base.images, size: 1024 });
    console.log(`${spec.key}: ${grown.glowFrom} rock + ${shardPart.length / 3} shard triangles`);
  }

  const manifest = { full: {}, lite: {} };
  for (const model of models) {
    const entry = entries.find(e => e.key === model.key);
    for (const [pack, folder, size] of [['full', 'dist/v2/yarik', model.size], ['lite', 'dist/lite/v2/yarik', model.size / 2]]) {
      const path = join(refsDir, folder, `${model.key}.glb`);
      await writeModel(path, model.key, model.parts, await textures(model.images, size));
      const worst = await verifyModel(path, entry);
      manifest[pack][model.key] = { model: `/__ref/${folder}/${model.key}.glb`, uvFlip: false, rotateY: 0, unit: true, ...(model.parts.length > 1 ? { glowMesh: 1 } : {}) };
      if (pack === 'full') console.log(`${model.key}: drawn = collider within ${worst.toExponential(1)}`);
    }
  }
  for (const [pack, file] of [['full', 'dist/v2/manifest.json'], ['lite', 'dist/v2/manifest-lite.json']]) {
    const path = join(refsDir, file);
    const json = JSON.parse(readFileSync(path, 'utf8'));
    json.colliders = manifest[pack];
    writeFileSync(path, JSON.stringify(json, null, 1) + '\n');
  }

  const lines = entries.map(e => `  { key: '${e.key}', family: '${e.family}', glowFrom: ${e.glowFrom},\n    positions: '${base64(toLittleEndian16(e.data.positions))}',\n    indices: '${base64(Uint16Array.from(e.data.indices))}' },`);
  const source = `// Generated by tools/arena-colliders.mjs — do not edit by hand. Sources: Megascans scatter rocks
// and Nordic beach rock (Fab Standard License); crystals are procedural.
import type { CatalogEntry } from './catalog.js';

export const ARENA_CATALOG: readonly CatalogEntry[] = [
${lines.join('\n')}
];
`;
  writeFileSync(join(ROOT, 'packages/rules/src/arena/catalog.generated.ts'), source);
  console.log(`catalog: ${entries.length} shapes, ${Math.round(source.length / 1024)} KB`);
}

export { checkShell, crossings, quantise, readSource, simplifyMesh, simplifyOnce, weldFloat, weldQuantised };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
