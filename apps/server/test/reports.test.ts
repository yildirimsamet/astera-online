import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import {
  COMBAT,
  DEBRIS,
  DOMINION_TRANSFER_SCALE,
  HULLS,
  fleetCount,
  type HullId,
} from '@astera/rules';
import {
  accounts,
  battleReports,
  debrisFields,
  miningRuns,
  missions,
  planets,
  players,
  strategicImpacts,
} from '../src/db/schema.js';
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
  giveInstrument,
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
  missionId: string;
  grade: string;
  rounds: {
    round: number;
    attackerDamage: number;
    defenderDamage: number;
    /** Present on new reports; null on reports written before calculation telemetry. */
    attackerRoll: number | null;
    defenderRoll: number | null;
    shieldBefore: number | null;
    shieldAfter: number | null;
    attackerHullDamage: number | null;
    shieldAbsorbed: number;
    attackerLosses: Record<string, number>;
    defenderLosses: Record<string, number>;
  }[];
  attacking: boolean;
  opponentName: string;
  opponentPlanet: string;
  opponentPlanetId: string | null;
  neutral: boolean;
  yourLosses: Record<string, number>;
  theirLosses: Record<string, number>;
  /** The caller's OWN board at contact. Never the opponent's. D121. */
  yourFleet: Record<string, number>;
  /** The caller's own world in this battle: launched from, or hit. */
  yourPlanet: string;
  lootAlloy: number;
  lootCrystal: number;
  /** Null on reports written before the swing was recorded. */
  dominion: number | null;
  shieldAbsorbed: number;
  /** Derived from immutable round telemetry; null for a legacy report. */
  shieldBefore: number | null;
  shieldAfter: number | null;
  cargoLimited: boolean;
  defenceSalvage: Record<string, number>;
  disruptedMinutes: number;
  wreckValue: number;
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
  const raid = async (wasps = 40): Promise<string> => {
    await grant(f.db, theirs, 40_000, 4_000);
    await giveUnits(f.db, theirs, { BASTION: 6 });
    await giveUnits(f.db, mine, { WASP: wasps, HAULER: 3 });
    const launch = await launchAttack(f.db, mine, theirs, { WASP: wasps, HAULER: 3 }, f.clock);
    f.clock.set(settledAt(launch.arriveAt));
    await worker().tick();
    return launch.missionId;
  };

  it('tells the attacker what they destroyed and what it cost', async () => {
    const missionId = await raid();
    const [report] = await reportsFor(0);

    expect(report).toBeDefined();
    expect(report!.missionId).toBe(missionId);
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
    expect(Math.abs(attacker!.dominion!)).toBeLessThanOrEqual(DOMINION_TRANSFER_SCALE);

    const { players } = await import('../src/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const [me] = await f.db.select().from(players).where(eq(players.id, f.playerIds[0]!));
    expect(attacker!.dominion).toBeCloseTo(me!.dominionTaken - me!.dominionLost, 4);
  });

  it('names the opponent — being raided reveals the raider', async () => {
    await f.db.update(accounts).set({ displayName: 'İzci' }).where(eq(accounts.id, f.accountIds[0]!));
    await f.db.update(players).set({ name: 'STALE-SEASON-NAME' }).where(eq(players.id, f.playerIds[0]!));
    await raid();
    const [defender] = await reportsFor(1);
    expect(defender!.opponentName).toBe('İzci');
    expect(defender!.opponentPlanet).not.toBe('');
    expect(defender!.opponentPlanetId).toBe(mine);
  });

  it('aggregates the full seasonal relationship by stable planet id', async () => {
    await raid();
    const [firstBattle] = await f.db.select().from(battleReports);
    f.clock.advance(1);
    const [secondMission] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'attack',
      ownerPlayerId: f.playerIds[0]!,
      status: 'resolved',
      originPlanetId: mine,
      targetPlanetId: theirs,
      fleet: { WASP: 2 },
      distance: 100,
      departAt: f.clock.now(),
      arriveAt: f.clock.now(),
    }).returning();
    await f.db.insert(battleReports).values({
      seasonId: f.seasonId,
      missionId: secondMission!.id,
      attackerPlayerId: f.playerIds[0]!,
      defenderPlayerId: f.playerIds[1]!,
      targetPlanetId: theirs,
      targetKind: 'PLAYER',
      grade: 'REPELLED',
      rounds: [],
      loot: { alloy: 0, crystal: 0, deuterium: 0 },
      attackerLosses: { WASP: 2 },
      defenderLosses: {},
      dominionSwing: -50,
      createdAt: f.clock.now(),
    });
    f.clock.advance(1);
    const [strike] = await f.db.insert(missions).values({
      seasonId: f.seasonId,
      kind: 'death_star',
      ownerPlayerId: f.playerIds[0]!,
      status: 'resolved',
      originPlanetId: mine,
      targetPlanetId: theirs,
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
      targetPlanetId: theirs,
      outcome: 'FIRST_STRIKE',
      damage: 12_000,
      destroyedFleet: { BASTION: 2 },
      destroyedResources: { alloy: 4_000, crystal: 2_000, deuterium: 500 },
      levelChanges: [{ kind: 'BUILDING', id: 'CORE', before: 6, after: 5 }],
      destroyedOrders: [{
        kind: 'BUILDING',
        subject: 'REFINERY',
        count: 1,
        cost: { alloy: 900, crystal: 400, deuterium: 0 },
      }],
      shieldDestroyed: 800,
      createdAt: f.clock.now(),
    });
    const auth = { authorization: `Bearer ${await tokens.issueAccess(f.accountIds[0]!)}` };
    const body = (await app.inject({ method: 'GET', url: '/api/reports?limit=1', headers: auth })).json<{
      reports: ReportView[];
      rivals: {
        planetId: string;
        battles: number;
        attacks: number;
        defences: number;
        dominionGained: number;
        dominionLost: number;
        lastKnownFleet: Record<string, number> | null;
      }[];
    }>();
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0]).toMatchObject({
      kind: 'STRATEGIC',
      outcome: 'FIRST_STRIKE',
      destroyedFleet: { BASTION: 2 },
      destroyedResources: { alloy: 4_000, crystal: 2_000, deuterium: 500 },
      levelChanges: [{ kind: 'BUILDING', id: 'CORE', before: 6, after: 5 }],
      destroyedOrders: [{ subject: 'REFINERY', count: 1 }],
      shieldDestroyed: 800,
    });
    expect(body.rivals).toEqual([
      expect.objectContaining({
        planetId: theirs,
        playerId: f.playerIds[1],
        battles: 3,
        attacks: 3,
        defences: 0,
        dominionGained: Math.max(0, firstBattle!.dominionSwing ?? 0),
        dominionLost: 50 + Math.max(0, -(firstBattle!.dominionSwing ?? 0)),
        // A strategic strike is also confirmed destruction and becomes the latest
        // useful composition without inventing a conventional battle report.
        lastKnownFleet: { BASTION: 2 },
      }),
    ]);
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

  /**
   * WHAT D121 ADDED, AND THE LINE IT WAS NOT ALLOWED TO CROSS.
   *
   * Every complaint about these reports came down to a number with no denominator
   * or a consequence the server decided and threw away. Each one added back is a
   * fact about ONE side, so the test that matters most is the one that proves the
   * opponent's board is still not in the payload.
   */
  describe('the detail a player can actually act on', () => {
    it('gives the attacker the squadron they sent, as a denominator for their losses', async () => {
      await raid(40);
      const [report] = await reportsFor(0);

      expect(report!.yourFleet).toEqual({ WASP: 40, HAULER: 3 });
      // Every loss has to be a subset of what was fielded, or the sheet draws a
      // negative survivor count at the reader.
      for (const [hull, lost] of Object.entries(report!.yourLosses)) {
        expect(lost).toBeLessThanOrEqual(report!.yourFleet[hull] ?? 0);
      }
    });

    it('gives the defender their own board — home fleet AND ground guns', async () => {
      await raid();
      const [report] = await reportsFor(1);

      expect(report!.attacking).toBe(false);
      // The Bastions the fixture stood on the ground are part of what defended.
      expect(report!.yourFleet.BASTION).toBe(6);
      for (const [hull, lost] of Object.entries(report!.yourLosses)) {
        expect(lost).toBeLessThanOrEqual(report!.yourFleet[hull] ?? 0);
      }
    });

    /**
     * THE FOG, RESTATED FOR THE ONE FIELD THAT COULD HAVE BROKEN IT.
     *
     * `yourFleet` minus `yourLosses` is the caller's own survivors, which they may
     * have. The identical subtraction on the OPPONENT's roster is the disclosure
     * the whole intel layer exists to refuse — so the opponent's roster is not in
     * the payload at all, and each side's copy of the field is its own.
     */
    it('never hands either side the other one\u2019s roster', async () => {
      await raid();
      const [attacker] = await reportsFor(0);
      const [defender] = await reportsFor(1);

      expect(attacker!.yourFleet).not.toEqual(defender!.yourFleet);
      // The defender's Bastions are the tell: they must appear in the defender's
      // own roster and nowhere in the attacker's payload except as losses.
      expect(attacker!.yourFleet.BASTION).toBeUndefined();
      expect(defender!.yourFleet.WASP ?? 0).not.toBe(40);
    });

    /**
     * GROUND DEFENCE IS DURABLE BY DESIGN (60% salvage) and the game had never
     * said so. A defender reading "you lost 6 Bastions" concluded the opposite of
     * the rule those guns are priced on.
     */
    it('tells the defender how many guns walked out of their own wreckage', async () => {
      // Enough attackers that several guns really die, so the figure under test
      // is a rebuild rather than a floor() of one casualty.
      await raid(160);
      const [defender] = await reportsFor(1);
      const [attacker] = await reportsFor(0);

      const lostGuns = defender!.yourLosses.BASTION ?? 0;
      expect(lostGuns).toBeGreaterThan(1);
      expect(defender!.defenceSalvage.BASTION).toBe(
        Math.floor(lostGuns * COMBAT.defenceSalvage),
      );
      // It is the defender's fact about the defender's guns. The attacker is told
      // nothing, because a rebuild is not something they watched happen.
      expect(attacker!.defenceSalvage).toEqual({});
    });

    /**
     * The attacker's holds, not the defender's stock, capped the haul (D94).
     * Stored since D94 and shown to nobody, which is the whole complaint: a raider
     * who flew home under-loaded had no way to learn the answer was more Haulers.
     */
    it('tells the attacker when their own holds capped the haul, and tells the defender nothing', async () => {
      // One Wasp of cargo against a full store: the holds are certainly the limit.
      await grant(f.db, theirs, 40_000, 4_000);
      await giveUnits(f.db, mine, { WASP: 60 });
      const launch = await launchAttack(f.db, mine, theirs, { WASP: 60 }, f.clock);
      f.clock.set(settledAt(launch.arriveAt));
      await worker().tick();

      const [attacker] = await reportsFor(0);
      const [defender] = await reportsFor(1);
      expect(attacker!.cargoLimited).toBe(true);
      expect(defender!.cargoLimited).toBe(false);
    });

    /**
     * Downtime is a pure function of the grade, which both sides already have, so
     * both are told — and it is measured from the battle rather than stored as a
     * deadline, because a deadline is meaningless once the report is an hour old.
     */
    it('reports the works this raid knocked offline, to both sides', async () => {
      await raid();
      const [attacker] = await reportsFor(0);
      const [defender] = await reportsFor(1);

      if (attacker!.grade === 'REPELLED') {
        expect(attacker!.disruptedMinutes).toBe(0);
      } else {
        expect(attacker!.disruptedMinutes).toBeGreaterThan(0);
      }
      expect(defender!.disruptedMinutes).toBe(attacker!.disruptedMinutes);
    });

    /**
     * A REPELLED RAID REPORTS NO DOWNTIME, EVEN ON A WORLD ALREADY OFFLINE.
     *
     * `applyDisruption` returns the EXISTING deadline untouched when a grade adds
     * nothing, so a world still dark from an earlier raid would have handed its
     * leftover figure to the report of the attack it had just beaten — and the
     * defender would have read "your works were knocked offline for three hours"
     * about a defence that worked.
     */
    it('reports no downtime for a raid the defence turned away', async () => {
      // Knock the works out first, from a raid that lands and wins.
      await raid(160);
      const [first] = await reportsFor(0);
      expect(first!.disruptedMinutes).toBeGreaterThan(0);

      // Let the survivors dock: a fleet still in the air is committed to that
      // world and the second launch would be refused before it could be measured.
      f.clock.advance(60);
      await worker().tick();

      // Then throw a token squadron at a world that is still dark, and lose.
      await giveUnits(f.db, theirs, { BASTION: 12 });
      await giveUnits(f.db, mine, { WASP: 1 });
      const launch = await launchAttack(f.db, mine, theirs, { WASP: 1 }, f.clock);
      f.clock.set(settledAt(launch.arriveAt));
      await worker().tick();

      const [latest] = await reportsFor(0);
      expect(latest!.grade).toBe('REPELLED');
      expect(latest!.disruptedMinutes).toBe(0);
    });

    /** The wreckage is a public field; the report says what the fight left there. */
    it('prices the wreckage against the field the fight actually created', async () => {
      await raid();
      const [attacker] = await reportsFor(0);

      const fields = await f.db.select().from(debrisFields);
      if (fields.length === 0) {
        expect(attacker!.wreckValue).toBe(0);
        return;
      }
      const total = fields[0]!.alloy + fields[0]!.crystal + fields[0]!.deuterium;
      expect(attacker!.wreckValue).toBeCloseTo(total, 3);
    });

    /** Shield telemetry was stored and never surfaced; both sides watched it happen. */
    it('sums the shield the same way both sides saw it', async () => {
      await giveInstrument(f.db, theirs, 'AEGIS', 1);
      f.clock.advance(60);
      await raid();
      const [attacker] = await reportsFor(0);
      const [defender] = await reportsFor(1);

      const fromRounds = attacker!.rounds.reduce(
        (sum, round) => sum + ((round as unknown as { shieldAbsorbed: number }).shieldAbsorbed),
        0,
      );
      expect(attacker!.shieldAbsorbed).toBeCloseTo(fromRounds, 3);
      expect(defender!.shieldAbsorbed).toBe(attacker!.shieldAbsorbed);
      expect(attacker!.shieldBefore).toBeGreaterThan(0);
      expect(attacker!.shieldAfter).toBeGreaterThanOrEqual(0);
      expect(attacker!.shieldBefore! - attacker!.shieldAfter!).toBe(attacker!.shieldAbsorbed);
      expect(defender!.shieldBefore).toBe(attacker!.shieldBefore);
      expect(defender!.shieldAfter).toBe(attacker!.shieldAfter);

      for (const round of attacker!.rounds) {
        expect(round.attackerRoll).toBeGreaterThanOrEqual(COMBAT.varianceMin);
        expect(round.attackerRoll).toBeLessThanOrEqual(COMBAT.varianceMax);
        expect(round.defenderRoll).toBeGreaterThanOrEqual(COMBAT.varianceMin);
        expect(round.defenderRoll).toBeLessThanOrEqual(COMBAT.varianceMax);
        expect(round.attackerHullDamage).toBeGreaterThanOrEqual(0);
      }

      // Later recharge must never rewrite history.
      f.clock.advance(180);
      const [later] = await reportsFor(0);
      expect(later!.shieldBefore).toBe(attacker!.shieldBefore);
      expect(later!.shieldAfter).toBe(attacker!.shieldAfter);
    });

    it('marks calculation fields unknown on a report written before telemetry existed', async () => {
      const missionId = await raid();
      await f.db.update(battleReports).set({
        rounds: [{
          round: 1,
          attackerDamage: 40,
          defenderDamage: 10,
          shieldAbsorbed: 0,
          breacherShieldDamage: 0,
          attackerLosses: {},
          defenderLosses: {},
        }],
      }).where(eq(battleReports.missionId, missionId));

      const [legacy] = await reportsFor(0);
      expect(legacy!.shieldBefore).toBeNull();
      expect(legacy!.shieldAfter).toBeNull();
      expect(legacy!.rounds[0]).toMatchObject({
        attackerRoll: null,
        defenderRoll: null,
        shieldBefore: null,
        shieldAfter: null,
        attackerHullDamage: null,
      });
    });

    /** Per-round casualties were always in the payload; nothing may drop them. */
    it('keeps every round\u2019s casualties, which is where a fight turned', async () => {
      await raid();
      const [report] = await reportsFor(0);

      const perRound = report!.rounds.reduce(
        (sum, round) => sum + fleetCount(round.defenderLosses as never),
        0,
      );
      expect(perRound).toBe(fleetCount(report!.theirLosses as never));
    });

    /**
     * THE REPORT NAMES THE WORLD THE RAID WAS ACTUALLY FOUGHT OVER.
     *
     * The opponent lookup finds a commander's CAPITAL, which is how this game
     * identifies a person — right for the defender's copy, and wrong for the
     * attacker's the moment D97 let a commander hold colonies. "Their capital did
     * not hold" about a raid on their colony is the report describing the wrong
     * world, and `opponentPlanetId` is what the dossier matches on, so the fleet
     * destroyed at the colony was being filed as a floor on the capital.
     */
    it('names the colony that was raided, not the commander’s capital', async () => {
      const colony = f.planetIds[2]!;
      await f.db.update(planets)
        .set({ kind: 'COLONY', controllerPlayerId: f.playerIds[1]! })
        .where(eq(planets.id, colony));
      await setLevel(f.db, colony, 'CORE', 8);
      await grant(f.db, colony, 40_000, 4_000);
      await giveUnits(f.db, colony, { BASTION: 2 });
      await giveUnits(f.db, mine, { WASP: 40 });

      const launch = await launchAttack(f.db, mine, colony, { WASP: 40 }, f.clock);
      f.clock.set(settledAt(launch.arriveAt));
      await worker().tick();

      const [colonyName] = await f.db.select({ name: planets.name })
        .from(planets).where(eq(planets.id, colony));
      const [attacker] = await reportsFor(0);
      expect(attacker!.opponentPlanet).toBe(colonyName!.name);
      expect(attacker!.opponentPlanetId).toBe(colony);
      // The commander is still named — a colony belongs to somebody.
      expect(attacker!.opponentName).not.toBe('someone');

      // And the DEFENDER is still shown who hit them, by their home world.
      const [defender] = await reportsFor(1);
      expect(defender!.opponentPlanetId).toBe(mine);
    });

    /**
     * AND WHICH OF THE CALLER'S OWN WORLDS IT WAS.
     *
     * With one world per commander this was implicit. D97 gave them up to four,
     * and the record of a raid could no longer say which world was hit — or,
     * for the attacker, which one the fleet left from.
     */
    it('names the caller’s own world at both ends of the battle', async () => {
      await raid();
      const [mineName] = await f.db.select({ name: planets.name })
        .from(planets).where(eq(planets.id, mine));
      const [theirName] = await f.db.select({ name: planets.name })
        .from(planets).where(eq(planets.id, theirs));

      // The attacker launched from their world.
      const [attacker] = await reportsFor(0);
      expect(attacker!.yourPlanet).toBe(mineName!.name);
      expect(attacker!.opponentPlanet).toBe(theirName!.name);

      // The defender was hit at theirs, and the two are exact opposites.
      const [defender] = await reportsFor(1);
      expect(defender!.yourPlanet).toBe(theirName!.name);
      expect(defender!.opponentPlanet).toBe(mineName!.name);
    });

    /** A world with no commander still has a name, and it is on the map. */
    it('names an unclaimed world instead of calling it unknown', async () => {
      const neutral = (await f.db.select().from(planets)
        .where(eq(planets.kind, 'NEUTRAL'))).at(0);
      if (!neutral) return; // ruleset v1 seeds no caretaker worlds

      await giveUnits(f.db, mine, { WASP: 40 });
      const launch = await launchAttack(f.db, mine, neutral.id, { WASP: 40 }, f.clock);
      f.clock.set(settledAt(launch.arriveAt));
      await worker().tick();

      const [report] = await reportsFor(0);
      expect(report!.neutral).toBe(true);
      expect(report!.opponentPlanet).toBe(neutral.name);
      expect(report!.opponentPlanetId).toBe(neutral.id);
    });

    /**
     * A report written before D121 has no roster stored, so the payload carries an
     * empty one and the client omits the section rather than drawing a board of
     * nothing. The defaults on the columns are what make that true for real rows.
     */
    it('reads a report written before the roster existed', async () => {
      await raid();
      await f.db.execute(sql`
        UPDATE battle_reports
        SET attacker_fleet = '{}'::jsonb,
            defender_fleet = '{}'::jsonb,
            defence_salvage = '{}'::jsonb,
            disrupted_minutes = 0,
            wreck_value = 0
      `);

      const [report] = await reportsFor(0);
      expect(report!.yourFleet).toEqual({});
      expect(report!.defenceSalvage).toEqual({});
      expect(report!.wreckValue).toBe(0);
      // Everything that was always there still is.
      expect(fleetCount(report!.theirLosses as never)).toBeGreaterThan(0);
    });
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
