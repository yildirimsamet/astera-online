import { afterEach, describe, expect, it } from 'vitest';
import { trafficSchema, type IntelView } from '../src/api/schemas.js';
import {
  craftProgress, freshShots, roundLandsAt, readShotSeen, rememberShotSeen, roundProgress, SHOT_ENDS, SHOT_IMPACT, SHOT_ROUNDS, SHOT_SEEN_KEY,
  SHOT_WINDOW_MINUTES, shotFrame, shotStartSecond, shotsOf,
} from '../src/galaxy/probeShots.js';
import { PROBE_DEFENCE } from '@astera/rules';

/*
  A PROBE SHOT DOWN, IN THE GALAXY (2026-11-24, plan §4 VFX brief). The probe reaches orbit, the
  world's battery fires a short burst of rounds up at it, the craft breaks into fragments and its
  engine goes out. It plays once per shot, for the sender (their probe lost) and for the holder
  (their battery firing), and a shot from while they were away plays on the next open, within a
  window. The client reads what `/api/intel` already lists; nothing on the server changes.
*/

const NOW = new Date('2026-11-24T12:00:00.000Z').getTime();
const MIN = 60_000;

const intel = (over: Partial<IntelView> = {}): IntelView => ({
  watching: [], probeReports: [], probeCooldowns: [], probeLosses: [], radarLog: [],
  probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
  ...over,
});
const scan = (planetId: string | undefined, at: number, shotDown: boolean): IntelView['radarLog'][number] => ({
  at: new Date(at), bearing: null, originPlanetName: null, shotDown,
  ...(planetId === undefined ? {} : { planetId, planetName: 'Home' }),
});
const P = { x: 10, y: 0, z: -4 };
const F = { x: 40, y: 0, z: -16 };
const LEAD = PROBE_DEFENCE.fireLeadSeconds * 1000;
const loss = (missionId: string, targetPlanetId: string, at: number): NonNullable<IntelView['probeLosses']>[number] => ({
  missionId, targetPlanetId, targetName: 'Orrery-8', targetUsername: 'Sable', at: new Date(at), point: P,
  firedAt: new Date(at - LEAD), from: F,
});
const fired = (id: string, planetId: string, at: number): NonNullable<IntelView['probeShotsFired']>[number] => ({
  id, planetId, at: new Date(at), point: P, firedAt: new Date(at - LEAD), from: F,
});

describe('which shots there are', () => {
  it('reads the sender\'s losses and the holder\'s own shots, oldest first, each where it happened', () => {
    const shots = shotsOf(intel({
      probeLosses: [loss('m2', 'them', NOW - 2 * MIN), loss('m1', 'them', NOW - 5 * MIN)],
      probeShotsFired: [fired('s1', 'mine', NOW - 3 * MIN)],
    }));
    expect(shots.map((shot) => [shot.planetId, shot.own])).toEqual([['them', false], ['mine', true], ['them', false]]);
    expect(new Set(shots.map((shot) => shot.id)).size).toBe(3);
    expect(shots.every((shot) => shot.point === P)).toBe(true);
    // And where the craft was when the battery opened fire, so the rounds climb to it.
    expect(shots.every((shot) => shot.from === F && shot.firedAt === shot.at - LEAD)).toBe(true);
  });

  it('plays nothing from the radar log: that row has no point on the approach', () => {
    expect(shotsOf(intel({ radarLog: [scan('mine', NOW, true)] }))).toEqual([]);
  });

  it('keeps a loss from an older server, which has no point, with none', () => {
    const { point: _point, firedAt: _firedAt, from: _from, ...old } = loss('m1', 'them', NOW);
    const [shot] = shotsOf(intel({ probeLosses: [old] }));
    expect(shot?.point).toBeNull();
    expect(shot?.from).toBeNull();
    expect(shot?.firedAt).toBeNull();
  });

  it('is empty before intel has loaded', () => {
    expect(shotsOf(undefined)).toEqual([]);
  });

  it('adds what a Telescope witnessed over someone else\'s world (plan §3.5)', () => {
    const traffic = trafficSchema.parse({ contacts: [], probeShots: [{ id: 'w1', planetId: 'far', at: new Date(NOW - MIN).toISOString() }] });
    const shots = shotsOf(intel({ probeLosses: [loss('m1', 'them', NOW - 2 * MIN)] }), traffic);
    expect(shots.map((shot) => [shot.id, shot.planetId, shot.own, shot.witness])).toEqual([
      ['lost:m1', 'them', false, false], ['seen:w1', 'far', false, true],
    ]);
    // A bystander is not told the bearing the probe came from: the moment plays over the world.
    expect(shots[1]?.point).toBeNull();
    expect(shots[1]?.from).toBeNull();
  });

  it('reads a traffic answer from a server that sends no shots', () => {
    expect(trafficSchema.parse({ contacts: [] }).probeShots).toBeUndefined();
    expect(shotsOf(intel(), trafficSchema.parse({ contacts: [] }))).toEqual([]);
  });
});

describe('which shots play', () => {
  const shots = shotsOf(intel({ probeLosses: [loss('m1', 'them', NOW - 2 * MIN), loss('m0', 'them', NOW - (SHOT_WINDOW_MINUTES + 1) * MIN)] }));

  it('a first look on this device plays nothing', () => {
    expect(freshShots(shots, null, NOW)).toEqual([]);
  });

  it('plays a shot never shown, inside the window', () => {
    expect(freshShots(shots, new Set(), NOW).map((shot) => shot.id)).toEqual([shots.find((shot) => shot.at === NOW - 2 * MIN)!.id]);
  });

  it('never plays a shot twice', () => {
    expect(freshShots(shots, new Set(shots.map((shot) => shot.id)), NOW)).toEqual([]);
  });
});

