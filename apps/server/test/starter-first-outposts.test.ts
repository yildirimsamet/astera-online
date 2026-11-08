import { STARTER, distance, fleetSpeed, travelExact, type Fleet } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { starterSites, vessels } from '../src/db/schema.js';
import { sweepStarterWorld } from '../src/services/starter/sites.js';
import { testDb } from './helpers.js';
import { bearer, freshAccount, starterWorld } from './starterFixture.js';
import { aboard, arm, placeShip, post } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

/**
 * THE FIRST HUNT (owner 2026-11-08, N6–N7). A finished Shipyard always has two outposts a Dart pair
 * reaches in three to five minutes: a Sur-held first-level one its two Darts can take, and an Akıncı-
 * or Mızrak-held second-level one that asks for a counter. Shared, kept by nobody, and bounded per galaxy.
 */
describe('the first outposts', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  let token: string;
  let vesselId: string;
  let galaxyId: string;

  const outposts = () => world.f.db.select().from(starterSites).where(and(eq(starterSites.starterGalaxyId, galaxyId), eq(starterSites.kind, 'OUTPOST')));
  const ship = async () => (await world.f.db.select().from(vessels).where(eq(vessels.id, vesselId)))[0]!;
  const held = (guard: Fleet | null) => Object.keys(guard ?? {});
  const buildYard = async () => {
    await world.f.db.update(vessels).set({ modules: { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, VAULT: 1 }, alloy: 5000, crystal: 5000 }).where(eq(vessels.id, vesselId));
    const order = await world.app.inject({ method: 'POST', url: '/api/starter/repair', headers: bearer(token), payload: { module: 'SHIPYARD', stage: 1 } });
    expect(order.statusCode).toBe(200);
    world.f.clock.advance(10);
    expect((await world.app.inject({ url: '/api/starter/vessel', headers: bearer(token) })).statusCode).toBe(200);
  };
  const standing = (at: { x: number; y: number; z: number }, level: number, guard: Fleet, extra: Partial<typeof starterSites.$inferInsert> = {}) =>
    world.f.db.insert(starterSites).values({
      starterGalaxyId: galaxyId, kind: 'OUTPOST', ...at, level, alloy: 100, crystal: 100, deuterium: 0, stockFull: 200,
      guard, guardFull: guard, createdAt: world.f.clock.now(), ...extra,
    });
  const beside = async (dx: number, dz = 0) => { const me = await ship(); return { x: me.x + dx, y: me.y, z: me.z + dz }; };

  beforeEach(async () => {
    world = await starterWorld();
    const person = await freshAccount(world.f);
    token = person.token;
    const view = (await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(token) })).json<{ vessel: { id: string; galaxy: { id: string } } }>().vessel;
    vesselId = view.id;
    galaxyId = view.galaxy.id;
    await world.f.db.delete(starterSites).where(and(eq(starterSites.starterGalaxyId, galaxyId), eq(starterSites.kind, 'OUTPOST')));
  });
  afterEach(async () => { await world.built.close(); });

  it('shows a finished shipyard a Sur outpost and an Akıncı or Mızrak one, a Dart pair\'s three to five minutes away', async () => {
    await buildYard();
    const me = await ship();
    const found = await outposts();
    expect(found).toHaveLength(2);
    const wall = found.find(site => site.level === 1)!;
    const counter = found.find(site => site.level === 2)!;
    expect(wall.guardFull).toEqual({ WARDEN: STARTER.sites.outposts.guards[0] });
    expect(['DART', 'PIKE']).toContain(held(counter.guardFull)[0]);
    expect(wall).toMatchObject({ stockFull: STARTER.sites.outposts.stock[0], respawnAt: null, hasPart: false });
    for (const site of found) {
      const minutes = travelExact(distance(me, site), fleetSpeed({ DART: 2 }, {}));
      expect(minutes).toBeGreaterThanOrEqual(3);
      expect(minutes).toBeLessThanOrEqual(5);
    }
  });

  it('adds none when both stand in reach already', async () => {
    await standing(await beside(350), 1, { WARDEN: 2 });
    await standing(await beside(-380), 2, { PIKE: 3 });
    await buildYard();
    expect(await outposts()).toHaveLength(2);
  });

  it('adds only the one that is missing', async () => {
    await standing(await beside(350), 1, { WARDEN: 2 });
    await buildYard();
    const found = await outposts();
    expect(found).toHaveLength(2);
    expect(found.filter(site => site.level === 2)).toHaveLength(1);
  });

  it('does not count an outpost that is down until it comes back', async () => {
    await standing(await beside(350), 1, { WARDEN: 2 }, { guard: {}, respawnAt: new Date(world.f.clock.now().getTime() + 3_600_000) });
    await standing(await beside(-380), 2, { DART: 3 });
    await buildYard();
    expect((await outposts()).filter(site => site.level === 1)).toHaveLength(2);
  });

  it('stops at what a galaxy may be given', async () => {
    for (let i = 0; i < STARTER.sites.outposts.count + STARTER.firstOutposts.extraMax; i++) await standing({ x: -880, y: 0, z: i * 10 - 100 }, 3, { PIKE: 6 });
    await buildYard();
    expect(await outposts()).toHaveLength(STARTER.sites.outposts.count + STARTER.firstOutposts.extraMax);
  });

  it('still lets a galaxy lay out its own places when the first outposts came before them', async () => {
    await world.f.db.delete(starterSites).where(eq(starterSites.starterGalaxyId, galaxyId));
    await buildYard();
    expect(await outposts()).toHaveLength(2);
    await sweepStarterWorld(world.f.db, world.f.clock);
    const wrecks = await world.f.db.select().from(starterSites).where(and(eq(starterSites.starterGalaxyId, galaxyId), eq(starterSites.kind, 'WRECK')));
    expect(wrecks).toHaveLength(STARTER.sites.wrecks.count);
    expect(await outposts()).toHaveLength(2 + STARTER.sites.outposts.count);
  });

  it('keeps them for nobody: another shipyard may raid them', async () => {
    await buildYard();
    const [wall] = (await outposts()).filter(site => site.level === 1);
    const other = await aboard(world, 'Other', { SHIPYARD: 1, SURVEY: 1, REFINERY: 3 });
    await arm(world, other.vesselId, { DART: 2 });
    await placeShip(world, other.vesselId, { x: wall!.x - 300, y: wall!.y, z: wall!.z });
    expect((await post(world, '/api/starter/fleet/launch', other.headers, { targetPlanetId: wall!.id, fleet: { DART: 2 } })).statusCode).toBe(200);
  });
});
