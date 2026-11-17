import { afterAll, describe, expect, it } from 'vitest';
import {
  BUILDING_IDS,
  INSTRUMENT_IDS,
  SATELLITE_IDS,
  START_BUILDINGS,
  type BuildingLevels,
} from '@astera/rules';
import i18n from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';
import { buildingTag, hullTag, instrumentTag, satelliteTag } from '../src/i18n/names.js';
import { buildingGain, cardEffect, instrumentGain, satelliteGain, type Gain } from '../src/lib/gains.js';
import { roughDuration } from '../src/lib/time.js';

/**
 * A BUILDING CARD IS A FIXED SKELETON (owner note 4, G2-b, 2026-11-14): the picture, the name,
 * ONE line of what it is for, ONE line of what the next level does, the price at the foot. A
 * line that does not fit made its card taller than its neighbour; now the copy is written to
 * the line. Japanese characters take two columns.
 *
 * At 350 px a card's text is 143 px wide (125 px at 320): about 22 columns of the 12 px purpose
 * line and 18 of the 13 px effect figures.
 */
const PURPOSE = 22;
const EFFECT = 18;
/** The foot's wait line, in the 12 px text face beside its hourglass. */
const WAIT = 20;

const columns = (text: string): number => text.length + (text.match(/[\p{scx=Hani}\p{scx=Hira}\p{scx=Kana}]/gu)?.length ?? 0);
const said = (effect: { now?: string; next: string }): string => effect.now === undefined ? effect.next : `${effect.now} → ${effect.next}`;

const at = (level: number): BuildingLevels => ({
  CORE: Math.max(START_BUILDINGS.CORE, level),
  REFINERY: Math.max(START_BUILDINGS.REFINERY, level),
  EXTRACTOR: Math.max(START_BUILDINGS.EXTRACTOR, level),
  VAULT: Math.max(START_BUILDINGS.VAULT, level),
  SHIPYARD: Math.max(START_BUILDINGS.SHIPYARD, level),
  DEUTERIUM_PLANT: Math.max(START_BUILDINGS.DEUTERIUM_PLANT, level),
  HANGAR: Math.max(START_BUILDINGS.HANGAR, level),
});

const LEVELS = [0, 1, 4, 8, 14] as const;

afterAll(async () => {
  await i18n.changeLanguage('en');
});

describe('a building card’s purpose line', () => {
  for (const language of LANGUAGES) {
    it(`fits one line in ${language}`, async () => {
      await i18n.changeLanguage(language);
      const tags = [
        ...BUILDING_IDS.map((id) => buildingTag(id)),
        ...INSTRUMENT_IDS.map((id) => instrumentTag(id)),
        ...SATELLITE_IDS.map((id) => satelliteTag(id)),
        ...(['THORN', 'HARPOON', 'BASTION'] as const).map((id) => hullTag(id)),
      ];
      expect(tags.filter((tag) => columns(tag) > PURPOSE)).toEqual([]);
    });
  }
});

describe('a building card’s effect line', () => {
  for (const language of LANGUAGES) {
    it(`fits one line in ${language}`, async () => {
      await i18n.changeLanguage(language);
      const gains: Gain[] = [
        ...BUILDING_IDS.flatMap((id) => LEVELS.map((level) => buildingGain(id, level, 0, at(level)))),
        ...INSTRUMENT_IDS.flatMap((id) => LEVELS.map((level) => instrumentGain(id, level))),
        ...SATELLITE_IDS.map((id) => satelliteGain(id)),
      ];
      expect(gains.map((gain) => said(cardEffect(gain))).filter((line) => columns(line) > EFFECT)).toEqual([]);
    });
  }

  it('is the gain’s own figures where they fit, and its short form where they do not', async () => {
    await i18n.changeLanguage('en');
    const refinery = buildingGain('REFINERY', 3, 0, at(3));
    expect(cardEffect(refinery)).toEqual({ now: refinery.now, next: refinery.next });
    const vault = buildingGain('VAULT', 3, 0, at(3));
    expect(said(cardEffect(vault))).not.toBe(said({ ...(vault.now === undefined ? {} : { now: vault.now }), next: vault.next }));
  });
});

/**
 * WHEN A SHORT CARD WILL BE PAID FOR, IN ITS ONE LINE. The wait is an estimate and a floor, so
 * the card rounds it up to the hour past the first hour ("17 h", not "16 h 32 m"); the sheet
 * keeps the minutes.
 */
describe('a building card’s wait line', () => {
  it('rounds up to the hour past the first hour, and keeps minutes under it', async () => {
    await i18n.changeLanguage('tr');
    expect(roughDuration(53)).toBe('53 dk');
    expect(roughDuration(992)).toBe('17 sa');
    expect(roughDuration(60)).toBe('1 sa');
    expect(roughDuration(61)).toBe('2 sa');
    expect(roughDuration(1_620)).toBe('1 g 3 sa');
  });

  for (const language of LANGUAGES) {
    it(`fits one line in ${language}`, async () => {
      await i18n.changeLanguage(language);
      const lines = [5, 53, 351, 992, 1_439, 1_620, 3_000].map((minutes) => i18n.t('itemSheet.affordIn', { duration: roughDuration(minutes) }));
      expect(lines.filter((line) => columns(line) > WAIT)).toEqual([]);
    });
  }
});
