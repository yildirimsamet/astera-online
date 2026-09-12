import { describe, expect, it } from 'vitest';
import { activeGalaxyEventsSchema, chroniclePageSchema } from '../src/api/schemas.js';

const shower = {
  id: '87fd333f-4270-4ada-a809-2f34ea37aca6',
  kind: 'ASTEROID_SHOWER',
  startsAt: '2026-09-02T10:00:00.000Z',
  endsAt: '2026-09-02T11:00:00.000Z',
  asteroidSpawnMultiplier: 5,
};

const convoy = {
  id: '2f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d11',
  kind: 'INTERGALACTIC_CONVOY',
  startsAt: '2026-09-02T04:00:00.000Z',
  endsAt: '2026-09-02T06:00:00.000Z',
  appearsAtMinute: 420,
  expiresAtMinute: 540,
  route: {
    from: { x: -2000, y: 0, z: 0 },
    to: { x: 2000, y: 0, z: 0 },
    velocity: { x: 100 / 3, y: 0, z: 0 },
    speed: 100 / 3,
  },
  visual: { formationVersion: 1 },
  rewardPolicy: {
    resourceCapHours: 2,
    fullRewardForceRatio: 1,
    shipDropFullFirepower: 5780,
    shipDropChanceAtFullQuality: 0.15,
    maxAwardedShips: 3,
  },
};

describe('galaxy event rolling-deploy contracts', () => {
  it('keeps known active events when a newer server also sends an unknown kind', () => {
    const parsed = activeGalaxyEventsSchema.parse({
      events: [
        { ...shower, kind: 'TRADING_SHIP', exchangeRate: 1.2 },
        shower,
      ],
    });

    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]?.kind).toBe('ASTEROID_SHOWER');
  });

  it('skips an unknown generic lifecycle row without losing known Chronicle history', () => {
    const parsed = chroniclePageSchema.parse({
      events: [
        {
          id: 'future-event',
          kind: 'galaxy_event_started',
          subjectPlanetId: null,
          payload: {
            eventKind: 'TRADING_SHIP',
            startsAt: '2026-09-02T10:00:00.000Z',
            endsAt: '2026-09-02T12:00:00.000Z',
          },
          occurredAt: '2026-09-02T10:00:00.000Z',
        },
        {
          id: 'known-event',
          kind: 'galaxy_event_started',
          subjectPlanetId: null,
          payload: {
            eventKind: 'ASTEROID_SHOWER',
            startsAt: '2026-09-02T10:00:00.000Z',
            endsAt: '2026-09-02T11:00:00.000Z',
            asteroidSpawnMultiplier: 5,
          },
          occurredAt: '2026-09-02T10:00:00.000Z',
        },
      ],
      nextBefore: null,
    });

    expect(parsed.events.map((event) => event.id)).toEqual(['known-event']);
  });

  it('still rejects malformed payloads for event kinds this client understands', () => {
    expect(() => activeGalaxyEventsSchema.parse({
      events: [{ ...shower, asteroidSpawnMultiplier: 1 }],
    })).toThrow();
  });

  it('keeps the complete public convoy route and reward policy', () => {
    const parsed = activeGalaxyEventsSchema.parse({ events: [convoy] });
    const event = parsed.events[0];
    expect(event?.kind).toBe('INTERGALACTIC_CONVOY');
    if (event?.kind !== 'INTERGALACTIC_CONVOY') throw new Error('convoy was dropped');
    expect(event.route.velocity.x).toBeCloseTo(event.route.speed, 10);
    expect(event.rewardPolicy.maxAwardedShips).toBe(3);
  });
});
