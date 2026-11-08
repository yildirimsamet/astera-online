import { STARTER, distance } from '@astera/rules';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vesselMissions, vesselUnits, vessels } from '../src/db/schema.js';
import { sweepStarterWorld } from '../src/services/starter/sites.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, enrich, get, post, type StarterWorld } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

interface MiningView { asteroids: { id: string }[] }

/**
 * THE FIRST SESSION'S ROAD, ABOARD (owner 2026-11-08, N12–N13). The telescope is what shows the rocks
 * and hands over the Prospector; the shipyard hands over the first two Darts. The radar's first return
 * has to reach the ring within the session, so a scout starts just outside it.
 */
describe('the road on the server', () => {
  let world: StarterWorld;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const home = async (id: string) => Object.fromEntries((await world.f.db.select().from(vesselUnits).where(and(eq(vesselUnits.vesselId, id), eq(vesselUnits.location, 'HOME')))).map(unit => [unit.hull, unit.count]));
  const finish = async (person: Awaited<ReturnType<typeof aboard>>, module: string, stage: number) => {
    expect((await post(world, '/api/starter/repair', person.headers, { module, stage })).statusCode).toBe(200);
    world.f.clock.advance(10);
    await get(world, '/api/starter/vessel', person.headers);
  };

  it('shows no rock and refuses a mining run before the telescope', async () => {
    const person = await aboard(world, 'Pilot', { REFINERY: 2, EXTRACTOR: 1 });
    expect((await get<MiningView>(world, '/api/starter/mining', person.headers)).asteroids).toEqual([]);
    const launch = await post(world, '/api/starter/mining/launch', person.headers, { asteroidId: 'AAAAAAAAAAAAAAAAAAAAAA', craft: 1 });
    expect(launch.statusCode).toBeGreaterThanOrEqual(400);
    expect(launch.json<{ error?: string }>()).toMatchObject({ error: 'FEATURE_LOCKED' });
  });

  it('hands over the Prospector and a rock close by with the telescope', async () => {
    const person = await aboard(world, 'Pilot', { REFINERY: 2, EXTRACTOR: 1 });
    await enrich(world, person.vesselId);
    await finish(person, 'TELESCOPE', 1);
    expect(await home(person.vesselId)).toEqual({ PROSPECTOR: 1 });
    const mining = await get<MiningView>(world, '/api/starter/mining', person.headers);
    expect(mining.asteroids.length).toBeGreaterThan(0);
  });

  it('hands over two Darts with the shipyard, and no second Prospector', async () => {
    const person = await aboard(world, 'Pilot', { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1 });
    await enrich(world, person.vesselId);
    await finish(person, 'SHIPYARD', 1);
    expect(await home(person.vesselId)).toEqual({ DART: 2 });
  });

  it('starts the first scout just outside the first radar ring', async () => {
    const person = await aboard(world, 'Pilot', { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 });
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, person.vesselId));
    const now = world.f.clock.now();
    await world.f.db.insert(vesselMissions).values({
      starterGalaxyId: ship!.starterGalaxyId, ownerVesselId: ship!.id, kind: 'MINE', status: 'DONE',
      fromX: ship!.x, fromY: ship!.y, fromZ: ship!.z, toX: ship!.x + 100, toY: ship!.y, toZ: ship!.z, departAt: now, arriveAt: now, orderedAt: now,
    });
    await world.f.db.update(vessels).set({ lastSeenAt: now }).where(eq(vessels.id, ship!.id));
    await sweepStarterWorld(world.f.db, world.f.clock);
    const [scout] = await world.f.db.select().from(vesselMissions).where(and(eq(vesselMissions.targetVesselId, ship!.id), eq(vesselMissions.kind, 'SCOUT')));
    const span = distance({ x: scout!.fromX, y: scout!.fromY, z: scout!.fromZ }, { x: scout!.toX, y: scout!.toY, z: scout!.toZ });
    expect(span).toBeGreaterThan(STARTER.radar[1]);
    expect(span).toBeLessThanOrEqual(STARTER.radar[1] + 150);
  });
});
