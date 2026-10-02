import { beforeEach, describe, expect, it } from 'vitest';
import type { NotificationView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { describeNotification, signalFamily, signalGlyph, signalOutcome } from '../src/lib/notifications.js';
import { DESTINATION } from '../src/shell/Signals.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the bell (P12). The host hears who is coming and when; both
 * sides hear why a wave left, each in their own voice; the supporter hears what their
 * ships did in somebody else's fight; a commander whose clan changed hears that the
 * retreat is back on. Every row opens where it is dealt with.
 */

const AT = new Date('2026-10-01T12:00:00.000Z');
const news = (kind: string, payload: Record<string, unknown>): NotificationView => ({
  id: 'n1', kind, refId: 'r1', payload, seen: false, at: AT,
});
const say = (kind: string, payload: Record<string, unknown>) => describeNotification(news(kind, payload), AT.getTime()) ?? '';

const departed = (over: Record<string, unknown>) => ({
  waveId: 'w', reason: 'EXPIRED', senderPlayerId: 's', senderName: 'Ali', hostPlayerId: 'h', hostName: 'Zeynep',
  hostPlanetId: 'vega', hostPlanetName: 'Vega', returnAt: '2026-10-01T12:40:00.000Z', role: 'HOST', ...over,
});

describe('clan support in the bell', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('tells the host who is coming, with how many ships and when', () => {
    const payload = { waveId: 'w', senderPlayerId: 's', senderName: 'Ali', hostPlanetId: 'vega', hostPlanetName: 'Vega',
      fleet: { PIKE: 8, DART: 4 }, arriveAt: '2026-10-01T12:14:00.000Z' };
    expect(say('clan_support_inbound', payload)).toMatch(/Ali is sending 12 ships to stand at Vega · lands in 14m/);
    expect(signalFamily(news('clan_support_inbound', payload))).toBe('gain');
    expect(DESTINATION.clan_support_inbound).toEqual({ panel: 'planet' });
  });

  it('tells the host whose ships left and why', () => {
    expect(say('clan_support_departed', departed({}))).toMatch(/Ali’s support left Vega: its twelve hours ran out/);
  });

  it('tells the sender in their own voice', () => {
    expect(say('clan_support_departed', departed({ role: 'SENDER', reason: 'SENT_BACK' })))
      .toMatch(/Your support is leaving Vega: sent back by the host/);
    expect(signalOutcome(news('clan_support_departed', departed({})))).toBe('neutral');
    expect(DESTINATION.clan_support_departed).toEqual({ panel: 'planet' });
  });

  it('tells a supporter what their ships did, and opens the report', () => {
    const payload = { reportId: 'r', grade: 'PARTIAL', hostPlanetId: 'vega', hostPlanetName: 'Vega',
      lost: 5, survived: 7 };
    const line = say('clan_support_result', payload);
    expect(line).toMatch(/Your support fought at Vega: 5 lost, 7 still standing/);
    // A supporter's Dominion never moves (owner, 2026-10-02), so the bell names none.
    expect(line).not.toMatch(/dominion/i);
    // The raid's grade is the raider's: a breached line is the supporter's loss, a repelled one their win.
    expect(signalOutcome(news('clan_support_result', payload))).toBe('loss');
    expect(signalGlyph(news('clan_support_result', payload))).toBe('raided');
    expect(signalOutcome(news('clan_support_result', { ...payload, grade: 'REPELLED' }))).toBe('win');
    expect(DESTINATION.clan_support_result).toEqual({ panel: 'report', stop: 'battles' });
  });

  it('says the retreat is back on when the clan changed', () => {
    expect(say('defence_posture_reset', { planetIds: ['a', 'b'], planetNames: ['Vega', 'Altair'] }))
      .toMatch(/Clan support closed on Vega, Altair · tactical retreat is back on/);
    expect(signalFamily(news('defence_posture_reset', { planetIds: ['a'], planetNames: ['Vega'] }))).toBe('watch');
    expect(DESTINATION.defence_posture_reset).toEqual({ panel: 'planet' });
  });

  it('says a support wave landed home', () => {
    expect(say('fleet_returned', { trip: 'support', craft: 7, craftKind: 'fleet' }))
      .toMatch(/7 support ships landed home/);
  });
});
