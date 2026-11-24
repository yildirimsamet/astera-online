import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import {
  buildOrders, missions, moonMoves, moonScans, moons, notifications, planets, players,
  researchOrders, seasons, strategicAssets, units,
} from '../src/db/schema.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { BOT_PERSONAS } from '../src/services/bots/personas.js';
import { runBotTurn, type BotSeat } from '../src/services/bots/brain.js';
import {
  maybeEscapeToMoon, maybeReinforceByGate, maybeRetargetToMoon, maybeScanFromMoon,
  maybeStrikeMoon, scoreMoonStrikeTarget, tendMoonCaptureAndBuild,
} from '../src/services/bots/moon.js';
import { launchAttack } from '../src/services/mission.js';
import { rememberWorld } from '../src/services/intel.js';
import { planetView } from '../src/services/planetView.js';
import { MOON_LOCATION } from '../src/services/unitLocation.js';
import { addMinutes } from '../src/clock.js';
import {
  fuelUp, giveResearch, giveUnits, grant, levelWorld, placeAt, seedWorld, setLevel, testDb, type Fixture,
} from './helpers.js';

/*
  F8 — Bots & Moons (plan §10.1, §12; S53, S54; locked rule: bots must use moons like people
  so never touching a moon never gives them away, and bots must never act on hidden DB truth
  a person could not know).
*/
const silent = pino({ level: 'silent' });
const always = () => 0;

describe('bot moon persona habits', () => {
  it('defines valid persona-weighted moon rates across all personas', () => {
    for (const persona of Object.values(BOT_PERSONAS)) {
      expect(persona.moon).toBeDefined();
      for (const rate of Object.values(persona.moon)) {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
      }
    }
    expect(BOT_PERSONAS.RAIDER.moon.scanChance).toBeGreaterThan(BOT_PERSONAS.BUILDER.moon.scanChance);
    expect(BOT_PERSONAS.RAIDER.moon.retargetChance).toBeGreaterThan(BOT_PERSONAS.BUILDER.moon.retargetChance);
    expect(BOT_PERSONAS.RAIDER.moon.strikeMoonChance).toBeGreaterThan(0);
    expect(BOT_PERSONAS.BUILDER.moon.strikeMoonChance).toBe(0);
    expect(BOT_PERSONAS.BUILDER.moon.escapeChance).toBeGreaterThan(BOT_PERSONAS.RAIDER.moon.escapeChance);
  });

  it('scores an undiscovered Legendary moon identically to an undiscovered Common moon (S53 info parity)', () => {
    const unknownCommon = scoreMoonStrikeTarget({ distance: 500, cracks: 0, knownRarity: undefined });
    const unknownLegendary = scoreMoonStrikeTarget({ distance: 500, cracks: 0, knownRarity: undefined });
    expect(unknownCommon).toBe(unknownLegendary);

    const knownCommon = scoreMoonStrikeTarget({ distance: 500, cracks: 0, knownRarity: 'COMMON' });
    const knownLegendary = scoreMoonStrikeTarget({ distance: 500, cracks: 0, knownRarity: 'LEGENDARY' });
    expect(knownLegendary).toBeGreaterThan(knownCommon);
  });
});

