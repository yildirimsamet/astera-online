import { describe, expect, it } from 'vitest';
import { STARTER, departureBlock, landingChoices, openingProgress, type PlanetSlot, type VesselProgress } from '../src/index.js';

/** The first loop done (plan 2026-11-13 §5.1): no drive, no part and no fuel asked. */
const ready = (over: Partial<VesselProgress> = {}): VesselProgress => ({
  ...openingProgress(), modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 }, facts: ['FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'], ...over,
});
const NOW = Date.UTC(2026, 10, 5);
const DAY = 86_400_000;

describe('may this ship leave', () => {
  const ask = (over: Partial<Parameters<typeof departureBlock>[0]> = {}) =>
    departureBlock({ progress: ready(), flying: 0, seasonEndsAtMs: NOW + 30 * DAY, nowMs: NOW, ...over });

  it('leaves with the window open, every fleet home, and time in the season', () => {
    expect(ask()).toBeNull();
  });

  it('wants the first loop done first: a mining run home and a probe report', () => {
    expect(ask({ progress: ready({ facts: ['FIRST_PROBE_REPORT'] }) })).toEqual({ code: 'MIGRATION_NOT_READY' });
    expect(ask({ progress: ready({ facts: ['FIRST_MINING_RETURN'] }) })).toEqual({ code: 'MIGRATION_NOT_READY' });
    expect(ask({ progress: openingProgress() })).toEqual({ code: 'MIGRATION_NOT_READY' });
  });

  it('waits for what is in the air', () => {
    expect(ask({ flying: 1 })).toEqual({ code: 'MIGRATION_FLEET_OUT', flying: 1 });
  });

  it('waits out the last five days of a season and says how many remain', () => {
    expect(ask({ seasonEndsAtMs: NOW + 3.2 * DAY })).toEqual({ code: 'MIGRATION_SEASON_WAIT', daysLeft: 4 });
    expect(ask({ seasonEndsAtMs: NOW + STARTER.migrationCutoffDays * DAY })).toBeNull();
    expect(ask({ seasonEndsAtMs: NOW + STARTER.migrationCutoffDays * DAY - 1 })).toEqual({ code: 'MIGRATION_SEASON_WAIT', daysLeft: 5 });
  });

  it('names the window before the fleet before the season, so one thing is asked at a time', () => {
    expect(ask({ progress: ready({ facts: [] }), flying: 2, seasonEndsAtMs: NOW + DAY })?.code).toBe('MIGRATION_NOT_READY');
    expect(ask({ flying: 2, seasonEndsAtMs: NOW + DAY })?.code).toBe('MIGRATION_FLEET_OUT');
  });
});

describe('three places to land', () => {
  const slot = (index: number, x: number, y = 0, z = 0): PlanetSlot => ({ index, x, y, z });
  // A crowd near the origin, and free addresses from inside the crowd to far outside it.
  const crowd = [slot(0, 0), slot(1, 100), slot(2, -100), slot(3, 0, 120), slot(4, 0, -120)];
  const free = [slot(10, 60, 60), slot(11, 850), slot(12, 1500), slot(13, 3000), slot(14, 3200)];
  const slots = [...crowd, ...free];
  const taken = new Set(crowd.map(row => row.index));

  it('offers the emptiest, a middle and the most crowded place, in that order', () => {
    const choices = landingChoices(slots, taken);
    expect(choices).toHaveLength(3);
    expect(choices[0]!.neighbours).toBe(0);
    expect(choices.at(-1)!.index).toBe(10);
    expect(choices.at(-1)!.neighbours).toBe(crowd.length);
    expect(choices[1]!.neighbours).toBeLessThanOrEqual(choices[2]!.neighbours);
  });

  it('never offers an address that is taken', () => {
    const indexes = landingChoices(slots, taken).map(choice => choice.index);
    for (const index of indexes) expect(taken.has(index)).toBe(false);
  });

  it('keeps the three apart, so the choice is a real one', () => {
    const [a, b, c] = landingChoices(slots, taken);
    const apart = (p: PlanetSlot, q: PlanetSlot) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
    expect(apart(a!, b!)).toBeGreaterThan(300);
    expect(apart(b!, c!)).toBeGreaterThan(300);
  });

  it('offers what there is when few places are left, and nothing when the galaxy is full', () => {
    expect(landingChoices([...crowd, slot(20, 400)], taken)).toHaveLength(1);
    expect(landingChoices(crowd, taken)).toEqual([]);
  });

  it('gives the same answer for the same galaxy', () => {
    expect(landingChoices(slots, taken)).toEqual(landingChoices(slots, taken));
  });

  // Owner playtest 2026-11-09: a thinly settled galaxy offered "between" with 0 neighbours, as "calm".
  it('puts the middle one between the two by neighbours, not at the middle of the list', () => {
    const sparse = [slot(30, 800), ...[3000, 3200, 3400, 3600, 3800, 4000].map((x, i) => slot(40 + i, x)), slot(10, 60, 60)];
    const [calm, between, crowded] = landingChoices([...crowd.slice(0, 4), ...sparse], new Set([0, 1, 2, 3]));
    expect(calm!.neighbours).toBe(0);
    expect(crowded!.neighbours).toBe(4);
    expect(between!.index).toBe(30);
    expect(between!.neighbours).toBe(2);
  });
});
