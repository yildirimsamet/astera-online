import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../src/i18n/index.js';
import { arenaCopy } from '../../src/arena/copy.js';

/** Every string a copy holds, functions called with sample arguments. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') {
    const out: unknown = (value as (...args: unknown[]) => unknown)(1, 2, '3');
    return typeof out === 'string' ? [out] : [];
  }
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

/**
 * F1/F1b/F1c (S22 review, 2026-10-26): the playtest's words outlived it. "Farm" is the code's
 * name for ore; "deneme uçuşu", "trial flight" and "Savaş Alanı" were the arena before it became
 * the Yarık. A player reads the Yarık, ore, the hold.
 */
describe('the Yarık\'s own words', () => {
  afterEach(async () => { await i18n.changeLanguage('en'); });
  for (const language of ['tr', 'en'] as const) {
    it(`${language}: no playtest words in the Yarık copy`, async () => {
      await i18n.changeLanguage(language);
      const found = strings(arenaCopy()).filter(text => /\bbots?\b|botlar|ボット|\bfarm|deneme|trial|playtest|savaş alanı|battle zone/i.test(text));
      expect(found).toEqual([]);
    });
  }
});

/*
  NO SCORE (owner 2026-11-25: "Yarık'ta puan diye bir şey yok"). The hold is what the capital gets; the tips,
  the goals and the result never turn it into points. The storm says only where to look: the middle.
*/
describe('the Yarık keeps no score', () => {
  afterEach(async () => { await i18n.changeLanguage('en'); });
  for (const [language, middle] of [['tr', /ortalar/i], ['en', /middle/i]] as const) {
    it(`${language}: no points in what a pilot reads about the hold, and the storm points to the middle`, async () => {
      await i18n.changeLanguage(language);
      const c = arenaCopy();
      for (const key of ['pointsShort', 'lostPoints', 'delivered', 'pointsCol']) expect(c).not.toHaveProperty(key);
      const read = strings([c.tips, c.goals, c.standingsRule, c.extractedHint, c.emptyHint, c.storm]);
      expect(read.filter(text => /puan|\bpoints?\b|\bpts\b|score/i.test(text))).toEqual([]);
      expect(c.storm).toMatch(middle);
    });
  }
});
