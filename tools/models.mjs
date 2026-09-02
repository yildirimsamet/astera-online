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
  /**
   * The dyson shells a developed world wears — and the one kind in this pipeline
   * where the usual "size it to its footprint" rule gives the wrong answer.
   *
   * THEIR TEXTURE IS TILED SIXTEEN TIMES. The material carries a
   * `KHR_texture_transform` with a scale of 16, so the 2K plate is not an unwrap
   * of the model — it is a repeating panel sheet, and the detail a viewer actually
   * sees is a SIXTEENTH of whatever this number says. At the 384 the rest of the
   * scenery uses that is twenty-four pixels per panel: the panel lines and the
   * seams dissolve and a hard-surface megastructure reads as a smooth balloon,
   * which is exactly what shipped on the first pass. 768 puts it at forty-eight.
   * ANY kind whose material tiles its UVs has to be sized this way, and the tile
   * factor — not the plate size — is what to read when judging it.
   *
   * AND 768 RATHER THAN 1024, WHICH THE DISK BUDGET WOULD HAVE ALLOWED. What
   * decides this is VRAM, not the file: a texture decodes to raw RGBA whatever it
   * weighs compressed, so 1024 is 5.59 MB per map — three maps across three shells
   * is 50 MB of video memory on a phone that also has to hold sixteen world
   * renders, eleven GLTFs and a nebula. 768 is 3.1 MB per map and 28 MB in total,
   * which is the most this scenery is worth.
   *
   * AND THE GEOMETRY IS NOT SIMPLIFIED, for the same reason it is not on a ship:
   * these are flat panels meeting at hard corners, and a simplifier rounds a
   * corner before it removes a face. The openwork IS the silhouette — a ring, a
   * woven cage and a geodesic sphere are told apart by their holes.
   */
  dyson: { texture: 768, simplify: false },
};

const DEFAULT_POLICY = { texture: 512, simplify: false };

const PATH_POLICY = {
  // The strategic craft is shown larger than a normal hull, but its raw Tripo
  // sphere spends 17k triangles and a 4K plate on grooves that collapse below a
  // pixel in flight. Keep the silhouette and a 512px plate; simplify the surface.
  'ships/death_star.glb': { texture: 512, simplify: true, ratio: 0.35, error: 0.01 },
  // Fleet V2 uses a 768px detail plate by default. These source textures
  // encode at opposite ends of the content range, so keep all of them inside the
  // owner's approximately 200–300 KB visual-quality envelope without changing geometry.
  'ships/pike.glb': { texture: 800, simplify: false },
  'ships/praetorian.glb': { texture: 736, simplify: false },
  'ships/citadel.glb': { texture: 752, simplify: false },
};

/**
 * Fleet V2 hulls all carry three maps and render at roughly 40–60px in flight.
 * Physical review showed that the former 256px plate erased authored surface
 * detail. A 768px plate keeps each runtime GLB in the requested 200–300 KiB
 * band while preserving every source triangle.
 */
const FLEET_V2_MODEL_PATHS = new Set([
  'dart', 'pike', 'rampart', 'warden', 'courier',
  'viper', 'talon', 'stronghold', 'sentinel', 'wayfarer',
  'tempest', 'ballista', 'leviathan', 'praetorian', 'atlas', 'nullifier',
  'cataclysm', 'citadel',
].map((name) => `ships/${name}.glb`));

/** The first path segment under SOURCE names the kind. */
const policyFor = (relPath) => {
  const canonical = relPath.replaceAll('\\', '/');
  return PATH_POLICY[canonical] ??
  (FLEET_V2_MODEL_PATHS.has(canonical) ? { texture: 768, simplify: false } : undefined) ??
  POLICY[relPath.split(/[\\/]/)[0]] ??
  DEFAULT_POLICY;
};

const inspectOnly = process.argv.includes('--inspect');
const fleetV2Only = process.argv.includes('--fleet-v2');

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

if (fleetV2Only) {
  sources = sources.filter((source) =>
    FLEET_V2_MODEL_PATHS.has(relative(SOURCE, source).replaceAll('\\', '/')),
  );
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
