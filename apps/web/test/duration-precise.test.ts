import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { durationPrecise } from '../src/lib/time.js';

/**
 * THE ETA IS A MOMENT, NOT A ROUNDED ONE. D182 — owner instruction.
 *
 * `duration` rounds to whole minutes, which is right for a build queue and wrong
 * for the launch sheet: a raid arrives at an authoritative instant, the whole game
 * is built on being there for it, and "12m" for a flight of 12m 41s is the one
 * screen where that difference is a decision. Seconds only appear where a player
 * is timing something.
 *
 * IT STOPS AT A DAY. Past 24 hours the seconds are noise — nobody is timing a
 * two-day flight to the second — so the existing days-and-hours shape stands.
 */
describe('a precise duration', () => {
  for (const lang of ['tr', 'en'] as const) {
    describe(lang, () => {
      it('shows minutes and seconds under an hour', async () => {
        await i18n.changeLanguage(lang);
        expect(durationPrecise(12 + 41 / 60)).toBe(lang === 'tr' ? '12d 41sn' : '12m 41s');
      });

      it('pads the seconds so the figure does not jump width', async () => {
        await i18n.changeLanguage(lang);
        expect(durationPrecise(12 + 5 / 60)).toBe(lang === 'tr' ? '12d 05sn' : '12m 05s');
      });

      it('shows all three units past an hour', async () => {
        await i18n.changeLanguage(lang);
        expect(durationPrecise(61 + 5 / 60)).toBe(lang === 'tr' ? '1s 01d 05sn' : '1h 01m 05s');
      });

      it('drops to seconds alone under a minute', async () => {
        await i18n.changeLanguage(lang);
        expect(durationPrecise(41 / 60)).toBe(lang === 'tr' ? '41sn' : '41s');
      });

      /** Unpadded, because this is `duration`'s own shape and it does not pad. */
      it('falls back to days and hours past a day', async () => {
        await i18n.changeLanguage(lang);
        expect(durationPrecise(25 * 60 + 30)).toBe(lang === 'tr' ? '1g 1s' : '1d 1h');
      });
    });
  }

  it('never reads negative', async () => {
    await i18n.changeLanguage('en');
    expect(durationPrecise(-5)).toBe('0s');
  });
});
