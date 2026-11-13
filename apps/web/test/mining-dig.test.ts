import { describe, expect, it } from 'vitest';
import type { MiningRun } from '../src/api/schemas.js';
import { DIG_SECONDS, DIG_TAIL_SECONDS, digFrame, digHoldMs, forgetReach, heldReach, runDig, runLaden, settleRoll } from '../src/galaxy/miningDig.js';
import { runPosition, toWorld, type Vec3Tuple } from '../src/galaxy/scene.js';

/*
  THE DIG AT A PROSPECTOR'S ROCK (owner approved the lab dig, 2026-11-12: "Güzel olmuş"). Today the run
  turns home the moment it arrives and nothing is drawn between. The drill now stops on the rock's near
  face, bites for two seconds with sparks and a glowing cut, and — when the server says the hold is full —
  backs off with it lit. The rules and the times stay exactly as they are.
*/

const DEPART = new Date('2026-04-01T12:00:00.000Z');
const ARRIVE = new Date('2026-04-01T12:20:00.000Z');
const HOME_AT = new Date('2026-04-01T13:20:00.000Z');
const home = { x: 0, y: 0, z: 0 };
const run = (over: Partial<MiningRun> = {}): MiningRun => ({
  id: 'r1', planetId: 'colony-b', targetKind: 'asteroid', asteroidId: 'mJt7YvxMZEC5S7yYQ32SYw', debrisFieldId: null,
  craft: 2, status: 'outbound', departAt: DEPART, arriveAt: ARRIVE, recalledAt: null, homeAt: HOME_AT,
  intercept: { x: 0, y: 0, z: 600 }, minedAlloy: 0, minedCrystal: 0, minedDeuterium: 0, ...over,
});
const laden = (over: Partial<MiningRun> = {}) => run({ status: 'returning', minedAlloy: 120, minedCrystal: 30, ...over });
const rock = toWorld({ x: 0, y: 0, z: 600 });
const gap = (p: Vec3Tuple, q: Vec3Tuple = rock) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const near = (p: Vec3Tuple, q: Vec3Tuple) => { p.forEach((v, i) => { expect(v).toBeCloseTo(q[i]!, 9); }); };
const at = (ms: number) => ARRIVE.getTime() + ms;
const REACH = 1.2;

describe('the dig timeline', () => {
  it('bites at once: sparks and the glowing cut belong to the bite alone', () => {
    expect(digFrame(0).sparks).toBe(0);
    expect(digFrame(DIG_SECONDS / 2).sparks).toBeGreaterThan(0.8);
    expect(digFrame(DIG_SECONDS / 2).heat).toBeGreaterThan(0.6);
    expect(digFrame(DIG_SECONDS + 0.05).sparks).toBe(0);
    expect(digFrame(DIG_SECONDS + 0.6).heat).toBeLessThan(0.2);
    expect(digFrame(DIG_SECONDS + DIG_TAIL_SECONDS).heat).toBe(0);
  });

  it('dims the lit hold as the drill eases away, so it never blinks out', () => {
    expect(digFrame(DIG_SECONDS + 0.2).cargo).toBeGreaterThan(0.95);
    expect(digFrame(DIG_SECONDS + DIG_TAIL_SECONDS - 0.25).cargo).toBeLessThan(0.6);
    expect(digFrame(DIG_SECONDS + DIG_TAIL_SECONDS).cargo).toBeCloseTo(0, 9);
  });

  it('brings the drill’s turn to rest on a whole turn', () => {
    let roll = 7.9;
    for (let i = 0; i < 48; i++) roll = settleRoll(roll, 1 / 60);
    expect(Math.abs(roll - Math.PI * 2)).toBeLessThan(0.02);
    expect(settleRoll(Math.PI * 4, 1 / 60)).toBeCloseTo(Math.PI * 4, 12);
    expect(settleRoll(1, Number.NaN)).toBe(1);
  });

  it('fills the hold during the bite and keeps it full', () => {
    expect(digFrame(0).cargo).toBe(0);
    expect(digFrame(DIG_SECONDS / 2).cargo).toBeGreaterThan(0);
    expect(digFrame(DIG_SECONDS).cargo).toBe(1);
  });

  it('turns the drill while it bites and lets it run down after', () => {
    expect(digFrame(0.5).spin).toBeGreaterThan(0.9);
    expect(digFrame(DIG_SECONDS + 0.4).spin).toBe(0);
  });

  it('draws nothing burning on a bad clock', () => {
    for (const t of [Number.NaN, Number.NEGATIVE_INFINITY, -2, Number.POSITIVE_INFINITY]) {
      const frame = digFrame(t);
      expect(Object.values(frame).every(Number.isFinite)).toBe(true);
      expect(frame.sparks + frame.heat + frame.spin + frame.cargo).toBe(0);
    }
  });
});

