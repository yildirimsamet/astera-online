import { describe, expect, it } from 'vitest';
import { leaderboard as de } from '../src/i18n/locales/de/shell.js';
import { leaderboard as en } from '../src/i18n/locales/en/shell.js';
import { leaderboard as es } from '../src/i18n/locales/es/shell.js';
import { leaderboard as fr } from '../src/i18n/locales/fr/shell.js';
import { leaderboard as ja } from '../src/i18n/locales/ja/shell.js';
import { leaderboard as tr } from '../src/i18n/locales/tr/shell.js';

// Owner 2026-11-09: the rule sheet states the attack table every locale plays by.
describe.each(Object.entries({ de, en, es, fr, ja, tr }))('Honor band copy: %s', (_locale, copy) => {
  it('states the three full-return limits of an attack', () => {
    expect(copy.honorRuleBands).toMatch(/1[.,]5/);
    expect(copy.honorRuleBands).toMatch(/2[.,]5/);
  });

  it('no longer states the retired attack percentages', () => {
    expect(copy.honorRuleBands).not.toMatch(/75/);
  });

  it('keeps the defender percentages beside the defence rule', () => {
    expect(copy.honorRuleDefense).toMatch(/75/);
    expect(copy.honorRuleDefense).toMatch(/50/);
  });

  // Owner 2026-11-12: a lower tier is weak only below a third, and the repeat rule has a day window.
  it('names the one-third weak line and the repeat window', () => {
    expect(copy.honorRuleBands).toMatch(/üçte bir|a third|Drittel|tercio|tiers|3分の1/);
    expect(copy.honorRuleBands).not.toMatch(/yarısından az|less than half|weniger als der Hälfte|menos de la mitad|moins de la moitié|半分未満/);
    expect(copy.honorRuleRepeat).toMatch(/24/);
    expect(copy.honorRuleRepeat).toMatch(/üçte bir|a third|Drittel|tercio|tiers|3分の1/);
  });

  it('gives receipts wording true of every table a battle may be frozen under', () => {
    expect(copy.honorBand.HALF).not.toMatch(/dörtte|quarter|Vierteln|cuartos|quarts|4分の3/);
  });
});
