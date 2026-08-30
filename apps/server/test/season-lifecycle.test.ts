import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { SERVERS } from '@astera/rules';
import {
  scheduledEvents,
  seasonResults,
  seasons,
  players,
  missions,
  accounts,
  buildOrders,
  shards,
  units,
  strategicImpacts,
} from '../src/db/schema.js';
import { buildUnits, upgradeBuilding } from '../src/services/build.js';
import { launchProbe } from '../src/services/intel.js';
import { planetView } from '../src/services/planetView.js';
import { rewardsView } from '../src/services/rewards.js';
import { latestSeasonResult } from '../src/services/season.js';
import { onBuildComplete, onSeasonEnd, onSeasonRollover } from '../src/worker/handlers.js';
import {
  seedWorld,
  grant,
  testDb,
  type Fixture,
} from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('season lifecycle', () => {
  let f: Fixture;

  beforeEach(async () => {
    f = await seedWorld(3);
  });

  const seasonEndEvent = async () => {
    const [event] = await f.db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'season_end'));
    if (!event) throw new Error('fixture season has no season_end event');
    return event;
  };

  const rolloverEvent = async () => {
    const [event] = await f.db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'season_rollover'));
    if (!event) throw new Error('fixture season has no season_rollover event');
    return event;
  };

  it('creates exactly one end event at the season deadline', async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const events = await f.db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'season_end'));

    expect(events).toHaveLength(1);
    expect(events[0]!.seasonId).toBe(f.seasonId);
    expect(events[0]!.refId).toBe(f.seasonId);
    expect(events[0]!.resolveAt.getTime()).toBe(season!.endsAt.getTime());

    const rollover = await rolloverEvent();
    expect(rollover.seasonId).toBe(f.seasonId);
    expect(rollover.resolveAt.getTime() - season!.endsAt.getTime()).toBe(5 * 60_000);
  });

  it('freezes atomically, writes stable ranks and stays idempotent', async () => {
    await f.db.update(players).set({ dominionTaken: 300 }).where(eq(players.id, f.playerIds[0]!));
    await f.db.update(players).set({ dominionTaken: 100 }).where(eq(players.id, f.playerIds[1]!));
    await f.db.update(players).set({ dominionLost: 50 }).where(eq(players.id, f.playerIds[2]!));
    const [strike] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'death_star',
      status: 'resolved',
      ownerPlayerId: f.playerIds[0]!,
      originPlanetId: f.planetIds[0]!,
      targetPlanetId: f.planetIds[1]!,
      fleet: {},
      distance: 100,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
    }).returning();
    await f.db.insert(strategicImpacts).values({
      seasonId: f.seasonId,
      missionId: strike!.id,
      attackerPlayerId: f.playerIds[0]!,
      defenderPlayerId: f.playerIds[1]!,
      targetPlanetId: f.planetIds[1]!,
      outcome: 'FIRST_STRIKE',
      damage: 12_345,
      destroyedFleet: {},
      createdAt: f.clock.now(),
    });
    const event = await seasonEndEvent();
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    f.clock.set(season!.endsAt);

    await onSeasonEnd({ db: f.db, clock: f.clock }, event);
    await onSeasonEnd({ db: f.db, clock: f.clock }, event);

    const [after] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const results = await f.db
      .select()
      .from(seasonResults)
      .where(eq(seasonResults.seasonId, f.seasonId))
      .orderBy(asc(seasonResults.finalRank));
    expect(after!.status).toBe('frozen');
    expect(results).toHaveLength(3);
    expect(results.map((row) => row.dominion)).toEqual([300, 100, -50]);
    expect(results.map((row) => row.finalRank)).toEqual([1, 2, 3]);
    expect(results[0]!.title).toContain('Sovereign');
    expect(results[0]!.damageDealt).toBe(12_345);
    expect(results[1]!.damageTaken).toBe(12_345);
    expect(results[0]!.recap.commanderName).toBeTruthy();

    const latest = await latestSeasonResult(f.db, results[0]!.accountId);
    expect(latest).toMatchObject({
      seasonId: f.seasonId,
      finalRank: 1,
      shard: 'EU-TEST-4242',
    });
    expect(latest?.shardName).toBeTruthy();
  });

  it('keeps a frozen galaxy readable but refuses further mutation', async () => {
    const event = await seasonEndEvent();
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    f.clock.set(season!.endsAt);
    await onSeasonEnd({ db: f.db, clock: f.clock }, event);

    await expect(f.db.transaction((tx) => planetView(tx, f.planetIds[0]!, f.clock)))
      .resolves.toBeTruthy();
    await expect(rewardsView(f.db, f.planetIds[0]!, f.clock)).resolves.toBeTruthy();
    await expect(upgradeBuilding(f.db, f.planetIds[0]!, 'CORE', f.clock))
      .rejects.toMatchObject({ code: 'SEASON_FROZEN' });
  });

  it('refuses a new round trip that would cross the deadline', async () => {
    const origin = f.planetIds[0]!;
    const target = f.planetIds[1]!;
    await grant(f.db, origin, 100_000, 20_000);
    await f.db
      .update(seasons)
      .set({ endsAt: new Date(f.clock.now().getTime() + 1_000) })
      .where(eq(seasons.id, f.seasonId));

    await expect(launchProbe(f.db, origin, target, f.clock))
      .rejects.toMatchObject({ code: 'SEASON_ENDS_BEFORE_RETURN' });
  });

  it('postpones freeze while a committed fleet still exists', async () => {
    const origin = f.planetIds[0]!;
    const target = f.planetIds[1]!;
    await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'attack',
      ownerPlayerId: f.playerIds[0]!,
      originPlanetId: origin,
      targetPlanetId: target,
      fleet: { WASP: 20 },
      distance: 100,
      departAt: f.clock.now(),
      arriveAt: new Date(f.clock.now().getTime() + 60_000),
    });

    const event = await seasonEndEvent();
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    f.clock.set(season!.endsAt);
    await onSeasonEnd({ db: f.db, clock: f.clock }, event);

    const [after] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const replacement = await seasonEndEvent();
    expect(after!.status).toBe('live');
    expect(replacement.id).not.toBe(event.id);
    expect(replacement.resolveAt.getTime()).toBe(f.clock.now().getTime() + 1_000);
  });

  it('lets a committed build settle before freezing the season', async () => {
    const planetId = f.planetIds[0]!;
    await buildUnits(f.db, planetId, 'WASP', 1, f.clock);
    const [order] = await f.db.select().from(buildOrders).where(eq(buildOrders.planetId, planetId));
    const original = await seasonEndEvent();
    await f.db.update(seasons).set({ endsAt: order!.readyAt }).where(eq(seasons.id, f.seasonId));
    f.clock.set(order!.readyAt);

    await onSeasonEnd({ db: f.db, clock: f.clock }, original);

    const [stillLive] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const replacement = await seasonEndEvent();
    expect(stillLive?.status).toBe('live');
    expect(replacement.id).not.toBe(original.id);

    const [completion] = await f.db
      .select()
      .from(scheduledEvents)
      .where(eq(scheduledEvents.kind, 'build_complete'));
    await onBuildComplete({ db: f.db, clock: f.clock }, completion!);
    f.clock.set(replacement.resolveAt);
    await onSeasonEnd({ db: f.db, clock: f.clock }, replacement);

    const [frozen] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const [wasps] = await f.db
      .select()
      .from(units)
      .where(eq(units.planetId, planetId));
    expect(frozen?.status).toBe('frozen');
    expect(wasps).toMatchObject({ hull: 'WASP', count: 1 });
  });

  it('waits for every snapshot, then wipes and opens successors atomically', async () => {
    const original = await rolloverEvent();
    f.clock.set(original.resolveAt);
    await onSeasonRollover({ db: f.db, clock: f.clock }, original);

    const replacement = await rolloverEvent();
    expect(replacement.id).not.toBe(original.id);
    expect(replacement.resolveAt.getTime()).toBe(f.clock.now().getTime() + 1_000);

    const end = await seasonEndEvent();
    await onSeasonEnd({ db: f.db, clock: f.clock }, end);
    f.clock.set(replacement.resolveAt);
    await Promise.all([
      onSeasonRollover({ db: f.db, clock: f.clock }, replacement),
      onSeasonRollover({ db: f.db, clock: f.clock }, replacement),
    ]);

    const [old] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const live = await f.db
      .select({ season: seasons, shard: shards })
      .from(seasons)
      .innerJoin(shards, eq(seasons.shardId, shards.id))
      .where(eq(seasons.status, 'live'));
    expect(old!.status).toBe('wiped');
    expect(await f.db.select().from(players)).toHaveLength(0);
    expect(live).toHaveLength(2);
    expect(live.map(({ shard }) => shard.ordinal).sort()).toEqual([1, 2]);
    expect(live.every(({ shard }) => shard.playerCap === SERVERS.capacity)).toBe(true);
    expect(await latestSeasonResult(f.db, f.accountIds[0]!)).toBeTruthy();
    const [account] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[0]!));
    expect(account?.lifetime.seasons).toBe(1);
  });
});
