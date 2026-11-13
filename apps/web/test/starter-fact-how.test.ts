import { describe, expect, it } from 'vitest';
import { starter as de } from '../src/i18n/locales/de/starter.js';
import { starter as en } from '../src/i18n/locales/en/starter.js';
import { starter as es } from '../src/i18n/locales/es/starter.js';
import { starter as fr } from '../src/i18n/locales/fr/starter.js';
import { starter as ja } from '../src/i18n/locales/ja/starter.js';
import { starter as tr } from '../src/i18n/locales/tr/starter.js';

/**
 * WHAT OPENS THE JUMP, SAID SO IT CAN BE DONE (code review 2026-11-13). A ship alone in its galaxy has
 * no neighbour to probe, and its first report comes from an outpost (plan 2026-11-13 Faz 1.2a). The hint
 * that names the missing report says both, in each language's own word for an outpost.
 */
describe('the hint for the first probe report', () => {
  const outpost = { tr: 'karakol', en: 'outpost', de: 'Außenposten', es: 'puesto avanzado', fr: 'avant-poste', ja: '前哨基地' } as const;
  const locales = { tr, en, de, es, fr, ja } as const;
  it.each(Object.keys(outpost) as (keyof typeof outpost)[])('names an outpost as well as a ship in %s', (lang) => {
    expect(locales[lang].factHow.FIRST_PROBE_REPORT).toContain(outpost[lang]);
  });
});
