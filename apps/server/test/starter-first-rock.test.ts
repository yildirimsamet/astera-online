import { randomUUID } from 'node:crypto';
import { STARTER, orbitPosition, orbitSeedOf, rockSeedNear, starterAsteroidOrbit } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { starterGalaxies, starterSites, vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { bearer, freshAccount, starterWorld } from './starterFixture.js';

afterAll(async () => { await (await testDb()).close(); });

/** THE FIRST ROCK (retention plan §6.3): a finished Shipyard always has a rock within a minute's flight. */
describe('the first rock', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  let token: string;
  let vesselId: string;
  let galaxyId: string;

  const read = () => world.app.inject({ url: '/api/starter/vessel', headers: bearer(token) });
  const rocks = () => world.f.db.select().from(starterSites).where(and(eq(starterSites.starterGalaxyId, galaxyId), eq(starterSites.kind, 'ASTEROID')));
  const near = async () => {
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, vesselId));
    const [galaxy] = await world.f.db.select().from(starterGalaxies).where(eq(starterGalaxies.id, galaxyId));
    const minutes = (world.f.clock.now().getTime() - galaxy!.epoch.getTime()) / 60_000;
    return (await rocks()).filter(rock => {
      const at = orbitPosition(starterAsteroidOrbit(orbitSeedOf(rock.id)), minutes);
      return Math.hypot(at.x - ship!.x, at.y - ship!.y, at.z - ship!.z) <= STARTER.firstRock.far;
    });
  };
  const buildYard = async () => {
    await world.f.db.update(vessels).set({ modules: { REFINERY: 2, EXTRACTOR: 1 }, alloy: 5000, crystal: 5000 }).where(eq(vessels.id, vesselId));
    const order = await world.app.inject({ method: 'POST', url: '/api/starter/repair', headers: bearer(token), payload: { module: 'TELESCOPE', stage: 1 } });
    expect(order.statusCode).toBe(200);
    world.f.clock.advance(10);
    expect((await read()).statusCode).toBe(200);
  };

  beforeEach(async () => {
    world = await starterWorld();
    const person = await freshAccount(world.f);
    token = person.token;
    const view = (await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(token) })).json<{ vessel: { id: string; galaxy: { id: string } } }>().vessel;
    vesselId = view.id;
    galaxyId = view.galaxy.id;
    await world.f.db.delete(starterSites).where(and(eq(starterSites.starterGalaxyId, galaxyId), eq(starterSites.kind, 'ASTEROID')));
  });
  afterEach(async () => { await world.built.close(); });

  it('puts a rock in reach when the Shipyard is done and none is near', async () => {
    expect(await near()).toEqual([]);
    await buildYard();
    expect((await near()).length).toBe(1);
  });

  it('adds none when a rock is already near', async () => {
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, vesselId));
    const [galaxy] = await world.f.db.select().from(starterGalaxies).where(eq(starterGalaxies.id, galaxyId));
    // Near when the commander sees the finished yard (`buildYard` reads ten minutes on), which is
    // when the guarantee measures. The yard's own finish, seven minutes earlier, is not.
    const minutes = (world.f.clock.now().getTime() - galaxy!.epoch.getTime()) / 60_000 + 10;
    const id = rockSeedNear(ship!, minutes, Array.from({ length: 800 }, () => randomUUID()));
    await world.f.db.insert(starterSites).values({ id: id!, starterGalaxyId: galaxyId, kind: 'ASTEROID', x: 0, y: 0, z: 0, alloy: 300, crystal: 100, stockFull: 400, createdAt: world.f.clock.now() });
    await buildYard();
    expect((await rocks()).length).toBe(1);
  });
});
