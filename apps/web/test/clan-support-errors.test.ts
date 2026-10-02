import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import { describeError } from '../src/i18n/errors.js';
import i18n from '../src/i18n/index.js';
import { LANGUAGES } from '../src/i18n/languages.js';

/**
 * KLAN SAVUNMA DESTEĞİ — every refusal it added, in the player's language (P12). The first
 * refusal is the send button's face, so a code with no copy would put the server's English
 * on the one control a Turkish commander is reading.
 */

const CODES = [
  ['CLAN_SUPPORT_UNAVAILABLE', {}],
  ['POSTURE_CONFLICT', {}],
  ['CLAN_SUPPORT_NONCOMBATANT', { hull: 'PROSPECTOR' }],
  ['CLAN_SUPPORT_SELF', {}],
  ['CLAN_SUPPORT_TARGET', {}],
  ['CLAN_SUPPORT_MEMBERSHIP', {}],
  ['CLAN_SUPPORT_MEMBER_IMMATURE', { until: '2026-10-01T12:00:00.000Z' }],
  ['CLAN_SUPPORT_CLOSED', {}],
  ['CLAN_SUPPORT_TIER_BAND', { mine: 2, theirs: 4 }],
  ['CLAN_SUPPORT_ROOM_FULL', { used: 460, total: 470 }],
  ['CLAN_SUPPORT_SEASON_TOO_SHORT', {}],
  ['CLAN_SUPPORT_NOT_FOUND', {}],
  ['CLAN_SUPPORT_NOT_OWNED', {}],
  ['CLAN_SUPPORT_LANDING', {}],
  ['CLAN_SUPPORT_NOT_HOST', {}],
] as const;

describe('the clan support refusals, said properly', () => {
  // The shared setup puts every test back in English, so each one asks for Turkish.
  beforeEach(async () => { await i18n.changeLanguage('tr'); });
  afterAll(async () => { await i18n.changeLanguage('en'); });

  for (const [code, params] of CODES) {
    it(`says ${code} in Turkish rather than the server's English`, async () => {
      const serverSentence = `server sentence for ${code}`;
      const said = describeError(new ApiError(code, serverSentence, 409, params));
      await i18n.changeLanguage('en');
      const english = describeError(new ApiError(code, serverSentence, 409, params));
      expect(said).not.toBe(serverSentence);
      expect(said).not.toBe(english);
      expect(said).not.toContain('{{');
      if ('used' in params) expect(said).toContain('460');
      if ('mine' in params) expect(said).toContain('2');
    });
  }

  it('words a shielded sender of SHIPS apart from one of resources', () => {
    const ships = describeError(new ApiError('SHIELDED_SENDER', 's', 409, { until: 'x', context: 'ships' }));
    const resources = describeError(new ApiError('SHIELDED_SENDER', 's', 409, { until: 'x' }));
    expect(ships).not.toBe(resources);
    expect(ships).toMatch(/gemi/i);
  });

  for (const locale of LANGUAGES) {
    it(`carries every one of them in ${locale}`, async () => {
      const { errors } = await import(`../src/i18n/locales/${locale}/errors.ts`) as {
        errors: Record<string, string>;
      };
      for (const [code] of CODES) expect(errors[code], `${locale}.${code}`).toBeTruthy();
      expect(errors.SHIELDED_SENDER_ships, `${locale}.SHIELDED_SENDER_ships`).toBeTruthy();
      expect(errors.CLAN_SUPPORT_ROOM_FULL).toContain('{{used}}');
      expect(errors.CLAN_SUPPORT_TIER_BAND).toContain('{{theirs}}');
    });
  }
});
