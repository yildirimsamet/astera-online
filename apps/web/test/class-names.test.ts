import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { combatClassLabel } from '../src/i18n/names.js';

/**
 * ONE NAME PER CLASS, IN EVERY SENTENCE. D199.
 *
 * The counter cycle is the whole of combat, and Turkish taught it under two sets of
 * names: the class dictionary and the launch sheet's cycle said Akıncı · Sur ·
 * Mızrak, while the hull descriptions a commander reads beside every ship said
 * Çevik and Siper. A rule taught with two vocabularies is two rules.
 */
describe('the three classes have one Turkish name each', () => {
  it('uses the class dictionary’s names and no others', () => {
    const dir = resolve(__dirname, '../src/i18n/locales/tr');
    for (const file of readdirSync(dir)) {
      const text = readFileSync(join(dir, file), 'utf8');
      expect(text, file).not.toMatch(/Çevik|Siper/);
    }
  });

  it('is the dictionary that names them', async () => {
    await i18n.changeLanguage('tr');
    expect(combatClassLabel('SKIRMISHER')).toBe('Akıncı');
    expect(combatClassLabel('BULWARK')).toBe('Sur');
    expect(combatClassLabel('LANCE')).toBe('Mızrak');
    await i18n.changeLanguage('en');
  });
});
