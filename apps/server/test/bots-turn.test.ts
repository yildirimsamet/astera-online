import { beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { and, eq, sql } from 'drizzle-orm';
import {
  battleReports, botProfiles, buildOrders, buildings, missions, planets, players, probeReports, units,
} from '../src/db/schema.js';
import { addBot } from '../src/services/bots/roster.js';
import { buildUnits } from '../src/services/build.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import {
  BOT_AUTONOMOUS_LANES,
  drawLane, openLanes, probeCandidates, raidCandidates, runBotTurn, type BotSeat,
} from '../src/services/bots/brain.js';
import { BOTS, BOT_PERSONAS, type BotPersona } from '../src/services/bots/personas.js';
import { raidingWing } from '../src/services/bots/judgement.js';
import { rememberWorld } from '../src/services/intel.js';
import { planetView } from '../src/services/planetView.js';
import { addMinutes } from '../src/clock.js';
import { hangarCapacity, hangarCeiling, hangarLoad, hullBulk } from '@astera/rules';
import { fuelUp, giveUnits, grant, seedWorld, setLevel, type Fixture } from './helpers.js';

/**
 * WHAT ONE OF THEM IS ALLOWED TO DO.
 *
 * Two halves, and the second is the one that matters. The first is that a turn
 * actually plays: an idle world is the bug this feature exists to fix, so a
 * commander with money in the bank has to spend it. The second is the restraint —
 * a raid needs a record it earned, and a person who just joined is not a target.
 */

const silent = pino({ level: 'silent' });

it('never gives bots a galaxy-event or intergalactic-convoy lane', () => {
  expect(BOT_AUTONOMOUS_LANES).toEqual(['probe', 'mine', 'harvest', 'pirate', 'attack']);
  expect(BOT_AUTONOMOUS_LANES).not.toContain('intergalactic_convoy');
  expect(BOT_AUTONOMOUS_LANES).not.toContain('trade');
});

let f: Fixture;
let seat: BotSeat;

/** The bot's own world, and its two human neighbours from the fixture. */
const seatOf = async (): Promise<BotSeat> => {
  const [row] = await f.db
    .select({
      accountId: players.accountId,
      playerId: players.id,
      planetId: planets.id,
      seasonId: players.seasonId,
      persona: botProfiles.persona,
    })
    .from(players)
    .innerJoin(botProfiles, eq(botProfiles.accountId, players.accountId))
    .innerJoin(planets, and(
      eq(planets.controllerPlayerId, players.id),
      eq(planets.kind, 'CAPITAL'),
    ))
    .limit(1);
  return { ...row!, seasonSeed: f.seed, ordinal: 0 };
};

const viewOf = async () => f.db.transaction((tx) => planetView(tx, seat.planetId, f.clock));

/**
 * A RECORD IS WHAT A PROBE BROUGHT HOME: the outside of the world and its bands.
 * The default reading is an open, full world — the fixture states the wall when
 * the wall is what a test is about.
 */
const remember = async (
  targetPlanetId: string,
  seenAt: Date,
  bands: {
    defence?: { low: number; high: number };
    stock?: { low: number; high: number };
    fleetHome?: boolean;
  } = {},
): Promise<void> => {
  const [scout] = await f.db.insert(missions).values({
    fuelPaid: 0,
    seasonId: seat.seasonId,
    kind: 'probe',
    status: 'resolved',
    ownerPlayerId: seat.playerId,
    originPlanetId: seat.planetId,
    targetPlanetId,
    fleet: {},
    distance: 10,
    departAt: seenAt,
    arriveAt: seenAt,
  }).returning();
  const [report] = await f.db.insert(probeReports).values({
    observerPlayerId: seat.playerId,
    targetPlanetId,
    missionId: scout!.id,
    accuracy: 1,
    stock: bands.stock ?? { low: 40_000, high: 40_000 },
    defence: bands.defence ?? { low: 0, high: 0 },
    fleetSize: { low: 0, high: 0 },
    shield: { low: 0, high: 0 },
    unarmed: { low: 0, high: 0 },
    fleetHome: bands.fleetHome ?? true,
    detected: false,
    createdAt: seenAt,
  }).returning();
  await f.db.transaction(async (tx) => {
    await rememberWorld(tx, {
      observerPlayerId: seat.playerId,
      targetPlanetId,
      seasonId: seat.seasonId,
      seenAt,
      source: 'PROBE',
      reportId: report!.id,
    });
  });
};

