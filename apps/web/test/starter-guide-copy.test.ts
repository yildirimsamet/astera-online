import { describe, expect, it } from 'vitest';
import { starter as de } from '../src/i18n/locales/de/starter.js';
import { starter as en } from '../src/i18n/locales/en/starter.js';
import { starter as es } from '../src/i18n/locales/es/starter.js';
import { starter as fr } from '../src/i18n/locales/fr/starter.js';
import { starter as ja } from '../src/i18n/locales/ja/starter.js';
import { starter as tr } from '../src/i18n/locales/tr/starter.js';

/**
 * THE GUIDE SPEAKS IN SHORT STORY LINES (plan 2026-11-18 §4 İ4): why, what, the result; twelve words at
 * most; never which button to press, since the mark already shows where. A line says what is at stake.
 */
type Words = typeof en;
const guide = (words: Words): Record<string, string> => ({
  ...words.tutorial.line,
  ...Object.fromEntries(Object.entries(words.tutorial.nav).map(([key, line]) => [`nav.${key}`, line])),
});
const LATIN = { en, tr, de, fr, es } as const;
const count = (line: string): number => line.replace(/\{\{\w+\}\}/gu, 'X').split(/\s+/u).filter(word => /[\p{L}\p{N}X?]/u.test(word)).length;
const vars = (line: string): string[] => [...line.matchAll(/\{\{(\w+)\}\}/gu)].map(match => match[1] ?? '').sort();

describe('the guide\'s lines', () => {
  it.each(Object.entries(LATIN))('stay within twelve words in %s', (_, words) => {
    const long = Object.entries(guide(words)).filter(([, line]) => count(line) > 12);
    expect(long).toEqual([]);
  });

  it.each(Object.entries(LATIN))('keep the director\'s lines within twelve words too, in %s', (_, words) => {
    const flat = (tree: unknown, at: string): [string, string][] => typeof tree === 'string' ? [[at, tree]]
      : tree && typeof tree === 'object' ? Object.entries(tree).flatMap(([key, value]) => flat(value, `${at}.${key}`)) : [];
    expect(flat(words.director, 'director').filter(([, line]) => count(line) > 12)).toEqual([]);
  });

  it('stay short in Japanese', () => {
    const length = (line: string): number => [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(line)].length;
    expect(Object.entries(guide(ja)).filter(([, line]) => length(line) > 45)).toEqual([]);
  });

  it('never name the button to press: the mark already shows it', () => {
    const PRESS: readonly (readonly [string, Words, RegExp])[] = [
      ['en', en, /\b(tap|press|click)\b/iu], ['tr', tr, /düğme|dokun/iu], ['de', de, /\btipp/iu],
      ['fr', fr, /\btouche\b/iu], ['es', es, /\btoca\b/iu], ['ja', ja, /タップ/u],
    ];
    for (const [lang, words, press] of PRESS) {
      const told = Object.entries(guide(words)).filter(([, line]) => press.test(line) || /\{\{(try|repair)\}\}/u.test(line));
      expect(told, lang).toEqual([]);
    }
  });

  it('name the same things in every language', () => {
    const base = guide(en);
    for (const words of [tr, de, fr, es, ja]) {
      for (const [key, line] of Object.entries(guide(words))) expect(vars(line), key).toEqual(vars(base[key] ?? ''));
    }
  });
});
