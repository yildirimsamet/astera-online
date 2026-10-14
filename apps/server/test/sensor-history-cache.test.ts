import { setTimeout as delay } from 'node:timers/promises';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, expect, it } from 'vitest';
import { planets, satellites } from '../src/db/schema.js';
import { Projections } from '../src/services/projections.js';
import { refreshSensorEpoch } from '../src/services/sensorHistory.js';
import { EventBus, publish } from '../src/stream/bus.js';
import { TEST_DATABASE_URL, giveInstrument, giveSatellite, seedWorld, setLevel, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

it('single-flights private history, isolates commanders/seasons and invalidates on an actual sensor change', async () => {
  const f = await seedWorld(2);
  const mine = f.planetIds[0]!;
  const playerId = f.playerIds[0]!;
  await setLevel(f.db, mine, 'CORE', 5);
  await giveSatellite(f.db, mine, 'UPLINK');
  await giveInstrument(f.db, mine, 'TELESCOPE', 3);
  await refreshSensorEpoch(f.db, mine, f.clock.now());
  const bus = new EventBus(TEST_DATABASE_URL, pino({ level: 'silent' }));
  const projections = new Projections(f.db, bus, {
    enabled: true, maxSeasons: 4, maxAccounts: 4,
    commanderTtlMs: 60_000, publicTtlMs: 60_000, trafficTtlMs: 60_000, miningTtlMs: 60_000,
  });
  try {
    await bus.start();
    const [first, joined] = await Promise.all([
      projections.historyFor(playerId, f.seasonId), projections.historyFor(playerId, f.seasonId),
    ]);
    expect(joined).toEqual(first);
    expect(projections.status().sensorHistory).toMatchObject({ misses: 1, singleFlightWaits: 1 });
    expect(await projections.historyFor(f.playerIds[1]!, f.seasonId)).not.toEqual(first);
    expect(await projections.historyFor(playerId, '00000000-0000-4000-8000-000000000001')).toEqual([]);
    const before = await projections.sensorsFor(playerId, [mine]);
    f.clock.advance(1);
    await f.db.transaction(async tx => {
      await tx.update(satellites).set({ level: 1 }).where(and(eq(satellites.planetId, mine), eq(satellites.type, 'TELESCOPE')));
      await refreshSensorEpoch(tx, mine, f.clock.now());
    });
    for (let n = 0; n < 200 && projections.status().sensorHistory.invalidations < 2; n++) await delay(5);
    expect(projections.status().sensorHistory.invalidations).toBe(2);
    const after = await projections.historyFor(playerId, f.seasonId);
    expect(after).toHaveLength(first.length + 1);
    expect(after.at(-1)?.reach).toBeLessThan(first.at(-1)!.reach);
    expect((await projections.sensorsFor(playerId, [mine]))[0]!.identify).toBeLessThan(before[0]!.identify);
    expect(projections.status().sensorHistory.entries).toBe(2); // other commander survives
  } finally { projections.close(); await bus.stop(); }
});

it('keeps unchanged and rolled-back epochs cached and invalidates both owners when control changes', async () => {
  const f = await seedWorld(2);
  const alice = f.playerIds[0]!;
  const bob = f.playerIds[1]!;
  const [colony] = await f.db.insert(planets).values({
    seasonId: f.seasonId, controllerPlayerId: alice, kind: 'COLONY',
    name: 'Sensor fixture', slotIndex: 99_999, x: 0, y: 0, z: 0, lastTickAt: f.clock.now(),
  }).returning({ id: planets.id });
  if (!colony) throw new Error('sensor fixture created no colony');
  const mine = colony.id;
  await refreshSensorEpoch(f.db, mine, f.clock.now());
  const bus = new EventBus(TEST_DATABASE_URL, pino({ level: 'silent' }));
  const projections = new Projections(f.db, bus, {
    enabled: true, maxSeasons: 4, maxAccounts: 4,
    commanderTtlMs: 60_000, publicTtlMs: 60_000, trafficTtlMs: 60_000, miningTtlMs: 60_000,
  });
  let barriers = 0;
  const stop = bus.observe(event => { if (event.kind === 'test-barrier') barriers++; });
  const barrier = async (): Promise<void> => {
    const target = barriers + 1;
    await publish(f.db, alice, 'test-barrier');
    for (let n = 0; n < 200 && barriers < target; n++) await delay(5);
    expect(barriers).toBe(target);
  };
  try {
    await bus.start();
    const before = await projections.historyFor(alice, f.seasonId);
    const bobBefore = await projections.historyFor(bob, f.seasonId);
    await refreshSensorEpoch(f.db, mine, f.clock.now());
    await barrier();
    expect(projections.status().sensorHistory.invalidations).toBe(0);
    f.clock.advance(1);
    await expect(f.db.transaction(async tx => {
      await tx.update(planets).set({ controllerPlayerId: bob }).where(eq(planets.id, mine));
      await refreshSensorEpoch(tx, mine, f.clock.now());
      throw new Error('rollback fixture');
    })).rejects.toThrow('rollback fixture');
    await barrier();
    expect(projections.status().sensorHistory.invalidations).toBe(0);
    expect(await projections.historyFor(alice, f.seasonId)).toEqual(before);
    await f.db.transaction(async tx => {
      await tx.update(planets).set({ controllerPlayerId: bob }).where(eq(planets.id, mine));
      await refreshSensorEpoch(tx, mine, f.clock.now());
    });
    await barrier();
    expect(projections.status().sensorHistory.invalidations).toBe(2);
    expect((await projections.historyFor(alice, f.seasonId)).at(-1)?.endsAt).not.toBeNull();
    expect(await projections.historyFor(bob, f.seasonId)).toHaveLength(bobBefore.length + 1);
  } finally { stop(); projections.close(); await bus.stop(); }
});
