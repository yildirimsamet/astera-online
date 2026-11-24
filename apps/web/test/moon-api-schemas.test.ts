import { describe, expect, it } from 'vitest';
import {
  galaxyMoonsSchema,
  moonBuildSchema,
  moonHopSchema,
  moonJumpSchema,
  moonRetargetSchema,
  moonScanSchema,
  moonScansSchema,
  planetMoonSchema,
  probeMoonSchema,
  seasonSchema,
} from '../src/api/schemas.js';

describe('moon API schemas (F9a)', () => {
  it('parses season features.moons and remains backward-compatible when omitted', () => {
    const base = {
      seasonId: 's1',
      shard: 'EU-1',
      seed: 123,
      status: 'live',
      startsAt: '2026-11-01T00:00:00.000Z',
      endsAt: '2026-12-01T00:00:00.000Z',
      playerCap: 300,
      players: 10,
    };
    expect(seasonSchema.parse(base).features).toBeUndefined();
    expect(seasonSchema.parse({ ...base, features: { moons: true } }).features?.moons).toBe(true);
  });

  it('parses planetMoonSchema for a commander’s own moon', () => {
    const parsed = planetMoonSchema.parse({
      rarity: 'RARE',
      origin: 'BATTLE',
      cracks: 2,
      crackLimit: 5,
      lastHitAt: '2026-11-22T08:00:00.000Z',
      gateReadyAt: null,
      closedUntil: null,
      visualSeed: 42,
      fleet: { DART: 10 },
      dockUsed: 100,
      dockCapacity: 1550,
      dockFree: 1450,
      scanRange: 2250,
      scanPierces: false,
      moves: [{
        id: 'm1',
        kind: 'HOP_UP',
        fromPlanetId: 'p1',
        toPlanetId: 'p1',
        fleet: { DART: 4 },
        departAt: '2026-11-22T09:00:00.000Z',
        arriveAt: '2026-11-22T09:01:30.000Z',
      }],
    });
    expect(parsed.rarity).toBe('RARE');
    expect(parsed.moves[0]?.arriveAt).toBeInstanceOf(Date);
  });

  it('parses galaxyMoonsSchema (public list, observer rarity map, gate flashes)', () => {
    const parsed = galaxyMoonsSchema.parse({
      list: [{ planetId: 'p1', cracks: 1, lastHitAt: '2026-11-22T08:00:00.000Z', visualSeed: 7 }],
      rarity: { p1: 'EPIC' },
      flashes: {
        arrivals: [{ planetId: 'p2', at: '2026-11-22T09:00:00.000Z' }],
        departures: [{ planetId: 'p1', at: '2026-11-22T08:59:50.000Z', size: 'MEDIUM' }],
      },
    });
    expect(parsed.list).toHaveLength(1);
    expect(parsed.rarity.p1).toBe('EPIC');
    expect(parsed.flashes.departures[0]?.size).toBe('MEDIUM');
  });

  it('parses probeMoonSchema and moon action response schemas', () => {
    expect(probeMoonSchema.parse({
      rarity: 'LEGENDARY',
      cracks: 0,
      lastHitAt: null,
      closedUntil: null,
      gateReadyAt: null,
      fleet: { low: 10, high: 20 }, // the server's ProbeMoonReading band
      hopping: false,
    })).toMatchObject({ rarity: 'LEGENDARY', fleetSize: { low: 10, high: 20 } });

    expect(moonHopSchema.parse({
      id: 'h1', kind: 'HOP_UP', fleet: { DART: 3 },
      departAt: '2026-11-22T09:00:00.000Z', arriveAt: '2026-11-22T09:01:30.000Z',
    }).kind).toBe('HOP_UP');

    expect(moonJumpSchema.parse({
      id: 'j1', kind: 'JUMP', fleet: { DART: 5 }, fuelPaid: 120,
      departAt: '2026-11-22T09:00:00.000Z', arriveAt: '2026-11-22T09:00:10.000Z',
    }).fuelPaid).toBe(120);

    expect(moonScanSchema.parse({
      id: 's1', scannedAt: '2026-11-22T09:00:00.000Z', pierced: true,
      rows: [{ direction: 'IN', otherPlanetId: 'p2', arriveAt: '2026-11-22T09:15:00.000Z', size: 'HEAVY' }],
    }).pierced).toBe(true);

    expect(moonScansSchema.parse({ scans: [] }).scans).toEqual([]);
    expect(moonRetargetSchema.parse({
      id: 'r1', targetBody: 'MOON', arriveAt: '2026-11-22T09:30:00.000Z',
    }).targetBody).toBe('MOON');
    expect(moonBuildSchema).toBeDefined();
  });
});
