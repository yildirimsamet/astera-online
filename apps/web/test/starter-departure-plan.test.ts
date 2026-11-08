import { REPAIR_LADDER, STARTER, deuteriumRate } from '@astera/rules';
import { describe, expect, it } from 'vitest';
import { departurePlan, jumpOutlook, type PlanShip } from '../src/starter/departurePlan.js';

/**
 * THE LAST STRETCH AS ONE PLAN (plan 2026-11-08 F7, moment 15): the hull, the thrust, the parts and
 * the fuel side by side, each with what it waits on and when it arrives, so the player sees which of
 * them is holding the jump. A queued engine is not a ready one.
 */
const NOW = Date.parse('2026-11-08T12:00:00Z');
const HOUR = 3_600_000;
const HULL = REPAIR_LADDER.find(s => s.module === 'DRIVE_HULL')!;
const PLANT2 = REPAIR_LADDER.find(s => s.module === 'DEUTERIUM_PLANT' && s.stage === 2)!;
/** Everything the hull asks for, so its own state is what a case changes. */
const GATE = { REFINERY: 4, EXTRACTOR: 3, SURVEY: 2, SHIPYARD: 1, HANGAR: 2, TELESCOPE: 1, RADAR: 1 };

const order = (subject: string, stage: number, readyInHours: number) => ({
  queue: 'CONSTRUCTION', subject, stage, readyAt: new Date(NOW + readyInHours * HOUR),
});
const ship = (over: Partial<PlanShip> = {}): PlanShip => ({
  modules: { ...GATE, DEUTERIUM_PLANT: 2 }, facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN'],
  parts: 0, fuel: 0, deuterium: 0, bufferDeuterium: 0, queue: [], ...over,
});

describe('the two engines', () => {
  it('reads an engine on the queue as queued, with its finish, never as ready', () => {
    const plan = departurePlan(ship({ queue: [order('DRIVE_HULL', 1, 3), order('DRIVE_THRUST', 1, 7)], parts: 3 }), NOW);
    expect(plan.hull).toEqual({ state: 'queued', readyAt: new Date(NOW + 3 * HOUR) });
    expect(plan.thrust).toEqual({ state: 'queued', readyAt: new Date(NOW + 7 * HOUR) });
    expect(plan.enginesAt).toEqual(new Date(NOW + 7 * HOUR));
  });

  it('reads a repaired engine as done', () => {
    const plan = departurePlan(ship({ modules: { ...GATE, DEUTERIUM_PLANT: 2, DRIVE_HULL: 1, DRIVE_THRUST: 1 }, parts: 3 }), NOW);
    expect(plan.hull.state).toBe('done');
    expect(plan.thrust.state).toBe('done');
    expect(plan.enginesAt).toEqual(new Date(NOW));
  });

  it('offers the hull once nothing stands in its way, with how long it takes', () => {
    expect(departurePlan(ship(), NOW).hull).toEqual({ state: 'open', minutes: HULL.minutes });
  });

  it('names what the hull still waits for, the queue counted as run', () => {
    const waiting = departurePlan(ship({ modules: { ...GATE, RADAR: 0, DEUTERIUM_PLANT: 2 } }), NOW).hull;
    expect(waiting).toEqual({ state: 'waiting', missing: [{ kind: 'MODULE', module: 'RADAR', stage: 1 }] });
    const queued = departurePlan(ship({ modules: { ...GATE, RADAR: 0, DEUTERIUM_PLANT: 2 }, queue: [order('RADAR', 1, 1)] }), NOW).hull;
    expect(queued.state).toBe('open');
  });

  it('holds the thrust to the parts, and gives no engine time while it waits', () => {
    const plan = departurePlan(ship({ modules: { ...GATE, DEUTERIUM_PLANT: 2, DRIVE_HULL: 1 }, parts: 1 }), NOW);
    expect(plan.thrust).toEqual({ state: 'waiting', missing: [{ kind: 'PARTS', count: STARTER.parts.needed }] });
    expect(plan.enginesAt).toBeNull();
  });
});

