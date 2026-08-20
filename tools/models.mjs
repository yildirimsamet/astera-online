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

/**
 * ONE POLICY PER KIND, because the kinds are not alike.
 *
 * The pipeline used to apply a single setting to everything, which was right when
 * the only models were two ships whose geometry had arrived already sane. It
 * stopped being right the moment asteroids turned up: those export at 17,000 to
 * 23,000 triangles each, and the galaxy draws around forty of them at once. At the
 * old "never simplify" rule that is close to a million triangles of background
 * rock on a phone that also has to draw the disc, the fleets and the planets.
 *
 * What each number is for:
 *
 *   · `texture` — how big the map is on the GPU. Textures decode to raw RGBA in
 *     VRAM regardless of how well they compress on disk, so this is the number
 *     that actually decides memory. Sized to how many pixels the thing occupies.
 *   · `ratio` — the share of triangles kept. Only worth spending where the
 *     silhouette is the whole read, which for a tumbling rock it is not.
 */
const POLICY = {
  /**
   * Rocks, seen small and in bulk, and instanced. The silhouette that matters is
   * "irregular lump", which survives an aggressive cut perfectly well.
   */
  asteroids: { texture: 256, simplify: true, ratio: 0.08, error: 0.02 },
  /** Instrument bodies in orbit — read at a few dozen pixels, but recognisable. */
  sattelites: { texture: 256, simplify: true, ratio: 0.5, error: 0.01 },
  /** The one thing a player watches long enough to notice a bad silhouette. */
  ships: { texture: 512, simplify: false },
  /**
   * The mining craft. Same class of object as a ship — it flies, it is followed,
   * and its silhouette is a drill bit leading a hull, which is the entire read.
   *
   * It arrives with three 2K JPEGs against a ship's one, so 512 lands it well over
   * the hundred-kilobyte mark the rest of the fleet sits at. 384 brings it into
   * line, and the difference is invisible on a craft that renders forty pixels
   * across. Geometry is left alone: at 2,902 triangles it is already cheaper than
   * two of the asteroids the disc draws forty of.
   */
  drills: { texture: 384, simplify: false },
  /**
   * A missile, in the ten seconds a raid takes to land. D44.
   *
   * The cheapest thing in the fleet to draw and the shortest-lived: it exists for
   * about a second, at a quarter to a half of a ship's size, and there can be a
   * dozen in the air at once. Nobody reads a warhead as a shape — they read a lit
   * streak crossing the gap — so this is priced like a rock rather than like a
   * hull, and it is the one model in the game whose whole job is to be gone.
   *
   * It arrived as another 2.8 MB Tripo export: 3,853 triangles and a single 4K
   * JPEG that is 97% of the file. The error bound rather than the ratio is what
   * actually decides the geometry here (0.5 and 0.25 both land on ~2,230
   * triangles), which is the right way round for a silhouette this simple.
   */
  missiles: { texture: 256, simplify: true, ratio: 0.5, error: 0.008 },
  /**
   * Wreckage. D32.
   *
   * The same class of object as an asteroid and priced the same way: it is drawn
   * INSTANCED, many times over, in a ring around a planet, at a few dozen pixels
   * each. Nobody reads a chunk of debris as a shape — they read "that world has a
   * ring of broken metal around it" — so the silhouette budget goes almost
   * entirely unspent.
   *
   * Slightly less aggressive than the rocks (0.15 against 0.08) because a wreck is
   * angular where a rock is a lump: cut too far and the flat faces collapse into
   * spikes, which reads as a broken model rather than as debris. It arrives with
   * three 2K JPEGs, and JPEG is not a GPU format — those decode to raw RGBA in
   * VRAM whatever they weigh on disk, which is what actually makes the file 3.4 MB.
   */
  debris: { texture: 256, simplify: true, ratio: 0.15, error: 0.015 },
};

const DEFAULT_POLICY = { texture: 512, simplify: false };

/** The first path segment under SOURCE names the kind. */
const policyFor = (relPath) => POLICY[relPath.split(/[\\/]/)[0]] ?? DEFAULT_POLICY;

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

  const policy = policyFor(relative(SOURCE, source));

  mkdirSync(dirname(target), { recursive: true });
  execFileSync(
    'npx',
    [
      'gltf-transform',
      'optimize',
      source,
      target,
      '--texture-size',
      String(policy.texture),
      // WebP over KTX2 only because encoding KTX2 needs the `ktx` binary, which is
      // not a dependency worth adding for one ship. KTX2 stays compressed in VRAM
      // and is the better answer once there are many models.
      '--texture-compress',
      'webp',
      '--compress',
      'meshopt',
      '--simplify',
      String(policy.simplify),
      ...(policy.simplify
        ? ['--simplify-ratio', String(policy.ratio), '--simplify-error', String(policy.error)]
        : []),
    ],
    { stdio: 'pipe' },
  );

  const after = describe(target);
  const shrunk = (before.bytes / after.bytes).toFixed(1);
  console.log(
    `${relative(SOURCE, source)}: ${kb(before.bytes)} → ${kb(after.bytes)} (${shrunk}x) · ` +
      `${before.triangles} → ${after.triangles} tris`,
  );
}
