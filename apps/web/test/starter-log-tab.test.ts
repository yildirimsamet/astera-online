import { describe, expect, it } from 'vitest';
import i18n, { i18nReady } from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';

/**
 * THE SHIP LOG NAMES THE TAB THE PLAYER WILL TAP. Probe reports land in the dock's intel tab, so the
 * Survey chapter calls it by the dock's own word in every language (review of stage 4.1, 2026-11-13:
 * French said "Infos", the planet sheet's tab, and German "Intel" for a dock that says "Aufklärung").
 */
describe('the ship log', () => {
  it.each(LANGUAGES)('names the dock’s intel tab as the dock does (%s)', async (language) => {
    await i18nReady;
    await i18n.loadLanguages(language);
    const t = i18n.getFixedT(language);
    expect(t('starter.log.chapter.SURVEY.line')).toContain(t('dock.intel'));
  });
});
