import { describe, expect, it } from 'vitest';
import { describeNotification, isAlarming, signalOutcome } from '../src/lib/notifications.js';
import type { NotificationView } from '../src/api/schemas.js';
import { isReportSignal } from '../src/lib/dock.js';

const monument = { targetKind: 'MONUMENT', monumentId: '68af7958-61b8-4f14-a5c1-34f692be7987',
  monumentOrdinal: 4, attacking: true, grade: 'REPELLED', control: 'DEFENDER',
  survivors: 3, unitsLost: 0, lootDeuterium: 0, dominion: 7040 };
const raid = { grade: 'REPELLED', shipsHome: 2, unitsLost: 1, lootAlloy: 0, lootCrystal: 0, dominion: -100 };
const note = (payload: unknown, kind = 'raid_result'): NotificationView => ({
  id: 'notice', kind, payload, seen: false, at: new Date('2026-10-15T13:02:37.112Z'),
});

describe('battle results are independent of score and event urgency', () => {
  it.each([-7040, 0, 7040])('does not call Atakan’s repelled capture a win at score %i', dominion => {
    const n = note({ ...monument, dominion });
    expect(signalOutcome(n)).toBe('loss');
    expect(describeNotification(n, n.at.getTime())).toMatch(/not captured.*repelled/i);
    if (dominion > 0) expect(describeNotification(n, n.at.getTime())).toContain('+7,040');
  });
  it.each([-7040, 0, 7040])('recognises retained control for its defender at score %i', dominion => {
    const n = note({ ...monument, attacking: false, dominion });
    expect(signalOutcome(n)).toBe('win');
    expect(describeNotification(n, n.at.getTime())).toMatch(/retained/i);
  });
  it('names partial success separately from an unsuccessful capture', () => {
    const n = note({ ...monument, grade: 'PARTIAL' });
    expect(signalOutcome(n)).toBe('partial');
    expect(describeNotification(n, n.at.getTime())).toMatch(/not captured.*partial/i);
  });
  it('does not equate a decisive battle with monument capture', () => {
    const n = note({ ...monument, control: 'EMPTY', grade: 'DECISIVE', dominion: 0 });
    expect(signalOutcome(n)).toBe('neutral');
    expect(describeNotification(n, n.at.getTime())).toMatch(/neither side controls/i);
  });
  it('keeps a destroyed contributor visible even when their side captures', () => {
    const n = note({ ...monument, control: 'ATTACKER', grade: 'DECISIVE', survivors: 0, unitsLost: 3 });
    expect(signalOutcome(n)).toBe('loss');
    expect(isAlarming(n)).toBe(true);
    expect(describeNotification(n, n.at.getTime())).toMatch(/captured.*entire fleet/i);
  });
  it.each([undefined, 'PIRATE'] as const)('matches a repelled ordinary raid to its report (%s)', targetKind => {
    expect(signalOutcome(note({ ...raid, targetKind }))).toBe('loss');
  });
  it('recognises successful planet defence without losing its urgency', () => {
    expect(signalOutcome(note({ grade: 'REPELLED', unitsLost: 0, lootAlloy: 0, lootCrystal: 0 }, 'raided'))).toBe('win');
  });
  it('does not hide a supporter’s personal wipe behind the line’s success', () => {
    const n = note({ grade: 'REPELLED', hostPlanetName: 'Host', lost: 4, survived: 0 }, 'clan_support_result');
    expect(signalOutcome(n)).toBe('loss');
    expect(isAlarming(n)).toBe(true);
    expect(describeNotification(n, n.at.getTime())).toMatch(/line.*held.*4.*0/i);
  });
  it('counts a supporter’s battle as a report on the Intel badge', () => {
    expect(isReportSignal('clan_support_result')).toBe(true);
  });
  it('keeps success with negative score distinct from a personal wipe', () => {
    expect(signalOutcome(note({ ...raid, grade: 'DECISIVE' }))).toBe('win');
    expect(signalOutcome(note({ ...raid, grade: 'DECISIVE', shipsHome: 0 }))).toBe('loss');
  });
  it('fails neutral for unreadable battle data rather than inventing victory', () => {
    expect(signalOutcome(note({ ...monument, control: 'UNKNOWN' }))).toBe('neutral');
    expect(signalOutcome(note({ grade: 'UNKNOWN' }))).toBe('neutral');
  });
  it.each([-1, 0.5, Infinity])('does not announce victory for an invalid survivor count %s', shipsHome => {
    expect(signalOutcome(note({ ...raid, grade: 'DECISIVE', shipsHome }))).toBe('neutral');
  });
});
