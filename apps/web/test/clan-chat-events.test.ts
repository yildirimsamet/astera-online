import { beforeEach, describe, expect, it } from 'vitest';
import { clanChatPageSchema } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { describeClanEvent } from '../src/lib/clanChatEvent.js';
import { clockTime } from '../src/lib/time.js';

/**
 * F2 E2 — THE CLAN CHAT CARRIES THE FIGHT. An alarm, a wave sent, a defence's result and a rung
 * bought are posted to the clan's room as lines of their own, in the reader's language, so the
 * room reads what happened without anybody typing it.
 */

const ARRIVE = '2026-11-10T14:32:00.000Z';

describe('the clan chat battle feed', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('reads an alarm with the raid’s clock', () => {
    expect(describeClanEvent({ kind: 'ALARM', params: { hostName: 'Ayşe', hostPlanetName: 'Kuzgun', arriveAt: ARRIVE } }))
      .toBe(`Clan alarm · Ayşe’s Kuzgun is under attack · the raid lands at ${clockTime(new Date(ARRIVE))}`);
  });

  it('reads a wave sent, and whether it answers an alarm', () => {
    const params = { senderName: 'Ali', hostName: 'Ayşe', hostPlanetName: 'Kuzgun', ships: 20, arriveAt: ARRIVE, answering: true };
    expect(describeClanEvent({ kind: 'SUPPORT_SENT', params })).toBe('Ali is sending 20 ships to Kuzgun · answering the alarm');
    expect(describeClanEvent({ kind: 'SUPPORT_SENT', params: { ...params, answering: false } })).toBe('Ali is sending 20 ships to Kuzgun');
  });

  it('reads a defence by its outcome, and names a held line’s hero', () => {
    const params = { hostName: 'Ayşe', hostPlanetName: 'Kuzgun', grade: 'REPELLED', supporters: 2, attackerLost: 120, heroName: 'Ali' };
    expect(describeClanEvent({ kind: 'DEFENCE', params })).toBe('Kuzgun held with 2 supporters · 120 attacking ships destroyed · hero: Ali');
    expect(describeClanEvent({ kind: 'DEFENCE', params: { ...params, grade: 'DECISIVE', heroName: null } }))
      .toBe('Kuzgun fell despite 2 supporters · 120 attacking ships destroyed');
  });

  it('reads a rung bought with the perk it opened', () => {
    expect(describeClanEvent({ kind: 'LEVEL_UP', params: { level: 2 } })).toBe('The clan banner rose to level 2 · Clan alarm opened');
  });

  it('reads in Turkish', async () => {
    await i18n.changeLanguage('tr');
    expect(describeClanEvent({ kind: 'LEVEL_UP', params: { level: 3 } })).toBe('Klan sancağı seviye 3 oldu · Klan koridoru ×3 açıldı');
  });

  it('draws nothing for an event this build does not know, or a broken one', () => {
    expect(describeClanEvent({ kind: 'SOMETHING_NEW', params: {} })).toBeNull();
    expect(describeClanEvent({ kind: 'LEVEL_UP', params: { level: 'x' } })).toBeNull();
  });

  it('parses the event off the chat page', () => {
    const page = clanChatPageSchema.parse({ nextBefore: null, messages: [{
      id: 'm', authorPlayerId: 'p', username: 'Ayşe', content: '', createdAt: ARRIVE, self: false,
      event: { kind: 'LEVEL_UP', params: { level: 2 } },
    }] });
    expect(page.messages[0]?.event).toEqual({ kind: 'LEVEL_UP', params: { level: 2 } });
  });
});
