import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { escortLine } from '../src/lib/flights.js';

/** F25: an escorted wave read "32 craft" in Fleet › In flight; the commander ship was nowhere on the list. */
describe('an escorted flight on the list', () => {
  let previous = 'en';
  beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); });
  afterEach(async () => { await i18n.changeLanguage(previous); });

  it('names the commander ship flying with it, and says nothing for a wave without one', () => {
    expect(escortLine({ admiral: { ship: 'kilavuz', level: 4 } })).toBe('+ komutan gemin · Kılavuz Sv 4');
    expect(escortLine({})).toBeNull();
  });
});
