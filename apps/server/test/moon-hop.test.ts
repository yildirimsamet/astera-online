import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON, gateCapacity, hangarLoad } from '@astera/rules';
import { missions, moonMoves, moons, planets, scheduledEvents, seasons, units } from '../src/db/schema.js';
import { hopFleet } from '../src/services/moonMovement.js';
import { totalUnitsOf } from '../src/services/planet.js';
import { MOON_LOCATION, PLANET_LOCATION } from '../src/services/unitLocation.js';
import { HANDLERS } from '../src/worker/handlers.js';
import { pino } from 'pino';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { giveUnits, seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

/*
  F3a (plan §6.5, §6.6, S13, S37, V3, E2, E3): a fleet hops between a world's planet and its moon in 90
  seconds. While it hops it stands on neither body; it never leaves the world, so the Hangar does not move.
*/
describe('the planet ↔ moon hop', () => {
  let f: Fixture;
  let world: string;
  let owner: string;

  beforeEach(async () => {
    f = await seedWorld(2, 20_030);
    world = f.planetIds[0]!;
    owner = f.playerIds[0]!;
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await f.db.insert(moons).values({ planetId: world, rarity: 'COMMON', origin: 'BUILT', visualSeed: 1, bornAt: f.clock.now() });
    await giveUnits(f.db, world, { DART: 10, PIKE: 4, PROSPECTOR: 2, THORN: 3 });
  });
  afterAll(async () => { const { close } = await testDb(); await close(); });

  const standing = async (location: string) => Object.fromEntries((await f.db.select().from(units)
    .where(and(eq(units.planetId, world), eq(units.location, location)))).filter((row) => row.count > 0)
    .map((row) => [row.hull, row.count]));

  const land = async () => {
    const [event] = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.kind, 'moon_move_land'), eq(scheduledEvents.status, 'pending')));
    if (!event) throw new Error('no pending hop landing');
    f.clock.set(event.resolveAt);
    await HANDLERS.moon_move_land!({ db: f.db, clock: f.clock }, event);
    // The worker marks a handled event done; so does this stand-in for it.
    await f.db.update(scheduledEvents).set({ status: 'done' }).where(eq(scheduledEvents.id, event.id));
    return event;
  };

  it('takes 90 seconds, stands on neither body meanwhile, and keeps the Hangar where it was', async () => {
    const before = await totalUnitsOf(f.db, world);
    const move = await hopFleet(f.db, owner, world, 'UP', { DART: 6, PIKE: 4 }, f.clock);
    expect(move.arriveAt.getTime() - f.clock.now().getTime()).toBe(MOON.hopSeconds * 1000);
    expect(await standing(PLANET_LOCATION)).toEqual({ DART: 4, PROSPECTOR: 2, THORN: 3 });
    expect(await standing(MOON_LOCATION)).toEqual({});
    expect(await totalUnitsOf(f.db, world)).toEqual(before);

    await land();
    expect(await standing(MOON_LOCATION)).toEqual({ DART: 6, PIKE: 4 });
    expect(await f.db.select({ status: moonMoves.status }).from(moonMoves)).toEqual([{ status: 'LANDED' }]);
    expect(await totalUnitsOf(f.db, world)).toEqual(before);

    await hopFleet(f.db, owner, world, 'DOWN', { DART: 6 }, f.clock);
    await land();
    expect(await standing(MOON_LOCATION)).toEqual({ PIKE: 4 });
    expect(await standing(PLANET_LOCATION)).toEqual({ DART: 10, PROSPECTOR: 2, THORN: 3 });
  });

  it('carries the wounds with the hulls', async () => {
    await f.db.update(units).set({ damage: [{ hull: 'DART', count: 2, damageBp: 4_000, remainderBp: 0 }] })
      .where(and(eq(units.planetId, world), eq(units.hull, 'DART'), eq(units.location, PLANET_LOCATION)));
    await hopFleet(f.db, owner, world, 'UP', { DART: 10 }, f.clock);
    await land();
    const [dart] = await f.db.select().from(units)
      .where(and(eq(units.planetId, world), eq(units.hull, 'DART'), eq(units.location, MOON_LOCATION)));
    expect(dart?.damage).toEqual([{ hull: 'DART', count: 2, damageBp: 4_000, remainderBp: 0 }]);
  });

  it('refuses what cannot hop', async () => {
    const hop = (fleet: Record<string, number>, direction: 'UP' | 'DOWN' = 'UP', player = owner, planet = world) =>
      hopFleet(f.db, player, planet, direction, fleet, f.clock);
    await expect(hop({ PROSPECTOR: 1 })).rejects.toMatchObject({ code: 'HULL_CANNOT_HOP' });
    await expect(hop({ THORN: 1 })).rejects.toMatchObject({ code: 'HULL_CANNOT_HOP' });
    await expect(hop({ DART: 11 })).rejects.toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });
    await expect(hop({ DART: 1 }, 'DOWN')).rejects.toMatchObject({ code: 'NOT_ENOUGH_SHIPS' });
    await expect(hop({})).rejects.toMatchObject({ code: 'EMPTY_FLEET' });
    await expect(hop({ DART: 1 }, 'UP', f.playerIds[1])).rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
    await expect(hop({ DART: 1 }, 'UP', f.playerIds[1], f.planetIds[1])).rejects.toMatchObject({ code: 'NO_MOON' });
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion - 1 }).where(eq(seasons.id, f.seasonId));
    await expect(hop({ DART: 1 })).rejects.toMatchObject({ code: 'MOONS_DISABLED' });
    expect(await f.db.select().from(moonMoves)).toEqual([]);
  });

  it('allows one hop each way at a time (V3)', async () => {
    await hopFleet(f.db, owner, world, 'UP', { DART: 1 }, f.clock);
    await expect(hopFleet(f.db, owner, world, 'UP', { DART: 1 }, f.clock)).rejects.toMatchObject({ code: 'HOP_PENDING' });
  });

  it('enters a moon only while its dock has room for the fleet and every hop already on its way', async () => {
    const room = gateCapacity('COMMON');
    const perDart = hangarLoad({ DART: 1 });
    const fits = Math.floor(room / perDart);
    await giveUnits(f.db, world, { DART: fits + 10 });
    await expect(hopFleet(f.db, owner, world, 'UP', { DART: fits + 1 }, f.clock)).rejects.toMatchObject({ code: 'DOCK_FULL' });
    await hopFleet(f.db, owner, world, 'UP', { DART: fits - 1 }, f.clock);
    await land();
    await expect(hopFleet(f.db, owner, world, 'UP', { DART: 2 }, f.clock)).rejects.toMatchObject({ code: 'DOCK_FULL' });
    await hopFleet(f.db, owner, world, 'UP', { DART: 1 }, f.clock);
  });

  it('holds the planet fleet once an attack has reached the planet, never the moon’s (K12, E3)', async () => {
    await hopFleet(f.db, owner, world, 'UP', { PIKE: 4 }, f.clock);
    await land();
    await f.db.insert(missions).values({ fuelPaid: 0, seasonId: f.seasonId, kind: 'attack', ownerPlayerId: f.playerIds[1]!,
      originPlanetId: f.planetIds[1]!, targetPlanetId: world, fleet: { DART: 1 }, distance: 10,
      departAt: new Date(f.clock.now().getTime() - 60_000), arriveAt: f.clock.now() });
    await expect(hopFleet(f.db, owner, world, 'UP', { DART: 1 }, f.clock)).rejects.toMatchObject({ code: 'ARRIVAL_PENDING' });
    await hopFleet(f.db, owner, world, 'DOWN', { PIKE: 4 }, f.clock);
  });

  it('lands on the planet only after an attack already due there is fought (E2)', async () => {
    await hopFleet(f.db, owner, world, 'UP', { PIKE: 4 }, f.clock);
    await land();
    const move = await hopFleet(f.db, owner, world, 'DOWN', { PIKE: 4 }, f.clock);
    await f.db.insert(missions).values({ fuelPaid: 0, seasonId: f.seasonId, kind: 'attack', ownerPlayerId: f.playerIds[1]!,
      originPlanetId: f.planetIds[1]!, targetPlanetId: world, fleet: { DART: 1 }, distance: 10,
      departAt: f.clock.now(), arriveAt: move.arriveAt });
    const event = await land();
    expect(await standing(PLANET_LOCATION)).not.toHaveProperty('PIKE');
    const [again] = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.kind, 'moon_move_land'), eq(scheduledEvents.status, 'pending')));
    expect(again?.resolveAt.getTime()).toBe(event.resolveAt.getTime() + 1_000);
  });

  it('lands on the planet when the moon is gone before the hop arrives', async () => {
    await hopFleet(f.db, owner, world, 'UP', { DART: 3 }, f.clock);
    await f.db.delete(moons).where(eq(moons.planetId, world));
    await land();
    expect(await standing(PLANET_LOCATION)).toMatchObject({ DART: 10 });
    expect(await standing(MOON_LOCATION)).toEqual({});
    const [row] = await f.db.select({ status: moonMoves.status }).from(moonMoves);
    expect(row?.status).toBe('RETURNED');
    expect(await f.db.select().from(planets).where(eq(planets.id, world))).toHaveLength(1);
  });

  it('answers on the API, and refuses a malformed order before it reaches the world', async () => {
    const built = buildApp({ env: testEnv(), logger: pino({ level: 'silent' }), db: f.db, clock: f.clock });
    await built.app.ready();
    try {
      const authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`;
      const post = (body: Record<string, unknown>, planetId = world) => built.app.inject({
        method: 'POST', url: `/api/planets/${planetId}/moon/hop`, headers: { authorization }, payload: body });
      const ok = await post({ direction: 'UP', fleet: { DART: 2 } });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toMatchObject({ kind: 'HOP_UP', fleet: { DART: 2 } });
      expect((await post({ direction: 'SIDEWAYS', fleet: { DART: 1 } })).statusCode).toBe(400);
      expect((await post({ direction: 'DOWN', fleet: { DART: -1 } })).statusCode).toBe(400);
      expect((await post({ direction: 'DOWN', fleet: { DART: 1 }, extra: true })).statusCode).toBe(400);
      expect((await post({ direction: 'DOWN', fleet: { DART: 1 } }, f.planetIds[1])).statusCode).not.toBe(200);
    } finally {
      await built.close();
    }
  });
});
