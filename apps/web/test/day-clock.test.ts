import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { dayClock } from '../src/lib/time.js';

/**
 * WHEN A FIGHT HAPPENED, AS THE MOCK SAYS IT (M5): "Bugün 21:40". A date is read against
 * today; a report from this evening needs no year, and one from last night says so.
 */
const at = (iso: string) => new Date(iso);
const hour = (date: Date) => new Intl.DateTimeFormat(i18n.t('units.numberLocale'), { timeStyle: 'short' }).format(date);

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('a day and a clock', () => {
  const now = at('2026-09-25T15:00:00').getTime();

  it('says today and the clock for a moment earlier today', () => {
    const fight = at('2026-09-25T09:40:00');
    expect(dayClock(fight, now)).toBe(`Today ${hour(fight)}`);
  });

  it('says yesterday for the day before', () => {
    const fight = at('2026-09-24T21:40:00');
    expect(dayClock(fight, now)).toBe(`Yesterday ${hour(fight)}`);
  });

  it('falls back to the date for anything older', () => {
    const fight = at('2026-09-20T21:40:00');
    expect(dayClock(fight, now)).toBe(new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(fight));
  });

  it('speaks the reader’s language', async () => {
    await i18n.changeLanguage('tr');
    const fight = at('2026-09-25T09:40:00');
    expect(dayClock(fight, now)).toBe(`Bugün ${hour(fight)}`);
  });
});
