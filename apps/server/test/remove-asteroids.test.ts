import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { asteroidClaims, asteroidSpawnHours, miningRuns, seasons } from '../src/db/schema.js';
import { appendManualAsteroids } from '../src/cli/manualAsteroids.js';
import { removeAsteroids } from '../src/cli/removeAsteroids.js';
import { asteroidId } from '../src/services/asteroidField.js';
import { ensureAsteroidHourEvents, openAsteroidHour } from '../src/services/asteroidSpawn.js';
import { launchMining, loadMiningSnapshot, projectVisibleAsteroids } from '../src/services/mining.js';
import { giveUnits, placeAt, seedWorld, setLevel, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

async function fixture() {
  const f = await seedWorld(1);
  const hour = f.clock.now();
  await f.db.update(seasons).set({ asteroidDynamicFrom: hour }).where(eq(seasons.id, f.seasonId));
  await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: hour, now: hour });
  await f.db.update(asteroidSpawnHours).set({ lanes: [] }).where(eq(asteroidSpawnHours.seasonId, f.seasonId));
  f.clock.set(new Date(hour.getTime() + 50 * 60_000));
  const batch = await appendManualAsteroids(f.db, { seasonId: f.seasonId, count: 28, at: f.clock.now() });
  return { ...f, hour, ids: batch.asteroidIds };
}

describe('owner-authorized asteroid removal', () => {
  it('defaults to a write-free preview of exactly 22 removals', async () => {
    const f = await fixture();
    const hours = await f.db.select().from(asteroidSpawnHours);
    const result = await removeAsteroids(f.db, { seasonId: f.seasonId, asteroidIds: f.ids.slice(0, 22), now: f.clock.now() });
    expect(result).toMatchObject({ dryRun: true, removing: 22, alreadyRemoved: 0, visibleBefore: 28, visibleAfter: 6 });
    expect(await f.db.select().from(asteroidClaims)).toEqual([]);
    expect(await f.db.select().from(asteroidSpawnHours)).toEqual(hours);
  });

  it('removes 22, retains all geometry and ids, and stays removed after repeated boot planning', async () => {
    const f = await fixture();
    const snapshot = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    const hours = await f.db.select().from(asteroidSpawnHours);
    const input = { seasonId: f.seasonId, asteroidIds: f.ids.slice(0, 22), now: f.clock.now(), dryRun: false };
    const result = await removeAsteroids(f.db, input);
    expect(result).toMatchObject({ removing: 22, visibleBefore: 28, visibleAfter: 6 });
    const claims = await f.db.select().from(asteroidClaims);
    expect(claims).toHaveLength(22);
    for (let index = 0; index < 3; index++) {
      await ensureAsteroidHourEvents(f.db, f.clock.now());
      await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: f.hour, now: f.clock.now() });
    }
    const after = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    expect(after.asteroids).toEqual(snapshot.asteroids);
    expect(projectVisibleAsteroids(after, f.clock.now()).map(rock => asteroidId(after.asteroidKey, rock.index))).toEqual(f.ids.slice(22));
    expect(await f.db.select().from(asteroidSpawnHours)).toEqual(hours);
    expect(await f.db.select().from(asteroidClaims)).toEqual(claims);
  });

  it('serializes repeated concurrent removal without altering the other six rocks', async () => {
    const f = await fixture();
    const input = { seasonId: f.seasonId, asteroidIds: f.ids.slice(0, 22), now: f.clock.now(), dryRun: false };
    const results = await Promise.all([removeAsteroids(f.db, input), removeAsteroids(f.db, input)]);
    expect(results.map(result => result.removing).sort((a, b) => a - b)).toEqual([0, 22]);
    expect(results.map(result => result.alreadyRemoved).sort((a, b) => a - b)).toEqual([0, 22]);
    expect(await f.db.select().from(asteroidClaims)).toHaveLength(22);
    const after = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    expect(projectVisibleAsteroids(after, f.clock.now())).toHaveLength(6);
  });

  it.each(['outbound', 'returning'] as const)('refuses a target of a %s mining run without touching any ore', async status => {
    const f = await fixture();
    const home = f.planetIds[0]!;
    await setLevel(f.db, home, 'CORE', 10);
    await setLevel(f.db, home, 'SHIPYARD', 4);
    await placeAt(f.db, home, { x: 0 });
    await giveUnits(f.db, home, { PROSPECTOR: 1 });
    const before = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    await launchMining(f.db, home, before.asteroids[0]!.index, 1, f.clock);
    await f.db.update(miningRuns).set({ status });
    const runs = await f.db.select().from(miningRuns);
    await expect(removeAsteroids(f.db, { seasonId: f.seasonId, asteroidIds: f.ids.slice(0, 22), now: f.clock.now(), dryRun: false })).rejects.toThrow('active mining');
    expect(await f.db.select().from(asteroidClaims)).toEqual([]);
    expect(await f.db.select().from(miningRuns)).toEqual(runs);
  });

  it('refuses unknown or duplicate ids, empty batches and a frozen season without partial writes', async () => {
    const f = await fixture();
    for (const ids of [[], [f.ids[0]!, f.ids[0]!], [f.ids[0]!, 'another-season-id']]) {
      await expect(removeAsteroids(f.db, { seasonId: f.seasonId, asteroidIds: ids, now: f.clock.now(), dryRun: false })).rejects.toThrow();
    }
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await expect(removeAsteroids(f.db, { seasonId: f.seasonId, asteroidIds: f.ids.slice(0, 22), now: f.clock.now(), dryRun: false })).rejects.toThrow('live season');
    expect(await f.db.select().from(asteroidClaims)).toEqual([]);
  });
});
