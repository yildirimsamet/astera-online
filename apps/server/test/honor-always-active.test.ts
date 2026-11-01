import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HONOR_LAUNCH_VERSION } from '@astera/rules';
import { honorObservations, honorSeasons, honorTotals, seasons, shards } from '../src/db/schema.js';
import { ensureMainHonorRankings } from '../src/services/honorActivation.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { createSeason } from '../src/services/season.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

describe('Honor is always active in competitive galaxies', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(2, 7841); });
  afterAll(async () => { await (await testDb()).close(); });

  it('starts a new main season with ranked Honor without an inherited announcement', async () => {
    const created = await createSeason(f.db, { shardCode: 'ALWAYS-HONOR', seed: 7842, startsAt: f.clock.now() });
    const [config] = await f.db.select().from(honorSeasons).where(eq(honorSeasons.seasonId, created.season.id));
    expect(config).toMatchObject({ mode: 'ACTIVE', version: HONOR_LAUNCH_VERSION, rankedAt: f.clock.now() });
  });

  it('opens an existing unconfigured season at the real current boundary and is safe across simultaneous boots', async () => {
    f.clock.advance(60);
    await Promise.all([ensureMainHonorRankings(f.db, f.clock), ensureMainHonorRankings(f.db, f.clock)]);
    const configs = await f.db.select().from(honorSeasons);
    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({ seasonId: f.seasonId, mode: 'ACTIVE', version: HONOR_LAUNCH_VERSION,
      createdAt: f.clock.now(), rankedAt: f.clock.now() });
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
    const before = configs[0];
    await ensureMainHonorRankings(f.db, f.clock);
    expect((await f.db.select().from(honorSeasons))[0]).toEqual(before);
  });

  it('uses one opening instant even when the real clock advances during initialization', async () => {
    let calls = 0;
    const started = f.clock.now().getTime();
    const movingClock = { now: () => new Date(started + ++calls) };
    await ensureMainHonorRankings(f.db, movingClock);
    expect((await f.db.select().from(honorSeasons))[0]?.mode).toBe('ACTIVE');
  });

  it('opens an existing shadow race without a separate observation waiting period', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
    f.clock.advance(1);
    await ensureMainHonorRankings(f.db, f.clock);
    expect((await f.db.select().from(honorSeasons))[0]).toMatchObject({ mode: 'ACTIVE', rankedAt: f.clock.now() });
  });

  it('takes a real opening sample for legacy shadow commanders with missing inventory history', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
    await f.db.delete(honorObservations).where(eq(honorObservations.playerId, f.playerIds[1]!));
    f.clock.advance(60);
    const opening = f.clock.now();
    await ensureMainHonorRankings(f.db, f.clock);
    expect((await f.db.select().from(honorSeasons))[0]).toMatchObject({ mode: 'ACTIVE', rankedAt: opening });
    const samples = await f.db.select().from(honorObservations)
      .where(eq(honorObservations.playerId, f.playerIds[1]!));
    expect(samples).toHaveLength(1);
    expect(samples[0]?.at).toEqual(opening);
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
  });

  it('keeps an already active race, its frozen policy, boundary and earned points intact', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: 1_234_567 });
    const before = await f.db.select().from(honorSeasons);
    f.clock.advance(60);
    await ensureMainHonorRankings(f.db, f.clock);
    expect(await f.db.select().from(honorSeasons)).toEqual(before);
    expect((await f.db.select().from(honorTotals))[0]?.score).toBe(1_234_567);
  });

  it('does not turn Silent Space or closed/future seasons into competitive races', async () => {
    await f.db.update(shards).set({ role: 'WAITING' });
    const waiting = await createSeason(f.db, { shardCode: 'WAITING-HONOR', role: 'WAITING', seed: 7843, startsAt: f.clock.now() });
    const future = await createSeason(f.db, { shardCode: 'FUTURE-HONOR', seed: 7844, startsAt: new Date(f.clock.now().getTime() + 60_000) });
    await f.db.delete(honorSeasons).where(eq(honorSeasons.seasonId, future.season.id));
    await ensureMainHonorRankings(f.db, f.clock);
    expect(await f.db.select().from(honorSeasons)).toHaveLength(0);
    await f.db.update(shards).set({ role: 'MAIN' }).where(eq(shards.id, waiting.shard.id));
    await f.db.update(seasons).set({ status: 'frozen', closedAt: f.clock.now(), endReason: 'SCHEDULED_END' }).where(eq(seasons.id, waiting.season.id));
    await ensureMainHonorRankings(f.db, f.clock);
    expect(await f.db.select().from(honorSeasons).where(and(eq(honorSeasons.seasonId, waiting.season.id), eq(honorSeasons.mode, 'ACTIVE')))).toHaveLength(0);
  });
});
