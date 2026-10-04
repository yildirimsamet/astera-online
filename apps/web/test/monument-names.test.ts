import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { monumentName } from '../src/i18n/names.js';
import { monumentModelUrl } from '../src/galaxy/MonumentModel.js';

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('named monument targets', () => {
  it('shows the supplied name for every model instead of a numbered label', () => {
    expect([1, 2, 3, 4, 5].map(monumentName)).toEqual([
      'Abandoned Space Wreckage', 'Abandoned Station', 'Ancient Observatory',
      'Ancient Stargate', 'Shattered World Ship',
    ]);
    expect(monumentName(4)).toBe('Ancient Stargate');
    expect(monumentModelUrl(4)).toContain('monument_ancient_stargate.glb');
  });

  it('uses localized names in Turkish and keeps missing identities readable', async () => {
    await i18n.changeLanguage('tr');
    expect([1, 2, 3, 4, 5].map(monumentName)).toEqual([
      'Terk Edilmiş Uzay Enkazı', 'Terk Edilmiş İstasyon', 'Kadim Gözlemevi',
      'Kadim Yıldız Geçidi', 'Parçalanmış Dünya Gemisi',
    ]);
    for (const ordinal of [undefined, 0, 1.5, 6]) expect(monumentName(ordinal)).toBe('Anıt');
  });

  it.each(['en', 'tr', 'de', 'es', 'fr', 'ja'])('has a complete name catalog in %s', async (language) => {
    await i18n.changeLanguage(language);
    for (let ordinal = 1; ordinal <= 5; ordinal += 1) {
      const key = ['one', 'two', 'three', 'four', 'five'][ordinal - 1];
      expect(i18n.exists(`monument.names.${key}`, { lng: language, fallbackLng: false })).toBe(true);
      expect(monumentName(ordinal)).not.toMatch(/^(?:Monument|Anıt) \d$|monument\./);
    }
  });
});
