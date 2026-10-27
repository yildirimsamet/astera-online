#!/usr/bin/env node
/**
 * Measures how well each class's hull capsules (CLASS_HULLS, packages/rules) fit its model
 * (plan 14 §8, Y4b). The LOD0 surface of each ship in astera-refs/dist/v2/yarik/ships is sampled
 * every 0.15 m at the size it is flown (15 m long); the result is the farthest any sample lies
 * outside the capsules. Vertices alone are not enough: a flat wing has them only at its corners.
 *
 *   pnpm exec tsx tools/arena-hulls.mjs check    every class ≤ 0.5 m, or exit 1
 *   pnpm exec tsx tools/arena-hulls.mjs fit      refit: a fuselage plus two mirrored pairs, the
 *                                                 least volume within 0.45 m (a minute or two)
 */
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASS_HULLS, SHIP_CLASSES } from '../packages/rules/src/arena/classes.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(realpathSync(join(ROOT, 'node_modules/@gltf-transform/cli/package.json')));
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { MeshoptDecoder } = require('meshoptimizer');

const LENGTH = 15; const SAMPLE = 0.15; const ACCEPT = 0.5; const FIT = 0.45; const THINNEST = 0.7;

async function surface(ship) {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const document = await io.read(join(ROOT, `astera-refs/dist/v2/yarik/ships/${ship}.glb`));
  const lod0 = document.getRoot().listNodes().find(node => node.getName() === 'lod0');
  if (!lod0) throw new Error(`arena-hulls: ${ship} has no lod0`);
  const points = []; const seen = new Set();
  const keep = (x, y, z) => {
    const key = `${Math.round(x / 0.1)},${Math.round(y / 0.1)},${Math.round(z / 0.1)}`;
    if (!seen.has(key)) { seen.add(key); points.push(x, y, z); }
  };
  lod0.traverse(node => {
    const mesh = node.getMesh(); if (!mesh) return;
    const m = node.getWorldMatrix();
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION'); const v = [0, 0, 0]; const w = [];
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, v);
        for (let k = 0; k < 3; k++) w.push((m[k] * v[0] + m[4 + k] * v[1] + m[8 + k] * v[2] + m[12 + k]) * LENGTH);
      }
      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : position.getCount();
      const at = i => (indices ? indices.getScalar(i) : i) * 3;
      for (let t = 0; t < count; t += 3) {
        const a = at(t); const b = at(t + 1); const c = at(t + 2);
        const edge = Math.max(Math.hypot(w[a] - w[b], w[a + 1] - w[b + 1], w[a + 2] - w[b + 2]),
          Math.hypot(w[a] - w[c], w[a + 1] - w[c + 1], w[a + 2] - w[c + 2]), Math.hypot(w[b] - w[c], w[b + 1] - w[c + 1], w[b + 2] - w[c + 2]));
        const n = Math.max(1, Math.ceil(edge / SAMPLE));
        for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
          const u = i / n; const s = j / n; const r = 1 - u - s;
          keep(w[a] * r + w[b] * u + w[c] * s, w[a + 1] * r + w[b + 1] * u + w[c + 1] * s, w[a + 2] * r + w[b + 2] * u + w[c + 2] * s);
        }
      }
    }
  });
  return Float64Array.from(points);
}

function outside(capsules, x, y, z) {
  let best = Infinity;
  for (const { ax, ay, az, bx, by, bz, r } of capsules) {
    const dx = bx - ax; const dy = by - ay; const dz = bz - az; const dd = dx * dx + dy * dy + dz * dz;
    const t = dd > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / dd)) : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t, z - az - dz * t) - r);
  }
  return best;
}
function overhang(capsules, points) {
  let most = 0;
  for (let i = 0; i < points.length; i += 3) most = Math.max(most, outside(capsules, points[i], points[i + 1], points[i + 2]));
  return most;
}
const volume = capsules => capsules.reduce((sum, { ax, ay, az, bx, by, bz, r }) =>
  sum + Math.PI * r * r * Math.hypot(bx - ax, by - ay, bz - az) + 4 / 3 * Math.PI * r ** 3, 0);

