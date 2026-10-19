import { afterAll, describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import { describeError } from '../src/i18n/errors.js';
import i18n from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';

afterAll(async () => { await i18n.changeLanguage('en'); });
describe('a commander who is leaving', () => {
  for (const language of LANGUAGES) {
    it(`explains the refused launch in ${language}`, async () => {
      await i18n.changeLanguage(language);
      const message = describeError(new ApiError('TARGET_LEAVING', 'server fallback', 409));
      expect(message).not.toBe(i18n.t('errors.unknown'));
      expect(message).not.toBe('server fallback');
    });
  }
});
