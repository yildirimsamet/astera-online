#!/usr/bin/env node
/**
 * Builds the three class ships of the Rift (plan 14 §14.1, Y3): Akıncı, Muhafız, Kılavuz.
 * Each ship is written once, nose on +Z, centred and scaled to length 1, with three levels of
 * detail (nodes `lod0`, `lod1`, `lod2`) sharing one set of KTX2 textures, geometry compressed
 * with EXT_meshopt_compression.
 *
 * - Akıncı and Kılavuz keep their own maps; only the geometry is reduced.
 * - Muhafız's source has 208 k triangles and no textures: it is reduced to ~24 k, given a fresh
 *   UV atlas (xatlas) and its detail is baked from the full model into normal, AO, colour and
 *   emission maps.
 *
 * Usage (heavy: run on the VPS, not the owner's PC):
 *   node --max-old-space-size=3584 tools/arena-ships.mjs prepare <source dir> <work dir>
 *   sh <work dir>/ktx.sh <KTX-Software bin dir>      (KTX-Software 4.4, needs glibc: the host)
 *   node tools/arena-ships.mjs pack <work dir> <refs dir>
 * `pack` writes dist/v2/yarik/ships/*.glb (1K maps), dist/lite/v2/yarik/ships/*.glb (512) and
 * the `ships.classes` section of both manifests. All three sources are CC-BY-4.0: CREDITS.md.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { materialIndices } from './ship-lod-materials.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(realpathSync(join(ROOT, 'node_modules/@gltf-transform/cli/package.json')));
const { Document, NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, KHRMaterialsEmissiveStrength, KHRTextureBasisu } = require('@gltf-transform/extensions');
const { meshopt } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptSimplifier } = require('meshoptimizer');
const sharp = require('sharp');
const web = createRequire(join(ROOT, 'apps/web/package.json'));
const THREE = web('three');
const { MeshBVH } = web('three-mesh-bvh');
const rootRequire = createRequire(join(ROOT, 'package.json'));

/**
 * Source file, the turn (degrees about +Y) that puts its nose on +Z, how it is built, and the
 * nozzles the flames leave from (normalised model space). Measured 2026-10-22 by casting rays
 * from behind into each nozzle (seen from behind, the side and above): the point sits just
 * inside the nozzle's lip, `nozzle` is the lip's radius. The Akıncı burns through its two big
 * outer engines, the Muhafız through its two tank engines.
 */
const SHIPS = [
  { key: 'akinci', file: 'space_fighter.glb', rotateY: 0, build: 'keep', engines: [[0.182, 0.012, -0.09], [-0.182, 0.012, -0.09]], nozzle: 0.02 },
  { key: 'muhafiz', file: 'spaceship_concept.glb', rotateY: 90, build: 'bake', triangles: 24000, engines: [[0.223, -0.026, -0.485], [-0.223, -0.026, -0.485]], nozzle: 0.06 },
  { key: 'kilavuz', file: 'spaceship.glb', rotateY: 0, build: 'keep', engines: [[0.19, -0.051, -0.435], [-0.19, -0.051, -0.435]], nozzle: 0.048 },
];
/**
 * Triangle budgets for LOD0, LOD1 and LOD2 (plan §14.1, player ship), and the most each level may
 * move the surface, in ship lengths: a level stops short of its budget rather than deform more.
 */
const LODS = [25000, 8000, 2000];
const LOD_ERROR = [0.004, 0.02, 0.05];
const SIZES = { full: 1024, lite: 512 };
/** Bake: the cage (how far, in ship lengths, the low surface may sit from the full one), AO reach and rays. */
const BAKE = { size: 1024, cage: 0.012, aoReach: 0.05, aoRays: 16, padding: 4, crease: 60, chart: { maxCost: 8, normalDeviationWeight: 1 } };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
function fail(message) { throw new Error(`arena-ships: ${message}`); }

// ---------------------------------------------------------------- reading

