/**
 * PHOTOGRAPHS THE DYSON TEST PAGE, from the angles that can hide a bad fit.
 *
 *   pnpm --filter @astera/web dev
 *   node tools/dyson.mjs out/dyson
 *
 * `dyson.html` exists because the three shell radii in `DysonShells` cannot be
 * computed — see its docblock. This is how they are read: five core tiers side by
 * side, from three-quarters, from directly above and from edge-on, which is the
 * one angle a ring can pass while being wrong.
 *
 * WebGL runs on SwiftShader here, so everything is given time to settle.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * WHERE THE HOLE IN THE DYSON RING IS — the one number `DysonShells` cannot
 * compute for itself.
 *
 *   node tools/dyson.mjs --measure
 *
 * `unitModel` normalises every model to a bounding sphere of radius 1, and a
 * bounding sphere describes the OUTSIDE of a model. What decides whether a planet
 * fits inside a shell is the nearest vertex to the model's own origin, and that
 * has to be read out of the file. Run this after any re-export and copy the `min`
 * column into `SHELL_OPENING`.
 *
 * TAKE `p01`, NOT `min`. `min` is the innermost spar TIP and `p01` is where the
 * structure's inner face actually is — the ring's vertices cluster at 0.51 while a
 * few spars reach 0.36, and sizing on the tips inflates the shell by 42% for
 * geometry nobody can see. A spar reaching inside the world's radius is fine: a
 * world is a billboard, so there is no volume to pierce, and the half behind it is
 * masked by its depth write. See `SHELL_OPENING` in `DysonShells`.
 *
 * It dequantises into a temporary copy first: the shipped files are meshopt-
 * compressed and their positions are integers spanning the whole uint16 range,
 * which is the same trap `galaxy/model.ts` documents.
 */
/**
 * Only the ring ships. Every stage of the ladder is this one file drawn one to
 * four times at equal angles — see `SHELL_STAGE` — so there is one opening to
 * measure. The other exports stay under `assets/source/models/dyson/` and are
 * listed here so a re-measure after swapping the ring is a one-line change.
 */
const MODELS = ['apps/web/public/assets/models/dyson/dyson_1.glb'];

function chunks(path) {
  const buf = readFileSync(path);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buf.length) {
    const length = buf.readUInt32LE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type.startsWith('JSON')) json = JSON.parse(buf.toString('utf8', offset + 8, offset + 8 + length));
    else bin = buf.subarray(offset + 8, offset + 8 + length);
    offset += 8 + length;
  }
  return { json, bin };
}

function opening(path) {
  const { json, bin } = chunks(path);
  const primitive = json.meshes[0].primitives[0];
  const accessor = json.accessors[primitive.attributes.POSITION];
  const view = json.bufferViews[accessor.bufferView];
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? 12;

  // The model's real size lives on its node, not in the vertex data — see
  // `galaxy/model.ts`. Only the scale matters for a distance from the origin.
  const node = json.nodes.find((n) => n.mesh === 0);
  let scale = node.scale ?? [1, 1, 1];
  if (node.matrix) {
    const m = node.matrix;
    scale = [Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10])];
  }

  const lengths = [];
  for (let i = 0; i < accessor.count; i += 1) {
    const o = start + i * stride;
    lengths.push(
      Math.hypot(
        bin.readFloatLE(o) * scale[0],
        bin.readFloatLE(o + 4) * scale[1],
        bin.readFloatLE(o + 8) * scale[2],
      ),
    );
  }
  lengths.sort((a, b) => a - b);
  const max = lengths[lengths.length - 1];
  const at = (q) => lengths[Math.floor(lengths.length * q)] / max;
  return { min: lengths[0] / max, p01: at(0.01), p50: at(0.5), vertices: accessor.count };
}

const scratch = mkdtempSync(join(tmpdir(), 'dyson-'));
console.log('SHELL_OPENING — copy the p01 column\n');
console.log('  model      min     p01     p50    vertices');
for (const model of MODELS) {
  const plain = join(scratch, `${model.split('/').pop()}`);
  execFileSync('npx', ['gltf-transform', 'dequantize', model, plain], { stdio: 'pipe' });
  const { min, p01, p50, vertices } = opening(plain);
  const name = model.split('/').pop().replace('.glb', '');
  console.log(
    `  ${name}   ${min.toFixed(3)}   ${p01.toFixed(3)}   ${p50.toFixed(3)}   ${String(vertices)}`,
  );
}
