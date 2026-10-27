import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../src/i18n/index.js';
import { describeNotification, signalFamily, signalGlyph } from '../../src/lib/notifications.js';
import { DESTINATION } from '../../src/shell/Signals.js';
import type { NotificationView } from '../../src/api/schemas.js';
let old: string;
beforeEach(async () => { old = i18n.language; await i18n.changeLanguage('tr'); });
afterEach(async () => { await i18n.changeLanguage(old); });
const note = (payload: unknown): NotificationView => ({ id: 'notice', kind: 'arena_ship_ready', payload, seen: false, at: new Date() });
describe('ready ship news', () => {
  it('names repair or maintenance completion and opens the ship hangar', () => {
    const repair = note({ ship: 'kilavuz', reason: 'repair' }); const service = note({ ship: 'akinci', reason: 'service' });
    expect(describeNotification(repair, Date.now())).toMatch(/tamiri tamamlandı/);
    expect(describeNotification(service, Date.now())).toMatch(/bakımı tamamlandı/);
    expect(DESTINATION.arena_ship_ready?.panel).toBe('ship'); expect(signalGlyph(repair)).toBe('returned');
  });
  it('says a team share waits in the hangar, with what it holds', () => {
    const share: NotificationView = { id: 'share', kind: 'arena_team_share', seen: false, at: new Date(),
      payload: { teamId: '00000000-0000-4000-8000-000000000004', share: { alloy: 150, crystal: 60, deuterium: 0 } } };
    const text = describeNotification(share, Date.now()) ?? '';
    expect(text).toMatch(/Takım payın hazır/); expect(text).toContain('150'); expect(text).toContain('60');
    expect(DESTINATION.arena_team_share?.panel).toBe('ship'); expect(signalGlyph(share)).toBe('returned');
    expect(describeNotification({ ...share, payload: {} }, Date.now())).toBe('Takım payın hazır. Hangarda al.');
  });
  // F22: the result the pilot never saw, because their page closed mid-flight.
  it('says a flight was lost while the page was closed, and what the hold lost', () => {
    const lost = (payload: unknown): NotificationView => ({ id: 'lost', kind: 'arena_sortie_end', seen: false, at: new Date(), payload });
    const towed = describeNotification(lost({ outcome: 'towed', lost: { alloy: 50, crystal: 4, deuterium: 0 }, reason: 'service', readyAt: '2026-10-26T12:00:00Z', xp: 4 }), Date.now()) ?? '';
    expect(towed).toMatch(/Bağlantın koptu/); expect(towed).toContain('50'); expect(towed).toContain('4');
    const dead = describeNotification(lost({ outcome: 'dead', lost: { alloy: 0, crystal: 0, deuterium: 0 }, reason: 'repair', readyAt: '2026-10-26T12:00:00Z', xp: 4 }), Date.now()) ?? '';
    expect(dead).toMatch(/düşürüldü/); expect(dead).not.toMatch(/kaybedilen/i);
    expect(DESTINATION.arena_sortie_end?.panel).toBe('ship');
    expect(describeNotification(lost({}), Date.now())).toBeTruthy();
  });
  // F14: the commander's own ship is not a galaxy event.
  it('files ship news as the commander\'s own, never as a galaxy event', () => {
    expect(signalFamily(note({ reason: 'repair' }))).toBe('gain');
    expect(signalFamily({ id: 's', kind: 'arena_team_share', seen: false, at: new Date(), payload: {} })).toBe('gain');
    expect(signalFamily({ id: 'l', kind: 'arena_sortie_end', seen: false, at: new Date(), payload: {} })).toBe('watch');
  });
  it('renders a safe generic completion for a historic or malformed payload', () => {
    expect(describeNotification(note({ reason: '<script>' }), Date.now())).toBe('Komutan gemin hazır. Hangarı aç.');
  });
});
