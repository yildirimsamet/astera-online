import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PIRATE, dynamicPirateHourOf, dynamicPirateIndex } from '@astera/rules';
import { FixedClock } from '../src/clock.js';
import { asteroidSpawnHours } from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import { openAsteroidHour } from '../src/services/asteroidSpawn.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import {
  loadPirateSnapshot,
  pirateId,
  pirateIndexFromId,
  pirateSpecAt,
  privatePirateField,
} from '../src/services/pirateField.js';
import { makeAccount, testDb, truncateAll } from './helpers.js';
import { pino } from 'pino';

/**
 * PIRATES PER ACTIVE COMMANDER, HOUR BY HOUR. Owner instruction, 2026-09-19.
 *
 * The hour's row is the whole state: the worker writes the pirate lane beside the
 * rock lanes, and every read derives the same pirates from it. A season created
 * before ruleset 9 keeps the derived per-seat lane for life.
 */

const START = new Date('2026-09-01T21:00:00.000Z');
const silent = pino({ level: 'silent' });

beforeEach(async () => { await truncateAll((await testDb()).db); });
afterAll(async () => { await (await testDb()).close(); });

async function seasonWith(people: number, rulesetVersion: number, code: string) {
  const { db } = await testDb();
  const clock = new FixedClock(new Date(START.getTime() + 5 * 60_000));
  const { season } = await createSeason(db, {
    shardCode: code,
    seed: 4513,
    startsAt: START,
    playerCap: 60,
    rulesetVersion,
  });
  for (let i = 0; i < people; i++) {
    const account = await makeAccount(db, `Dyn${code}${String(i)}`);
    await joinSeason(db, account.id, season.id, clock);
  }
  return { db, clock, season };
}

const pirateLaneOf = async (seasonId: string) => {
  const { db } = await testDb();
  const [row] = await db.select({ lane: asteroidSpawnHours.pirateLane })
    .from(asteroidSpawnHours)
    .where(and(eq(asteroidSpawnHours.seasonId, seasonId), eq(asteroidSpawnHours.hourStartsAt, START)));
  return row?.lane;
};

describe('a ruleset-9 season', () => {
  it('stores the hour’s pirate lane sized to the people who played', async () => {
    const { db, clock, season } = await seasonWith(10, 9, 'EU-DYN-A');
    await openAsteroidHour(db, { seasonId: season.id, hourStartsAt: START, now: clock.now() });
    // 10 × 0.25 = 2.5 → 3, across the whole hour.
    expect(await pirateLaneOf(season.id)).toEqual({ fromMinute: 0, untilMinute: 60, count: 3 });
  });

  it('never counts the server’s own commanders', async () => {
    const { db, clock, season } = await seasonWith(1, 9, 'EU-DYN-B');
    for (const name of ['Bot0', 'Bot1', 'Bot2', 'Bot3', 'Bot4', 'Bot5', 'Bot6', 'Bot7']) {
      await addBot(db, name, clock);
    }
    await ensureBotSeats(db, clock, silent);
    await openAsteroidHour(db, { seasonId: season.id, hourStartsAt: START, now: clock.now() });
    // One person: 0.25 rounds to 0, and the floor makes it one.
    expect(await pirateLaneOf(season.id)).toEqual({ fromMinute: 0, untilMinute: 60, count: 1 });
  });

  it('publishes exactly the stored pirates, and resolves each by its handle and its index', async () => {
    const { db, clock, season } = await seasonWith(10, 9, 'EU-DYN-C');
    await openAsteroidHour(db, { seasonId: season.id, hourStartsAt: START, now: clock.now() });

    const after = new Date(START.getTime() + 61 * 60_000);
    const snapshot = await loadPirateSnapshot(db, season.id, after);
    expect(snapshot.pirates.map((p) => p.index)).toEqual([0, 1, 2].map((i) => dynamicPirateIndex(0, i)));
    expect(snapshot.standing(after)).toHaveLength(3);

    for (const spec of snapshot.pirates) {
      expect(dynamicPirateHourOf(spec.index)).toBe(0);
      // Looked up by INDEX, not by array position — the positions are 0..2.
      expect(snapshot.spec(spec.index)).toEqual(spec);
      expect(snapshot.livingRosterOf(spec.index)).toEqual(spec.roster);
      expect(pirateIndexFromId(snapshot.key, snapshot.pirates, pirateId(snapshot.key, spec.index)))
        .toBe(spec.index);
      expect(await pirateSpecAt(db, season.id, spec.index)).toEqual(spec);
    }
    expect(snapshot.spec(0)).toBeUndefined();
  });

  it('is the same pirates on every read of the same hour', async () => {
    const { db, clock, season } = await seasonWith(10, 9, 'EU-DYN-D');
    await openAsteroidHour(db, { seasonId: season.id, hourStartsAt: START, now: clock.now() });
    const at = new Date(START.getTime() + 30 * 60_000);
    const first = await loadPirateSnapshot(db, season.id, at);
    // A second open of the same hour is a no-op, never a re-deal.
    await openAsteroidHour(db, { seasonId: season.id, hourStartsAt: START, now: clock.now() });
    const second = await loadPirateSnapshot(db, season.id, at);
    expect(second.pirates).toEqual(first.pirates);
  });

  it('carries no derived lane at all', async () => {
    const { db, season } = await seasonWith(1, 9, 'EU-DYN-E');
    const snapshot = await loadPirateSnapshot(db, season.id, START);
    expect(snapshot.pirates).toEqual([]);
  });
});

describe('a season created before ruleset 9', () => {
  it('writes no pirate lane and keeps its derived per-seat field', async () => {
    const { db, clock, season } = await seasonWith(10, 8, 'EU-DYN-F');
    await openAsteroidHour(db, { seasonId: season.id, hourStartsAt: START, now: clock.now() });
    expect(await pirateLaneOf(season.id)).toBeNull();

    const snapshot = await loadPirateSnapshot(db, season.id, clock.now());
    const derived = privatePirateField(season.asteroidKey);
    expect(snapshot.pirates).toBe(derived);
    const spec = derived[5]!;
    expect(snapshot.spec(spec.index)).toEqual(spec);
    expect(await pirateSpecAt(db, season.id, spec.index)).toEqual(spec);
    expect(derived.every((p) => p.index < PIRATE.dynamic.indexBase)).toBe(true);
  });
});
