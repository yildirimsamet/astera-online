import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import * as schema from '../src/db/schema.js';
import { publishShard } from '../src/stream/bus.js';
import { seedWorld, testDb, testEnv, TEST_DATABASE_URL, type Fixture } from './helpers.js';

/**
 * A FRAME IS NOT A WRITE. Resource analysis 2026-10-13.
 *
 * Every frame, heartbeats included, used to open a transaction and take
 * `players … FOR SHARE`. A row lock assigns an xid, so each frame paid a commit
 * with a WAL flush: ~4.9 per second across production, the same order as every
 * WAL sync the database made. A heartbeat is a comment line that tells nobody
 * anything; an event frame only needs to know the placement it was subscribed
 * under still holds, which one plain read answers.
 */
let f: Fixture;
let built: ReturnType<typeof buildApp>;
let client: ReturnType<typeof postgres>;
let url: string;
let authorization: string;
const wire: string[] = [];

beforeEach(async () => {
  f = await seedWorld(1);
  client = postgres(TEST_DATABASE_URL, { max: 4, onnotice: () => undefined,
    debug: (_connection, query) => { wire.push(query.toLowerCase()); } });
  built = buildApp({ db: drizzle(client, { schema }), env: testEnv({ SSE_HEARTBEAT_MS: '100' }),
    clock: f.clock, logger: pino({ level: 'silent' }) });
  await built.app.ready();
  await built.bus.start();
  await built.app.listen({ port: 0, host: '127.0.0.1' });
  const address = built.app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  url = `http://127.0.0.1:${String(address.port)}/api/stream`;
  authorization = `Bearer ${await built.app.tokens.issueAccess(f.accountIds[0]!)}`;
});
afterEach(async () => { await built.close(); await client.end(); });
afterAll(async () => { await (await testDb()).close(); });

/** Read raw text off the stream until `until` matches or two seconds pass. */
async function readUntil(controller: AbortController, until: (text: string) => boolean): Promise<string> {
  const response = await fetch(url, { headers: { authorization }, signal: controller.signal });
  expect(response.status).toBe(200);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  // A blocked read has no deadline of its own; aborting the request ends it.
  const deadline = setTimeout(() => { controller.abort(); }, 2_000);
  try {
    while (!until(text)) {
      const chunk: unknown = await reader.read();
      if (typeof chunk !== 'object' || chunk === null || !('value' in chunk) || !(chunk.value instanceof Uint8Array)) break;
      text += decoder.decode(chunk.value, { stream: true });
      if (text.includes(': connected')) await onConnected();
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  } finally {
    clearTimeout(deadline);
  }
  return text;
}

let onConnected: () => Promise<void> = async () => { /* replaced per test */ };

it('sends heartbeats without touching the database', async () => {
  const controller = new AbortController();
  let window: string[] = [];
  onConnected = async () => {
    onConnected = async () => { /* once */ };
    wire.length = 0;
    await new Promise(resolve => setTimeout(resolve, 450));
    window = [...wire];
  };
  const text = await readUntil(controller, seen => (seen.match(/: ping/g) ?? []).length >= 3);
  controller.abort();
  expect((text.match(/: ping/g) ?? []).length).toBeGreaterThanOrEqual(3);
  expect(window.filter(query => query.includes('"players"'))).toEqual([]);
});

it('checks an event frame’s placement with one plain read and no row lock', async () => {
  const controller = new AbortController();
  onConnected = async () => {
    onConnected = async () => { /* once */ };
    for (let i = 0; i < 100 && built.bus.subscriberCount(f.playerIds[0]!) === 0; i++) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    wire.length = 0;
    await publishShard(f.db, f.seasonId, 'world');
  };
  const text = await readUntil(controller, seen => seen.includes('event: shard:world'));
  controller.abort();
  expect(text).toContain('event: shard:world');
  const placement = wire.filter(query => query.includes('"players"'));
  expect(placement.length).toBeGreaterThan(0);
  expect(placement.filter(query => /\bfor (share|update|key share|no key update)\b/.test(query))).toEqual([]);
  expect(wire.filter(query => /^\s*begin\b/.test(query))).toEqual([]);
});
