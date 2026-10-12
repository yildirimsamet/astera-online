import { afterAll, describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import { describeError } from '../src/i18n/errors.js';
import i18n from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';

afterAll(async () => { await i18n.changeLanguage('en'); });
describe('personal raid refusals', () => {
  for (const language of LANGUAGES) {
    it(`explains pending flights and the cooldown end in ${language}`, async () => {
      await i18n.changeLanguage(language);
      const until = '2026-10-12T15:30:00.000Z';
      const message = describeError(new ApiError('PERSONAL_RAID_COOLDOWN', 'server fallback', 403, { until }));
      expect(message).not.toBe(i18n.t('errors.unknown'));
      expect(message).not.toContain(until);
      expect(message).toContain('2026');
      expect(message).not.toContain('{{');
      const pending = describeError(new ApiError('PERSONAL_RAID_PENDING', 'server fallback', 409));
      expect(pending).not.toBe(i18n.t('errors.unknown'));
      expect(pending).not.toContain('{{');
    });
  }
  it('handles a malformed cooldown date without showing an invalid date', async () => {
    await i18n.changeLanguage('en');
    expect(describeError(new ApiError('PERSONAL_RAID_COOLDOWN', '', 403, { until: 'bad' })))
      .toBe(i18n.t('errors.unknown'));
  });
});
