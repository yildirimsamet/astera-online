import { sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planets } from '../src/db/schema.js';
import { Projections } from '../src/services/projections.js';
import { EventBus, publishShard } from '../src/stream/bus.js';
import {
  TEST_DATABASE_URL,
  seedWorld,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('event bus reconnect', () => {
  let f: Fixture;
  let bus: EventBus;
  let projections: Projections;

  beforeEach(async () => {
    f = await seedWorld(1);
    bus = new EventBus(TEST_DATABASE_URL, silent, {
      heartbeatMs: 25,
      heartbeatTimeoutMs: 75,
      // Leave a deterministic window in which the dead socket is observable and
      // a commit can happen without its NOTIFY reaching this replica.
      reconnectBackoffSeconds: 0.8,
    });
    projections = new Projections(f.db, bus, {
      enabled: true,
      maxSeasons: 4,
      maxAccounts: 4,
      commanderTtlMs: 60_000,
      publicTtlMs: 60_000,
      trafficTtlMs: 60_000,
      miningTtlMs: 60_000,
    });
    await bus.start();
  });

  afterEach(async () => {
    projections.close();
    await bus.stop();
  });

  const waitFor = async (predicate: () => boolean, label: string): Promise<void> => {
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(
      `timed out waiting for ${label}: ${JSON.stringify(bus.status())}`,
    );
  };

  it('bypasses a dead listener and clears every projection before reuse', async () => {
    const before = await projections.worlds(f.seasonId, f.clock.now());
    await Promise.all([
      projections.commander(f.accountIds[0]!),
      projections.trafficSnapshot(f.seasonId),
      projections.miningSnapshot(f.seasonId, f.clock.now()),
    ]);
    expect(before[0]?.name).not.toBe('After reconnect');
    expect(projections.status()).toMatchObject({
      commander: { entries: 1 },
      publicGalaxy: { entries: 1 },
      traffic: { entries: 1 },
      mining: { entries: 1 },
    });

    const listenerPid = bus.listenerBackendPid();
    if (listenerPid === null) throw new Error('event bus exposed no listener backend');
    await f.db.execute(sql`select pg_terminate_backend(${listenerPid})`);

    await waitFor(() => !bus.status().listening, 'listener heartbeat to expire');
    expect(projections.status().enabled).toBe(false);
    expect(projections.status()).toMatchObject({
      commander: { entries: 0 },
      publicGalaxy: { entries: 0 },
      traffic: { entries: 0 },
      mining: { entries: 0 },
    });

    // This commit intentionally emits no shard notification. It stands in for a
    // real commit whose NOTIFY was lost while the listener socket was down.
    await f.db
      .update(planets)
      .set({ name: 'After reconnect' })
      .where(sql`${planets.id} = ${f.planetIds[0]!}`);

    // Reads in the loss window are authoritative and are not admitted back into
    // a cache that may have missed invalidations.
    expect((await projections.worlds(f.seasonId, f.clock.now()))[0]?.name)
      .toBe('After reconnect');
    expect(projections.status().publicGalaxy.entries).toBe(0);

    await waitFor(() => bus.status().reconnects === 1, 'listener to reconnect');
    expect(bus.status().listening).toBe(true);
    expect(projections.status().publicGalaxy.entries).toBe(0);

    const after = await projections.worlds(f.seasonId, f.clock.now());
    expect(after[0]?.name).toBe('After reconnect');

    let delivered = 0;
    const unsubscribe = bus.subscribeShard(f.seasonId, () => { delivered += 1; });
    await publishShard(f.db, f.seasonId, 'world');
    await waitFor(() => delivered === 1, 'post-reconnect shard delivery');
    unsubscribe();
  });
});