/** Every primitive of the file, grouped by material, turned nose-on-+Z, centred and scaled to length 1. */
async function readShip(file, rotateY) {
  const doc = await io.read(file);
  const groups = new Map();
  const turn = THREE.MathUtils.degToRad(rotateY); const c = Math.cos(turn); const s = Math.sin(turn);
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().fromArray(m));
    const nm = normalMatrix.elements;
    for (const prim of mesh.listPrimitives()) {
      const material = prim.getMaterial() ?? fail(`${file}: a primitive without material`);
      const group = groups.get(material) ?? { material, positions: [], normals: [], uvs: [], indices: [] };
      groups.set(material, group);
      const p = prim.getAttribute('POSITION').getArray();
      const n = prim.getAttribute('NORMAL')?.getArray() ?? fail(`${file}: no normals`);
      const t = prim.getAttribute('TEXCOORD_0')?.getArray();
      const base = group.positions.length / 3;
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i]; const y = p[i + 1]; const z = p[i + 2];
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12]; const wy = m[1] * x + m[5] * y + m[9] * z + m[13]; const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        group.positions.push(c * wx + s * wz, wy, -s * wx + c * wz);
        const a = n[i]; const b = n[i + 1]; const d = n[i + 2];
        const nx = nm[0] * a + nm[3] * b + nm[6] * d; const ny = nm[1] * a + nm[4] * b + nm[7] * d; const nz = nm[2] * a + nm[5] * b + nm[8] * d;
        const length = Math.hypot(nx, ny, nz) || 1;
        group.normals.push((c * nx + s * nz) / length, ny / length, (-s * nx + c * nz) / length);
        if (t) group.uvs.push(t[(i / 3) * 2], t[(i / 3) * 2 + 1]); else group.uvs.push(0, 0);
      }
      const index = prim.getIndices()?.getArray();
      const count = index ? index.length : p.length / 3;
      for (let k = 0; k < count; k++) group.indices.push(base + (index ? index[k] : k));
    }
  }
  const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
  for (const g of groups.values()) for (let i = 0; i < g.positions.length; i += 3) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], g.positions[i + k]); max[k] = Math.max(max[k], g.positions[i + k]);
  }
  const centre = [0, 1, 2].map(k => (min[k] + max[k]) / 2); const scale = 1 / (max[2] - min[2]);
  const parts = [...groups.values()].map(g => ({
    material: g.material,
    positions: Float32Array.from(g.positions, (v, i) => (v - centre[i % 3]) * scale),
    normals: Float32Array.from(g.normals), uvs: Float32Array.from(g.uvs), indices: Uint32Array.from(g.indices),
  }));
  return { doc, parts, size: [0, 1, 2].map(k => (max[k] - min[k]) * scale) };
}

/** The glTF factors of a material, in linear units (metallic defaults to 1, per the spec). */
function factors(material) {
  const strength = material.getExtension('KHR_materials_emissive_strength')?.getEmissiveStrength() ?? 1;
  return {
    base: material.getBaseColorFactor().slice(0, 3), metal: material.getMetallicFactor(), rough: material.getRoughnessFactor(),
    emissive: material.getEmissiveFactor().map(v => v * strength),
  };
}

// ---------------------------------------------------------------- geometry

const triangles = part => part.indices.length / 3;

/** Drops unreferenced vertices and renumbers the rest. */
function compact(part, indices) {
  const map = new Int32Array(part.positions.length / 3).fill(-1);
  let next = 0;
  const out = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) { const v = indices[i]; if (map[v] < 0) map[v] = next++; out[i] = map[v]; }
  const pick = (array, width) => { const result = new Float32Array(next * width); for (let v = 0; v < map.length; v++) if (map[v] >= 0) for (let k = 0; k < width; k++) result[map[v] * width + k] = array[v * width + k]; return result; };
  return { ...part, positions: pick(part.positions, 3), normals: pick(part.normals, 3), uvs: pick(part.uvs, 2), indices: out };
}

/**
 * meshoptimizer on one part. A vertex shared by position but split by normal or UV is a seam:
 * the simplifier only slides it along the seam, so textures stay attached. Loose pieces smaller
 * than `error` (bolts, lights) are pruned: at that level they would be under a pixel anyway.
 * `across` lets it collapse seams too (the farthest level, where a smeared seam is sub-pixel).
 */
function simplifyPart(part, target, error, across = false) {
  if (triangles(part) <= target) return part;
  const [indices] = MeshoptSimplifier.simplify(part.indices, part.positions, 3, Math.max(3, target * 3), error, across ? ['Prune', 'Permissive'] : ['Prune']);
  return compact(part, indices);
}

/** Every part reduced in proportion to its share of the triangles, to `budget` in total. */
function reduce(parts, budget, error, across = false) {
  const total = parts.reduce((sum, part) => sum + triangles(part), 0);
  if (total <= budget) return parts;
  return parts.map(part => simplifyPart(part, Math.round(triangles(part) * budget / total), error, across)).filter(part => triangles(part) > 0);
}

