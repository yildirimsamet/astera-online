import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { DEBRIS, HULLS, fleetCount, type HullId } from '@blindspace/rules';
import { battleReports, debrisFields, miningRuns, planets, players } from '../src/db/schema.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { launchAttack } from '../src/services/mission.js';
import { launchHarvest } from '../src/services/mining.js';
import { collectWorks } from '../src/services/build.js';
import { baysInUse } from '../src/services/flight.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveUnits,
  grant,
  seedWorld,
  setLevel,
  settledAt,
  testDb,
  testEnv,
  type Fixture,
} from './helpers.js';

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
    f.clock.set(settledAt(launch.arriveAt));
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

    // toBeCloseTo, not toBe: `Object.is(0, -0)` is false, so a raid that carries
    // nothing home would fail this on a signed zero rather than on anything real.
    // The dominion assertion below already uses the same guard for the same reason.
    expect(attacker!.lootAlloy).toBeCloseTo(-defender!.lootAlloy, 5);
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

/**
 * WRECKAGE. D32.
 *
 * A battle leaves a public, decaying field at the defender's coordinates. The
 * property that keeps it from becoming OGame's expedition — the mechanic most
 * blamed for emptying that game's PvP layer — is that it is made of destroyed
 * ships and therefore cannot exist without a fight.
 */
describe('what a battle leaves behind', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, theirs] = f.planetIds as [string, string];
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 6);
      await grant(f.db, id, 200_000, 20_000);
    }
    f.clock.advance(600);
  });

  const fight = async (): Promise<void> => {
    await giveUnits(f.db, theirs, { BASTION: 6 });
    await giveUnits(f.db, mine, { WASP: 80, HAULER: 3 });
    const launch = await launchAttack(f.db, mine, theirs, { WASP: 80, HAULER: 3 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
  };

  it('leaves a field at the defender, made of what was destroyed', async () => {
    await fight();
    const fields = await f.db.select().from(debrisFields);
    expect(fields).toHaveLength(1);
    expect(fields[0]!.planetId).toBe(theirs);
    expect(fields[0]!.alloy + fields[0]!.crystal).toBeGreaterThan(0);
  });

  /**
   * GROUND UNITS CONTRIBUTE NOTHING. They already have `defenceSalvage` at 60%;
   * counting them here would return about 85% of a defender's losses and make a
   * fortress profit from being attacked.
   */
  it('is priced only on the hulls that fly', async () => {
    await fight();
    const [report] = await f.db.select().from(battleReports);
    const [field] = await f.db.select().from(debrisFields);

    const flying = (fleet: Record<string, number>): number =>
      Object.entries(fleet)
        .filter(([id]) => !HULLS[id as HullId].ground)
        .reduce((s, [id, n]) => s + n * (HULLS[id as HullId].alloy + HULLS[id as HullId].crystal), 0);

    const destroyed = flying(report!.attackerLosses) + flying(report!.defenderLosses);
    expect(field!.alloy + field!.crystal).toBeCloseTo(destroyed * DEBRIS.share, 0);

    // The defender lost Bastions in this fight, and they are NOT in the figure.
    expect(report!.defenderLosses.BASTION ?? 0).toBeGreaterThan(0);
  });

  /**
   * THE ZERO-SUM GUARANTEE. Dominion is exactly zero-sum across the galaxy and only
   * combat generates it (D2). Wreckage was not taken FROM anybody, so crediting it
   * would create score out of nothing — silently, with no other symptom.
   */
  it('moves no Dominion at all', async () => {
    await fight();
    const before = await f.db.select().from(players);
    const total = (rows: typeof before): number =>
      rows.reduce((s, p) => s + p.dominionTaken - p.dominionLost, 0);
    expect(Math.abs(total(before))).toBeLessThan(0.001);

    // Harvest the whole field and check again: taking wreckage must not move it.
    const [field] = await f.db.select().from(debrisFields);
    await giveUnits(f.db, mine, { PROSPECTOR: 6 });
    const run = await launchHarvest(f.db, mine, field!.id, 6, f.clock);
    f.clock.set(run.arriveAt);
    await worker().tick();
    const [mid] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
    f.clock.set(mid!.homeAt!);
    await worker().tick();

    const after = await f.db.select().from(players);
    expect(Math.abs(total(after))).toBeLessThan(0.001);
    expect(total(after)).toBeCloseTo(total(before), 5);
  });

  it('a harvest brings salvage home into the works, and takes a bay', async () => {
    await fight();
    const [field] = await f.db.select().from(debrisFields);
    await giveUnits(f.db, mine, { PROSPECTOR: 4 });

    /**
     * EMPTY THE WORKS FIRST, because that is the flow the game now asks for.
     *
     * Ten hours of production had already filled them to the cap in this fixture,
     * so without this the whole haul is lost on arrival — which is D31 behaving
     * exactly as designed, and precisely why the panel warns before a launch. The
     * test says so out loud rather than quietly sizing the fixture around it.
     */
    await collectWorks(f.db, mine, f.clock);

    const bays = await baysInUse(f.db, mine);
    const run = await launchHarvest(f.db, mine, field!.id, 4, f.clock);
    expect(await baysInUse(f.db, mine)).toBe(bays + 1);

    const [beforePlanet] = await f.db.select().from(planets).where(eq(planets.id, mine));
    f.clock.set(run.arriveAt);
    await worker().tick();
    const [mid] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
    f.clock.set(mid!.homeAt!);
    await worker().tick();

    const [afterPlanet] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const gained =
      afterPlanet!.bufferAlloy + afterPlanet!.bufferCrystal -
      (beforePlanet!.bufferAlloy + beforePlanet!.bufferCrystal);
    const [finished] = await f.db.select().from(miningRuns).where(eq(miningRuns.id, run.runId));
    // Salvage is ore like any other, so D31 applies and it lands in the WORKS.
    // Asserted against what the run actually carried rather than "> 0", so a
    // harvest that quietly delivered a fraction would still fail.
    expect(gained).toBeGreaterThanOrEqual(finished!.minedAlloy + finished!.minedCrystal);
    expect(finished!.minedAlloy + finished!.minedCrystal).toBeGreaterThan(0);
    // And the harvest is finished, so its bay is no longer held. (That a landing
    // craft releases a bay is proved directly in `economy.test.ts`; here the point
    // is that a harvest is counted by the same machinery as everything else — the
    // attack's own return leg is also in the air in this fixture, which is why the
    // absolute count is not the thing to assert.)
    expect(finished!.status).toBe('done');
  });

  it('refuses a second harvest at a field you are already working', async () => {
    await fight();
    const [field] = await f.db.select().from(debrisFields);
    await giveUnits(f.db, mine, { PROSPECTOR: 4 });
    await launchHarvest(f.db, mine, field!.id, 2, f.clock);
    await expect(launchHarvest(f.db, mine, field!.id, 2, f.clock)).rejects.toMatchObject({
      code: 'ALREADY_HARVESTING',
    });
  });
});
