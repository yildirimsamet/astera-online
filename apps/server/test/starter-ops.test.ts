import { STARTER } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planets, starterEvents, starterGalaxies, starterSites, vesselMigrations, vesselMissions, vesselUnits, vessels } from '../src/db/schema.js';
import { enlistVessel } from '../src/services/starter/enlist.js';
import { bootstrapStarterGalaxy, landAllShips, resetStarter } from '../src/services/starter/ops.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

describe('what an operator can do to the ship galaxies', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('bootstraps a galaxy and its places, and running it twice changes nothing', async () => {
    const first = await bootstrapStarterGalaxy(world.f.db, world.f.clock);
    const sites = await world.f.db.select().from(starterSites);
    expect(first.galaxies).toBe(1);
    expect(sites.length).toBeGreaterThan(0);
    const again = await bootstrapStarterGalaxy(world.f.db, world.f.clock);
    expect(again.galaxies).toBe(1);
    const fixed = (rows: typeof sites) => rows.filter(row => row.kind === 'OUTPOST' || row.kind === 'WRECK').length;
    expect(fixed(await world.f.db.select().from(starterSites))).toBe(fixed(sites));
  });

  describe('land-all', () => {
    it('counts and touches nothing unless told', async () => {
      const me = await aboard(world, 'Me');
      const plan = await landAllShips(world.f.db, world.f.clock, { apply: false });
      expect(plan.ships).toBe(1);
      expect(plan.landed).toBe(0);
      const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
      expect(row!.status).toBe('ACTIVE');
    });

    it('lands a ship that was nowhere near ready, with its in-flight orders gone, and nobody stranded', async () => {
      const me = await aboard(world, 'Me', { SHIPYARD: 1 });
      await arm(world, me.vesselId, { DART: 2 });
      const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
      const [flight] = await world.f.db.insert(vesselMissions).values({
        starterGalaxyId: ship!.starterGalaxyId, ownerVesselId: me.vesselId, kind: 'MINE', fromX: 0, fromY: 0, fromZ: 0, toX: 1, toY: 1, toZ: 1, fleet: { PROSPECTOR: 1 }, damage: [],
        departAt: world.f.clock.now(), arriveAt: new Date(world.f.clock.now().getTime() + 600_000), status: 'OUTBOUND',
      }).returning();
      await world.f.db.insert(starterEvents).values({ starterGalaxyId: ship!.starterGalaxyId, kind: 'vessel_mission_arrival', refId: flight!.id, resolveAt: flight!.arriveAt });

      const result = await landAllShips(world.f.db, world.f.clock, { apply: true });
      expect(result.landed).toBe(1);
      expect(result.failed).toEqual([]);
      const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
      expect(row!.status).toBe('DEPARTED');
      const [migration] = await world.f.db.select().from(vesselMigrations).where(eq(vesselMigrations.vesselId, me.vesselId));
      expect(migration!.status).toBe('DONE');
      const [mission] = await world.f.db.select().from(vesselMissions).where(eq(vesselMissions.id, flight!.id));
      expect(mission!.status).toBe('DONE');
      const [event] = await world.f.db.select().from(starterEvents).where(eq(starterEvents.refId, flight!.id));
      expect(event!.status).toBe('done');
      const owned = await world.f.db.select().from(planets).where(eq(planets.id, migration!.planetId!));
      expect(owned).toHaveLength(1);

      const second = await landAllShips(world.f.db, world.f.clock, { apply: true });
      expect(second.ships).toBe(0);
    });

    it('never lands a ship for a player through the ordinary door: readiness still holds there', async () => {
      const me = await aboard(world, 'Me');
      const answer = await world.app.inject({ method: 'POST', url: '/api/starter/migrate', headers: me.headers, payload: { slot: null, force: true } });
      expect(answer.statusCode).toBeGreaterThanOrEqual(400);
      const [row] = await world.f.db.select().from(vessels).where(eq(vessels.id, me.vesselId));
      expect(row!.fuel).toBeLessThan(STARTER.fuelForJump);
      expect(row!.status).toBe('ACTIVE');
    });
  });

  describe('reset', () => {
    it('counts and touches nothing unless told', async () => {
      await aboard(world, 'Me');
      const plan = await resetStarter(world.f.db, { apply: false });
      expect(plan.ships).toBe(1);
      expect(await world.f.db.select().from(vessels)).toHaveLength(1);
    });

    it('clears the ship side only, and the same account can take a ship again', async () => {
      const me = await aboard(world, 'Me');
      await arm(world, me.vesselId, { DART: 2 });
      const main = await world.f.db.select().from(planets);
      const result = await resetStarter(world.f.db, { apply: true });
      expect(result.ships).toBe(1);
      expect(await world.f.db.select().from(vessels)).toHaveLength(0);
      expect(await world.f.db.select().from(vesselUnits)).toHaveLength(0);
      expect(await world.f.db.select().from(starterGalaxies)).toHaveLength(0);
      expect(await world.f.db.select().from(planets)).toEqual(main);
      await enlistVessel(world.f.db, me.id, world.f.clock);
      expect(await world.f.db.select().from(vessels)).toHaveLength(1);
    });
  });
});