/** A settled raid, as the report table records it — the only history the manners read. */
const raided = async (attackerPlayerId: string, defenderPlayerId: string, targetPlanetId: string,
  minutesAgo = 60): Promise<void> => {
  const at = addMinutes(f.clock.now(), -minutesAgo);
  const [battle] = await f.db.insert(missions).values({
    fuelPaid: 0,
    seasonId: seat.seasonId,
    kind: 'attack',
    status: 'resolved',
    ownerPlayerId: attackerPlayerId,
    originPlanetId: targetPlanetId,
    targetPlanetId,
    fleet: {},
    distance: 10,
    departAt: at,
    arriveAt: at,
  }).returning();
  await f.db.insert(battleReports).values({
    seasonId: seat.seasonId,
    missionId: battle!.id,
    attackerPlayerId,
    defenderPlayerId,
    targetPlanetId,
    targetKind: 'PLAYER',
    grade: 'DECISIVE',
    rounds: [],
    loot: { alloy: 0, crystal: 0, deuterium: 0 },
    attackerLosses: {},
    defenderLosses: {},
    createdAt: at,
  });
};

/**
 * Nobody in this fixture joined recently enough to be a protected newcomer, and
 * nobody — bots included, since 2026-09-19 — still holds a first-day shield.
 */
const settleNeighbours = async (): Promise<void> => {
  await f.db
    .update(players)
    .set({
      joinedAt: addMinutes(f.clock.now(), -(BOTS.newPlayerGraceHours + 24) * 60),
      newcomerShieldUntil: null,
    })
    .where(sql`true`);
};

/**
 * A SEAT IS SEATED AS AN ACADEMY GRADUATE, AND THESE TESTS ARE NOT ABOUT THAT.
 *
 * `ensureBotSeats` joins with `ACADEMY_STEPS.length` completed, so every seat
 * arrives holding `{ DART: 3, WARDEN: 1, PROSPECTOR: 1, COURIER: 1 }` and with a
 * CORE upgrade already in its construction queue — `academyExitCheckpoint` falls
 * back to `'CORE'` once the three opening buildings are past level 2.
 *
 * Both are correct for a graduate and both are noise here: every test below states
 * the world it wants to reason about — no warships, no craft at all, a Core at its
 * ceiling — and inherits a fixture that contradicts it. Clearing the two is the
 * same move `seedWorld` makes for the newcomer shield: a fixture states its world
 * rather than leaving a later feature's starting state to leak into an assertion
 * about a different rule.
 *
 * WHAT IT DOES NOT DO IS CHANGE A RULE. The Core ceiling gate reads
 * `buildings.CORE + queuedCount(CONSTRUCTION, CORE)` and works; what the test was
 * finding was the order SEATING created, never one a turn made.
 */
