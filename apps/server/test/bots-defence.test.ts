import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { and, eq, sql } from 'drizzle-orm';
import {
  buildingCost, distance, fleetSpeed, fleetSpeedMult, interceptOrbit, piratePosition, sensorSphere, sensorZone,
  travelExact, type Fleet,
} from '@astera/rules';
import {
  buildOrders, missions, notifications, pirateRaids, planets, players, probeReports, seasons, units,
} from '../src/db/schema.js';
import { addBot, setBotStrength } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { answerWarnings, runBotTurn, type BotSeat } from '../src/services/bots/brain.js';
import { raidWarning } from '../src/services/bots/defence.js';
import { BOTS, BOT_PERSONAS } from '../src/services/bots/personas.js';
import { loadPirateSnapshot, privatePirateField } from '../src/services/pirateField.js';
import { techOf } from '../src/services/researchState.js';
import { rememberWorld } from '../src/services/intel.js';
import { planetView } from '../src/services/planetView.js';
import { addMinutes } from '../src/clock.js';
import { fuelUp, giveUnits, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * WHAT ONE OF THEM DOES WHEN ITS RADAR SAYS A FLEET IS COMING. Owner plan 2026-11-26 (F3.2).
 * It reads only its own warning, the one a person's phone shows. A raid it can beat finds the
 * fleet at home; one that outmatches it may find the pad empty and the store spent.
 */

const silent = pino({ level: 'silent' });
const react = () => 0;
const shrug = () => 0.999;
let f: Fixture, seat: BotSeat;

afterAll(async () => { await (await testDb()).close(); });

const viewOf = () => f.db.transaction((tx) => planetView(tx, seat.planetId, f.clock));

const seatUp = async (options: { pirates?: boolean } = {}) => {
  f = await seedWorld(2, 4242, options);
  const bot = await addBot(f.db, 'Nobetci', f.clock); // ordinal 0: BALANCED
  await ensureBotSeats(f.db, f.clock, silent);
  const [row] = await f.db.select({ playerId: players.id, planetId: planets.id }).from(players)
    .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
    .where(eq(players.accountId, bot.accountId));
  seat = { accountId: bot.accountId, playerId: row!.playerId, planetId: row!.planetId,
    seasonId: f.seasonId, seasonSeed: f.seed, ordinal: bot.ordinal, persona: 'BALANCED' };
  await f.db.update(players).set({
    joinedAt: addMinutes(f.clock.now(), -(BOTS.newPlayerGraceHours + 24) * 60), newcomerShieldUntil: null,
  }).where(sql`true`);
  await f.db.delete(units).where(eq(units.planetId, seat.planetId));
  await f.db.delete(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
};

/** A raid in the air at the bot's capital, from the first person in the fixture. */
const incoming = async (fleet: Fleet, minutes: number, warned: boolean): Promise<string> => {
  const [raid] = await f.db.insert(missions).values({
    fuelPaid: 0, seasonId: f.seasonId, kind: 'attack', status: 'in_flight',
    ownerPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, targetPlanetId: seat.planetId,
    fleet, distance: 100, departAt: f.clock.now(), arriveAt: addMinutes(f.clock.now(), minutes),
  }).returning();
  if (warned) {
    await f.db.insert(notifications).values({
      playerId: seat.playerId, kind: 'incoming_fleet', refId: raid!.id, createdAt: f.clock.now(),
      payload: { arriveAt: addMinutes(f.clock.now(), minutes).toISOString(), targetPlanetName: 'Home', fleet },
    });
  }
  return raid!.id;
};

describe('reading its own radar', () => {
  beforeEach(async () => { await seatUp(); });

  it('knows nothing of a raid its radar has not reported', async () => {
    await incoming({ WARDEN: 40 }, 15, false);
    expect(await raidWarning(f.db, seat.playerId, seat.planetId, await viewOf()))
      .toEqual({ warned: false, outmatched: false, impactAt: null, raidId: null });
  });

  it('tells a raid it can meet from one that outmatches it', async () => {
    await giveUnits(f.db, seat.planetId, { WARDEN: 30 });
    await incoming({ DART: 2 }, 15, true);
    expect(await raidWarning(f.db, seat.playerId, seat.planetId, await viewOf()))
      .toMatchObject({ warned: true, outmatched: false });
    const first = await incoming({ WARDEN: 400 }, 9, true);
    const warning = await raidWarning(f.db, seat.playerId, seat.planetId, await viewOf());
    expect(warning).toMatchObject({ warned: true, outmatched: true, raidId: first });
    expect(warning.impactAt).toEqual(addMinutes(f.clock.now(), 9));
  });
});

describe('a raid it can beat', () => {
  beforeEach(async () => { await seatUp(); });

  /** One person rich and open, freshly probed: F3.1 strikes on that the moment it can. */
  const tempting = async () => {
    const [scout] = await f.db.insert(missions).values({
      fuelPaid: 0, seasonId: f.seasonId, kind: 'probe', status: 'resolved', ownerPlayerId: seat.playerId,
      originPlanetId: seat.planetId, targetPlanetId: f.planetIds[1]!, fleet: {}, distance: 10,
      departAt: f.clock.now(), arriveAt: f.clock.now(),
    }).returning();
    const [report] = await f.db.insert(probeReports).values({
      observerPlayerId: seat.playerId, targetPlanetId: f.planetIds[1]!, missionId: scout!.id, accuracy: 1,
      stock: { low: 40_000, high: 40_000 }, defence: { low: 0, high: 0 }, fleetSize: { low: 0, high: 0 },
      shield: { low: 0, high: 0 }, unarmed: { low: 0, high: 0 }, fleetHome: true, detected: false,
      createdAt: f.clock.now(),
    }).returning();
    await f.db.transaction((tx) => rememberWorld(tx, {
      observerPlayerId: seat.playerId, targetPlanetId: f.planetIds[1]!, seasonId: f.seasonId,
      seenAt: f.clock.now(), source: 'PROBE', reportId: report!.id,
    }));
    await giveUnits(f.db, seat.planetId, { DART: 30, WARDEN: 30 });
    await fuelUp(f.db, seat.planetId);
    await setLevel(f.db, seat.planetId, 'HANGAR', 8);
  };

  it('strikes when nothing is coming', async () => {
    f.clock.advance(BOTS.ceasefireMinutes + 1);
    await tempting();
    expect((await runBotTurn(f.db, f.clock, seat, silent)).did).toContain('attack');
  });

  it('keeps the fleet home to meet it', async () => {
    f.clock.advance(BOTS.ceasefireMinutes + 1);
    await tempting();
    await incoming({ DART: 2 }, 20, true);
    for (let turn = 0; turn < 5; turn++) {
      const { did } = await runBotTurn(f.db, f.clock, seat, silent);
      expect(did).not.toContain('attack');
      expect(did).not.toContain('pirate');
      f.clock.advance(1);
    }
  });
});

describe('a raid that outmatches it', () => {
  it('spends a store it would otherwise keep in reserve', async () => {
    await seatUp();
    await setBotStrength(f.db, 'Nobetci', 'STRONG');
    for (const id of ['CORE', 'REFINERY', 'VAULT', 'SHIPYARD', 'HANGAR', 'DEUTERIUM_PLANT']) {
      await setLevel(f.db, seat.planetId, id, 10);
    }
    await setLevel(f.db, seat.planetId, 'EXTRACTOR', 9);
    const view = await viewOf();
    // Enough for the Extractor, not enough to leave two hours of production behind as well.
    const cost = buildingCost('EXTRACTOR', 9);
    await f.db.update(planets).set({ alloy: cost.alloy + 10, crystal: cost.crystal + 10, deuterium: cost.deuterium + 10 })
      .where(eq(planets.id, seat.planetId));
    expect(view.planet.alloyPerHour * BOTS.stockReserveHours).toBeGreaterThan(10);
    await giveUnits(f.db, seat.planetId, { DART: 2 });
    await incoming({ WARDEN: 400 }, 30, true);

    const calm: string[] = [];
    await answerWarnings(f.db, f.clock, seat, BOT_PERSONAS.BALANCED, 'NORMAL', await viewOf(), calm, silent, shrug, false);
    expect(calm).toEqual([]);

    const did: string[] = [];
    await answerWarnings(f.db, f.clock, seat, BOT_PERSONAS.BALANCED, 'STRONG', await viewOf(), did, silent, react, false);
    expect(did).toContain('reflex');
    expect(did).toContain('build:EXTRACTOR');
  });

  /**
   * ONE ROLL FOR EACH RAID, NOT FOR EACH TURN. A raid is warned across several turns; a roll each
   * turn would make an ordinary commander react to most raids and blur the strengths together.
   */
  it('rolls once for each raid, whatever turn it is read on', async () => {
    await seatUp();
    await giveUnits(f.db, seat.planetId, { DART: 2 });
    const raid = await incoming({ WARDEN: 400 }, 30, true);
    const asked: string[] = [];
    const roll = (raidId: string) => { asked.push(raidId); return 0.999; };
    await answerWarnings(f.db, f.clock, seat, BOT_PERSONAS.BALANCED, 'NORMAL', await viewOf(), [], silent, roll, false);
    expect(asked).toEqual([raid]);

    const reacted: boolean[] = [];
    for (let turn = 0; turn < 4; turn++) {
      reacted.push((await runBotTurn(f.db, f.clock, seat, silent)).did.includes('reflex'));
      f.clock.advance(5);
    }
    expect(new Set(reacted).size).toBe(1);
  });

  it('takes the whole fleet out after a pirate it can beat, away until the raid has landed', async () => {
    await seatUp({ pirates: true });
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const [home] = await f.db.select().from(planets).where(eq(planets.id, seat.planetId));
    const eye = sensorSphere({ x: home!.x, y: home!.y, z: home!.z }, 0, 0, seat.planetId);
    const seasonMinutes = (season!.endsAt.getTime() - season!.startsAt.getTime()) / 60_000;
    let seen = false;
    for (const spec of privatePirateField(season!.asteroidKey)) {
      for (let minute = Math.max(Math.ceil(spec.appearsAt) + 1, BOTS.ceasefireMinutes + 1);
        minute < Math.min(spec.expiresAt, seasonMinutes) && !seen; minute += 7) {
        if (sensorZone([eye], piratePosition(spec, minute)) === 'NONE') continue;
        f.clock.set(new Date(season!.startsAt.getTime() + minute * 60_000));
        seen = true;
      }
      if (seen) break;
    }
    expect(seen).toBe(true);
    const fleet = { DART: 120, PIKE: 60 };
    await giveUnits(f.db, seat.planetId, fleet);
    await fuelUp(f.db, seat.planetId);
    await incoming({ WARDEN: 4_000 }, 3, true);

    const did: string[] = [];
    await answerWarnings(f.db, f.clock, seat, BOT_PERSONAS.BALANCED, 'ELITE', await viewOf(), did, silent, react, true);
    expect(did).toContain('fleet-save');
    const [raid] = await f.db.select().from(pirateRaids).where(eq(pirateRaids.ownerPlayerId, seat.playerId));
    expect(raid?.fleet).toMatchObject(fleet);
  });
});

/**
 * THE PLAN'S OWN CRITERION (F3.2): the escape is not home before the raid lands. A pirate rides a
 * twenty-minute-to-two-hour orbit, so the trip is timed to where it will be met, not where it is.
 */
it('is still away when the raid lands, timed to where the pirate will be met', async () => {
  await seatUp({ pirates: true });
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  const [home] = await f.db.select().from(planets).where(eq(planets.id, seat.planetId));
  const from = { x: home!.x, y: home!.y, z: home!.z };
  const eye = sensorSphere(from, 0, 0, seat.planetId);
  const fleet = { DART: 400, PIKE: 200 };
  await giveUnits(f.db, seat.planetId, fleet);
  await fuelUp(f.db, seat.planetId);
  const speed = fleetSpeed(fleet, await techOf(f.db, seat.playerId)) * fleetSpeedMult((await viewOf()).orbit);
  const field = privatePirateField(season!.asteroidKey);
  const seasonMinutes = (season!.endsAt.getTime() - season!.startsAt.getTime()) / 60_000;

  // A visible pirate, nearest of all, coming towards it: where it is now overstates the trip.
  let impact: Date | null = null;
  for (let minute = BOTS.ceasefireMinutes + 1; minute < seasonMinutes && !impact; minute += 7) {
    const [nearest] = field.filter((spec) => spec.appearsAt <= minute && minute < spec.expiresAt)
      .map((spec) => ({ spec, d: distance(from, piratePosition(spec, minute)) }))
      .sort((a, b) => a.d - b.d);
    if (!nearest || sensorZone([eye], piratePosition(nearest.spec, minute)) === 'NONE') continue;
    const hit = interceptOrbit(from, speed, nearest.spec, nearest.spec.expiresAt, minute);
    if (!hit) continue;
    const away = hit.flightMinutes + travelExact(distance(from, hit.at), speed);
    const guessed = 2 * travelExact(nearest.d, speed);
    if (guessed - away < 4) continue;
    const now = new Date(season!.startsAt.getTime() + minute * 60_000);
    const standing = (await loadPirateSnapshot(f.db, f.seasonId, now)).standing(now);
    if (!standing.some((spec) => spec.index === nearest.spec.index)) continue;
    f.clock.set(now);
    impact = addMinutes(now, (away + guessed) / 2);
  }
  expect(impact).not.toBeNull();
  await incoming({ WARDEN: 40_000 }, (impact!.getTime() - f.clock.now().getTime()) / 60_000, true);

  await answerWarnings(f.db, f.clock, seat, BOT_PERSONAS.BALANCED, 'ELITE', await viewOf(), [], silent, react, true);
  for (const raid of await f.db.select().from(pirateRaids).where(eq(pirateRaids.ownerPlayerId, seat.playerId))) {
    const back = raid.arriveAt.getTime()
      + travelExact(distance(from, { x: raid.interceptX, y: raid.interceptY, z: raid.interceptZ }), speed) * 60_000;
    expect(back).toBeGreaterThan(impact!.getTime());
  }
});

it('reacts by strength: a guard nearly always, an ordinary commander now and then', () => {
  expect(BOTS.reflexChance).toEqual({ NORMAL: 0.25, STRONG: 0.6, ELITE: 0.9 });
});


/**
 * A GUARD GROWS ON ITS OWN ROUTE AND NEVER BUYS GUNS ON THE ORDINARY TURN, so the warning is where
 * it does (owner 2026-11-27, plan F3.2): a raid it can beat finds the ground defence filled, and a
 * raid that outmatches it finds the store spent on guns as well as on a building.
 */
describe('a guard under a warning', () => {
  it.each([
    ['a raid it can beat', { WARDEN: 30 }, { DART: 2 }],
    ['a raid that outmatches it', { DART: 2 }, { WARDEN: 400 }],
  ] as const)('fills its ground defence against %s', async (_case, home, raid) => {
    await seatUp();
    await setBotStrength(f.db, 'Nobetci', 'ELITE');
    for (const id of ['CORE', 'REFINERY', 'VAULT', 'SHIPYARD', 'HANGAR', 'DEUTERIUM_PLANT']) {
      await setLevel(f.db, seat.planetId, id, 10);
    }
    await f.db.update(planets).set({ alloy: 400_000, crystal: 400_000, deuterium: 400_000 })
      .where(eq(planets.id, seat.planetId));
    await giveUnits(f.db, seat.planetId, home);
    await incoming(raid, 30, true);

    const did: string[] = [];
    await answerWarnings(f.db, f.clock, seat, BOT_PERSONAS.BALANCED, 'ELITE', await viewOf(), did, silent, react, false);
    expect(did.some((step) => step.startsWith('ground:'))).toBe(true);
  });

  it('buys none while no warning is up', async () => {
    await seatUp();
    await setBotStrength(f.db, 'Nobetci', 'ELITE');
    const did: string[] = [];
    await answerWarnings(f.db, f.clock, seat, BOT_PERSONAS.BALANCED, 'ELITE', await viewOf(), did, silent, react, false);
    expect(did).toEqual([]);
  });
});
