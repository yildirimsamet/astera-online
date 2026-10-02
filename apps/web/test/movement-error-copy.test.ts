import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import { describeError } from '../src/i18n/errors.js';
import i18n from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';

/**
 * EVERY REFUSAL THE MOVEMENT PACKAGE ADDED, IN THE PLAYER'S LANGUAGE. Self-review 2026-09-23, R4.
 *
 * Six codes shipped with no copy in any locale, so `describeError` fell back to the server's English
 * sentence — a Turkish commander pulling a fleet back under a raid read "That flight cannot be
 * called back". Each one is asserted to come back in Turkish, with its figures, and NOT as the
 * server's sentence.
 */
const LOCALES = LANGUAGES;
const CODES = [
  ['BAD_PACE', {}],
  ['PACE_TOO_SLOW', {}],
  ['NOT_RECALLABLE', {}],
  ['NOT_FOUND', {}],
  ['SHIELDED_SENDER', {}],
  ['TRANSFER_COOLDOWN', { seconds: 42 }],
] as const;

describe('the movement refusals, said properly', () => {
  beforeAll(async () => { await i18n.changeLanguage('tr'); });
  afterAll(async () => { await i18n.changeLanguage('en'); });

  for (const [code, params] of CODES) {
    it(`says ${code} in Turkish rather than the server's English`, () => {
      const serverSentence = `server sentence for ${code}`;
      const said = describeError(new ApiError(code, serverSentence, 400, params));
      expect(said).not.toBe(serverSentence);
      expect(said.length).toBeGreaterThan(10);
      if ('seconds' in params) expect(said).toContain('42');
    });
  }

  for (const locale of LOCALES) {
    it(`carries every one of them in ${locale}`, async () => {
      const { errors } = await import(`../src/i18n/locales/${locale}/errors.ts`) as {
        errors: Record<string, string>;
      };
      for (const [code] of CODES) expect(errors[code], `${locale}.${code}`).toBeTruthy();
      expect(errors.TRANSFER_COOLDOWN).toContain('{{seconds}}');
    });
  }
});