describe('which runs dig, and when', () => {
  it('digs from the instant of arrival, before the server has answered', () => {
    expect(runDig(run(), at(-1))).toBeNull();
    expect(runDig(run(), at(0))).toBe(0);
    expect(runDig(run(), at(1500))).toBeCloseTo(1.5, 9);
  });

  it('keeps digging once the answer is a full hold', () => {
    expect(runLaden(laden())).toBe(true);
    expect(runDig(laden(), at(1500))).toBeCloseTo(1.5, 9);
  });

  it('stops when the answer is an empty hold: there was nothing left to cut', () => {
    const empty = run({ status: 'returning' });
    expect(runLaden(empty)).toBe(false);
    expect(runDig(empty, at(1500))).toBeNull();
  });

  it('never digs for a recalled run: it turned round in open space', () => {
    const recalled = run({ status: 'returning', recalledAt: new Date(at(-60_000)), arriveAt: new Date(at(-60_000)) });
    expect(runLaden(recalled)).toBe(false);
    expect(runDig(recalled, at(-59_000))).toBeNull();
  });

  it('is over once the cut has cooled, and never for a landed run or a bad clock', () => {
    expect(runDig(laden(), at((DIG_SECONDS + DIG_TAIL_SECONDS) * 1000 + 100))).toBeNull();
    expect(runDig(laden({ status: 'done' }), at(500))).toBeNull();
    expect(runDig(run(), Number.NaN)).toBeNull();
  });

  it('holds a full drill at the rock for the bite, and never longer than half the trip home', () => {
    expect(digHoldMs(laden())).toBe(DIG_SECONDS * 1000);
    expect(digHoldMs(run({ status: 'returning' }))).toBe(0);
    expect(digHoldMs(run())).toBe(0);
    expect(digHoldMs(laden({ homeAt: new Date(at(1000)) }))).toBe(500);
    expect(digHoldMs(laden({ homeAt: null }))).toBe(0);
  });
});

describe('where the drill works: on the rock’s near face, not inside it', () => {
  it('leaves exactly where it always did and stops `reach` short of the meeting point, on its own side', () => {
    near(runPosition(run(), home, DEPART.getTime(), [], REACH), runPosition(run(), home, DEPART.getTime()));
    const there = runPosition(run(), home, ARRIVE.getTime(), [], REACH);
    expect(gap(there)).toBeCloseTo(REACH, 9);
    expect(gap(there, toWorld(home))).toBeLessThan(gap(rock, toWorld(home)));
    // Still unanswered after arrival: it waits on the face rather than sliding in.
    near(runPosition(run(), home, at(1500), [], REACH), there);
  });

  it('slows into the face and never backs away from it on the way in', () => {
    const leg = ARRIVE.getTime() - DEPART.getTime();
    const where = (ms: number) => runPosition(run(), home, DEPART.getTime() + ms, [], REACH);
    const cruise = gap(where(leg / 2 - 100), where(leg / 2 + 100));
    const last = gap(where(leg - 200), where(leg));
    expect(last).toBeLessThan(cruise * 0.1);
    let before = Infinity;
    for (let i = 0; i <= 200; i++) {
      const now = gap(where((leg * i) / 200));
      expect(now).toBeLessThanOrEqual(before + 1e-12);
      before = now;
    }
  });

  it('never starts behind its own world on a short leg', () => {
    near(runPosition(run(), home, DEPART.getTime(), [], 50), toWorld(home));
    expect(gap(runPosition(run(), home, ARRIVE.getTime(), [], 50))).toBeCloseTo(gap(rock, toWorld(home)) / 2, 9);
  });

  it('a full drill holds on the face for the bite, then eases away and still lands on time', () => {
    const face = runPosition(run(), home, ARRIVE.getTime(), [], REACH);
    near(runPosition(laden(), home, at(0), [], REACH), face);
    near(runPosition(laden(), home, at(DIG_SECONDS * 1000 - 100), [], REACH), face);
    expect(gap(runPosition(laden(), home, at(DIG_SECONDS * 1000 + 30_000), [], REACH))).toBeGreaterThan(REACH);
    near(runPosition(laden(), home, HOME_AT.getTime(), [], REACH), runPosition(laden(), home, HOME_AT.getTime()));
  });

  it('an empty drill does not linger', () => {
    const empty = run({ status: 'returning' });
    const later = at(60_000);
    expect(gap(runPosition(empty, home, later, [], REACH))).toBeGreaterThan(gap(runPosition(laden(), home, later, [], REACH)));
    near(runPosition(empty, home, ARRIVE.getTime(), [], REACH), runPosition(run(), home, ARRIVE.getTime(), [], REACH));
  });

  it('draws a recalled run exactly where the server turned it', () => {
    const turn = { x: 0, y: 0, z: 300 };
    const recalled = run({ status: 'returning', recalledAt: new Date(at(-60_000)), arriveAt: new Date(at(-60_000)), intercept: turn });
    for (const ms of [-60_000, -59_000, -30_000, 0]) {
      expect(runPosition(recalled, home, at(ms), [], REACH)).toEqual(runPosition(recalled, home, at(ms)));
    }
  });

  it('keeps the old path exactly when there is no rock to stand off', () => {
    for (const ms of [-600_000, -1, 0, 1500, 60_000]) {
      expect(runPosition(run(), home, at(ms), [], 0)).toEqual(runPosition(run(), home, at(ms)));
    }
  });
});

