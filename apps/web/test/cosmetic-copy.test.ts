import { expect, it } from 'vitest';
import { COSMETICS } from '@astera/rules';
import { cosmeticCopy } from '../src/ui/cosmeticCopy.js';
import { skins as de } from '../src/i18n/locales/de/skins.js';
import { skins as en } from '../src/i18n/locales/en/skins.js';
import { skins as es } from '../src/i18n/locales/es/skins.js';
import { skins as fr } from '../src/i18n/locales/fr/skins.js';
import { skins as ja } from '../src/i18n/locales/ja/skins.js';
import { skins as tr } from '../src/i18n/locales/tr/skins.js';

const LOCALES: Record<string, Record<string, string>> = { de, en, es, fr, ja, tr };

it('names and tells every engine look in all six languages', () => {
  for (const item of COSMETICS.filter(cosmetic => cosmetic.category === 'ENGINE')) {
    const copy = cosmeticCopy(item.id);
    expect(copy, item.id).toBeDefined();
    for (const [locale, table] of Object.entries(LOCALES)) {
      for (const key of [copy.nameKey, copy.storyKey]) {
        const value = table[key.replace(/^skins\./, '')];
        expect(typeof value === 'string' && value.trim().length > 0, `${locale} ${key}`).toBe(true);
      }
    }
  }
});
