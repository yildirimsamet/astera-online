import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import { describeError } from '../src/i18n/errors.js';
import { moon as enMoon } from '../src/i18n/locales/en/moon.js';

describe('moon code-review web fixes', () => {
  it('#8: translates every server moon error code instead of falling back to generic error', () => {
    const fallback = describeError(new ApiError('TOTALLY_UNKNOWN_CODE', 'fallback', 500));
    for (const code of Object.keys(enMoon.errors)) {
      const msg = describeError(new ApiError(code, 'raw', 409));
      expect(msg).not.toBe(fallback);
      expect(msg.length).toBeGreaterThan(5);
    }
  });
});
