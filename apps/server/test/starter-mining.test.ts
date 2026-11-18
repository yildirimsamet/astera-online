import { PROSPECTOR, STARTER, moduleStage, orbitPosition, orbitSeedOf, starterAsteroidOrbit, type VesselFact } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { miningLaunchSchema, miningSchema } from '../../web/src/api/schemas.js';
import { starterGalaxies, starterSites, vesselMissions, vessels } from '../src/db/schema.js';
import { sweepStarterWorld } from '../src/services/starter/sites.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, enrich, get, pass, post, siteOf } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });
void moduleStage; void PROSPECTOR;
const MINER = { SHIPYARD: 1, SURVEY: 1, REFINERY: 3, TELESCOPE: 1 };

/** A site id as the client's schema wants it. */
const opaque = (uuid: string) => Buffer.from(uuid.replace(/-/g, ''), 'hex').toString('base64url');

describe('digging and salvage aboard', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const ready = async (modules: Record<string, number> = MINER, facts: VesselFact[] = []) => {
    const me = await aboard(world, 'Me', modules);
    await arm(world, me.vesselId, { PROSPECTOR: 2 });
    await world.f.db.update(vessels).set({ facts }).where(eq(vessels.id, me.vesselId));
    await enrich(world, me.vesselId, 100, 100, 0);
    return me;
  };
  const rock = () => siteOf(world, 'ASTEROID');
  const ship = async (id: string) => (await world.f.db.select().from(vessels).where(eq(vessels.id, id)))[0]!;

  it('shows the rocks once the telescope works, in the schema the map reads', async () => {
    const me = await ready();
    await sweepStarterWorld(world.f.db, world.f.clock);
    // The telescope shows what its ring holds, so the ship is put where the sweep's rock is passing.
    const site = await rock();
    const [galaxy] = await world.f.db.select().from(starterGalaxies);
    const at = orbitPosition(starterAsteroidOrbit(orbitSeedOf(site.id)), (world.f.clock.now().getTime() - galaxy!.epoch.getTime()) / 60_000);
    await world.f.db.update(vessels).set({ x: at.x, y: at.y, z: at.z }).where(eq(vessels.id, me.vesselId));
    const body = miningSchema.parse(await get(world, '/api/starter/mining', me.headers));
    expect(body.asteroids.length).toBeGreaterThan(0);
    expect(body.craftSpeed).toBe(STARTER.prospectorSpeed);
  });

  it('shows no rocks before', async () => {
    const me = await aboard(world, 'Me');
    await sweepStarterWorld(world.f.db, world.f.clock);
    const body = miningSchema.parse(await get(world, '/api/starter/mining', me.headers));
    expect(body.asteroids).toEqual([]);
  });

  it('flies, digs once, comes home with the ore, and opens salvage', async () => {
    const me = await ready();
    const site = await rock();
    const answer = await post(world, '/api/starter/mining/launch', me.headers, { asteroidId: opaque(site.id), craft: 1 });
    expect(answer.statusCode).toBe(200);
    const flown = answer.json<{ runId: string; capacity: number }>();
    expect(flown.capacity).toBe(PROSPECTOR.hold);
    await pass(world, 60);
    const after = await ship(me.vesselId);
    const [flight] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
    const haul = flight!.cargo.alloy + flight!.cargo.crystal + flight!.cargo.deuterium;
    expect(haul).toBeGreaterThan(0);
    // Owner K3: the haul lands in the works, as a world's does, and waits to be collected.
    expect(after.alloy).toBe(100);
    expect(after.crystal).toBe(100);
    expect(after.bufferAlloy + after.bufferCrystal + after.bufferDeuterium).toBeGreaterThanOrEqual(haul);
    expect(after.facts).toContain('FIRST_MINING_RETURN');
    const [left] = await world.f.db.select().from(starterSites).where(eq(starterSites.id, site.id));
    expect(left!.alloy + left!.crystal + left!.deuterium).toBeLessThan(site.alloy + site.crystal + site.deuterium);
    const [mission] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
    expect(mission!.status).toBe('DONE');
  });

  // Owner phone playtest 2026-11-19: the guided road waits for the first Prospector, so it is home within
  // fifteen to twenty seconds however far its rock; later runs keep their own pace.
  describe('the first run', () => {
    /** The ship five hundred units from where the rock is now: a minute's flight out at the plain pace. */
    const farFrom = async (vesselId: string, site: { id: string }) => {
      const [galaxy] = await world.f.db.select().from(starterGalaxies);
      const at = orbitPosition(starterAsteroidOrbit(orbitSeedOf(site.id)), (world.f.clock.now().getTime() - galaxy!.epoch.getTime()) / 60_000);
      await world.f.db.update(vessels).set({ x: at.x + 500, y: at.y, z: at.z }).where(eq(vessels.id, vesselId));
    };
    const launch = async (headers: Record<string, string>, site: { id: string }) => {
      const answer = await post(world, '/api/starter/mining/launch', headers, { asteroidId: opaque(site.id), craft: 1 });
      expect(answer.statusCode).toBe(200);
      return new Date(answer.json<{ arriveAt: string }>().arriveAt).getTime() - world.f.clock.now().getTime();
    };

    it('reaches its rock and comes home within the first trip\'s seconds', async () => {
      const me = await ready();
      const site = await rock();
      await farFrom(me.vesselId, site);
      expect(await launch(me.headers, site)).toBeLessThanOrEqual(STARTER.firstTrips.mineOut * 1000);
      await pass(world, STARTER.firstTrips.mineOut / 60);
      const [flight] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
      expect(flight!.status).toBe('RETURNING');
      expect(flight!.returnAt!.getTime() - flight!.arriveAt.getTime()).toBeLessThanOrEqual(STARTER.firstTrips.mineBack * 1000);
      await pass(world, STARTER.firstTrips.mineBack / 60);
      expect((await ship(me.vesselId)).facts).toContain('FIRST_MINING_RETURN');
    });

    it('is the only one: a ship that has sent and brought home one flies at its own pace', async () => {
      const me = await ready(MINER, ['FIRST_MINING_SENT', 'FIRST_MINING_RETURN']);
      const site = await rock();
      await farFrom(me.vesselId, site);
      expect(await launch(me.headers, site)).toBeGreaterThan(30_000);
    });
  });

  // The radar waits on the first send, so a ship that has yet to send one is never left with no rock in reach.
  it('keeps a rock in reach of a ship that has not sent its first Prospector', async () => {
    const me = await ready();
    await world.f.db.update(starterSites).set({ alloy: 0, crystal: 0, deuterium: 0 }).where(eq(starterSites.kind, 'ASTEROID'));
    await sweepStarterWorld(world.f.db, world.f.clock);
    expect(miningSchema.parse(await get(world, '/api/starter/mining', me.headers)).asteroids.length).toBeGreaterThanOrEqual(STARTER.sites.rocksInSight[1]);
  });

  it('records the first send at the launch, and only once', async () => {
    const me = await ready();
    const site = await rock();
    expect((await post(world, '/api/starter/mining/launch', me.headers, { asteroidId: opaque(site.id), craft: 1 })).statusCode).toBe(200);
    expect((await ship(me.vesselId)).facts).toEqual(['FIRST_MINING_SENT']);
    expect((await post(world, '/api/starter/mining/launch', me.headers, { asteroidId: opaque(site.id), craft: 1 })).statusCode).toBe(200);
    expect((await ship(me.vesselId)).facts).toEqual(['FIRST_MINING_SENT']);
  });

  it('does not take a refused launch for a send', async () => {
    const me = await ready();
    const site = await rock();
    expect((await post(world, '/api/starter/mining/launch', me.headers, { asteroidId: opaque(site.id), craft: 9 })).statusCode).toBeGreaterThanOrEqual(400);
    expect((await ship(me.vesselId)).facts).toEqual([]);
  });

  it('pays once however often the landing is delivered', async () => {
    const me = await ready();
    const site = await rock();
    await post(world, '/api/starter/mining/launch', me.headers, { asteroidId: opaque(site.id), craft: 1 });
    await pass(world, 60);
    const once = await ship(me.vesselId);
    const [mission] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
    const { resolveMissionArrival, resolveMissionReturn } = await import('../src/services/starter/arrival.js');
    await resolveMissionArrival(world.f.db, mission!.id, world.f.clock);
    await resolveMissionReturn(world.f.db, mission!.id, world.f.clock);
    const twice = await ship(me.vesselId);
    expect(twice.bufferAlloy).toBeCloseTo(once.bufferAlloy, 0);
    expect(twice.bufferCrystal).toBeCloseTo(once.bufferCrystal, 0);
  });

  it('has only what is there to take when two arrive for one rock', async () => {
    const first = await ready();
    const second = await aboard(world, 'Two', MINER);
    await arm(world, second.vesselId, { PROSPECTOR: 2 });
    const site = await rock();
    await world.f.db.update(starterSites).set({ alloy: 50, crystal: 0, deuterium: 0 }).where(eq(starterSites.id, site.id));
    await post(world, '/api/starter/mining/launch', first.headers, { asteroidId: opaque(site.id), craft: 1 });
    await post(world, '/api/starter/mining/launch', second.headers, { asteroidId: opaque(site.id), craft: 1 });
    await pass(world, 60);
    const missions = await world.f.db.select().from(vesselMissions);
    expect(missions.reduce((sum, m) => sum + m.cargo.alloy, 0)).toBeCloseTo(50, 0);
  });

  // Plan 2026-11-13 §5.1: the jump window asks for a real dig, so a run called back on its way out does not count.
  it('does not take a run called back before the rock for a dig', async () => {
    const me = await ready();
    const site = await rock();
    const { runId } = (await post(world, '/api/starter/mining/launch', me.headers, { asteroidId: opaque(site.id), craft: 1 })).json<{ runId: string }>();
    expect((await post(world, `/api/starter/mining/runs/${runId}/recall`, me.headers)).statusCode).toBe(200);
    await pass(world, 60);
    const [mission] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
    expect(mission!.status).toBe('DONE');
    expect((await ship(me.vesselId)).facts).not.toContain('FIRST_MINING_RETURN');
  });

  it('takes a dig at a rock someone else emptied for a dig, though it brings nothing home', async () => {
    const me = await ready();
    const site = await rock();
    await post(world, '/api/starter/mining/launch', me.headers, { asteroidId: opaque(site.id), craft: 1 });
    await world.f.db.update(starterSites).set({ alloy: 0, crystal: 0, deuterium: 0 }).where(eq(starterSites.id, site.id));
    await pass(world, 60);
    const [mission] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.ownerVesselId, me.vesselId));
    expect(mission!.cargo).toEqual({ alloy: 0, crystal: 0, deuterium: 0 });
    expect((await ship(me.vesselId)).facts).toContain('FIRST_MINING_RETURN');
  });

  it('refuses an empty rock before the flight', async () => {
    const me = await ready();
    const site = await rock();
    await world.f.db.update(starterSites).set({ alloy: 0, crystal: 0, deuterium: 0 }).where(eq(starterSites.id, site.id));
    const answer = await post(world, '/api/starter/mining/launch', me.headers, { asteroidId: opaque(site.id), craft: 1 });
    expect(answer.json<{ error: string }>().error).toBe('ASTEROID_EMPTY');
  });

  it('needs the craft it names', async () => {
    const me = await ready();
    const site = await rock();
    const answer = await post(world, '/api/starter/mining/launch', me.headers, { asteroidId: opaque(site.id), craft: 3 });
    expect(answer.statusCode).toBe(409);
    expect(answer.json<{ error: string }>().error).toBe('NOT_ENOUGH_SHIPS');
  });

  it('answers a launch the way the map expects, once the transport has added the planet', async () => {
    const me = await ready();
    const site = await rock();
    const body = (await post(world, '/api/starter/mining/launch', me.headers, { asteroidId: opaque(site.id), craft: 1 })).json<Record<string, unknown>>();
    const { vessel, ...rest } = body;
    expect(vessel).toBeDefined();
    expect(miningLaunchSchema.omit({ planet: true }).safeParse(rest).success).toBe(true);
  });

  describe('a wreck', () => {
    it('stays shut until the first haul has come home', async () => {
      const me = await ready();
      const wreck = await siteOf(world, 'WRECK');
      const answer = await post(world, '/api/starter/mining/harvest', me.headers, { fieldId: wreck.id, craft: 1 });
      expect(answer.statusCode).toBe(403);
    });

    it('gives its stock once, and fills again after its wait', async () => {
      const me = await ready(MINER, ['FIRST_MINING_RETURN']);
      const wreck = await siteOf(world, 'WRECK');
      await world.f.db.update(starterSites).set({ alloy: 40, crystal: 0, deuterium: 0 }).where(eq(starterSites.id, wreck.id));
      expect((await post(world, '/api/starter/mining/harvest', me.headers, { fieldId: wreck.id, craft: 1 })).statusCode).toBe(200);
      await pass(world, 30);
      const [gone] = await world.f.db.select().from(starterSites).where(eq(starterSites.id, wreck.id));
      expect(gone!.alloy + gone!.crystal + gone!.deuterium).toBe(0);
      expect(gone!.respawnAt).not.toBeNull();
      world.f.clock.advance(STARTER.sites.wrecks.respawnMinutes + 1);
      await sweepStarterWorld(world.f.db, world.f.clock);
      const [back] = await world.f.db.select().from(starterSites).where(eq(starterSites.id, wreck.id));
      expect(back!.alloy + back!.crystal + back!.deuterium).toBe(back!.stockFull);
    });
  });
});
