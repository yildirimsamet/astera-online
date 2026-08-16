import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fleetCount } from '@blindspace/rules';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { launchAttack } from '../src/services/mission.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

/**
 * A world that has been running a while.
 *
 * These used to advance past the newcomer grace period, which no longer exists
 * (D14). The advance stays because the assertions below are about a settled
 * world — accrued resources, telescope windows that have turned over — and
 * removing it would quietly change what they test.
 */
const SETTLED_MINUTES = 250;


const silent = pino({ level: 'silent' });

interface ReportView {
  grade: string;
  rounds: { round: number; attackerDamage: number; defenderDamage: number }[];
  attacking: boolean;
  opponentName: string;
  opponentPlanet: string;
  yourLosses: Record<string, number>;
  theirLosses: Record<string, number>;
  lootAlloy: number;
  lootCrystal: number;
  /** Null on reports written before the swing was recorded. */
  dominion: number | null;
}

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * The closing link of the core loop.
 *
 * The design calls the battle report "the most accurate intel in the game" and has
 * step 9 feed step 3 — every fight teaches you about someone you will fight again.
 * These assertions are about what each side is entitled to learn, which is the
 * part that is easy to get wrong in either direction: too little and combat teaches
 * nothing, too much and it hands over the fog for free.
 */
describe('battle reports', () => {
  let f: Fixture;
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let mine: string;
  let theirs: string;
  let tokens: TokenService;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, theirs] = f.planetIds as [string, string];
    await setLevel(f.db, mine, 'CORE', 8);
    await setLevel(f.db, theirs, 'CORE', 8);
    f.clock.advance(SETTLED_MINUTES);

    const built = buildApp({ env: testEnv(), logger: silent, db: f.db, clock: f.clock });
    app = built.app;
    close = built.close;
    await app.ready();
    tokens = new TokenService('test-secret-that-is-long-enough', 15, 30);
  });

  afterEach(async () => {
    await close();
  });

  const reportsFor = async (index: number): Promise<ReportView[]> => {
    const auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[index]!)}` };
    const res = await app.inject({ method: 'GET', url: '/api/reports', headers: auth });
    expect(res.statusCode).toBe(200);
    return res.json<{ reports: ReportView[] }>().reports;
  };

  /** A raid that actually resolves, with something worth taking. */
  const raid = async (wasps = 40): Promise<void> => {
    await grant(f.db, theirs, 40_000, 4_000);
    await giveUnits(f.db, theirs, { BASTION: 6 });
    await giveUnits(f.db, mine, { WASP: wasps, HAULER: 3 });
    const launch = await launchAttack(f.db, mine, theirs, { WASP: wasps, HAULER: 3 }, f.clock);
    f.clock.set(launch.arriveAt);
    await worker().tick();
  };

  it('tells the attacker what they destroyed and what it cost', async () => {
    await raid();
    const [report] = await reportsFor(0);

    expect(report).toBeDefined();
    expect(report!.attacking).toBe(true);
    expect(['DECISIVE', 'PARTIAL', 'REPELLED']).toContain(report!.grade);
    expect(report!.rounds.length).toBeGreaterThan(0);
    expect(report!.rounds[0]!.attackerDamage).toBeGreaterThan(0);
    // The whole point: you learn what they were defending with.
    expect(fleetCount(report!.theirLosses)).toBeGreaterThan(0);
  });

  /** Both sides were there. Both get the same facts, from their own side. */
  it('gives the defender the mirror of the same battle', async () => {
    await raid();
    const [attacker] = await reportsFor(0);
    const [defender] = await reportsFor(1);

    expect(defender).toBeDefined();
    expect(defender!.attacking).toBe(false);
    expect(defender!.grade).toBe(attacker!.grade);
    // One side's losses are the other side's kills.
    expect(defender!.yourLosses).toEqual(attacker!.theirLosses);
    expect(defender!.theirLosses).toEqual(attacker!.yourLosses);
  });

  it('signs the loot from the reader’s side', async () => {
    await raid();
    const [attacker] = await reportsFor(0);
    const [defender] = await reportsFor(1);

    expect(attacker!.lootAlloy).toBe(-defender!.lootAlloy);
    if (attacker!.grade !== 'REPELLED') expect(attacker!.lootAlloy).toBeGreaterThan(0);
  });

  /**
   * Dominion is exactly zero-sum across the galaxy, so a battle's two reports must
   * be exact opposites — and both must match what the ladder actually recorded.
   * An earlier version derived this from the loss lists and was wrong whenever
   * ground defence died, because a defender's loss VALUE is net of the 60% that
   * salvages back out of the wreckage.
   */
  it('reports a dominion swing that sums to zero and matches the ladder', async () => {
    await raid();
    const [attacker] = await reportsFor(0);
    const [defender] = await reportsFor(1);

    expect(attacker!.dominion).not.toBeNull();
    expect(attacker!.dominion! + defender!.dominion!).toBeCloseTo(0, 5);

    const { players } = await import('../src/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const [me] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    expect(attacker!.dominion).toBeCloseTo(me!.dominionTaken - me!.dominionLost, 4);
  });

  it('names the opponent — being raided reveals the raider', async () => {
    await raid();
    const [defender] = await reportsFor(1);
    expect(defender!.opponentName).not.toBe('');
    expect(defender!.opponentPlanet).not.toBe('');
  });

  /**
   * A report is ground truth about what was BROUGHT, never about what remains.
   * Survivors are not in the payload at all — there is nothing to strip.
   */
  it('never discloses what the loser still has', async () => {
    await raid();
    const auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
    const res = await app.inject({ method: 'GET', url: '/api/reports', headers: auth });

    for (const leak of ['survivors', 'attackerSurvivors', 'defenderSurvivors', 'shieldLeft']) {
      expect(res.body).not.toContain(leak);
    }
  });

  it('shows a third party nothing at all', async () => {
    await raid();
    expect(await reportsFor(2)).toHaveLength(0);
  });

  it('is empty before anyone has fought', async () => {
    expect(await reportsFor(0)).toHaveLength(0);
  });

  it('needs a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/reports' });
    expect(res.statusCode).toBe(401);
  });
});