/** v: fuselage [z0, z1, y, r] on the centre line, then per pair [x0, y0, z0, x1, y1, z1, r]. */
function build(v) {
  const capsules = [{ ax: 0, ay: v[2], az: v[0], bx: 0, by: v[2], bz: v[1], r: v[3] }];
  for (let o = 4; o < v.length; o += 7) {
    capsules.push({ ax: v[o], ay: v[o + 1], az: v[o + 2], bx: v[o + 3], by: v[o + 4], bz: v[o + 5], r: v[o + 6] });
    capsules.push({ ax: -v[o], ay: v[o + 1], az: v[o + 2], bx: -v[o + 3], by: v[o + 4], bz: v[o + 5], r: v[o + 6] });
  }
  return capsules;
}
function cost(v, points) {
  const capsules = build(v); let penalty = 0;
  for (const { r } of capsules) if (r < THINNEST) penalty += (THINNEST - r) * 1e4;
  const most = overhang(capsules, points);
  if (most > FIT) penalty += (most - FIT) * 1e4 + 1e3;
  return volume(capsules) + penalty;
}
/** Nelder–Mead: enough for 18 smooth parameters with a penalty wall. */
function minimise(f, start, step, iterations) {
  const n = start.length;
  let simplex = [start.slice(), ...start.map((_, i) => start.map((v, j) => v + (i === j ? step : 0)))];
  let values = simplex.map(f);
  for (let it = 0; it < iterations; it++) {
    const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
    simplex = order.map(i => simplex[i]); values = order.map(i => values[i]);
    const centre = start.map((_, j) => simplex.slice(0, n).reduce((sum, p) => sum + p[j], 0) / n);
    const worst = simplex[n];
    const toward = k => centre.map((c, j) => c + k * (c - worst[j]));
    const reflected = toward(1); const fr = f(reflected);
    if (fr < values[0]) { const expanded = toward(2); const fe = f(expanded); [simplex[n], values[n]] = fe < fr ? [expanded, fe] : [reflected, fr]; }
    else if (fr < values[n - 1]) { simplex[n] = reflected; values[n] = fr; }
    else {
      const contracted = toward(-0.5); const fc = f(contracted);
      if (fc < values[n]) { simplex[n] = contracted; values[n] = fc; }
      else for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); values[i] = f(simplex[i]); }
    }
  }
  const best = values.indexOf(Math.min(...values));
  return { v: simplex[best], f: values[best] };
}
/** Fits from the current hull, which must be a fuselage followed by mirrored pairs. */
function fit(ship, points) {
  const hull = CLASS_HULLS[ship];
  const [body, ...rest] = hull;
  let best = [body.az, body.bz, body.ay, body.r];
  for (let i = 0; i < rest.length; i += 2) { const c = rest[i]; best.push(c.ax, c.ay, c.az, c.bx, c.by, c.bz, c.r); }
  const coarse = points.filter((_, i) => Math.floor(i / 3) % 6 === 0);
  let value = cost(best, coarse);
  for (const step of [0.6, 0.6, 0.2, 0.2]) { const r = minimise(v => cost(v, coarse), best, step, 1500); if (r.f <= value) ({ v: best, f: value } = r); }
  ({ v: best } = minimise(v => cost(v, points), best, 0.1, 600));
  return build(best.map(v => Math.round(v * 100) / 100));
}

const mode = process.argv[2] ?? 'check';
let failed = false;
for (const ship of SHIP_CLASSES) {
  const points = await surface(ship);
  const capsules = mode === 'fit' ? fit(ship, points) : CLASS_HULLS[ship];
  const most = overhang(capsules, points);
  failed ||= most > ACCEPT;
  console.log(`${ship.padEnd(8)} ${String(points.length / 3).padStart(6)} samples  outside ≤ ${most.toFixed(3)} m  volume ${volume(capsules).toFixed(0)} m³`);
  if (mode === 'fit') console.log(JSON.stringify(capsules));
}
if (failed) { console.error(`arena-hulls: a model reaches more than ${String(ACCEPT)} m outside its capsules`); process.exit(1); }
