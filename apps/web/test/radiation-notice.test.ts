import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import type { NotificationView } from '../src/api/schemas.js';
import { describeError } from '../src/i18n/errors.js';
import i18n from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';
import { describeNotification, isAlarming, signalFamily, signalGlyph, signalOutcome } from '../src/lib/notifications.js';
import { DESTINATION } from '../src/shell/Signals.js';

/**
 * WHAT A CLOUD TOOK, SAID IN THE BELL. Radyasyon, `plan.md` F10.
 *
 * `radiation_lost` is the only word a commander gets of ships a cloud finished — nobody
 * else saw it — so it reads as a loss, names where the flight was headed, and says how
 * many flew on when some did. A launch the server refuses for a lethal route says so in
 * the player's own language.
 */

const AT = new Date('2026-09-30T12:00:00.000Z');
const news = (payload: Record<string, unknown>): NotificationView => ({
  id: 'n1', kind: 'radiation_lost', refId: 'm1', payload, seen: false, at: AT,
});
const say = (payload: Record<string, unknown>) => describeNotification(news(payload), AT.getTime()) ?? '';

describe('radiation in the bell', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('says the whole wing is gone, and where it was going', () => {
    expect(say({ lost: 3, left: 0, toPlanetId: 'p2', toPlanetName: 'Kestrel' }))
      .toMatch(/Radiation destroyed all 3 ships on the way to Kestrel/);
  });

  it('says how many flew on when some did', () => {
    const line = say({ lost: 2, left: 3, toPlanetId: 'p2', toPlanetName: 'Kestrel' });
    expect(line).toMatch(/Radiation destroyed 2 ships on the way to Kestrel/);
    expect(line).toMatch(/3 flew on/);
  });

  it('still reads when the world has no name to give', () => {
    expect(say({ lost: 1, left: 0, toPlanetId: 'p2', toPlanetName: null })).toMatch(/Radiation destroyed your ship on the way/);
  });

  it('reads as a loss, drawn as the fleet it was, and opens the flight board', () => {
    const row = news({ lost: 2, left: 0, toPlanetId: 'p2', toPlanetName: 'Kestrel' });
    expect(signalFamily(row)).toBe('threat');
    expect(signalOutcome(row)).toBe('loss');
    expect(signalGlyph(row)).toBe('returned');
    expect(isAlarming(row)).toBe(true);
    expect(DESTINATION.radiation_lost).toEqual({ panel: 'planet' });
  });
});

describe('a lethal route refused', () => {
  beforeAll(async () => { await i18n.changeLanguage('tr'); });
  afterAll(async () => { await i18n.changeLanguage('en'); });

  it('is said in the player\'s language, with the count', async () => {
    // The shared setup puts every test back in English, so the language is set here.
    await i18n.changeLanguage('tr');
    const said = describeError(new ApiError('RADIATION_LETHAL', 'Radiation on this route would destroy ships', 409, { count: 3 }));
    expect(said).toMatch(/radyasyon 3 gemiyi/);
  });

  for (const locale of LANGUAGES) {
    it(`carries it in ${locale}`, async () => {
      const { errors } = await import(`../src/i18n/locales/${locale}/errors.ts`) as { errors: Record<string, string> };
      expect(errors.RADIATION_LETHAL, locale).toBeTruthy();
    });
  }
});
