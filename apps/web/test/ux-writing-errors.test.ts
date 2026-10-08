import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import i18n from '../src/i18n/index.js';
import { describeError } from '../src/i18n/errors.js';
import { LANGUAGES } from '../src/i18n/languages.js';

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('a player error explains only what the client can verify', () => {
  it.each(LANGUAGES)('does not expose unknown server or JavaScript diagnostics in %s', async (language) => {
    await i18n.changeLanguage(language);
    const diagnostics = 'TypeError: payload validation failed at /internal/transactions';
    for (const error of [
      ...['NEW_SERVER_CODE', 'constructor', 'toString', '__proto__'].map(code => new ApiError(code, diagnostics, 500)),
      new Error(diagnostics), diagnostics, null,
    ]) {
      expect(describeError(error)).toBe(i18n.t('errors.unknown'));
      expect(describeError(error)).not.toContain('payload');
    }
  });

  it.each(LANGUAGES)('keeps verified fuel figures in a known refusal in %s', async (language) => {
    await i18n.changeLanguage(language);
    const result = describeError(new ApiError('INSUFFICIENT_FUEL', 'server fallback', 409, { needed: 12, have: 3 }));
    expect(result).toContain('12');
    expect(result).toContain('3');
    expect(result).not.toContain('server fallback');
  });

  it.each(LANGUAGES)('does not show an unresolved amount from an older server in %s', async (language) => {
    await i18n.changeLanguage(language);
    const result = describeError(new ApiError('INSUFFICIENT_FUEL', 'private diagnostic', 409));
    expect(result).toBe(i18n.t('errors.unknown'));
    expect(result).not.toContain('{{');
    expect(result).not.toContain('private diagnostic');
  });

  it.each(LANGUAGES)('distinguishes a lost connection from a broken live feed in %s', async (language) => {
    await i18n.changeLanguage(language);
    expect(describeError(new ApiError('UNREACHABLE', 'Failed to fetch', 0))).toBe(i18n.t('errors.unreachable'));
    expect(describeError(new ApiError('STREAM_FAILED', 'event stream EOF', 0))).toBe(i18n.t('errors.streamFailed'));
    expect(i18n.t('errors.unreachable')).not.toBe(i18n.t('errors.streamFailed'));
  });
});