const emptySeat = async (): Promise<void> => {
  await f.db.delete(units).where(eq(units.planetId, seat.planetId));
  await f.db.delete(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
};

beforeEach(async () => {
  f = await seedWorld(2);
  await addBot(f.db, 'Kara Şahin', f.clock);
  await ensureBotSeats(f.db, f.clock, silent);
  seat = await seatOf();
  await settleNeighbours();
  await emptySeat();
});

describe('a bot turn', () => {
  it('spends what it has rather than sitting on it', async () => {
    await grant(f.db, seat.planetId, 200_000, 80_000);
    const result = await runBotTurn(f.db, f.clock, seat, silent);
    expect(result.did.length).toBeGreaterThan(0);

    const orders = await f.db
      .select({ id: buildOrders.id })
      .from(buildOrders)
      .where(eq(buildOrders.planetId, seat.planetId));
    expect(orders.length).toBeGreaterThan(0);
  });

  /**
   * A BOT KEEPS A STORE A RAIDER CAN FIND. Owner decision, 2026-09-19: the roster is
   * the outlet that takes pressure off people, and a world scraped to zero every
   * seven minutes is an outlet nobody bothers to probe twice.
   */
  it('keeps two hours of production in the store instead of building with it', async () => {
    expect(BOTS.stockReserveHours).toBe(2);
    await grant(f.db, seat.planetId, 200_000, 80_000);
    const rate = (await viewOf()).planet.alloyPerHour;
    await f.db.update(planets)
      .set({ alloy: rate * (BOTS.stockReserveHours - 0.1), crystal: 1_000_000, deuterium: 1_000_000 })
      .where(eq(planets.id, seat.planetId));
    await runBotTurn(f.db, f.clock, seat, silent);
    const built = await f.db
      .select({ id: buildOrders.id })
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, seat.planetId), eq(buildOrders.queue, 'CONSTRUCTION')));
    expect(built).toHaveLength(0);
  });

  /** A raid brings the haul home in a hold; a bot keeps one, as a raider does. */
  it('keeps cargo hulls to carry a haul home', async () => {
    expect(BOTS.courierTarget).toBe(2);
    await grant(f.db, seat.planetId, 200_000, 80_000);
    await setLevel(f.db, seat.planetId, 'HANGAR', 8);
    // One yard order a turn, and the Prospector is ordered first.
    const did: string[] = [];
    for (let turn = 0; turn < 3; turn++) {
      did.push(...(await runBotTurn(f.db, f.clock, seat, silent)).did);
      f.clock.advance(1);
    }
    expect(did).toContain('ship:COURIER');
  });

  it('never lifts its Core past the ceiling the owner set', async () => {
    // `grant` raises the Core to whatever will hold the purse, so the ceiling is
    // set AFTER the money — otherwise the fixture is what breaks the rule.
    await grant(f.db, seat.planetId, 400_000, 150_000);
    await setLevel(f.db, seat.planetId, 'CORE', BOTS.coreCeiling);
    for (let turn = 0; turn < 6; turn++) {
      await runBotTurn(f.db, f.clock, seat, silent);
      f.clock.advance(1);
    }
    const queuedCore = await f.db
      .select({ subject: buildOrders.subject })
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, seat.planetId), eq(buildOrders.subject, 'CORE')));
    expect(queuedCore).toHaveLength(0);

    const [core] = await f.db
      .select({ level: buildings.level })
      .from(buildings)
      .where(and(eq(buildings.planetId, seat.planetId), eq(buildings.type, 'CORE')));
    expect(core?.level).toBe(BOTS.coreCeiling);
  });

  /**
   * THE HANGAR IS THE BOT'S CEILING TOO. 2026-09-18.
   *
   * A bot ordering past its room would only be refused, turn after turn, and its
   * alloy would sit idle; one that never raises its Hangar would stall at the base
   * rung while the people around it grow. Both are shapes a player would read as
   * "the other commanders are broken".
   */
  it('orders only as many ships as its Hangar has room for', async () => {
    await setLevel(f.db, seat.planetId, 'CORE', 10);
    await setLevel(f.db, seat.planetId, 'SHIPYARD', 4);
    await grant(f.db, seat.planetId, 2_000_000, 600_000);
    await setLevel(f.db, seat.planetId, 'HANGAR', 1);
    await giveUnits(f.db, seat.planetId, { RAMPART: (hangarCapacity(1) - 24) / hullBulk('RAMPART') });

    for (let turn = 0; turn < 4; turn++) {
      await runBotTurn(f.db, f.clock, seat, silent);
      f.clock.advance(1);
    }
    const view = await viewOf();
    const queued = view.queues.YARD.reduce(
      (sum, order) => sum + hangarLoad({ [order.subject]: order.count }), 0);
    expect(view.capacity.hangarUsed).toBeLessThanOrEqual(hangarCapacity(1));
    expect(queued).toBeGreaterThan(0);
    expect(view.capacity.hangarUsed + queued).toBeLessThanOrEqual(hangarCapacity(1));
  });

  /**
   * TWO ORDERS OF ONE HULL ARE TWO ORDERS. The yard queue was folded into a record
   * keyed by hull, so a second Dart batch overwrote the first and the bot believed it
   * had room it did not — the server refused every order that turn.
   */
  it('counts every queued batch of the same hull against its room', async () => {
    await setLevel(f.db, seat.planetId, 'CORE', 10);
    await setLevel(f.db, seat.planetId, 'SHIPYARD', 4);
    await grant(f.db, seat.planetId, 2_000_000, 600_000);
    await setLevel(f.db, seat.planetId, 'HANGAR', 1);
    const dart = hullBulk('DART');
    // 80 room: 20 standing, 2 × 15 queued in two batches, 30 genuinely free.
    // Its Prospectors are already owned, so the only ship it can buy is a warship.
    await giveUnits(f.db, seat.planetId, { RAMPART: 12 / hullBulk('RAMPART'), PROSPECTOR: 2 });
    await buildUnits(f.db, seat.planetId, 'DART', 15 / dart, f.clock);
    await buildUnits(f.db, seat.planetId, 'DART', 15 / dart, f.clock);

    const result = await runBotTurn(f.db, f.clock, seat, silent);
    expect(result.did.filter((step) => step.startsWith('ship:'))).not.toHaveLength(0);
    const view = await viewOf();
    const queued = view.queues.YARD.reduce(
      (sum, order) => sum + hangarLoad({ [order.subject]: order.count }), 0);
    expect(view.capacity.hangarUsed + queued).toBeLessThanOrEqual(hangarCapacity(1));
  });

  // Every other building stands at the bot's Core ceiling, so the only thing left
  // to raise is whatever the Hangar gate allows.
  it('raises its Hangar once the Core has opened the next rung', async () => {
    await grant(f.db, seat.planetId, 2_000_000, 600_000);
    for (const type of ['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD']) {
      await setLevel(f.db, seat.planetId, type, BOTS.coreCeiling);
    }
    await setLevel(f.db, seat.planetId, 'HANGAR', hangarCeiling(BOTS.coreCeiling) - 1);
    await runBotTurn(f.db, f.clock, seat, silent);

    const orders = await f.db
      .select({ subject: buildOrders.subject })
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, seat.planetId), eq(buildOrders.kind, 'BUILDING')));
    expect(orders.map((order) => order.subject)).toContain('HANGAR');
  });

  it('never queues a Hangar rung its Core has not opened', async () => {
    await grant(f.db, seat.planetId, 2_000_000, 600_000);
    for (const type of ['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD']) {
      await setLevel(f.db, seat.planetId, type, BOTS.coreCeiling);
    }
    await setLevel(f.db, seat.planetId, 'HANGAR', hangarCeiling(BOTS.coreCeiling));
    await runBotTurn(f.db, f.clock, seat, silent);

    const orders = await f.db
      .select({ subject: buildOrders.subject })
      .from(buildOrders)
      .where(and(eq(buildOrders.planetId, seat.planetId), eq(buildOrders.kind, 'BUILDING')));
    expect(orders.map((order) => order.subject)).not.toContain('HANGAR');
  });

  it('does not offer a raid to a world that owns no warship', async () => {
    // A young world owns a Prospector and no warships. Counting "does it own
    // anything that flies" opens the raid and pirate lanes, `raidingWing` then
    // returns an empty manifest, and the turn's ONE flight is spent on nothing —
    // on exactly the commanders whose worlds most need to look busy.
    await giveUnits(f.db, seat.planetId, { PROSPECTOR: 1 });
    const lanes = openLanes(await viewOf());
    expect(lanes).toContain('mine');
    expect(lanes).toContain('harvest');
    expect(lanes).not.toContain('attack');
    expect(lanes).not.toContain('pirate');
  });

  it('offers a raid the moment there is something to raid with', async () => {
    await giveUnits(f.db, seat.planetId, { PROSPECTOR: 1, DART: 3 });
    await setLevel(f.db, seat.planetId, 'HANGAR', 8);
    expect(openLanes(await viewOf())).toEqual(
      expect.arrayContaining(['probe', 'mine', 'harvest', 'pirate', 'attack']),
    );
  });

  it('always leaves scouting open, even with nothing on the pad', async () => {
    // A world with no craft at all still has something to do with its turn, and it
    // is the lane that earns the record every raid needs.
    expect(openLanes(await viewOf())).toEqual(['probe']);
  });

  it('survives a world that can afford nothing at all', async () => {
    await f.db.update(planets)
      .set({ alloy: 0, crystal: 0, deuterium: 0 })
      .where(eq(planets.id, seat.planetId));
    await expect(runBotTurn(f.db, f.clock, seat, silent)).resolves.toBeDefined();
  });
});

