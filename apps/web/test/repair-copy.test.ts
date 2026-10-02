import { BUILD, RESEARCH_TECH, SHIP_DAMAGE } from '@astera/rules';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import { describeError } from '../src/i18n/errors.js';
import i18n from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';

/**
 * THE REPAIR STATION'S REFUSALS, SAID PROPERLY. Kalıcı gemi hasarı, `plan.md` F6.
 *
 * Every code the Repair Station can send reaches the player in their own language, and a
 * full queue names WHICH queue in words rather than the server's lower-cased id.
 */

const LOCALES = LANGUAGES;
const CODES = ['REPAIR_LOT_NOT_FOUND', 'REPAIR_LOT_BUSY', 'REPAIR_NOTHING_WAITING', 'SHIP_DAMAGE_UNAVAILABLE'] as const;

describe('the Repair Station refusals', () => {
  beforeAll(async () => { await i18n.changeLanguage('tr'); });
  afterAll(async () => { await i18n.changeLanguage('en'); });

  for (const code of CODES) {
    it(`says ${code} in Turkish rather than the server's English`, async () => {
      // The shared setup puts every test back in English, so the language is set here.
      await i18n.changeLanguage('tr');
      const { errors: turkish } = await import('../src/i18n/locales/tr/errors.js') as { errors: Record<string, string> };
      const serverSentence = `server sentence for ${code}`;
      expect(describeError(new ApiError(code, serverSentence, 409, {}))).toBe(turkish[code]);
    });
  }

  it('names a full queue in words, the Repair Station\'s included', () => {
    const repair = describeError(new ApiError('QUEUE_FULL', 'The repair queue is full', 409, { queue: 'repair', max: 3 }));
    expect(repair).not.toMatch(/\brepair\b/);
    expect(repair).toContain(i18n.t('repairStation.queue'));
    const yard = describeError(new ApiError('QUEUE_FULL', 'The yard queue is full', 409, { queue: 'yard', max: 3 }));
    expect(yard).not.toMatch(/\byard\b/);
  });

  for (const locale of LOCALES) {
    it(`carries every one of them in ${locale}`, async () => {
      const { errors } = await import(`../src/i18n/locales/${locale}/errors.ts`) as {
        errors: Record<string, string>;
      };
      for (const code of CODES) expect(errors[code], `${locale} ${code}`).toBeTruthy();
    });
  }
});

/**
 * THE NUMBERS THE STATION'S RULES SAY IN WORDS (2026-09-30). The menu's "how it works"
 * states the free-patch line, Industrial's two rungs and the cancel refund as words in
 * supported languages — Turkish suffixes (`%75'e`, `%50'ye`) cannot be interpolated — so the
 * rules they quote are pinned here. A tuning change fails this test and sends whoever made
 * it to `repairStation.ruleFree`, `ruleIndustrial` and `ruleCancel` in every locale.
 */
describe('the numbers the Repair Station states in words', () => {
  it('patches free up to twenty percent', () => {
    expect(SHIP_DAMAGE.autoRepairMaxBp).toBe(2000);
    expect(i18n.t('repairStation.ruleFree')).toMatch(/20%/);
  });

  it('lets Industrial leave 75%, then 50%', () => {
    expect(RESEARCH_TECH.repairLadder).toEqual([75, 50]);
    expect(i18n.t('repairStation.ruleIndustrial', { industrial: 'Industrial' })).toMatch(/75%.*50%/);
  });

  it('gives half back on a cancel', () => {
    expect(BUILD.cancelRefund).toBe(0.5);
    expect(i18n.t('repairStation.ruleCancel')).toMatch(/half/);
  });
});
