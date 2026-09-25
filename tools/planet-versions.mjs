/**
 * THE PLANET FILES' VERSIONS. F9.
 *
 * Production serves `/assets/` immutable for a year (`deploy/nginx/astera.conf`), which
 * is right for Vite's hashed chunks and wrong for files whose names never change: a phone
 * that once loaded a planet card would keep it for a year after it was replaced. So the
 * client asks for each planet file with its content hash (`?v=`), read from the manifest
 * this writes — a changed file is a new URL, an unchanged one is never fetched twice.
 *
 * Called by `models.mjs` and `planet-cards.mjs` after they write, and runnable alone:
 *   node tools/planet-versions.mjs
 * `test/planet-asset-versions.test.ts` fails if the manifest and the files disagree.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = 'apps/web/public/assets';
const FOLDERS = ['images/planets', 'models/planets/defaults'];
const MANIFEST = 'apps/web/src/ui/planet-assets.json';

export function writePlanetVersions() {
  const versions = {};
  for (const folder of FOLDERS) {
    for (const name of readdirSync(join(PUBLIC, folder)).sort()) {
      if (!/^planet_\d+(-lod|-far)?\.(png|glb)$/.test(name)) continue;
      const bytes = readFileSync(join(PUBLIC, folder, name));
      versions[`${folder}/${name}`] = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
    }
  }
  writeFileSync(MANIFEST, `${JSON.stringify(versions, null, 2)}\n`);
  console.log(`${MANIFEST}: ${String(Object.keys(versions).length)} planet files`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writePlanetVersions();
