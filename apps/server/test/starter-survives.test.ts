import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FIRST_SEASON_START, newcomerShieldUntil } from '@astera/rules';
import { accounts, planets, players, starterEvents, starterGalaxies, vesselNotifications, vesselOrders, vesselUnits, vessels } from '../src/db/schema.js';
import { deleteAccount } from '../src/services/accountDeletion.js';
import { joinSeason } from '../src/services/player.js';
import { enlistVessel } from '../src/services/starter/enlist.js';
import { wipeAllServers } from '../src/services/servers.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { testDb } from './helpers.js';
import { bearer, freshAccount, starterWorld } from './starterFixture.js';

afterAll(async () => { await (await testDb()).close(); });

describe('what happens around a ship', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  let person: Awaited<ReturnType<typeof freshAccount>>;
  let vesselId: string;

  beforeEach(async () => {
    world = await starterWorld();
    person = await freshAccount(world.f);
    const enlisted = await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(person.token) });
    vesselId = enlisted.json<{ vessel: { id: string } }>().vessel.id;
    await world.app.inject({ method: 'POST', url: '/api/starter/repair', headers: bearer(person.token), payload: { module: 'REFINERY', stage: 2 } });
  });
  afterEach(async () => { await world.built.close(); });

  describe('the season wipe', () => {
    it('leaves the ship, its orders, its events and its galaxy alone', async () => {
      await forceSeasonEnd({ db: world.f.db, clock: world.f.clock }, world.f.seasonId);
      await wipeAllServers(world.f.db, world.f.clock, { count: 1, capacity: 2, seedBase: 7719 });
      expect(await world.f.db.select().from(vessels).where(eq(vessels.id, vesselId))).toHaveLength(1);
      expect(await world.f.db.select().from(starterGalaxies)).toHaveLength(1);
      expect(await world.f.db.select().from(vesselOrders)).toHaveLength(1);
      expect(await world.f.db.select().from(starterEvents)).toHaveLength(1);
    });
  });

  describe('deleting the account', () => {
    it('takes the ship and everything on it, and leaves the galaxy', async () => {
      await world.f.db.insert(vesselUnits).values({ vesselId, hull: 'DART', location: 'HOME', count: 2 });
      await world.f.db.insert(vesselNotifications).values({ vesselId, kind: 'REPAIR_DONE', refId: vesselId, payload: {}, createdAt: world.f.clock.now() });
      await deleteAccount(world.f.db, world.f.clock, person.username);
      expect(await world.f.db.select().from(accounts).where(eq(accounts.id, person.id))).toHaveLength(0);
      expect(await world.f.db.select().from(vessels)).toHaveLength(0);
      expect(await world.f.db.select().from(vesselUnits)).toHaveLength(0);
      expect(await world.f.db.select().from(vesselOrders)).toHaveLength(0);
      expect(await world.f.db.select().from(vesselNotifications)).toHaveLength(0);
      expect(await world.f.db.select().from(starterGalaxies)).toHaveLength(1);
    });
  });

  describe('the first-season trap', () => {
    it('gives a landing account the whole first-season package and the 72-hour shield', async () => {
      await world.f.db.update(vessels).set({ status: 'DEPARTED', slotIndex: null }).where(eq(vessels.id, vesselId));
      const joined = await joinSeason(world.f.db, person.id, world.f.seasonId, world.f.clock);
      const [planet] = await world.f.db.select().from(planets).where(eq(planets.id, joined.planetId));
      expect(planet!.alloy).toBe(FIRST_SEASON_START.resources.alloy);
      const [player] = await world.f.db.select().from(players).where(eq(players.id, joined.playerId));
      expect(player!.newcomerShieldUntil!.getTime()).toBe(newcomerShieldUntil(world.f.clock.now().getTime(), true));
    });

    it('does not count a ship as having played', async () => {
      const [row] = await world.f.db.select().from(accounts).where(eq(accounts.id, person.id));
      expect(row!.firstSeasonStartedAt).toBeNull();
      expect(row!.firstGameShieldAvailable).toBe(true);
    });
  });
});

describe('with the flag off', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld({ STARTER_GALAXY_ENABLED: 'false' }); });
  afterEach(async () => { await world.built.close(); });

  it('opens no new ship', async () => {
    const person = await freshAccount(world.f);
    const response = await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(person.token) });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'STARTER_CLOSED' });
    expect(await world.f.db.select().from(vessels)).toHaveLength(0);
  });

  it('calls nobody eligible, and lets a newcomer into a galaxy as before', async () => {
    const person = await freshAccount(world.f);
    const me = (await world.app.inject({ url: '/api/auth/me', headers: bearer(person.token) })).json<Record<string, unknown>>();
    expect(me).toMatchObject({ vessel: null, starterEligible: false });
    expect((await world.app.inject({ method: 'POST', url: '/api/servers/EU-TEST-4242/join', headers: bearer(person.token) })).statusCode).toBe(200);
  });

  it('keeps a ship that already exists running', async () => {
    const person = await freshAccount(world.f);
    await enlistVessel(world.f.db, person.id, world.f.clock);
    expect((await world.app.inject({ url: '/api/starter/vessel', headers: bearer(person.token) })).statusCode).toBe(200);
    const repair = await world.app.inject({ method: 'POST', url: '/api/starter/repair', headers: bearer(person.token), payload: { module: 'REFINERY', stage: 2 } });
    expect(repair.statusCode).toBe(200);
    const join = await world.app.inject({ method: 'POST', url: '/api/servers/EU-TEST-4242/join', headers: bearer(person.token) });
    expect(join.json()).toMatchObject({ error: 'STARTER_REQUIRED' });
  });
});
