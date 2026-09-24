import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { factor } from '../src/lib/format.js';

/**
 * A MULTIPLIER, AS THE RULES STATE IT. D1: the build sheet names the counter cycle's
 * multipliers, and ×0.6 for 0.625 would be teaching a rule that is not the one the
 * resolver applies.
 */
describe('a multiplier', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('keeps every digit the rule has, and no padding', () => {
    expect(factor(1.6)).toBe('×1.6');
    expect(factor(0.625)).toBe('×0.625');
    expect(factor(2)).toBe('×2');
  });

  it('writes the decimal the way the language does', async () => {
    await i18n.changeLanguage('tr');
    expect(factor(0.625)).toBe('×0,625');
  });
});
