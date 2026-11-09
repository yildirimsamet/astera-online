import { describe, expect, it } from 'vitest';
import { STARTER, canLoadFuel, departureBlock, fuelToLoad, landingChoices, openingProgress, type PlanetSlot, type VesselProgress } from '../src/index.js';

const ready = (over: Partial<VesselProgress> = {}): VesselProgress => ({ ...openingProgress(), fuel: STARTER.fuelForJump, ...over });
const NOW = Date.UTC(2026, 10, 5);
const DAY = 86_400_000;

describe('may this ship leave', () => {
  const ask = (over: Partial<Parameters<typeof departureBlock>[0]> = {}) =>
    departureBlock({ progress: ready(), flying: 0, seasonEndsAtMs: NOW + 30 * DAY, nowMs: NOW, ...over });

  it('leaves with a full tank, every fleet home, and time in the season', () => {
    expect(ask()).toBeNull();
  });

  it('wants the tank full first: that is the one thing the drive asks for', () => {
    expect(ask({ progress: ready({ fuel: STARTER.fuelForJump - 1 }) })).toEqual({ code: 'MIGRATION_NOT_READY' });
  });

  it('waits for what is in the air', () => {
    expect(ask({ flying: 1 })).toEqual({ code: 'MIGRATION_FLEET_OUT', flying: 1 });
  });

  it('waits out the last five days of a season and says how many remain', () => {
    expect(ask({ seasonEndsAtMs: NOW + 3.2 * DAY })).toEqual({ code: 'MIGRATION_SEASON_WAIT', daysLeft: 4 });
    expect(ask({ seasonEndsAtMs: NOW + STARTER.migrationCutoffDays * DAY })).toBeNull();
    expect(ask({ seasonEndsAtMs: NOW + STARTER.migrationCutoffDays * DAY - 1 })).toEqual({ code: 'MIGRATION_SEASON_WAIT', daysLeft: 5 });
  });

  it('names the tank before the fleet before the season, so one thing is asked at a time', () => {
    expect(ask({ progress: ready({ fuel: 0 }), flying: 2, seasonEndsAtMs: NOW + DAY })?.code).toBe('MIGRATION_NOT_READY');
    expect(ask({ flying: 2, seasonEndsAtMs: NOW + DAY })?.code).toBe('MIGRATION_FLEET_OUT');
  });
});

describe('loading the tank', () => {
  const thrust = (over: Partial<VesselProgress> = {}): VesselProgress => ({
    ...openingProgress(), modules: { REFINERY: 1, DRIVE_THRUST: 1, DEUTERIUM_PLANT: 2 }, ...over,
  });

  it('opens with the thrust assembly and the second plant', () => {
    expect(canLoadFuel(thrust())).toBe(true);
    expect(canLoadFuel(openingProgress())).toBe(false);
  });

  it('moves what you ask, up to what you hold and what the tank has room for', () => {
    expect(fuelToLoad(thrust({ fuel: 0 }), 500, 30)).toBe(30);
    expect(fuelToLoad(thrust({ fuel: 0 }), 12.7, 30)).toBe(12);
    expect(fuelToLoad(thrust({ fuel: STARTER.fuelForJump - 5 }), 500, 30)).toBe(5);
  });

  it('moves nothing for a ship that cannot load, a full tank or a nonsense amount', () => {
    expect(fuelToLoad(openingProgress(), 500, 30)).toBe(0);
    expect(fuelToLoad(thrust({ fuel: STARTER.fuelForJump }), 500, 30)).toBe(0);
    expect(fuelToLoad(thrust(), 500, -3)).toBe(0);
    expect(fuelToLoad(thrust(), 500, Number.NaN)).toBe(0);
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
