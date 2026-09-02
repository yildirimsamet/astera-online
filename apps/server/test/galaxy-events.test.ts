import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { GALAXY_EVENTS, MULTI_WORLD } from '@astera/rules';
import { FixedClock } from '../src/clock.js';
import {
  galaxyEventOccurrences,
  galaxyEvents,
  notifications,
  players,
  scheduledEvents,
} from '../src/db/schema.js';
import { createSeason } from '../src/services/season.js';
import { joinSeason } from '../src/services/player.js';
import { loadMiningSnapshot } from '../src/services/mining.js';
import { privateAsteroidField } from '../src/services/asteroidField.js';
import {
  activeGalaxyEvents,
  ensureGalaxyEventLifecycleEvents,
  lockGalaxyEventAudience,
} from '../src/services/galaxyEvents.js';
import { onGalaxyEventEnd, onGalaxyEventStart } from '../src/worker/handlers.js';
import { makeAccount, testDb, truncateAll } from './helpers.js';

const START = new Date('2026-09-01T21:00:00.000Z'); // Türkiye 00:00

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('persisted galaxy events', () => {
  beforeEach(async () => {
    const { db } = await testDb();
    await truncateAll(db);
  });

  async function world(players = 0) {
    const { db } = await testDb();
    const clock = new FixedClock(START);
    const { season } = await createSeason(db, {
      shardCode: 'EU-EVENTS',
      seed: 4512,
      startsAt: START,
      playerCap: 60,
      rulesetVersion: MULTI_WORLD.rulesetVersion,
    });
    const playerIds: string[] = [];
    const accountIds: string[] = [];
    for (let index = 0; index < players; index += 1) {
      const account = await makeAccount(db, `EventTester${String(index)}`);
      const joined = await joinSeason(db, account.id, season.id, clock);
      accountIds.push(account.id);
      playerIds.push(joined.playerId);
    }
    return { db, clock, season, playerIds, accountIds };
  }

  it('atomically seeds seventy immutable occurrences and lifecycle queue pairs', async () => {
    const { db, season } = await world();
    const occurrences = await db
      .select()
      .from(galaxyEventOccurrences)
      .where(eq(galaxyEventOccurrences.seasonId, season.id));
    const lifecycle = await db
      .select()
      .from(scheduledEvents)
      .where(inArray(scheduledEvents.kind, ['galaxy_event_start', 'galaxy_event_end']));

    expect(occurrences).toHaveLength(14 * 5);
    expect(lifecycle).toHaveLength(14 * 5 * 2);
    expect(new Set(occurrences.map((row) => row.sequence)).size).toBe(occurrences.length);
    expect(occurrences.every((row) => row.effect.asteroidSpawnMultiplier === 5)).toBe(true);
    expect(lifecycle.every((row) => row.refId !== null)).toBe(true);
  });

  it('composes bonus lanes while preserving every baseline asteroid', async () => {
    const { db, season } = await world();
    const baseline = privateAsteroidField(season.asteroidKey);
    const snapshot = await loadMiningSnapshot(db, season.id, START);

    expect(snapshot.asteroids.length).toBeGreaterThan(baseline.length);
    expect(snapshot.asteroids.slice(0, baseline.length)).toEqual(baseline);
  });

  it('repairs a missing lifecycle row without duplicating the rest', async () => {
    const { db } = await world();
    const [missing] = await db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'galaxy_event_start'))
      .limit(1);
    await db.delete(scheduledEvents).where(eq(scheduledEvents.id, missing!.id));

    expect(await ensureGalaxyEventLifecycleEvents(db)).toBe(1);
    expect(await ensureGalaxyEventLifecycleEvents(db)).toBe(0);
    const lifecycle = await db
      .select()
      .from(scheduledEvents)
      .where(inArray(scheduledEvents.kind, ['galaxy_event_start', 'galaxy_event_end']));
    expect(lifecycle).toHaveLength(14 * 5 * 2);
  });

  it('delivers start and end exactly once to every player', async () => {
    const { db, clock, season, playerIds } = await world(2);
    const [occurrence] = await db
      .select()
      .from(galaxyEventOccurrences)
      .where(eq(galaxyEventOccurrences.seasonId, season.id))
      .orderBy(galaxyEventOccurrences.sequence)
      .limit(1);
    const [startEvent] = await db
      .select()
      .from(scheduledEvents)
      .where(and(
        eq(scheduledEvents.kind, 'galaxy_event_start'),
        eq(scheduledEvents.refId, occurrence!.id),
      ));
    const [endEvent] = await db
      .select()
      .from(scheduledEvents)
      .where(and(
        eq(scheduledEvents.kind, 'galaxy_event_end'),
        eq(scheduledEvents.refId, occurrence!.id),
      ));

    clock.set(occurrence!.startsAt);
    await onGalaxyEventStart({ db, clock }, startEvent!);
    await onGalaxyEventStart({ db, clock }, startEvent!);
    clock.set(occurrence!.endsAt);
    await onGalaxyEventEnd({ db, clock }, endEvent!);
    await onGalaxyEventEnd({ db, clock }, endEvent!);

    const news = await db
      .select()
      .from(notifications)
      .where(inArray(notifications.playerId, playerIds));
    expect(news.filter((row) => row.kind === 'galaxy_event_started')).toHaveLength(2);
    expect(news.filter((row) => row.kind === 'galaxy_event_ended')).toHaveLength(2);
    expect(news.every((row) => row.refId === occurrence!.id)).toBe(true);
    const history = await db
      .select()
      .from(galaxyEvents)
      .where(eq(galaxyEvents.refId, occurrence!.id));
    expect(history.map((row) => row.kind).sort()).toEqual([
      'galaxy_event_ended',
      'galaxy_event_started',
    ]);
  });

  it('serializes lifecycle fanout behind an in-flight membership change', async () => {
    const { db, clock, season } = await world();
    const account = await makeAccount(db, 'BoundaryJoiner');
    const [occurrence] = await db
      .select()
      .from(galaxyEventOccurrences)
      .where(eq(galaxyEventOccurrences.seasonId, season.id))
      .orderBy(galaxyEventOccurrences.sequence)
      .limit(1);
    const [startEvent] = await db
      .select()
      .from(scheduledEvents)
      .where(and(
        eq(scheduledEvents.kind, 'galaxy_event_start'),
        eq(scheduledEvents.refId, occurrence!.id),
      ));

    let announceLocked: (() => void) | undefined;
    const locked = new Promise<void>((resolve) => { announceLocked = resolve; });
    let releaseMembership: (() => void) | undefined;
    const membershipMayCommit = new Promise<void>((resolve) => { releaseMembership = resolve; });
    const membership = db.transaction(async (tx) => {
      await lockGalaxyEventAudience(tx, season.id, 'membership');
      const [player] = await tx
        .insert(players)
        .values({ accountId: account.id, seasonId: season.id, name: 'BoundaryJoiner' })
        .returning();
      announceLocked?.();
      await membershipMayCommit;
      return player!;
    });
    await locked;

    clock.set(occurrence!.startsAt);
    let lifecycleFinished = false;
    const lifecycle = onGalaxyEventStart({ db, clock }, startEvent!).then(() => {
      lifecycleFinished = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const lifecycleWaited = !lifecycleFinished;
    releaseMembership?.();
    const player = await membership;
    await lifecycle;

    expect(lifecycleWaited).toBe(true);
    const news = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.playerId, player.id),
        eq(notifications.kind, 'galaxy_event_started'),
      ));
    expect(news).toHaveLength(1);
  });

  it('evaluates join backfill after a lifecycle transition that won the audience lock', async () => {
    const { db, clock, season } = await world();
    const account = await makeAccount(db, 'BoundaryBackfill');
    const [occurrence] = await db
      .select()
      .from(galaxyEventOccurrences)
      .where(eq(galaxyEventOccurrences.seasonId, season.id))
      .orderBy(galaxyEventOccurrences.sequence)
      .limit(1);

    clock.set(new Date(occurrence!.startsAt.getTime() - 1));
    let announceLocked: (() => void) | undefined;
    const locked = new Promise<void>((resolve) => { announceLocked = resolve; });
    let releaseLifecycle: (() => void) | undefined;
    const lifecycleMayCommit = new Promise<void>((resolve) => { releaseLifecycle = resolve; });
    const lifecycle = db.transaction(async (tx) => {
      await lockGalaxyEventAudience(tx, season.id, 'lifecycle');
      announceLocked?.();
      await lifecycleMayCommit;
    });
    await locked;

    let joinFinished = false;
    const joining = joinSeason(db, account.id, season.id, clock).then((joined) => {
      joinFinished = true;
      return joined;
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const joinWaited = !joinFinished;
    clock.set(occurrence!.startsAt);
    releaseLifecycle?.();
    await lifecycle;
    const joined = await joining;

    expect(joinWaited).toBe(true);
    const news = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.playerId, joined.playerId),
        eq(notifications.kind, 'galaxy_event_started'),
      ));
    expect(news).toHaveLength(1);
  });

  it('shows only active occurrences and backfills a joining player', async () => {
    const { db, clock, season } = await world();
    const [occurrence] = await db
      .select()
      .from(galaxyEventOccurrences)
      .where(eq(galaxyEventOccurrences.seasonId, season.id))
      .orderBy(galaxyEventOccurrences.sequence)
      .limit(1);
    clock.set(new Date(occurrence!.startsAt.getTime() + 1_000));
    const account = await makeAccount(db, 'LateEventTester');
    const joined = await joinSeason(db, account.id, season.id, clock);

    const active = await activeGalaxyEvents(db, account.id, clock);
    expect(active).toEqual([expect.objectContaining({
      kind: 'ASTEROID_SHOWER',
      asteroidSpawnMultiplier: GALAXY_EVENTS.definitions.ASTEROID_SHOWER
        .effect.asteroidSpawnMultiplier,
    })]);
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.playerId, joined.playerId));
    expect(rows.filter((row) => row.kind === 'galaxy_event_started')).toHaveLength(1);
  });
});
