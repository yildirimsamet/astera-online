import { STARTER } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { planets, players, seasons, starterDepartures, units, vesselNotifications, vessels } from '../src/db/schema.js';
import { sweepDepartures } from '../src/services/starter/migration.js';
import { sweepQuietShips } from '../src/services/starter/quiet.js';
import { testDb } from './helpers.js';
import { starterWorld } from './starterFixture.js';
import { aboard, arm, enrich, get, openWindow, post, type StarterWorld } from './starterShips.js';

afterAll(async () => { await (await testDb()).close(); });

const HOUR = 60;
const DAY_MS = 86_400_000;

/**
 * COMING BACK LATE IS NOT LOSING THE JUMP (plan 2026-11-08 F7, moment 15: "geç dönmek, gün
 * numarasıyla ödül/öğrenim kaçırmak değildir"). A ready ship left a day, two or three still leaves
 * with one world and one hold; one that fell asleep wakes into the same jump.
 */
describe('a ready ship its owner left', () => {
  let world: StarterWorld;
  const ready = async () => {
    const person = await aboard(world, 'Pilot');
    await openWindow(world, person.vesselId);
    await world.f.db.update(vessels).set({ bufferAlloy: 0 }).where(eq(vessels.id, person.vesselId));
    await arm(world, person.vesselId, { DART: 2 });
    await enrich(world, person.vesselId, 1000, 500, 20);
    return person;
  };
  const shipOf = async (id: string) => (await world.f.db.select().from(vessels).where(eq(vessels.id, id)))[0]!;
  const landed = async (accountId: string) => {
    const [player] = await world.f.db.select().from(players).where(eq(players.accountId, accountId));
    const worlds = await world.f.db.select().from(planets).where(eq(planets.controllerPlayerId, player!.id));
    expect(worlds).toHaveLength(1);
    const fleet = await world.f.db.select().from(units).where(eq(units.planetId, worlds[0]!.id));
    expect(await world.f.db.select().from(starterDepartures)).toHaveLength(1);
    return { planet: worlds[0]!, darts: fleet.find(row => row.hull === 'DART')?.count ?? 0 };
  };

  beforeEach(async () => {
    world = await starterWorld();
    // A season with room for three days away and the five-day cutoff after them.
    await world.f.db.update(seasons).set({ endsAt: new Date(world.f.clock.now().getTime() + 30 * DAY_MS) }).where(eq(seasons.id, world.f.seasonId));
  });
  afterEach(async () => { await world.built.close(); });

  for (const hours of [24, 48, 72]) {
    it(`still leaves after ${String(hours)} hours, with one world and one hold`, async () => {
      const person = await ready();
      world.f.clock.advance(hours * HOUR);
      await sweepQuietShips(world.f.db, world.f.clock);
      // Asleep from the 48th hour on: the place is given up, the ship and its open window are not.
      expect((await shipOf(person.vesselId)).status).toBe(hours >= STARTER.idleMs / 3_600_000 ? 'DORMANT' : 'ACTIVE');

      const view = await get<{ block: unknown }>(world, '/api/starter/migration', person.headers);
      expect(view.block).toBeNull();
      expect((await post(world, '/api/starter/migrate', person.headers)).statusCode).toBe(200);
      const { planet, darts } = await landed(person.id);
      expect(planet.alloy).toBeGreaterThan(1000);
      expect(darts).toBeGreaterThanOrEqual(2);
      expect((await shipOf(person.vesselId)).status).toBe('DEPARTED');
    });
  }

  it('hears of a new season even after falling asleep while it waited for one', async () => {
    const person = await ready();
    world.f.clock.advance(48 * HOUR);
    await sweepQuietShips(world.f.db, world.f.clock);
    expect((await shipOf(person.vesselId)).status).toBe('DORMANT');
    await world.f.db.update(seasons).set({
      startsAt: new Date(world.f.clock.now().getTime() - 3_600_000),
      endsAt: new Date(world.f.clock.now().getTime() + 30 * DAY_MS),
    }).where(eq(seasons.id, world.f.seasonId));
    await sweepDepartures(world.f.db, world.f.clock);
    const told = await world.f.db.select().from(vesselNotifications).where(eq(vesselNotifications.vesselId, person.vesselId));
    expect(told.filter(row => row.kind === 'SEASON_OPEN')).toHaveLength(1);
  });
});
