import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp, type BuiltApp } from '../src/app.js';
import * as schema from '../src/db/schema.js';
import { accounts, nativeSessions, planets, players } from '../src/db/schema.js';
import { findAccount } from '../src/services/account.js';
import { commanderRows, demolish } from '../src/services/reclaim.js';
import { publish, publishShard } from '../src/stream/bus.js';
import { seedWorld, testDb, testEnv, TEST_DATABASE_URL, type Fixture } from './helpers.js';

/**
 * A FRAME IS DELIVERED FROM MEMORY. Scaling plan F1.1 (M1, M10).
 *
 * Every frame and every heartbeat used to read `players ⋈ accounts` (and the native
 * session) to prove the socket still belonged to a signed-in commander in the same
 * galaxy: one SELECT per recipient per event, 10,000/s at a thousand listeners and
 * ten events a second. The connection now reads that epoch once, and anything that
 * could end it — a credential change, a transfer, a reclaimed seat, a device logging
 * out — is announced by a database trigger in the transaction that made it, so no
 * writer can forget to. A LISTEN gap is closed by one batched re-check before the
 * next frame, a native session closes at its expiry, and one account holds at most
 * three streams per process.
 */
const silent = pino({ level: 'silent' });
let f: Fixture;
let built: BuiltApp;
let client: ReturnType<typeof postgres>;
let base: string;
const wire: string[] = [];

beforeEach(async () => {
  f = await seedWorld(2);
  client = postgres(TEST_DATABASE_URL, { max: 4, onnotice: () => undefined,
    debug: (_connection, query) => { wire.push(query.toLowerCase()); } });
  built = buildApp({ db: drizzle(client, { schema }), clock: f.clock, logger: silent,
    env: testEnv({ SSE_HEARTBEAT_MS: '100', NATIVE_AUTH_ENABLED: 'true', NATIVE_APP_ORIGINS: 'https://localhost' }) });
  await built.app.ready();
  await built.bus.start();
  await built.app.listen({ port: 0, host: '127.0.0.1' });
  const address = built.app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${String(address.port)}`;
});
afterEach(async () => { await built.close(); await client.end(); });
afterAll(async () => { await (await testDb()).close(); });

const token = (seat: number) => built.app.tokens.issueAccess(f.accountIds[seat]!);
const byteChunk = z.object({ done: z.boolean(), value: z.instanceof(Uint8Array).optional() });

async function waitFor(what: string, test: () => boolean, ms = 2_000): Promise<void> {
  for (let waited = 0; !test(); waited += 10) {
    if (waited > ms) throw new Error(`waited ${String(ms)} ms for ${what}`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/** A real socket, read in the background; resolves once both topics are attached. */
async function open(accessToken: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/stream`, { headers: { authorization: `Bearer ${accessToken}`, ...headers }, signal: controller.signal });
  expect(response.status).toBe(200);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const frames: string[] = [];
  let buffer = '';
  let ended = false;
  void (async () => {
    try {
      for (;;) {
        const chunk = byteChunk.parse(await reader.read());
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        for (let split = buffer.indexOf('\n\n'); split !== -1; split = buffer.indexOf('\n\n')) {
          frames.push(buffer.slice(0, split));
          buffer = buffer.slice(split + 2);
        }
      }
    } catch { /* aborted by the test */ } finally { ended = true; }
  })();
  const stream = {
    events: () => frames.flatMap(frame => frame.split('\n').filter(line => line.startsWith('event:')).map(line => line.slice(6).trim())),
    pings: () => frames.filter(frame => frame === ': ping').length,
    ended: () => ended,
    abort: () => { controller.abort(); },
    until: (what: string, test: () => boolean) => waitFor(`${what}; frames [${frames.join(' | ')}], ended=${String(ended)}`, test),
  };
  await stream.until('the stream to attach', () => frames.includes(': connected'));
  // The heartbeat queues behind the connection's one epoch read; after it, the stream is settled.
  await stream.until('a first heartbeat', () => stream.pings() > 0);
  return stream;
}

it('delivers 100 frames and 4 heartbeats without reading players, accounts or native sessions', async () => {
  const stream = await open(await token(0));
  wire.length = 0;
  const pings = stream.pings();
  for (let i = 0; i < 100; i++) await publish(f.db, f.playerIds[0]!, 'battle_resolved');
  await stream.until('100 frames and 4 more heartbeats',
    () => stream.events().length >= 100 && stream.pings() >= pings + 4);
  stream.abort();
  expect(wire.filter(query => /"(players|accounts|native_sessions)"/.test(query))).toEqual([]);
  expect(wire.filter(query => /^\s*begin\b/.test(query))).toEqual([]);
});