/** Corners welded by exact position (normals and UVs dropped): the topology the bake simplifies. */
function weldPositions(parts) {
  const id = new Map(); const positions = []; const indices = []; const material = [];
  parts.forEach((part, m) => {
    for (let i = 0; i < part.indices.length; i++) {
      const v = part.indices[i];
      const key = `${part.positions[v * 3]},${part.positions[v * 3 + 1]},${part.positions[v * 3 + 2]}`;
      let n = id.get(key);
      if (n === undefined) { n = id.size; id.set(key, n); positions.push(part.positions[v * 3], part.positions[v * 3 + 1], part.positions[v * 3 + 2]); }
      indices.push(n);
      if (i % 3 === 0) material.push(m);
    }
  });
  return { positions: Float32Array.from(positions), indices: Uint32Array.from(indices), material: Uint8Array.from(material) };
}

/**
 * Splits corners whose faces meet at more than `crease` degrees, so a hard edge stays hard and the
 * normal map only carries the detail between edges.
 */
function creaseNormals(positions, indices, crease) {
  const faces = indices.length / 3; const faceNormal = new Float32Array(faces * 3);
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3();
  for (let f = 0; f < faces; f++) {
    a.fromArray(positions, indices[f * 3] * 3); b.fromArray(positions, indices[f * 3 + 1] * 3); c.fromArray(positions, indices[f * 3 + 2] * 3);
    const n = c.sub(b).cross(a.sub(b)); // area-weighted
    faceNormal.set([n.x, n.y, n.z], f * 3);
  }
  const around = Array.from({ length: positions.length / 3 }, () => []);
  for (let f = 0; f < faces; f++) for (let k = 0; k < 3; k++) around[indices[f * 3 + k]].push(f);
  const cos = Math.cos(THREE.MathUtils.degToRad(crease));
  const out = { positions: [], normals: [], indices: new Uint32Array(indices.length) };
  const made = new Map();
  const unit = (f, out3) => { const x = faceNormal[f * 3]; const y = faceNormal[f * 3 + 1]; const z = faceNormal[f * 3 + 2]; const l = Math.hypot(x, y, z) || 1; out3[0] = x / l; out3[1] = y / l; out3[2] = z / l; return out3; };
  const nf = [0, 0, 0]; const ng = [0, 0, 0];
  for (let f = 0; f < faces; f++) for (let k = 0; k < 3; k++) {
    const v = indices[f * 3 + k];
    unit(f, nf);
    let x = 0; let y = 0; let z = 0;
    for (const g of around[v]) { unit(g, ng); if (nf[0] * ng[0] + nf[1] * ng[1] + nf[2] * ng[2] >= cos) { x += faceNormal[g * 3]; y += faceNormal[g * 3 + 1]; z += faceNormal[g * 3 + 2]; } }
    const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
    const key = `${v}:${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
    let n = made.get(key);
    if (n === undefined) { n = made.size; made.set(key, n); out.positions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]); out.normals.push(x, y, z); }
    out.indices[f * 3 + k] = n;
  }
  return { positions: Float32Array.from(out.positions), normals: Float32Array.from(out.normals), indices: out.indices };
}

/** A fresh, non-overlapping UV atlas from xatlas, `size` texels wide with `padding` between charts. */
async function unwrap(mesh, size, padding, chart = {}) {
  const dir = dirname(rootRequire.resolve('xatlasjs/package.json'));
  const { Api } = await import(pathToFileURL(join(dir, 'dist/node/api.mjs')).href);
  const XAtlas = Api(rootRequire(join(dir, 'dist/node/xatlas.js')));
  const atlas = await new Promise(done => { const made = new XAtlas(() => done(made)); });
  if (mesh.positions.length / 3 > 65535) fail('xatlas takes 16-bit indices: too many corners to unwrap');
  atlas.createAtlas();
  atlas.addMesh(Uint16Array.from(mesh.indices), mesh.positions, mesh.normals, null, 'hull', true, false, 1);
  const result = atlas.generateAtlas({ maxIterations: 4, ...chart }, { resolution: size, padding, bilinear: true, rotateCharts: true });
  const out = result.meshes[0];
  atlas.destroyAtlas();
  const scaleU = Math.max(...out.vertex.coords1.filter((_, i) => i % 2 === 0)) > 1.5 ? 1 / result.width : 1;
  const scaleV = scaleU === 1 ? 1 : 1 / result.height;
  return {
    positions: out.vertex.vertices, normals: out.vertex.normals,
    uvs: Float32Array.from(out.vertex.coords1, (v, i) => v * (i % 2 === 0 ? scaleU : scaleV)),
    indices: Uint32Array.from(out.index),
  };
}

// ---------------------------------------------------------------- bake

function mulberry32(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Bakes the full model onto the low one's atlas. Per texel (2×2 samples): a ray along the low
 * normal finds the full surface within the cage; its material gives colour, roughness, metal
 * and emission, its normal is written in the low surface's tangent frame (glTF convention:
 * green up, i.e. against +V), and ambient occlusion is traced from it.
 */
function bake(low, high, palette) {
  const { size: N, cage, aoReach, aoRays } = BAKE;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(high.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(high.indices, 1));
  // Indirect: the BVH must not reorder the triangles, `high.material` is indexed by them.
  const bvh = new MeshBVH(geometry, { indirect: true });
  const highNormals = high.normals;
  const color = new Float32Array(N * N * 3); const orm = new Float32Array(N * N * 3); const glow = new Float32Array(N * N * 3);
  const normal = new Float32Array(N * N * 3); const weight = new Float32Array(N * N);
  const aoSum = new Float32Array(N * N); const aoCount = new Float32Array(N * N);
  const random = mulberry32(7);
  const ray = new THREE.Ray(); const P = new THREE.Vector3(); const Nl = new THREE.Vector3(); const T = new THREE.Vector3(); const B = new THREE.Vector3();
  const tri = new THREE.Triangle(); const bary = new THREE.Vector3(); const nh = new THREE.Vector3(); const nf = new THREE.Vector3();
  const tmp = new THREE.Vector3(); const closest = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
  const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]; const n = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const ha = new THREE.Vector3(); const hb = new THREE.Vector3(); const hc = new THREE.Vector3();
  const u = [0, 0, 0]; const v = [0, 0, 0];
  let missed = 0; let samples = 0;

  /** The full surface under the low point P along Nl: face, point, its shading and face normal (facing out). */
  const surface = () => {
    ray.origin.copy(P).addScaledVector(Nl, cage); ray.direction.copy(Nl).negate();
    const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, cage * 2);
    let face; let point;
    if (hit) { face = hit.faceIndex; point = hit.point; } else {
      missed++;
      bvh.closestPointToPoint(P, closest);
      face = closest.faceIndex; point = closest.point;
    }
    const i0 = high.indices[face * 3]; const i1 = high.indices[face * 3 + 1]; const i2 = high.indices[face * 3 + 2];
    ha.fromArray(high.positions, i0 * 3); hb.fromArray(high.positions, i1 * 3); hc.fromArray(high.positions, i2 * 3);
    tri.set(ha, hb, hc); tri.getNormal(nf); tri.getBarycoord(point, bary);
    nh.set(0, 0, 0)
      .addScaledVector(tmp.fromArray(highNormals, i0 * 3), bary.x)
      .addScaledVector(tmp.fromArray(highNormals, i1 * 3), bary.y)
      .addScaledVector(tmp.fromArray(highNormals, i2 * 3), bary.z).normalize();
    // A single-sided panel seen from behind shows its back.
    if (nf.dot(Nl) < 0) { nf.negate(); if (nh.dot(nf) < 0) nh.negate(); }
    return { face, point: point.clone() };
  };

  const occlusion = (point) => {
    let blocked = 0;
    for (let k = 0; k < aoRays; k++) {
      // Cosine-weighted direction about the face normal.
      const r1 = random(); const r2 = random(); const phi = 2 * Math.PI * r1; const sr = Math.sqrt(r2);
      const t1 = Math.abs(nf.x) < 0.9 ? tmp.set(1, 0, 0) : tmp.set(0, 1, 0);
      const ax = new THREE.Vector3().crossVectors(nf, t1).normalize(); const ay = new THREE.Vector3().crossVectors(nf, ax);
      ray.direction.copy(nf).multiplyScalar(Math.sqrt(1 - r2)).addScaledVector(ax, Math.cos(phi) * sr).addScaledVector(ay, Math.sin(phi) * sr).normalize();
      ray.origin.copy(point).addScaledVector(nf, 2e-5);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, aoReach);
      if (hit) blocked += 1 - hit.distance / aoReach;
    }
    return 1 - blocked / aoRays;
  };

  for (let f = 0; f < low.indices.length / 3; f++) {
    for (let k = 0; k < 3; k++) {
      const vtx = low.indices[f * 3 + k];
      p[k].fromArray(low.positions, vtx * 3); n[k].fromArray(low.normals, vtx * 3);
      u[k] = low.uvs[vtx * 2] * N; v[k] = low.uvs[vtx * 2 + 1] * N;
    }
    // Tangent frame from the UV gradients: T along +U, B along +V.
    const e1 = tmp.subVectors(p[1], p[0]).clone(); const e2 = new THREE.Vector3().subVectors(p[2], p[0]);
    const du1 = u[1] - u[0]; const dv1 = v[1] - v[0]; const du2 = u[2] - u[0]; const dv2 = v[2] - v[0];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) continue;
    const triT = e1.clone().multiplyScalar(dv2).addScaledVector(e2, -dv1).divideScalar(det);
    const triB = e2.clone().multiplyScalar(du1).addScaledVector(e1, -du2).divideScalar(det);
    const x0 = Math.max(0, Math.floor(Math.min(...u))); const x1 = Math.min(N - 1, Math.ceil(Math.max(...u)));
    const y0 = Math.max(0, Math.floor(Math.min(...v))); const y1 = Math.min(N - 1, Math.ceil(Math.max(...v)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const texel = y * N + x;
      let first = null;
      for (const [sx, sy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const px = x + sx; const py = y + sy;
        const w1 = ((px - u[0]) * dv2 - du2 * (py - v[0])) / det; const w2 = (du1 * (py - v[0]) - (px - u[0]) * dv1) / det; const w0 = 1 - w1 - w2;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        P.set(0, 0, 0).addScaledVector(p[0], w0).addScaledVector(p[1], w1).addScaledVector(p[2], w2);
        Nl.set(0, 0, 0).addScaledVector(n[0], w0).addScaledVector(n[1], w1).addScaledVector(n[2], w2).normalize();
        const hit = surface(); samples++;
        first ??= { point: hit.point, normal: nf.clone() };
        const look = palette[high.material[hit.face]];
        for (let c = 0; c < 3; c++) { color[texel * 3 + c] += look.base[c]; glow[texel * 3 + c] += look.emissive[c]; }
        orm[texel * 3 + 1] += look.rough; orm[texel * 3 + 2] += look.metal;
        T.copy(triT).addScaledVector(Nl, -Nl.dot(triT)).normalize();
        B.copy(triB).addScaledVector(Nl, -Nl.dot(triB)).addScaledVector(T, -T.dot(triB)).normalize();
        normal[texel * 3] += nh.dot(T); normal[texel * 3 + 1] += -nh.dot(B); normal[texel * 3 + 2] += nh.dot(Nl);
        weight[texel] += 1;
      }
      if (first) { nf.copy(first.normal); aoSum[texel] += occlusion(first.point); aoCount[texel] += 1; }
    }
  }
  console.log(`  bake: ${samples} samples, ${(missed / Math.max(1, samples) * 100).toFixed(2)} % outside the cage (nearest surface used)`);

  let covered = 0;
  for (let t = 0; t < N * N; t++) {
    const w = weight[t];
    if (w === 0) continue;
    covered++;
    const ao = aoCount[t] > 0 ? aoSum[t] / aoCount[t] : 1;
    for (let c = 0; c < 3; c++) { color[t * 3 + c] = color[t * 3 + c] / w * (0.4 + 0.6 * ao); glow[t * 3 + c] /= w; }
    orm[t * 3] = ao; orm[t * 3 + 1] /= w; orm[t * 3 + 2] /= w;
    const l = Math.hypot(normal[t * 3], normal[t * 3 + 1], normal[t * 3 + 2]) || 1;
    for (let c = 0; c < 3; c++) normal[t * 3 + c] /= l;
  }
  console.log(`  bake: ${(covered / (N * N) * 100).toFixed(1)} % of the atlas covered`);
  dilate([color, orm, glow, normal], weight, N, BAKE.padding * 2);
  return { color, orm, glow, normal };
}

/** Grows every chart outward `passes` texels, so filtering and mip levels never reach empty atlas. */
function dilate(maps, weight, N, passes) {
  const filled = Uint8Array.from(weight, w => (w > 0 ? 1 : 0));
  for (let pass = 0; pass < passes; pass++) {
    const next = filled.slice();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const t = y * N + x;
      if (filled[t]) continue;
      let count = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || !filled[ny * N + nx]) continue;
        const s = ny * N + nx;
        for (const map of maps) for (let c = 0; c < 3; c++) map[t * 3 + c] += map[s * 3 + c];
        count++;
      }
      if (count === 0) continue;
      for (const map of maps) for (let c = 0; c < 3; c++) map[t * 3 + c] /= count;
      next[t] = 1;
    }
    filled.set(next);
  }
}

const srgb = v => { const c = Math.min(1, Math.max(0, v)); return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055; };
async function png(values, N, encode) {
  const bytes = new Uint8Array(N * N * 3);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(encode(values[i], i % 3) * 255);
  return sharp(Buffer.from(bytes), { raw: { width: N, height: N, channels: 3 } }).png().toBuffer();
}

// ---------------------------------------------------------------- prepare

/** Writes `<work>/<key>.gltf` (LOD nodes, maps by id), every map at both sizes under tex/, ktx.sh and report.json. */
async function prepare(sourceDir, workDir) {
  await MeshoptSimplifier.ready;
  mkdirSync(join(workDir, 'tex'), { recursive: true });
  const ktx = ['#!/bin/sh', '# Generated by tools/arena-ships.mjs prepare. Usage: sh ktx.sh <KTX-Software bin dir>', 'set -e', 'K="$1"', 'cd "$(dirname "$0")/tex"'];
  const report = {};
  const maps = (key, name, images) => writeMaps(workDir, ktx, key, name, images);
  for (const ship of SHIPS) {
    const { parts, size } = await readShip(join(sourceDir, ship.file), ship.rotateY);
    const total = parts.reduce((sum, part) => sum + triangles(part), 0);
    console.log(`${ship.key}: ${total} triangles, ${parts.length} materials, size ${size.map(v => v.toFixed(3)).join(' × ')}`);
    let levels; let materials;
    if (ship.build === 'keep') {
      const lod0 = reduce(parts, LODS[0], LOD_ERROR[0]);
      levels = [lod0, reduce(lod0, LODS[1], LOD_ERROR[1]), reduce(lod0, LODS[2], LOD_ERROR[2], true)];
      materials = await keptMaterials(ship.key, parts, maps);
    } else {
      const high = weldPositions(parts);
      const highNormals = smoothNormals(high, parts);
      // No pruning here: a thin loose sheet (the canopy glass) would go, and the bake would see
      // the hull beneath it instead.
      const [reduced] = MeshoptSimplifier.simplify(high.indices, high.positions, 3, ship.triangles * 3, LOD_ERROR[0]);
      const creased = creaseNormals(high.positions, reduced, BAKE.crease);
      const low = await unwrap(creased, BAKE.size, BAKE.padding, BAKE.chart);
      console.log(`  low: ${low.indices.length / 3} triangles, ${low.positions.length / 3} corners after the atlas`);
      const palette = parts.map(part => factors(part.material));
      const baked = bake(low, { positions: high.positions, normals: highNormals, indices: high.indices, material: high.material }, palette);
      const strength = Math.max(1, ...palette.flatMap(look => look.emissive));
      const N = BAKE.size;
      const images = {
        base: await png(baked.color, N, v => srgb(v)), orm: await png(baked.orm, N, v => Math.min(1, Math.max(0, v))),
        normal: await png(baked.normal, N, v => Math.min(1, Math.max(0, v * 0.5 + 0.5))), emissive: await png(baked.glow, N, v => srgb(v / strength)),
      };
      const part = { positions: low.positions, normals: low.normals, uvs: low.uvs, indices: low.indices, material: 0 };
      levels = [[part], [simplifyPart(part, LODS[1], LOD_ERROR[1])], [simplifyPart(part, LODS[2], LOD_ERROR[2], true)]];
      materials = [{ name: `${ship.key}-hull`, base: [1, 1, 1], metal: 1, rough: 1, emissive: [1, 1, 1], strength, maps: await maps(ship.key, 'hull', images) }];
    }
    levels = materialIndices(parts, levels);
    await writeIntermediate(workDir, ship.key, levels, materials);
    report[ship.key] = { triangles: levels.map(lod => lod.reduce((sum, part) => sum + triangles(part), 0)), size };
    console.log(`  LOD triangles ${report[ship.key].triangles.join(' / ')}`);
  }
  writeFileSync(join(workDir, 'ktx.sh'), ktx.join('\n') + '\n');
  writeFileSync(join(workDir, 'report.json'), JSON.stringify(report, null, 1) + '\n');
}

/** Source shading normals carried onto the welded full model (the first corner at each position wins). */
function smoothNormals(high, parts) {
  const normals = new Float32Array(high.positions.length);
  const seen = new Uint8Array(high.positions.length / 3);
  let corner = 0;
  for (const part of parts) for (let i = 0; i < part.indices.length; i++, corner++) {
    const target = high.indices[corner];
    if (seen[target]) continue;
    seen[target] = 1;
    normals.set(part.normals.subarray(part.indices[i] * 3, part.indices[i] * 3 + 3), target * 3);
  }
  return normals;
}

/** A kept ship's own maps: base colour, packed occlusion-roughness-metal, normal and emission. */
async function keptMaterials(key, parts, maps) {
  const result = [];
  for (const [index, part] of parts.entries()) {
    const m = part.material;
    const look = factors(m);
    const image = texture => texture ? Buffer.from(texture.getImage()) : null;
    const orm = await packOrm(image(m.getOcclusionTexture()), image(m.getMetallicRoughnessTexture()), m.getOcclusionTexture() === m.getMetallicRoughnessTexture());
    const images = { base: image(m.getBaseColorTexture()), orm, normal: image(m.getNormalTexture()), emissive: image(m.getEmissiveTexture()) };
    const strength = m.getExtension('KHR_materials_emissive_strength')?.getEmissiveStrength() ?? 1;
    result.push({ name: `${key}-${index}`, base: look.base, metal: look.metal, rough: look.rough, emissive: m.getEmissiveFactor(), strength,
      maps: await maps(key, String(index), images) });
  }
  return result;
}

/**
 * Each map at both pack sizes as PNG under tex/, and the line of ktx.sh that turns it into
 * UASTC KTX2 with mips (normals without rate-distortion, so their gradients stay clean).
 */
async function writeMaps(workDir, ktx, key, name, images) {
  const slots = {};
  for (const [slot, image] of Object.entries(images)) {
    if (!image) continue;
    const id = `${key}-${name}-${slot}`;
    const linear = slot === 'normal' || slot === 'orm';
    for (const px of Object.values(SIZES)) {
      await sharp(image).removeAlpha().resize(px, px, { fit: 'fill', kernel: 'lanczos3' }).png().toFile(join(workDir, 'tex', `${id}-${px}.png`));
      ktx.push(`"$K/ktx" create --format ${linear ? 'R8G8B8_UNORM' : 'R8G8B8_SRGB'} --assign-tf ${linear ? 'linear' : 'srgb'} --encode uastc --uastc-quality 2${slot === 'normal' ? '' : ' --uastc-rdo --uastc-rdo-l 0.75'} --zstd 18 --generate-mipmap ${id}-${px}.png ${id}-${px}.ktx2`);
    }
    slots[slot] = id;
  }
  return slots;
}

/** glTF ORM: occlusion in R, roughness in G, metal in B. One shared texture is already packed. */
async function packOrm(occlusion, metalRough, shared) {
  if (!metalRough) return null;
  if (shared || !occlusion) return metalRough;
  const { width, height } = await sharp(metalRough).metadata();
  const r = await sharp(occlusion).extractChannel(0).resize(width, height, { fit: 'fill' }).raw().toBuffer();
  const gb = await sharp(metalRough).removeAlpha().raw().toBuffer();
  for (let i = 0; i < width * height; i++) gb[i * 3] = r[i];
  return sharp(gb, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/** The intermediate glTF: one node per LOD, maps referenced by id (`tex/<id>-<px>.ktx2` once encoded). */
async function writeIntermediate(workDir, key, levels, materials) {
  const doc = new Document();
  const buffer = doc.createBuffer().setURI(`${key}.bin`);
  const strength = doc.createExtension(KHRMaterialsEmissiveStrength);
  const accessor = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);
  const textures = new Map();
  const texture = id => {
    if (!textures.has(id)) textures.set(id, doc.createTexture(id).setURI(`${id}.png`).setMimeType('image/png').setImage(new Uint8Array(0)));
    return textures.get(id);
  };
  const made = materials.map(m => {
    const material = doc.createMaterial(m.name).setBaseColorFactor([...m.base, 1]).setMetallicFactor(m.metal).setRoughnessFactor(m.rough)
      .setEmissiveFactor(m.emissive).setDoubleSided(true);
    if (m.strength !== 1) material.setExtension('KHR_materials_emissive_strength', strength.createEmissiveStrength().setEmissiveStrength(m.strength));
    const t = m.maps;
    if (t.base) material.setBaseColorTexture(texture(t.base));
    if (t.orm) { material.setMetallicRoughnessTexture(texture(t.orm)); material.setOcclusionTexture(texture(t.orm)); }
    if (t.normal) material.setNormalTexture(texture(t.normal));
    if (t.emissive) material.setEmissiveTexture(texture(t.emissive));
    return material;
  });
  const scene = doc.createScene(key);
  levels.forEach((lod, level) => {
    const mesh = doc.createMesh(`${key}-lod${level}`);
    for (const part of lod) {
      mesh.addPrimitive(doc.createPrimitive().setMaterial(made[part.material])
        .setAttribute('POSITION', accessor(part.positions, 'VEC3')).setAttribute('NORMAL', accessor(part.normals, 'VEC3'))
        .setAttribute('TEXCOORD_0', accessor(part.uvs, 'VEC2'))
        .setIndices(accessor(part.positions.length / 3 > 65535 ? part.indices : Uint16Array.from(part.indices), 'SCALAR')));
    }
    scene.addChild(doc.createNode(`lod${level}`).setMesh(mesh));
  });
  const { json, resources } = await io.writeJSON(doc);
  writeFileSync(join(workDir, `${key}.gltf`), JSON.stringify(json));
  writeFileSync(join(workDir, `${key}.bin`), resources[`${key}.bin`]);
}

// ---------------------------------------------------------------- pack

async function pack(workDir, refsDir) {
  await MeshoptEncoder.ready;
  const report = JSON.parse(readFileSync(join(workDir, 'report.json'), 'utf8'));
  const manifest = { full: {}, lite: {} };
  for (const ship of SHIPS) {
    for (const [pack, folder, px] of [['full', 'dist/v2/yarik/ships', SIZES.full], ['lite', 'dist/lite/v2/yarik/ships', SIZES.lite]]) {
      const json = JSON.parse(readFileSync(join(workDir, `${ship.key}.gltf`), 'utf8'));
      const resources = {};
      for (const image of json.images ?? []) {
        const file = join(workDir, 'tex', image.uri.replace(/\.png$/, `-${px}.ktx2`));
        if (!existsSync(file)) fail(`${file} missing: run ktx.sh first`);
        image.uri = image.uri.replace(/\.png$/, '.ktx2'); image.mimeType = 'image/ktx2';
        resources[image.uri] = readFileSync(file);
      }
      for (const buffer of json.buffers ?? []) resources[buffer.uri] = readFileSync(join(workDir, buffer.uri));
      const doc = await io.readJSON({ json, resources });
      doc.createExtension(KHRTextureBasisu).setRequired(true);
      for (const texture of doc.getRoot().listTextures()) texture.setMimeType('image/ktx2');
      await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
      const path = join(refsDir, folder, `${ship.key}.glb`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, await io.writeBinary(doc));
      const kb = Math.round(readFileSync(path).length / 1024);
      manifest[pack][ship.key] = {
        model: `/__ref/${folder}/${ship.key}.glb`, uvFlip: false, rotateY: 0, unit: true, pbr: true, lods: 3,
        engines: ship.engines, nozzle: ship.nozzle,
      };
      console.log(`${pack} ${ship.key}: ${kb} KB, LOD ${report[ship.key].triangles.join(' / ')}`);
    }
  }
  for (const [pack, file] of [['full', 'dist/v2/manifest.json'], ['lite', 'dist/v2/manifest-lite.json']]) {
    const path = join(refsDir, file);
    const json = JSON.parse(readFileSync(path, 'utf8'));
    json.ships.classes = manifest[pack];
    writeFileSync(path, JSON.stringify(json, null, 1) + '\n');
  }
}

async function main() {
  const [command, a, b] = process.argv.slice(2);
  if (command === 'prepare' && a && b) return prepare(a, b);
  if (command === 'pack' && a && b) return pack(a, b);
  return fail('usage: arena-ships.mjs prepare <source dir> <work dir> | pack <work dir> <refs dir>');
}

export { creaseNormals, readShip, unwrap, weldPositions };
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
