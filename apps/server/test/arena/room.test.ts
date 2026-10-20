import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { ARENA_LAYOUT, ARENA_PROTOCOL, ARENA_TUNING as T, PILOT_WIDTH, decodeArenaSnapshot, type ArenaSnapshot } from '@astera/rules/arena';
import { registerArena } from '../../src/arena/server.js';
import { systemClock } from '../../src/clock.js';
import { loadEnv } from '../../src/env.js';

const ORIGIN = 'http://localhost:5198';
const env = loadEnv({ DATABASE_URL: 'postgres://test/arena_test', JWT_SECRET: 'test-secret-that-is-long-enough',
  ROLE: 'arena', ARENA_ENABLED: 'true', ARENA_DEV: 'true', ARENA_ALLOWED_ORIGINS: ORIGIN });

const closers: (() => Promise<void>)[] = [];
afterEach(async () => { while (closers.length) await closers.pop()?.(); });

async function room(): Promise<string> {
  const app = Fastify();
  app.decorate('clock', systemClock);
  registerArena(app, env);
  await app.listen({ port: 0, host: '127.0.0.1' });
  closers.push(() => app.close());
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return `ws://127.0.0.1:${String(address.port)}/arena/ws`;
}

function connect(url: string, guestId: string): Promise<{ socket: WebSocket; messages: unknown[]; next: (match: (m: unknown) => boolean) => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin: ORIGIN });
    const messages: unknown[] = [];
    const waiters: { match: (m: unknown) => boolean; done: (m: unknown) => void }[] = [];
    socket.on('message', raw => {
      const text = Array.isArray(raw) ? Buffer.concat(raw).toString('utf8') : Buffer.isBuffer(raw) ? raw.toString('utf8') : Buffer.from(raw).toString('utf8');
      const value: unknown = JSON.parse(text);
      messages.push(value);
      for (const waiter of [...waiters]) if (waiter.match(value)) { waiters.splice(waiters.indexOf(waiter), 1); waiter.done(value); }
    });
    socket.on('error', reject);
    socket.on('open', () => {
      socket.send(JSON.stringify({ kind: 'hello', v: ARENA_PROTOCOL, guestId, mode: 'enter' }));
      closers.push(async () => { socket.close(); await Promise.resolve(); });
      resolve({ socket, messages, next: match => new Promise(done => {
        const found = messages.find(match);
        if (found) done(found); else waiters.push({ match, done });
      }) });
    });
  });
}

const isSnap = (m: unknown): m is ArenaSnapshot => decodeArenaSnapshot(m) !== null;
const kind = (k: string) => (m: unknown): boolean => typeof m === 'object' && m !== null && 'kind' in m && m.kind === k;

describe('arena room protocol v2', () => {
  it('welcomes a guest with the v2 layout and streams decodable snapshots with mineral state', async () => {
    const url = await room();
    const pilot = await connect(url, 'guest-room-test-a');
    const welcome = await pilot.next(kind('welcome'));
    expect(welcome).toMatchObject({ v: ARENA_PROTOCOL, layoutVersion: ARENA_LAYOUT.version });
    const snap = await pilot.next(isSnap);
    if (!isSnap(snap)) throw new Error('no snapshot');
    expect(snap.self).toHaveLength(PILOT_WIDTH);
    expect(snap.minerals).toHaveLength(ARENA_LAYOUT.deposits.length);
    expect(snap.dry).toEqual(ARENA_LAYOUT.deposits.map(() => 0));
    const roster = (welcome as { pilots: { role?: string }[] }).pilots.map(p => p.role).filter(Boolean);
    expect(roster.sort()).toEqual(['hunter', 'miner', 'patrol']);
  });

  it('clamps an oversized aim-assist channel and rejects out-of-range input', async () => {
    const url = await room();
    const pilot = await connect(url, 'guest-room-test-b');
    await pilot.next(kind('welcome'));
    const send = (values: number[]): void => { pilot.socket.send(JSON.stringify({ kind: 'in', values })); };
    for (let seq = 1; seq <= 40; seq++) send([seq, 0, 0, 100, 0, 1000, 0]);
    const later = await pilot.next(m => isSnap(m) && m.ack >= 30);
    if (!isSnap(later)) throw new Error('no snapshot');
    const omegaYaw = later.self[10] ?? 0;
    expect(Math.abs(omegaYaw)).toBeLessThanOrEqual(T.assistMax * T.turnRateMax * (1 + T.slowTurnBonus) + 1e-9);
    expect(Math.abs(omegaYaw)).toBeGreaterThan(0);
    const before = pilot.messages.length;
    send([41, 0, 0, 100, 0, 5000, 0]);
    await new Promise(resolve => setTimeout(resolve, 300));
    const acks = pilot.messages.slice(before).filter(isSnap).map(m => m.ack);
    expect(acks.every(ack => ack < 41)).toBe(true);
  });
});
