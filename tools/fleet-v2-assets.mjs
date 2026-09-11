/**
 * Canonicalises the owner's immutable Fleet V2 staging drop.
 *
 * The source folder is deliberately never served by a runtime map. Raw GLBs are
 * copied to the normal source tree for `pnpm models`; card and icon WebPs are
 * derived into `public/` with stable rule-id filenames.
 *
 *   node tools/fleet-v2-assets.mjs
 *   pnpm models
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const STAGING = 'apps/web/public/assets/new_test_ship_modals';
const MODEL_SOURCE = 'assets/source/models/ships';
const IMAGE_OUT = 'apps/web/public/assets/images/ships';

/** The only authoritative translation from owner filenames to stable rule ids. */
const FLEET = {
  DART: 'offensive/offensive_lvl_1-1',
  PIKE: 'offensive/offensive_lvl_1-2',
  RAMPART: 'defensive/defensive_lvl_1-1',
  WARDEN: 'defensive/defensive_lvl_1-2',
  COURIER: 'cargo/cargo_lvl_1',
  VIPER: 'offensive/offensive_lvl_2-1',
  TALON: 'offensive/offensive_lvl_2-2',
  STRONGHOLD: 'defensive/defensive_lvl_2-1',
  SENTINEL: 'defensive/defensive_lvl_2-2',
  WAYFARER: 'cargo/cargo_lvl_2',
  TEMPEST: 'offensive/offensive_lvl_3-1',
  BALLISTA: 'offensive/offensive_lvl_3-2',
  LEVIATHAN: 'defensive/defensive_lvl_3-1',
  PRAETORIAN: 'defensive/defensive_lvl_3-2',
  ATLAS: 'cargo/cargo_lvl_3',
  NULLIFIER: 'offensive/offensive_shield_breaker',
  CATACLYSM: 'offensive/offensive_lvl_4',
  CORSAIR: 'offensive/offensive_lvl_4-2',
  CITADEL: 'defensive/defensive_lvl_4',
  PALADIN: 'defensive/defensive_lvl_4-2',
  ARGOSY: 'cargo/cargo_lvl_4',
  /** D200. Dropped at the staging root, its render one folder over — see `PNG_AT`. */
  GARBAGE_COLLECTOR: 'garbage_collector',
};

/**
 * RENDERS THAT DID NOT ARRIVE BESIDE THEIR MODEL. Keyed by stem, and the path is
 * the file as the owner delivered it: a typo in the staging name, or a render
 * dropped in `images/` rather than next to its `.glb`. Moving the owner's file to
 * suit this table would leave the next drop guessing where it belongs.
 */
const PNG_AT = {
  'offensive/offensive_shield_breaker': join(STAGING, 'offensive/offensive_shiled_breaker.png'),
  garbage_collector: 'apps/web/public/assets/images/garbage_collector.png',
};

/**
 * ONE SHIP AT A TIME WHEN ASKED: `node tools/fleet-v2-assets.mjs GARBAGE_COLLECTOR`.
 * With no argument every ship is re-derived, as before. A new hull should not
 * rewrite twenty-one cards that were already approved just to produce its own.
 */
const ONLY = new Set(process.argv.slice(2));

/**
 * TWO OF D196'S DROPS ARRIVED WITH THE CHECKERBOARD BAKED IN. Owner report:
 * *"korsan ve palatin gemilerinin resimlerinde beyaz arkaplan var?"* — and there
 * was. `offensive_lvl_4-2.png` and `defensive_lvl_4-2.png` are TrueColor with NO
 * alpha channel: the transparency PREVIEW was flattened into the export, so the
 * grey-and-white squares are real pixels. Every other drop in this folder, the
 * third tier-4 one included, is TrueColorAlpha with a transparent corner.
 *
 * A CONNECTED FLOODFILL FROM THE FOUR CORNERS, NOT A COLOUR KEY. Both of these
 * hulls are silver and grey, which is exactly the checkerboard's range — keying by
 * colour would eat their plating. Floodfill only travels through pixels touching
 * the border, so the ship's interior cannot be reached however close its greys
 * are, and 22% bridges the 254-to-210 step between checker squares without
 * crossing the silhouette. Verified by eye on both: no fringe, and mean alpha
 * lands at 0.22 and 0.35, inside the range the existing cards already occupy.
 *
 * IT IS A RECOVERY, NOT THE HAPPY PATH. A re-export with the alpha channel kept
 * is strictly better and costs one setting; this exists so a flattened drop is not
 * a blocker, and it is named per stem so it never touches a correct file.
 */
