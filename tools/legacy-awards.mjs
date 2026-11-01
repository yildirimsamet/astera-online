#!/usr/bin/env node
/**
 * Komutan Mirası award models: third-party sources → small game GLBs.
 *
 *   node tools/legacy-awards.mjs <source dir> [out dir]
 *
 * The source dir holds the downloaded originals under their own names (the owner keeps them
 * outside the repository). Every model written here is CC BY 4.0 and credited in CREDITS.md;
 * a source without a commercial licence is never listed (see docs/commander-legacy-ui-2026-10-31.md).
 * Each one is welded, simplified to its triangle budget, every map is re-encoded as webp at
 * 512 and the geometry is meshopt-compressed, which drei's useGLTF decodes.
 */
import { createRequire } from 'node:module';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(realpathSync(join(ROOT, 'node_modules/@gltf-transform/cli/package.json')));
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { dedup, prune, weld, simplify, textureCompress, meshopt } = require('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = require('meshoptimizer');
const sharp = require('sharp');

/** Every shipped award model, its source file and its triangle budget. CREDITS.md names the authors. */
export const LEGACY_SOURCES = [
  { key: 'star-trophy', file: 'trophy_3d_model.glb', triangles: 9000 },
  { key: 'spire', file: 'drill_throp.glb', triangles: 3000 },
  { key: 'star-medal', file: 'medal.glb', triangles: 5000 },
  { key: 'moon-statue', file: 'moons_statue.glb', triangles: 4500 },
  { key: 'sputnik', file: 'badge_sputnik-1.glb', triangles: 3000 },
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const triangles = (doc) => doc.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives())
  .reduce((sum, prim) => sum + (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION')?.getCount() ?? 0) / 3, 0);

async function main() {
  const [source, out = join(ROOT, 'apps/web/public/assets/legacy/models')] = process.argv.slice(2);
  if (!source) throw new Error('usage: node tools/legacy-awards.mjs <source dir> [out dir]');
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  mkdirSync(out, { recursive: true });
  for (const model of LEGACY_SOURCES) {
    const doc = await io.read(join(source, model.file));
    const before = triangles(doc);
    const ratio = Math.min(1, model.triangles / before);
    await doc.transform(
      dedup(), prune(), weld(),
      ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 })] : []),
      textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 86, resize: [512, 512] }),
      prune(),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    const bytes = await io.writeBinary(doc);
    writeFileSync(join(out, `${model.key}.glb`), bytes);
    console.log(`${model.key}: ${String(Math.round(before))} → ${String(Math.round(triangles(doc)))} tris, ${String(Math.round(bytes.length / 1024))} KB`);
  }
}

await main();
