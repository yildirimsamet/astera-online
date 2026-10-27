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
      const found = strings(arenaCopy()).filter(text => /\bfarm|deneme|trial|playtest|savaş alanı|battle zone/i.test(text));
      expect(found).toEqual([]);
    });
  }

  it('says in every language what the menu\'s door is for, not that it is a test', async () => {
    for (const language of ['tr', 'en', 'de', 'es', 'fr', 'ja']) {
      await i18n.changeLanguage(language);
      expect(i18n.t('arena.menuHint')).not.toMatch(/farm|deneme|playtest|test|prueba|essai|テスト/i);
    }
  });
});
