#!/usr/bin/env node
/**
 * The webp fallback for a renderer that cannot start the KTX2 transcoder (web `ktx2Ready`).
 * S22 2026-10-26: that phone's Chrome is a 32-bit build; with the galaxy up its renderer had no
 * 16 MB block left for the transcoder's heap, and the hangar and the Yarık waited on it for good.
 * The lite webp manifest (`manifest-lite.json`) already holds every map as webp at 512 except the
 * class ships; the Rift's structures are KTX2 in place. This writes both at 512 as webp:
 *
 *   node tools/arena-webp.mjs ships <arena-ships work dir> <refs dir>
 *     `dist/lite/v2/yarik/ships-webp/*.glb` from the work dir's 512 PNGs; the lite webp
 *     manifest's `ships.classes` points at them. Run after arena-ships `pack` (which points it
 *     back at the KTX2 ships) and after arena-ktx2 (which copies the classes into the KTX2 manifests).
 *   node tools/arena-webp.mjs structures <webp glb dir> <out dir>
 *     The structures as tools/yarik-structures.mjs wrote them (webp, before arena-ktx2 `glbs-pack`
 *     re-encodes them in place), every map shrunk to 512: apps/web/public/assets/arena/yarik-webp.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(realpathSync(join(ROOT, 'node_modules/@gltf-transform/cli/package.json')));
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { meshopt, textureCompress } = require('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptEncoder } = require('meshoptimizer');
const sharp = require('sharp');

/** Webp decodes to full RGBA on the GPU: every map at most 512. Quality as yarik-structures. */
export const FALLBACK = { px: 512, quality: 88, ships: 'dist/lite/v2/yarik/ships-webp', manifest: 'dist/v2/manifest-lite.json' };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
function fail(message) { throw new Error(`arena-webp: ${message}`); }

/** The class ships of a manifest, each pointed at its webp copy; engines and the rest kept. */
export function fallbackClasses(classes) {
  return Object.fromEntries(Object.entries(classes).map(([key, d]) => [key, { ...d, model: `/__ref/${FALLBACK.ships}/${key}.glb` }]));
}

const webp = () => textureCompress({ encoder: sharp, targetFormat: 'webp', quality: FALLBACK.quality, resize: [FALLBACK.px, FALLBACK.px] });

async function ships(workDir, refsDir) {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const manifestPath = join(refsDir, FALLBACK.manifest);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!manifest.ships.classes) fail(`${manifestPath} has no class ships: run arena-ships pack first`);
  for (const key of Object.keys(manifest.ships.classes)) {
    const json = JSON.parse(readFileSync(join(workDir, `${key}.gltf`), 'utf8'));
    const resources = {};
    for (const image of json.images ?? []) {
      const uri = image.uri.replace(/\.png$/, `-${String(FALLBACK.px)}.png`);
      resources[image.uri] = readFileSync(join(workDir, 'tex', uri)); image.mimeType = 'image/png';
    }
    for (const buffer of json.buffers ?? []) resources[buffer.uri] = readFileSync(join(workDir, buffer.uri));
    const doc = await io.readJSON({ json, resources });
    await doc.transform(webp(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const path = join(refsDir, FALLBACK.ships, `${key}.glb`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, await io.writeBinary(doc));
    console.log(`${key}: ${String(Math.round(readFileSync(path).length / 1024))} KB`);
  }
  manifest.ships.classes = fallbackClasses(manifest.ships.classes);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
}

async function structures(sourceDir, outDir) {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  mkdirSync(outDir, { recursive: true });
  let bytes = 0;
  for (const file of readdirSync(sourceDir).filter(name => name.endsWith('.glb')).sort()) {
    const doc = await io.read(join(sourceDir, file));
    if (doc.getRoot().listTextures().some(texture => texture.getMimeType() === 'image/ktx2')) fail(`${file} is KTX2: give the webp glbs`);
    await doc.transform(webp());
    const out = await io.writeBinary(doc);
    writeFileSync(join(outDir, file), out); bytes += out.length;
  }
  console.log(`structures: ${(bytes / 1048576).toFixed(1)} MB`);
}

async function main() {
  const [command, a, b] = process.argv.slice(2);
  if (command === 'ships' && a && b) return ships(a, b);
  if (command === 'structures' && a && b) return structures(a, b);
  return fail('usage: arena-webp.mjs ships <ships work dir> <refs dir> | structures <webp glb dir> <out dir>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
