import { afterAll, describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import { describeError } from '../src/i18n/errors.js';
import i18n from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';

afterAll(async () => { await i18n.changeLanguage('en'); });
describe('profanity refusals', () => {
  for (const language of LANGUAGES) {
    it(`names the refused word and the next step in ${language}`, async () => {
      await i18n.changeLanguage(language);
      for (const code of ['NAME_NOT_ALLOWED', 'CLAN_NAME_NOT_ALLOWED', 'MESSAGE_NOT_ALLOWED']) {
        const message = describeError(new ApiError(code, 'server fallback', 400, { word: 'amk' }));
        expect(message).not.toBe(i18n.t('errors.unknown'));
        expect(message).toContain('amk');
        expect(message).not.toContain('{{');
      }
    });
  }
});
