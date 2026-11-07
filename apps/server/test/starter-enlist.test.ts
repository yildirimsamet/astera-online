import { COMMUNITY_POLICY_VERSION, STARTER, VESSEL_HULLS, distance, vesselHull } from '@astera/rules';
import { asc, eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accounts, players, starterGalaxies, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { TOKENS, bearer, freshAccount, starterWorld } from './starterFixture.js';

afterAll(async () => { await (await testDb()).close(); });

describe('taking a colony ship', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  const enlist = (token: string) => world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(token) });
  const me = async (token: string) => (await world.app.inject({ url: '/api/auth/me', headers: bearer(token) })).json<Record<string, unknown>>();

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('gives a new account a real ship, opened from the constant', async () => {
    const person = await freshAccount(world.f);
    const response = await enlist(person.token);
    expect(response.statusCode).toBe(200);
    const view = response.json<{ vessel: Record<string, unknown> & { position: { x: number; y: number; z: number } } }>().vessel;
    expect(view).toMatchObject({
      status: 'ACTIVE', name: 'Newcomer', alloy: STARTER.opening.alloy, crystal: STARTER.opening.crystal, deuterium: 0,
      modules: STARTER.opening.modules, facts: [], parts: 0, fuel: 0,
    });
    expect(Math.hypot(view.position.x, view.position.y, view.position.z)).toBeLessThanOrEqual(STARTER.radius);
  });

  it('opens the galaxy with its first ship, on the main shard', async () => {
    const person = await freshAccount(world.f);
    await enlist(person.token);
    const galaxies = await world.f.db.select().from(starterGalaxies);
    expect(galaxies).toHaveLength(1);
    expect(galaxies[0]).toMatchObject({ ordinal: 1, capacity: STARTER.capacity, status: 'OPEN', epoch: world.f.clock.now() });
  });

  it('writes no commander: no players row until the landing', async () => {
    const person = await freshAccount(world.f);
    await enlist(person.token);
    expect(await world.f.db.select().from(players).where(eq(players.accountId, person.id))).toHaveLength(0);
    const [row] = await world.f.db.select().from(accounts).where(eq(accounts.id, person.id));
    expect(row!.firstSeasonStartedAt).toBeNull();
  });

  it('answers twice with the same ship', async () => {
    const person = await freshAccount(world.f);
    const first = (await enlist(person.token)).json<{ vessel: { id: string } }>();
    const second = (await enlist(person.token)).json<{ vessel: { id: string } }>();
    expect(second.vessel.id).toBe(first.vessel.id);
  });

  it('makes one row out of two requests at once', async () => {
    const person = await freshAccount(world.f);
    const [a, b] = await Promise.all([enlist(person.token), enlist(person.token)]);
    expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
    expect(await world.f.db.select().from(vessels).where(eq(vessels.accountId, person.id))).toHaveLength(1);
  });

  it('gives two people two berths when they arrive together', async () => {
    const people = await Promise.all([freshAccount(world.f, 'One'), freshAccount(world.f, 'Two'), freshAccount(world.f, 'Three')]);
    await Promise.all(people.map(person => enlist(person.token)));
    const rows = await world.f.db.select({ slot: vessels.slotIndex }).from(vessels);
    expect(new Set(rows.map(row => row.slot)).size).toBe(3);
  });

  it('puts a second ship near the first', async () => {
    const one = (await enlist((await freshAccount(world.f, 'One')).token)).json<{ vessel: { position: { x: number; y: number; z: number } } }>();
    const two = (await enlist((await freshAccount(world.f, 'Two')).token)).json<{ vessel: { position: { x: number; y: number; z: number } } }>();
    expect(distance(one.vessel.position, two.vessel.position)).toBeLessThan(STARTER.radius);
  });

  it('refuses someone who has played before', async () => {
    const response = await enlist(await TOKENS.issueAccess(world.f.accountIds[0]!));
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'VESSEL_NOT_ELIGIBLE' });
  });

  it('refuses a retained season receipt, even with no commander left', async () => {
    const person = await freshAccount(world.f);
    await world.f.db.update(accounts).set({ lifetime: sql`jsonb_set(${accounts.lifetime}, '{seasons}', '1')` }).where(eq(accounts.id, person.id));
    expect((await enlist(person.token)).json()).toMatchObject({ error: 'VESSEL_NOT_ELIGIBLE' });
  });

  it('never gives a second ship after the first has left', async () => {
    const person = await freshAccount(world.f);
    await enlist(person.token);
    await world.f.db.update(vessels).set({ status: 'DEPARTED', slotIndex: null }).where(eq(vessels.accountId, person.id));
    expect((await enlist(person.token)).statusCode).toBe(403);
    expect(await world.f.db.select().from(vessels).where(eq(vessels.accountId, person.id))).toHaveLength(1);
  });

  describe('when this galaxy is full', () => {
    const fill = async () => {
      const first = await freshAccount(world.f, 'First');
      await enlist(first.token);
      await world.f.db.update(starterGalaxies).set({ capacity: 1 });
      return first;
    };
    const galaxies = () => world.f.db.select().from(starterGalaxies).orderBy(asc(starterGalaxies.ordinal));

    it('still offers a newcomer a ship', async () => {
      await fill();
      expect(await me((await freshAccount(world.f, 'Late')).token)).toMatchObject({ starterEligible: true });
    });

    it('opens the next galaxy, with its own number and seed', async () => {
      await fill();
      const late = await freshAccount(world.f, 'Late');
      expect((await enlist(late.token)).statusCode).toBe(200);
      const [full, next] = await galaxies();
      expect(full).toMatchObject({ ordinal: 1, status: 'OPEN' });
      expect(next).toMatchObject({ ordinal: 2, status: 'OPEN', capacity: STARTER.capacity });
      const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.accountId, late.id));
      expect(ship!.starterGalaxyId).toBe(next!.id);
    });

    it('fills a place that came free before it opens another, oldest galaxy first', async () => {
      const first = await fill();
      await enlist((await freshAccount(world.f, 'Late')).token);
      await world.f.db.update(starterGalaxies).set({ capacity: 1 });
      await world.f.db.update(vessels).set({ status: 'DEPARTED', slotIndex: null }).where(eq(vessels.accountId, first.id));
      const third = await freshAccount(world.f, 'Third');
      await enlist(third.token);
      const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.accountId, third.id));
      const all = await galaxies();
      expect(ship!.starterGalaxyId).toBe(all[0]!.id);
      expect(all).toHaveLength(2);
    });

    it('never gives a newcomer a galaxy closed by hand', async () => {
      await fill();
      await world.f.db.update(starterGalaxies).set({ status: 'CLOSED' });
      const late = await freshAccount(world.f, 'Late');
      expect(await me(late.token)).toMatchObject({ starterEligible: false });
      expect((await enlist(late.token)).json()).toMatchObject({ error: 'VESSEL_NOT_ELIGIBLE' });
    });

    it('leaves the ships in a full galaxy playing as before', async () => {
      const first = await fill();
      await enlist((await freshAccount(world.f, 'Late')).token);
      expect((await world.app.inject({ url: '/api/starter/vessel', headers: bearer(first.token) })).statusCode).toBe(200);
    });

    it('opens only what is needed however many arrive together, and gives each a berth', async () => {
      await fill();
      const people = await Promise.all(Array.from({ length: 4 }, (_, index) => freshAccount(world.f, `Crowd${String(index)}`)));
      await world.f.db.update(starterGalaxies).set({ capacity: 1 });
      const answers = await Promise.all(people.map(person => enlist(person.token)));
      expect(answers.every(answer => answer.statusCode === 200)).toBe(true);
      const all = await galaxies();
      expect(all.map(galaxy => galaxy.ordinal)).toEqual([1, 2]);
      const inSecond = (await world.f.db.select().from(vessels)).filter(ship => ship.starterGalaxyId === all[1]!.id);
      expect(inSecond).toHaveLength(4);
      expect(new Set(inSecond.map(ship => ship.slotIndex)).size).toBe(4);
    });

    it('says which galaxy a ship is in, so the client can place the main galaxy from there', async () => {
      await fill();
      const late = await freshAccount(world.f, 'Late');
      await enlist(late.token);
      const body = (await world.app.inject({ url: '/api/starter/vessel', headers: bearer(late.token) })).json<{ vessel: { galaxy: { ordinal: number } } }>();
      expect(body.vessel.galaxy.ordinal).toBe(2);
    });
  });

  it('frees a berth when a ship leaves', async () => {
    const first = await freshAccount(world.f, 'First');
    await enlist(first.token);
    await world.f.db.update(starterGalaxies).set({ capacity: 1 });
    await world.f.db.update(vessels).set({ status: 'DEPARTED', slotIndex: null }).where(eq(vessels.accountId, first.id));
    expect((await enlist((await freshAccount(world.f, 'Next')).token)).statusCode).toBe(200);
  });
});

