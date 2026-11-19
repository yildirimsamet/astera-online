import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

/**
 * NO HAND-SPELLED UNIT LOCATIONS (ay planı §3 ilke 1, §6.1).
 *
 * A moon adds a second standing body, and every service that decides "standing or away" by
 * comparing `units.location` to the string `'home'` would then file the moon's ships as away.
 * Those decisions read `services/unitLocation.ts`. The raw spelling stays only where it is a
 * schema default; any other copy fails here.
 */
const SRC = fileURLToPath(new URL('../src', import.meta.url));
const ALLOWED = new Set(['services/unitLocation.ts', 'db/schema.ts']);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return name.endsWith('.ts') ? [path] : [];
  });
}

it('keeps the raw standing spellings inside the location module', () => {
  const offenders = sources(SRC)
    .map((path) => ({ file: relative(SRC, path).replaceAll('\\', '/'), text: readFileSync(path, 'utf8') }))
    .filter(({ file }) => !ALLOWED.has(file))
    .flatMap(({ file, text }) => text.split('\n')
      .map((line, i) => ({ line, at: `${file}:${i + 1}` }))
      .filter(({ line }) => /'(home|moon)'/.test(line) && !/^\s*(\/\/|\*)/.test(line))
      .map(({ at }) => at));
  expect(offenders).toEqual([]);
});