describe('what a bot may raid', () => {
  it('refuses every world it has never had eyes on', async () => {
    const candidates = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(candidates).toHaveLength(0);
  });

  it('accepts a world once it holds a fresh record of it', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    const candidates = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(candidates.map((c) => c.planetId)).toEqual([f.planetIds[0]]);
  });

  it('lets a record go stale, exactly as the record age says', async () => {
    await remember(f.planetIds[0]!, addMinutes(f.clock.now(), -(BOTS.recordFreshMinutes + 1)));
    const candidates = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(candidates).toHaveLength(0);
  });

  it('leaves a commander who joined this week alone', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    await f.db
      .update(players)
      .set({ joinedAt: addMinutes(f.clock.now(), -60) })
      .where(eq(players.id, f.playerIds[0]!));
    const candidates = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(candidates).toHaveLength(0);
  });

  it('does not punch down past the band', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    await setLevel(f.db, seat.planetId, 'CORE', 8);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 8 - BOTS.playerCoreFloorGap - 1);
    const candidates = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(candidates).toHaveLength(0);
  });

  /**
   * A BOT NEVER OFFERS ITSELF A TARGET THE GATE WOULD REFUSE. D168.
   *
   * The band is enforced at launch for everybody, bots included, so a candidate
   * list that ignores it does not produce a rule-breaking raid — it produces a
   * wasted turn and a logged refusal, once per sweep, on the commanders whose
   * whole job is to make the disc look busy. `withinTierBand` is read here rather
   * than re-derived, so the list and the gate cannot drift apart.
   */
  it('drops a world whose commander is outside the band, in both directions', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    await setLevel(f.db, seat.planetId, 'CORE', 8); // tier 3

    await setLevel(f.db, f.planetIds[0]!, 'CORE', 14); // tier 5, two up
    expect(await raidCandidates(f.db, f.clock.now(), seat, await viewOf())).toHaveLength(0);

    await setLevel(f.db, f.planetIds[0]!, 'CORE', 11); // tier 4, inside the band
    expect(await raidCandidates(f.db, f.clock.now(), seat, await viewOf())).toHaveLength(1);
  });

  it('measures the target commander, not the world it is looking at', async () => {
    // The remembered world is tier 1; its owner also holds a tier 5 capital, and
    // the band reads the commander.
    await remember(f.planetIds[1]!, f.clock.now());
    await setLevel(f.db, seat.planetId, 'CORE', 2); // tier 1
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 1);
    await f.db
      .update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, f.planetIds[1]!));
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 14); // tier 5 capital

    expect(await raidCandidates(f.db, f.clock.now(), seat, await viewOf())).toHaveLength(0);
  });

  it('weighs another bot above a person', async () => {
    await addBot(f.db, 'Yıldız', f.clock);
    await ensureBotSeats(f.db, f.clock, silent);
    await settleNeighbours();
    const [other] = await f.db
      .select({ planetId: planets.id })
      .from(players)
      .innerJoin(planets, and(
        eq(planets.controllerPlayerId, players.id),
        eq(planets.kind, 'CAPITAL'),
      ))
      .where(and(
        sql`${players.accountId} IN (SELECT account_id FROM bot_profiles)`,
        sql`${planets.id} <> ${seat.planetId}`,
      ))
      .limit(1);
    await remember(other!.planetId, f.clock.now());
    await remember(f.planetIds[0]!, f.clock.now());

    const candidates = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    const bot = candidates.find((c) => c.planetId === other!.planetId);
    const human = candidates.find((c) => c.planetId === f.planetIds[0]);
    expect(bot?.weight).toBe(BOTS.botTargetBias);
    expect(human?.weight).toBe(1);
    expect(bot!.weight).toBeGreaterThan(human!.weight);
  });

  /**
   * ONE BOT RAID A DAY ON A PERSON, FROM ALL OF THEM TOGETHER. Owner instruction,
   * 2026-09-19. The old manners counted per bot, so eight of them could each take
   * their two and one person would wake to sixteen reports.
   */
  it('leaves a person alone for the day once any bot has struck them', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    expect(BOTS.botRaidsPerPersonPerDay).toBe(1);
    await addBot(f.db, 'Yıldız', f.clock);
    await ensureBotSeats(f.db, f.clock, silent);
    const [other] = await f.db
      .select({ playerId: players.id })
      .from(players)
      .where(and(
        sql`${players.accountId} IN (SELECT account_id FROM bot_profiles)`,
        sql`${players.id} <> ${seat.playerId}`,
      ));
    await raided(other!.playerId, f.playerIds[0]!, f.planetIds[0]!, 23 * 60);
    expect(await raidCandidates(f.db, f.clock.now(), seat, await viewOf())).toHaveLength(0);
  });

  /** A report is written when the fleet LANDS; a raid still in the air counts too. */
  it('counts a bot raid still in the air against the day', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    await f.db.insert(missions).values({
      fuelPaid: 0,
      seasonId: seat.seasonId,
      kind: 'attack',
      status: 'in_flight',
      ownerPlayerId: seat.playerId,
      originPlanetId: seat.planetId,
      targetPlanetId: f.planetIds[0]!,
      fleet: { DART: 1 },
      distance: 10,
      departAt: f.clock.now(),
      arriveAt: addMinutes(f.clock.now(), 30),
    });
    expect(await raidCandidates(f.db, f.clock.now(), seat, await viewOf())).toHaveLength(0);
  });

  it('forgets a bot raid once a day has passed', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    await raided(seat.playerId, f.playerIds[0]!, f.planetIds[0]!, 24 * 60 + 5);
    expect(await raidCandidates(f.db, f.clock.now(), seat, await viewOf())).toHaveLength(1);
  });

  /**
   * THE BULLY IS THE ONE THEY GO LOOKING FOR. Owner instruction, 2026-09-19: five
   * or more raids on PEOPLE in a day. Raids on the server's own commanders are the
   * outlet this feature wants to be used, so they never count.
   */
  it('weighs a commander who struck people five times today above everybody', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    for (let i = 0; i < 5; i++) await raided(f.playerIds[0]!, f.playerIds[1]!, f.planetIds[1]!, 30 + i);
    const [bully] = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(bully?.weight).toBe(BOTS.bullyTargetBias);
    expect(BOTS.bullyTargetBias).toBeGreaterThan(BOTS.botTargetBias);
  });

  it('does not call four raids a day bullying', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    for (let i = 0; i < 4; i++) await raided(f.playerIds[0]!, f.playerIds[1]!, f.planetIds[1]!, 30 + i);
    const [person] = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(person?.weight).toBe(1);
  });

  it('never counts raids on the server’s own commanders against a person', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    for (let i = 0; i < 6; i++) await raided(f.playerIds[0]!, seat.playerId, seat.planetId, 30 + i);
    const [person] = await raidCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(person?.weight).toBe(1);
  });

  /** A bully nobody has looked at yet is who the next probe goes to find. */
  it('looks at a bully before anybody else it has no record of', async () => {
    for (let i = 0; i < 5; i++) await raided(f.playerIds[1]!, f.playerIds[0]!, f.planetIds[0]!, 30 + i);
    const candidates = await probeCandidates(f.db, f.clock.now(), seat, await viewOf());
    const bully = candidates.find((c) => c.planetId === f.planetIds[1]);
    const person = candidates.find((c) => c.planetId === f.planetIds[0]);
    expect(bully?.weight).toBe(BOTS.bullyTargetBias);
    expect(person?.weight).toBe(1);
  });

  it('does not look again at a world it holds a fresh record of', async () => {
    await remember(f.planetIds[0]!, f.clock.now());
    const candidates = await probeCandidates(f.db, f.clock.now(), seat, await viewOf());
    expect(candidates.map((c) => c.planetId)).not.toContain(f.planetIds[0]);
  });

  it('keeps a garrison at home rather than flying the whole fleet', () => {
    const send = raidingWing({ DART: 10, RAMPART: 4, PROSPECTOR: 2, BASTION: 3 }, 0.7);
    expect(send.DART).toBe(7);
    expect(send.RAMPART).toBe(2);
    // A miner does not raid and a gun does not fly.
    expect(send.PROSPECTOR).toBeUndefined();
    expect(send.BASTION).toBeUndefined();
  });

  it('actually launches at a world it is allowed to hit', async () => {
    /*
      PAST THE OPENING CEASEFIRE. D170 keeps every bot off the PvP lane for the
      first `BOTS.ceasefireMinutes` of a season, so a raid test has to be in a
      galaxy old enough to have one — the clock moves rather than the rule.
    */
    f.clock.advance(BOTS.ceasefireMinutes + 1);
    await remember(f.planetIds[0]!, f.clock.now());
    await giveUnits(f.db, seat.planetId, { DART: 30 });
    await fuelUp(f.db, seat.planetId);
    await setLevel(f.db, seat.planetId, 'HANGAR', 8);

    // The lane is drawn from the habit's weights, so give the turn several chances
    // rather than reaching inside the draw.
    for (let turn = 0; turn < 25; turn++) {
      await runBotTurn(f.db, f.clock, seat, silent);
      const flying = await f.db
        .select({ id: missions.id })
        .from(missions)
        .where(and(eq(missions.originPlanetId, seat.planetId), eq(missions.kind, 'attack')));
      if (flying.length > 0) return;
      f.clock.advance(1);
    }
    throw new Error('a bot with a fresh record, ships and fuel never raided');
  });

  /** Launches the turns a person would take and reports what flew where. */
  const playTurns = async (turns: number) => {
    for (let turn = 0; turn < turns; turn++) {
      await runBotTurn(f.db, f.clock, seat, silent);
      f.clock.advance(1);
    }
    return f.db
      .select({ kind: missions.kind, target: missions.targetPlanetId })
      .from(missions)
      .where(and(eq(missions.originPlanetId, seat.planetId), eq(missions.ownerPlayerId, seat.playerId)));
  };

  /**
   * A READING HOURS OLD IS LOOKED AT AGAIN BEFORE A FLEET GOES. A record stays a
   * record for twelve hours, but no person raids on a morning's probe at night.
   */
  it('re-scouts a target whose reading has gone old rather than raiding on it', async () => {
    f.clock.advance(BOTS.ceasefireMinutes + 1);
    await remember(f.planetIds[0]!, addMinutes(f.clock.now(), -(BOTS.readingFreshMinutes + 5)));
    await remember(f.planetIds[1]!, f.clock.now(), { defence: { low: 900_000, high: 900_000 } });
    await giveUnits(f.db, seat.planetId, { DART: 30 });
    await fuelUp(f.db, seat.planetId);
    await setLevel(f.db, seat.planetId, 'HANGAR', 8);

    const flown = await playTurns(25);
    expect(flown.filter((m) => m.kind === 'attack')).toEqual([]);
    expect(flown).toContainEqual({ kind: 'probe', target: f.planetIds[0] });
  });

  /** A probe that found the fleet out saw a wall that comes home. */
  it('does not trust a reading taken while the fleet was away', async () => {
    f.clock.advance(BOTS.ceasefireMinutes + 1);
    await remember(f.planetIds[0]!, f.clock.now(), { fleetHome: false });
    await remember(f.planetIds[1]!, f.clock.now(), { defence: { low: 900_000, high: 900_000 } });
    await giveUnits(f.db, seat.planetId, { DART: 30 });
    await fuelUp(f.db, seat.planetId);
    await setLevel(f.db, seat.planetId, 'HANGAR', 8);

    const flown = await playTurns(25);
    expect(flown.filter((m) => m.kind === 'attack')).toEqual([]);
  });

  /** The owner's report, as a fixture: two Darts and a world holding a war fleet. */
  it('never throws a handful of ships at a wall its probe says it cannot beat', async () => {
    f.clock.advance(BOTS.ceasefireMinutes + 1);
    await remember(f.planetIds[0]!, f.clock.now(), { defence: { low: 400_000, high: 500_000 } });
    await giveUnits(f.db, seat.planetId, { DART: 2 });
    await fuelUp(f.db, seat.planetId);

    for (let turn = 0; turn < 25; turn++) {
      await runBotTurn(f.db, f.clock, seat, silent);
      f.clock.advance(1);
    }
    const flying = await f.db
      .select({ id: missions.id })
      .from(missions)
      .where(and(eq(missions.originPlanetId, seat.planetId), eq(missions.kind, 'attack')));
    expect(flying).toHaveLength(0);
  });
});