/*
  THE ROUNDS REACH THE CRAFT (owner playtest 2, 2026-11-25: "ateş başlar başlamaz sonda yok oluyor.
  Ateşin sondaya ulaşması, vurulması lazım"). The timeline starts when the battery opens fire; the
  craft keeps flying from where it was then to the point and the last round meets it there
  (handbook GF-02: travel, then impact; MP-07: the round trip hides inside the burst).
*/
describe('the moment follows the server\'s clock', () => {
  const shot = { firedAt: NOW, at: NOW + LEAD };

  it('opens on the second this screen hears of it, so the craft it draws is where its flight was', () => {
    expect(SHOT_IMPACT).toBe(PROBE_DEFENCE.fireLeadSeconds);
    expect(shotStartSecond(shot, NOW + 700)).toBeCloseTo(0.7, 6);
    expect(shotStartSecond(shot, NOW - 300)).toBe(0);
  });

  it('a screen that hears late still sees the last rounds reach the craft', () => {
    const late = shotStartSecond(shot, NOW + 60_000);
    expect(late).toBeLessThanOrEqual(SHOT_IMPACT - 1);
    expect(late).toBeGreaterThan(0);
    // Rounds are still climbing at that second.
    expect(Array.from({ length: SHOT_ROUNDS }, (_, i) => roundProgress(i, late + 0.2)).some((k) => k !== null)).toBe(true);
  });

  it('plays a witness, who has no clock for the fire, from the start', () => {
    expect(shotStartSecond({ firedAt: null }, NOW + 5_000)).toBe(0);
  });

  it('flies the craft from where it was to the point, arriving with the last round', () => {
    expect(craftProgress(0)).toBe(0);
    expect(craftProgress(SHOT_IMPACT / 2)).toBeCloseTo(0.5, 6);
    expect(craftProgress(SHOT_IMPACT)).toBe(1);
    expect(craftProgress(SHOT_IMPACT + 1)).toBe(1);
  });

  it('is a short burst of four rounds, not a stream (owner, 2026-11-25: "ateş sayısı biraz fazla")', () => {
    expect(SHOT_ROUNDS).toBe(4);
  });

  it('gives every round a visible climb, not a flicker', () => {
    const climb = Array.from({ length: 200 }, (_, n) => n * 0.01).filter((t) => roundProgress(0, t) !== null);
    expect(climb.length * 0.01).toBeGreaterThanOrEqual(0.35);
  });
});

describe('the moment, second by second', () => {
  it('shows the craft until the rounds reach it, then never again', () => {
    expect(shotFrame(0).craft).toBe(1);
    expect(shotFrame(SHOT_IMPACT - 0.01).craft).toBe(1);
    expect(shotFrame(SHOT_IMPACT + 0.01).craft).toBe(0);
  });

  it('breaks it up only at the impact, and is done by its end', () => {
    expect(shotFrame(SHOT_IMPACT - 0.01).burst).toBe(0);
    expect(shotFrame(SHOT_IMPACT + 0.1).burst).toBeGreaterThan(0);
    const done = shotFrame(SHOT_ENDS + 0.01);
    expect(done.burst + done.debris + done.smoke + done.craft).toBe(0);
  });

  it('fires the rounds in turn, the last of them reaching the craft at the impact', () => {
    // A beat between opening fire and the first round, then the rounds in turn.
    expect(roundProgress(0, 0)).toBeNull();
    expect(roundProgress(SHOT_ROUNDS - 1, SHOT_IMPACT)).toBeCloseTo(1, 5);
    expect(roundProgress(1, 0.3)).toBeNull();
    // Each round is aimed where the craft will be when it lands; the last lands at the impact.
    expect(roundLandsAt(SHOT_ROUNDS - 1)).toBeCloseTo(SHOT_IMPACT, 9);
    expect(roundProgress(0, roundLandsAt(0))).toBeCloseTo(1, 9);
    expect(roundProgress(0, SHOT_IMPACT + 0.5)).toBeNull();
  });

  it('is quiet for a broken clock', () => {
    expect(shotFrame(Number.NaN)).toEqual(shotFrame(-1));
    expect(shotFrame(-1).craft).toBe(0);
  });
});

describe('what this device has shown', () => {
  afterEach(() => { localStorage.clear(); });

  it('keeps one record per commander, so two commanders on one browser do not wipe each other', () => {
    expect(readShotSeen('me')).toBeNull();
    rememberShotSeen('me', ['a', 'b']);
    rememberShotSeen('someone-else', ['c']);
    expect(readShotSeen('me')).toEqual(new Set(['a', 'b']));
    expect(readShotSeen('someone-else')).toEqual(new Set(['c']));
    expect(JSON.parse(localStorage.getItem(`${SHOT_SEEN_KEY}:me`)!)).toEqual(['a', 'b']);
  });

  it('reads a damaged record as a first look', () => {
    localStorage.setItem(`${SHOT_SEEN_KEY}:me`, '{nope');
    expect(readShotSeen('me')).toBeNull();
  });
});
