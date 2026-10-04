import { afterAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { ASTEROID_DYNAMIC, activeAsteroids } from '@astera/rules';
import { minutesSince } from '../src/clock.js';
import { asteroidClaims, asteroidSpawnHours, miningRuns, seasons } from '../src/db/schema.js';
import { appendManualAsteroids } from '../src/cli/manualAsteroids.js';
import { asteroidId, asteroidIndexFromId } from '../src/services/asteroidField.js';
import { openAsteroidHour } from '../src/services/asteroidSpawn.js';
import { launchMining, loadMiningSnapshot } from '../src/services/mining.js';
import { giveUnits, placeAt, seedWorld, setLevel, testDb } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

async function openedHour() {
  const f = await seedWorld(2);
  const hour = f.clock.now();
  await f.db.update(seasons).set({ asteroidDynamicFrom: hour }).where(eq(seasons.id, f.seasonId));
  await openAsteroidHour(f.db, { seasonId: f.seasonId, hourStartsAt: hour, now: hour });
  f.clock.set(new Date(hour.getTime() + 50 * 60_000));
  return { ...f, hour };
}

describe('operator-only asteroid batches', () => {
  it('previews the exact batch without writing and commits the same ids afterwards', async () => {
    const f = await openedHour();
    const input = { seasonId: f.seasonId, count: 10, at: f.clock.now() };
    const before = await f.db.select().from(asteroidSpawnHours);
    const preview = await appendManualAsteroids(f.db, { ...input, dryRun: true });
    expect(preview.dryRun).toBe(true);
    expect(preview.asteroidIds).toHaveLength(10);
    expect(await f.db.select().from(asteroidSpawnHours)).toEqual(before);
    const committed = await appendManualAsteroids(f.db, input);
    expect(committed.dryRun).toBe(false);
    expect(committed.asteroidIds).toEqual(preview.asteroidIds);
  });

  it('adds exactly ten immediately while preserving every existing rock and natural spawn input', async () => {
    const f = await openedHour();
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const [beforeRow] = await f.db.select().from(asteroidSpawnHours).where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    const before = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    const result = await appendManualAsteroids(f.db, { seasonId: f.seasonId, count: 10, at: f.clock.now() });
    const after = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    expect(after.asteroids).toHaveLength(before.asteroids.length + 10);
    expect(after.asteroids.slice(0, before.asteroids.length)).toEqual(before.asteroids);
    const added = after.asteroids.slice(before.asteroids.length);
    expect(added.every((rock) => rock.appearsAt === minutesSince(season!.startsAt, f.clock.now()))).toBe(true);
    expect(result.asteroidIds).toEqual(added.map((rock) => asteroidId(season!.asteroidKey, rock.index)));
    expect(new Set(result.asteroidIds).size).toBe(10);
    expect(result.alreadyAdded).toBe(false);
    const [afterRow] = await f.db.select().from(asteroidSpawnHours).where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    expect(afterRow).toEqual({ ...beforeRow, lanes: [...beforeRow!.lanes, {
      fromMinute: minutesSince(season!.startsAt, f.clock.now()),
      untilMinute: minutesSince(season!.startsAt, f.clock.now()), count: 10, frontCount: 10,
    }] });
  });

  it('serializes concurrent retries of the same batch without spawning twenty', async () => {
    const f = await openedHour();
    const before = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    const input = { seasonId: f.seasonId, count: 10, at: f.clock.now() };
    const results = await Promise.all([appendManualAsteroids(f.db, input), appendManualAsteroids(f.db, input)]);
    expect(results.map((result) => result.alreadyAdded).sort()).toEqual([false, true]);
    expect(results[0].asteroidIds).toEqual(results[1].asteroidIds);
    expect((await loadMiningSnapshot(f.db, f.seasonId, f.clock.now())).asteroids).toHaveLength(before.asteroids.length + 10);
    await expect(appendManualAsteroids(f.db, { ...input, count: 9 })).rejects.toThrow('different count');
  });

  it('keeps opaque targets, ore already claimed and a launched craft unchanged', async () => {
    const f = await openedHour();
    // Every old rock has appeared by the next hour; avoid betting on a random
    // spawn inside the first fifty minutes. The worker opens the next real hour.
    f.clock.set(new Date(f.hour.getTime() + 61 * 60_000));
    await openAsteroidHour(f.db, { seasonId: f.seasonId,
      hourStartsAt: new Date(f.hour.getTime() + 60 * 60_000), now: f.clock.now() });
    const planetId = f.planetIds[0]!;
    await setLevel(f.db, planetId, 'CORE', 10);
    await setLevel(f.db, planetId, 'SHIPYARD', 4);
    await placeAt(f.db, planetId, { x: 0 });
    await giveUnits(f.db, planetId, { PROSPECTOR: 1 });
    const before = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const nowMinute = minutesSince(season!.startsAt, f.clock.now());
    const rock = activeAsteroids(before.asteroids, nowMinute).find((candidate) => candidate.expiresAt - nowMinute > 45);
    expect(rock).toBeDefined();
    await launchMining(f.db, planetId, rock!.index, 1, f.clock);
    await f.db.insert(asteroidClaims).values({ seasonId: f.seasonId, index: rock!.index, oreTaken: 1, updatedAt: f.clock.now() });
    const runs = await f.db.select().from(miningRuns);
    const claims = await f.db.select().from(asteroidClaims);
    const id = asteroidId(season!.asteroidKey, rock!.index);
    await appendManualAsteroids(f.db, { seasonId: f.seasonId, count: 10, at: f.clock.now() });
    const after = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    expect(asteroidIndexFromId(season!.asteroidKey, after.asteroids, id)).toBe(rock!.index);
    expect(after.asteroids.find((candidate) => candidate.index === rock!.index)).toEqual(rock);
    expect(await f.db.select().from(miningRuns)).toEqual(runs);
    expect(await f.db.select().from(asteroidClaims)).toEqual(claims);
  });

  it('keeps distinct concurrent batches and resolves an earlier retry after later additions', async () => {
    const f = await openedHour();
    const before = await loadMiningSnapshot(f.db, f.seasonId, f.clock.now());
    const first = { seasonId: f.seasonId, count: 3, at: f.clock.now() };
    const second = { ...first, count: 5, at: new Date(first.at.getTime() + 1) };
    const results = await Promise.all([appendManualAsteroids(f.db, first), appendManualAsteroids(f.db, second)]);
    expect(new Set(results.flatMap((result) => result.asteroidIds)).size).toBe(8);
    expect((await loadMiningSnapshot(f.db, f.seasonId, second.at)).asteroids).toHaveLength(before.asteroids.length + 8);
    const retry = await appendManualAsteroids(f.db, first);
    expect(retry.alreadyAdded).toBe(true);
    expect(retry.asteroidIds).toEqual(results[0].asteroidIds);
  });

  it('works with an empty natural lane without inventing active commanders', async () => {
    const f = await openedHour();
    await f.db.update(asteroidSpawnHours).set({ lanes: [], activePlayers: 0, eligiblePlayers: 0 })
      .where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    await appendManualAsteroids(f.db, { seasonId: f.seasonId, count: 10, at: f.clock.now() });
    expect((await loadMiningSnapshot(f.db, f.seasonId, f.clock.now())).asteroids).toHaveLength(10);
    const [row] = await f.db.select().from(asteroidSpawnHours).where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    expect(row?.activePlayers).toBe(0);
    expect(row?.eligiblePlayers).toBe(0);
  });

  it.each([0, -1, 1.5, 101, Number.NaN])('rejects invalid count %s without changing the hour', async (count) => {
    const f = await openedHour();
    const before = await f.db.select().from(asteroidSpawnHours);
    await expect(appendManualAsteroids(f.db, { seasonId: f.seasonId, count, at: f.clock.now() })).rejects.toThrow();
    expect(await f.db.select().from(asteroidSpawnHours)).toEqual(before);
  });

  it('refuses a full index span without changing existing lanes', async () => {
    const f = await openedHour();
    await f.db.update(asteroidSpawnHours).set({ lanes: [{ fromMinute: 0, untilMinute: 60,
      count: ASTEROID_DYNAMIC.indexSpanPerHour, frontCount: 0 }] }).where(eq(asteroidSpawnHours.seasonId, f.seasonId));
    const before = await f.db.select().from(asteroidSpawnHours);
    await expect(appendManualAsteroids(f.db, { seasonId: f.seasonId, count: 10, at: f.clock.now() })).rejects.toThrow('index span');
    expect(await f.db.select().from(asteroidSpawnHours)).toEqual(before);
  });

  it('refuses an hour not opened by the normal worker and an ended season', async () => {
    const f = await openedHour();
    await f.db.delete(asteroidSpawnHours).where(and(eq(asteroidSpawnHours.seasonId, f.seasonId), eq(asteroidSpawnHours.hourStartsAt, f.hour)));
    await expect(appendManualAsteroids(f.db, { seasonId: f.seasonId, count: 10, at: f.clock.now() })).rejects.toThrow('not opened');
    await f.db.update(seasons).set({ endsAt: f.clock.now() }).where(eq(seasons.id, f.seasonId));
    await expect(appendManualAsteroids(f.db, { seasonId: f.seasonId, count: 10, at: f.clock.now() })).rejects.toThrow('live dynamic season');
  });
});
