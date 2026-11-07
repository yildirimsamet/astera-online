import { STARTER } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seasons, vesselNotifications, vessels } from '../src/db/schema.js';
import { sweepDepartures } from '../src/services/starter/migration.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, get, post, type StarterWorld } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

const DAY = 86_400_000;
const THRUST = { DRIVE_HULL: 1, DRIVE_THRUST: 1, DEUTERIUM_PLANT: 2 };

describe('the jump and the calendar', () => {
  let world: StarterWorld;
  const ready = async () => {
    const person = await aboard(world, 'Pilot', THRUST);
    await world.f.db.update(vessels).set({ fuel: STARTER.fuelForJump }).where(eq(vessels.id, person.vesselId));
    return person;
  };
  const ending = (days: number) => world.f.db.update(seasons)
    .set({ endsAt: new Date(world.f.clock.now().getTime() + days * DAY) }).where(eq(seasons.id, world.f.seasonId));

  beforeEach(async () => { world = await starterWorld(); });
  afterEach(async () => { await world.built.close(); });

  it('waits out the last five days and says how many are left', async () => {
    const person = await ready();
    await ending(3);
    const view = await get<{ block: unknown }>(world, '/api/starter/migration', person.headers);
    expect(view.block).toEqual({ code: 'MIGRATION_SEASON_WAIT', daysLeft: 3 });
    const refused = await post(world, '/api/starter/migrate', person.headers);
    expect(refused.statusCode).toBe(409);
    expect(refused.json<{ error: string; params: { daysLeft: number } }>().error).toBe('MIGRATION_SEASON_WAIT');
  });

  it('plays on while it waits: the ship is not touched', async () => {
    const person = await ready();
    await ending(3);
    await post(world, '/api/starter/migrate', person.headers);
    expect((await world.f.db.select().from(vessels).where(eq(vessels.id, person.vesselId)))[0]!.status).toBe('ACTIVE');
  });

  it('leaves with exactly five days to go', async () => {
    const person = await ready();
    await ending(STARTER.migrationCutoffDays);
    expect((await post(world, '/api/starter/migrate', person.headers)).statusCode).toBe(200);
  });

  describe('a new season opens', () => {
    const opens = () => world.f.db.update(seasons).set({
      startsAt: new Date(world.f.clock.now().getTime() - 3_600_000),
      endsAt: new Date(world.f.clock.now().getTime() + 30 * DAY),
    }).where(eq(seasons.id, world.f.seasonId));
    const told = (id: string) => world.f.db.select().from(vesselNotifications).where(eq(vesselNotifications.vesselId, id));

    it('tells a waiting ship once, by name', async () => {
      const person = await ready();
      await opens();
      await sweepDepartures(world.f.db, world.f.clock);
      await sweepDepartures(world.f.db, world.f.clock);
      const rows = (await told(person.vesselId)).filter(row => row.kind === 'SEASON_OPEN');
      expect(rows).toHaveLength(1);
      expect(typeof rows[0]!.payload.shardName).toBe('string');
    });

    it('tells nobody whose tank is not full', async () => {
      const person = await aboard(world, 'Pilot');
      await opens();
      await sweepDepartures(world.f.db, world.f.clock);
      expect((await told(person.vesselId)).filter(row => row.kind === 'SEASON_OPEN')).toHaveLength(0);
    });

    it('says nothing about a season long under way', async () => {
      const person = await ready();
      await world.f.db.update(seasons).set({
        startsAt: new Date(world.f.clock.now().getTime() - 3 * DAY),
        endsAt: new Date(world.f.clock.now().getTime() + 30 * DAY),
      }).where(eq(seasons.id, world.f.seasonId));
      await sweepDepartures(world.f.db, world.f.clock);
      expect((await told(person.vesselId)).filter(row => row.kind === 'SEASON_OPEN')).toHaveLength(0);
    });
  });
});