describe('the fuel', () => {
  it('counts the tank, the store and the works together', () => {
    const plan = departurePlan(ship({ fuel: 20, deuterium: 30, bufferDeuterium: 10.6 }), NOW);
    expect(plan.fuel.have).toBe(60);
    expect(plan.fuel.needed).toBe(STARTER.fuelForJump);
  });

  it('says when the second plant fills it if nothing is flown', () => {
    const plan = departurePlan(ship({ fuel: 20 }), NOW);
    const hours = 70 / deuteriumRate(2);
    expect(plan.fuel.perHour).toBeCloseTo(deuteriumRate(2), 6);
    expect(plan.fuel.readyAt!.getTime()).toBeCloseTo(NOW + hours * HOUR, -3);
  });

  it('is ready now when there is enough aboard', () => {
    expect(departurePlan(ship({ fuel: 50, deuterium: 45 }), NOW).fuel.readyAt).toEqual(new Date(NOW));
  });

  it('runs the first plant until a queued second one finishes, then the faster one', () => {
    const plan = departurePlan(ship({ modules: { ...GATE, DEUTERIUM_PLANT: 1 }, queue: [order('DEUTERIUM_PLANT', 2, 2)] }), NOW);
    const left = STARTER.fuelForJump - 2 * deuteriumRate(1);
    expect(plan.fuel.readyAt!.getTime()).toBeCloseTo(NOW + (2 + left / deuteriumRate(2)) * HOUR, -3);
    expect(plan.fuel.lever).toBeNull();
  });

  it('shows what the second plant would gain, while only the first one runs', () => {
    const plan = departurePlan(ship({ modules: { ...GATE, DEUTERIUM_PLANT: 1 } }), NOW);
    expect(plan.fuel.readyAt!.getTime()).toBeCloseTo(NOW + (STARTER.fuelForJump / deuteriumRate(1)) * HOUR, -3);
    const repair = PLANT2.minutes / 60;
    const after = STARTER.fuelForJump - repair * deuteriumRate(1);
    expect(plan.fuel.lever!.getTime()).toBeCloseTo(NOW + (repair + after / deuteriumRate(2)) * HOUR, -3);
  });

  it('has no time to give before any plant runs', () => {
    const plan = departurePlan(ship({ modules: { ...GATE } }), NOW);
    expect(plan.fuel.readyAt).toBeNull();
    expect(plan.fuel.perHour).toBe(0);
  });
});

describe('what holds the jump', () => {
  it('is the fuel when the engines are in first', () => {
    const plan = departurePlan(ship({ modules: { ...GATE, DEUTERIUM_PLANT: 2, DRIVE_HULL: 1, DRIVE_THRUST: 1 }, parts: 3 }), NOW);
    expect(plan.waitsOn).toBe('fuel');
  });

  it('is the engines when the fuel is in first', () => {
    const plan = departurePlan(ship({ fuel: 90, queue: [order('DRIVE_HULL', 1, 4), order('DRIVE_THRUST', 1, 8)], parts: 3 }), NOW);
    expect(plan.waitsOn).toBe('engines');
  });

  it('names nothing while either time is unknown', () => {
    expect(departurePlan(ship(), NOW).waitsOn).toBeNull();
  });
});

/**
 * A BLOCK SAID BEFORE THE TANK IS FULL (plan F7, moment 16). The season's last five days and a full
 * frontier used to show only once the ship was ready, which is the moment they cost the most.
 */
describe('what the calendar and the frontier will say', () => {
  const DAY = 24 * HOUR;
  const target = (daysToEnd: number) => ({ seasonEndsAt: new Date(NOW + daysToEnd * DAY) });

  it('says at once that no galaxy has room', () => {
    expect(jumpOutlook(null, null, NOW)).toEqual({ kind: 'noFrontier' });
  });

  it('says the ship will land in the next season once the last days have begun', () => {
    expect(jumpOutlook(target(3.5), null, NOW)).toEqual({ kind: 'seasonClosed', daysLeft: 4 });
  });

  it('warns when the plan finishes after this season stops taking ships', () => {
    const closesAt = new Date(NOW + (7 - STARTER.migrationCutoffDays) * DAY);
    expect(jumpOutlook(target(7), new Date(closesAt.getTime() + HOUR), NOW)).toEqual({ kind: 'seasonLate', closesAt });
  });

  it('says nothing when the plan lands inside this season', () => {
    expect(jumpOutlook(target(7), new Date(NOW + HOUR), NOW)).toBeNull();
    expect(jumpOutlook(target(30), null, NOW)).toBeNull();
  });
});
