import { describe, expect, it } from 'vitest';
import { ROUTE_SCHEMAS } from './capacity-schemas.js';
import {
  BURST_READS, burstSize, MEASURED, pickWeighted, resolveRead, SINGLE_READS, TIMER_READS,
  workloadRates, WRITES, WRITES_COVERED,
} from './capacity-workload.js';

/**
 * WHAT A RUN SENDS IS WHAT PLAYERS SEND. Owner, 2026-11-03. The table comes from 40 hours
 * of production logs; the old runner sent 67 % traffic reads, omitted 38 % of real
 * requests and wrote about 40× too little at this multiplier's scale.
 */
describe('the measured workload', () => {
  it('sends a player three times what a player does, on the clocks of the new client', () => {
    const real = MEASURED.requests / MEASURED.onlineSeconds;
    expect(real).toBeCloseTo(0.327, 2);
    const rates = workloadRates(3);
    // The measured clocks were 0.38 requests a second; live-stream clocks are 0.08.
    expect(rates.timers).toBeCloseTo(1 / 180 + 4 / 180 + 2 / 60 + 4 / 180, 6);
    expect(rates.total / real).toBeGreaterThan(1.9);
    expect(rates.total / real).toBeLessThan(2.3);
  });

  it('multiplies what a player does and leaves the client clocks as they are', () => {
    const [one, three] = [workloadRates(1), workloadRates(3)];
    expect(three.burstReads).toBeCloseTo(one.burstReads * 3, 6);
    expect(three.singles).toBeCloseTo(one.singles * 3, 6);
    expect(three.writes).toBeCloseTo(one.writes * 3, 6);
    expect(three.timers).toBe(one.timers);
  });

  it('keeps the real weight of each layer', () => {
    const { burstReads, writes, burstsPerSecond } = workloadRates(1);
    // Measured: 3,809 bursts over 40 hours at 3.8 online, about 25 per online hour.
    expect(burstsPerSecond * 3600).toBeGreaterThan(20);
    expect(burstsPerSecond * 3600).toBeLessThan(27);
    expect(burstReads).toBeCloseTo(0.17, 1);
    expect(writes).toBeCloseTo(0.0133, 3);
  });

  it('polls traffic on the client clock and never faster', () => {
    expect(TIMER_READS.find(timer => timer.read.path === '/api/skins')?.net).toBe(true);
    expect(SINGLE_READS.some(single => single.read.path === '/api/galaxy/traffic')).toBe(false);
    expect(TIMER_READS.some(timer => timer.read.path === '/api/galaxy/traffic')).toBe(false);
  });

  it('reads a timer route once, not again as a single read', () => {
    const timed = new Set(TIMER_READS.map(timer => timer.read.route));
    expect(SINGLE_READS.filter(single => timed.has(single.read.route))).toEqual([]);
  });

  it('writes through the routes real clients use, in their measured shares', () => {
    const names = WRITES.map(write => write.kind);
    expect(names).toContain('collect');
    expect(names).toContain('fleet');
    const total = WRITES.reduce((sum, write) => sum + write.count, 0);
    expect(WRITES.find(write => write.kind === 'collect')!.count / total).toBeCloseTo(0.289, 2);
    expect(WRITES.find(write => write.kind === 'fleet')!.count / total).toBeCloseTo(0.0028, 3);
    expect(WRITES_COVERED).toBeGreaterThan(0.8);
  });

  it('checks every route it sends against the wire contract', () => {
    const routes = [...BURST_READS, ...SINGLE_READS].map(entry => entry.read.route)
      .concat(TIMER_READS.map(timer => timer.read.route));
    expect(routes.filter(route => !ROUTE_SCHEMAS.has(route))).toEqual([]);
    for (const route of ['POST /api/planets/:id/collect', 'POST /api/planets/:id/upgrade', 'POST /api/planets/:id/build',
      'POST /api/auth/refresh', 'POST /api/session/return/seen', 'POST /api/notifications/seen', 'POST /api/intel/probe',
      'POST /api/mining/launch', 'POST /api/fleet/launch']) expect(ROUTE_SCHEMAS.has(route)).toBe(true);
  });
});

describe('drawing from the workload', () => {
  it('picks by weight across the whole roll', () => {
    const table = [{ read: 'a', count: 1 }, { read: 'b', count: 3 }];
    expect(pickWeighted(table, 0).read).toBe('a');
    expect(pickWeighted(table, 0.24).read).toBe('a');
    expect(pickWeighted(table, 0.25).read).toBe('b');
    expect(pickWeighted(table, 0.999).read).toBe('b');
  });

  it('draws a burst from the measured sizes', () => {
    expect(burstSize(0)).toBeGreaterThanOrEqual(10);
    expect(burstSize(0.5)).toBe(20);
    expect(burstSize(0.999)).toBeGreaterThanOrEqual(92);
    const rolls = Array.from({ length: 1000 }, (_, index) => burstSize(index / 1000));
    const mean = rolls.reduce((sum, size) => sum + size, 0) / rolls.length;
    expect(mean).toBeGreaterThan(22);
    expect(mean).toBeLessThan(30);
  });

  it('fills in the commander its own world', () => {
    const read = BURST_READS.find(burst => burst.read.route === 'GET /api/planets/:id')!.read;
    expect(resolveRead(read, 'world-1')).toEqual({ path: '/api/planets/world-1', route: 'GET /api/planets/:id' });
    const pirates = BURST_READS.find(burst => burst.read.route === 'GET /api/pirates')!.read;
    expect(resolveRead(pirates, 'world-1').path).toBe('/api/pirates?originPlanetId=world-1');
  });
});

/** Time-driven reads keep their minute however healthy the stream: no event moves them. */
describe('which clocks slow under a live stream', () => {
  const net = (path: string) => TIMER_READS.find(timer => timer.read.path.startsWith(path))?.net;
  it('the ones an event keeps fresh do', () => {
    for (const path of ['/api/skins', '/api/galaxy/events', '/api/monuments', '/api/pirates']) expect(net(path)).toBe(true);
  });
  it('the ones that drift with no event do not', () => {
    for (const path of ['/api/season', '/api/intel']) expect(net(path)).toBe(false);
  });
});

