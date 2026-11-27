import { beforeEach, describe, expect, it } from 'vitest';
import { activeGalaxyEventsSchema, chroniclePageSchema, type NotificationView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { describeNotification } from '../src/lib/notifications.js';
import { EVENT_GLYPH, EVENT_NAME } from '../src/lib/nowLine.js';
import { galaxyArticles } from '../src/wiki/galaxy-content.js';

/*
  THE YARIK SAATİ ON THE WIRE (owner 2026-11-27). The Yarık opens twice a day: a new hour without Asteryum
  (17:00–18:00 Türkiye time) and the storm. The client keeps the new kind (not drop it as unknown), names it in
  every language, and a pilot who lost a ship to the closing reads why.
*/
const hour = { id: '6b8c2a1e-3f4d-4e5a-8b9c-0d1e2f3a4b5c', kind: 'RIFT_HOUR', startsAt: '2026-11-27T14:00:00.000Z', endsAt: '2026-11-27T15:00:00.000Z' };
const window = { eventKind: 'RIFT_HOUR', startsAt: hour.startsAt, endsAt: hour.endsAt };
const AT = new Date('2026-11-27T14:00:00.000Z');
const note = (kind: string, payload: Record<string, unknown>): NotificationView => ({ id: 'n1', kind, refId: 'r1', payload, seen: false, at: AT });

beforeEach(async () => { await i18n.changeLanguage('tr'); });

describe('the Yarık Saati', () => {
  it('is kept as an active event and as the next one', () => {
    const parsed = activeGalaxyEventsSchema.parse({ events: [hour], next: { kind: 'RIFT_HOUR', startsAt: hour.startsAt } });
    expect(parsed.events.map((event) => event.kind)).toEqual(['RIFT_HOUR']);
    expect(parsed.next?.kind).toBe('RIFT_HOUR');
  });

  it('keeps its Chronicle rows', () => {
    const parsed = chroniclePageSchema.parse({
      events: [
        { id: 'e1', kind: 'galaxy_event_started', subjectPlanetId: null, payload: window, occurredAt: hour.startsAt },
        { id: 'e2', kind: 'galaxy_event_ended', subjectPlanetId: null, payload: window, occurredAt: hour.endsAt },
      ],
      nextBefore: null,
    });
    expect(parsed.events).toHaveLength(2);
  });

  it('announces itself as the Yarık\'s hour, without Asteryum, and its end gives the minutes to fly out', () => {
    const started = describeNotification(note('galaxy_event_started', window), AT.getTime()) ?? '';
    const ended = describeNotification(note('galaxy_event_ended', window), AT.getTime()) ?? '';
    expect(started).toMatch(/Yarık Saati/);
    expect(started).not.toMatch(/Asteryum/);
    expect(ended).toMatch(/5 dakika/);
  });

  it('has a name and a mark on every surface that names an event', () => {
    expect(i18n.t(EVENT_NAME.RIFT_HOUR)).toBe('Yarık Saati');
    expect(EVENT_GLYPH.RIFT_HOUR).toBeTruthy();
  });

  it('is named in every language', async () => {
    for (const language of ['tr', 'en', 'de', 'es', 'fr', 'ja']) {
      await i18n.changeLanguage(language);
      for (const key of ['galaxy.eventsGuide.event.RIFT_HOUR', 'galaxy.eventsGuide.rift.title', 'galaxy.eventsGuide.rift.summary',
        'galaxy.eventsGuide.rift.note', 'synthesis.rift.chip', 'synthesis.rift.started', 'synthesis.rift.ended',
        'synthesis.rift.chronicleStarted', 'synthesis.rift.chronicleStartedDetail', 'synthesis.rift.chronicleEnded',
        'synthesis.rift.chronicleEndedDetail', 'notifications.arenaSortieClosed']) {
        expect(i18n.exists(key, { lng: language, fallbackLng: false }), `${language}: ${key}`).toBe(true);
      }
    }
  });
});

describe('the storm, now that the Yarık closes after it', () => {
  it('says at its end that entry has closed and how long is left to fly out', () => {
    const ended = describeNotification(note('galaxy_event_ended', { ...window, eventKind: 'ASTERIUM_STORM' }), AT.getTime()) ?? '';
    expect(ended).toMatch(/5 dakika/);
    expect(i18n.t('synthesis.storm.chronicleEndedDetail')).not.toMatch(/biri alana kadar durur/);
  });
});

describe('a ship the Yarık closed on, read later', () => {
  it('says the Yarık closed on it, with what was lost', () => {
    const line = describeNotification(note('arena_sortie_end', { outcome: 'dead', closed: true, lost: { alloy: 30, crystal: 0, deuterium: 0 } }), AT.getTime()) ?? '';
    expect(line).toContain(i18n.t('notifications.arenaSortieClosed'));
    expect(line).toMatch(/30/);
    const shot = describeNotification(note('arena_sortie_end', { outcome: 'dead', lost: { alloy: 0, crystal: 0, deuterium: 0 } }), AT.getTime()) ?? '';
    expect(shot).toBe(i18n.t('notifications.arenaSortieDead'));
  });
});

describe('the Wiki', () => {
  it('puts the Yarık\'s two hours on the event calendar', () => {
    const events = galaxyArticles.find((article) => article.id === 'galaxy.events');
    const text = JSON.stringify(events);
    expect(text).toMatch(/Yarık Saati/);
    expect(text).toMatch(/17:00–18:00/);
  });
});
