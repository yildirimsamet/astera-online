import { afterAll, describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import { describeError } from '../src/i18n/errors.js';
import i18n from '../src/i18n/index.js';

describe('the pirate discovery gate', () => {
  afterAll(async () => { await i18n.changeLanguage('en'); });

  it('explains a rejected Radar-only raid in the commander’s language', async () => {
    await i18n.changeLanguage('tr');
    const said = describeError(new ApiError('PIRATE_NOT_IDENTIFIED', 'Identify this pirate first', 403));
    expect(said).toMatch(/teleskop/i);
  });
});