describe('what the session says', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });
  const me = async (token: string) => (await world.app.inject({ url: '/api/auth/me', headers: bearer(token) })).json<Record<string, unknown>>();

  it('marks a newcomer eligible, and a ship holder by the ship', async () => {
    const person = await freshAccount(world.f);
    expect(await me(person.token)).toMatchObject({ placement: null, vessel: null, starterEligible: true });
    await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(person.token) });
    expect(await me(person.token)).toMatchObject({ placement: null, starterEligible: false, vessel: { status: 'ACTIVE' } });
  });

  it('marks a settled commander neither', async () => {
    const token = await TOKENS.issueAccess(world.f.accountIds[0]!);
    expect(await me(token)).toMatchObject({ vessel: null, starterEligible: false });
  });

  it('stops naming a ship once it has left', async () => {
    const person = await freshAccount(world.f);
    await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(person.token) });
    await world.f.db.update(vessels).set({ status: 'DEPARTED', slotIndex: null }).where(eq(vessels.accountId, person.id));
    expect(await me(person.token)).toMatchObject({ vessel: null, starterEligible: false });
  });

  it('never tells an account how a ship was made', async () => {
    const person = await freshAccount(world.f);
    await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(person.token) });
    const answer = JSON.stringify(await me(person.token)).toLowerCase();
    expect(answer).not.toContain('bot');
  });
});