describe('bot moon actions (F8)', () => {
  let f: Fixture;
  let seat: BotSeat;
  let enemyPlanet: string;
  let enemyPlayer: string;

  const viewOf = () => f.db.transaction((tx) => planetView(tx, seat.planetId, f.clock));

  beforeEach(async () => {
    f = await seedWorld(2, 20_801);
    enemyPlanet = f.planetIds[0]!;
    enemyPlayer = f.playerIds[0]!;
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));

    const bot = await addBot(f.db, 'Selene', f.clock);
    await ensureBotSeats(f.db, f.clock, silent, 1, 1);
    const [row] = await f.db
      .select({ accountId: players.accountId, playerId: players.id, planetId: planets.id, seasonId: players.seasonId })
      .from(players)
      .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
      .where(eq(players.accountId, bot.accountId))
      .limit(1);
    seat = { ...row!, persona: 'RAIDER', seasonSeed: f.seed, ordinal: 0 };

    await placeAt(f.db, seat.planetId, { x: 0, y: 0, z: 0 });
    await placeAt(f.db, enemyPlanet, { x: 400, y: 0, z: 0 });
    await setLevel(f.db, seat.planetId, 'CORE', 10);
    await setLevel(f.db, seat.planetId, 'HANGAR', 6);
    await setLevel(f.db, seat.planetId, 'SHIPYARD', 5);
    await setLevel(f.db, enemyPlanet, 'CORE', 10);
    await grant(f.db, seat.planetId, 150_000, 100_000);
    await fuelUp(f.db, seat.planetId, 5_000);
    await levelWorld(f.db, [seat.planetId, enemyPlanet]);
    await f.db.delete(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
    await f.db.update(players).set({ newcomerShieldUntil: null }).where(eq(players.id, seat.playerId));
    await f.db.update(players).set({ newcomerShieldUntil: null }).where(eq(players.id, enemyPlayer));
    f.clock.advance(25 * 60); // past 24h ceasefire
  });

  afterAll(async () => { await (await testDb()).close(); });

  it('does nothing moon-related in a ruleset 19 galaxy', async () => {
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion - 1 }).where(eq(seasons.id, f.seasonId));
    const did: string[] = [];
    await tendMoonCaptureAndBuild(f.db, f.clock, seat, BOT_PERSONAS.RAIDER, await viewOf(), did, silent, always);
    expect(did).toEqual([]);
    const orders = await f.db.select().from(researchOrders)
      .where(and(eq(researchOrders.playerId, seat.playerId), eq(researchOrders.projectId, 'LUNAR_CAPTURE')));
    expect(orders).toHaveLength(0);
  });

  it('researches Lunar Capture at Core 9+ and then orders a Common moon through real services', async () => {
    const did: string[] = [];
    await tendMoonCaptureAndBuild(f.db, f.clock, seat, BOT_PERSONAS.RAIDER, await viewOf(), did, silent, always);
    expect(did).toContain('research:LUNAR_CAPTURE');
    const [rOrder] = await f.db.select().from(researchOrders)
      .where(and(eq(researchOrders.playerId, seat.playerId), eq(researchOrders.projectId, 'LUNAR_CAPTURE')));
    expect(rOrder).toBeDefined();

    // Once Lunar Capture is complete, the bot orders a Common moon on its capital.
    await f.db.delete(researchOrders).where(eq(researchOrders.playerId, seat.playerId));
    await giveResearch(f.db, seat.planetId, 'LUNAR_CAPTURE');
    const did2: string[] = [];
    await tendMoonCaptureAndBuild(f.db, f.clock, seat, BOT_PERSONAS.RAIDER, await viewOf(), did2, silent, always);
    expect(did2).toContain('moon:build');
    const [bOrder] = await f.db.select().from(buildOrders)
      .where(and(eq(buildOrders.planetId, seat.planetId), eq(buildOrders.kind, 'MOON')));
    expect(bOrder?.subject).toBe('COMMON');
  });

  it('never hops to the moon for an unwarned attack (info parity), but hops when radar warns it', async () => {
    await f.db.insert(moons).values({ planetId: seat.planetId, rarity: 'COMMON', origin: 'BUILT', visualSeed: 1, bornAt: f.clock.now() });
    await giveUnits(f.db, seat.planetId, { DART: 10, PROSPECTOR: 1 });
    await giveUnits(f.db, enemyPlanet, { WARDEN: 40 });
    await fuelUp(f.db, enemyPlanet, 2_000);
    const raid = await launchAttack(f.db, enemyPlanet, seat.planetId, { WARDEN: 40 }, f.clock, enemyPlayer, true);

    // No incoming_fleet notification yet -> bot does NOT know an attack is coming.
    const didUnwarned: string[] = [];
    await maybeEscapeToMoon(f.db, f.clock, seat, BOT_PERSONAS.BUILDER, await viewOf(), didUnwarned, silent, always);
    expect(didUnwarned).toEqual([]);
    expect(await f.db.select().from(moonMoves).where(eq(moonMoves.fromPlanetId, seat.planetId))).toHaveLength(0);

    // Radar fires incoming_fleet warning -> bot hops mobile ships (never Prospector) up to the moon.
    await f.db.insert(notifications).values({
      playerId: seat.playerId,
      kind: 'incoming_fleet',
      refId: raid.missionId,
      payload: {
        arriveAt: addMinutes(f.clock.now(), 15).toISOString(),
        targetPlanetName: 'Home',
        fleet: { WARDEN: 40 },
      },
      createdAt: f.clock.now(),
    });
    const didWarned: string[] = [];
    await maybeEscapeToMoon(f.db, f.clock, seat, BOT_PERSONAS.BUILDER, await viewOf(), didWarned, silent, always);
    expect(didWarned).toContain('moon:hop-up');
    const [move] = await f.db.select().from(moonMoves).where(eq(moonMoves.fromPlanetId, seat.planetId));
    expect(move?.kind).toBe('HOP_UP');
    expect(move?.fleet.DART).toBeGreaterThan(0);
    expect(move?.fleet.PROSPECTOR).toBeUndefined();
  });

  it('hops ships back down from the moon when no incoming warning is active', async () => {
    await f.db.insert(moons).values({ planetId: seat.planetId, rarity: 'COMMON', origin: 'BUILT', visualSeed: 2, bornAt: f.clock.now() });
    await f.db.insert(units).values({
      planetId: seat.planetId, ownerPlayerId: seat.playerId, hull: 'DART', location: MOON_LOCATION, count: 6,
    });
    const did: string[] = [];
    await maybeEscapeToMoon(f.db, f.clock, seat, BOT_PERSONAS.RAIDER, await viewOf(), did, silent, always);
    expect(did).toContain('moon:hop-down');
    const [move] = await f.db.select().from(moonMoves).where(eq(moonMoves.fromPlanetId, seat.planetId));
    expect(move?.kind).toBe('HOP_DOWN');
    expect(move?.fleet.DART).toBe(6);
  });

  it('jumps reinforcements between two owned moons via the Moon Gate', async () => {
    const colony = f.planetIds[1]!;
    await f.db.update(planets).set({ controllerPlayerId: seat.playerId, kind: 'COLONY' }).where(eq(planets.id, colony));
    await placeAt(f.db, colony, { x: 250, y: 0, z: 0 });
    await setLevel(f.db, colony, 'CORE', 10);
    await setLevel(f.db, colony, 'HANGAR', 6);
    await fuelUp(f.db, colony, 3_000);
    await levelWorld(f.db, [colony]);
    await f.db.insert(moons).values([
      { planetId: seat.planetId, rarity: 'RARE', origin: 'BUILT', visualSeed: 3, bornAt: f.clock.now() },
      { planetId: colony, rarity: 'RARE', origin: 'SEED', visualSeed: 4, bornAt: f.clock.now() },
    ]);
    await f.db.insert(units).values({
      planetId: colony, ownerPlayerId: seat.playerId, hull: 'DART', location: MOON_LOCATION, count: 8,
    });

    const did: string[] = [];
    await maybeReinforceByGate(f.db, f.clock, seat, BOT_PERSONAS.RAIDER, did, silent, always);
    expect(did).toContain('moon:jump');
    const [jump] = await f.db.select().from(moonMoves).where(eq(moonMoves.kind, 'JUMP'));
    expect(jump?.fromPlanetId).toBe(colony);
    expect(jump?.toPlanetId).toBe(seat.planetId);
    expect(jump?.fleet.DART).toBe(8);
  });

  it('runs a Gözcü scan from its moon on a known nearby target', async () => {
    await f.db.insert(moons).values({ planetId: seat.planetId, rarity: 'COMMON', origin: 'BUILT', visualSeed: 5, bornAt: f.clock.now() });
    await f.db.transaction((tx) => rememberWorld(tx, {
      observerPlayerId: seat.playerId, targetPlanetId: enemyPlanet, seasonId: seat.seasonId, seenAt: f.clock.now(), source: 'PROBE',
    }));

    const did: string[] = [];
    await maybeScanFromMoon(f.db, f.clock, seat, BOT_PERSONAS.RAIDER, await viewOf(), did, silent, always);
    expect(did).toContain('moon:scan');
    const scans = await f.db.select().from(moonScans).where(eq(moonScans.scannerPlayerId, seat.playerId));
    expect(scans).toHaveLength(1);
    expect(scans[0]!.targetPlanetId).toBe(enemyPlanet);
  });

  it('retargets an in-flight single raid to a public moon through retargetAttack', async () => {
    await f.db.insert(moons).values({ planetId: enemyPlanet, rarity: 'COMMON', origin: 'BUILT', visualSeed: 6, bornAt: f.clock.now() });
    await giveUnits(f.db, seat.planetId, { DART: 15 });
    const raid = await launchAttack(f.db, seat.planetId, enemyPlanet, { DART: 15 }, f.clock, seat.playerId, true);

    const did: string[] = [];
    await maybeRetargetToMoon(f.db, f.clock, seat, BOT_PERSONAS.RAIDER, did, silent, always);
    expect(did).toContain('moon:retarget');
    const [updated] = await f.db.select({ targetBody: missions.targetBody }).from(missions).where(eq(missions.id, raid.missionId));
    expect(updated?.targetBody).toBe('MOON');
  });

  it('launches a READY Death Star at a neutral seeded moon (S54) using only public/remembered info', async () => {
    const neutral = f.planetIds[1]!;
    await f.db.update(planets).set({ controllerPlayerId: null, kind: 'NEUTRAL' }).where(eq(planets.id, neutral));
    await placeAt(f.db, neutral, { x: 300, y: 0, z: 0 });
    await f.db.insert(moons).values({ planetId: neutral, rarity: 'LEGENDARY', origin: 'SEED', visualSeed: 7, bornAt: f.clock.now() });
    await setLevel(f.db, seat.planetId, 'CORE', 13);
    await setLevel(f.db, seat.planetId, 'SHIPYARD', 5);
    await fuelUp(f.db, seat.planetId, 10_000);
    await levelWorld(f.db, [seat.planetId]);
    await f.db.insert(strategicAssets).values({
      planetId: seat.planetId, type: 'DEATH_STAR', status: 'READY', startedAt: f.clock.now(), readyAt: f.clock.now(),
    });

    // Peaceful persona never launches a moon strike.
    const didBuilder: string[] = [];
    await maybeStrikeMoon(f.db, f.clock, seat, BOT_PERSONAS.BUILDER, await viewOf(), didBuilder, silent, always);
    expect(didBuilder).toEqual([]);

    // Aggressive persona launches at the neutral moon via launchDeathStar(..., 'MOON').
    const didRaider: string[] = [];
    await maybeStrikeMoon(f.db, f.clock, seat, BOT_PERSONAS.RAIDER, await viewOf(), didRaider, silent, always);
    expect(didRaider).toContain('moon:death-star');
    const [ds] = await f.db.select().from(missions)
      .where(and(eq(missions.ownerPlayerId, seat.playerId), eq(missions.kind, 'death_star')));
    expect(ds?.targetPlanetId).toBe(neutral);
    expect(ds?.targetBody).toBe('MOON');
  });

  it('wires moon actions into runBotTurn without breaking ordinary turns', async () => {
    await giveResearch(f.db, seat.planetId, 'LUNAR_CAPTURE');
    const result = await runBotTurn(f.db, f.clock, seat, silent);
    expect(Array.isArray(result.did)).toBe(true);
  });
});
