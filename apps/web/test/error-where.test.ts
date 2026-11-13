import { describe, expect, it } from 'vitest';
import { analyticsPropertiesSchema } from '../src/api/analyticsSchemas.js';
import { errorWhere } from '../src/lib/playerAnalytics/errorWhere.js';

/**
 * A CRASH WE CAN FIND, WITHOUT ITS WORDS. Faz 0 (2026-11-13) saw a new player crash twice before
 * their first order and leave; the event said only `react_render`. The production bundle is minified
 * and ships no source map, so a component name would read `Xe`. The top stack frame of a known build
 * maps back through a rebuild of that revision with source maps. The message never leaves the phone.
 */
describe('where an error was thrown', () => {
  it('reads the top frame of a Chromium stack as chunk:line:column and the error type', () => {
    const error = new TypeError('Cannot read properties of undefined (reading \'x\')');
    error.stack = 'TypeError: Cannot read properties of undefined (reading \'x\')\n'
      + '    at Xe (https://astera.example/assets/index-Bq3x9.js?v=2#top:12:3456)\n'
      + '    at Ra (https://astera.example/assets/vendor-77.js:1:99)';
    expect(errorWhere(error)).toEqual({ subject: 'index-Bq3x9.js:12:3456', variant: 'TypeError' });
  });

  it('reads a Firefox and Safari stack the same way', () => {
    const error = new RangeError('bad');
    error.stack = 'Xe@https://astera.example/assets/index-Bq3x9.js:7:21\nRa@https://astera.example/assets/vendor.js:1:2';
    expect(errorWhere(error)).toEqual({ subject: 'index-Bq3x9.js:7:21', variant: 'RangeError' });
  });

  it('falls back to the event location when the error carries no stack', () => {
    expect(errorWhere(null, { filename: 'https://astera.example/assets/index-Bq3x9.js', lineno: 3, colno: 9 }))
      .toEqual({ subject: 'index-Bq3x9.js:3:9', variant: 'unknown' });
  });

  it('names what was thrown when it was not an Error', () => {
    expect(errorWhere('a thrown string')).toEqual({ variant: 'string' });
    expect(errorWhere(undefined)).toEqual({ variant: 'undefined' });
  });

  it('never carries the message and always fits the telemetry allowlist', () => {
    const error = new Error('private player text');
    error.name = 'Weird Name <script>';
    error.stack = `Error: private player text\n    at x (chrome-extension://abc/${'very-long-'.repeat(30)}file name.js:1:2)`;
    const where = errorWhere(error);
    expect(JSON.stringify(where)).not.toContain('private player text');
    expect(analyticsPropertiesSchema.safeParse(where).success).toBe(true);
  });
});
