#!/usr/bin/env node
/**
 * Turns the reference pack's maps into KTX2 (plan 14 §14.1 step 4; Y3 gate: at most 120 MB of
 * textures on an iPhone). A webp decodes to full RGBA on the GPU; a KTX2 map stays
 * block-compressed there, a quarter of that.
 *
 * - The texture table (`tex/*.webp`): `tex/*.ktx2` beside each source.
 * - The sky's six faces: one cube, `sky/cube.ktx2`. The small light cube stays webp.
 * - The models the arena loads beside the class ships (colliders, structures, props): their own
 *   maps re-encoded, written as `<name>-ktx2.glb` beside each source.
 * - Effects stay webp: small alpha sprites, a few MB in all.
 * The webp pack and its manifests are left as they are; `manifest-ktx2.json` and
 * `manifest-lite-ktx2.json` point at the copies. Run it after arena-ships and arena-colliders:
 * it starts from what their manifests say.
 * - The Rift's structures (`glbs-prepare`/`glbs-pack`, apps/web/public/assets/arena/yarik): every
 *   glb's maps re-encoded in place, after tools/yarik-structures.mjs wrote them with webp. A map
 *   several glbs share (the kit's) is encoded once.
 *
 * Usage (encoding is heavy: run on the VPS, not the owner's PC):
 *   node tools/arena-ktx2.mjs prepare <refs dir> <work dir>      (or glbs-prepare <glb dir> <work dir>)
 *   sh <work dir>/ktx.sh <KTX-Software bin dir>      (KTX-Software 4.4, needs glibc: the host)
 *   node tools/arena-ktx2.mjs pack <work dir> <refs dir>         (or glbs-pack <work dir> <glb dir>)
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(realpathSync(join(ROOT, 'node_modules/@gltf-transform/cli/package.json')));
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, KHRTextureBasisu } = require('@gltf-transform/extensions');
const { MeshoptDecoder, MeshoptEncoder } = require('meshoptimizer');
const sharp = require('sharp');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

/** Each pack: its webp manifest and the KTX2 one written beside it. */
const PACKS = [['full', 'dist/v2/manifest.json', 'dist/v2/manifest-ktx2.json'], ['lite', 'dist/v2/manifest-lite.json', 'dist/v2/manifest-lite-ktx2.json']];

function fail(message) { throw new Error(`arena-ktx2: ${message}`); }

const ktx2Path = path => path.replace(/\.(webp|png|jpe?g)$/, '.ktx2');
const glbPath = path => path.replace(/\.glb$/, '-ktx2.glb');
/** A manifest path (`/__ref/dist/…`) as a file in the refs dir. */
const local = (refsDir, path) => join(refsDir, path.replace(/^\/__ref\//, ''));

/** Every model descriptor a manifest holds. */
function descriptors(m) {
  return [m.ships.hero, ...m.ships.rivals, ...Object.values(m.ships.classes ?? {}), ...m.rocks, ...m.giants, ...m.crystals, ...m.shards,
    ...Object.values(m.structures).flat(), m.props.cargo, ...m.props.debris, ...Object.values(m.colliders ?? {})];
}

/** Each texture-table map's role: a normal map when a model uses it as one or its name ends in -n; colour otherwise. */
export function tableRoles(m) {
  const normals = new Set();
  for (const d of descriptors(m)) for (const maps of [d.maps, ...(d.meshMaps ?? [])]) if (maps?.normalMap) normals.add(maps.normalMap);
  return new Map(Object.values(m.textures).map(path => [path, normals.has(path) || /-n\.\w+$/.test(path) ? 'normal' : 'color']));
}

/** Each of a model's maps by the material slot that reads it: colour, normal, or linear data (ORM). */
export function glbRoles(doc) {
  const roles = new Map();
  for (const material of doc.getRoot().listMaterials()) {
    for (const [texture, role] of [[material.getBaseColorTexture(), 'color'], [material.getEmissiveTexture(), 'color'], [material.getNormalTexture(), 'normal'],
      [material.getMetallicRoughnessTexture(), 'linear'], [material.getOcclusionTexture(), 'linear']]) {
      if (texture && !roles.has(texture)) roles.set(texture, role);
    }
  }
  return roles;
}

/** The models the arena loads beside the class ships (web `modelsToLoad`), each file once. */
export function modelsToConvert(m) {
  return [...new Set([...Object.values(m.colliders ?? {}), ...Object.values(m.structures).flat(), m.props.cargo, ...m.props.debris].map(d => d.model))];
}

/**
 * One line of ktx.sh, every map with mips (plan §14.1: albedo ETC1S, normal UASTC).
 * - `color` (albedo, emission): sRGB ETC1S, a third of UASTC's download for the same look.
 * - `sky`: sRGB UASTC; ETC1S smears its faint stars and steps the planet's limb.
 * - `normal`: linear UASTC without rate-distortion, so its gradients stay clean.
 * - `linear` (occlusion, roughness, metal): linear UASTC.
 */
export function ktxCommand(role, input, output, { alpha = false, cube = false } = {}) {
  const linear = role === 'normal' || role === 'linear';
  const format = `R8G8B8${alpha ? 'A8' : ''}_${linear ? 'UNORM' : 'SRGB'}`;
  const encode = role === 'color' ? '--encode basis-lz --clevel 2 --qlevel 255'
    : `--encode uastc --uastc-quality 2${role === 'normal' ? '' : ' --uastc-rdo --uastc-rdo-l 0.75'} --zstd 18`;
  return `"$K/ktx" create${cube ? ' --cubemap' : ''} --format ${format} --assign-tf ${linear ? 'linear' : 'srgb'} ${encode} --generate-mipmap ${input} ${output}`;
}

/**
 * The KTX2 manifest: every use of a converted map or model (the table, a model's `maps` and
 * `meshMaps`, its `model`) points at the copy, and the sky gains its cube. The source is left as it was.
 */
export function ktx2Manifest(m, done) {
  const swap = value => {
    if (typeof value === 'string') return done.textures.has(value) ? ktx2Path(value) : done.models.has(value) ? glbPath(value) : value;
    if (Array.isArray(value)) return value.map(swap);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, swap(inner)]));
    return value;
  };
  const out = swap(m);
  if (done.cube) out.sky.cube = done.cube;
  return out;
}

