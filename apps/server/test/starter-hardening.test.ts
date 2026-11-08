import { STARTER, type Fleet, type VesselFact } from '@astera/rules';
import { and, eq, sql } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../src/db/client.js';
import { botProfiles, mainVacancies, commanderTransfers, planets, players, returnApplications, seasons, starterEvents, starterGalaxies, starterSites, vesselBattleReports, vesselBotState, vesselMigrations, vesselMissions, vesselNotifications, vessels } from '../src/db/schema.js';
import { addBot } from '../src/services/bots/roster.js';
import { ensureBotSeats } from '../src/services/bots/sweep.js';
import { GameError } from '../src/services/planet.js';
import { joinSeason } from '../src/services/player.js';
import { sweepStrandedFlights } from '../src/services/starter/arrival.js';
import { lockGalaxyWithRoom } from '../src/services/starter/enlist.js';
import { runDeparture, sweepDepartures } from '../src/services/starter/migration.js';
import { resetStarter } from '../src/services/starter/ops.js';
import { crewGalaxies } from '../src/services/starter/shipBots.js';
import { sweepStarterWorld } from '../src/services/starter/sites.js';
import { withVesselLock } from '../src/services/starter/vessel.js';
import type * as Bus from '../src/stream/bus.js';
import { publishShard } from '../src/stream/bus.js';
import { makeAccount, testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, enrich, get, pass, placeShip, post, siteOf, type StarterWorld } from './starterShips.js';

vi.mock('../src/stream/bus.js', async (original) => {
  const real = await original<typeof Bus>();
  return { ...real, publishShard: vi.fn(real.publishShard) };
});

afterAll(async () => { await (await testDb()).close(); });
const log = pino({ level: 'silent' });

const JUMP_READY = { DRIVE_HULL: 1, DRIVE_THRUST: 1, DEUTERIUM_PLANT: 2 };
const FIGHTER = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3, AEGIS: 1, RADAR: 1, TELESCOPE: 1 };
const MINER = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3 };

interface Choice { index: number; neighbours: number; x: number; y: number; z: number }
interface MigrationView { choices: Choice[]; cargo: { alloy: number } }

