/**
 * The model pipeline.
 *
 * Drop a raw `.glb` in `assets/source/models/…` and run this; the optimised copy
 * lands in the same relative path under `apps/web/public/assets/models/`. The
 * source file is the master and is never served.
 *
 *   node tools/models.mjs            # optimise everything
 *   node tools/models.mjs --inspect  # just report on what is there
 *   node tools/models.mjs --lod-only # rebuild only derived LOD variants
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
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { writePlanetVersions } from './planet-versions.mjs';

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
  /** Public structures, drawn much larger than a hull. Keep their authored material maps. */
  monuments: { texture: 1280, simplify: false },
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
   *
   * EXCEPT FOR THE `_lod` RING, drawn only while a shell is 22–70 px across. It
   * replaced a procedural torus three and a half times too thick through Z — owner
   * report, 2026-10-06: "balon gibi şişmiş bir silindir". Cut at a 2% error the ring
   * keeps its measured bounds, its band and its spars at about 1,500 triangles, a
   * fifth of the full one. It borrows the full ring's material, so its own plate is
   * a 32 px placeholder that only keeps the file valid.
   */
  dyson: {
    texture: 768,
    simplify: false,
    variants: [{ suffix: '_lod', texture: 32, simplify: true, ratio: 0.05, error: 0.02 }],
  },
  /**
   * THE SIXTEEN DEFAULT WORLDS (F9 · K7), and the one kind that ships THREE files.
   *
   * They arrive as Draco exports — one mesh, 10,374 triangles, three 1024px WebP maps
   * (colour; normal and roughness TILED sixteen times as a surface detail) — and the
   * client decodes meshopt, not Draco, so every one goes through here.
   *
   *   · THE FULL MODEL is what a commander sees up close, on a focused world or their
   *     own — only ever a few on screen. Its 1024 plates stay; its geometry is cut to
   *     four thousand triangles (owner: "5k yerine 4k"), where the rim stays round
   *     and the surface detail lives in the normal map anyway.
   *   · THE `-lod` MODEL is what most worlds in view are drawn with, hundreds at once.
   *     A world's silhouette is a circle whatever it is made of, so its geometry takes
   *     the asteroids' kind of cut; its plates drop to 256, because the galaxy draws
   *     it at a few dozen pixels and uses only its colour map.
   *   · THE `-far` MODEL is a speck (owner: no billboard, even there): a few hundred
   *     triangles and a 128 plate, for the whole thousand-seat galaxy seen at once.
   */
  planets: {
    texture: 1024,
    simplify: true,
    ratio: 4_000 / 10_374,
    error: 0.005,
    variants: [
      { suffix: '-lod', texture: 256, simplify: true, ratio: 0.1, error: 0.02 },
      { suffix: '-far', texture: 128, simplify: true, ratio: 0.025, error: 0.05 },
    ],
  },
};

const DEFAULT_POLICY = { texture: 512, simplify: false };

/**
 * THE TRIANGLE CEILING FOR ANYTHING THAT FLIES. D197, owner instruction:
 * *"5bin üçgeni aşan gemilerin üçgen sayısını ~5bin'e çek. (Tüccar gemisi hariç)"*
 *
 * `visual-design.md` has always stated a ship budget and the catalogue has always
 * ignored it: entries arrive between 3.7k and 10.2k triangles because that is what
 * the renders export at, and `ships` policy said `simplify: false` on the
 * reasoning that a hull is "the one thing a player watches long enough to notice a
 * bad silhouette". True, and it is also the reason the cut is worth making
 * CAREFULLY rather than not at all — a phone drawing a dozen craft at once pays
 * for every triangle, and half of these are spent on panel grooves that are
 * sub-pixel in flight.
 *
 * APPLIED IN THE RUN LOOP, NOT IN A POLICY ROW, so a `PATH_POLICY` entry that
 * exists to tune a TEXTURE cannot silently drop the ceiling — three ships already
 * have such a row, and losing the cap for them is exactly the kind of quiet
 * exception this pipeline has been bitten by before.
 *
 * THE RATIO IS PER MODEL, because a ceiling is not a ratio: at 10,188 triangles a
 * Paladin needs a 49% cut and a Ballista at 5,049 needs 1%. The error bound stays
 * tighter than scenery, but it must still let the simplifier reach the declared
 * ceiling; the post-build assertion below rejects a silent miss.
 */
