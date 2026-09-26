import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD, NEUTRAL_OPENING } from '@astera/rules';
import { FixedClock } from '../src/clock.js';
import {
  galaxyEvents,
  neutralPlanetState,
  planets,
  scheduledEvents,
} from '../src/db/schema.js';
import { ensureNeutralCensusEvents } from '../src/services/season.js';
import { onNeutralCensus } from '../src/worker/handlers.js';
import {
  joinSettled,
  makeAccount,
  setLevel,
  testDb,
  truncateAll,
} from './helpers.js';
import type { Db } from '../src/db/client.js';
import { createSeason } from '../src/services/season.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('staged neutral census', () => {
  let f: { db: Db };
  let seasonId: string;
  let clock: FixedClock;

  beforeEach(async () => {
    const fixture = await testDb();
    await truncateAll(fixture.db);
    f = fixture;
    clock = new FixedClock(new Date('2026-10-01T00:00:00.000Z'));
    const created = await createSeason(f.db, {
      shardCode: 'EU-CENSUS',
      seed: 44_551,
      startsAt: clock.now(),
      rulesetVersion: MULTI_WORLD.rulesetVersion,
    });
    seasonId = created.season.id;
  });

  const tierCounts = async () => {
    const rows = await f.db
      .select({ tier: neutralPlanetState.tier })
      .from(neutralPlanetState)
      .innerJoin(planets, eq(planets.id, neutralPlanetState.planetId))
      .where(eq(planets.seasonId, seasonId));
    return {
      1: rows.filter((row) => row.tier === 1).length,
      2: rows.filter((row) => row.tier === 2).length,
      3: rows.filter((row) => row.tier === 3).length,
    };
  };

  it('opens only twenty percent and schedules the first census three days later', async () => {
    expect(await tierCounts()).toEqual(NEUTRAL_OPENING.initial);
    const [event] = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, seasonId),
      eq(scheduledEvents.kind, 'neutral_census'),
    ));
    expect(event?.resolveAt).toEqual(new Date(clock.now().getTime() + 3 * 24 * 60 * 60_000));
  });

  it('opens unmet demand once, records it publicly and queues the next day', async () => {
    for (let index = 0; index < 16; index++) {
      const account = await makeAccount(f.db, `Census ${String(index)}`);
      const joined = await joinSettled(f.db, account.id, seasonId, clock);
      await setLevel(f.db, joined.planetId, 'CORE', 9);
    }
    const [event] = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, seasonId),
      eq(scheduledEvents.kind, 'neutral_census'),
    ));
    if (!event) throw new Error('missing neutral census');
    clock.set(event.resolveAt);

    await onNeutralCensus({ db: f.db, clock }, event);
    await onNeutralCensus({ db: f.db, clock }, event);

    expect(await tierCounts()).toEqual({ 1: 16, 2: 8, 3: 3 });
    const rows = await f.db.select().from(galaxyEvents).where(and(
      eq(galaxyEvents.seasonId, seasonId),
      eq(galaxyEvents.kind, 'neutral_opened'),
    ));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toEqual({ total: 1, tiers: { 1: 1, 2: 0, 3: 0 } });

    const next = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, seasonId),
      eq(scheduledEvents.kind, 'neutral_census'),
      eq(scheduledEvents.status, 'pending'),
    ));
    expect(next.some((row) => row.resolveAt.getTime() === event.resolveAt.getTime() + 24 * 60 * 60_000))
      .toBe(true);
  });

  it('repairs a missing census chain idempotently', async () => {
    await f.db.delete(scheduledEvents).where(eq(scheduledEvents.kind, 'neutral_census'));
    expect(await ensureNeutralCensusEvents(f.db, clock.now())).toBe(1);
    expect(await ensureNeutralCensusEvents(f.db, clock.now())).toBe(0);
  });
});