/** A second connection does what a neighbouring command would do while the first still holds its locks. */
const within = async (db: Db, fn: (tx: Parameters<Parameters<Db['transaction']>[0]>[0]) => Promise<unknown>): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '400ms'`);
    await fn(tx);
  });
};

describe('what the review of the ship galaxies found', () => {
  let world: StarterWorld;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const shipOf = async (id: string) => (await world.f.db.select().from(vessels).where(eq(vessels.id, id)))[0]!;
  const migrationOf = async (id: string) => (await world.f.db.select().from(vesselMigrations).where(eq(vesselMigrations.vesselId, id)))[0]!;
  const seatOf = async (accountId: string) => (await world.f.db.select().from(players).where(eq(players.accountId, accountId)))[0];
  const flyer = async (me: { vesselId: string }, over: Partial<typeof vesselMissions.$inferInsert> = {}) => {
    const ship = await shipOf(me.vesselId);
    const now = world.f.clock.now().getTime();
    const [mission] = await world.f.db.insert(vesselMissions).values({
      starterGalaxyId: ship.starterGalaxyId, ownerVesselId: me.vesselId, kind: 'RAID_SITE', fromX: 0, fromY: 0, fromZ: 0, toX: 10, toY: 0, toZ: 0,
      fleet: { DART: 2 }, damage: [], departAt: new Date(now - 60 * 60_000), arriveAt: new Date(now - 30 * 60_000), status: 'OUTBOUND', ...over,
    }).returning();
    return mission!;
  };

  describe('the clean slate', () => {
    it('clears a galaxy that has seen a battle', async () => {
      const me = await aboard(world, 'Me');
      const ship = await shipOf(me.vesselId);
      await world.f.db.execute(sql`
        insert into vessel_battle_reports (starter_galaxy_id, mission_id, attacker_vessel_id, attacker_name, defender_name, at, grade, result, ruleset_version)
        values (${ship.starterGalaxyId}, ${crypto.randomUUID()}, ${me.vesselId}, 'Me', 'Them', now(), 'DECISIVE', '{}'::jsonb, 1)
      `);
      await resetStarter(world.f.db, { apply: true });
      expect(await world.f.db.select().from(starterGalaxies)).toHaveLength(0);
      expect(await world.f.db.select().from(vesselBattleReports)).toHaveLength(0);
    });
  });

  describe('a flight nothing will ever resolve', () => {
    it('brings a fleet home when its arrival gave up, and frees the bay and the jump', async () => {
      const me = await aboard(world, 'Me', FIGHTER);
      const flight = await flyer(me);
      await world.f.db.insert(starterEvents).values({ starterGalaxyId: flight.starterGalaxyId, kind: 'vessel_mission_arrival', refId: flight.id, resolveAt: flight.arriveAt, status: 'failed', attempts: 5 });
      expect(await sweepStrandedFlights(world.f.db, world.f.clock)).toBe(1);
      const [after] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.id, flight.id));
      expect(after!.status).toBe('DONE');
      const units = await world.f.db.execute<{ hull: string; count: number }>(sql`select hull, count from vessel_units where vessel_id = ${me.vesselId} and location = 'HOME'`);
      expect([...units]).toEqual([{ hull: 'DART', count: 2 }]);
    });

    it('lands what a return leg was carrying when its event is simply gone', async () => {
      const me = await aboard(world, 'Me', FIGHTER);
      await enrich(world, me.vesselId, 0, 0, 0);
      const now = world.f.clock.now().getTime();
      const flight = await flyer(me, { status: 'RETURNING', returnAt: new Date(now - 30 * 60_000), cargo: { alloy: 200, crystal: 0, deuterium: 0 } });
      expect(await sweepStrandedFlights(world.f.db, world.f.clock)).toBe(1);
      expect((await shipOf(me.vesselId)).alloy).toBeGreaterThanOrEqual(200);
      const [after] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.id, flight.id));
      expect(after!.status).toBe('DONE');
    });

    it('lets a probe go without calling it a fleet', async () => {
      const me = await aboard(world, 'Me', FIGHTER);
      const flight = await flyer(me, { kind: 'PROBE', fleet: {} });
      expect(await sweepStrandedFlights(world.f.db, world.f.clock)).toBe(1);
      const [after] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.id, flight.id));
      expect(after!.status).toBe('CANCELLED');
      expect(await world.f.db.select().from(vesselNotifications).where(eq(vesselNotifications.refId, flight.id))).toHaveLength(0);
    });

    it('leaves a flight alone while it still has a live event, or is only just late', async () => {
      const me = await aboard(world, 'Me', FIGHTER);
      const waiting = await flyer(me);
      await world.f.db.insert(starterEvents).values({ starterGalaxyId: waiting.starterGalaxyId, kind: 'vessel_mission_arrival', refId: waiting.id, resolveAt: waiting.arriveAt });
      const now = world.f.clock.now().getTime();
      await flyer(me, { arriveAt: new Date(now - 60_000) });
      expect(await sweepStrandedFlights(world.f.db, world.f.clock)).toBe(0);
    });

    it('is on the worker: nothing has to ask for it', async () => {
      const me = await aboard(world, 'Me', FIGHTER);
      const flight = await flyer(me);
      await pass(world, 1);
      const [after] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.id, flight.id));
      expect(after!.status).toBe('DONE');
    });
  });

  describe('who waits for whom', () => {
    it('runs the world sweep while a command in that galaxy is writing', async () => {
      const me = await aboard(world, 'Me');
      const ship = await shipOf(me.vesselId);
      let release!: () => void;
      const hold = new Promise<void>((resolve) => { release = resolve; });
      let holding!: () => void;
      const holds = new Promise<void>((resolve) => { holding = resolve; });
      const command = world.f.db.transaction(async (tx) => {
        await tx.insert(starterEvents).values({ starterGalaxyId: ship.starterGalaxyId, kind: 'vessel_order_complete', resolveAt: world.f.clock.now() });
        holding();
        await hold;
      });
      await holds;
      await sweepStarterWorld(world.f.db, world.f.clock);
      const sites = await world.f.db.select().from(starterSites).where(eq(starterSites.starterGalaxyId, ship.starterGalaxyId));
      release();
      await command;
      expect(sites.length).toBeGreaterThan(0);
    });

    it('lets a neighbour aim at a ship whose owner is in the middle of a command', async () => {
      const me = await aboard(world, 'Me');
      const them = await aboard(world, 'Them');
      const theirs = await shipOf(them.vesselId);
      await withVesselLock(world.f.db, me.id, world.f.clock, async () => {
        await within(world.f.db, tx => tx.insert(vesselMissions).values({
          starterGalaxyId: theirs.starterGalaxyId, ownerVesselId: them.vesselId, targetVesselId: me.vesselId, kind: 'ATTACK',
          fromX: 0, fromY: 0, fromZ: 0, toX: 1, toY: 0, toZ: 0, fleet: { DART: 1 }, damage: [], departAt: world.f.clock.now(), arriveAt: world.f.clock.now(),
        }));
      });
    });

    it('lets a command write beside a newcomer taking a berth', async () => {
      const me = await aboard(world, 'Me');
      const ship = await shipOf(me.vesselId);
      await world.f.db.transaction(async (tx) => {
        await lockGalaxyWithRoom(tx, world.f.clock);
        await within(world.f.db, other => other.insert(starterEvents).values({ starterGalaxyId: ship.starterGalaxyId, kind: 'vessel_order_complete', resolveAt: world.f.clock.now() }));
      });
    });
  });

  describe('a jump pressed twice', () => {
    const ready = async (name = 'Pilot', fleet: Fleet = {}) => {
      const person = await aboard(world, name, JUMP_READY);
      await world.f.db.update(vessels).set({ fuel: STARTER.fuelForJump, alloy: 500, crystal: 0, deuterium: 0 }).where(eq(vessels.id, person.vesselId));
      await arm(world, person.vesselId, fleet);
      return person;
    };
    const handedBack = async (vesselId: string) => {
      await world.f.db.update(vessels).set({ status: 'ACTIVE' }).where(eq(vessels.id, vesselId));
      await world.f.db.update(vesselMigrations).set({ status: 'FAILED', lastError: 'NO_FRONTIER' }).where(eq(vesselMigrations.vesselId, vesselId));
    };

    it('does not seat a run that joined a departure since handed back', async () => {
      const person = await ready();
      await expect(runDeparture(world.f.db, person.id, world.f.clock, {
        afterStep: async (step) => { if (step === 'committed') await handedBack(person.vesselId); },
      })).rejects.toMatchObject({ code: 'MIGRATION_NOT_READY' });
      expect(await seatOf(person.id)).toBeUndefined();
      expect((await shipOf(person.vesselId)).status).toBe('ACTIVE');
    });

    it('finishes the jump, with one hold, when the seat came through after the hand-back', async () => {
      const person = await ready();
      let founded = 0;
      const landing = await runDeparture(world.f.db, person.id, world.f.clock, {
        afterStep: async (step) => {
          if (step !== 'seated') return;
          const seat = await seatOf(person.id);
          const [capital] = await world.f.db.select().from(planets).where(eq(planets.controllerPlayerId, seat!.id));
          founded = capital!.alloy;
          await handedBack(person.vesselId);
          await world.f.db.update(vessels).set({ alloy: 900, bufferAlloy: 0 }).where(eq(vessels.id, person.vesselId));
        },
      });
      expect((await shipOf(person.vesselId)).status).toBe('DEPARTED');
      expect((await migrationOf(person.vesselId)).status).toBe('DONE');
      expect(landing.cargo.alloy).toBe(900);
      const [planet] = await world.f.db.select().from(planets).where(eq(planets.id, landing.placement.planetId));
      expect((await migrationOf(person.vesselId)).cargo.alloy).toBe(900);
      expect(planet!.alloy).toBeCloseTo(founded + 900, 0);
    });

    it('lands once however many presses race', async () => {
      const person = await ready('Pilot', { DART: 2 });
      const answers = await Promise.allSettled([
        runDeparture(world.f.db, person.id, world.f.clock),
        runDeparture(world.f.db, person.id, world.f.clock),
        runDeparture(world.f.db, person.id, world.f.clock),
      ]);
      expect(answers.some(answer => answer.status === 'fulfilled')).toBe(true);
      expect((await shipOf(person.vesselId)).status).toBe('DEPARTED');
      const seat = await seatOf(person.id);
      const worlds = await world.f.db.select().from(planets).where(eq(planets.controllerPlayerId, seat!.id));
      expect(worlds).toHaveLength(1);
      const darts = async (planetId: string) => [...await world.f.db.execute<{ count: number }>(sql`select count from units where planet_id = ${planetId} and hull = 'DART' and location = 'home'`)][0]?.count ?? 0;
      const other = await ready('Other');
      const single = await runDeparture(world.f.db, other.id, world.f.clock);
      expect(await darts(worlds[0]!.id)).toBe(await darts(single.placement.planetId) + 2);
    });
  });

  describe('the three addresses', () => {
    const ready = async () => {
      const person = await aboard(world, 'Pilot', JUMP_READY);
      await world.f.db.update(vessels).set({ fuel: STARTER.fuelForJump }).where(eq(vessels.id, person.vesselId));
      return person;
    };
    const free = async (notIn: readonly number[]) => {
      const taken = new Set([...(await world.f.db.select({ slot: planets.slotIndex }).from(planets).where(eq(planets.seasonId, world.f.seasonId))).map(row => row.slot), ...notIn]);
      for (let index = 0; index < 500; index++) if (!taken.has(index)) return index;
      throw new Error('no free slot');
    };

    it('lands on one it offered', async () => {
      const person = await ready();
      const { choices } = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      const wanted = choices.at(-1)!.index;
      const answer = await post(world, '/api/starter/migrate', person.headers, { slot: wanted });
      expect(answer.statusCode).toBe(200);
      const [planet] = await world.f.db.select().from(planets).where(eq(planets.id, answer.json<{ placement: { planetId: string } }>().placement.planetId));
      expect(planet!.slotIndex).toBe(wanted);
    });

    it('refuses a free address it did not offer, before anything is touched', async () => {
      const person = await ready();
      const { choices } = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      const elsewhere = await free(choices.map(choice => choice.index));
      const answer = await post(world, '/api/starter/migrate', person.headers, { slot: elsewhere });
      expect(answer.statusCode).toBe(409);
      expect(answer.json<{ error: string }>().error).toBe('LANDING_GONE');
      expect(await seatOf(person.id)).toBeUndefined();
      expect((await shipOf(person.vesselId)).status).toBe('ACTIVE');
      expect(await world.f.db.select().from(vesselMigrations).where(eq(vesselMigrations.vesselId, person.vesselId))).toHaveLength(0);
    });

    it('hands the ship back and offers again when the address went during the jump', async () => {
      const person = await ready();
      const { choices } = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      const wanted = choices[0]!.index;
      const rival = await makeAccount(world.f.db, 'Rival');
      await expect(runDeparture(world.f.db, person.id, world.f.clock, {
        slot: wanted,
        afterStep: async (step) => { if (step === 'committed') await joinSeason(world.f.db, rival.id, world.f.seasonId, world.f.clock, undefined, 'COMMANDER', new Set(), wanted); },
      })).rejects.toMatchObject({ code: 'LANDING_GONE' });
      expect(await seatOf(person.id)).toBeUndefined();
      expect((await shipOf(person.vesselId)).status).toBe('ACTIVE');
      const again = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      expect(again.choices.map(choice => choice.index)).not.toContain(wanted);
      expect(again.choices.length).toBeGreaterThan(0);
    });

    it('never offers an address held for a returning commander', async () => {
      const person = await ready();
      const { choices } = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      const held = choices[0]!;
      const [season] = await world.f.db.select().from(seasons).where(eq(seasons.id, world.f.seasonId));
      const account = await makeAccount(world.f.db, 'Away');
      const seat = await joinSeason(world.f.db, account.id, world.f.seasonId, world.f.clock);
      const now = world.f.clock.now();
      const [transfer] = await world.f.db.insert(commanderTransfers).values({
        playerId: seat.playerId, cycleId: season!.cycleId, sourceSeasonId: world.f.seasonId, targetSeasonId: world.f.seasonId, fromVersion: 1, toVersion: 2, direction: 'OUT', worlds: [], committedAt: now,
      }).returning();
      await world.f.db.insert(mainVacancies).values({
        cycleId: season!.cycleId, seasonId: world.f.seasonId, departureTransferId: transfer!.id, kind: 'CAPITAL', slotIndex: held.index, x: held.x, y: held.y, z: held.z, createdAt: now,
      });
      await world.f.db.insert(returnApplications).values({
        playerId: seat.playerId, playerIdSnapshot: seat.playerId, cycleId: season!.cycleId, targetShardId: season!.shardId, sequence: 1n, requestedAt: now, expiresAt: new Date(now.getTime() + 3_600_000), updatedAt: now,
      });
      const again = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      expect(again.choices.map(choice => choice.index)).not.toContain(held.index);
    });
  });

  describe('the attack door', () => {
    // Owner 2026-11-08 (N2): an outpost is fought with the shipyard's first ships, before any battle.
    const SHIPYARD_ONLY = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3 };

    it('keeps an outpost shut before the shipyard, for a request the menu never made', async () => {
      const me = await aboard(world, 'Me', { SURVEY: 1, REFINERY: 3 });
      const site = await siteOf(world, 'OUTPOST');
      const answer = await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 6 } });
      expect(answer.statusCode).toBe(403);
      expect(answer.json<{ error: string; feature?: string }>().error).toBe('FEATURE_LOCKED');
    });

    it('opens it with the shipyard, with no battle report and no shield', async () => {
      const me = await aboard(world, 'Me', SHIPYARD_ONLY);
      await arm(world, me.vesselId, { DART: 6 });
      const site = await siteOf(world, 'OUTPOST');
      await placeShip(world, me.vesselId, { x: site.x - 200, y: site.y, z: site.z });
      const answer = await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 6 } });
      expect(answer.statusCode).toBe(200);
    });
  });

  describe('a sleeping ship\'s first order', () => {
    const asleep = async (modules: Record<string, number>, facts: VesselFact[] = []) => {
      const me = await aboard(world, 'Me', modules);
      await world.f.db.update(vessels).set({ status: 'DORMANT', slotIndex: null, x: 9999, y: 9999, z: 9999, facts }).where(eq(vessels.id, me.vesselId));
      return me;
    };
    const fillGalaxy = async (me: { vesselId: string }) => {
      const ship = await shipOf(me.vesselId);
      await world.f.db.update(starterGalaxies).set({ capacity: 0 }).where(eq(starterGalaxies.id, ship.starterGalaxyId));
    };

    it('flies from where it woke, not from where it fell asleep', async () => {
      const site = await aboard(world, 'Keeper').then(() => siteOf(world, 'OUTPOST'));
      const me = await asleep(FIGHTER, ['FIRST_BATTLE_REPORT']);
      await arm(world, me.vesselId, { DART: 6 });
      const answer = await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 6 } });
      expect(answer.statusCode).toBe(200);
      const ship = await shipOf(me.vesselId);
      expect(ship.status).toBe('ACTIVE');
      expect(ship.x).not.toBe(9999);
      const [flight] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
      expect(flight!.fromX).toBe(ship.x);
      expect(flight!.fromZ).toBe(ship.z);
    });

    it('cannot aim a fleet at a place in the galaxy it woke out of', async () => {
      const site = await aboard(world, 'Keeper').then(() => siteOf(world, 'OUTPOST'));
      const me = await asleep(FIGHTER, ['FIRST_BATTLE_REPORT']);
      await arm(world, me.vesselId, { DART: 6 });
      await fillGalaxy(me);
      const answer = await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 6 } });
      expect(answer.statusCode).toBe(404);
    });

    it('sends a probe from where it woke', async () => {
      const site = await aboard(world, 'Keeper').then(() => siteOf(world, 'WRECK'));
      const me = await asleep(FIGHTER);
      await enrich(world, me.vesselId);
      const answer = await post(world, '/api/starter/probe', me.headers, { targetPlanetId: site.id });
      expect(answer.statusCode).toBe(200);
      const ship = await shipOf(me.vesselId);
      const [flight] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
      expect(flight!.fromX).toBe(ship.x);
      expect(flight!.starterGalaxyId).toBe(ship.starterGalaxyId);
    });

    it('cannot send a probe or a craft at a place in the galaxy it woke out of', async () => {
      const wreck = await aboard(world, 'Keeper').then(() => siteOf(world, 'WRECK'));
      const me = await asleep({ ...MINER, ...FIGHTER }, ['FIRST_MINING_RETURN']);
      await enrich(world, me.vesselId);
      await arm(world, me.vesselId, { PROSPECTOR: 2 });
      await fillGalaxy(me);
      expect((await post(world, '/api/starter/probe', me.headers, { targetPlanetId: wreck.id })).statusCode).toBe(404);
      expect((await post(world, '/api/starter/mining/harvest', me.headers, { fieldId: wreck.id, craft: 1 })).statusCode).toBe(404);
    });

    it('sends a craft from where it woke', async () => {
      const wreck = await aboard(world, 'Keeper').then(() => siteOf(world, 'WRECK'));
      const me = await asleep(MINER, ['FIRST_MINING_RETURN']);
      await arm(world, me.vesselId, { PROSPECTOR: 2 });
      const answer = await post(world, '/api/starter/mining/harvest', me.headers, { fieldId: wreck.id, craft: 1 });
      expect(answer.statusCode).toBe(200);
      const ship = await shipOf(me.vesselId);
      const [flight] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
      expect(flight!.fromX).toBe(ship.x);
    });
  });

  describe('crews', () => {
    const names = async (count: number) => { for (let i = 0; i < count; i++) await addBot(world.f.db, `Pilot ${String.fromCharCode(65 + i)}${String.fromCharCode(97 + i)}`, world.f.clock); };
    const crew = () => crewGalaxies(world.f.db, world.f.clock, log);
    const crewed = () => world.f.db.select({ ship: vessels }).from(vesselBotState).innerJoin(vessels, eq(vessels.id, vesselBotState.vesselId));

    it('leaves a sleeper in another galaxy asleep: it would not be a neighbour here', async () => {
      await names(8);
      const me = await aboard(world, 'Me');
      await crew();
      const [sleeper] = await crewed();
      const home = (await shipOf(me.vesselId)).starterGalaxyId;
      const [galaxy] = await world.f.db.select().from(starterGalaxies).where(eq(starterGalaxies.id, home));
      const [other] = await world.f.db.insert(starterGalaxies).values({ shardId: galaxy!.shardId, ordinal: galaxy!.ordinal + 1, seed: 77, epoch: world.f.clock.now(), capacity: STARTER.capacity }).returning();
      await world.f.db.update(vessels).set({ starterGalaxyId: other!.id, status: 'DORMANT', slotIndex: null }).where(eq(vessels.id, sleeper!.ship.id));
      world.f.clock.advance(11);
      const added = await crew();
      expect(added).toBeGreaterThan(0);
      expect((await shipOf(sleeper!.ship.id)).status).toBe('DORMANT');
    });

    it('wakes a sleeper of its own galaxy first', async () => {
      await names(4);
      await aboard(world, 'Me');
      await crew();
      const [sleeper] = await crewed();
      await world.f.db.update(vessels).set({ status: 'DORMANT', slotIndex: null }).where(eq(vessels.id, sleeper!.ship.id));
      world.f.clock.advance(11);
      await crew();
      expect((await shipOf(sleeper!.ship.id)).status).toBe('ACTIVE');
    });

    it('looks past names that have played to the ones that have not', async () => {
      await names(8);
      const roster = await world.f.db.select().from(botProfiles);
      const sorted = [...roster].sort((a, b) => a.ordinal - b.ordinal);
      for (const profile of sorted.slice(0, 5)) {
        await world.f.db.execute(sql`update accounts set first_season_started_at = now() where id = ${profile.accountId}`);
      }
      await aboard(world, 'Me');
      expect(await crew()).toBeGreaterThan(0);
    });
  });

  describe('a ready ship the server seats', () => {
    const READY = { REFINERY: 5, EXTRACTOR: 3, VAULT: 1, SURVEY: 2, AEGIS: 1, TELESCOPE: 1, RADAR: 1, SHIPYARD: 1, HANGAR: 2, DEUTERIUM_PLANT: 2, DRIVE_HULL: 1, DRIVE_THRUST: 1 };
    const FACTS = ['FIRST_MINING_RETURN', 'FIRST_BATTLE_REPORT', 'FIRST_PROBE_REPORT'] as const;
    const crewedReady = async () => {
      await addBot(world.f.db, 'Pilot Aa', world.f.clock);
      await aboard(world, 'Me');
      await crewGalaxies(world.f.db, world.f.clock, log);
      const [bot] = await world.f.db.select({ ship: vessels }).from(vesselBotState).innerJoin(vessels, eq(vessels.id, vesselBotState.vesselId));
      await world.f.db.update(vessels).set({ modules: READY, facts: [...FACTS], parts: 3, fuel: STARTER.fuelForJump, alloy: 100, crystal: 100, deuterium: 10 }).where(eq(vessels.id, bot!.ship.id));
      return bot!.ship;
    };

    it('jumps in the last days of a season: the calendar is the player\'s rule, not its', async () => {
      const ship = await crewedReady();
      await world.f.db.update(seasons).set({ endsAt: new Date(world.f.clock.now().getTime() + 2 * 86_400_000) }).where(eq(seasons.id, world.f.seasonId));
      expect(await ensureBotSeats(world.f.db, world.f.clock, log)).toBe(1);
      expect((await shipOf(ship.id)).status).toBe('DEPARTED');
      expect((await seatOf(ship.accountId))?.seasonId).toBe(world.f.seasonId);
    });

    it('lands in the season being filled, as its migration row says', async () => {
      const ship = await crewedReady();
      await ensureBotSeats(world.f.db, world.f.clock, log);
      expect((await migrationOf(ship.id)).seasonId).toBe(world.f.seasonId);
    });

    it('with something in the air it is not refused and logged every sweep: it waits its turn at the back', async () => {
      const ship = await crewedReady();
      await flyer({ vesselId: ship.id }, { status: 'OUTBOUND', arriveAt: new Date(world.f.clock.now().getTime() + 3_600_000) });
      const errors: unknown[] = [];
      const listening = pino({ level: 'error' }, { write: (line: string) => { errors.push(line); } });
      await ensureBotSeats(world.f.db, world.f.clock, listening);
      expect(errors).toEqual([]);
    });
  });

  describe('turning a craft back', () => {
    const craftOut = async () => {
      const wreck = await aboard(world, 'Keeper').then(() => siteOf(world, 'WRECK'));
      const me = await aboard(world, 'Me', MINER);
      await arm(world, me.vesselId, { PROSPECTOR: 2 });
      await world.f.db.update(vessels).set({ facts: ['FIRST_MINING_RETURN'] }).where(eq(vessels.id, me.vesselId));
      await placeShip(world, me.vesselId, { x: wreck.x - 500, y: wreck.y, z: wreck.z });
      const answer = await post(world, '/api/starter/mining/harvest', me.headers, { fieldId: wreck.id, craft: 1 });
      expect(answer.statusCode).toBe(200);
      return { me, runId: answer.json<{ runId: string }>().runId };
    };

    it('says no once the craft should already be there, even if the worker is behind', async () => {
      const { me, runId } = await craftOut();
      world.f.clock.advance(100_000);
      const answer = await post(world, `/api/starter/mining/runs/${runId}/recall`, me.headers);
      expect(answer.statusCode).toBe(409);
      expect(answer.json<{ error: string }>().error).toBe('NOT_RECALLABLE');
      const [flight] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.id, runId));
      expect(flight!.status).toBe('OUTBOUND');
    });

    it('tells the galaxy the craft turned, so neighbours stop drawing it going on', async () => {
      const { me, runId } = await craftOut();
      vi.mocked(publishShard).mockClear();
      world.f.clock.advance(0.01);
      expect((await post(world, `/api/starter/mining/runs/${runId}/recall`, me.headers)).statusCode).toBe(200);
      expect(vi.mocked(publishShard).mock.calls.map(call => call[2])).toContain('mining');
    });

    it('answers at once when the landing has the flight: it does not wait into a deadlock', async () => {
      const { me, runId } = await craftOut();
      world.f.clock.advance(0.01);
      await world.f.db.transaction(async (tx) => {
        await tx.select().from(vesselMissions).where(eq(vesselMissions.id, runId)).for('update');
        const answer = await post(world, `/api/starter/mining/runs/${runId}/recall`, me.headers);
        expect(answer.statusCode).toBe(409);
        expect(answer.json<{ error: string }>().error).toBe('NOT_RECALLABLE');
      });
    });

    it('holds a fleet recall to the same', async () => {
      const me = await aboard(world, 'Me', FIGHTER);
      await world.f.db.update(vessels).set({ facts: ['FIRST_BATTLE_REPORT'] }).where(eq(vessels.id, me.vesselId));
      await arm(world, me.vesselId, { DART: 2 });
      const site = await siteOf(world, 'OUTPOST');
      await placeShip(world, me.vesselId, { x: site.x - 500, y: site.y, z: site.z });
      const launched = await post(world, '/api/starter/fleet/launch', me.headers, { targetPlanetId: site.id, fleet: { DART: 2 } });
      const id = launched.json<{ missionId: string }>().missionId;
      world.f.clock.advance(0.01);
      await world.f.db.transaction(async (tx) => {
        await tx.select().from(vesselMissions).where(and(eq(vesselMissions.id, id))).for('update');
        const answer = await post(world, `/api/starter/fleet/${id}/recall`, me.headers);
        expect(answer.statusCode).toBe(409);
        expect(answer.json<{ error: string }>().error).toBe('NOT_RECALLABLE');
      });
    });
  });

  describe('a jump the sweep cannot finish', () => {
    const failing = (db: Db): Db => new Proxy(db, {
      get: (target, key, receiver) => key === 'transaction'
        ? () => Promise.reject(new Error('the database said no'))
        : Reflect.get(target, key, receiver) as unknown,
    });
    const stuck = async () => {
      const person = await aboard(world, 'Pilot', JUMP_READY);
      await world.f.db.update(vessels).set({ fuel: STARTER.fuelForJump }).where(eq(vessels.id, person.vesselId));
      await runDeparture(world.f.db, person.id, world.f.clock, { afterStep: (step) => { if (step === 'committed') throw new GameError('TEST_CUT', 'cut here', 500); } }).catch(() => undefined);
      world.f.clock.advance(3);
      return person;
    };

    it('writes down why and says so, rather than trying in silence', async () => {
      const person = await stuck();
      await expect(sweepDepartures(failing(world.f.db), world.f.clock)).rejects.toThrow('the database said no');
      const row = await migrationOf(person.vesselId);
      expect(row.status).toBe('DEPARTING');
      expect(row.lastError).toBe('the database said no');
    });

    it('still finishes the other ships, and tells the waiting ones about a new season', async () => {
      const person = await stuck();
      await sweepDepartures(world.f.db, world.f.clock);
      expect((await shipOf(person.vesselId)).status).toBe('DEPARTED');
    });

    it('stays quiet about a refusal: that ship has already been handed back', async () => {
      const person = await stuck();
      await world.f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, world.f.seasonId));
      await sweepDepartures(world.f.db, world.f.clock);
      expect((await shipOf(person.vesselId)).status).toBe('ACTIVE');
      expect((await migrationOf(person.vesselId)).status).toBe('FAILED');
    });
  });
});
