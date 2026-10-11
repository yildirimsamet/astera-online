/** Optional local reference pack. Originals stay read-only; generated GLBs stay outside git/public. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const repository = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(repository, 'apps/web/src/galaxy/referenceArtManifest.json'), 'utf8'));
const sourceRoot = [process.env.ASTERA_REFS, join(repository, 'astera-refs'),
  resolve(repository, '../blindspace-komutan-gemisi/astera-refs')]
  .find(path => path && existsSync(join(path, 'dist/v2/manifest.json')));
if (!sourceRoot) throw new Error('Local reference archive missing. Set ASTERA_REFS to its directory.');
const outputRoot = join(repository, '.dev/reference-art/ships');
mkdirSync(outputRoot, { recursive: true });
const fromCli = createRequire(`${realpathSync(join(repository, 'node_modules/@gltf-transform/cli'))}/`);
const { NodeIO } = fromCli('@gltf-transform/core');
const { ALL_EXTENSIONS } = fromCli('@gltf-transform/extensions');
const { compactPrimitive, dequantize, prune, weld } = fromCli('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = fromCli('meshoptimizer');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
});
const triangles = document => document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives())
  .reduce((count, primitive) => count + (primitive.getIndices() ?? primitive.getAttribute('POSITION')).getCount() / 3, 0);

function optimize(source, target, ratio, error, textureSize) {
  execFileSync(join(repository, 'node_modules/.bin/gltf-transform'), ['optimize', source, target,
    '--texture-size', String(textureSize), '--texture-compress', 'webp', '--compress', 'meshopt',
    '--simplify', String(ratio < 1), '--simplify-ratio', String(ratio), '--simplify-error', String(error)],
  { stdio: 'pipe', cwd: repository });
}

/** Attribute-aware seam handling, bounded by geometric AND texture error. */
async function simplifyTo(source, target, ceiling, error, textureSize) {
  const document = await io.read(source);
  await document.transform(dequantize(), weld());
  const total = triangles(document);
  if (total > ceiling) {
    for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      const normal = primitive.getAttribute('NORMAL');
      const uv = primitive.getAttribute('TEXCOORD_0');
      const indices = primitive.getIndices();
      if (!position || !normal || !uv || !indices) throw new Error(`${source}: incomplete static ship geometry`);
      const attributes = new Float32Array(position.getCount() * 5);
      const n = [], t = [];
      for (let vertex = 0; vertex < position.getCount(); vertex++) {
        normal.getElement(vertex, n); uv.getElement(vertex, t);
        attributes.set([...n, ...t], vertex * 5);
      }
      const targetCount = Math.floor(indices.getCount() * ceiling / total / 3) * 3;
      const [simplified] = MeshoptSimplifier.simplifyWithAttributes(
        new Uint32Array(indices.getArray()), new Float32Array(position.getArray()), 3,
        attributes, 5, [0.5, 0.5, 0.5, 1, 1], null, targetCount, error, ['Permissive'],
      );
      indices.setArray(simplified);
      compactPrimitive(primitive);
    }
  }
  await document.transform(prune());
  const scratch = mkdtempSync(join(tmpdir(), 'astera-reference-'));
  try {
    const input = join(scratch, 'simplified.glb');
    await io.write(input, document);
    optimize(input, target, 1, error, textureSize);
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  return triangles(await io.read(target));
}

const report = [];
for (const [hull, { source }] of Object.entries(manifest)) {
  const original = join(sourceRoot, 'dist/subdivision/player_ships', `${source}.glb`);
  const full = join(outputRoot, `${hull.toLowerCase()}.glb`);
  const low = full.replace(/\.glb$/, '_lod.glb');
  const originalCount = triangles(await io.read(original));
  // The approved fleet ceiling also applies to the temporary art pack.
  const fullCount = await simplifyTo(original, full, 5000, 0.05, 1024);
  if (fullCount > 5000) throw new Error(`${hull}: full model still over 5000 triangles (${fullCount})`);

  const ceiling = Math.min(2000, Math.floor(fullCount * 0.6));
  const lowCount = await simplifyTo(full, low, ceiling, 0.1, 32);
  const lowDocument = await io.read(low);
  if (lowCount > ceiling) throw new Error(`${hull}: LOD over ${ceiling} triangles (${lowCount})`);
  // LOD uses the full model's material in the renderer; do not decode/upload another texture set.
  for (const mesh of lowDocument.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) primitive.setMaterial(null);
  }
  await lowDocument.transform(prune({ keepAttributes: true }));
  if (lowDocument.getRoot().listMeshes().some(mesh => mesh.listPrimitives().some(primitive => !primitive.getAttribute('TEXCOORD_0')))) {
    throw new Error(`${hull}: geometry-only LOD must retain UVs for the shared full material`);
  }
  await io.write(low, lowDocument);
  const row = { hull, originalTriangles: originalCount, fullTriangles: fullCount, lowTriangles: lowCount,
    fullBytes: statSync(full).size, lowBytes: statSync(low).size };
  report.push(row);
  console.log(`${hull}: ${originalCount} → ${fullCount} / ${lowCount} tris · ${row.fullBytes} / ${row.lowBytes} bytes`);
}
writeFileSync(join(dirname(outputRoot), 'manifest.json'), JSON.stringify({ ships: report }, null, 2));
