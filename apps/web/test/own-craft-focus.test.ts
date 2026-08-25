import { describe, expect, it } from 'vitest';
import type { MiningRun, PendingThread } from '../src/api/schemas.js';
import { reconcileOwnCraft } from '../src/galaxy/ownCraft.js';

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
  asteroidIndex: 4,
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

  it('chooses the most recently dispatched craft when several arrive together', () => {
    const result = reconcileOwnCraft(new Set(), [thread()], [run()]);
    expect(result.focus).toEqual({ kind: 'run', id: 'run-1' });
  });
});
