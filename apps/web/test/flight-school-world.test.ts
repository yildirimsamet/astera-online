import { describe, expect, it } from 'vitest';
import { asteroidPosition, sensorReach } from '@astera/rules';
import { createSchool, schoolAction, tickSchool, schoolScene, schoolPlanet, schoolGalaxy, schoolRock, SCHOOL_HOME, SCHOOL_TARGET } from '../src/onboarding/flightSchool/world.js';

describe('guided private training galaxy', () => {
  const now = 1_800_000_000_000;
  it('starts with eight persistent neighbours, withholding details outside sight', () => {
    const w = createSchool(now);
    const before = schoolGalaxy(w);
    expect(before.planets).toHaveLength(9);
    expect(before.planets.find(p => p.id === SCHOOL_HOME)?.isSelf).toBe(true);
    expect(before.planets.find(p => p.id === SCHOOL_TARGET)?.intel).toBe('UNKNOWN');
    const after = schoolGalaxy({ ...w, instruments: { ...w.instruments, TELESCOPE: 1 } });
    expect(after.planets.map(p => p.id)).toEqual(before.planets.map(p => p.id));
    expect(after.planets.find(p => p.id === SCHOOL_TARGET)?.intel).toBe('RESOLVED');
    expect(after.sensors?.[0]?.identify).toBe(sensorReach(1));
  });
  it('requires a completed paid order, then waits at its result for acknowledgement', () => {
    const w = { ...createSchool(now), scene: 'core' as const };
    expect(() => schoolAction(w, { kind: 'continue' }, now)).toThrow();
    const paid = schoolAction(w, { kind: 'order', subject: 'CORE', count: 1 }, now);
    expect(paid.resources.alloy).toBeLessThan(w.resources.alloy);
    expect(schoolPlanet(paid).buildings.CORE).toBe(1);
    expect(() => schoolAction(paid, { kind: 'order', subject: 'CORE', count: 1 }, now)).toThrow();
    expect(tickSchool(paid, now + 2999).buildings.CORE).toBe(1);
    const done = tickSchool(paid, now + 3000);
    expect(done.buildings.CORE).toBe(2);
    expect(done.scene).toBe('coreResult');
    expect(tickSchool(done, now + 100_000).scene).toBe('coreResult');
  });
  it('leaves storage room for the first collection instead of teaching a blocked action', () => {
    const p = schoolPlanet(createSchool(now)).planet;
    expect(p.alloyCap - p.alloy).toBeGreaterThanOrEqual(p.bufferAlloy);
    expect(p.crystalCap - p.crystal).toBeGreaterThanOrEqual(p.bufferCrystal);
  });
  it('refuses wrong orders, quantities and bypassing prerequisites without spending', () => {
    const w = { ...createSchool(now), scene: 'telescope' as const };
    expect(() => schoolAction(w, { kind: 'order', subject: 'TELESCOPE', count: 1 }, now)).toThrow();
    expect(() => schoolAction(w, { kind: 'order', subject: 'DART', count: -1 }, now)).toThrow();
    expect(w.instruments.TELESCOPE).toBe(0);
  });
  it('uses a moving asteroid and one consistent orbit for discovery and interception', () => {
    const w = createSchool(now);
    const rock = { ...schoolRock(w), index: 0 };
    const first = asteroidPosition(rock, 0);
    expect(asteroidPosition(rock, 1)).not.toEqual(first);
    expect(rock.speed).toBeGreaterThan(0);
  });
  it('takes 3 seconds for the entire 30-ship batch and enforces hangar capacity', () => {
    const w = { ...createSchool(now), resources: { alloy: 45000, crystal: 16000, deuterium: 600 }, scene: 'darts' as const, buildings: { ...createSchool(now).buildings, CORE: 2, SHIPYARD: 1, HANGAR: 2 } };
    const paid = schoolAction(w, { kind: 'order', subject: 'DART', count: 30 }, now);
    const done = tickSchool(paid, now + 3000);
    expect(done.fleet.DART).toBe(30);
    expect(done.pending).toBeNull();
  });
  it('keeps the next scene explicit instead of deriving progression from elapsed reading time', () => {
    const w = createSchool(now);
    expect(schoolScene(w).id).toBe('welcome');
    expect(tickSchool(w, now + 86_400_000).scene).toBe('welcome');
  });
  it('reveals a world only when the growing Telescope boundary actually reaches it', () => {
    const start = { ...createSchool(now), scene: 'telescope' as const, uplink: true };
    const done = tickSchool(schoolAction(start, { kind: 'order', subject: 'TELESCOPE', count: 1 }, now), now + 3000);
    expect(schoolGalaxy(done, now + 3000).planets.find(p => p.id === SCHOOL_TARGET)?.intel).toBe('UNKNOWN');
    expect(schoolGalaxy(done, now + 8000).planets.find(p => p.id === SCHOOL_TARGET)?.intel).toBe('RESOLVED');
  });
});

it('accrues real production into the pool while reading and caps it during a long pause', () => {
  const at = 1_800_000_000_000;
  const w = createSchool(at), p = schoolPlanet(w).planet;
  const later = tickSchool(w, at + 60_000);
  expect(later.buffer.alloy).toBeCloseTo(w.buffer.alloy + p.alloyPerHour / 60, 5);
  expect(later.buffer.crystal).toBeCloseTo(w.buffer.crystal + p.crystalPerHour / 60, 5);
  expect(tickSchool(w, at + 100 * 3_600_000).buffer.alloy).toBe(p.bufferAlloyCap);
  expect(tickSchool(later, at + 60_000).buffer).toEqual(later.buffer);
  expect(later.scene).toBe('welcome');
});

it('collects only available storage room and retains the rest in the pool', () => {
  const at = 1_800_000_000_000, start = createSchool(at), p = schoolPlanet(start).planet;
  const w = { ...start, scene: 'collect' as const, resources: { ...start.resources, alloy: p.alloyCap - 10 } };
  const after = schoolAction(w, { kind: 'collect' }, at);
  expect(after.resources.alloy).toBe(p.alloyCap);
  expect(after.buffer.alloy).toBe(w.buffer.alloy - 10);
});

it('uses a different camera request for every scene, including shield and defend', async () => {
  const { SCHOOL_SCENES, schoolFocusRequest } = await import('../src/onboarding/flightSchool/scenes.js');
  const requests = SCHOOL_SCENES.map(s => schoolFocusRequest(1000, s.id));
  expect(new Set(requests).size).toBe(SCHOOL_SCENES.length);
});

it('expands Radar coverage before the incoming warning appears', async () => {
  const { schoolPending } = await import('../src/onboarding/flightSchool/api.js');
  const at = 1_800_000_000_000;
  const w = { ...createSchool(at), scene: 'radar' as const, uplink: true, resources: { alloy: 10000, crystal: 10000, deuterium: 600 } };
  w.instruments.TELESCOPE = 1;
  const done = tickSchool(schoolAction(w, { kind: 'order', subject: 'RADAR', count: 1 }, at), at + 3000);
  expect(schoolGalaxy(done, at + 3000).sensors![0]!.detect).toBe(0);
  expect(schoolPending(done, at + 3000)).toHaveLength(0);
  expect(schoolGalaxy(done, at + 8000).sensors![0]!.detect).toBeGreaterThan(0);
  expect(schoolPending(done, at + 8000)).toHaveLength(1);
});
