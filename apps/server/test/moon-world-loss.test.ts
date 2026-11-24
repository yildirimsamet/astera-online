import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import { moons, notifications, planets, scheduledEvents, seasons, units } from '../src/db/schema.js';
import { secedeColony } from '../src/services/loyalty.js';
import { hopFleet } from '../src/services/moonMovement.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { MOON_LOCATION, PLANET_LOCATION } from '../src/services/unitLocation.js';
import { HANDLERS } from '../src/worker/handlers.js';
import { giveUnits, seedWorld, testDb, type Fixture } from './helpers.js';

/*
  F3a (plan §6.16): when a world is lost, a fleet standing on its moon shares the planet fleet's fate,
  and a fleet caught mid-hop comes down at a world its owner still holds (V36).
*/
describe('a moon’s fleet when its world is lost', () => {
  let f: Fixture;
  let owner: string;
  let capital: string;
  let colony: string;

  beforeEach(async () => {
    f = await seedWorld(2, 20_040);
    owner = f.playerIds[0]!;
    capital = f.planetIds[0]!;
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    const [row] = await f.db.insert(planets).values({ controllerPlayerId: owner, seasonId: f.seasonId, kind: 'COLONY',
      name: 'Moonward', slotIndex: 700, x: 1500, y: 0, z: 0, lastTickAt: f.clock.now() }).returning();
    colony = row!.id;
    await f.db.insert(moons).values({ planetId: colony, rarity: 'EPIC', origin: 'SEED', visualSeed: 3, bornAt: f.clock.now() });
    await giveUnits(f.db, colony, { DART: 5 });
    await f.db.insert(units).values({ planetId: colony, ownerPlayerId: owner, hull: 'PIKE', location: MOON_LOCATION, count: 7 });
  });
  afterAll(async () => { const { close } = await testDb(); await close(); });

  const at = async (planetId: string, location: string) => Object.fromEntries((await f.db.select().from(units)
    .where(and(eq(units.planetId, planetId), eq(units.location, location)))).filter((row) => row.count > 0)
    .map((row) => [row.hull, row.count]));

  it('loses the moon’s fleet with the planet’s when the colony secedes (S19c, S42)', async () => {
    const capitalBefore = await at(capital, PLANET_LOCATION);
    await f.db.transaction((tx) => secedeColony(tx, colony, f.clock.now(), randomUUID()));
    expect(await at(colony, MOON_LOCATION)).toEqual({});
    expect(await at(capital, PLANET_LOCATION)).toEqual(capitalBefore);
    const [notice] = await f.db.select().from(notifications).where(eq(notifications.kind, 'colony_lost'));
    expect(notice?.payload).toMatchObject({ lostShips: 12 });
  });

  it('brings the moon’s fleet home to the capital when the colony is abandoned', async () => {
    const capitalBefore = await at(capital, PLANET_LOCATION);
    await f.db.transaction((tx) => secedeColony(tx, colony, f.clock.now(), randomUUID(), 'ABANDONED'));
    expect(await at(colony, MOON_LOCATION)).toEqual({});
    expect(await at(capital, PLANET_LOCATION)).toEqual({
      ...capitalBefore, DART: (capitalBefore.DART ?? 0) + 5, PIKE: (capitalBefore.PIKE ?? 0) + 7 });
  });

  it('hands the moon’s fleet over with the world, as the planet’s is (capture)', async () => {
    await f.db.transaction((tx) => transferPlanetControl(tx, { targetPlanetId: colony, newPlayerId: f.playerIds[1]!,
      expectedControllerPlayerId: owner, protectedUntil: f.clock.now(), now: f.clock.now() }));
    const [pike] = await f.db.select().from(units)
      .where(and(eq(units.planetId, colony), eq(units.location, MOON_LOCATION)));
    expect(pike?.ownerPlayerId).toBe(f.playerIds[1]);
  });

  it('lands a fleet caught mid-hop at the owner’s capital, whole (V36)', async () => {
    await hopFleet(f.db, owner, colony, 'DOWN', { PIKE: 7 }, f.clock);
    const capitalBefore = await at(capital, PLANET_LOCATION);
    await f.db.transaction((tx) => secedeColony(tx, colony, f.clock.now(), randomUUID()));
    const [event] = await f.db.select().from(scheduledEvents).where(eq(scheduledEvents.kind, 'moon_move_land'));
    f.clock.set(event!.resolveAt);
    await HANDLERS.moon_move_land!({ db: f.db, clock: f.clock }, event!);
    expect(await at(capital, PLANET_LOCATION)).toEqual({ ...capitalBefore, PIKE: (capitalBefore.PIKE ?? 0) + 7 });
    expect((await f.db.select().from(units).where(eq(units.planetId, colony))).filter((row) => row.hull === 'PIKE' && row.count > 0)).toEqual([]);
  });
});