describe('the rock keeps flying its orbit while the drill works it', () => {
  // A rock drifting along +x at 0.1 world units a second, on the meeting point at arrival.
  const rockAt = (ms: number): Vec3Tuple => [rock[0] + (ms - ARRIVE.getTime()) / 10_000, rock[1], rock[2]];
  const moved = (p: Vec3Tuple, dx: number): Vec3Tuple => [p[0] + dx, p[1], p[2]];

  it('rides with the rock while it waits for the answer and through the bite', () => {
    const face = runPosition(run(), home, ARRIVE.getTime(), [], REACH, rockAt);
    near(face, runPosition(run(), home, ARRIVE.getTime(), [], REACH));
    near(runPosition(run(), home, at(1500), [], REACH, rockAt), moved(face, 0.15));
    near(runPosition(laden(), home, at(1000), [], REACH, rockAt), moved(face, 0.1));
  });

  it('lets go of it on the way home without a jump, and still lands on time', () => {
    const end = at(DIG_SECONDS * 1000);
    expect(gap(runPosition(laden(), home, end - 1, [], REACH, rockAt), runPosition(laden(), home, end + 1, [], REACH, rockAt))).toBeLessThan(0.001);
    near(runPosition(laden(), home, HOME_AT.getTime(), [], REACH, rockAt), runPosition(laden(), home, HOME_AT.getTime()));
  });

  it('flies a run turned round in open space (its rock ran dry first) exactly as the server stored it', () => {
    const turned = run({ status: 'returning', arriveAt: new Date(at(-60_000)), intercept: { x: 0, y: 0, z: 300 }, homeAt: new Date(at(600_000)) });
    for (const ms of [-60_000, -59_000, 0, 30_000]) {
      expect(runPosition(turned, home, at(ms), [], REACH, rockAt)).toEqual(runPosition(turned, home, at(ms)));
    }
  });
});

describe('a target that leaves the map while a drill is on it', () => {
  it('keeps the last stand-off it saw, so the drill never drops into the target’s centre', () => {
    forgetReach(new Set());
    expect(heldReach('r1', 0)).toBe(0);
    expect(heldReach('r1', 0.8)).toBe(0.8);
    expect(heldReach('r1', 0)).toBe(0.8);
    expect(heldReach('r1', 0.9)).toBe(0.9);
    expect(heldReach('r2', 0)).toBe(0);
  });

  it('forgets a run once it is no longer flying', () => {
    forgetReach(new Set());
    heldReach('r1', 0.8);
    heldReach('r2', 0.5);
    forgetReach(new Set(['r2']));
    expect(heldReach('r1', 0)).toBe(0);
    expect(heldReach('r2', 0)).toBe(0.5);
  });
});
