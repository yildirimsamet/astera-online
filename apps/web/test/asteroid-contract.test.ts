import { describe, expect, it } from 'vitest';
import {
  asteroidSchema,
  chroniclePageSchema,
  miningFieldSchema,
  miningLaunchSchema,
  miningStatusSchema,
} from '../src/api/schemas.js';
import { planetView } from './fixtures.js';
import { asteroidVisualSeed } from '../src/galaxy/scene.js';

const asteroid = {
  id: 'mJt7YvxMZEC5S7yYQ32SYw',
  level: 2,
  ore: 1_600,
  oreRemaining: 1_200,
  crystalShare: 0.4,
  radius: 1_500,
  period: 20,
  phase: 1,
  inclination: 2,
  ascendingNode: 3,
  speed: 500,
  appearsAt: 100,
  expiresAt: 300,
  active: true,
  isotopeRich: false,
  deuteriumShare: null,
};

describe('private asteroid wire contract', () => {
  it('accepts an opaque id and does not expose an internal numeric index', () => {
    const parsed = asteroidSchema.parse(asteroid);
    expect(parsed.id).toBe(asteroid.id);
    expect(parsed).not.toHaveProperty('index');
  });

  it('rejects the old enumerable numeric identity', () => {
    const { id: _id, ...withoutId } = asteroid;
    expect(() => asteroidSchema.parse({ ...withoutId, index: 7 })).toThrow();
  });

  it.each(['', '7', 'contains spaces', 'short', `${asteroid.id}x`])(
    'rejects malformed opaque id %s',
    (id) => {
      expect(() => asteroidSchema.parse({ ...asteroid, id })).toThrow();
    },
  );

  it('requires the next server-defined field change and parses it as a date', () => {
    const parsed = miningFieldSchema.parse({
      asteroids: [asteroid],
      debris: [],
      nextFieldChangeAt: '2026-01-01T00:05:00.000Z',
    });
    expect(parsed.nextFieldChangeAt).toEqual(new Date('2026-01-01T00:05:00.000Z'));
    expect(() => miningFieldSchema.parse({ asteroids: [asteroid], debris: [] })).toThrow();
  });

  it('accepts null when no later discovery, expiry or depletion is scheduled', () => {
    expect(miningFieldSchema.parse({
      asteroids: [], debris: [], nextFieldChangeAt: null,
    }).nextFieldChangeAt).toBeNull();
  });

  it('keys private isotope knowledge by opaque id', () => {
    const parsed = miningStatusSchema.parse({
      derrick: false,
      craftSpeed: 500,
      craftHold: 100,
      derrickHold: 150,
      runs: [],
      isotopes: [{ id: asteroid.id, deuteriumShare: 0.12 }],
    });
    expect(parsed.isotopes).toEqual([{ id: asteroid.id, deuteriumShare: 0.12 }]);
  });

  it('returns an opaque target id from a mining launch and no target id from salvage', () => {
    const common = {
      runId: 'run-1',
      craft: 1,
      arriveAt: new Date(),
      flightMinutes: 1,
      intercept: { x: 0, y: 0, z: 0 },
      capacity: 100,
      mining: {
        derrick: false,
        craftSpeed: 500,
        craftHold: 100,
        derrickHold: 150,
        runs: [],
        isotopes: [],
      },
      pending: [],
      planet: planetView(),
    };
    expect(miningLaunchSchema.parse({ ...common, asteroidId: asteroid.id }).asteroidId)
      .toBe(asteroid.id);
    expect(miningLaunchSchema.parse(common)).not.toHaveProperty('asteroidId');
  });

  it('does not publish an enumerable asteroid index through the Chronicle', () => {
    const parsed = chroniclePageSchema.parse({
      events: [{
        id: 'event-1',
        kind: 'isotope_exhausted',
        subjectPlanetId: null,
        payload: {},
        occurredAt: new Date(),
      }],
      nextBefore: null,
    });
    expect(parsed.events[0]?.payload).toEqual({});
  });

  it('derives stable visual variety from an opaque id without needing a numeric index', () => {
    const first = asteroidVisualSeed(asteroid.id);
    expect(asteroidVisualSeed(asteroid.id)).toBe(first);
    expect(asteroidVisualSeed('AAAAAAAAAAAAAAAAAAAAAA')).not.toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(0xffff_ffff);
  });
});
