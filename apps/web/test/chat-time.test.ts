import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { chatRelativeTime } from '../src/lib/chatTime.js';

const now = new Date('2026-08-22T12:00:00.000Z').getTime();
const ago = (ms: number) => new Date(now - ms);

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('Moment-backed chat time boundaries', () => {
  it('uses just now below one minute and minutes below one hour', () => {
    expect(chatRelativeTime(ago(59_999), now, i18n.t)).toBe('just now');
    expect(chatRelativeTime(ago(60_000), now, i18n.t)).toBe('1 minute ago');
    expect(chatRelativeTime(ago(59 * 60_000), now, i18n.t)).toBe('59 minutes ago');
  });

  it('uses hours plus remaining minutes below one day, then whole days', () => {
    expect(chatRelativeTime(ago(60 * 60_000), now, i18n.t)).toBe('1h 0m ago');
    expect(chatRelativeTime(ago((23 * 60 + 59) * 60_000), now, i18n.t)).toBe('23h 59m ago');
    expect(chatRelativeTime(ago(24 * 60 * 60_000), now, i18n.t)).toBe('1 day ago');
  });

  it('uses the same boundaries in Turkish', async () => {
    await i18n.changeLanguage('tr');
    expect(chatRelativeTime(ago(30_000), now, i18n.t)).toBe('şimdi');
    expect(chatRelativeTime(ago((2 * 60 + 7) * 60_000), now, i18n.t)).toBe('2 sa 7 dk önce');
    expect(chatRelativeTime(ago(2 * 24 * 60 * 60_000), now, i18n.t)).toBe('2 gün önce');
  });
});
