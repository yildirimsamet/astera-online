import { describe, expect, it } from 'vitest';
import type {
  ActiveGalaxyEvent,
  BuildOrderView,
  Contact,
  MiningRun,
  PendingThread,
  ResearchQueueOrderView,
} from '../../src/api/schemas.js';
import { nowEntries, nowGlyph, nowSpan, type NowEntry, type NowInput } from '../../src/lib/nowLine.js';

/**
 * THE RING ON A TIMER (G1-c, 2026-11-14). The timer plate draws a ring that drains as the
 * time runs out — but only over a whole the game knows. A flight knows when it left, work
 * when it started, an event when it began; a shield, the move to Silent Space and a
 * maintenance still ahead do not, and a ring guessed over a made-up whole would lie, so
 * those draw the ring's track with no arc.
 *
 * And each kind wears its own mark, so a list of timers reads before a word of it does.
 */

const NOW = Date.parse('2026-11-14T12:00:00Z');
const MIN = 60_000;
const at = (minutes: number): Date => new Date(NOW + minutes * MIN);

const thread = (kind: PendingThread['kind'], minutes: number, extra: Partial<PendingThread> = {}): PendingThread => ({
  kind,
  targetName: 'Kestrel',
  minutesRemaining: minutes,
  arriveAt: at(minutes),
  ...extra,
});

const path = (from: number, to: number): NonNullable<PendingThread['path']> => ({
  from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 1 }, departAt: at(from), arriveAt: at(to),
});

const run = (status: MiningRun['status'], extra: Partial<MiningRun> = {}): MiningRun => ({
  id: 'run-1', targetKind: 'asteroid', asteroidId: null, debrisFieldId: null, status, craft: 2,
  departAt: at(-30), arriveAt: at(10), homeAt: null, intercept: { x: 1, y: 0, z: 1 },
  minedAlloy: 0, minedCrystal: 0, minedDeuterium: 0, recalledAt: null, ...extra,
});

const order = (startedAt: number, finishesAt: number): BuildOrderView => ({
  id: `o-${String(startedAt)}`, queue: 'CONSTRUCTION', slot: 0, kind: 'BUILDING', subject: 'REFINERY', count: 1,
  startedAt: at(startedAt), finishesAt: at(finishesAt), cost: { alloy: 1, crystal: 0, deuterium: 0 },
});

const shower: ActiveGalaxyEvent = {
  id: '00000000-0000-4000-8000-000000000001', kind: 'ASTEROID_SHOWER', startsAt: at(-45), endsAt: at(10), asteroidSpawnMultiplier: 2,
};

const merchant: ActiveGalaxyEvent = {
  id: '00000000-0000-4000-8000-000000000002', kind: 'TRADE_SHIP', startsAt: at(-10), endsAt: at(10),
  rate: { alloy: 1, crystal: 2, deuterium: 4 }, appearsAtMinute: 0, expiresAtMinute: 30,
  orbit: { radius: 100, period: 60, phase: 0, inclination: 0, ascendingNode: 0, speed: 1 },
};

const convoy: ActiveGalaxyEvent = {
  id: '00000000-0000-4000-8000-000000000003', kind: 'INTERGALACTIC_CONVOY', startsAt: at(-10), endsAt: at(10),
  appearsAtMinute: 0, expiresAtMinute: 30,
  route: { from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 }, speed: 1 },
  visual: { formationVersion: 1 },
  rewardPolicy: { resourceCapHours: 4, fullRewardForceRatio: 1, shipDropFullFirepower: 1, shipDropChanceAtFullQuality: 0.5, maxAwardedShips: 3 },
};

const research: ResearchQueueOrderView = {
  id: 'r-1', slot: 0, projectId: 'CARGO_HOLDS', level: 2, startedAt: at(-120), finishesAt: at(4),
  cost: { alloy: 1, crystal: 0, deuterium: 0 },
};

const contact: Contact = {
  id: 'mission-9', kind: 'unknown', from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 1 },
  startAt: at(-20), endAt: at(40), inbound: true,
};

const input = (over: Partial<NowInput>): NowInput => ({
  now: NOW, threads: [], runs: [], builds: [], research: [], events: [], shieldUntil: null, ...over,
});

/** The one entry an input makes, in the sheet's scope (every order, waiting or not). */
const only = (over: Partial<NowInput>): NowEntry => {
  const list = nowEntries(input(over), 'sheet');
  expect(list).toHaveLength(1);
  return list[0]!;
};

