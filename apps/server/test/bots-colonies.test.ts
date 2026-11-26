import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { and, eq, sql } from 'drizzle-orm';
import { MULTI_WORLD, hullBulk, type Fleet } from '@astera/rules';
import {
  buildOrders, missions, neutralPlanetState, planetFaults, planets, players, probeReports, units,
} from '../src/db/schema.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { pursueColony, runBotTurn, tendColonies, type BotSeat } from '../src/services/bots/brain.js';
import { COLONY_BUILD_ORDER, colonyTarget, settlersOwned } from '../src/services/bots/colonies.js';
import { BOTS, BOT_PERSONAS, type BotStrength } from '../src/services/bots/personas.js';
import { rememberWorld } from '../src/services/intel.js';
import { planetView } from '../src/services/planetView.js';
import { createNeutralWorld } from '../src/services/season.js';
import { addMinutes } from '../src/clock.js';
import { fuelUp, giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * SOME OF THEM HOLD COLONIES, AND PLAY THEM. Owner add-on to the bot plan, 2026-11-26 (F5):
 * "no colony = bot" must not be a tell, so each commander means to hold 0, 1 or 2, takes them the
 * way a person does — look, raid the caretaker, settle the claim it opened — and tends them.
 */

const silent = pino({ level: 'silent' });
const LANES = ['probe', 'pirate', 'attack'] as const;
let f: Fixture, seat: BotSeat, home: { x: number; y: number; z: number };

afterAll(async () => { await (await testDb()).close(); });

/** The first ordinal whose colony habit is `n` for this strength. */
const ordinalWanting = (n: number, strength: BotStrength = 'NORMAL'): number => {
  for (let ordinal = 0; ordinal < 200; ordinal++) if (colonyTarget(ordinal, strength) === n) return ordinal;
  throw new Error(`no ordinal wants ${String(n)}`);
};

const viewOf = () => f.db.transaction((tx) => planetView(tx, seat.planetId, f.clock));

let slot = 9_000;
/** A caretaker world `dx` along from the bot's capital. */
const caretaker = async (tier: 1 | 2, dx: number): Promise<string> => {
  slot += 1;
  const at = { index: slot, x: home.x + dx, y: home.y, z: home.z };
  return f.db.transaction((tx) => createNeutralWorld(tx, f.seasonId, { tier, profileSeed: slot, slot: at }, f.clock.now(), slot));
};

/** A probe report on `planetId` this commander already holds, taken now. */
const looked = async (planetId: string, defence = 0) => {
  const [scout] = await f.db.insert(missions).values({
    fuelPaid: 0, seasonId: f.seasonId, kind: 'probe', status: 'resolved', ownerPlayerId: seat.playerId,
    originPlanetId: seat.planetId, targetPlanetId: planetId, fleet: {}, distance: 10,
    departAt: f.clock.now(), arriveAt: f.clock.now(),
  }).returning();
  const [report] = await f.db.insert(probeReports).values({
    observerPlayerId: seat.playerId, targetPlanetId: planetId, missionId: scout!.id, accuracy: 1,
    stock: { low: 2_000, high: 2_000 }, defence: { low: defence, high: defence }, fleetSize: { low: 0, high: 0 },
    shield: { low: 0, high: 0 }, unarmed: { low: 0, high: 0 }, fleetHome: true, detected: false,
    createdAt: f.clock.now(),
  }).returning();
  await f.db.transaction((tx) => rememberWorld(tx, {
    observerPlayerId: seat.playerId, targetPlanetId: planetId, seasonId: f.seasonId,
    seenAt: f.clock.now(), source: 'PROBE', reportId: report!.id,
  }));
};

const flights = async (kind: 'attack' | 'probe' | 'settlement') => f.db.select().from(missions)
  .where(and(eq(missions.ownerPlayerId, seat.playerId), eq(missions.kind, kind)));

const pursue = async (strength: BotStrength = 'NORMAL', did: string[] = []) =>
  pursueColony(f.db, f.clock, seat, BOT_PERSONAS.BALANCED, strength, await viewOf(), did, silent, LANES);

/** Hands one of the fixture's worlds to the bot as a colony. */
const colonyOf = async (planetId: string) => {
  await f.db.update(planets).set({
    controllerPlayerId: seat.playerId, kind: 'COLONY', statsOwnerPlayerId: seat.playerId,
    seasonTelemetry: { produced: { alloy: 0, crystal: 0, deuterium: 0 }, productiveSeconds: 0, shipsBuilt: {} },
  }).where(eq(planets.id, planetId));
};

beforeEach(async () => {
  f = await seedWorld(3);
  const bot = await addBot(f.db, 'Koloncu', f.clock);
  await ensureBotSeats(f.db, f.clock, silent);
  const [row] = await f.db.select({ playerId: players.id, planetId: planets.id, x: planets.x, y: planets.y, z: planets.z })
    .from(players)
    .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
    .where(eq(players.accountId, bot.accountId));
  home = { x: row!.x, y: row!.y, z: row!.z };
  seat = { accountId: bot.accountId, playerId: row!.playerId, planetId: row!.planetId,
    seasonId: f.seasonId, seasonSeed: f.seed, ordinal: ordinalWanting(2), persona: 'BALANCED' };
  await f.db.update(players).set({
    joinedAt: addMinutes(f.clock.now(), -(BOTS.newPlayerGraceHours + 24) * 60), newcomerShieldUntil: null,
  }).where(sql`true`);
  f.clock.advance(BOTS.ceasefireMinutes + 1);
  await f.db.delete(units).where(eq(units.planetId, seat.planetId));
  await f.db.delete(buildOrders).where(eq(buildOrders.planetId, seat.planetId));
  await setLevel(f.db, seat.planetId, 'CORE', 13);
  await setLevel(f.db, seat.planetId, 'SHIPYARD', 4);
  await setLevel(f.db, seat.planetId, 'HANGAR', 8);
  await grant(f.db, seat.planetId, 50_000, 20_000);
  await fuelUp(f.db, seat.planetId);
});

describe('how many it means to hold', () => {
  it('holds 0, 1 or 2 by habit, the same every time, and an ELITE at least one', () => {
    const habits = Array.from({ length: 25 }, (_, ordinal) => colonyTarget(ordinal, 'NORMAL'));
    expect(new Set(habits)).toEqual(new Set([0, 1, 2]));
    for (let ordinal = 0; ordinal < 25; ordinal++) {
      expect(colonyTarget(ordinal, 'NORMAL')).toBe(habits[ordinal]);
      expect(colonyTarget(ordinal, 'STRONG')).toBe(habits[ordinal]);
      expect(colonyTarget(ordinal, 'ELITE')).toBe(Math.max(1, habits[ordinal]!));
    }
  });

  it('reaches for none while its Core has opened no slot', async () => {
    await setLevel(f.db, seat.planetId, 'CORE', MULTI_WORLD.colonyCoreThresholds[0] - 1);
    await caretaker(1, 150);
    expect(await pursue()).toBe('content');
    expect(await flights('probe')).toEqual([]);
  });

  it('reaches for none when its habit is none', async () => {
    seat = { ...seat, ordinal: ordinalWanting(0) };
    await caretaker(1, 150);
    expect(await pursue()).toBe('content');
    expect(await flights('probe')).toEqual([]);
  });

  it('stops once it holds what it means to', async () => {
    seat = { ...seat, ordinal: ordinalWanting(1) };
    await colonyOf(f.planetIds[2]!);
    await caretaker(1, 150);
    expect(await pursue()).toBe('content');
    expect(await flights('probe')).toEqual([]);
  });
});

describe('taking one', () => {
  it('looks first at the nearest caretaker world in its reach', async () => {
    const second = await caretaker(2, 120);
    const first = await caretaker(1, 300);
    await caretaker(1, 600);
    expect(await pursue('NORMAL')).toBe('flew');
    expect((await flights('probe')).map((m) => m.targetPlanetId)).toEqual([first]);

    await f.db.delete(missions).where(eq(missions.kind, 'probe'));
    expect(await pursue('ELITE')).toBe('flew');
    expect((await flights('probe')).map((m) => m.targetPlanetId)).toEqual([second]);
  });

  it('passes over a world somebody else has a claim open on', async () => {
    const taken = await caretaker(1, 150);
    const free = await caretaker(1, 400);
    await f.db.update(neutralPlanetState).set({
      claimUntil: addMinutes(f.clock.now(), 60), claimPriorityPlayerId: f.playerIds[0]!,
      claimPriorityUntil: addMinutes(f.clock.now(), 30),
    }).where(eq(neutralPlanetState.planetId, taken));
    expect(await pursue()).toBe('flew');
    expect((await flights('probe')).map((m) => m.targetPlanetId)).toEqual([free]);
  });

  it('raids it on a fresh reading and keeps two Couriers home for the settlers', async () => {
    const world = await caretaker(1, 150);
    await looked(world);
    const fleet: Fleet = { DART: 40, COURIER: 5 };
    await giveUnits(f.db, seat.planetId, fleet);
    const did: string[] = [];
    expect(await pursue('NORMAL', did)).toBe('flew');
    expect(did).toContain('colony:attack');
    const [raid] = await flights('attack');
    expect(raid?.targetPlanetId).toBe(world);
    expect(raid?.fleet.COURIER).toBe(5 - MULTI_WORLD.settlement.transports);
    expect((await viewOf()).fleet.COURIER).toBe(MULTI_WORLD.settlement.transports);
  });

  it('sends nothing more while its own raid on a caretaker is in the air', async () => {
    const world = await caretaker(1, 150);
    await looked(world);
    await giveUnits(f.db, seat.planetId, { DART: 40, COURIER: 2 });
    expect(await pursue()).toBe('flew');
    await caretaker(1, 300);
    expect(await pursue()).toBe('wanting');
    expect(await flights('probe')).toHaveLength(1);
  });

  it('settles the claim its own raid opened', async () => {
    const world = await caretaker(1, 150);
    await f.db.update(neutralPlanetState).set({
      claimUntil: addMinutes(f.clock.now(), 80), claimPriorityPlayerId: seat.playerId,
      claimPriorityUntil: addMinutes(f.clock.now(), 50),
    }).where(eq(neutralPlanetState.planetId, world));
    await giveUnits(f.db, seat.planetId, { COURIER: MULTI_WORLD.settlement.transports });
    const did: string[] = [];
    expect(await pursue('NORMAL', did)).toBe('flew');
    expect(did).toContain('settle');
    expect((await flights('settlement')).map((m) => m.targetPlanetId)).toEqual([world]);
  });

  it('settles on its turn before anything else flies', async () => {
    const world = await caretaker(1, 150);
    await f.db.update(neutralPlanetState).set({
      claimUntil: addMinutes(f.clock.now(), 80), claimPriorityPlayerId: seat.playerId,
      claimPriorityUntil: addMinutes(f.clock.now(), 50),
    }).where(eq(neutralPlanetState.planetId, world));
    await giveUnits(f.db, seat.planetId, { COURIER: MULTI_WORLD.settlement.transports, DART: 10 });
    expect((await runBotTurn(f.db, f.clock, { ...seat, persona: 'BALANCED' }, silent)).did).toContain('settle');
  });
});

describe('playing the ones it holds', () => {
  it('orders the settlers it lacks while it still wants a colony', async () => {
    const did: string[] = [];
    await tendColonies(f.db, f.clock, seat, BOT_PERSONAS.BALANCED, 'NORMAL', await viewOf(), did, silent);
    expect(did).toContain('settlers');
    const orders = await f.db.select().from(buildOrders)
      .where(and(eq(buildOrders.planetId, seat.planetId), eq(buildOrders.subject, 'COURIER')));
    expect(orders.reduce((sum, order) => sum + order.count, 0)).toBe(MULTI_WORLD.settlement.transports);
  });

  it('orders none once it holds what it means to', async () => {
    seat = { ...seat, ordinal: ordinalWanting(1) };
    await colonyOf(f.planetIds[2]!);
    const did: string[] = [];
    await tendColonies(f.db, f.clock, seat, BOT_PERSONAS.BALANCED, 'NORMAL', await viewOf(), did, silent);
    expect(did).not.toContain('settlers');
  });

  /** The settlers stay home on every raid, so the hold for the haul is bought on top of them. */
  it.each([
    ['wants a colony', 2, MULTI_WORLD.settlement.transports + BOTS.courierTarget],
    ['wants none', 0, BOTS.courierTarget],
  ] as const)('keeps a hold for the haul on top of the settlers when it %s', async (_, habit, couriers) => {
    seat = { ...seat, ordinal: ordinalWanting(habit) };
    // Ground guns share the yard: the ground is full, so the yard is the fleet's.
    await giveUnits(f.db, seat.planetId, { THORN: Math.floor((await viewOf()).capacity.ground / hullBulk('THORN')) });
    // One yard order a turn, and the Prospector is ordered first.
    for (let turn = 0; turn < 3; turn++) {
      await runBotTurn(f.db, f.clock, seat, silent);
      f.clock.advance(1);
    }
    expect(await settlersOwned(f.db, seat.planetId)).toBe(couriers);
  });

  it('repairs, guards and builds on each colony, through the services a phone uses', async () => {
    const colony = f.planetIds[2]!;
    await colonyOf(colony);
    await f.db.delete(buildOrders).where(eq(buildOrders.planetId, colony));
    // `grant` raises the Core and the producers to hold what it hands out, so the levels come after.
    await grant(f.db, colony, 60_000, 30_000);
    await setLevel(f.db, colony, 'CORE', 6);
    await setLevel(f.db, colony, 'SHIPYARD', 2);
    await setLevel(f.db, colony, 'REFINERY', 1);
    await f.db.insert(planetFaults).values({ planetId: colony, kind: 'VAULT_LEAK', startedAt: f.clock.now() });

    const did: string[] = [];
    await tendColonies(f.db, f.clock, seat, BOT_PERSONAS.BALANCED, 'NORMAL', await viewOf(), did, silent);
    expect(did).toContain('colony:repair');
    expect(did.some((step) => step.startsWith('colony:ground:'))).toBe(true);
    expect(did).toContain(`colony:build:${COLONY_BUILD_ORDER[0]!}`);
    const [fault] = await f.db.select().from(planetFaults).where(eq(planetFaults.planetId, colony));
    expect(fault?.repairReadyAt).not.toBeNull();
  });
});
