import { describe, expect, it } from 'vitest';
import type {
  MiningRun,
  PendingThread,
  StrategicInterception,
  StrategicInterceptionImpact,
} from '../src/api/schemas.js';
import {
  reconcileOwnCraft,
  reconcileOwnInterceptionImpacts,
  reconcileOwnInterceptions,
} from '../src/galaxy/ownCraft.js';

const thread = (over: Partial<PendingThread> = {}): PendingThread => ({
  id: 'mission-1',
  kind: 'fleet',
  targetName: 'Tharsis',
  minutesRemaining: 4,
  arriveAt: new Date('2026-08-25T12:05:00.000Z'),
  leg: 'outbound',
  path: {
    from: { x: 0, y: 0, z: 0 },
    to: { x: 5, y: 0, z: 5 },
    departAt: new Date('2026-08-25T12:00:00.000Z'),
    arriveAt: new Date('2026-08-25T12:05:00.000Z'),
  },
  ...over,
});

const run = (over: Partial<MiningRun> = {}): MiningRun => ({
  id: 'run-1',
  targetKind: 'asteroid',
  asteroidId: 'mJt7YvxMZEC5S7yYQ32SYw',
  debrisFieldId: null,
  status: 'outbound',
  craft: 1,
  departAt: new Date('2026-08-25T12:01:00.000Z'),
  arriveAt: new Date('2026-08-25T12:06:00.000Z'),
  homeAt: null,
  intercept: { x: 3, y: 0, z: 4 },
  minedAlloy: 0,
  minedCrystal: 0,
  minedDeuterium: 0,
  ...over,
});

const interception = (
  over: Partial<StrategicInterception> = {},
): StrategicInterception => ({
  id: 'interception-1',
  targetPlanetId: 'colony-2',
  trigger: 'RADAR',
  launchAt: new Date('2026-08-25T12:02:00.000Z'),
  impactAt: new Date('2026-08-25T12:02:04.000Z'),
  launch: { x: 0, y: 0, z: 0 },
  deathStarFrom: { x: -4, y: 0, z: 0 },
  collision: { x: 4, y: 0, z: 0 },
  ...over,
});

const interceptionImpact = (
  over: Partial<StrategicInterceptionImpact> = {},
): StrategicInterceptionImpact => ({
  id: 'interception-1',
  at: new Date('2026-08-25T12:02:04.000Z'),
  collision: { x: 4, y: 0, z: 0 },
  effectOnly: false,
  focusEligible: true,
  ...over,
});

