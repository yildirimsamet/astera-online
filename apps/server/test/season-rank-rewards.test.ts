import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { and, asc, eq } from 'drizzle-orm';
import { PLANET_START } from '@astera/rules';
import {
  botProfiles,
  planets,
  players,
  scheduledEvents,
  seasonCycles,
  seasonResults,
  seasonRewardEntitlements,
  seasons,
  shards,
} from '../src/db/schema.js';
import { joinSeason } from '../src/services/player.js';
import { wipeAllServers } from '../src/services/servers.js';
import { onSeasonEnd, onSeasonRollover } from '../src/worker/handlers.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

describe('next-season Dominion rewards', () => {
  let f: Fixture;

  beforeEach(async () => {
    f = await seedWorld(4, 7719);
  });

  afterAll(async () => {
    const { close } = await testDb();
    await close();
  });

  const eventOf = async (kind: 'season_end' | 'season_rollover') => {
    const [event] = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, f.seasonId),
      eq(scheduledEvents.kind, kind),
    ));
    if (!event) throw new Error(`fixture has no ${kind} event`);
    return event;
  };

  const freeze = async () => {
    const event = await eventOf('season_end');
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    if (!season) throw new Error('fixture season disappeared');
    f.clock.set(season.endsAt);
    await onSeasonEnd({ db: f.db, clock: f.clock }, event);
    return event;
  };

  it('skips bots and all-zero commanders without rewriting the displayed final rank', async () => {
    await f.db.insert(botProfiles).values({
      accountId: f.accountIds[0]!,
      ordinal: 0,
      persona: 'RAIDER',
      nextActionAt: f.clock.now(),
      createdAt: f.clock.now(),
    });
    await f.db.update(players).set({ dominionTaken: 1_000 })
      .where(eq(players.id, f.playerIds[0]!));
    await f.db.update(players).set({ dominionTaken: 900 })
      .where(eq(players.id, f.playerIds[1]!));
    await f.db.update(players).set({ dominionTaken: 500 })
      .where(eq(players.id, f.playerIds[2]!));

    const event = await freeze();
    await onSeasonEnd({ db: f.db, clock: f.clock }, event);

    const results = await f.db.select().from(seasonResults)
      .orderBy(asc(seasonResults.finalRank));
    expect(results.map((row) => [row.finalRank, row.accountId])).toEqual([
      [1, f.accountIds[0]],
      [2, f.accountIds[1]],
      [3, f.accountIds[2]],
      [4, f.accountIds[3]],
    ]);

    const rewards = await f.db.select().from(seasonRewardEntitlements)
      .orderBy(asc(seasonRewardEntitlements.rewardPlace));
    expect(rewards).toHaveLength(2);
    expect(rewards[0]).toMatchObject({
      accountId: f.accountIds[1],
      displayRank: 2,
      rewardPlace: 1,
      alloy: 2_000,
      crystal: 1_500,
      deuterium: 300,
      programVersion: 1,
      status: 'PENDING',
    });
    expect(rewards[1]).toMatchObject({
      accountId: f.accountIds[2],
      displayRank: 3,
      rewardPlace: 2,
      alloy: 1_750,
      crystal: 1_250,
      deuterium: 250,
      programVersion: 1,
      status: 'PENDING',
    });
  });

  it('does not create rank rewards for a Silent Space season', async () => {
    await f.db.update(shards).set({ role: 'WAITING' });
    await f.db.update(players).set({ dominionTaken: 1_000 })
      .where(eq(players.id, f.playerIds[0]!));

    await freeze();

    expect(await f.db.select().from(seasonRewardEntitlements)).toHaveLength(0);
  });

  it('binds the entitlement to the immediate successor and pays concurrent joins exactly once', async () => {
    await f.db.update(players).set({ dominionTaken: 700 })
      .where(eq(players.id, f.playerIds[0]!));
    await freeze();
    const rollover = await eventOf('season_rollover');
    f.clock.set(rollover.resolveAt);
    await onSeasonRollover({ db: f.db, clock: f.clock }, rollover);

    const [targetCycle] = await f.db.select().from(seasonCycles)
      .where(eq(seasonCycles.ordinal, 2));
    const [targetSeason] = await f.db
      .select({ id: seasons.id })
      .from(seasons)
      .innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(and(eq(seasons.cycleId, targetCycle!.id), eq(shards.code, 'EU-1')));
    const [bound] = await f.db.select().from(seasonRewardEntitlements)
      .where(eq(seasonRewardEntitlements.accountId, f.accountIds[0]!));
    expect(bound).toMatchObject({ targetCycleId: targetCycle!.id, status: 'PENDING' });

    const [first, retry] = await Promise.all([
      joinSeason(f.db, f.accountIds[0]!, targetSeason!.id, f.clock),
      joinSeason(f.db, f.accountIds[0]!, targetSeason!.id, f.clock),
    ]);
    expect(first.planetId).toBe(retry.planetId);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, first.planetId));
    expect(world).toMatchObject({
      alloy: PLANET_START.alloy + 2_000,
      crystal: PLANET_START.crystal + 1_500,
      deuterium: PLANET_START.deuterium + 300,
    });
    const [delivered] = await f.db.select().from(seasonRewardEntitlements)
      .where(eq(seasonRewardEntitlements.accountId, f.accountIds[0]!));
    expect(delivered).toMatchObject({
      targetCycleId: targetCycle!.id,
      deliveredSeasonId: targetSeason!.id,
      status: 'DELIVERED',
    });
    expect(delivered?.deliveredAt).toEqual(f.clock.now());
  });

  it('expires an unclaimed entitlement when its immediate successor cycle ends', async () => {
    await f.db.update(players).set({ dominionTaken: 700 })
      .where(eq(players.id, f.playerIds[0]!));
    await freeze();
    const rollover = await eventOf('season_rollover');
    f.clock.set(rollover.resolveAt);
    await onSeasonRollover({ db: f.db, clock: f.clock }, rollover);

    const [targetCycle] = await f.db.select().from(seasonCycles)
      .where(eq(seasonCycles.ordinal, 2));
    f.clock.set(targetCycle!.endsAt);
    await wipeAllServers(f.db, f.clock, { count: 2, seedBase: 9900 });

    const [expired] = await f.db.select().from(seasonRewardEntitlements)
      .where(eq(seasonRewardEntitlements.accountId, f.accountIds[0]!));
    expect(expired).toMatchObject({ targetCycleId: targetCycle!.id, status: 'EXPIRED' });
    expect(expired?.expiredAt).toEqual(f.clock.now());

    const [thirdCycle] = await f.db.select().from(seasonCycles)
      .where(eq(seasonCycles.ordinal, 3));
    const [thirdSeason] = await f.db
      .select({ id: seasons.id })
      .from(seasons)
      .innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(and(eq(seasons.cycleId, thirdCycle!.id), eq(shards.code, 'EU-1')));
    const joined = await joinSeason(f.db, f.accountIds[0]!, thirdSeason!.id, f.clock);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, joined.planetId));
    expect(world).toMatchObject(PLANET_START);
  });
});