// ---------------------------------------------------------------- prepare

/** An image as the 8-bit RGB (or RGBA, when it has real alpha) PNG `ktx create` reads. Answers whether alpha was kept. */
async function png(input, file, opaque = false) {
  const alpha = !opaque && !(await sharp(input).stats()).isOpaque;
  const image = sharp(input).toColourspace('srgb');
  await (alpha ? image.ensureAlpha() : image.removeAlpha()).png().toFile(file);
  return alpha;
}

async function prepare(refsDir, workDir) {
  mkdirSync(workDir, { recursive: true });
  const ktx = ['#!/bin/sh', '# Generated by tools/arena-ktx2.mjs prepare. Usage: sh ktx.sh <KTX-Software bin dir>', 'set -e', 'K="$1"', 'cd "$(dirname "$0")"'];
  let next = 0;
  const id = () => String(next++).padStart(4, '0');
  const encode = async (input, role) => {
    const name = id();
    const alpha = await png(input, join(workDir, `${name}.png`));
    ktx.push(ktxCommand(role, `${name}.png`, `${name}.ktx2`, { alpha }));
    return `${name}.ktx2`;
  };
  const jobs = {};
  for (const [pack, file] of PACKS) {
    const m = JSON.parse(readFileSync(join(refsDir, file), 'utf8'));
    const job = { textures: {}, models: {}, cube: null };
    for (const [path, role] of tableRoles(m)) job.textures[path] = await encode(readFileSync(local(refsDir, path)), role);
    const cube = id();
    const faces = [];
    for (const [i, path] of m.sky.faces.entries()) {
      faces.push(`${cube}-${String(i)}.png`);
      await png(readFileSync(local(refsDir, path)), join(workDir, faces[i]), true);
    }
    ktx.push(ktxCommand('sky', faces.join(' '), `${cube}.ktx2`, { cube: true }));
    job.cube = { path: `${dirname(m.sky.faces[0])}/cube.ktx2`, file: `${cube}.ktx2` };
    for (const path of modelsToConvert(m)) {
      const doc = await io.read(local(refsDir, path));
      const roles = glbRoles(doc);
      const files = [];
      for (const texture of doc.getRoot().listTextures()) {
        const image = texture.getImage();
        files.push(image && texture.getMimeType() !== 'image/ktx2' ? await encode(Buffer.from(image), roles.get(texture) ?? 'color') : null);
      }
      if (files.some(Boolean)) job.models[path] = files;
    }
    jobs[pack] = job;
    console.log(`${pack}: ${String(Object.keys(job.textures).length)} table maps, sky cube, ${String(Object.keys(job.models).length)} models`);
  }
  writeFileSync(join(workDir, 'jobs.json'), JSON.stringify(jobs, null, 1) + '\n');
  writeFileSync(join(workDir, 'ktx.sh'), ktx.join('\n') + '\n');
}

// ---------------------------------------------------------------- pack