const SHIP_TRIANGLE_CEILING = 5_000;
const SHIP_LOD_TRIANGLE_CEILING = 3_000;
const MONUMENT_TRIANGLE_CEILING = 5_000;

/** Every mobile hull in `FLEET_V2_ASSET_MANIFEST`, mirrored for the offline tool. */
const FLEET_V2_MODEL_PATHS = new Set([
  'dart', 'pike', 'rampart', 'warden', 'courier',
  'viper', 'talon', 'stronghold', 'sentinel', 'wayfarer',
  'tempest', 'ballista', 'leviathan', 'praetorian', 'atlas', 'nullifier',
  'garbage-collector', 'cataclysm', 'corsair', 'citadel', 'paladin', 'argosy',
].map((name) => `ships/${name}.glb`));

/** Derived variants: planet mid-detail assets and one low hull for every mobile craft. */
const LOD_VARIANTS = {
  'test_planet_modal.glb': {
    output: 'test_planet_modal_lod.glb', texture: 256, simplify: true, ratio: 0.14, error: 0.02,
  },
  'patlamis_gezegen_2.glb': {
    output: 'patlamis_gezegen_2_lod.glb', texture: 256, simplify: true, ratio: 0.14, error: 0.02,
  },
  ...Object.fromEntries([...FLEET_V2_MODEL_PATHS].map((path) => [path, {
    output: path.replace(/\.glb$/, '_lod.glb'),
    texture: 256,
    simplify: true,
    triangleCeiling: SHIP_LOD_TRIANGLE_CEILING,
    // These variants take over only once a hull is roughly sub-60px on mobile.
    // A looser geometric error is required for thin fins and claws to reach the
    // actual triangle ceiling; the post-build assertion below is authoritative.
    error: 0.1,
  }])),
};

/**
 * THE MERCHANT IS EXEMPT BY INSTRUCTION. It is the one craft in the game nobody
 * owns and everybody watches arrive — a public event with its own arrival window —
 * so it is looked at differently from a hull in a formation.
 */
const UNCAPPED_CRAFT = new Set(['ships/trade_ship.glb']);

const PATH_POLICY = {
  // UFO's dense UV seams stop ordinary simplification above 10k triangles.
  // Separate close-up master and moderately simplified flight mesh.
  'probes/probe_ufo.glb': { texture: 1024, simplify: false, rebake: true, triangleCeiling: 12000, error: 0.04, previewTexture: 2048 },
  // These two have a single unwrapped 4K colour map instead of three tiled maps.
  'monuments/monument_abandoned_space_wreckage.glb': { texture: 2048, simplify: false },
  // Its densely split inner ring needs a slightly larger combined attribute
  // error bound to reach 5k; this includes normal/UV error, not just geometry.
  'monuments/monument_ancient_stargate.glb': { texture: 2048, simplify: false, error: 0.1 },
  // Owner visual review: retain more guardian armour geometry without enlarging
  // its maps. This single landmark gets a 7.5k cap; all others stay at 5k.
  'monuments/monument_sleeping_guard.glb': { texture: 1280, simplify: false, triangleCeiling: 7500, error: 0.03 },
  // Authored seams hold the cemetery at 7.4k with the default error bound.
  'monuments/monument_ancient_war_cemetery.glb': { texture: 1280, simplify: false, error: 0.1 },
  // The new Germany, France, Spain and Japan masters are 960-triangle unit
  // spheres. Preserve their already light full geometry and spend the galaxy
  // budget on a smaller texture and an approximately 200-triangle distant tier.
  ...Object.fromEntries(['germany', 'france', 'spain', 'japan'].map((country) => [
    `planets/country/planet_${country}.glb`,
    {
      texture: 1024, simplify: false,
      variants: [{ suffix: '-lod', texture: 256, simplify: true, ratio: 0.2, error: 0.05 }],
    },
  ])),
  'planets/country/planet_turkey.glb': {
    texture: 1024, simplify: true, ratio: 0.003, error: 0.05,
    variants: [{ suffix: '-lod', texture: 256, simplify: true, ratio: 0.0005, error: 0.12 }],
  },
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
  // These three already shipped with 512px plates. Keep that approved VRAM and
  // transfer footprint while applying the geometry ceiling; regenerating them at
  // the roster default would make the files 25–61% larger for no flight-size gain.
  'ships/argosy.glb': { texture: 512, simplify: false },
  'ships/corsair.glb': { texture: 512, simplify: false },
  'ships/paladin.glb': { texture: 512, simplify: false },
  /*
    D200. At the ceiling's own 0.005 the simplifier stalls at 7,182 of 9,810 — its
    arms and claws are long thin runs the error bound will not collapse — so this
    row carries the cut itself at 0.01, where it lands on 4,994. 736 is the plate
    that keeps the result inside the 300 KB envelope (768 lands at 301).
  */
  'ships/garbage-collector.glb': {
    texture: 736, simplify: true, ratio: SHIP_TRIANGLE_CEILING / 9_810, error: 0.01,
  },
};

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
const lodOnly = process.argv.includes('--lod-only');
/**
 * `--only=ships/garbage-collector.glb` optimises that one source and nothing else,
 * so adding a hull does not re-encode every approved model beside it. A value ending
 * in `/` takes a whole folder (`--only=planets/`).
 */
