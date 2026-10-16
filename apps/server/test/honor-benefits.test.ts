import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorBenefits, honorRepairResources, repairPct, shipHpRepairCost, shipHpRepairMinutes } from '@astera/rules';
import { buildOrders, honorSeasons, honorTotals, planets, seasons } from '../src/db/schema.js';
import { enableHonorBenefits, readHonorBenefits } from '../src/services/honorBenefits.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { planetView } from '../src/services/planetView.js';
import { startRepair } from '../src/services/repair.js';
import { cancelBuildOrder } from '../src/services/buildQueue.js';
import { giveResearch, grant, landAndDockShips, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';
import { testEnv } from './helpers.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { pino } from 'pino';
import { leaderboardSchema, planetSchema } from '../../web/src/api/schemas.js';

const thresholds = { positive: [25_000_000, 75_000_000], negative: [25_000_000, 100_000_000] } as const;
describe('explicit season Honor benefits and authoritative repairs', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(2); });
  afterAll(async () => { await (await testDb()).close(); });
  const prepare = () => f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  const score = async (value: number) => { await f.db.insert(honorTotals).values({ seasonId: f.seasonId,
    playerId: f.playerIds[0]!, score: value }).onConflictDoUpdate({ target: [honorTotals.seasonId, honorTotals.playerId], set: { score: value } }); };

  it('never changes old or SHADOW seasons and does not write on an activation preview', async () => {
    expect(await readHonorBenefits(f.db, f.seasonId, f.playerIds[0]!)).toBeNull();
    await prepare();
    await score(75_000_000);
    expect(await readHonorBenefits(f.db, f.seasonId, f.playerIds[0]!)).toBeNull();
    expect(await enableHonorBenefits(f.db, f.seasonId, f.clock, false)).toMatchObject({ applied: false, version: 1, thresholds });
    expect(await readHonorBenefits(f.db, f.seasonId, f.playerIds[0]!)).toBeNull();
    await f.db.update(honorSeasons).set({ mode: 'SHADOW' });
    await expect(enableHonorBenefits(f.db, f.seasonId, f.clock, true)).rejects.toThrow('active Honor');
  });

  it('publishes the enabled current policy only for this season’s commander', async () => {
    await prepare(); await score(75_000_000);
    await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
    const result = await readHonorBenefits(f.db, f.seasonId, f.playerIds[0]!);
    expect(result).toEqual({ version: 1, thresholds, score: 75_000_000,
      ...honorBenefits(75_000_000, thresholds) });
    const view = await f.db.transaction(tx => planetView(tx, f.planetIds[0]!, f.clock));
    expect(view.honorBenefits).toEqual(result);
    expect(await readHonorBenefits(f.db, f.seasonId, '00000000-0000-4000-8000-000000000000')).toBeNull();
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await expect(enableHonorBenefits(f.db, f.seasonId, f.clock, true)).rejects.toThrow('live season');
  });

  it('advertises tactical Honor only for an active tactical policy, independently of economic activation', async () => {
    const view = () => f.db.transaction(tx => planetView(tx, f.planetIds[0]!, f.clock));
    expect(await view()).toMatchObject({ honorTacticalCredit: false, honorBenefits: null });
    await prepare();
    expect(await view()).toMatchObject({ honorTacticalCredit: false, honorBenefits: null });
    await f.db.update(honorSeasons).set({ version: 4, mode: 'SHADOW' });
    expect(await view()).toMatchObject({ honorTacticalCredit: false, honorBenefits: null });
    // Reader-only contract for the future announced policy. This does not
    // remove the candidate writer/opening guards or promote a real season.
    await f.db.update(honorSeasons).set({ mode: 'ACTIVE' });
    const tactical = await view();
    expect(tactical).toMatchObject({ honorTacticalCredit: true, honorBenefits: null });
    expect(planetSchema.parse(tactical)).toMatchObject({ honorTacticalCredit: true });
  });

  it('keeps a negative economic tier across a real Silent Space round trip without leaking it into the waiting season', async () => {
    await prepare(); await score(-100_000_000);
    await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
    const me = f.playerIds[0]!;
    const { ensureWaitingSeason } = await import('../src/services/waitingServers.js');
    const { transferCommander } = await import('../src/services/commanderTransfer.js');
    const { enqueueReturn } = await import('../src/services/returnQueue.js');
    const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
    if (!waiting) throw new Error('Missing waiting season');
    expect((await transferCommander(f.db, me, waiting.id, f.clock, undefined, { ownerRequested: true })).status).toBe('MOVED');
    expect(await readHonorBenefits(f.db, f.seasonId, me)).toBeNull();
    expect(await readHonorBenefits(f.db, waiting.id, me)).toBeNull();
    f.clock.advance(1);
    const application = await enqueueReturn(f.db, f.accountIds[0]!, f.clock, 1);
    expect((await transferCommander(f.db, me, f.seasonId, f.clock, application.id)).status).toBe('MOVED');
    expect(await readHonorBenefits(f.db, f.seasonId, me)).toMatchObject({ score: -100_000_000, tier: -2, tradePct: 14 });
  });

  it('carries all five enabled tiers through the real planet and leaderboard client contracts', async () => {
    await prepare(); await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
    const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`;
      for (const points of [-100_000_000, -25_000_000, 0, 25_000_000, 75_000_000]) {
        await score(points);
        const world = await built.app.inject({ method: 'GET', url: `/api/planets/${f.planetIds[0]!}`, headers: { authorization } });
        expect(world.statusCode, world.body).toBe(200);
        const board = await built.app.inject({ method: 'GET', url: '/api/leaderboard?ranking=HONOR', headers: { authorization } });
        expect(board.statusCode, board.body).toBe(200);
        const expected = { version: 1, thresholds, score: points, ...honorBenefits(points, thresholds) };
        expect(planetSchema.parse(world.json()).honorBenefits).toEqual(expected);
        expect(leaderboardSchema.parse(board.json()).honorBenefits).toEqual(expected);
      }
    } finally { await built.close(); }
  });

  it.each([0, 2, 4])('composes repair Honor with Industrial %s, freezes paid cost/time and refunds only the paid bill', async (industrial) => {
    await prepare(); await score(75_000_000); await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
    await f.db.update(seasons).set({ rulesetVersion: 18 }).where(eq(seasons.id, f.seasonId));
    const mine = f.planetIds[0]!, me = f.playerIds[0]!;
    await setLevel(f.db, mine, 'SHIPYARD', 4);
    await giveResearch(f.db, mine, 'INDUSTRIAL', industrial);
    await grant(f.db, mine, 200_000, 100_000);
    const lots = [{ hull: 'BALLISTA' as const, count: 3, damageBp: 6400 }];
    await landAndDockShips(f.db, { planetId: mine, ownerPlayerId: me, fleet: { BALLISTA: 3 }, damage: lots, at: f.clock.now() }, f.clock);
    const request = { all: true as const, expectedHonorTier: 2 as const };
    const first = await startRepair(f.db, mine, request, f.clock, me, `honor-industrial-${industrial}`);
    const [order] = await f.db.select().from(buildOrders).where(eq(buildOrders.id, first.orderId));
    if (!order) throw new Error('Missing paid repair');
    const pct = repairPct({ INDUSTRIAL: industrial });
    expect(order.cost).toEqual(honorRepairResources(shipHpRepairCost(lots, pct), honorBenefits(75_000_000, thresholds)));
    const minutes = shipHpRepairMinutes(lots, 4, { INDUSTRIAL: industrial }, pct);
    expect(order.readyAt.getTime() - order.startedAt.getTime()).toBe(Math.ceil(minutes * 60) * 1000);
    await score(-100_000_000);
    expect((await startRepair(f.db, mine, request, f.clock, me, `honor-industrial-${industrial}`)).orderId).toBe(first.orderId);
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
    await cancelBuildOrder(f.db, mine, first.orderId, f.clock, me);
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    expect(after!.alloy - before!.alloy).toBeCloseTo(Math.floor(order.cost.alloy / 2), 6);
    await expect(startRepair(f.db, mine, { all: true, expectedHonorTier: 2 }, f.clock, me)).rejects.toMatchObject({ code: 'HONOR_QUOTE_CHANGED' });
    const second = await startRepair(f.db, mine, { all: true, expectedHonorTier: -2 }, f.clock, me);
    const [charged] = await f.db.select().from(buildOrders).where(eq(buildOrders.id, second.orderId));
    expect(charged?.cost).toEqual(honorRepairResources(shipHpRepairCost(lots, pct), honorBenefits(-100_000_000, thresholds)));
  });
});
