import { beforeEach, describe, expect, it } from 'vitest';
import { activeGalaxyEventsSchema, chroniclePageSchema, pendingSchema, planetMoonSchema, seasonSchema, synthesisViewSchema, trafficSchema, type NotificationView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { describeNotification } from '../src/lib/notifications.js';

/*
  ASTERYUM ON THE WIRE (plan 2026-11-24 §4). The storm is a galaxy event the client must keep (not drop as
  unknown), the season names the laboratory, the laboratory parses, and the storm's notice reads as the
  storm, never as an asteroid shower.
*/
const storm = { id: '0d6c6b73-8a54-4a5a-9d3e-1c1a2b3c4d5e', kind: 'ASTERIUM_STORM', startsAt: '2026-11-26T18:00:00.000Z', endsAt: '2026-11-26T19:00:00.000Z' };
const window = { eventKind: 'ASTERIUM_STORM', startsAt: storm.startsAt, endsAt: storm.endsAt };
const AT = new Date('2026-11-26T18:00:00.000Z');
const note = (kind: string, payload: Record<string, unknown>): NotificationView => ({ id: 'n1', kind, refId: 'r1', payload, seen: false, at: AT });

beforeEach(async () => { await i18n.changeLanguage('tr'); });

describe('the Asteryum Fırtınası', () => {
  it('is kept as an active event and as the next one', () => {
    const parsed = activeGalaxyEventsSchema.parse({ events: [storm], next: { kind: 'ASTERIUM_STORM', startsAt: storm.startsAt } });
    expect(parsed.events.map((event) => event.kind)).toEqual(['ASTERIUM_STORM']);
    expect(parsed.next?.kind).toBe('ASTERIUM_STORM');
  });

  it('keeps its Chronicle rows', () => {
    const parsed = chroniclePageSchema.parse({
      events: [{ id: 'e1', kind: 'galaxy_event_started', subjectPlanetId: null, payload: window, occurredAt: storm.startsAt }],
      nextBefore: null,
    });
    expect(parsed.events).toHaveLength(1);
  });

  it('announces itself as the storm, not as an asteroid shower', () => {
    const started = describeNotification(note('galaxy_event_started', window), AT.getTime()) ?? '';
    const ended = describeNotification(note('galaxy_event_ended', window), AT.getTime()) ?? '';
    expect(started).toMatch(/Asteryum/);
    expect(ended).toMatch(/Asteryum/);
    expect(started).not.toMatch(/asteroid/i);
  });
});

describe('the laboratory', () => {
  it('is named on the season', () => {
    const base = seasonSchema.safeParse({});
    // Only the feature flag is under test; the rest of the season is covered by its own contract.
    expect(base.success).toBe(false);
    expect(seasonSchema.shape.features.parse({ moons: true, synthesis: true })).toEqual({ moons: true, synthesis: true });
    expect(seasonSchema.shape.features.parse({ moons: true })).toEqual({ moons: true, synthesis: false });
  });

  it('parses the laboratory read, and says when a batch is done', () => {
    const view = synthesisViewSchema.parse({
      enabled: true, requiredCore: 10, coreLevel: 10, unlocked: true, asterium: 12, perDay: 3,
      moons: [{ planetId: 'p1', planetName: 'Vega', rarity: 'RARE', perDay: 3 }],
      capsules: { OPTIC_VEIL: 2, SILENT_THRUST: 0 },
      job: { capsuleId: 'OPTIC_VEIL', quantity: 3, delivered: 1, startedAt: '2026-11-26T17:00:00.000Z', nextAt: '2026-11-26T18:00:00.000Z', completesAt: '2026-11-26T18:30:00.000Z' },
      storm: { active: true, startsAt: storm.startsAt, endsAt: storm.endsAt },
    });
    expect(view.job?.delivered).toBe(1);
    expect(describeNotification(note('synthesis_ready', { capsuleId: 'OPTIC_VEIL', quantity: 3 }), AT.getTime())).toMatch(/3/);
  });
});

/* G17: a veiled leg keeps its mark on the wire, so the owner and the clan can draw it cloaked. */
describe('the veil on the wire', () => {
  const path = { from: { x: 0, y: 0, z: 0 }, to: { x: 40, y: 0, z: 0 }, departAt: '2026-04-01T12:00:00.000Z', arriveAt: '2026-04-01T12:04:00.000Z' };
  it('keeps veiled on the owner’s own thread and on a clanmate’s contact', () => {
    const own = pendingSchema.parse({ pending: [{ id: '3a1f9c22-5b6d-4e8f-9012-abcdef012345', kind: 'fleet', targetName: 'Vega-3', minutesRemaining: 4,
      arriveAt: '2026-04-01T12:04:00.000Z', leg: 'outbound', fleet: { DART: 8 }, path, veiled: true }] });
    expect(own.pending[0]?.veiled).toBe(true);
    const seen = trafficSchema.parse({ contacts: [{ id: '5d2b7f5a-1c4e-4a2d-9f0b-8a3c1d5e6f70', kind: 'fleet', from: path.from, to: path.to,
      startAt: path.departAt, endAt: path.arriveAt, fleet: { DART: 8 }, veiled: true }] });
    expect(seen.contacts[0]?.veiled).toBe(true);
  });
});

describe('a moon\'s Asteryum on the wire', () => {
  const moon = { rarity: 'RARE', origin: 'BATTLE', cracks: 0, crackLimit: 5, lastHitAt: null, gateReadyAt: null, closedUntil: null,
    visualSeed: 1, fleet: {}, dockUsed: 0, dockCapacity: 1550, dockFree: 1550, scanRange: 2250, scanPierces: false, moves: [] };
  it('reads where the moon\'s next unit stands and what it has made, and an older server without it', () => {
    const read = planetMoonSchema.parse({ ...moon, asterium: { syncedAt: '2026-11-25T10:00:00.000Z', fraction: 0.4, produced: 12 } });
    expect(read.asterium).toEqual({ syncedAt: new Date('2026-11-25T10:00:00.000Z'), fraction: 0.4, produced: 12 });
    expect(planetMoonSchema.parse(moon).asterium).toBeUndefined();
    expect(() => planetMoonSchema.parse({ ...moon, asterium: { syncedAt: '2026-11-25T10:00:00.000Z', fraction: 1, produced: 0 } })).toThrow();
  });
});
