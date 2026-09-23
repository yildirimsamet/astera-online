import { describe, expect, it } from 'vitest';
import type {
  ActiveGalaxyEvent,
  BuildOrderView,
  MiningRun,
  PendingThread,
  ResearchQueueOrderView,
} from '../../src/api/schemas.js';
import { nowEntries, type NowInput } from '../../src/lib/nowLine.js';

/**
 * THE ONE TIMER THAT MATTERS MOST RIGHT NOW. Spec B2 (docs/ui-v2/gozlemevi.md).
 *
 * 1 an enemy coming for you (nearest landing) · 2 your own strike landing within
 * 10 min · 3 your nearest own arrival · 4 work finishing within 5 min · 5 a galaxy
 * event ending within 15 min · 6 your shield ending within the hour. The head of
 * the list is the line; the rest is "+N" and the sheet one tap under it.
 */

const NOW = Date.parse('2026-09-23T12:00:00Z');
const MIN = 60_000;
const at = (minutes: number): Date => new Date(NOW + minutes * MIN);

const thread = (kind: PendingThread['kind'], minutes: number, extra: Partial<PendingThread> = {}): PendingThread => ({
  kind,
  targetName: 'Kestrel',
  minutesRemaining: minutes,
  arriveAt: at(minutes),
  ...extra,
});

const run = (status: MiningRun['status'], arrive: number, home: number | null): MiningRun => ({
  id: `run-${status}-${String(arrive)}`,
  targetKind: 'asteroid',
  asteroidId: null,
  debrisFieldId: null,
  status,
  craft: 2,
  departAt: at(-30),
  arriveAt: at(arrive),
  homeAt: home === null ? null : at(home),
  intercept: { x: 0, y: 0, z: 0 },
  minedAlloy: 0,
  minedCrystal: 0,
  minedDeuterium: 0,
});

const order = (minutes: number): BuildOrderView => ({
  id: `order-${String(minutes)}`,
  queue: 'CONSTRUCTION',
  slot: 0,
  kind: 'BUILDING',
  subject: 'REFINERY',
  count: 1,
  startedAt: at(-60),
  finishesAt: at(minutes),
  cost: { alloy: 100, crystal: 0, deuterium: 0 },
});

const research = (minutes: number): ResearchQueueOrderView => ({
  id: `research-${String(minutes)}`,
  slot: 0,
  projectId: 'CARGO_HOLDS',
  level: 2,
  startedAt: at(-60),
  finishesAt: at(minutes),
  cost: { alloy: 100, crystal: 0, deuterium: 0 },
});

const shower = (starts: number, ends: number): ActiveGalaxyEvent => ({
  id: '00000000-0000-4000-8000-000000000001',
  kind: 'ASTEROID_SHOWER',
  startsAt: at(starts),
  endsAt: at(ends),
  asteroidSpawnMultiplier: 2,
});

const input = (over: Partial<NowInput> = {}): NowInput => ({
  now: NOW,
  threads: [],
  runs: [],
  builds: [],
  research: [],
  events: [],
  shieldUntil: null,
  ...over,
});

const kinds = (over: Partial<NowInput>): string[] => nowEntries(input(over)).map((entry) => entry.kind);

describe('the Now line', () => {
  it('is empty when nothing is timed', () => {
    expect(nowEntries(input())).toEqual([]);
  });

  it('puts an enemy coming for you ahead of everything, however far off', () => {
    expect(kinds({
      threads: [thread('transfer', 1), thread('incoming', 90)],
      builds: [order(2)],
      shieldUntil: at(20),
    })[0]).toBe('incoming');
  });

  it('reads two enemies by who lands first', () => {
    const entries = nowEntries(input({ threads: [thread('incoming', 40), thread('incoming', 12)] }));
    expect(entries.map((entry) => entry.at)).toEqual([at(12).getTime(), at(40).getTime()]);
  });

  it('lifts your own strike landing within ten minutes over a sooner arrival', () => {
    expect(kinds({ threads: [thread('transfer', 2), thread('fleet', 9, { leg: 'outbound' })] }))
      .toEqual(['strike', 'flight']);
  });

  it('counts a pirate raid and a Death Star as strikes too', () => {
    expect(kinds({ threads: [thread('pirate', 5, { leg: 'outbound' }), thread('death_star', 8)] }))
      .toEqual(['strike', 'strike']);
  });

  it('leaves a strike further than ten minutes among the arrivals, by time', () => {
    expect(kinds({ threads: [thread('fleet', 25, { leg: 'outbound' }), thread('transfer', 15)] }))
      .toEqual(['flight', 'flight']);
  });

  it('never counts a fleet on its way home as a strike', () => {
    expect(kinds({ threads: [thread('fleet', 3, { leg: 'return' })] })).toEqual(['flight']);
  });

  it('lands a mining craft on its way home at its home instant', () => {
    const [entry] = nowEntries(input({ runs: [run('returning', -5, 7)] }));
    expect(entry?.kind).toBe('run');
    expect(entry?.at).toBe(at(7).getTime());
  });

  it('ignores a finished mining run', () => {
    expect(nowEntries(input({ runs: [run('done', -30, -10)] }))).toEqual([]);
  });

  it('shows work only in its last five minutes', () => {
    expect(kinds({ builds: [order(4), order(6), order(-1)], research: [research(5)] }))
      .toEqual(['build', 'research']);
  });

  it('shows a galaxy event only in its last fifteen minutes, and only once it has begun', () => {
    expect(kinds({ events: [shower(-60, 10)] })).toEqual(['event']);
    expect(kinds({ events: [shower(-60, 20)] })).toEqual([]);
    expect(kinds({ events: [shower(5, 12)] })).toEqual([]);
  });

  it('warns of the shield only in its last hour', () => {
    expect(kinds({ shieldUntil: at(50) })).toEqual(['shield']);
    expect(kinds({ shieldUntil: at(120) })).toEqual([]);
    expect(kinds({ shieldUntil: at(-1) })).toEqual([]);
  });

  it('orders the tiers whatever the clock says', () => {
    expect(kinds({
      shieldUntil: at(1),
      events: [shower(-60, 2)],
      builds: [order(3)],
      threads: [thread('transfer', 30)],
    })).toEqual(['flight', 'build', 'event', 'shield']);
  });

  it('keeps an enemy that has already landed until the server resolves it', () => {
    expect(kinds({ threads: [thread('incoming', -1)] })).toEqual(['incoming']);
  });
});
