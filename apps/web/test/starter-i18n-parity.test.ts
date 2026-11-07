import { describe, expect, it } from 'vitest';
import { starter as de } from '../src/i18n/locales/de/starter.js';
import { starter as en } from '../src/i18n/locales/en/starter.js';
import { starter as es } from '../src/i18n/locales/es/starter.js';
import { starter as fr } from '../src/i18n/locales/fr/starter.js';
import { starter as ja } from '../src/i18n/locales/ja/starter.js';
import { starter as tr } from '../src/i18n/locales/tr/starter.js';

const PLURAL = /_(zero|one|two|few|many|other)$/;
const keysOf = (node: unknown, prefix = ''): string[] =>
  node !== null && typeof node === 'object'
    ? Object.entries(node).flatMap(([key, value]) => keysOf(value, `${prefix}${prefix ? '.' : ''}${key}`))
    : [prefix.replace(PLURAL, '')];

describe('the ship in six languages', () => {
  const english = new Set(keysOf(en));
  it.each(Object.entries({ tr, de, es, fr, ja }))('%s says everything English says, and nothing more', (_, locale) => {
    const here = new Set(keysOf(locale));
    expect([...english].filter(key => !here.has(key))).toEqual([]);
    expect([...here].filter(key => !english.has(key))).toEqual([]);
  });
});