const onlyPath = process.argv.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    // Incoming models need a canonical category and build policy before they can be served.
    if (dir === SOURCE && entry.isDirectory() && entry.name === 'new_skins') continue;
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

if (lodOnly) {
  sources = sources.filter((source) => {
    const rel = relative(SOURCE, source).replaceAll('\\', '/');
    return LOD_VARIANTS[rel] !== undefined || (policyFor(rel).variants?.length ?? 0) > 0;
  });
}

if (onlyPath !== undefined) {
  sources = sources.filter((source) => {
    const rel = relative(SOURCE, source).replaceAll('\\', '/');
    return onlyPath.endsWith('/') ? rel.startsWith(onlyPath) : rel === onlyPath;
  });
}

if (sources.length === 0) {
  console.log(`No .glb files under ${SOURCE}.`);
  process.exit(0);
}

function optimise(source, target, policy) {
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
}

/**
 * gltf-transform's ratio targets vertices, while this project's budgets count
 * submitted triangles. Thin, split geometry can therefore miss a triangle cap
 * even when the first ratio is mathematically exact. Tighten only the ratio and
 * retry a bounded number of times; the error tolerance remains the visual guard.
 */
function optimiseWithinTriangleCeiling(source, target, policy, ceiling) {
  let next = policy;
  let after = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    optimise(source, target, next);
    after = describe(target);
    if (after.triangles <= ceiling || !next.simplify) return after;
    next = {
      ...next,
      ratio: Math.max(0.01, next.ratio * (ceiling / after.triangles) * 0.95),
    };
  }
  return after;
}

