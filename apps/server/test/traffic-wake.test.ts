import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { planets } from '../src/db/schema.js';
import { launchAttack } from '../src/services/mission.js';
import { readTrafficView, trafficSignature, watchTraffic } from '../src/stream/trafficWake.js';
import { giveUnits, seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

/**
 * THE SERVER SAYS "READ NOW" THE MOMENT THE PICTURE CHANGED, AND NEVER BEFORE. Query plan, 2026-11-03.
 *
 * A quarter of all requests were one read every five seconds, asked in case a craft had
 * crossed into a commander's circles, which no client can solve for: a craft outside them
 * is not in its payload. Telling the client when that crossing WILL happen would be
 * advance warning no radar operator has, so the server asks the same question on the same
 * clock, with the same projection, and sends a frame with no content once the answer moved.
 */
const contact = (over: Record<string, unknown> = {}) => ({
  id: 'craft', kind: 'unknown', from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 1, z: 1 }, startAt: new Date(0), endAt: new Date(10_000), ...over,
});
const view = (contacts: readonly Record<string, unknown>[], rest: Partial<Parameters<typeof trafficSignature>[0]> = {}) => ({
  contacts, interceptions: [], interceptionImpacts: [], ...rest,
});

describe('trafficSignature', () => {
  it('does not move as a craft flies on, because its window slides with every read', () => {
    const later = contact({ from: { x: 5, y: 5, z: 5 }, to: { x: 9, y: 9, z: 9 }, startAt: new Date(5_000), endAt: new Date(15_000), minutesRemaining: 2 });
    expect(trafficSignature(view([later]))).toBe(trafficSignature(view([contact()])));
  });

  it('does not depend on the order the craft were listed in', () => {
    const [a, b] = [contact({ id: 'a' }), contact({ id: 'b' })];
    expect(trafficSignature(view([a, b]))).toBe(trafficSignature(view([b, a])));
  });

  it.each([
    ['a craft appears', view([contact(), contact({ id: 'other' })])],
    ['the craft is gone', view([])],
    ['the craft is identified', view([contact({ kind: 'fleet' })])],
    ['radiation took ships', view([contact({ fleet: { DART: 1 } })])],
    ['a weapon is shot at', view([contact()], { interceptions: [{ id: 'i' }] })],
    ['a shot lands', view([contact()], { interceptionImpacts: [{ id: 'i' }] })],
  ])('moves when %s', (_name, changed) => {
    expect(trafficSignature(changed)).not.toBe(trafficSignature(view([contact()])));
  });
});

