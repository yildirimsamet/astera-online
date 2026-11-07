import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import { describeError } from '../src/i18n/errors.js';
import i18n from '../src/i18n/index.js';
import { errors as de } from '../src/i18n/locales/de/errors.js';
import { errors as en } from '../src/i18n/locales/en/errors.js';
import { errors as es } from '../src/i18n/locales/es/errors.js';
import { errors as fr } from '../src/i18n/locales/fr/errors.js';
import { errors as ja } from '../src/i18n/locales/ja/errors.js';
import { errors as tr } from '../src/i18n/locales/tr/errors.js';

const services = join(import.meta.dirname, '../../server/src/services/starter');
const codes = new Set(readdirSync(services).flatMap(file =>
  [...readFileSync(join(services, file), 'utf8').matchAll(/(?:GameError\(|code: )'([A-Z_]+)'/g)].map(match => match[1]!)));

describe('what a ship can be told', () => {
  it.each(Object.entries({ en, tr, de, es, fr, ja }))('%s has words for every refusal the ship services can send', (_locale, errors) => {
    expect(codes.size).toBeGreaterThan(20);
    expect([...codes].filter(code => !(code in errors))).toEqual([]);
  });
});

/** Exactly what `services/starter` sends. A figure the catalogue needs and the wire lacks reads as "something went wrong". */
const REFUSALS: readonly (readonly [string, Record<string, string | number>])[] = [
  ['QUEUE_FULL', { context: 'repairs' }],
  ['QUEUE_FULL', { context: 'yard' }],
  ['QUEUE_FULL', { context: 'research' }],
  ['QUEUE_FULL', { context: 'dock' }],
  ['OUT_OF_RANGE', { context: 'ship', reach: 340 }],
  ['BAD_SLOT', { context: 'ship', level: 1, slots: 1 }],
  ['PLANET_NOT_FOUND', { context: 'ship' }],
  ['SELF_PROBE', { context: 'ship' }],
  ['NO_SEASON', { context: 'jump' }],
  ['HANGAR_FULL', { context: 'ship', used: 30, capacity: 32, needed: 4 }],
  ['PROSPECTOR_CAP', { max: 5, have: 2 }],
];

const PLANET_WORDS: Record<string, RegExp> = {
  en: /\b(planet|world)s?\b|Telescope L\d/i,
  tr: /gezegen|dünya|seviye/i,
  de: /planet|welt/i,
  es: /planeta|mundo/i,
  fr: /planète|monde/i,
  ja: /惑星|世界/,
};

describe('a ship is refused in words', () => {
  for (const language of Object.keys(PLANET_WORDS)) {
    for (const [code, params] of REFUSALS) {
      it(`${language}: ${code} ${String(params.context ?? '')}`, async () => {
        await i18n.changeLanguage(language);
        const said = describeError(new ApiError(code, 'raw', 409, params));
        expect(said).not.toBe(i18n.t('errors.unknown'));
        expect(said).not.toContain('{{');
        expect(said).not.toMatch(PLANET_WORDS[language]!);
      });
    }
  }
});
