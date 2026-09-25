import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/locales/en/index.js';
import { tr } from '../src/i18n/locales/tr/index.js';

/**
 * EVERY KEY THE CODE NAMES IS A KEY THE DICTIONARY HOLDS (review, 2026-09-25).
 *
 * The locale tests keep the five languages in step with each other, and nothing kept the code
 * in step with them: a key typed wrong, or removed from the dictionary while a screen still
 * asked for it, reached the player as its own dotted name. Every literal key handed to `t(…)`
 * or `i18n.t(…)` in the app must exist in English and Turkish — as a leaf, or as the base of a
 * plural pair or a context.
 */

const flatten = (tree: unknown, prefix = '', out = new Set<string>()): Set<string> => {
  if (typeof tree === 'string') out.add(prefix);
  else if (tree && typeof tree === 'object') {
    for (const [key, value] of Object.entries(tree)) flatten(value, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
};

const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  if (statSync(path).isDirectory()) return name === 'locales' || name === 'gallery' ? [] : files(path);
  return /\.tsx?$/.test(name) ? [path] : [];
});

/** A leaf, or the base of a plural pair or a context (`_one`, `_looted`…), which i18next suffixes itself. */
const known = (keys: Set<string>, key: string): boolean =>
  keys.has(key) || [...keys].some((leaf) => leaf.startsWith(`${key}_`) && !leaf.slice(key.length + 1).includes('.'));

describe('the keys the code asks for', () => {
  const used = new Map<string, string>();
  for (const file of files('src')) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bt\(\s*'([a-zA-Z][\w-]*(?:\.[\w-]+)+)'/g)) {
      used.set(match[1]!, file);
    }
  }

  it.each([['en', en], ['tr', tr]] as const)('are all in %s', (_, tree) => {
    const keys = flatten(tree);
    const missing = [...used].filter(([key]) => !known(keys, key)).map(([key, file]) => `${key} (${file})`);
    expect(missing).toEqual([]);
  });
});