describe('watchTraffic', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const watch = (read: () => Promise<string>) => {
    const wake = vi.fn();
    const failed = vi.fn();
    const recovered = vi.fn();
    const stop = watchTraffic({ read, everyMs: 5_000, timeoutMs: 30_000, wake, failed, recovered });
    return { wake, failed, recovered, stop };
  };

  it('spreads its first read across the interval, so a redeploy does not ask all at once', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const read = vi.fn(() => Promise.resolve('a'));
    const { stop } = watch(read);
    await vi.advanceTimersByTimeAsync(2_499);
    expect(read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledOnce();
    stop();
    vi.restoreAllMocks();
  });

  it('wakes the client once on its first read, because it may have read just before', async () => {
    const { wake, stop } = watch(() => Promise.resolve('a'));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(wake).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(wake).toHaveBeenCalledOnce();
    stop();
  });

  it('wakes on a change, and once more for a replica that had not caught up', async () => {
    let answer = 'a';
    const { wake, stop } = watch(() => Promise.resolve(answer));
    await vi.advanceTimersByTimeAsync(10_000);
    wake.mockClear();
    answer = 'b';
    await vi.advanceTimersByTimeAsync(20_000);
    expect(wake).toHaveBeenCalledTimes(2);
    stop();
  });

  it('reads no more often than a client polled', async () => {
    const read = vi.fn(() => Promise.resolve('a'));
    const { stop } = watch(read);
    await vi.advanceTimersByTimeAsync(50_000);
    expect(read.mock.calls.length).toBeLessThanOrEqual(11);
    expect(read.mock.calls.length).toBeGreaterThanOrEqual(10);
    stop();
  });

  it('never runs two reads at once when one is slow', async () => {
    let running = 0;
    let most = 0;
    const { stop } = watch(async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise(resolve => setTimeout(resolve, 12_000));
      running -= 1;
      return 'a';
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(most).toBe(1);
    stop();
  });

  it('says when it cannot watch, once, and again when it can', async () => {
    let fail = false;
    let answer = 'a';
    const { wake, failed, recovered, stop } = watch(() => fail ? Promise.reject(new Error('down')) : Promise.resolve(answer));
    await vi.advanceTimersByTimeAsync(5_000);
    wake.mockClear();
    fail = true;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(failed).toHaveBeenCalledOnce();
    expect(recovered).not.toHaveBeenCalled();
    fail = false;
    answer = 'b';
    await vi.advanceTimersByTimeAsync(10_000);
    expect(recovered).toHaveBeenCalledOnce();
    expect(wake).toHaveBeenCalled();
    stop();
  });

  it('wakes on recovery even if the answer looks the same, since it was not watching', async () => {
    let fail = false;
    const { wake, stop } = watch(() => fail ? Promise.reject(new Error('down')) : Promise.resolve('a'));
    await vi.advanceTimersByTimeAsync(5_000);
    wake.mockClear();
    fail = true;
    await vi.advanceTimersByTimeAsync(10_000);
    fail = false;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(wake).toHaveBeenCalled();
    stop();
  });

  it('treats a read that never answers as a failure and carries on', async () => {
    let hang = true;
    const { failed, recovered, stop } = watch(() => hang ? new Promise<string>(() => undefined) : Promise.resolve('a'));
    await vi.advanceTimersByTimeAsync(36_000);
    expect(failed).toHaveBeenCalledOnce();
    hang = false;
    await vi.advanceTimersByTimeAsync(40_000);
    expect(recovered).toHaveBeenCalledOnce();
    stop();
  });

  it('stops for good, even with a read in flight', async () => {
    let finish = (_: string): void => undefined;
    const { wake, stop } = watch(() => new Promise<string>((resolve) => { finish = resolve; }));
    await vi.advanceTimersByTimeAsync(5_000);
    stop();
    finish('a');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(wake).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('the stream, with a commander who asked for it', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let url: string;
  let token: string;
  afterAll(async () => { await (await testDb()).close(); });

  beforeEach(async () => {
    f = await seedWorld(3);
    const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    app.trafficWakeMs = 40;
    await app.ready();
    await built.bus.start();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    url = `http://127.0.0.1:${String(address.port)}/api/stream`;
    token = await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!);
  });
  afterEach(async () => { await close(); });

  /** Every frame, whole, until `signal` ends: what a tampering client could read off the wire. */
  const open = async (query: string) => {
    const controller = new AbortController();
    const response = await fetch(`${url}${query}`, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal });
    expect(response.status).toBe(200);
    const frames: string[] = [];
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    const pump = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += value;
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        frames.push(...parts.filter(part => part.startsWith('event:')));
      }
    })().catch(() => undefined);
    return { frames, stop: async () => { controller.abort(); await pump; } };
  };
  const settle = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const wakes = (frames: readonly string[]) => frames.filter(frame => frame.startsWith('event: shard:traffic\n')).length;

  it('stays silent for a client that did not ask, so an old build keeps its polling', async () => {
    const stream = await open('');
    await settle(250);
    expect(stream.frames.filter(frame => frame.includes('traffic'))).toEqual([]);
    await stream.stop();
  });

  it('says it is on, so a client slows down only against a server that will wake it', async () => {
    const stream = await open('?trafficWake=1');
    await vi.waitFor(() => { expect(stream.frames.some(frame => frame.startsWith('event: shard:traffic-wake-on\n'))).toBe(true); });
    await stream.stop();
  });

  it('wakes a commander when a craft comes into their sight, and sends nothing about it', async () => {
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[0]!));
    await f.db.update(planets).set({ x: 20, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[1]!));
    await f.db.update(planets).set({ x: 40, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[2]!));
    await giveUnits(f.db, f.planetIds[1]!, { DART: 5 });
    const stream = await open('?trafficWake=1');
    await vi.waitFor(() => { expect(wakes(stream.frames)).toBe(1); });
    await settle(150);
    await launchAttack(f.db, f.planetIds[1]!, f.planetIds[2]!, { DART: 5 }, f.clock);
    await vi.waitFor(() => { expect(wakes(stream.frames)).toBeGreaterThanOrEqual(2); }, { timeout: 3_000 });
    for (const frame of stream.frames.filter(each => each.startsWith('event: shard:traffic\n'))) {
      expect(frame).toBe('event: shard:traffic\ndata: {"kind":"shard:traffic"}');
    }
    await stream.stop();
  });

  it('tells a commander nothing about a craft outside their sight', async () => {
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[0]!));
    await f.db.update(planets).set({ x: 500_000, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[1]!));
    await f.db.update(planets).set({ x: 500_020, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[2]!));
    await giveUnits(f.db, f.planetIds[1]!, { DART: 5 });
    const stream = await open('?trafficWake=1');
    await vi.waitFor(() => { expect(wakes(stream.frames)).toBe(1); });
    await launchAttack(f.db, f.planetIds[1]!, f.planetIds[2]!, { DART: 5 }, f.clock);
    await settle(500);
    expect(wakes(stream.frames)).toBe(1);
    await stream.stop();
  });

  it('does not call a visible flight carrying on news, as the clock runs', async () => {
    await f.db.update(planets).set({ x: 0, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[0]!));
    await f.db.update(planets).set({ x: 20, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[1]!));
    await f.db.update(planets).set({ x: 40, y: 0, z: 0 }).where(eq(planets.id, f.planetIds[2]!));
    await giveUnits(f.db, f.planetIds[1]!, { DART: 5 });
    await launchAttack(f.db, f.planetIds[1]!, f.planetIds[2]!, { DART: 5 }, f.clock);
    const self = await app.projections.commander(f.accountIds[0]!);
    const at = (ms: number) => readTrafficView(app.projections, self, new Date(f.clock.now().getTime() + ms));
    const first = await at(1_000);
    expect(first.contacts.length).toBeGreaterThan(0);
    expect(trafficSignature(await at(3_000))).toBe(trafficSignature(first));
  });

  it('tells the client when it cannot watch, so it polls for itself, and again when it can', async () => {
    const stream = await open('?trafficWake=1');
    await vi.waitFor(() => { expect(wakes(stream.frames)).toBe(1); });
    const down = vi.spyOn(app.projections, 'commander').mockRejectedValue(new Error('down'));
    await vi.waitFor(() => { expect(stream.frames.some(frame => frame.startsWith('event: shard:traffic-wake-off\n'))).toBe(true); });
    down.mockRestore();
    await vi.waitFor(() => { expect(stream.frames.filter(frame => frame.startsWith('event: shard:traffic-wake-on\n'))).toHaveLength(2); });
    await stream.stop();
  });

  it('stops watching when the client goes away', async () => {
    const stream = await open('?trafficWake=1');
    await vi.waitFor(() => { expect(wakes(stream.frames)).toBe(1); });
    const read = vi.spyOn(app.projections, 'commander');
    await stream.stop();
    await settle(100);
    read.mockClear();
    await settle(200);
    expect(read).not.toHaveBeenCalled();
  });
});
