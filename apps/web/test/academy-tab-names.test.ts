import { describe, expect, it } from 'vitest';
import i18n, { i18nReady } from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';

/**
 * THE ACADEMY NAMES THE PLANET TAB THE PLAYER WILL TAP. Its intel and defend steps end with "tap the
 * … tab", so each says the tab's own word in every language (review of stage 4.1, 2026-11-13: the
 * base's tabs were renamed to fit a 350 px phone, and German still said "Aufklärung" and
 * "Verteidigung" for tabs reading "Intel" and "Abwehr").
 */
/** The tab's word standing alone: "Intel" is not found inside "Inteligencia". */
const word = (label: string): RegExp => new RegExp(`(^|[^\\p{Script=Latin}])${label}([^\\p{Script=Latin}]|$)`, 'u');

describe('the academy', () => {
  it.each(LANGUAGES)('names the planet tabs as the tabs do (%s)', async (language) => {
    await i18nReady;
    await i18n.loadLanguages(language);
    const t = i18n.getFixedT(language);
    expect(t('academy.steps.intel')).toMatch(word(t('planet.tabs.orbitProblem')));
    expect(t('academy.steps.defend')).toMatch(word(t('planet.tabs.defendProblem')));
  });
});
