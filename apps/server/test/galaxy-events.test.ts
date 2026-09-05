import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { GALAXY_EVENTS, MULTI_WORLD, TRADE } from '@astera/rules';
import { FixedClock, minutesSince } from '../src/clock.js';
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
import {
  privateAsteroidField,
  privateAsteroidFieldWithEvents,
} from '../src/services/asteroidField.js';
import { tradeShipOf } from '../src/services/tradeField.js';
import {
  activeGalaxyEvents,
  ensureGalaxyEventLifecycleEvents,
  loadGalaxyEventSchedule,
  lockGalaxyEventAudience,
  seedGalaxyEventCalendar,
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

  async function world(players = 0, rulesetVersion: number = MULTI_WORLD.rulesetVersion) {
    const { db } = await testDb();
    const clock = new FixedClock(START);
    const { season } = await createSeason(db, {
      shardCode: `EU-EVENTS-${String(rulesetVersion)}`,
      seed: 4512,
      startsAt: START,
      playerCap: 60,
      rulesetVersion,
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

  it('atomically seeds both immutable lanes and their lifecycle queue pairs', async () => {
    const { db, season } = await world();
    const occurrences = await db
      .select()
      .from(galaxyEventOccurrences)
      .where(eq(galaxyEventOccurrences.seasonId, season.id));
    const lifecycle = await db
      .select()
      .from(scheduledEvents)
      .where(inArray(scheduledEvents.kind, ['galaxy_event_start', 'galaxy_event_end']));
    const showers = occurrences.filter((row) => row.kind === 'ASTEROID_SHOWER');
    const merchants = occurrences.filter((row) => row.kind === 'TRADE_SHIP');

    expect(showers).toHaveLength(14 * 5);
    expect(merchants).toHaveLength(14 * 4);
    expect(lifecycle).toHaveLength(occurrences.length * 2);
    // Sequence is per kind now, so uniqueness is asserted inside each lane.
    expect(new Set(showers.map((row) => row.sequence)).size).toBe(showers.length);
    expect(new Set(merchants.map((row) => row.sequence)).size).toBe(merchants.length);
    expect(showers.every((row) => 'asteroidSpawnMultiplier' in row.effect
      && row.effect.asteroidSpawnMultiplier === 5)).toBe(true);
    expect(merchants.every((row) => 'rate' in row.effect
      && row.effect.rate.deuterium === TRADE.rate.deuterium)).toBe(true);
    expect(lifecycle.every((row) => row.refId !== null)).toBe(true);
  });

  /**
   * TWO LANES, TWO NUMBER ONES. The persisted unique index moved from
   * `(season_id, sequence)` to `(season_id, kind, sequence)` for exactly this: each
   * kind counts its own occurrences from zero, so on the old index the very first
   * merchant and the very first shower of a season would have collided and the
   * whole season-creation transaction would have rolled back.
   */
  it('lets both kinds legitimately hold sequence zero', async () => {
    const { db, season } = await world();
    const zeroes = await db
      .select()
      .from(galaxyEventOccurrences)
      .where(and(
        eq(galaxyEventOccurrences.seasonId, season.id),
        eq(galaxyEventOccurrences.sequence, 0),
      ));

    expect(zeroes.map((row) => row.kind).sort()).toEqual(['ASTEROID_SHOWER', 'TRADE_SHIP']);
    await expect(db.insert(galaxyEventOccurrences).values({
      seasonId: season.id,
      sequence: 0,
      kind: 'TRADE_SHIP',
      definitionVersion: 1,
      startsAt: START,
      endsAt: new Date(START.getTime() + 60_000),
      effect: { rate: TRADE.rate },
      createdAt: START,
    })).rejects.toThrow();
  });

  /**
   * A RULESET-4 SEASON KEEPS EXACTLY THE CALENDAR IT HAS TODAY.
   *
   * The Asteroid Shower has been live since D149 and its calendar is dealt once at
   * season creation, so a trade lane that consumed a draw the shower stream was
   * going to take would not fail anywhere — every future season would just quietly
   * be a different season. Byte-for-byte equality of the two shower calendars is
   * the in-repo proof that the merchant took its own stream.
   */
  it('adds merchants only at the trade-ship boundary and never moves the shower calendar', async () => {
    const { db, season: legacy } = await world(0, MULTI_WORLD.galaxyEventsRulesetVersion);
    const { season: modern } = await world();
    /*
      `seasons.asteroid_key` is `defaultRandom()`, so two seasons never share a
      calendar by accident and comparing them raw would compare two secrets rather
      than two rulesets. Re-dealing the modern season under the legacy season's key
      isolates the one variable this test is about.
    */
    await db
      .delete(galaxyEventOccurrences)
      .where(eq(galaxyEventOccurrences.seasonId, modern.id));
    await db.delete(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, modern.id),
      inArray(scheduledEvents.kind, ['galaxy_event_start', 'galaxy_event_end']),
    ));
    await db.transaction((tx) => seedGalaxyEventCalendar(
      tx,
      { ...modern, asteroidKey: legacy.asteroidKey },
    ));

    const rows = async (seasonId: string) => db
      .select()
      .from(galaxyEventOccurrences)
      .where(eq(galaxyEventOccurrences.seasonId, seasonId))
      .orderBy(asc(galaxyEventOccurrences.kind), asc(galaxyEventOccurrences.sequence));

    const legacyRows = await rows(legacy.id);
    const modernRows = await rows(modern.id);
    expect(legacyRows.every((row) => row.kind === 'ASTEROID_SHOWER')).toBe(true);
    expect(modernRows.some((row) => row.kind === 'TRADE_SHIP')).toBe(true);

    const shower = (row: typeof legacyRows[number]) => ({
      sequence: row.sequence,
      definitionVersion: row.definitionVersion,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      effect: row.effect,
    });
    expect(modernRows.filter((row) => row.kind === 'ASTEROID_SHOWER').map(shower))
      .toEqual(legacyRows.map(shower));
  });

  /**
   * The composed field is the balance surface the whole mining lane hangs off, and
   * `withAsteroidShowerLanes` filters merchants out internally. This asserts the
   * server's cache signature agrees — a signature that collided or went stale would
   * serve a different field and make asteroid ids unresolvable.
   */
  it('composes an asteroid field the trade lane cannot touch', async () => {
    const { db, season } = await world();
    const calendar = await loadGalaxyEventSchedule(db, season.id, season.startsAt);
    const showersOnly = calendar.filter((event) => event.kind === 'ASTEROID_SHOWER');

    expect(calendar.some((event) => event.kind === 'TRADE_SHIP')).toBe(true);
    expect(privateAsteroidFieldWithEvents(season.asteroidKey, calendar))
      .toEqual(privateAsteroidFieldWithEvents(season.asteroidKey, showersOnly));
  });

  it('composes bonus lanes while preserving every baseline asteroid', async () => {
    const { db, season } = await world();
    const baseline = privateAsteroidField(season.asteroidKey);
    const snapshot = await loadMiningSnapshot(db, season.id, START);

    expect(snapshot.asteroids.length).toBeGreaterThan(baseline.length);
    expect(snapshot.asteroids.slice(0, baseline.length)).toEqual(baseline);
  });

  it('repairs a missing lifecycle row without duplicating the rest', async () => {
    const { db, season } = await world();
    const occurrences = await db
      .select()
      .from(galaxyEventOccurrences)
      .where(eq(galaxyEventOccurrences.seasonId, season.id));
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
    expect(lifecycle).toHaveLength(occurrences.length * 2);
  });

  it('delivers start and end exactly once to every player', async () => {
    const { db, clock, season, playerIds } = await world(2);
    const [occurrence] = await db
      .select()
      .from(galaxyEventOccurrences)
      // Kind-scoped since D156: `sequence` numbers each lane separately, so
      // "sequence 0" alone no longer names one row.
      .where(and(
        eq(galaxyEventOccurrences.seasonId, season.id),
        eq(galaxyEventOccurrences.kind, 'ASTEROID_SHOWER'),
      ))
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
      // Kind-scoped since D156: `sequence` numbers each lane separately, so
      // "sequence 0" alone no longer names one row.
      .where(and(
        eq(galaxyEventOccurrences.seasonId, season.id),
        eq(galaxyEventOccurrences.kind, 'ASTEROID_SHOWER'),
      ))
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
      // Kind-scoped since D156: `sequence` numbers each lane separately, so
      // "sequence 0" alone no longer names one row.
      .where(and(
        eq(galaxyEventOccurrences.seasonId, season.id),
        eq(galaxyEventOccurrences.kind, 'ASTEROID_SHOWER'),
      ))
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
    /*
      SCOPED TO THE OCCURRENCE THIS TEST IS ABOUT. D166 raised the merchant to four
      windows a day covering twelve of its twenty-four hours, so a shower's opening
      minute now routinely has a merchant already in the sky — and an unscoped count
      was measuring "how many events happen to be live", which is not this test's
      subject. The backfill claim is about ONE lifecycle transition arriving once.
    */
    const news = await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.playerId, joined.playerId),
        eq(notifications.kind, 'galaxy_event_started'),
        eq(notifications.refId, occurrence!.id),
      ));
    expect(news).toHaveLength(1);
  });

  it('shows only active occurrences and backfills a joining player', async () => {
    const { db, clock, season } = await world();
    const [occurrence] = await db
      .select()
      .from(galaxyEventOccurrences)
      // Kind-scoped since D156: `sequence` numbers each lane separately, so
      // "sequence 0" alone no longer names one row.
      .where(and(
        eq(galaxyEventOccurrences.seasonId, season.id),
        eq(galaxyEventOccurrences.kind, 'ASTEROID_SHOWER'),
      ))
      .orderBy(galaxyEventOccurrences.sequence)
      .limit(1);
    clock.set(new Date(occurrence!.startsAt.getTime() + 1_000));
    const account = await makeAccount(db, 'LateEventTester');
    const joined = await joinSeason(db, account.id, season.id, clock);

    const active = await activeGalaxyEvents(db, account.id, clock);
    expect(active.filter((event) => event.kind === 'ASTEROID_SHOWER')).toEqual([
      expect.objectContaining({
        kind: 'ASTEROID_SHOWER',
        asteroidSpawnMultiplier: GALAXY_EVENTS.definitions.ASTEROID_SHOWER
          .effect.asteroidSpawnMultiplier,
      }),
    ]);
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.playerId, joined.playerId));
    expect(rows.filter((row) => row.kind === 'galaxy_event_started'))
      .toHaveLength(active.length);
  });

  /**
   * THE PATH THAT WOULD HAVE THROWN INSIDE THE WORKER.
   *
   * `effectSchema` used to read `asteroidSpawnMultiplier` unconditionally in four
   * places, one of which is this handler. The first TRADE_SHIP occurrence in any
   * season would have raised inside `processGalaxyEventLifecycle`, and a throwing
   * lifecycle handler is how D47's outage looked from the outside: the event queue
   * stops and nothing in the galaxy lands again.
   */
  it('delivers a trade ship start and end exactly once to every player', async () => {
    const { db, clock, season, playerIds } = await world(2);
    const [occurrence] = await db
      .select()
      .from(galaxyEventOccurrences)
      .where(and(
        eq(galaxyEventOccurrences.seasonId, season.id),
        eq(galaxyEventOccurrences.kind, 'TRADE_SHIP'),
      ))
      .orderBy(galaxyEventOccurrences.sequence)
      .limit(1);
    const queued = async (kind: 'galaxy_event_start' | 'galaxy_event_end') => (await db
      .select()
      .from(scheduledEvents)
      .where(and(
        eq(scheduledEvents.kind, kind),
        eq(scheduledEvents.refId, occurrence!.id),
      )))[0];

    clock.set(occurrence!.startsAt);
    await onGalaxyEventStart({ db, clock }, (await queued('galaxy_event_start'))!);
    await onGalaxyEventStart({ db, clock }, (await queued('galaxy_event_start'))!);
    clock.set(occurrence!.endsAt);
    await onGalaxyEventEnd({ db, clock }, (await queued('galaxy_event_end'))!);
    await onGalaxyEventEnd({ db, clock }, (await queued('galaxy_event_end'))!);

    const news = await db
      .select()
      .from(notifications)
      .where(and(
        inArray(notifications.playerId, playerIds),
        eq(notifications.refId, occurrence!.id),
      ));
    expect(news.filter((row) => row.kind === 'galaxy_event_started')).toHaveLength(2);
    expect(news.filter((row) => row.kind === 'galaxy_event_ended')).toHaveLength(2);
    expect(news.every((row) => 'eventKind' in row.payload
      && row.payload.eventKind === 'TRADE_SHIP')).toBe(true);
    const history = await db
      .select()
      .from(galaxyEvents)
      .where(eq(galaxyEvents.refId, occurrence!.id));
    expect(history.map((row) => row.kind).sort()).toEqual([
      'galaxy_event_ended',
      'galaxy_event_started',
    ]);
    expect(history.every((row) => 'rate' in row.payload
      && row.payload.rate.deuterium === TRADE.rate.deuterium)).toBe(true);
  });

  /**
   * THE MERCHANT'S POSITION IS PUBLIC AND ITS FUTURE IS NOT. D149/D156.
   *
   * Unlike a pirate, whose orbital elements ARE its route and stay server-private
   * (D150), a trade ship is an announced moment: everyone knows it is there, so the
   * disc may draw the whole circle and the launch screen may solve the same
   * `interceptOrbit` the server does. What stays back is what D149 has always kept
   * back — the occurrence that has not started yet.
   */
  it('publishes an active trade ship with its orbit and nothing outside the window', async () => {
    const { db, clock, season, accountIds } = await world(1);
    const [account] = accountIds as [string];
    const [occurrence] = await db
      .select()
      .from(galaxyEventOccurrences)
      .where(and(
        eq(galaxyEventOccurrences.seasonId, season.id),
        eq(galaxyEventOccurrences.kind, 'TRADE_SHIP'),
      ))
      .orderBy(galaxyEventOccurrences.sequence)
      .limit(1);
    const merchants = async () => (await activeGalaxyEvents(db, account, clock))
      .filter((event) => event.kind === 'TRADE_SHIP');

    clock.set(new Date(occurrence!.startsAt.getTime() - 1));
    expect(await merchants()).toEqual([]);

    clock.set(occurrence!.startsAt);
    const [live] = await merchants();
    expect(live).toBeDefined();
    const spec = tradeShipOf(season.asteroidKey, {
      sequence: occurrence!.sequence,
      kind: 'TRADE_SHIP',
      startsAtMinute: minutesSince(season.startsAt, occurrence!.startsAt),
      endsAtMinute: minutesSince(season.startsAt, occurrence!.endsAt),
      definitionVersion: occurrence!.definitionVersion,
      effect: { rate: TRADE.rate },
    });
    expect(live).toEqual({
      id: occurrence!.id,
      kind: 'TRADE_SHIP',
      startsAt: occurrence!.startsAt,
      endsAt: occurrence!.endsAt,
      rate: TRADE.rate,
      appearsAtMinute: spec.appearsAt,
      expiresAtMinute: spec.expiresAt,
      orbit: {
        radius: spec.radius,
        period: spec.period,
        phase: spec.phase,
        inclination: spec.inclination,
        ascendingNode: spec.ascendingNode,
        speed: spec.speed,
      },
    });

    clock.set(occurrence!.endsAt);
    expect(await merchants()).toEqual([]);
  });
});
