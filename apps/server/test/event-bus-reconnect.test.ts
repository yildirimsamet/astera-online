import { and, eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SENSOR } from '@astera/rules';
import { buildings, planets } from '../src/db/schema.js';
import { Projections } from '../src/services/projections.js';
import { EventBus, publish, publishShard } from '../src/stream/bus.js';
import {
  TEST_DATABASE_URL,
  giveInstrument,
  giveSatellite,
  seedWorld,
  setLevel,
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

  /**
   * A PROBE COMING HOME IS THE ONE PRIVATE EVENT A SHARED PROJECTION DEPENDS ON.
   * D127.
   *
   * The projections observer opened with `if (!('shard' in event)) return;`, so a
   * delivered probe report changed nothing here and `remembered` refreshed only
   * on its TTL. The user-visible result was the feature contradicting itself for
   * up to half a minute: the report lands, `probe_report` wakes the client, the
   * client refetches — and `/api/galaxy` answers out of a cache that still says
   * UNKNOWN. The Intel centre held a report about a world the disc was still
   * drawing as an unmarked point.
   *
   * The event is on the channel every replica already listens to and carries a
   * player id and a kind, so acting on it discloses nothing that was not already
   * addressed to that one commander.
   */
  it('forgets one commander’s probe memory the moment a report lands', async () => {
    await projections.rememberedFor(f.playerIds[0]!);
    expect(projections.status().remembered).toMatchObject({ entries: 1, invalidations: 0 });

    await publish(f.db, f.playerIds[0]!, 'probe_report');
    await waitFor(
      () => projections.status().remembered.invalidations === 1,
      'the probe report to reach the projections',
    );

    // And only that projection: a probe tells the galaxy nothing about itself.
    expect(projections.status().publicGalaxy.invalidations).toBe(0);
    expect(projections.status().commander.invalidations).toBe(0);
  });

  /** Some other private event must not cost a cache entry it cannot have moved. */
  it('ignores every other private event', async () => {
    await projections.rememberedFor(f.playerIds[0]!);

    let delivered = 0;
    const unsubscribe = bus.subscribe(f.playerIds[0]!, () => { delivered += 1; });
    await publish(f.db, f.playerIds[0]!, 'battle_report');
    await waitFor(() => delivered === 1, 'the unrelated private event');
    unsubscribe();

    expect(projections.status().remembered).toMatchObject({ entries: 1, invalidations: 0 });
  });

  it('refreshes one commander’s sensor reach when their build completes', async () => {
    const planetId = f.planetIds[0]!;
    const playerId = f.playerIds[0]!;
    await setLevel(f.db, planetId, 'CORE', 5);
    await giveSatellite(f.db, planetId, 'UPLINK');

    const before = await projections.sensorsFor(playerId, [planetId]);
    expect(before[0]).toMatchObject({ telescope: false, identify: SENSOR.baseRadius });
    expect(projections.status().sensors).toMatchObject({ entries: 1, invalidations: 0 });

    // The worker commits the hardware and this addressed event in one transaction.
    // Arrange the same order explicitly so a stale 60-second cache cannot hide in
    // a test that happens to wait for its TTL.
    await giveInstrument(f.db, planetId, 'TELESCOPE', 5);
    await publish(f.db, playerId, 'build_complete');
    await waitFor(
      () => projections.status().sensors.invalidations === 1,
      'the completed build to invalidate its owner’s sensors',
    );

    const after = await projections.sensorsFor(playerId, [planetId]);
    expect(after[0]?.telescope).toBe(true);
    expect(after[0]?.identify).toBeGreaterThan(before[0]!.identify);
    // A private build changes neither the shared galaxy nor another private fact.
    expect(projections.status().publicGalaxy.invalidations).toBe(0);
    expect(projections.status().remembered.invalidations).toBe(0);
  });

  it('drops cached sensor reach as soon as an impact lowers Core', async () => {
    const planetId = f.planetIds[0]!;
    const playerId = f.playerIds[0]!;
    await setLevel(f.db, planetId, 'CORE', 5);
    await giveSatellite(f.db, planetId, 'UPLINK');
    await giveInstrument(f.db, planetId, 'TELESCOPE', 5);
    await giveInstrument(f.db, planetId, 'RADAR', 5);

    const before = await projections.sensorsFor(playerId, [planetId]);
    expect(before[0]).toMatchObject({ telescope: true, identify: SENSOR.maxRadius });

    // A real Death Star impact removes exactly one Core level and emits no target
    // identity. NOTIFY is transactional, so the observer can only clear the cache
    // after the lower level is committed and visible to the replacement read.
    await f.db.transaction(async (tx) => {
      await tx
        .update(buildings)
        .set({ level: 4 })
        .where(and(eq(buildings.planetId, planetId), eq(buildings.type, 'CORE')));
      await publishShard(tx, f.seasonId, 'impact');
    });
    await waitFor(
      () => projections.status().sensors.invalidations === 1,
      'the impact to clear cached sensor entitlement',
    );

    const after = await projections.sensorsFor(playerId, [planetId]);
    expect(after[0]?.identify).toBeLessThan(before[0]!.identify);
    expect(after[0]?.detect).toBeLessThan(before[0]!.detect);
    expect(after[0]?.warn).toBeLessThan(before[0]!.warn);
    // Impact has no ownership effect, so the commander topology is left alone.
    expect(projections.status().commander.invalidations).toBe(0);
  });

  it('bypasses a dead listener and clears every projection before reuse', async () => {
    const before = await projections.worlds(f.seasonId, f.clock.now());
    await Promise.all([
      projections.commander(f.accountIds[0]!),
      projections.trafficSnapshot(f.seasonId),
      projections.miningSnapshot(f.seasonId, f.clock.now()),
      /**
       * EVERY CACHE, BECAUSE THE LIST IS THE TEST.
       *
       * `remembered` was added for D127 and left out of `clear()`, and this test
       * could not see it: it filled four of the six and asserted on the same
       * four, so a reset that refreshed the world list while going on serving
       * pre-reset probe memory against it was invisible here. A partial list is
       * how that class of bug survives, so both of the caller-keyed projections
       * are filled and asserted alongside the shared ones.
       */
      projections.sensorsFor(f.playerIds[0]!, f.planetIds),
      projections.rememberedFor(f.playerIds[0]!),
    ]);
    expect(before[0]?.name).not.toBe('After reconnect');
    expect(projections.status()).toMatchObject({
      commander: { entries: 1 },
      sensors: { entries: 1 },
      remembered: { entries: 1 },
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
      sensors: { entries: 0 },
      remembered: { entries: 0 },
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