describe('the whole a timer runs over', () => {
  it('runs your own flight from its departure to its landing', () => {
    const entry = only({ threads: [thread('transfer', 30, { path: path(-90, 30) })] });
    expect(nowSpan(entry)).toEqual({ from: at(-90).getTime(), to: at(30).getTime() });
  });

  it('has no whole for a flight whose departure it was never told', () => {
    expect(nowSpan(only({ threads: [thread('transfer', 30)] }))).toBeNull();
  });

  it('runs an enemy from the moment the galaxy saw it leave, and only while it is seen', () => {
    const incoming = thread('incoming', 40, { contactId: 'mission-9' });
    expect(nowSpan(only({ threads: [incoming] }), [contact])).toEqual({ from: at(-20).getTime(), to: at(40).getTime() });
    expect(nowSpan(only({ threads: [incoming] }), [])).toBeNull();
  });

  it('runs a drill out from its departure, and home from where it turned', () => {
    expect(nowSpan(only({ runs: [run('outbound')] }))).toEqual({ from: at(-30).getTime(), to: at(10).getTime() });
    const home = run('returning', { arriveAt: at(-10), homeAt: at(25) });
    expect(nowSpan(only({ runs: [home] }))).toEqual({ from: at(-10).getTime(), to: at(25).getTime() });
    const recalled = run('returning', { arriveAt: at(10), recalledAt: at(-5), homeAt: at(15) });
    expect(nowSpan(only({ runs: [recalled] }))).toEqual({ from: at(-5).getTime(), to: at(15).getTime() });
  });

  it('runs work from its start, and an order still in the queue over nothing yet', () => {
    expect(nowSpan(only({ builds: [order(-60, 3)] }))).toEqual({ from: at(-60).getTime(), to: at(3).getTime() });
    expect(nowSpan(only({ builds: [order(30, 90)] }))).toBeNull();
    expect(nowSpan(only({ research: [research] }))).toEqual({ from: at(-120).getTime(), to: at(4).getTime() });
  });

  it('runs a galaxy event over its own window', () => {
    expect(nowSpan(only({ events: [shower] }))).toEqual({ from: at(-45).getTime(), to: at(10).getTime() });
  });

  it('runs a maintenance under way to its reopening, and one still ahead over nothing', () => {
    expect(nowSpan(only({ maintenance: { startsAt: at(-10), endsAt: at(20) } }))).toEqual({ from: at(-10).getTime(), to: at(20).getTime() });
    expect(nowSpan(only({ maintenance: { startsAt: at(60), endsAt: at(90) } }))).toBeNull();
  });

  it('knows no whole for the shield or the move to Silent Space', () => {
    expect(nowSpan(only({ shieldUntil: at(30) }))).toBeNull();
    expect(nowSpan(only({ silentSpaceAt: at(60) }))).toBeNull();
  });
});

describe('the mark each timer wears', () => {
  it.each([
    ['an enemy', { threads: [thread('incoming', 5)] }, 'siren'],
    ['your strike landing', { threads: [thread('fleet', 5)] }, 'attack'],
    ['your fleet still far out', { threads: [thread('fleet', 60)] }, 'rocket'],
    ['a fleet coming home', { threads: [thread('fleet', 60, { leg: 'return' })] }, 'recall'],
    ['a probe', { threads: [thread('probe', 60)] }, 'eye'],
    ['a transfer', { threads: [thread('transfer', 60)] }, 'crate'],
    ['a support wave for the clan', { threads: [thread('transfer', 60, { clanSupport: true })] }, 'support'],
    ['a convoy to another galaxy', { threads: [thread('intergalactic_convoy', 60)] }, 'crate'],
    ['a convoy to the merchant', { threads: [thread('trade', 60)] }, 'crate'],
    ['a settlement', { threads: [thread('settlement', 60)] }, 'colony'],
    ['a radiation bomb', { threads: [thread('radiation_bomb', 60)] }, 'radiation'],
    ['a monument run', { threads: [thread('monument', 60, { monumentOrdinal: 2 })] }, 'star'],
    ['the unknown signal', { threads: [thread('unknown_signal', 60)] }, 'target'],
    ['a drill', { runs: [run('outbound')] }, 'mine'],
    ['a building', { builds: [order(-60, 3)] }, 'up'],
    ['an event', { events: [shower] }, 'asteroid'],
    ['the merchant', { events: [merchant] }, 'crate'],
    // A fleet passing through, told from the merchant where its name is not written (G1-d2).
    ['a convoy passing through', { events: [convoy] }, 'rocket'],
    ['the shield', { shieldUntil: at(30) }, 'shield'],
    ['the move to Silent Space', { silentSpaceAt: at(60) }, 'warn'],
    ['a maintenance', { maintenance: { startsAt: at(60), endsAt: at(90) } }, 'settings'],
  ] as const)('marks %s', (_name, over, glyph) => {
    expect(nowGlyph(only(over))).toBe(glyph);
  });
});