const FLATTENED_BACKGROUND = new Set([
  'offensive/offensive_lvl_4-2',
  'defensive/defensive_lvl_4-2',
  // D200's render arrived the same way: TrueColor, no alpha, checkerboard baked in.
  'garbage_collector',
]);

/**
 * NOTHING IS ROTATED, AND THAT IS A REVERSAL. D197.
 *
 * The Corsair and Argosy renders arrive nose-UP where every shipped card points
 * its prow at the bottom of the frame, so they were turned 180 degrees to match.
 * The owner reversed it after seeing them: *"vazgeçtim, geri eski haline çevir.
 * Bu şekilde gemilerin perspektifi bozuk gözüküyor."*
 *
 * And that is right. These are three-quarter renders, not orthographic plates —
 * the camera sits above the hull, so the lit surfaces and the foreshortening both
 * say "seen from above". Turning the IMAGE over does not move the camera: it
 * leaves a ship lit from below with its far end larger than its near one, which
 * reads as a broken render rather than as a ship pointing the other way. Matching
 * the fleet's heading was the smaller consideration.
 *
 * The hook is kept deliberately empty rather than deleted: the next drop may
 * arrive orthographic, where a rotation IS free, and the reasoning above is what
 * a reader needs before reaching for it.
 */
const ROTATE_180 = new Set([]);

const sourcePng = (stem) => PNG_AT[stem] ?? join(STAGING, `${stem}.png`);

for (const [id, stem] of Object.entries(FLEET)) {
  if (ONLY.size > 0 && !ONLY.has(id)) continue;
  const name = id.toLowerCase().replaceAll('_', '-');
  const modelTarget = join(MODEL_SOURCE, `${name}.glb`);
  const cardTarget = join(IMAGE_OUT, `${name}.webp`);
  const iconTarget = join(IMAGE_OUT, 'icons', `${name}.webp`);
  mkdirSync(dirname(modelTarget), { recursive: true });
  mkdirSync(dirname(cardTarget), { recursive: true });
  mkdirSync(dirname(iconTarget), { recursive: true });

  copyFileSync(join(STAGING, `${stem}.glb`), modelTarget);

  const unflatten = FLATTENED_BACKGROUND.has(stem)
    ? [
      '-alpha', 'set', '-fuzz', '22%', '-fill', 'none',
      '-draw', 'alpha 0,0 floodfill',
      '-draw', 'alpha %[fx:w-1],0 floodfill',
      '-draw', 'alpha 0,%[fx:h-1] floodfill',
      '-draw', 'alpha %[fx:w-1],%[fx:h-1] floodfill',
    ]
    : [];
  const common = [
    sourcePng(stem),
    ...unflatten,
    ...(ROTATE_180.has(stem) ? ['-rotate', '180'] : []),
    '-trim', '+repage', '-gravity', 'center', '-background', 'none',
  ];
  execFileSync('magick', [
    ...common,
    '-resize', '480x480>',
    '-extent', '512x512',
    '-define', 'webp:method=6',
    '-quality', '82',
    cardTarget,
  ]);
  execFileSync('magick', [
    ...common,
    '-resize', '148x148>',
    '-extent', '160x160',
    '-define', 'webp:method=6',
    '-quality', '78',
    iconTarget,
  ]);
  console.log(`${id}: ${stem} -> ${name}`);
}

/**
 * Four retired doctrine commissions are deliberately reassigned to the four new
 * fleet ladders. Their old projects no longer exist, so current research rows
 * remain visually unique; canonical filenames keep the new meaning explicit.
 */
const LAB_REUSE = {
  starship_engineering: 'weapons_and_armor.png',
  ship_power: 'wasp_doctrine.png',
  ship_armor: 'bullwark_doctrine.png',
  ship_propulsion: 'lance_doctrine.png',
};
const LAB = 'apps/web/public/assets/images/lab';
// Part of a full run only: a one-ship run touches that ship and nothing else.
for (const [target, source] of ONLY.size > 0 ? [] : Object.entries(LAB_REUSE)) {
  copyFileSync(join(LAB, source), join(LAB, `${target}.png`));
}

