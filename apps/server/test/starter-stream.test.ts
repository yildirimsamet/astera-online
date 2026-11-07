import { sql, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { accounts, vesselOrders, vessels } from '../src/db/schema.js';
import { publish, publishShard } from '../src/stream/bus.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';
import { TOKENS, bearer, freshAccount } from './starterFixture.js';

afterAll(async () => { await (await testDb()).close(); });

const isByteChunk = (value: unknown): value is { done: boolean; value?: Uint8Array } =>
  typeof value === 'object' && value !== null && 'done' in value && typeof value.done === 'boolean'
  && (!('value' in value) || value.value === undefined || value.value instanceof Uint8Array);

/** Through a real socket, as `stream.test.ts` explains: the handler writes to the raw response. */
describe('the stream of a ship', () => {
  let f: Fixture;
  let built: ReturnType<typeof buildApp>;
  let url: string;
  let token: string;
  let accountId: string;
  let vesselId: string;
  let galaxyId: string;
  const open: AbortController[] = [];

  beforeEach(async () => {
    f = await seedWorld(1);
    built = buildApp({ env: testEnv({ STARTER_GALAXY_ENABLED: 'true' }), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    await built.app.ready();
    await built.bus.start();
    await built.app.listen({ port: 0, host: '127.0.0.1' });
    const address = built.app.server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    url = `http://127.0.0.1:${String(address.port)}/api/stream`;
    const person = await freshAccount(f);
    token = person.token;
    accountId = person.id;
    const enlisted = (await built.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(token) })).json<{ vessel: { id: string; galaxy: { id: string } } }>();
    vesselId = enlisted.vessel.id;
    galaxyId = enlisted.vessel.galaxy.id;
  });
  afterEach(async () => {
    for (const controller of open.splice(0)) controller.abort();
    await built.close();
  });

  /** Reads frames into a list until the socket ends; the deadline makes a missing frame a failure. */
  async function connect() {
    const controller = new AbortController();
    open.push(controller);
    const response = await fetch(url, { headers: bearer(token), signal: controller.signal });
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    await reader.read();
    const frames: string[] = [];
    let ended = false;
    const pump = (async () => {
      try {
        for (;;) {
          const chunk: unknown = await reader.read();
          if (!isByteChunk(chunk)) throw new Error('stream returned an invalid byte chunk');
          if (chunk.done) { ended = true; return; }
          for (const match of decoder.decode(chunk.value).matchAll(/^event: (.+)$/gm)) frames.push(match[1]!);
        }
      } catch { ended = true; }
    })();
    const until = async (test: () => boolean, ms = 2000) => {
      const deadline = Date.now() + ms;
      while (!test() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
      return test();
    };
    return { frames, until, pump, isEnded: () => ended };
  }
  const settle = () => new Promise(resolve => setTimeout(resolve, 150));

  it('refreshes sight when the survey antenna completes', async () => {
    const { settleVesselById } = await import('../src/services/starter/vessel.js');
    await f.db.update(vessels).set({ modules: { REFINERY: 2, EXTRACTOR: 2 } }).where(eq(vessels.id, vesselId));
    const now = f.clock.now();
    await f.db.insert(vesselOrders).values({ vesselId, queue: 'CONSTRUCTION', subject: 'SURVEY', stage: 1, slot: 0, startedAt: new Date(now.getTime() - 30000), readyAt: now, remainingSeconds: 0, cost: { alloy: 0, crystal: 0, deuterium: 0 } });
    const stream = await connect();
    await settleVesselById(f.db, vesselId, f.clock);
    expect(await stream.until(() => stream.frames.includes('private:vessel-sight'))).toBe(true);
  });

  it('opens for an account with a ship and no commander', async () => {
    await connect();
  });

  it('refuses an account with neither', async () => {
    const other = await freshAccount(f, 'Other');
    const response = await fetch(url, { headers: bearer(other.token) });
    expect(response.status).toBe(404);
  });

  it('carries what happens to this ship', async () => {
    const stream = await connect();
    await settle();
    await publish(f.db, vesselId, 'private:vessel');
    expect(await stream.until(() => stream.frames.includes('private:vessel'))).toBe(true);
  });

  it('carries what happens in this galaxy', async () => {
    const stream = await connect();
    await settle();
    await publishShard(f.db, galaxyId, 'departure');
    expect(await stream.until(() => stream.frames.includes('shard:departure'))).toBe(true);
  });

  it('carries nothing from the main galaxy', async () => {
    const stream = await connect();
    await settle();
    await publishShard(f.db, f.seasonId, 'launch');
    await publishShard(f.db, f.seasonId, 'mining');
    await publishShard(f.db, galaxyId, 'departure');
    expect(await stream.until(() => stream.frames.includes('shard:departure'))).toBe(true);
    await settle();
    expect(stream.frames).toEqual(['shard:departure']);
  });

  it('tells a stream its ship has left, and closes it', async () => {
    const stream = await connect();
    await settle();
    await f.db.update(vessels).set({ status: 'DEPARTED', slotIndex: null }).where(eq(vessels.id, vesselId));
    expect(await stream.until(() => stream.isEnded())).toBe(true);
    expect(stream.frames.join(' ')).toContain('placement_changed');
  });

  it('closes when the credentials change', async () => {
    const stream = await connect();
    await settle();
    await f.db.update(accounts).set({ authVersion: sql`${accounts.authVersion} + 1` }).where(eq(accounts.id, accountId));
    expect(await stream.until(() => stream.isEnded())).toBe(true);
  });

  it('closes when the ship is gone', async () => {
    const stream = await connect();
    await settle();
    await f.db.delete(vessels).where(eq(vessels.id, vesselId));
    expect(await stream.until(() => stream.isEnded())).toBe(true);
  });

  it('prefers the commander once there is one', async () => {
    const response = await fetch(url, { headers: bearer(await TOKENS.issueAccess(f.accountIds[0]!)) });
    expect(response.status).toBe(200);
    await response.body?.cancel();
  });
});
