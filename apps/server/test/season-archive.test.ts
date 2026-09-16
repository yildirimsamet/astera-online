import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { asc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { alloyRate, collectorCap, crystalRate } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import {
  accounts,
  battleReports,
  galaxyEventOccurrences,
  intergalacticConvoyRuns,
  miningRuns,
  missions,
  planets,
  players,
  scheduledEvents,
  seasonCycles,
  seasonResults,
  seasonTelemetrySegments,
  seasons,
  shards,
} from '../src/db/schema.js';
import { onSeasonEnd } from '../src/worker/handlers.js';
import { createSeason } from '../src/services/season.js';
import { planetView } from '../src/services/planetView.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('completed season archive', () => {
  let fixture: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let auth: { authorization: string };

  beforeEach(async () => {
    fixture = await seedWorld(3, 9137);
    const built = buildApp({
      env: testEnv(),
      logger: silent,
      db: fixture.db,
      clock: fixture.clock,
    });
    app = built.app;
    close = built.close;
    await app.ready();
    const tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
    auth = { authorization: `Bearer ${await tokens.issueAccess(fixture.accountIds[0]!)}` };
  });

  afterEach(async () => {
    await close();
  });

  const freeze = async (): Promise<void> => {
    const [season] = await fixture.db
      .select()
      .from(seasons)
      .where(eq(seasons.id, fixture.seasonId));
    const [event] = await fixture.db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'season_end'));
    if (!season || !event) throw new Error('season archive fixture is incomplete');
    fixture.clock.set(season.endsAt);
    await onSeasonEnd({ db: fixture.db, clock: fixture.clock }, event);
  };

  it('lists the live cycle with a stable persisted ordinal and galaxy metadata only', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/season-archive?limit=12',
      headers: auth,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      cycles: {
        ordinal: number;
        status: string;
        galaxies: { seasonId: string; shard: string; shardName: string; status: string }[];
      }[];
      nextCursor: number | null;
    }>();
    expect(body.cycles).toEqual([
      expect.objectContaining({
        ordinal: 1,
        status: 'live',
        galaxies: [expect.objectContaining({ seasonId: fixture.seasonId, status: 'live' })],
      }),
    ]);
    expect(body.nextCursor).toBeNull();

    const [cycle] = await fixture.db.select().from(seasonCycles);
    expect(cycle?.ordinal).toBe(1);
    expect(response.body).not.toContain('commanderName');
    expect(response.body).not.toContain('produced');
  });

  /**
   * A COMPLETED GALAXY NOBODY FINISHED IS NOT A SEASON RECORD.
   *
   * Measured on the live database before this shipped: 18 cycles, 20 completed
   * galaxies, and FOURTEEN of them with no sealed result at all — bootstraps,
   * abandoned test worlds and shards that were opened and rolled before anyone
   * played them. Listing those puts a row in the season selector that opens onto
   * "no results", and more than half the archive is that row. A player reads a
   * broken feature, not an honest gap.
   *
   * So a completed galaxy earns its place in the index by having something in it.
   * A LIVE or PENDING galaxy is always listed — it is the current world, and it
   * has no sealed results yet by definition.
   */
  it('leaves a finished galaxy out of the index when nothing was sealed in it', async () => {
    const [cycle] = await fixture.db
      .select({ id: seasonCycles.id })
      .from(seasons)
      .innerJoin(seasonCycles, eq(seasonCycles.id, seasons.cycleId))
      .where(eq(seasons.id, fixture.seasonId));
    if (!cycle) throw new Error('fixture season has no cycle');
    // A second galaxy in the same cycle that ends with nobody in it.
    const [emptyShard] = await fixture.db
      .insert(shards)
      .values({ code: 'EU-EMPTY', name: 'Empty', ordinal: 99, playerCap: 1 })
      .returning({ id: shards.id });
    const [emptySeason] = await fixture.db
      .insert(seasons)
      .values({
        shardId: emptyShard!.id,
        cycleId: cycle.id,
        seed: 1234,
        status: 'wiped',
        startsAt: new Date(Date.UTC(2026, 0, 1)),
        endsAt: new Date(Date.UTC(2026, 0, 15)),
      })
      .returning({ id: seasons.id });
    await freeze();

    const response = await app.inject({
      method: 'GET',
      url: '/api/season-archive?limit=12',
      headers: auth,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      cycles: { galaxies: { seasonId: string; status: string }[] }[];
    }>();
    const listed = body.cycles.flatMap((entry) => entry.galaxies);
    expect(listed.map((galaxy) => galaxy.seasonId)).toContain(fixture.seasonId);
    expect(listed.map((galaxy) => galaxy.seasonId)).not.toContain(emptySeason!.id);
  });

  /**
   * WHAT THE SEASON IS FOR, SAID WHILE IT IS STILL BEING PLAYED.
   *
   * The archive answers "what did I do"; it cannot answer "why am I still here in
   * week two". That answer is the reward waiting at the top of the table, and it
   * was reachable nowhere in the product: the entitlement was created at freeze
   * and paid on the next join, and a commander had no way to learn it existed
   * until it silently landed in their store.
   *
   * So the live season payload carries the program its cycle was opened with —
   * frozen at creation, so a mid-season deploy cannot change what a player was
   * already shown. It is the TABLE, not a standing: who is in the top ten is the
   * leaderboard's own public ordering and is not restated here.
   */
  it('publishes the reward table the live cycle was opened with', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/season', headers: auth });
    expect(response.statusCode).toBe(200);
    const body = response.json<{
      seasonRewards: { version: number; minimumDominion: number; tiers: {
        place: number; alloy: number; crystal: number; deuterium: number;
      }[] } | null;
    }>();
    expect(body.seasonRewards).not.toBeNull();
    expect(body.seasonRewards?.version).toBe(1);
    expect(body.seasonRewards?.tiers).toHaveLength(10);
    expect(body.seasonRewards?.tiers[0]).toEqual({
      place: 1, alloy: 2_000, crystal: 1_500, deuterium: 300,
    });
    // Monotonic, because a table that pays place 4 more than place 3 is not a ladder.
    const value = body.seasonRewards?.tiers.map((tier) =>
      tier.alloy + 2 * tier.crystal + 32 * tier.deuterium) ?? [];
    for (let i = 1; i < value.length; i++) {
      expect(value[i - 1], `place ${String(i)} vs ${String(i + 1)}`)
        .toBeGreaterThan(value[i] ?? 0);
    }
  });

  /** A cycle opened before the program existed promises nothing, and says so. */
  it('publishes no reward table for a cycle that predates the program', async () => {
    await fixture.db.update(seasonCycles).set({ rewardProgramVersion: 0 });
    const response = await app.inject({ method: 'GET', url: '/api/season', headers: auth });
    expect(response.json<{ seasonRewards: unknown }>().seasonRewards).toBeNull();
  });

  it('refuses the historical leaderboard while the season is live', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/season-archive/${fixture.seasonId}/leaderboard`,
      headers: auth,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'SEASON_NOT_COMPLETE',
      message: 'That season is still live',
    });
  });

  it('serves frozen ranks from immutable result snapshots without exposing account ids', async () => {
    await fixture.db
      .update(players)
      .set({ dominionTaken: 700 })
      .where(eq(players.id, fixture.playerIds[1]!));
    await freeze();

    const original = await fixture.db
      .select({ accountId: seasonResults.accountId, name: accounts.displayName })
      .from(seasonResults)
      .innerJoin(accounts, eq(accounts.id, seasonResults.accountId))
      .orderBy(asc(seasonResults.finalRank));
    await fixture.db
      .update(accounts)
      .set({ displayName: 'RENAMED AFTER FREEZE' })
      .where(eq(accounts.id, original[0]!.accountId));

    const response = await app.inject({
      method: 'GET',
      url: `/api/season-archive/${fixture.seasonId}/leaderboard`,
      headers: auth,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      season: { ordinal: number; status: string };
      ladder: {
        resultId: string;
        rank: number;
        commanderName: string;
        dominion: number;
        title: string;
        self: boolean;
      }[];
    }>();
    expect(body.season).toMatchObject({ ordinal: 1, status: 'frozen' });
    expect(body.ladder.map((row) => row.rank)).toEqual([1, 2, 3]);
    expect(body.ladder[0]).toMatchObject({
      commanderName: original[0]!.name,
      dominion: 700,
    });
    expect(body.ladder[0]!.commanderName).not.toBe('RENAMED AFTER FREEZE');
    expect(body.ladder.filter((row) => row.self)).toHaveLength(1);
    expect(body.ladder.every((row) => row.resultId.length > 0)).toBe(true);
    expect(response.body).not.toContain(original[0]!.accountId);
  });

  it('opens a commander card by opaque result id and builds Genel from completed seasons only', async () => {
    await fixture.db
      .update(players)
      .set({ dominionTaken: 450 })
      .where(eq(players.id, fixture.playerIds[0]!));
    const [legacySeason] = await fixture.db
      .select({ cycleId: seasons.cycleId })
      .from(seasons)
      .where(eq(seasons.id, fixture.seasonId));
    if (!legacySeason) throw new Error('fixture season disappeared');
    await fixture.db.update(seasonCycles).set({ statsVersion: 0 })
      .where(eq(seasonCycles.id, legacySeason.cycleId));
    await fixture.db.update(seasons).set({ statsVersion: 0 })
      .where(eq(seasons.id, fixture.seasonId));
    await freeze();
    const [frozen] = await fixture.db
      .select()
      .from(seasonResults)
      .where(eq(seasonResults.accountId, fixture.accountIds[0]!));
    if (!frozen) throw new Error('freeze did not create a result');

    const nextStart = new Date(fixture.clock.now().getTime() + 86_400_000);
    const next = await createSeason(fixture.db, {
      shardCode: 'EU-ARCHIVE-LIVE',
      seed: 9138,
      startsAt: nextStart,
    });
    const [liveResult] = await fixture.db
      .insert(seasonResults)
      .values({
        cycleId: next.season.cycleId,
        seasonId: next.season.id,
        accountId: fixture.accountIds[0]!,
        finalRank: 1,
        dominion: 99_999,
        damageDealt: 0,
        damageTaken: 0,
        rivalName: null,
        biggestRaid: 0,
        title: 'Must stay private',
        recap: {
          commanderName: 'Must stay private',
          planetName: 'Must stay private',
          battles: 0,
          attacks: 0,
          defences: 0,
          rival: null,
          biggestRaid: null,
        },
        createdAt: nextStart,
      })
      .returning();

    const response = await app.inject({
      method: 'GET',
      url: `/api/season-archive/results/${frozen.publicId}`,
      headers: auth,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      selected: {
        resultId: string;
        ordinal: number;
        commanderName: string;
        rank: number;
        stats: null;
        averages: null;
      };
      career: {
        completedSeasons: number;
        bestRank: number;
        championships: number;
        podiums: number;
        topTen: number;
        totals: null;
        seasons: { resultId: string; ordinal: number; status: string }[];
      };
    }>();
    expect(body.selected).toMatchObject({
      resultId: frozen.publicId,
      ordinal: 1,
      commanderName: frozen.recap.commanderName,
      rank: frozen.finalRank,
      stats: null,
      averages: null,
    });
    expect(body.career).toMatchObject({
      completedSeasons: 1,
      bestRank: frozen.finalRank,
      championships: frozen.finalRank === 1 ? 1 : 0,
      podiums: 1,
      topTen: 1,
      totals: null,
    });
    expect(body.career.seasons).toEqual([
      expect.objectContaining({ resultId: frozen.publicId, ordinal: 1, status: 'frozen' }),
    ]);
    expect(response.body).not.toContain('Must stay private');
    expect(response.body).not.toContain(fixture.accountIds[0]!);

    const liveResponse = await app.inject({
      method: 'GET',
      url: `/api/season-archive/results/${liveResult!.publicId}`,
      headers: auth,
    });
    expect(liveResponse.statusCode).toBe(409);
    expect(liveResponse.json()).toEqual({
      error: 'SEASON_NOT_COMPLETE',
      message: 'That season is still live',
    });
  });

  it('derives cohort averages including inactive zeroes and excludes ineligible snapshots', async () => {
    await freeze();
    const ranked = await fixture.db
      .select()
      .from(seasonResults)
      .orderBy(asc(seasonResults.finalRank));
    const stats = (asteroidAlloy: number, battles: number) => ({
      version: 1 as const,
      competition: {
        battles,
        attacks: battles,
        defences: 0,
        damageDealt: battles * 100,
        damageTaken: 0,
        playerLoot: { alloy: battles * 10, crystal: 0, deuterium: 0 },
        shipsBuilt: battles * 2,
        shipsLost: battles,
        shipsBuiltByHull: { DART: battles * 2 },
        shipsLostByHull: { DART: battles },
      },
      economy: {
        produced: { alloy: battles * 1_000, crystal: 0, deuterium: 0 },
        productiveSeconds: battles * 3_600,
      },
      exploration: {
        asteroidRuns: battles,
        asteroidMined: { alloy: asteroidAlloy, crystal: 0, deuterium: 0 },
        convoyAttempts: battles,
        convoySuccesses: battles,
        convoyDelivered: { alloy: battles * 50, crystal: 0, deuterium: 0 },
      },
    });
    await fixture.db
      .update(seasonResults)
      .set({ statsVersion: 1, stats: stats(50_000, 2), averageEligible: true })
      .where(eq(seasonResults.publicId, ranked[0]!.publicId));
    await fixture.db
      .update(seasonResults)
      .set({ statsVersion: 1, stats: stats(0, 0), averageEligible: true })
      .where(eq(seasonResults.publicId, ranked[1]!.publicId));
    await fixture.db
      .update(seasonResults)
      .set({ statsVersion: 1, stats: stats(999_999, 99), averageEligible: false })
      .where(eq(seasonResults.publicId, ranked[2]!.publicId));

    const response = await app.inject({
      method: 'GET',
      url: `/api/season-archive/results/${ranked[0]!.publicId}`,
      headers: auth,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<{
      selected: {
        stats: ReturnType<typeof stats>;
        averages: {
          cohortSize: number;
          competition: { battles: number };
          exploration: { asteroidMined: { alloy: number } };
        };
      };
      career: { totals: { seasonsCovered: number; stats: ReturnType<typeof stats> } };
    }>();
    expect(body.selected.stats.exploration.asteroidMined.alloy).toBe(50_000);
    expect(body.selected.averages.cohortSize).toBe(2);
    expect(body.selected.averages.competition.battles).toBe(1);
    expect(body.selected.averages.exploration.asteroidMined.alloy).toBe(25_000);
    expect(body.career.totals.seasonsCovered).toBe(1);
    expect(body.career.totals.stats.exploration.asteroidMined.alloy).toBe(50_000);
  });

  it('seals complete v1 action and economy metrics before gameplay rows can be wiped', async () => {
    const playerId = fixture.playerIds[0]!;
    const planetId = fixture.planetIds[0]!;
    const [seasonBoundary] = await fixture.db
      .select({ endsAt: seasons.endsAt })
      .from(seasons)
      .where(eq(seasons.id, fixture.seasonId));
    if (!seasonBoundary) throw new Error('fixture season disappeared');
    await fixture.db
      .update(planets)
      .set({
        seasonTelemetry: {
          produced: { alloy: 12_000, crystal: 4_000, deuterium: 300 },
          productiveSeconds: 7_200,
          shipsBuilt: { DART: 7 },
        },
        statsOwnerPlayerId: playerId,
        lastTickAt: seasonBoundary.endsAt,
      })
      .where(eq(planets.id, planetId));
    await fixture.db.insert(miningRuns).values({
      seasonId: fixture.seasonId,
      planetId,
      ownerPlayerId: playerId,
      asteroidIndex: 9,
      status: 'done',
      craft: 2,
      holdEach: 1_000,
      interceptX: 1,
      interceptY: 2,
      interceptZ: 3,
      departAt: fixture.clock.now(),
      arriveAt: fixture.clock.now(),
      homeAt: fixture.clock.now(),
      minedAlloy: 3_000,
      minedCrystal: 900,
      minedDeuterium: 100,
    });

    const [existingOccurrence] = await fixture.db
      .select()
      .from(galaxyEventOccurrences)
      .where(eq(galaxyEventOccurrences.kind, 'INTERGALACTIC_CONVOY'));
    const [insertedOccurrence] = existingOccurrence ? [] : await fixture.db
      .insert(galaxyEventOccurrences)
      .values({
        seasonId: fixture.seasonId,
        sequence: 0,
        kind: 'INTERGALACTIC_CONVOY',
        definitionVersion: 1,
        startsAt: fixture.clock.now(),
        endsAt: new Date(fixture.clock.now().getTime() + 7_200_000),
        effect: {
          routeVersion: 1,
          formationVersion: 1,
          resourceCapHours: 1,
          fullRewardForceRatio: 1,
          shipDropFullFirepower: 1,
          shipDropChanceAtFullQuality: 0,
          shipCountWeights: [1, 0, 0],
          shipTierWeights: [1, 0, 0, 0],
          rewardPoolVersion: 1,
        },
      })
      .returning();
    const occurrence = existingOccurrence ?? insertedOccurrence;
    if (!occurrence) throw new Error('could not arrange convoy occurrence');
    const departAt = fixture.clock.now();
    const arriveAt = new Date(departAt.getTime() + 10_000);
    const engagementEndsAt = new Date(arriveAt.getTime() + 5_000);
    const homeAt = new Date(engagementEndsAt.getTime() + 10_000);
    await fixture.db.insert(intergalacticConvoyRuns).values({
      seasonId: fixture.seasonId,
      occurrenceId: occurrence.id,
      planetId,
      ownerPlayerId: playerId,
      status: 'done',
      fleet: { DART: 2 },
      tech: {},
      interceptX: 1,
      interceptY: 2,
      interceptZ: 3,
      engagementEndX: 2,
      engagementEndY: 3,
      engagementEndZ: 4,
      returnX: 0,
      returnY: 0,
      returnZ: 0,
      departAt,
      arriveAt,
      engagementEndsAt,
      homeAt,
      productionCap: { alloy: 500, crystal: 200, deuterium: 20 },
      resourceQualityFactor: 1,
      shipQualityFactor: 0,
      quotedResourceReward: { alloy: 500, crystal: 200, deuterium: 20 },
      resourceReward: { alloy: 450, crystal: 180, deuterium: 20 },
      awardedFleet: {},
    });

    const [mission] = await fixture.db.insert(missions).values({
      seasonId: fixture.seasonId,
      kind: 'attack',
      status: 'resolved',
      ownerPlayerId: playerId,
      originPlanetId: planetId,
      targetPlanetId: fixture.planetIds[1]!,
      fleet: { DART: 5 },
      distance: 150,
      departAt: fixture.clock.now(),
      arriveAt: fixture.clock.now(),
    }).returning();
    await fixture.db.insert(battleReports).values({
      seasonId: fixture.seasonId,
      missionId: mission!.id,
      attackerPlayerId: playerId,
      defenderPlayerId: fixture.playerIds[1]!,
      targetPlanetId: fixture.planetIds[1]!,
      targetKind: 'PLAYER',
      grade: 'DECISIVE',
      rounds: [],
      loot: { alloy: 800, crystal: 200, deuterium: 25 },
      attackerLosses: { DART: 2 },
      defenderLosses: { DART: 3 },
    });

    await freeze();
    const [result] = await fixture.db
      .select()
      .from(seasonResults)
      .where(eq(seasonResults.accountId, fixture.accountIds[0]!));

    expect(result?.statsVersion).toBe(1);
    expect(result?.stats).toMatchObject({
      competition: {
        battles: 1,
        attacks: 1,
        defences: 0,
        playerLoot: { alloy: 800, crystal: 200, deuterium: 25 },
        shipsBuilt: 7,
        shipsLost: 2,
        shipsBuiltByHull: { DART: 7 },
        shipsLostByHull: { DART: 2 },
      },
      economy: {
        produced: { alloy: 12_000, crystal: 4_000, deuterium: 300 },
        productiveSeconds: 7_200,
      },
      exploration: {
        asteroidRuns: 1,
        asteroidMined: { alloy: 3_000, crystal: 900, deuterium: 100 },
        convoyAttempts: 1,
        convoySuccesses: 1,
        convoyDelivered: { alloy: 450, crystal: 180, deuterium: 20 },
      },
    });

    const profile = await app.inject({
      method: 'GET',
      url: `/api/season-archive/results/${result!.publicId}`,
      headers: auth,
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json<{ selected: { averages: { cohortSize: number; exploration: { asteroidMined: { alloy: number } } } } }>()
      .selected.averages).toMatchObject({
        cohortSize: 3,
        exploration: { asteroidMined: { alloy: 1_000 } },
      });
  });

  it('keeps each commander production with its actor when a colony changes control', async () => {
    const [boundary] = await fixture.db
      .select({ endsAt: seasons.endsAt })
      .from(seasons)
      .where(eq(seasons.id, fixture.seasonId));
    if (!boundary) throw new Error('fixture season disappeared');
    await fixture.db.update(planets).set({ lastTickAt: boundary.endsAt }).where(inArray(
      planets.id,
      [fixture.planetIds[0]!, fixture.planetIds[1]!],
    ));
    const [neutral] = await fixture.db.insert(planets).values({
      seasonId: fixture.seasonId,
      kind: 'NEUTRAL',
      name: 'Transfer Ledger',
      slotIndex: 30_000,
      x: 30_000,
      y: 0,
      z: 0,
      lastTickAt: fixture.clock.now(),
    }).returning({ id: planets.id });
    if (!neutral) throw new Error('could not arrange neutral colony');

    await fixture.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: neutral.id,
      newPlayerId: fixture.playerIds[0]!,
      expectedControllerPlayerId: null,
      now: fixture.clock.now(),
      protectedUntil: fixture.clock.now(),
    }));
    await fixture.db.update(planets).set({
      seasonTelemetry: {
        produced: { alloy: 1_000, crystal: 300, deuterium: 20 },
        productiveSeconds: 3_600,
        shipsBuilt: { DART: 2 },
      },
    }).where(eq(planets.id, neutral.id));

    await fixture.db.transaction((tx) => transferPlanetControl(tx, {
      targetPlanetId: neutral.id,
      newPlayerId: fixture.playerIds[1]!,
      expectedControllerPlayerId: fixture.playerIds[0]!,
      now: fixture.clock.now(),
      protectedUntil: fixture.clock.now(),
    }));
    await fixture.db.update(planets).set({
      seasonTelemetry: {
        produced: { alloy: 200, crystal: 60, deuterium: 5 },
        productiveSeconds: 900,
        shipsBuilt: { PIKE: 1 },
      },
    }).where(eq(planets.id, neutral.id));

    await freeze();
    const results = await fixture.db
      .select({ accountId: seasonResults.accountId, stats: seasonResults.stats })
      .from(seasonResults);
    const former = results.find((row) => row.accountId === fixture.accountIds[0]);
    const current = results.find((row) => row.accountId === fixture.accountIds[1]);

    expect(former?.stats?.economy.produced).toEqual({ alloy: 1_000, crystal: 300, deuterium: 20 });
    expect(former?.stats?.economy.productiveSeconds).toBe(3_600);
    expect(former?.stats?.competition.shipsBuiltByHull).toEqual({ DART: 2 });
    expect(current?.stats?.economy.produced).toEqual({ alloy: 200, crystal: 60, deuterium: 5 });
    expect(current?.stats?.economy.productiveSeconds).toBe(900);
    expect(current?.stats?.competition.shipsBuiltByHull).toEqual({ PIKE: 1 });
  });

  /**
   * A HAND-OVER THAT BYPASSED `transferPlanetControl` IS REPAIRED, NEVER FATAL.
   *
   * The conquest path is the only writer that moves `player_id` AND closes the
   * telemetry segment in one statement. Everything else that can move it — an
   * operator's SQL, the `grant-colony`/`expand-eu1-planets` CLIs, a future writer
   * — leaves the counter pointing at a commander who no longer holds the world.
   *
   * THE ANSWER MUST NOT BE AN EXCEPTION. `loadLocked` is the gate every screen,
   * launch and worker tick passes through: throwing there does not lose a season
   * metric, it takes the world off the board for everybody until somebody reads a
   * log — the D47 outage shape. So the next advance closes the former actor's
   * figures into a segment and restarts the counter, and the world keeps playing.
   */
  it('repairs a telemetry actor left behind by a control change, rather than refusing the world', async () => {
    const planetId = fixture.planetIds[0]!;
    const former = fixture.playerIds[0]!;
    const current = fixture.playerIds[1]!;
    fixture.clock.advance(60);
    await fixture.db.transaction((tx) => planetView(tx, planetId, fixture.clock));
    const [carried] = await fixture.db
      .select({ telemetry: planets.seasonTelemetry })
      .from(planets)
      .where(eq(planets.id, planetId));
    expect(carried?.telemetry.produced.alloy, 'the fixture produced nothing to hand over')
      .toBeGreaterThan(0);

    // The control change nobody taught about the counter: `player_id` moves and
    // `stats_owner_player_id` is left behind.
    await fixture.db
      .update(planets)
      .set({ controllerPlayerId: current, kind: 'COLONY' })
      .where(eq(planets.id, planetId));

    // Half the first interval, so "the counter restarted" is readable in the
    // figure itself rather than inferred from two equal numbers.
    fixture.clock.advance(30);
    await expect(
      fixture.db.transaction((tx) => planetView(tx, planetId, fixture.clock)),
    ).resolves.toBeDefined();

    const segments = await fixture.db
      .select()
      .from(seasonTelemetrySegments)
      .where(eq(seasonTelemetrySegments.sourcePlanetId, planetId));
    expect(segments).toHaveLength(1);
    expect(segments[0]?.playerId).toBe(former);
    expect(segments[0]?.telemetry.produced).toEqual(carried?.telemetry.produced);

    const [after] = await fixture.db
      .select({
        actor: planets.statsOwnerPlayerId,
        telemetry: planets.seasonTelemetry,
      })
      .from(planets)
      .where(eq(planets.id, planetId));
    expect(after?.actor).toBe(current);
    // The counter restarted: what it holds is exactly the half-hour since the
    // hand-over, never the former commander's hour carried forward into it.
    expect(after?.telemetry.produced.alloy)
      .toBeCloseTo(carried!.telemetry.produced.alloy / 2, 6);

    // And it settles: a second advance under the same controller closes nothing.
    fixture.clock.advance(60);
    await fixture.db.transaction((tx) => planetView(tx, planetId, fixture.clock));
    expect(await fixture.db
      .select()
      .from(seasonTelemetrySegments)
      .where(eq(seasonTelemetrySegments.sourcePlanetId, planetId))).toHaveLength(1);
  });

  it('counts only time in which the Works actually produced and stays idempotent at one instant', async () => {
    const planetId = fixture.planetIds[0]!;
    fixture.clock.advance(60);
    await fixture.db.transaction((tx) => planetView(tx, planetId, fixture.clock));
    const [first] = await fixture.db.select().from(planets).where(eq(planets.id, planetId));
    expect(first!.seasonTelemetry.productiveSeconds).toBeCloseTo(3_600, 6);
    expect(first!.seasonTelemetry.produced.alloy).toBeGreaterThan(0);
    expect(first!.seasonTelemetry.produced.crystal).toBeGreaterThan(0);

    await fixture.db.transaction((tx) => planetView(tx, planetId, fixture.clock));
    const [second] = await fixture.db.select().from(planets).where(eq(planets.id, planetId));
    expect(second!.seasonTelemetry).toEqual(first!.seasonTelemetry);
  });

  it('does not count disruption as productive time', async () => {
    const planetId = fixture.planetIds[0]!;
    const disruptedUntil = new Date(fixture.clock.now().getTime() + 60 * 60_000);
    await fixture.db.update(planets).set({ disruptedUntil }).where(eq(planets.id, planetId));
    fixture.clock.set(disruptedUntil);
    await fixture.db.transaction((tx) => planetView(tx, planetId, fixture.clock));
    const [after] = await fixture.db.select().from(planets).where(eq(planets.id, planetId));
    expect(after!.seasonTelemetry).toMatchObject({
      produced: { alloy: 0, crystal: 0, deuterium: 0 },
      productiveSeconds: 0,
    });
  });

  it('does not count time after every active Works lane has reached its collector cap', async () => {
    const planetId = fixture.planetIds[0]!;
    await fixture.db.update(planets).set({
      bufferAlloy: collectorCap(alloyRate(1)),
      bufferCrystal: collectorCap(crystalRate(1)),
      seasonTelemetry: {
        produced: { alloy: 0, crystal: 0, deuterium: 0 },
        productiveSeconds: 0,
        shipsBuilt: {},
      },
    }).where(eq(planets.id, planetId));
    fixture.clock.advance(60);

    await fixture.db.transaction((tx) => planetView(tx, planetId, fixture.clock));

    const [after] = await fixture.db.select().from(planets).where(eq(planets.id, planetId));
    expect(after!.seasonTelemetry).toMatchObject({
      produced: { alloy: 0, crystal: 0, deuterium: 0 },
      productiveSeconds: 0,
    });
  });

  it('never records production beyond the season boundary even if freeze is claimed late', async () => {
    const planetId = fixture.planetIds[0]!;
    const [season] = await fixture.db
      .select({ endsAt: seasons.endsAt })
      .from(seasons)
      .where(eq(seasons.id, fixture.seasonId));
    if (!season) throw new Error('fixture season disappeared');
    await fixture.db.update(planets).set({
      bufferAlloy: 0,
      bufferCrystal: 0,
      bufferDeuterium: 0,
      lastTickAt: season.endsAt,
      seasonTelemetry: {
        produced: { alloy: 0, crystal: 0, deuterium: 0 },
        productiveSeconds: 0,
        shipsBuilt: {},
      },
    }).where(eq(planets.id, planetId));
    fixture.clock.set(new Date(season.endsAt.getTime() + 60 * 60_000));

    await fixture.db.transaction((tx) => planetView(tx, planetId, fixture.clock));

    const [after] = await fixture.db.select().from(planets).where(eq(planets.id, planetId));
    expect(after!.lastTickAt).toEqual(season.endsAt);
    expect(after!.seasonTelemetry).toMatchObject({
      produced: { alloy: 0, crystal: 0, deuterium: 0 },
      productiveSeconds: 0,
    });
  });
});
