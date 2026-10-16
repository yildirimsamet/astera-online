import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { PLANET_START } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { honorTotals, planets, scheduledEvents, seasonRewardEntitlements, seasons } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { joinSeason } from '../src/services/player.js';
import { deliveredSeasonRankReward } from '../src/services/seasonRankRewards.js';
import { forceSeasonEnd, onSeasonRollover } from '../src/worker/handlers.js';
import { placementSchema, seasonSchema } from '../../web/src/api/schemas.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

describe('delivered Honor prize is a readable receipt, paid only once', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(2, 7769); });
  afterAll(async () => { await (await testDb()).close(); });
  it('carries the Honor ranking through a real rollover, concurrent joins and the current season contract', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: 200_000_000 });
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.seasonId, f.seasonId), eq(scheduledEvents.kind, 'season_rollover')));
    f.clock.set(event!.resolveAt);
    await onSeasonRollover({ db: f.db, clock: f.clock }, event!);
    const [entitlement] = await f.db.select().from(seasonRewardEntitlements).where(eq(seasonRewardEntitlements.accountId, f.accountIds[0]!));
    const [next] = await f.db.select().from(seasons).where(eq(seasons.cycleId, entitlement!.targetCycleId!));
    expect(await deliveredSeasonRankReward(f.db, f.accountIds[0]!, next!.id)).toBeNull();
    const [joined, retry] = await Promise.all([joinSeason(f.db, f.accountIds[0]!, next!.id, f.clock),
      joinSeason(f.db, f.accountIds[0]!, next!.id, f.clock)]);
    expect(joined.seasonReward).toMatchObject({ ranking: 'HONOR', displayRank: 1, alloy: 4000, crystal: 3000, deuterium: 600 });
    expect(retry.seasonReward).toEqual(joined.seasonReward);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, joined.planetId));
    expect(world).toMatchObject({ alloy: PLANET_START.alloy + 4000, crystal: PLANET_START.crystal + 3000, deuterium: PLANET_START.deuterium + 600 });
    const parsedPlacement = placementSchema.parse({ ...joined, shard: 'EU-1', shardName: 'Galaxy', planetName: 'World' });
    expect(parsedPlacement.seasonReward).toMatchObject({ ranking: 'HONOR', alloy: 4000 });
    const { app, close } = buildApp({ db: f.db, clock: f.clock, env: testEnv(), logger: pino({ level: 'silent' }) });
    try {
      const authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`;
      const result = await app.inject({ url: '/api/season', headers: { authorization } });
      expect(result.statusCode).toBe(200);
      expect(seasonSchema.parse(result.json()).seasonReward).toEqual(joined.seasonReward);
      await joinSeason(f.db, f.accountIds[1]!, next!.id, f.clock);
      const otherAuthorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[1]!)}`;
      const other = await app.inject({ url: '/api/season', headers: { authorization: otherAuthorization } });
      expect(other.statusCode).toBe(200);
      expect(seasonSchema.parse(other.json()).seasonReward).toBeNull();
      expect(await deliveredSeasonRankReward(f.db, f.accountIds[0]!, f.seasonId)).toBeNull();
    } finally { await close(); }
  });
});