describe('the door to the main galaxy', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });
  const join = (token: string) => world.app.inject({ method: 'POST', url: '/api/servers/EU-TEST-4242/join', headers: bearer(token) });

  it('sends a newcomer to the ship first', async () => {
    const person = await freshAccount(world.f);
    const response = await join(person.token);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'STARTER_REQUIRED' });
    expect(await world.f.db.select().from(players).where(eq(players.accountId, person.id))).toHaveLength(0);
  });

  it('holds a ship holder aboard', async () => {
    const person = await freshAccount(world.f);
    await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(person.token) });
    expect((await join(person.token)).json()).toMatchObject({ error: 'STARTER_REQUIRED' });
  });

  it('leaves a veteran alone', async () => {
    const token = await TOKENS.issueAccess(world.f.accountIds[0]!);
    expect((await join(token)).statusCode).toBe(200);
  });
});

describe('claiming the prologue', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const claim = (username: string, extra: Record<string, unknown> = {}) => world.app.inject({
    method: 'POST', url: '/api/onboarding/claim', headers: { origin: 'https://localhost' },
    payload: { username, password: 'fixture-password-123', communityPolicyVersion: COMMUNITY_POLICY_VERSION, communityPolicyLocale: 'en', intents: [], ...extra },
  });

  /**
   * THE SHIP SHOWN IS THE SHIP GIVEN (owner 2026-11-06). The prologue flies to a ship and offers it;
   * the hull comes from the id, so the server draws ids until one wears the hull that was shown.
   */
  it('hands over the very hull the prologue showed', async () => {
    for (const [index, hull] of VESSEL_HULLS.entries()) {
      const answer = await claim(`hullplayer${String(index)}`, { vesselHull: hull });
      expect(answer.statusCode).toBe(200);
      expect(vesselHull(answer.json<{ vessel: { id: string } }>().vessel.id)).toBe(hull);
    }
  });

  it('starts the ship with the prologue\'s batch waiting in the refinery', async () => {
    const answer = await claim('worksplayer');
    expect(answer.statusCode).toBe(200);
    const [row] = await world.f.db.select({ bufferAlloy: vessels.bufferAlloy }).from(vessels).where(eq(vessels.id, answer.json<{ vessel: { id: string } }>().vessel.id));
    expect(row?.bufferAlloy).toBe(STARTER.opening.works.alloy);
  });

  it('refuses a hull that does not exist', async () => {
    expect((await claim('hullplayerx', { vesselHull: 'SAUCER' })).statusCode).toBe(400);
  });

  it('lands a new account on a ship, whatever the browser claims to have done', async () => {
    const response = await claim('prologueplayer');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ placement: null, planet: null, applied: [], vessel: { status: 'ACTIVE', alloy: STARTER.opening.alloy } });
    expect(await world.f.db.select().from(players)).toHaveLength(1);
  });

  it('answers a retried claim with the same ship', async () => {
    const first = (await claim('prologueplayer')).json<{ vessel: { id: string } }>();
    const second = (await claim('prologueplayer')).json<{ vessel: { id: string } }>();
    expect(second.vessel.id).toBe(first.vessel.id);
  });

  it('names the flag to anyone who asks, signed in or not', async () => {
    const open = await world.app.inject({ url: '/api/auth/capabilities' });
    expect(open.json<{ starterGalaxy: boolean }>().starterGalaxy).toBe(true);
    const shut = await starterWorld({ STARTER_GALAXY_ENABLED: 'false' });
    const closed = await shut.app.inject({ url: '/api/auth/capabilities' });
    expect(closed.json<{ starterGalaxy: boolean }>().starterGalaxy).toBe(false);
    await shut.built.close();
  });
});