for (const source of sources) {
  const rel = relative(SOURCE, source).replaceAll('\\', '/');
  const target = join(OUT, rel);
  const before = describe(source);

  if (inspectOnly) {
    console.log(`${relative(SOURCE, source)}: ${kb(before.bytes)} · ${before.triangles} tris · ${before.images.join(', ')}`);
    continue;
  }

  const shipSkinName = /^ships\/skins\/([^/]+)\/model\.glb$/.exec(rel)?.[1];
  if (shipSkinName) {
    const { buildShipSkin } = await import('./ship-skin-models.mjs');
    await buildShipSkin(source, target, shipSkinName, lodOnly);
    continue;
  }

  const base = policyFor(relative(SOURCE, source));
  /*
    A ship over the ceiling is cut to it, whatever its policy row says about
    textures. Anything already under it is left exactly alone: a 1% trim buys
    nothing and spends silhouette.
  */
  const capped = rel.startsWith('ships/')
    && !UNCAPPED_CRAFT.has(rel)
    && !base.simplify
    && before.triangles > SHIP_TRIANGLE_CEILING;
  const monument = rel.startsWith('monuments/');
  const policy = capped
    ? { ...base, simplify: true, ratio: SHIP_TRIANGLE_CEILING / before.triangles, error: 0.01 }
    : base;

  if (!lodOnly) {
    if (base.previewTexture) {
      const preview = target.replace(/\.glb$/, '_preview.glb');
      optimise(source, preview, { texture: base.previewTexture, simplify: false });
      if (rel === 'probes/probe_ufo.glb') {
        const { polishCosmeticFile } = await import('./cosmetic-materials.mjs');
        await polishCosmeticFile(preview, 'ufo');
      }
    }
    const ceiling = base.triangleCeiling ?? (monument
      ? MONUMENT_TRIANGLE_CEILING
      : FLEET_V2_MODEL_PATHS.has(rel) ? SHIP_TRIANGLE_CEILING : undefined);
    let after;
    if (monument || base.rebake) {
      const { prepareMonumentModel } = await import('./monument-models.mjs');
      const scratch = mkdtempSync(join(tmpdir(), 'astera-monuments-'));
      try {
        const prepared = join(scratch, 'prepared.glb');
        await prepareMonumentModel(source, prepared, ceiling ?? MONUMENT_TRIANGLE_CEILING, base.error, base.texture);
        if (rel === 'probes/probe_ufo.glb') {
          const { polishCosmeticFile } = await import('./cosmetic-materials.mjs');
          await polishCosmeticFile(prepared, 'ufo');
        }
        optimise(prepared, target, { ...policy, simplify: false });
        after = describe(target);
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    } else {
      after = ceiling !== undefined
        ? optimiseWithinTriangleCeiling(source, target, policy, ceiling)
        : (optimise(source, target, policy), describe(target));
    }
    if (ceiling !== undefined && after.triangles > ceiling) {
      throw new Error(
        `${rel} exceeds the ${String(ceiling)} triangle ceiling: ` +
        `${String(after.triangles)}`,
      );
    }
    const shrunk = (before.bytes / after.bytes).toFixed(1);
    console.log(
      `${relative(SOURCE, source)}: ${kb(before.bytes)} → ${kb(after.bytes)} (${shrunk}x) · ` +
        `${before.triangles} → ${after.triangles} tris`,
    );
  }

  const lod = LOD_VARIANTS[rel];
  if (lod) {
    const lodTarget = join(OUT, lod.output);
    const lodPolicy = lod.triangleCeiling === undefined
      ? lod
      : { ...lod, ratio: Math.min(1, lod.triangleCeiling / before.triangles) };
    const after = lod.triangleCeiling === undefined
      ? (optimise(source, lodTarget, lodPolicy), describe(lodTarget))
      : optimiseWithinTriangleCeiling(source, lodTarget, lodPolicy, lod.triangleCeiling);
    if (lod.triangleCeiling !== undefined && after.triangles > lod.triangleCeiling) {
      throw new Error(
        `${lod.output} exceeds the ${String(lod.triangleCeiling)} triangle ceiling: ` +
        `${String(after.triangles)}`,
      );
    }
    console.log(
      `${rel} → ${lod.output}: ${kb(after.bytes)} · ${before.triangles} → ${after.triangles} tris`,
    );
  }

  // A kind drawn both near and in bulk ships lighter files beside the first (the planets).
  for (const variant of policy.variants ?? []) {
    const variantTarget = target.replace(/\.glb$/, `${variant.suffix}.glb`);
    optimise(source, variantTarget, variant);
    const made = describe(variantTarget);
    console.log(`  ${relative(OUT, variantTarget)}: ${kb(made.bytes)} · ${made.triangles} tris`);
  }
}

// The planet files are asked for by content hash: a new file must be a new URL.
if (!inspectOnly && sources.some((source) => relative(SOURCE, source).replaceAll('\\', '/').startsWith('planets/'))) {
  writePlanetVersions();
}