const revocations: { name: string; revoke: () => Promise<unknown> }[] = [
  { name: 'a credential change (password reset, ban, deletion approval)', revoke: () =>
    f.db.update(accounts).set({ authVersion: sql`${accounts.authVersion} + 1` }).where(eq(accounts.id, f.accountIds[0]!)) },
  { name: 'the seat being reclaimed', revoke: async () => {
    const owned = await f.db.select({ id: planets.id }).from(planets).where(eq(planets.controllerPlayerId, f.playerIds[0]!));
    const ids = owned.map(row => row.id);
    await f.db.transaction(async tx => { await demolish(tx, ids, f.playerIds[0]!, await commanderRows(tx, ids, f.playerIds[0]!)); });
  } },
];

for (const { name, revoke } of revocations) {
  it(`closes the stream on ${name} before the next frame`, async () => {
    const stream = await open(await token(0));
    await revoke();
    await publish(f.db, f.playerIds[0]!, 'battle_resolved');
    await stream.until('the stream to close', stream.ended);
    expect(stream.events()).toEqual([]);
  });
}

it('tells the client its placement moved, and closes, before any later frame', async () => {
  const stream = await open(await token(0));
  await f.db.update(players).set({ placementVersion: sql`${players.placementVersion} + 1` }).where(eq(players.id, f.playerIds[0]!));
  await publishShard(f.db, f.seasonId, 'world');
  await stream.until('the stream to close', stream.ended);
  expect(stream.events()).toEqual(['placement_changed']);
});

it('closes a native stream when this device logs out, and when its session expires', async () => {
  const account = await findAccount(f.db, f.accountIds[0]!);
  if (!account) throw new Error('Missing fixture account');
  const native = { origin: 'https://localhost' };

  const loggedOut = await built.app.nativeSessions.open(account);
  const first = await open(loggedOut.accessToken, native);
  await built.app.nativeSessions.logout({ sessionId: loggedOut.nativeSessionId, refreshToken: loggedOut.refreshToken });
  await publish(f.db, f.playerIds[0]!, 'battle_resolved');
  await first.until('the logged-out stream to close', first.ended);
  expect(first.events()).toEqual([]);

  // The test clock stands still: only a timer set from the session's own expiry can close this.
  const expiring = await built.app.nativeSessions.open(account);
  await f.db.update(nativeSessions).set({ expiresAt: new Date(f.clock.now().getTime() + 600) })
    .where(eq(nativeSessions.id, expiring.nativeSessionId));
  const second = await open(expiring.accessToken, native);
  await second.until('the expired stream to close', second.ended);
});

it('re-checks every stream after a LISTEN gap before delivering the next frame', async () => {
  const stream = await open(await token(0));
  const listener = built.bus.listenerBackendPid();
  if (listener === null) throw new Error('event bus exposed no listener backend');
  await f.db.execute(sql`select pg_terminate_backend(${listener})`);
  await waitFor('the listener to drop', () => !built.bus.status().listening, 8_000);
  // Committed while nobody listens: its trigger notification is lost with the socket.
  await f.db.update(accounts).set({ authVersion: sql`${accounts.authVersion} + 1` }).where(eq(accounts.id, f.accountIds[0]!));
  await waitFor('the listener to return', () => built.bus.status().listening, 8_000);
  await publish(f.db, f.playerIds[0]!, 'battle_resolved');
  await stream.until('the stream to close', stream.ended);
  expect(stream.events()).toEqual([]);
});

it('never delivers a galaxy frame committed after, or alongside, a revocation', async () => {
  const after = await open(await token(0));
  await f.db.update(accounts).set({ authVersion: sql`${accounts.authVersion} + 1` }).where(eq(accounts.id, f.accountIds[0]!));
  await publishShard(f.db, f.seasonId, 'world');
  await after.until('the stream to close', after.ended);
  expect(after.events()).toEqual([]);

  const alongside = await open(await token(1));
  await f.db.transaction(async tx => {
    await tx.update(accounts).set({ authVersion: sql`${accounts.authVersion} + 1` }).where(eq(accounts.id, f.accountIds[1]!));
    await publishShard(tx, f.seasonId, 'world');
  });
  await alongside.until('the stream to close', alongside.ended);
  expect(alongside.events()).toEqual([]);
});

it('closes the oldest of four streams on one account as superseded, and no other account’s', async () => {
  const mine = [];
  for (let i = 0; i < 3; i++) mine.push(await open(await token(0)));
  const theirs = await open(await token(1));
  expect(theirs.ended()).toBe(false);

  const fourth = await open(await token(0));
  await mine[0]!.until('the oldest stream to be superseded', mine[0]!.ended);
  expect(mine[0]!.events()).toEqual(['superseded']);
  expect([mine[1]!, mine[2]!, fourth, theirs].map(stream => stream.ended())).toEqual([false, false, false, false]);
  expect(built.app.streams.status()).toMatchObject({ active: 4, supersededClosed: 1 });
  for (const stream of [...mine, fourth, theirs]) stream.abort();
});

it('closes every stream of a galaxy that rolls over, after telling it', async () => {
  const stream = await open(await token(0));
  await publishShard(f.db, f.seasonId, 'rollover');
  await stream.until('the stream to close', stream.ended);
  expect(stream.events()).toEqual(['shard:rollover']);
});
