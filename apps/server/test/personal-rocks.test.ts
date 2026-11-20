import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PERSONAL_ROCKS } from '@astera/rules';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import { accounts, asteroidClaims, miningRuns, personalRocks, players } from '../src/db/schema.js';
import { asteroidId } from '../src/services/asteroidField.js';
import { launchMining, visibleAsteroids } from '../src/services/mining.js';
import { joinSeason } from '../src/services/player.js';
import { createSeason } from '../src/services/season.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, makeAccount, setLevel, testDb, testEnv, truncateAll } from './helpers.js';

/**
 * KİŞİSEL KAYALAR ON THE SERVER (plan 2026-11-20 §5.2, Faz 3). A first game's landing lays two rocks beside
 * the capital. Only their commander sees them and only their commander's Prospectors can mine them; the
 * season's shared field, its claims and its spawn counts never learn they exist.
 */
const START = new Date('2026-11-20T09:00:00.000Z');
const asteroidList = z.object({ asteroids: z.array(z.object({ id: z.string(), personal: z.boolean().optional(), oreRemaining: z.number() })) });

afterAll(async () => { await (await testDb()).close(); });

describe('two rocks of ones own', () => {
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let clock: FixedClock;

  beforeEach(async () => {
    const { db } = await testDb();
    await truncateAll(db);
    clock = new FixedClock(new Date(START.getTime() + 5 * 60_000));
    const built = buildApp({ db, clock, logger: pino({ level: 'silent' }), env: testEnv() });
    app = built.app; close = built.close; await app.ready();
  });
  afterEach(async () => { await close(); });

  async function landed(name: string, firstGame: boolean, seasonId: string) {
    const { db } = await testDb();
    const account = await makeAccount(db, name);
    await db.update(accounts).set({ firstGameShieldAvailable: firstGame }).where(eq(accounts.id, account.id));
    const joined = await joinSeason(db, account.id, seasonId, clock);
    const [player] = await db.select().from(players).where(eq(players.accountId, account.id));
    await setLevel(db, joined.planetId, 'CORE', 3);
    await giveUnits(db, joined.planetId, { PROSPECTOR: 4 });
    const authorization = `Bearer ${await app.tokens.issueAccess(account.id)}`;
    const field = async () => asteroidList.parse((await app.inject({ method: 'GET', url: '/api/mining', headers: { authorization } })).json());
    return { planetId: joined.planetId, playerId: player!.id, accountId: account.id, field };
  }

  async function season(code: string) {
    const { db } = await testDb();
    return (await createSeason(db, { shardCode: code, seed: 2013, startsAt: START, playerCap: 20 })).season;
  }

  const worker = async () => new EventWorker((await testDb()).db, clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();

  it('lays two beside a first game\'s capital, and none for a returning commander', async () => {
    const { db } = await testDb();
    const s = await season('EU-ROCKS-A');
    const first = await landed('Newcomer', true, s.id);
    const again = await landed('Returning', false, s.id);
    expect(await db.select().from(personalRocks).where(eq(personalRocks.playerId, first.playerId))).toHaveLength(2);
    expect(await db.select().from(personalRocks).where(eq(personalRocks.playerId, again.playerId))).toHaveLength(0);
    const rows = await db.select().from(personalRocks).where(eq(personalRocks.playerId, first.playerId));
    for (const row of rows) {
      expect(row.index).toBeLessThan(0);
      expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(PERSONAL_ROCKS.lifeMinutes * 60_000);
    }
  });

  it('shows them to their commander alone, marked as theirs', async () => {
    const s = await season('EU-ROCKS-B');
    const mine = await landed('Owner', true, s.id);
    const other = await landed('Neighbour', true, s.id);
    const own = (await mine.field()).asteroids.filter(rock => rock.personal === true);
    expect(own).toHaveLength(2);
    const theirs = (await other.field()).asteroids;
    for (const rock of own) expect(theirs.map(seen => seen.id)).not.toContain(rock.id);
    // And the season's shared field never holds them.
    const shared = await visibleAsteroids((await testDb()).db, s.id, clock.now());
    expect(shared.every(rock => rock.index >= 0)).toBe(true);
  });

  it('is mined by its commander\'s Prospector; another commander\'s order finds nothing there', async () => {
    const { db } = await testDb();
    const s = await season('EU-ROCKS-C');
    const mine = await landed('Miner', true, s.id);
    const other = await landed('Thief', true, s.id);
    const [rock] = (await mine.field()).asteroids.filter(candidate => candidate.personal === true);
    await expect(launchMining(db, other.planetId, rock!.id, 1, clock)).rejects.toMatchObject({ code: 'ASTEROID_UNAVAILABLE' });
    const thiefByHttp = await app.inject({ method: 'POST', url: '/api/mining/launch',
      headers: { authorization: `Bearer ${await app.tokens.issueAccess(other.accountId)}` }, payload: { asteroidId: rock!.id, craft: 1 } });
    expect(thiefByHttp.statusCode).toBe(404);

    const run = await launchMining(db, mine.planetId, rock!.id, 1, clock);
    expect(run.flightMinutes).toBeLessThan(1);
    clock.set(run.arriveAt);
    await worker();
    const [landedRun] = await db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
    expect(landedRun!.minedAlloy + landedRun!.minedCrystal).toBeGreaterThan(0);
    expect(landedRun!.minedCrystal / (landedRun!.minedAlloy + landedRun!.minedCrystal)).toBeCloseTo(0.35, 2);
    const after = (await mine.field()).asteroids.find(candidate => candidate.id === rock!.id);
    expect(after!.oreRemaining).toBeLessThan(rock!.oreRemaining);
  });

  it('serves two squadrons landing together from one ledger, never past its ore', async () => {
    const { db } = await testDb();
    const s = await season('EU-ROCKS-D');
    const mine = await landed('Twins', true, s.id);
    const [rock] = (await mine.field()).asteroids.filter(candidate => candidate.personal === true);
    const [a, b] = await Promise.all([launchMining(db, mine.planetId, rock!.id, 2, clock), launchMining(db, mine.planetId, rock!.id, 2, clock)]);
    clock.set(new Date(Math.max(a.arriveAt.getTime(), b.arriveAt.getTime())));
    await worker();
    const row = (await db.select().from(personalRocks).where(eq(personalRocks.playerId, mine.playerId)))
      .find(candidate => asteroidId(s.asteroidKey, candidate.index) === rock!.id);
    const [claim] = await db.select().from(asteroidClaims).where(and(eq(asteroidClaims.seasonId, s.id), eq(asteroidClaims.index, row!.index)));
    const [first, second] = await Promise.all([a, b].map(async run => (await db.select().from(miningRuns).where(eq(miningRuns.id, run.runId)))[0]!));
    const carried = (run: { minedAlloy: number; minedCrystal: number }) => run.minedAlloy + run.minedCrystal;
    expect(claim!.oreTaken).toBeLessThanOrEqual(row!.spec.ore);
    expect(carried(first!) + carried(second!)).toBeCloseTo(claim!.oreTaken, 0);
  });

  it('is gone when its six hours are up', async () => {
    const { db } = await testDb();
    const s = await season('EU-ROCKS-E');
    const mine = await landed('Late', true, s.id);
    const [rock] = (await mine.field()).asteroids.filter(candidate => candidate.personal === true);
    clock.advance(PERSONAL_ROCKS.lifeMinutes + 1);
    expect((await mine.field()).asteroids.filter(candidate => candidate.personal === true)).toHaveLength(0);
    await expect(launchMining(db, mine.planetId, rock!.id, 1, clock)).rejects.toMatchObject({ code: 'ASTEROID_UNAVAILABLE' });
  });
});