/**
 * A WEIGHT OF ZERO MEANS NEVER. D166.
 *
 * Both weighted draws in this file walked their table as `roll -= weight; if
 * (roll <= 0) return`. `mulberry32` can return exactly 0, which makes `roll` 0 —
 * and the FIRST entry then satisfies `0 <= 0` however small its weight is. So a
 * persona configured never to raid could still launch one, and a candidate list
 * whose first world was worth nothing could still be picked.
 *
 * It is rare by construction and that is precisely why it needed a test: a bug that
 * fires on one draw in four billion is one nobody will ever reproduce by playing.
 */
describe('drawing from a weighted table', () => {
  const zeroRng = () => 0;
  /** A persona with exactly the weights this test cares about and nothing else. */
  const weighted = (over: Partial<BotPersona['flight']>): BotPersona => ({
    ...BOT_PERSONAS.BUILDER,
    flight: { probe: 0, mine: 0, harvest: 0, pirate: 0, attack: 0, idle: 0, ...over },
  });

  it('never draws a lane the persona has weighted at zero', () => {
    const persona = weighted({ attack: 0, probe: 0, mine: 0, idle: 1 });
    expect(drawLane(persona, ['attack', 'probe', 'mine'], zeroRng)).toBeNull();
  });

  it('still draws the only lane that has any weight', () => {
    const persona = weighted({ attack: 0, probe: 1, mine: 0, idle: 0 });
    expect(drawLane(persona, ['attack', 'probe', 'mine'], zeroRng)).toBe('probe');
  });

  it('returns nothing when every lane is weighted at zero', () => {
    const persona = weighted({ attack: 0, probe: 0, mine: 0, idle: 0 });
    expect(drawLane(persona, ['attack'], zeroRng)).toBeNull();
  });

  /** The ordinary case is untouched: a full-weight table still answers. */
  it('draws normally from a table that has weight in it', () => {
    // `idle` is the table's last entry and is weighted at zero here, so a high roll
    // has to land on a real lane rather than on doing nothing.
    const persona = weighted({ attack: 1, probe: 1, mine: 1, idle: 0 });
    expect(drawLane(persona, ['attack', 'probe'], () => 0.99)).toBe('probe');
  });
});
