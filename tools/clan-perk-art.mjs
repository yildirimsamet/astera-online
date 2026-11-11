/** Derive the clan perk plates (F2) from their imagegen masters. No generation/API calls. */
import { createRequire } from 'node:module';
import { mkdirSync, realpathSync } from 'node:fs';
const sharp = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`)('sharp');
const source = 'assets/source/clan';
const out = 'apps/web/public/assets/images/clan';
mkdirSync(out, { recursive: true });
const perks = ['corridor', 'alarm', 'station', 'refinery', 'banner'];
for (const perk of perks) {
  // Drawn at 40 px at most; 160 keeps it crisp on a DPR 4 phone.
  await sharp(`${source}/perk-${perk}.png`).trim().resize(160, 160, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 86, alphaQuality: 90 }).toFile(`${out}/perk-${perk}.webp`);
}
console.log(`${perks.length} clan perk plates.`);
