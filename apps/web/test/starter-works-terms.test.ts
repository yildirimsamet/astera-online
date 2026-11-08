import { expect, it } from 'vitest';
import { starter as en } from '../src/i18n/locales/en/starter.js';
import { starter as tr } from '../src/i18n/locales/tr/starter.js';
import { starter as de } from '../src/i18n/locales/de/starter.js';
import { starter as fr } from '../src/i18n/locales/fr/starter.js';
import { starter as es } from '../src/i18n/locales/es/starter.js';
import { starter as ja } from '../src/i18n/locales/ja/starter.js';
it.each([{ words: en, term: 'works' }, { words: tr, term: 'havuz' }, { words: de, term: 'produktionslager' }, { words: fr, term: 'stock de production' }, { words: es, term: 'depósito de producción' }, { words: ja, term: '生産施設' }])('uses $term consistently in the collection lesson and help', ({ words, term }) => {
  for (const line of [words.tutorial.line.collect, words.tutorial.line.collectMine, words.handbook.holds.body]) expect(line.toLocaleLowerCase()).toContain(term);
});

it('keeps the works noun grammatical in French and Spanish', () => {
  const lines = (words: unknown): string[] => typeof words === 'string' ? [words] : words && typeof words === 'object' ? Object.values(words).flatMap(lines) : [];
  for (const line of [...lines(fr), ...lines(es)]) expect(line).not.toMatch(/\bla (stock de production|depósito de producción)/i);
});
