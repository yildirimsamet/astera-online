import { STARTER } from '@astera/rules';
import { eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planets, players, starterDepartures, units, vesselMigrations, vessels } from '../src/db/schema.js';
import { runDeparture, sweepDepartures, type DepartureStep } from '../src/services/starter/migration.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, enrich, post, type StarterWorld } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

const THRUST = { DRIVE_HULL: 1, DRIVE_THRUST: 1, DEUTERIUM_PLANT: 2 };

describe('a jump cut short', () => {
  let world: StarterWorld;
  const ready = async () => {
    const person = await aboard(world, 'Pilot', THRUST);
    await world.f.db.update(vessels).set({ fuel: STARTER.fuelForJump }).where(eq(vessels.id, person.vesselId));
    await arm(world, person.vesselId, { DART: 2 });
    await enrich(world, person.vesselId, 1000, 500, 20);
    return person;
  };
  const statusOf = async (id: string) => (await world.f.db.select().from(vessels).where(eq(vessels.id, id)))[0]!.status;
  const settled = async (accountId: string) => {
    const [player] = await world.f.db.select().from(players).where(eq(players.accountId, accountId));
    const worlds = await world.f.db.select().from(planets).where(eq(planets.controllerPlayerId, player!.id));
    expect(worlds).toHaveLength(1);
    const fleet = await world.f.db.select().from(units).where(eq(units.planetId, worlds[0]!.id));
    return { planet: worlds[0]!, darts: fleet.find(row => row.hull === 'DART')?.count ?? 0 };
  };

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  const cutAt = (accountId: string, step: DepartureStep) =>
    expect(runDeparture(world.f.db, accountId, world.f.clock, {
      afterStep: (reached) => { if (reached === step) throw new Error('power cut'); },
    })).rejects.toThrow('power cut');

  for (const step of ['committed', 'seated', 'joined', 'landed'] as const) {
    it(`finishes from "${step}" on the sweep, with one world and one hold`, async () => {
      const person = await ready();
      await cutAt(person.id, step);
      expect(await statusOf(person.vesselId)).toBe('DEPARTING');

      // Too soon: the first request might still be running.
      await sweepDepartures(world.f.db, world.f.clock);
      expect(await statusOf(person.vesselId)).toBe('DEPARTING');

      world.f.clock.advance(3);
      await sweepDepartures(world.f.db, world.f.clock);
      expect(await statusOf(person.vesselId)).toBe('DEPARTED');
      const { planet, darts } = await settled(person.id);
      expect(planet.alloy).toBeGreaterThan(1000);
      expect(darts).toBeGreaterThanOrEqual(2);
      expect(await world.f.db.select().from(starterDepartures)).toHaveLength(1);

      const before = planet.alloy;
      await sweepDepartures(world.f.db, world.f.clock);
      expect((await settled(person.id)).planet.alloy).toBe(before);
    });
  }

  it('lets the player finish it by pressing again, without waiting for the sweep', async () => {
    const person = await ready();
    await cutAt(person.id, 'joined');
    const again = await post(world, '/api/starter/migrate', person.headers);
    expect(again.statusCode).toBe(200);
    expect(await statusOf(person.vesselId)).toBe('DEPARTED');
    expect((await settled(person.id)).darts).toBeGreaterThanOrEqual(2);
  });

  it('hands the ship back when a forced wipe takes the new world between the join and the hold', async () => {
    const person = await ready();
    await cutAt(person.id, 'joined');
    const [row] = await world.f.db.select().from(vesselMigrations);
    expect(row!.planetId).not.toBeNull();
    const [player] = await world.f.db.select().from(players).where(eq(players.accountId, person.id));
    await world.f.db.execute(sql`truncate players, planets cascade`);
    expect(player).toBeDefined();

    world.f.clock.advance(3);
    await sweepDepartures(world.f.db, world.f.clock);
    const [ship] = await world.f.db.select().from(vessels).where(eq(vessels.id, person.vesselId));
    expect(ship!.status).toBe('ACTIVE');
    expect(ship!.fuel).toBe(STARTER.fuelForJump);
    expect(ship!.alloy).toBeCloseTo(1000, 0);
  });

  it('exposes the same saga to its caller: running a finished one is harmless', async () => {
    const person = await ready();
    await post(world, '/api/starter/migrate', person.headers);
    await expect(runDeparture(world.f.db, person.id, world.f.clock)).rejects.toMatchObject({ code: 'PLACEMENT_CHANGED' });
  });
});
