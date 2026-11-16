import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { de } from '../src/i18n/locales/de/index.js';
import { en } from '../src/i18n/locales/en/index.js';
import { es } from '../src/i18n/locales/es/index.js';
import { fr } from '../src/i18n/locales/fr/index.js';
import { ja } from '../src/i18n/locales/ja/index.js';
import { tr } from '../src/i18n/locales/tr/index.js';
import * as communityDe from '../src/i18n/locales/de/community.js';
import * as communityEn from '../src/i18n/locales/en/community.js';
import * as communityEs from '../src/i18n/locales/es/community.js';
import * as communityFr from '../src/i18n/locales/fr/community.js';
import * as communityJa from '../src/i18n/locales/ja/community.js';
import * as communityTr from '../src/i18n/locales/tr/community.js';
import * as planetDe from '../src/i18n/locales/de/planet.js';
import * as planetEn from '../src/i18n/locales/en/planet.js';
import * as planetEs from '../src/i18n/locales/es/planet.js';
import * as planetFr from '../src/i18n/locales/fr/planet.js';
import * as planetJa from '../src/i18n/locales/ja/planet.js';
import * as planetTr from '../src/i18n/locales/tr/planet.js';

/**
 * S1 (owner 2026-11-16): a sheet head is one line of title, at most 48 px. A title is a name, not a
 * sentence — 22 characters is what one line holds at 350 px beside the mark and the close. A head
 * never says the same thing twice (the eyebrow repeating the title was the donate sheet's).
 */
const TITLE_MAX = 22;
const PLANET = { tr: planetTr, en: planetEn, de: planetDe, es: planetEs, fr: planetFr, ja: planetJa };
const LOCALES = { tr, en, de, es, fr, ja };
const COMMUNITY = { tr: communityTr, en: communityEn, de: communityDe, es: communityEs, fr: communityFr, ja: communityJa };

describe('sheet head copy', () => {
  it.each(Object.entries(PLANET))('names every fault in one title line (%s)', (_, locale) => {
    for (const name of Object.values(locale.faults.name)) expect(name.length, name).toBeLessThanOrEqual(TITLE_MAX);
  });

  it.each(Object.entries(COMMUNITY))('names the donate sheet once, short (%s)', (_, locale) => {
    const { title, eyebrow } = locale.community.donate;
    expect(title.length, title).toBeLessThanOrEqual(14);
    expect(eyebrow).toBe('Astera Online');
    expect(title).not.toContain('Astera');
  });
});

/**
 * THE WHOLE GAME, NOT THE EXAMPLES (owner 2026-11-16: "oyunun yarısını unutma"). Every sheet the
 * code opens with a fixed title key is read in all six languages: each fits one title line.
 * Japanese is counted in wide glyphs, so its line holds half as many.
 */
describe('every fixed sheet title in the game', () => {
  const source = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return /gallery|onboarding|starter|admin/.test(entry.name) ? [] : source(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
  const keys = new Set<string>();
  for (const file of source('src')) {
    const text = readFileSync(file, 'utf8');
    for (const open of text.matchAll(/<Sheet\b[\s\S]{0,600}?>/g)) {
      // a quiet title is never drawn in the head: the sheet says its name in its own body
      if (/\bquietTitle\b/.test(open[0])) continue;
      const title = /\btitle=\{t\('([\w.]+)'\)\}/.exec(open[0]);
      if (title?.[1]) keys.add(title[1]);
    }
  }
  const pick = (tree: unknown, key: string): unknown => key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tree);

  it('finds the game’s sheets', () => { expect(keys.size).toBeGreaterThan(20); });

  it.each(Object.entries(LOCALES))('fits each one on one line (%s)', (lng, tree) => {
    const long = [...keys].flatMap((key) => {
      const title = pick(tree, key);
      if (typeof title !== 'string') return [];
      const max = lng === 'ja' ? 11 : TITLE_MAX;
      return title.length > max ? [`${key}: ${title}`] : [];
    });
    expect(long).toEqual([]);
  });
});

/**
 * S2 FOLLOW-UP (2026-11-16): the base's five stacked tabs. At 350 px each plate holds about 58 px
 * of 12 px capitals — eight letters — and a longer word broke mid-word ("SAVUNM/A", "TAKTİKSE/L").
 */
describe('the base’s five tab words', () => {
  it.each(Object.entries(PLANET))('fits each on its plate, whole (%s)', (_, locale) => {
    const tabs = locale.planet.tabs;
    for (const word of [tabs.growProblem, tabs.orbitProblem, tabs.defendProblem, tabs.tacticalProblem, tabs.reachProblem]) {
      expect(word.length, word).toBeLessThanOrEqual(8);
    }
  });
});

