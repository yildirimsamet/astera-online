import { describe, expect, it } from 'vitest';
import { de } from '../src/i18n/locales/de/index.js';
import { en } from '../src/i18n/locales/en/index.js';
import { es } from '../src/i18n/locales/es/index.js';
import { fr } from '../src/i18n/locales/fr/index.js';
import { ja } from '../src/i18n/locales/ja/index.js';
import { tr } from '../src/i18n/locales/tr/index.js';

/**
 * E6 / S6 (owner 2026-11-16/17): "Bilgi yağmuru yok." Every line the text sweep shortened keeps
 * to its new length in all six languages, so a later edit cannot quietly grow it back into a
 * paragraph. Japanese reads denser, so it is held to half the Latin cap.
 */
const LOCALES = { tr, en, de, es, fr, ja };

/** The sweep's lines: the key, and how many characters a Latin-script language may spend on it. */
const SHORT: readonly (readonly [key: string, max: number])[] = [
  ['galaxy.commander.wipeNote', 60],
  ['rewards.intro', 90],
  ['rewards.overCap', 90],
  ['notificationCenter.lead', 100],
  ['skins.intro', 70],
  ['silentSpace.body', 125],
  ['silentSpace.queueHint', 90],
];

function at(tree: unknown, path: string): string {
  let node: unknown = tree;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) throw new Error(`no ${path}`);
    const next: unknown = Reflect.get(node, part);
    node = next;
  }
  if (typeof node !== 'string') throw new Error(`${path} is not a line`);
  return node;
}

describe('the text sweep keeps its lines short', () => {
  it.each(SHORT)('%s stays within %i characters in every language', (key, max) => {
    for (const [language, locale] of Object.entries(LOCALES)) {
      const line = at(locale, key);
      expect(line.length, `${language}: ${line}`).toBeLessThanOrEqual(language === 'ja' ? Math.ceil(max / 2) : max);
    }
  });
});
