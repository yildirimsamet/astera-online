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
  CITADEL: 'defensive/defensive_lvl_4',
};

const sourcePng = (stem) =>
  join(STAGING, `${stem === 'offensive/offensive_shield_breaker' ? 'offensive/offensive_shiled_breaker' : stem}.png`);

for (const [id, stem] of Object.entries(FLEET)) {
  const name = id.toLowerCase().replaceAll('_', '-');
  const modelTarget = join(MODEL_SOURCE, `${name}.glb`);
  const cardTarget = join(IMAGE_OUT, `${name}.webp`);
  const iconTarget = join(IMAGE_OUT, 'icons', `${name}.webp`);
  mkdirSync(dirname(modelTarget), { recursive: true });
  mkdirSync(dirname(cardTarget), { recursive: true });
  mkdirSync(dirname(iconTarget), { recursive: true });

  copyFileSync(join(STAGING, `${stem}.glb`), modelTarget);

  const common = [sourcePng(stem), '-trim', '+repage', '-gravity', 'center', '-background', 'none'];
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
for (const [target, source] of Object.entries(LAB_REUSE)) {
  copyFileSync(join(LAB, source), join(LAB, `${target}.png`));
}

