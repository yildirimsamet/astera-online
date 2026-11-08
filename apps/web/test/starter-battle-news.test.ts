import { beforeEach, describe, expect, it } from 'vitest';
import type { NotificationView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { describeNotification } from '../src/lib/notifications.js';

/**
 * THE SIGNAL OF A RAID FROM THE SHIP (F4f). The first win says its crate is ready, and a fleet that found
 * the guard already gone says who took it, before the report is even opened.
 */
const at = new Date('2026-11-08T12:00:00Z');
const note = (payload: object): NotificationView => ({
  id: 'n', kind: 'BATTLE_REPORT', seen: false, at,
  payload: { grade: 'DECISIVE', attacking: true, opponent: 'Tevis', opponentKind: 'OUTPOST', loot: { alloy: 60, crystal: 0, deuterium: 0 }, lost: 0, ...payload },
});
const said = (payload: object) => describeNotification(note(payload), at.getTime());

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('a raid\'s signal, aboard', () => {
  it('reads as before for an ordinary raid', () => {
    expect(said({})).toBe(i18n.t('starter.news.raidOver', { name: 'Tevis' }));
  });

  it('says the first win opened the victory crate', () => {
    expect(said({ firstVictory: true })).toBe('Tevis has fallen! Your victory crate is ready at the Shipyard.');
  });

  it('says who took the guard first', () => {
    expect(said({ beatenBy: 'Early' })).toBe('Early reached Tevis before you: the guard was already down. Read the report.');
  });
});