async function pack(workDir, refsDir) {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const jobs = JSON.parse(readFileSync(join(workDir, 'jobs.json'), 'utf8'));
  const encoded = file => {
    const path = join(workDir, file);
    if (!existsSync(path)) fail(`${path} missing: run ktx.sh first`);
    return readFileSync(path);
  };
  for (const [name, file, out] of PACKS) {
    const job = jobs[name];
    const m = JSON.parse(readFileSync(join(refsDir, file), 'utf8'));
    const done = { textures: new Set(), models: new Set(), cube: null };
    let before = 0; let after = 0;
    const weigh = (source, copy) => { before += statSync(source).size; after += statSync(copy).size; };
    for (const [path, ktx] of Object.entries(job.textures)) {
      writeFileSync(local(refsDir, ktx2Path(path)), encoded(ktx));
      weigh(local(refsDir, path), local(refsDir, ktx2Path(path)));
      done.textures.add(path);
    }
    writeFileSync(local(refsDir, job.cube.path), encoded(job.cube.file));
    for (const face of m.sky.faces) before += statSync(local(refsDir, face)).size;
    after += statSync(local(refsDir, job.cube.path)).size;
    done.cube = job.cube.path;
    for (const [path, files] of Object.entries(job.models)) {
      const doc = await io.read(local(refsDir, path));
      doc.getRoot().listTextures().forEach((texture, i) => { if (files[i]) texture.setImage(encoded(files[i])).setMimeType('image/ktx2'); });
      doc.createExtension(KHRTextureBasisu).setRequired(true);
      for (const extension of doc.getRoot().listExtensionsUsed()) if (extension.extensionName === 'EXT_texture_webp') extension.dispose();
      await io.write(local(refsDir, glbPath(path)), doc);
      weigh(local(refsDir, path), local(refsDir, glbPath(path)));
      done.models.add(path);
    }
    writeFileSync(join(refsDir, out), JSON.stringify(ktx2Manifest(m, done), null, 1) + '\n');
    console.log(`${name}: ${out}; files ${(before / 1048576).toFixed(1)} MB webp → ${(after / 1048576).toFixed(1)} MB KTX2`);
  }
}

// ---------------------------------------------------------------- glbs

async function prepareGlbs(dir, workDir) {
  await MeshoptDecoder.ready;
  mkdirSync(workDir, { recursive: true });
  const ktx = ['#!/bin/sh', '# Generated by tools/arena-ktx2.mjs glbs-prepare. Usage: sh ktx.sh <KTX-Software bin dir>', 'set -e', 'K="$1"', 'cd "$(dirname "$0")"'];
  const byImage = new Map();
  const jobs = {};
  for (const file of readdirSync(dir).filter(name => name.endsWith('.glb')).sort()) {
    const doc = await io.read(join(dir, file));
    const roles = glbRoles(doc);
    const files = [];
    for (const texture of doc.getRoot().listTextures()) {
      const image = texture.getImage();
      if (!image || texture.getMimeType() === 'image/ktx2') { files.push(null); continue; }
      const role = roles.get(texture) ?? 'color';
      const hash = `${role}:${createHash('sha256').update(image).digest('hex')}`;
      if (!byImage.has(hash)) {
        const name = String(byImage.size).padStart(4, '0');
        const alpha = await png(Buffer.from(image), join(workDir, `${name}.png`));
        ktx.push(ktxCommand(role, `${name}.png`, `${name}.ktx2`, { alpha }));
        byImage.set(hash, `${name}.ktx2`);
      }
      files.push(byImage.get(hash));
    }
    if (files.some(Boolean)) jobs[file] = files;
  }
  writeFileSync(join(workDir, 'jobs.json'), JSON.stringify(jobs, null, 1) + '\n');
  writeFileSync(join(workDir, 'ktx.sh'), ktx.join('\n') + '\n');
  console.log(`glbs: ${String(Object.keys(jobs).length)} models, ${String(byImage.size)} distinct maps`);
}

async function packGlbs(workDir, dir) {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const jobs = JSON.parse(readFileSync(join(workDir, 'jobs.json'), 'utf8'));
  let before = 0; let after = 0;
  for (const [file, files] of Object.entries(jobs)) {
    const path = join(dir, file);
    before += statSync(path).size;
    const doc = await io.read(path);
    doc.getRoot().listTextures().forEach((texture, i) => {
      if (!files[i]) return;
      const encoded = join(workDir, files[i]);
      if (!existsSync(encoded)) fail(`${encoded} missing: run ktx.sh first`);
      texture.setImage(readFileSync(encoded)).setMimeType('image/ktx2');
    });
    doc.createExtension(KHRTextureBasisu).setRequired(true);
    for (const extension of doc.getRoot().listExtensionsUsed()) if (extension.extensionName === 'EXT_texture_webp') extension.dispose();
    await io.write(path, doc);
    after += statSync(path).size;
  }
  console.log(`glbs: ${String(Object.keys(jobs).length)} models; files ${(before / 1048576).toFixed(1)} MB webp → ${(after / 1048576).toFixed(1)} MB KTX2`);
}

async function main() {
  const [command, a, b] = process.argv.slice(2);
  if (command === 'prepare' && a && b) return prepare(a, b);
  if (command === 'pack' && a && b) return pack(a, b);
  if (command === 'glbs-prepare' && a && b) return prepareGlbs(a, b);
  if (command === 'glbs-pack' && a && b) return packGlbs(a, b);
  return fail('usage: arena-ktx2.mjs prepare <refs dir> <work dir> | pack <work dir> <refs dir> | glbs-prepare <glb dir> <work dir> | glbs-pack <work dir> <glb dir>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
