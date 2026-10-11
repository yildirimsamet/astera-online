/** Re-derive small shipping plates from the original imagegen masters. No generation/API calls. */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, realpathSync } from 'node:fs';
const sharp = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`)('sharp');
const source = 'assets/source/premium';
const out = 'apps/web/public/assets/images/premium';
const { prompts } = JSON.parse(readFileSync(`${source}/research/prompts.json`, 'utf8'));
mkdirSync(`${out}/research`, { recursive: true });
for (const { id } of prompts) {
  if (!/^[a-z-]+$/.test(id)) throw new Error('Invalid research art id');
  await sharp(`${source}/research/${id}-v1.png`).resize(384, 384, { fit: 'cover' })
    .webp({ quality: 84 }).toFile(`${out}/research/${id}-v1.webp`);
}
await sharp(`${source}/nebula-v1.png`).resize(1536, 768, { fit: 'cover' })
  .webp({ quality: 83 }).toFile(`${out}/nebula-v1.webp`);
console.log(`${prompts.length} research plates + one 1536×768 nebula.`);