describe('automatic focus for newly launched craft', () => {
  it('baselines an initial payload without hijacking the camera', () => {
    const result = reconcileOwnCraft(null, [thread()], [run()]);
    expect(result.focus).toBeNull();
    expect(result.seen.size).toBe(2);
  });

  it.each(['fleet', 'probe', 'death_star', 'settlement', 'transfer'] as const)(
    'focuses a new %s through the same path-based rule',
    (kind) => {
      const result = reconcileOwnCraft(new Set(), [thread({ kind })], []);
      expect(result.focus).toEqual({ kind: 'thread', key: 'mission-1' });
    },
  );

  it('focuses a new mining or salvage run without vehicle-specific wiring', () => {
    const result = reconcileOwnCraft(new Set(), [], [run({ targetKind: 'debris' })]);
    expect(result.focus).toEqual({ kind: 'run', id: 'run-1' });
  });

  it('ignores anonymous inbound warnings and completed runs', () => {
    const inbound = thread({ id: undefined, kind: 'incoming', path: undefined });
    const result = reconcileOwnCraft(new Set(), [inbound], [run({ status: 'done' })]);
    expect(result.focus).toBeNull();
    expect(result.seen.size).toBe(0);
  });

  it('never focuses the same mission again after a stale disappearance or return leg', () => {
    const first = reconcileOwnCraft(new Set(), [thread()], []);
    const missing = reconcileOwnCraft(first.seen, [], []);
    const returned = reconcileOwnCraft(missing.seen, [thread({ leg: 'return' })], []);
    expect(first.focus).toEqual({ kind: 'thread', key: 'mission-1' });
    expect(missing.focus).toBeNull();
    expect(returned.focus).toBeNull();
  });

  /**
   * A RETURN LEG IS NOT A LAUNCH, AND IT ARRIVES WITH A NEW MISSION ID. Owner report.
   *
   * The server does not flip a mission round: it closes the outbound row and inserts
   * a fresh one for the trip home, linked by `parentMissionId` — `handleMissionArrival`
   * does it for a raid, and the probe's homeward leg does it too. So the identity the
   * camera de-duplicates on is brand new, and every craft in the game seized the
   * screen a second time on its way back: mid-menu, mid-inspection, once per craft,
   * for as long as the commander had anything in the air.
   *
   * THE PAYLOAD ALREADY KNEW. Every own thread carries `leg`, so the rule is stated
   * where the decision is made rather than repaired downstream: follow a craft out,
   * never home. The row is still BASELINED — it goes into `seen` — because the point
   * is that nothing about a return may ever move the camera, not that it moves it
   * later.
   */
  it('does not follow a return leg home, even under a new mission id', () => {
    const out = reconcileOwnCraft(new Set(), [thread()], []);
    const back = reconcileOwnCraft(out.seen, [thread({ id: 'mission-2', leg: 'return' })], []);

    expect(out.focus).toEqual({ kind: 'thread', key: 'mission-1' });
    expect(back.focus).toBeNull();
    expect(back.seen.has('thread:mission-2')).toBe(true);
  });

  /** And a drill turning for home is the same rule, off its own status. */
  it('does not follow a mining or salvage run home', () => {
    const back = reconcileOwnCraft(
      new Set(),
      [],
      [run({ id: 'run-2', status: 'returning' })],
    );

    expect(back.focus).toBeNull();
    expect(back.seen.has('run:run-2')).toBe(true);
  });

  /** A craft that really did just leave still wins, even beside a returning one. */
  it('still follows a launch that departs while something else is coming home', () => {
    const result = reconcileOwnCraft(
      new Set(),
      [
        thread({ id: 'homeward', leg: 'return', path: {
          from: { x: 5, y: 0, z: 5 },
          to: { x: 0, y: 0, z: 0 },
          departAt: new Date('2026-08-25T12:04:00.000Z'),
          arriveAt: new Date('2026-08-25T12:09:00.000Z'),
        } }),
        thread({ id: 'outward' }),
      ],
      [],
    );

    expect(result.focus).toEqual({ kind: 'thread', key: 'outward' });
  });

  it('chooses the most recently dispatched craft when several arrive together', () => {
    const result = reconcileOwnCraft(new Set(), [thread()], [run()]);
    expect(result.focus).toEqual({ kind: 'run', id: 'run-1' });
  });

  it('focuses a newly launched interceptor from any controlled world', () => {
    const result = reconcileOwnInterceptions(
      new Set(),
      [interception()],
      new Set(['capital-1', 'colony-2']),
      new Date('2026-08-25T12:02:01.000Z').getTime(),
    );

    expect(result.focus).toEqual({ kind: 'interception', id: 'interception-1' });
  });

  it('does not focus another commander’s interceptor that destroys my Death Star', () => {
    const result = reconcileOwnInterceptions(
      new Set(),
      [interception({ targetPlanetId: 'enemy-world' })],
      new Set(['capital-1', 'colony-2']),
      new Date('2026-08-25T12:02:01.000Z').getTime(),
    );

    expect(result.focus).toBeNull();
  });

  it('does not hijack the camera for an interception learned after its flight ended', () => {
    const result = reconcileOwnInterceptions(
      new Set(),
      [interception()],
      new Set(['capital-1', 'colony-2']),
      new Date('2026-08-25T12:02:05.000Z').getTime(),
    );

    expect(result.focus).toBeNull();
  });

  it('baselines an already-running interception and never refocuses it', () => {
    const initial = reconcileOwnInterceptions(
      null,
      [interception()],
      new Set(['capital-1', 'colony-2']),
      new Date('2026-08-25T12:02:01.000Z').getTime(),
    );
    const repeated = reconcileOwnInterceptions(
      initial.seen,
      [interception()],
      new Set(['capital-1', 'colony-2']),
      new Date('2026-08-25T12:02:02.000Z').getTime(),
    );

    expect(initial.focus).toBeNull();
    expect(repeated.focus).toBeNull();
  });

  it('focuses the defender on the collision if the eight-second launch was missed', () => {
    const result = reconcileOwnInterceptionImpacts(
      new Set(),
      [interceptionImpact()],
    );

    expect(result.focus).toEqual({ kind: 'interceptionImpact', id: 'interception-1' });
  });

  it('uses a distinct collision focus even after launch follow, without moving attackers or witnesses', () => {
    const alreadyFollowed = reconcileOwnInterceptionImpacts(
      new Set(),
      [interceptionImpact()],
    );
    const attacker = reconcileOwnInterceptionImpacts(
      new Set(),
      [interceptionImpact({ focusEligible: false })],
    );

    expect(alreadyFollowed.focus).toEqual({
      kind: 'interceptionImpact',
      id: 'interception-1',
    });
    expect(attacker.focus).toBeNull();
  });
});
