import { randomUUID } from 'node:crypto';
import { pino } from 'pino';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DAILY_QUEST_HONOR, honorBenefits } from '@astera/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { arenaShips, dailyQuestClaims, honorQuestTotals, honorTotals, players, seasonResults, seasons } from '../src/db/schema.js';
import { claimDailyQuest, dailyQuestsView } from '../src/services/dailyQuests.js';
import type { HonorEvidence } from '../src/services/honorAccounting.js';
import { enableHonorBenefits, readHonorBenefits } from '../src/services/honorBenefits.js';
import { prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import { honorPodium } from '../src/services/honorPodium.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { leaderboardSchema } from '../../web/src/api/schemas.js';
import { levelWorld, seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

/**
 * THE QUEST HONOR COUNTS LIKE ANY OTHER HONOR (owner, 2026-11-24: "normal Honor alsınlar").
 *
 * The Honor ledger replays combat evidence and rewrites `honor_totals` on every settlement, so a quest's
 * quarter-Honor cannot live there. It is kept beside it, per season and commander like the ledger's own
 * totals (`honor_quest_totals`), added in the claim's own transaction, and the four readers (benefit tier,
 * season seal, ladder, podium) add it to the ledger's total. A commander who moves galaxy leaves it with
 * the season that paid it. Where the season has no ranked Honor there is none to pay, and the panel says 0.
 */
describe('the Honor a daily quest pays', () => {
  let f: Fixture;
  const DAY_MINUTES = 24 * 60;

  beforeEach(async () => {
    f = await seedWorld(4, 7719);
    await levelWorld(f.db, f.planetIds);
  });

  const enable = (mode: 'SHADOW' | 'ACTIVE' = 'ACTIVE') => f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, mode, f.clock));
  /** The one quest a test can finish with a single row: a sortie flown today. */
  const sortie = (index: number) => f.db.insert(arenaShips).values({
    playerId: f.playerIds[index]!, ship: 'akinci', chosenAt: f.clock.now(), fuel: 100, ammo: 100, lastSortieAt: f.clock.now(),
  }).onConflictDoUpdate({ target: arenaShips.playerId, set: { lastSortieAt: f.clock.now() } });
  const claim = (index: number) => claimDailyQuest(f.db, f.planetIds[index]!, 'RIFT', f.clock);
  const quest = async (index: number, seasonId = f.seasonId) => (await f.db.select({ micros: honorQuestTotals.micros }).from(honorQuestTotals)
    .where(and(eq(honorQuestTotals.seasonId, seasonId), eq(honorQuestTotals.playerId, f.playerIds[index]!))))[0]?.micros ?? 0;
  const setQuest = (index: number, micros: number) => f.db.insert(honorQuestTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[index]!, micros })
    .onConflictDoUpdate({ target: [honorQuestTotals.seasonId, honorQuestTotals.playerId], set: { micros } });
  const setScore = (index: number, score: number) => f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[index]!, score })
    .onConflictDoUpdate({ target: [honorTotals.seasonId, honorTotals.playerId], set: { score } });

  describe('when it is paid', () => {
    it('lands on the seat in the claim’s own transaction, once per quest', async () => {
      await enable(); await sortie(0);
      const result = await claim(0);
      expect(result.granted.honor).toBe(DAILY_QUEST_HONOR);
      expect(await quest(0)).toBe(DAILY_QUEST_HONOR);
      expect(await quest(1)).toBe(0);
    });

    it('adds up across days and always equals what the claim rows say were paid', async () => {
      await enable(); await sortie(0); await claim(0);
      f.clock.advance(DAY_MINUTES); await sortie(0); await claim(0);
      const rows = await f.db.select().from(dailyQuestClaims).where(eq(dailyQuestClaims.playerId, f.playerIds[0]!));
      expect(rows).toHaveLength(2);
      expect(await quest(0)).toBe(2 * DAILY_QUEST_HONOR);
      expect(rows.reduce((sum, row) => sum + row.honorMicros, 0)).toBe(await quest(0));
    });

    it('is paid once when the same purse is taken twice at the same moment', async () => {
      await enable(); await sortie(0);
      const settled = await Promise.allSettled([claim(0), claim(0)]);
      expect(settled.filter(row => row.status === 'fulfilled')).toHaveLength(1);
      expect(await quest(0)).toBe(DAILY_QUEST_HONOR);
    });

    it('pays nothing and promises nothing in a season with no ranked Honor, and says 0 in the panel', async () => {
      await sortie(0);
      expect((await dailyQuestsView(f.db, f.planetIds[0]!, f.clock)).quests.map(row => row.honor)).toEqual([0, 0, 0, 0]);
      const result = await claim(0);
      expect(result.granted.honor).toBe(0);
      expect(await quest(0)).toBe(0);
      expect((await f.db.select().from(dailyQuestClaims))[0]?.honorMicros).toBe(0);
    });

    it('treats a SHADOW season like none: trial Honor is never ranked, so a quest pays none into it', async () => {
      await enable('SHADOW'); await sortie(0);
      expect((await claim(0)).granted.honor).toBe(0);
      expect(await quest(0)).toBe(0);
    });

    it('shows the quarter-Honor on every row once the season’s Honor is ranked', async () => {
      await enable();
      expect((await dailyQuestsView(f.db, f.planetIds[0]!, f.clock)).quests.map(row => row.honor))
        .toEqual([DAILY_QUEST_HONOR, DAILY_QUEST_HONOR, DAILY_QUEST_HONOR, DAILY_QUEST_HONOR]);
    });
  });

  describe('when it is read', () => {
    it('moves a commander’s benefit tier: 24.8 Honor of combat plus a quest crosses the +25 line', async () => {
      await enable(); await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
      await setScore(0, 24_800_000);
      expect((await readHonorBenefits(f.db, f.seasonId, f.playerIds[0]!))?.tier).toBe(0);
      await setQuest(0, 250_000);
      const after = await readHonorBenefits(f.db, f.seasonId, f.playerIds[0]!);
      expect(after).toMatchObject({ score: 25_050_000, ...honorBenefits(25_050_000, after!.thresholds) });
      expect(after?.tier).toBe(1);
    });

    it('counts for a commander with no combat Honor at all, and for a negative one', async () => {
      await enable(); await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
      await setQuest(0, 750_000);
      expect((await readHonorBenefits(f.db, f.seasonId, f.playerIds[0]!))?.score).toBe(750_000);
      await setScore(1, -1_000_000); await setQuest(1, 250_000);
      expect((await readHonorBenefits(f.db, f.seasonId, f.playerIds[1]!))?.score).toBe(-750_000);
    });

    it('puts a commander who only did quests on the podium, and ties them with equal combat Honor', async () => {
      await enable();
      await setScore(0, 400_000); await setQuest(1, 250_000);
      expect((await honorPodium(f.db, f.seasonId, new Set())).ranks).toEqual(new Map([[f.playerIds[0], 1], [f.playerIds[1], 2]]));
      await setScore(2, 150_000); await setQuest(2, 250_000);
      expect((await honorPodium(f.db, f.seasonId, new Set())).ranks)
        .toEqual(new Map([[f.playerIds[0], 1], [f.playerIds[2], 1], [f.playerIds[1], 3]]));
    });

    it('leaves a podium that is not ranked alone, whatever the seats hold', async () => {
      await enable('SHADOW'); await setQuest(0, 250_000);
      expect(await honorPodium(f.db, f.seasonId, new Set())).toEqual({ active: false, ranks: new Map() });
    });

    it('keeps a settlement from wiping it, and never counts it twice', async () => {
      await enable(); await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
      await sortie(0); await claim(0);
      const a = f.playerIds[0]!, d = f.playerIds[1]!;
      const evidence: HonorEvidence = { source: 'WORLD', id: randomUUID(), at: f.clock.now().getTime(), eligible: true,
        attack: [{ id: a, tier: 3, navy: 100_000, weight: 100_000, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0 }],
        defence: [{ id: d, tier: 3, navy: 100_000, weight: 100_000, civilianWeight: 0, loss: 1000, combatLoss: 1000, lootLost: 0 }],
        relations: [{ a, b: d, related: false }] };
      await f.db.transaction(tx => settleHonor(tx, f.seasonId, evidence));
      const combat = (await f.db.select().from(honorTotals).where(eq(honorTotals.playerId, a)))[0]?.score ?? 0;
      expect(combat).toBeGreaterThan(0);
      expect((await readHonorBenefits(f.db, f.seasonId, a))?.score).toBe(combat + DAILY_QUEST_HONOR);
      expect(await quest(0)).toBe(DAILY_QUEST_HONOR);
    });

    it('stays with the season that paid it when the commander moves galaxy, like the ledger’s Honor', async () => {
      await enable(); await sortie(0); await claim(0);
      const [original] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
      const otherId = randomUUID();
      await f.db.insert(seasons).values({ id: otherId, shardId: original!.shardId, cycleId: original!.cycleId, status: 'live',
        seed: 7720, startsAt: original!.endsAt, endsAt: new Date(original!.endsAt.getTime() + 86_400_000) });
      await f.db.transaction(tx => prepareHonorSeason(tx, otherId, 'ACTIVE', f.clock));
      await f.db.update(players).set({ seasonId: otherId }).where(eq(players.id, f.playerIds[0]!));
      expect(await quest(0, otherId)).toBe(0);
      expect((await honorPodium(f.db, otherId, new Set())).ranks).toEqual(new Map());
      expect(await quest(0)).toBe(DAILY_QUEST_HONOR);
    });

    it('is in the season’s archived Honor score and rank', async () => {
      await enable();
      await setScore(0, 200_000_000); await setQuest(0, 250_000); await setScore(1, 200_000_000);
      await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
      const results = await f.db.select().from(seasonResults);
      expect(results.find(row => row.accountId === f.accountIds[0])).toMatchObject({ honorScore: 200_250_000, honorRank: 1 });
      expect(results.find(row => row.accountId === f.accountIds[1])).toMatchObject({ honorScore: 200_000_000, honorRank: 2 });
    });
  });

  describe('on the ladder', () => {
    let app: FastifyInstance;
    let closeApp: () => Promise<void>;
    let authorization: string;
    beforeEach(async () => {
      const built = buildApp({ db: f.db, clock: f.clock, env: testEnv(), logger: pino({ level: 'silent' }) });
      app = built.app; closeApp = built.close; await app.ready();
      authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`;
    });
    afterEach(async () => { await closeApp(); });
    const board = async () => {
      const response = await app.inject({ method: 'GET', url: '/api/leaderboard?ranking=HONOR', headers: { authorization } });
      expect(response.statusCode, response.body).toBe(200);
      return leaderboardSchema.parse(response.json());
    };

    it('orders by combat Honor plus the quests, quest-only commanders included', async () => {
      await enable();
      await setScore(1, 400_000); await setQuest(0, 250_000); await setQuest(2, 500_000);
      const result = await board();
      expect(result.ladder.map(row => row.playerId)).toEqual([f.playerIds[2], f.playerIds[1], f.playerIds[0], f.playerIds[3]]);
      expect(result.you).toMatchObject({ score: 250_000, honor: 250_000 });
    });

    it('shows no quest Honor while the season is not ranked', async () => {
      await enable('SHADOW'); await setQuest(0, 250_000);
      const result = await board();
      expect(result).toMatchObject({ ranking: 'DOMINION', honorEnabled: false });
      expect(JSON.stringify(result)).not.toContain('250000');
    });
  });
});
