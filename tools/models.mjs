/**
 * The model pipeline.
 *
 * Drop a raw `.glb` in `assets/source/models/…` and run this; the optimised copy
 * lands in the same relative path under `apps/web/public/assets/models/`. The
 * source file is the master and is never served.
 *
 *   node tools/models.mjs            # optimise everything
 *   node tools/models.mjs --inspect  # just report on what is there
 *
 * WHY IT EXISTS. The first model to arrive was a 3.48 MB Tripo export whose
 * geometry was already excellent — 976 triangles — and whose texture was a
 * 4096x4096 JPEG accounting for 97% of the file. JPEG is not a GPU format: it
 * decodes to raw RGBA, so that one ship would have cost 64 MB of video memory on a
 * phone. At 512px it costs 1 MB, and the ship renders about fifty pixels across.
 *
 * Everything here is offline. Nothing in this pipeline ships to the browser.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const SOURCE = 'assets/source/models';
const OUT = 'apps/web/public/assets/models';

/** A ship is fifty pixels across in the galaxy. This is already generous. */
const TEXTURE_SIZE = 512;

const inspectOnly = process.argv.includes('--inspect');

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else if (entry.name.endsWith('.glb')) found.push(path);
  }
  return found;
}

/** Reads the JSON chunk of a GLB without loading a parser. */
function describe(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'glTF') return null;

  let off = 12;
  let json = null;
  while (off < buf.length) {
    const len = buf.readUInt32LE(off);
    if (buf.toString('ascii', off + 4, off + 8).startsWith('JSON')) {
      json = JSON.parse(buf.toString('utf8', off + 8, off + 8 + len));
    }
    off += 8 + len;
  }
  if (!json) return null;

  let triangles = 0;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const idx = prim.indices ?? prim.attributes?.POSITION;
      if (idx !== undefined) triangles += json.accessors[idx].count / 3;
    }
  }

  return {
    bytes: buf.length,
    triangles: Math.round(triangles),
    materials: (json.materials ?? []).length,
    images: (json.images ?? []).map((i) => i.mimeType ?? 'external'),
    extensions: json.extensionsUsed ?? [],
  };
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

let sources;
try {
  sources = walk(SOURCE);
} catch {
  console.log(`No ${SOURCE} directory. Put master .glb files there.`);
  process.exit(0);
}

if (sources.length === 0) {
  console.log(`No .glb files under ${SOURCE}.`);
  process.exit(0);
}

for (const source of sources) {
  const target = join(OUT, relative(SOURCE, source));
  const before = describe(source);

  if (inspectOnly) {
    console.log(`${relative(SOURCE, source)}: ${kb(before.bytes)} · ${before.triangles} tris · ${before.images.join(', ')}`);
    continue;
  }

  mkdirSync(dirname(target), { recursive: true });
  execFileSync(
    'npx',
    [
      'gltf-transform',
      'optimize',
      source,
      target,
      '--texture-size',
      String(TEXTURE_SIZE),
      // WebP over KTX2 only because encoding KTX2 needs the `ktx` binary, which is
      // not a dependency worth adding for one ship. KTX2 stays compressed in VRAM
      // and is the better answer once there are many models.
      '--texture-compress',
      'webp',
      '--compress',
      'meshopt',
      // The geometry arrived from Tripo already at a sane budget; simplifying it
      // further only risks the silhouette.
      '--simplify',
      'false',
    ],
    { stdio: 'pipe' },
  );

  const after = describe(target);
  const ratio = (before.bytes / after.bytes).toFixed(1);
  console.log(
    `${relative(SOURCE, source)}: ${kb(before.bytes)} → ${kb(after.bytes)} (${ratio}x) · ${after.triangles} tris`,
  );
}
