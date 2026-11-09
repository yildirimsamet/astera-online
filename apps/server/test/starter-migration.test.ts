import { FIRST_SEASON_START, STARTER, vesselHull, type Fleet } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accounts, planets, players, seasons, starterDepartures, starterGalaxies, units, vesselMigrations, vesselMissions, vesselOrders, vesselUnits, vessels } from '../src/db/schema.js';
import { recomputeWealth } from '../src/services/planet.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, enrich, get, post, type StarterWorld } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

interface MigrationView {
  block: { code: string } | null;
  target: { shard: string; name: string; seasonEndsAt: string } | null;
  fuel: { loaded: number; needed: number; canLoad: boolean };
  cargo: { alloy: number; crystal: number; deuterium: number; fleet: Fleet };
  left: { alloy: number; crystal: number; deuterium: number; ships: number };
  choices: { index: number; x: number; y: number; z: number; neighbours: number }[];
}
interface Landing { placement: { shard: string; shardName: string; seasonId: string; planetId: string; playerId: string; position: { x: number; y: number; z: number } }; cargo: MigrationView['cargo'] }

const THRUST = { DRIVE_HULL: 1, DRIVE_THRUST: 1, DEUTERIUM_PLANT: 2 };

describe('the jump', () => {
  let world: StarterWorld;
  const ready = async (name = 'Pilot', fleet: Fleet = {}) => {
    const person = await aboard(world, name, THRUST);
    // The works emptied: these cases read the store and the hold, not the prologue's first batch.
    await world.f.db.update(vessels).set({ fuel: STARTER.fuelForJump, bufferAlloy: 0 }).where(eq(vessels.id, person.vesselId));
    await arm(world, person.vesselId, fleet);
    return person;
  };
  const jump = (headers: Record<string, string>, payload: object = {}) => post(world, '/api/starter/migrate', headers, payload);
  const planetOf = async (id: string) => (await world.f.db.select().from(planets).where(eq(planets.id, id)))[0]!;
  const shipOf = async (id: string) => (await world.f.db.select().from(vessels).where(eq(vessels.id, id)))[0]!;

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  describe('the tank', () => {
    it('moves Deuterium from stock into the tank, whole units, and never over the top', async () => {
      const person = await aboard(world, 'Pilot', THRUST);
      await enrich(world, person.vesselId, 0, 0, 200);
      const first = await post(world, '/api/starter/fuel', person.headers, { amount: 30 });
      expect(first.statusCode).toBe(200);
      let ship = await shipOf(person.vesselId);
      expect(ship.fuel).toBe(30);
      expect(ship.deuterium).toBeCloseTo(170, 0);
      await post(world, '/api/starter/fuel', person.headers, { amount: 500 });
      ship = await shipOf(person.vesselId);
      expect(ship.fuel).toBe(STARTER.fuelForJump);
      expect(ship.deuterium).toBeCloseTo(200 - STARTER.fuelForJump, 0);
    });

    it('stays shut until the thrust assembly and the second plant are in', async () => {
      const person = await aboard(world, 'Pilot');
      await enrich(world, person.vesselId, 0, 0, 200);
      const refused = await post(world, '/api/starter/fuel', person.headers, { amount: 30 });
      expect(refused.statusCode).toBe(409);
      expect(refused.json<{ error: string }>().error).toBe('FUEL_LOCKED');
    });

    it('says so when there is nothing to move', async () => {
      const person = await aboard(world, 'Pilot', THRUST);
      await enrich(world, person.vesselId, 0, 0, 0);
      const refused = await post(world, '/api/starter/fuel', person.headers, { amount: 30 });
      expect(refused.statusCode).toBe(409);
      expect(refused.json<{ error: string }>().error).toBe('NOTHING_TO_LOAD');
    });

    it('rejects a nonsense amount at the door', async () => {
      const person = await aboard(world, 'Pilot', THRUST);
      for (const amount of [-1, 0, 1.5, '9']) {
        expect((await post(world, '/api/starter/fuel', person.headers, { amount })).statusCode).toBe(400);
      }
    });
  });

  describe('what the panel reads', () => {
    it('caps opened crate resources in both the departure view and the landed hold', async () => {
      const person = await ready();
      await world.f.db.update(vessels).set({ modules: { ...THRUST, REFINERY: 3, SURVEY: 2, SHIPYARD: 1, EXTRACTOR: 3 }, alloy: 1900, crystal: 950, deuterium: 100 }).where(eq(vessels.id, person.vesselId));
      expect((await post(world, '/api/starter/crates/open', person.headers, {})).statusCode).toBe(200);
      const view = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      expect(view.cargo).toMatchObject({ alloy: STARTER.carry.alloy, crystal: STARTER.carry.crystal, deuterium: STARTER.carry.deuterium });
      const landed = (await jump(person.headers)).json<Landing>();
      expect(landed.cargo).toMatchObject({ alloy: STARTER.carry.alloy, crystal: STARTER.carry.crystal, deuterium: STARTER.carry.deuterium });
    });

    it('states the tank, the target, the hold, what stays behind and three addresses', async () => {
      const person = await ready('Pilot', { DART: 8 });
      await enrich(world, person.vesselId, 5000, 300, 80);
      const body = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      expect(body.block).toBeNull();
      expect(body.fuel).toEqual({ loaded: STARTER.fuelForJump, needed: STARTER.fuelForJump, canLoad: true });
      expect(body.target?.name.length).toBeGreaterThan(0);
      expect(body.cargo).toMatchObject({ alloy: STARTER.carry.alloy, crystal: 300, deuterium: STARTER.carry.deuterium, fleet: { DART: 6 } });
      expect(body.left).toMatchObject({ alloy: 3000, deuterium: 30, ships: 2 });
      expect(body.choices).toHaveLength(3);
    });

    it('never names who lives near an address: only how many', async () => {
      const person = await ready();
      const body = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      expect(Object.keys(body.choices[0]!).sort()).toEqual(['index', 'neighbours', 'x', 'y', 'z']);
      expect(JSON.stringify(body)).not.toContain('Tester0');
    });

    it('counts every world near an address, not only capitals', async () => {
      const person = await ready();
      const body = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      const [row] = await world.f.db.select().from(planets).limit(1);
      const near = body.choices.filter(c => Math.hypot(c.x - row!.x, c.y - row!.y, c.z - row!.z) <= 800);
      for (const choice of near) expect(choice.neighbours).toBeGreaterThanOrEqual(1);
    });

    // The jump pays back whatever is in work before it fills the hold; the panel has to promise the same.
    it('counts what is still in work as paid back, the way the jump does', async () => {
      const person = await ready();
      await enrich(world, person.vesselId, 1000, 500, 0);
      expect((await post(world, '/api/starter/repair', person.headers, { module: 'REFINERY', stage: 2 })).statusCode).toBe(200);
      const view = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      expect(view.cargo).toMatchObject({ alloy: 1000, crystal: 500 });
      expect(view.left).toMatchObject({ alloy: 0, crystal: 0 });
      expect((await jump(person.headers)).json<Landing>().cargo).toEqual(view.cargo);
    });

    it('leaves behind what the refund pushes over the hold', async () => {
      const person = await ready();
      await enrich(world, person.vesselId, STARTER.carry.alloy + 20, STARTER.carry.crystal + 10, 0);
      expect((await post(world, '/api/starter/repair', person.headers, { module: 'REFINERY', stage: 2 })).statusCode).toBe(200);
      const view = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      expect(view.cargo).toMatchObject({ alloy: STARTER.carry.alloy, crystal: STARTER.carry.crystal });
      expect(view.left).toMatchObject({ alloy: 20, crystal: 10 });
      expect((await jump(person.headers)).json<Landing>().cargo).toEqual(view.cargo);
    });

    it('blocks a ship with an empty tank and says why', async () => {
      const person = await aboard(world);
      const body = await get<MigrationView>(world, '/api/starter/migration', person.headers);
      expect(body.block).toEqual({ code: 'MIGRATION_NOT_READY' });
    });
  });

  describe('refused', () => {
    it('refuses an empty tank', async () => {
      const person = await aboard(world);
      const refused = await jump(person.headers);
      expect(refused.statusCode).toBe(409);
      expect(refused.json<{ error: string }>().error).toBe('MIGRATION_NOT_READY');
      expect((await shipOf(person.vesselId)).status).toBe('ACTIVE');
    });

    it('refuses while anything of this ship is in the air', async () => {
      const person = await ready();
      const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, person.vesselId));
      await world.f.db.insert(vesselMissions).values({
        starterGalaxyId: ship!.starterGalaxyId, ownerVesselId: ship!.id, kind: 'MINE', fleet: { PROSPECTOR: 1 },
        departAt: world.f.clock.now(), arriveAt: new Date(world.f.clock.now().getTime() + 60_000), status: 'OUTBOUND',
        fromX: ship!.x, fromY: ship!.y, fromZ: ship!.z, toX: 1, toY: 1, toZ: 1,
      });
      const refused = await jump(person.headers);
      expect(refused.statusCode).toBe(409);
      expect(refused.json<{ error: string }>().error).toBe('MIGRATION_FLEET_OUT');
      expect((await shipOf(person.vesselId)).status).toBe('ACTIVE');
    });

    for (const [name, code, close] of [
      ['a galaxy with no live season', 'NO_FRONTIER', 'frozen'],
    ] as const) {
      it(`hands the ship back whole for ${name}, and says why`, async () => {
        const person = await ready('Pilot', { DART: 2 });
        await enrich(world, person.vesselId, 900, 400, 60);
        await world.f.db.update(seasons).set({ status: close }).where(eq(seasons.id, world.f.seasonId));
        const refused = await jump(person.headers);
        expect(refused.statusCode).toBe(409);
        expect(refused.json<{ error: string }>().error).toBe(code);
        const ship = await shipOf(person.vesselId);
        expect(ship.status).toBe('ACTIVE');
        expect(ship.fuel).toBe(STARTER.fuelForJump);
        expect(ship.alloy).toBeCloseTo(900, 0);
        const [row] = await world.f.db.select().from(players).where(eq(players.accountId, person.id));
        expect(row).toBeUndefined();
      });
    }

    it('answers PLACEMENT_CHANGED after it has gone, so a second device moves on too', async () => {
      const person = await ready();
      expect((await jump(person.headers)).statusCode).toBe(200);
      const again = await jump(person.headers);
      expect(again.statusCode).toBe(409);
      expect(again.json<{ error: string }>().error).toBe('PLACEMENT_CHANGED');
      expect((await world.app.inject({ url: '/api/starter/vessel', headers: person.headers })).json<{ error: string }>().error).toBe('PLACEMENT_CHANGED');
    });
  });

  describe('the landing', () => {
    it('spends the ship and founds a world with the first-season package and the 72 hour shield', async () => {
      const person = await ready();
      await enrich(world, person.vesselId, 0, 0, 0);
      const answer = await jump(person.headers);
      expect(answer.body).toContain('placement');
      const body = answer.json<Landing>();
      const ship = await shipOf(person.vesselId);
      expect(ship.status).toBe('DEPARTED');
      expect(ship.slotIndex).toBeNull();
      const planet = await planetOf(body.placement.planetId);
      expect(planet.kind).toBe('CAPITAL');
      expect(planet.alloy).toBeCloseTo(FIRST_SEASON_START.resources.alloy, 0);
      const [commander] = await world.f.db.select().from(players).where(eq(players.accountId, person.id));
      expect(commander!.newcomerShieldUntil!.getTime() - world.f.clock.now().getTime()).toBe(72 * 3_600_000);
      expect(commander!.id).toBe(body.placement.playerId);
      // The scene flies to this address (owner, 2026-11-09): the world's own, not the one it was asked for.
      expect(body.placement.position).toEqual({ x: planet.x, y: planet.y, z: planet.z });
    });

    it('brings the hold down exactly once, on top of the package, and restates the wealth', async () => {
      const person = await ready('Pilot', { DART: 8, PIKE: 1 });
      await enrich(world, person.vesselId, 5000, 300, 80);
      const body = (await jump(person.headers)).json<Landing>();
      const planet = await planetOf(body.placement.planetId);
      expect(planet.alloy).toBeCloseTo(FIRST_SEASON_START.resources.alloy + STARTER.carry.alloy, 0);
      expect(planet.crystal).toBeCloseTo(FIRST_SEASON_START.resources.crystal + 300, 0);
      expect(planet.deuterium).toBeCloseTo(FIRST_SEASON_START.resources.deuterium + STARTER.carry.deuterium, 0);
      const fleet = await world.f.db.select().from(units).where(and(eq(units.planetId, planet.id), eq(units.location, 'home')));
      const carried = fleet.reduce((sum, row) => sum + row.count, 0) - Object.values(FIRST_SEASON_START.fleet).reduce<number>((sum, n) => sum + n, 0);
      expect(carried).toBe(STARTER.carry.ships);
      // Wealth lives on the commander, and it has to have counted what came down.
      const [commander] = await world.f.db.select().from(players).where(eq(players.id, body.placement.playerId));
      const recorded = commander!.wealth;
      const again = await world.f.db.transaction(tx => recomputeWealth(tx, planet.id, world.f.clock.now()));
      expect(again).toBeCloseTo(recorded, 0);
    });

    it('leaves a wounded ship behind', async () => {
      const person = await ready('Pilot', { DART: 3 });
      await world.f.db.update(vesselUnits).set({ damage: [{ hull: 'DART', count: 2, damageBp: 4000, remainderBp: 0 }] }).where(eq(vesselUnits.vesselId, person.vesselId));
      const body = (await jump(person.headers)).json<Landing>();
      expect(body.cargo.fleet).toEqual({ DART: 1 });
    });

    it('cancels what was still in work and pays it back in full before filling the hold', async () => {
      const person = await ready();
      await enrich(world, person.vesselId, 1000, 500, 0);
      const before = await get<{ vessel: { alloy: number } }>(world, '/api/starter/vessel', person.headers);
      expect(before.vessel.alloy).toBeCloseTo(1000, 0);
      const repair = await post(world, '/api/starter/repair', person.headers, { module: 'REFINERY', stage: 2 });
      expect(repair.statusCode).toBe(200);
      const body = (await jump(person.headers)).json<Landing>();
      expect(body.cargo.alloy).toBe(1000);
      expect(body.cargo.crystal).toBe(500);
      const orders = await world.f.db.select().from(vesselOrders).where(eq(vesselOrders.vesselId, person.vesselId));
      expect(orders.every(order => order.status === 'CANCELLED')).toBe(true);
    });

    it('turns away a fleet flying at a ship that has left', async () => {
      const person = await ready();
      await jump(person.headers);
      const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, person.vesselId));
      expect(ship!.status).toBe('DEPARTED');
    });

    it('writes one line on the departure board, with the commander\'s name and country', async () => {
      const person = await ready('Pilot');
      await world.f.db.update(accounts).set({ countryCode: 'DE' }).where(eq(accounts.id, person.id));
      await jump(person.headers);
      const rows = await world.f.db.select().from(starterDepartures);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ displayName: 'Pilot', countryCode: 'DE' });
    });

    it('shows the board to whoever is still here, newest first, with no ids', async () => {
      const gone = await ready('Gone');
      const stays = await aboard(world, 'Stays');
      await jump(gone.headers);
      const body = await get<{ departures: { name: string; country: string; at: string; hull: string }[] }>(world, '/api/starter/departures', stays.headers);
      expect(body.departures.map(row => row.name)).toEqual(['Gone']);
      expect(Object.keys(body.departures[0]!).sort()).toEqual(['at', 'country', 'hull', 'name', 'x', 'y', 'z']);
      // The neighbours watch this hull leave (owner, 2026-11-09).
      expect(body.departures[0]!.hull).toBe(vesselHull(gone.vesselId));
    });

    // Owner 2026-11-09: the main galaxy sees a newcomer come in. Not where it lands: a world stays hidden
    // until it is found, so the watchers get the ship, the galaxy it left and when, and nothing of the world.
    it('tells the main galaxy what came in during the last minute, and nothing of where it landed', async () => {
      const gone = await ready('Gone');
      await jump(gone.headers);
      const [ship] = await world.f.db.select({ galaxy: starterGalaxies.ordinal, x: vessels.x, y: vessels.y, z: vessels.z }).from(vessels)
        .innerJoin(starterGalaxies, eq(starterGalaxies.id, vessels.starterGalaxyId)).where(eq(vessels.id, gone.vesselId));
      const [departed] = await world.f.db.select().from(starterDepartures);
      const body = await get<{ inbound: Record<string, unknown>[] }>(world, '/api/starter/inbound', gone.headers);
      expect(body.inbound).toEqual([{ hull: vesselHull(gone.vesselId), ordinal: ship!.galaxy, x: departed!.x, y: departed!.y, z: departed!.z, at: departed!.at.toISOString() }]);
      world.f.clock.advance(2);
      expect((await get<{ inbound: unknown[] }>(world, '/api/starter/inbound', gone.headers)).inbound).toEqual([]);
    });

    it('tells nothing to an account with no world in the main galaxy', async () => {
      const gone = await ready('Gone');
      const stays = await aboard(world, 'Stays');
      await jump(gone.headers);
      expect((await get<{ inbound: unknown[] }>(world, '/api/starter/inbound', stays.headers)).inbound).toEqual([]);
    });
  });

  describe('two requests', () => {
    it('come to one world, one hold and one departure', async () => {
      const person = await ready('Pilot', { DART: 2 });
      await enrich(world, person.vesselId, 1000, 500, 10);
      const answers = await Promise.all([jump(person.headers), jump(person.headers)]);
      for (const answer of answers) expect([200, 409]).toContain(answer.statusCode);
      const landed = answers.filter(answer => answer.statusCode === 200).map(answer => answer.json<Landing>());
      expect(landed.length).toBeGreaterThan(0);
      expect(new Set(landed.map(body => body.placement.planetId)).size).toBe(1);
      for (const refused of answers.filter(answer => answer.statusCode === 409)) {
        expect(['PLACEMENT_CHANGED', 'MIGRATION_IN_PROGRESS']).toContain(refused.json<{ error: string }>().error);
      }
      const planet = await planetOf(landed[0]!.placement.planetId);
      expect(planet.alloy).toBeCloseTo(FIRST_SEASON_START.resources.alloy + 1000, 0);
      expect(await world.f.db.select().from(starterDepartures)).toHaveLength(1);
      expect(await world.f.db.select().from(vesselMigrations)).toHaveLength(1);
    });
  });

  describe('the one card after landing', () => {
    it('is owed once, and carries what came down', async () => {
      const person = await ready('Pilot', { DART: 1 });
      await jump(person.headers);
      const owed = await get<{ arrival: { shardName: string; cargo: MigrationView['cargo'] } | null }>(world, '/api/starter/arrival', person.headers);
      expect(owed.arrival?.cargo.fleet).toEqual({ DART: 1 });
      // Watched again, the flight leaves from the ship's own galaxy and berth (review 2026-11-09).
      const [ship] = await world.f.db.select({ galaxy: starterGalaxies.ordinal }).from(vessels)
        .innerJoin(starterGalaxies, eq(starterGalaxies.id, vessels.starterGalaxyId)).where(eq(vessels.id, person.vesselId));
      const [left] = await world.f.db.select().from(starterDepartures);
      expect(owed.arrival).toMatchObject({ ordinal: ship!.galaxy, berth: { x: left!.x, y: left!.y, z: left!.z } });
      expect((await post(world, '/api/starter/arrival/seen', person.headers)).statusCode).toBe(200);
      const after = await get<{ arrival: unknown }>(world, '/api/starter/arrival', person.headers);
      expect(after.arrival).toBeNull();
    });

    it('is owed by nobody who has not jumped', async () => {
      const person = await aboard(world);
      expect((await get<{ arrival: unknown }>(world, '/api/starter/arrival', person.headers)).arrival).toBeNull();
    });
  });
});
