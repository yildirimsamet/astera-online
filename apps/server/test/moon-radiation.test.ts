import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import { hpRadiationSources, moons, planets, players, radiationBombFlights, seasons, strategicAssets, units } from '../src/db/schema.js';
import { readHomeHealth } from '../src/services/homeHealth.js';
import { loadLocked } from '../src/services/planet.js';
import { buildRadiationBomb, launchRadiationBomb, resolveRadiationBomb } from '../src/services/radiationBomb.js';
import { hopFleet, landOnMoon } from '../src/services/moonMovement.js';
import { MOON_LOCATION } from '../src/services/unitLocation.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, grant, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/*
  F7c (S45, plan §6.15): the planet and its moon are separate targets for a Radiation Bomb. A bomb on the moon
  wears only the ships standing on the moon, and a bomb on the planet only the planet's and its dock's; the
  planet's radiation never crosses to the moon. The moon has no Aegis to soften it.
*/
const silent = pino({ level: 'silent' });

describe('radiation by body', () => {
  let f: Fixture;
  let home: string;

  beforeEach(async () => {
    f = await seedWorld(2, 20_192);
    home = f.planetIds[1]!;
    await f.db.update(seasons).set({ radiationBombStartsAt: f.clock.now(), rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await f.db.update(players).set({ newcomerShieldUntil: null, recoveryShieldUntil: null });
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 13);
      await setLevel(f.db, id, 'SHIPYARD', 5);
      await grant(f.db, id, 500_000, 500_000);
      await f.db.update(planets).set({ deuterium: 500_000 }).where(eq(planets.id, id));
    }
    await placeAt(f.db, f.planetIds[0]!, { x: 1000 });
    await placeAt(f.db, home, { x: 0 });
    await f.db.insert(moons).values({ planetId: home, rarity: 'RARE', origin: 'BUILT', visualSeed: 5, bornAt: f.clock.now() });
    await giveUnits(f.db, home, { CITADEL: 2 });
    await f.db.insert(units).values({ planetId: home, ownerPlayerId: f.playerIds[1]!, hull: 'CITADEL', location: MOON_LOCATION, count: 2 });
  });
  afterAll(async () => { await (await testDb()).close(); });

  const hit = async (body?: 'PLANET' | 'MOON') => {
    const built = await buildRadiationBomb(f.db, f.planetIds[0]!, 1, f.clock, f.playerIds[0]);
    await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
    const sent = await launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
      target: { kind: 'PLANET', id: home, ...(body ? { body } : {}) }, level: 1, key: randomUUID(), clock: f.clock });
    f.clock.set(new Date(sent.arriveAt));
    await resolveRadiationBomb(f.db, sent.flightId, f.clock);
    return sent;
  };
  const settle = async () => {
    f.clock.advance(5);
    await f.db.transaction((tx) => loadLocked(tx, home, f.clock));
  };

  it('a bomb on the moon wears only the moon’s ships', async () => {
    const sent = await hit('MOON');
    const [flight] = await f.db.select().from(radiationBombFlights).where(eq(radiationBombFlights.id, sent.flightId));
    expect(flight).toMatchObject({ targetBody: 'MOON', status: 'HIT' });
    const [source] = await f.db.select().from(hpRadiationSources).where(eq(hpRadiationSources.bombFlightId, sent.flightId));
    expect(source?.body).toBe('MOON');
    await settle();
    expect((await readHomeHealth(f.db, home, 'MOON')).damage.length).toBeGreaterThan(0);
    expect((await readHomeHealth(f.db, home)).damage).toEqual([]);
  });

  it('a bomb on the planet never crosses to the moon (S45)', async () => {
    await hit();
    await settle();
    expect((await readHomeHealth(f.db, home)).damage.length).toBeGreaterThan(0);
    expect((await readHomeHealth(f.db, home, 'MOON')).damage).toEqual([]);
  });

  it('kills the moon’s ships on its own clock, with nobody looking', async () => {
    await f.db.insert(units).values({ planetId: home, ownerPlayerId: f.playerIds[1]!, hull: 'DART', location: MOON_LOCATION, count: 3 });
    const sent = await hit('MOON');
    f.clock.set(new Date(new Date(sent.arriveAt).getTime() + 31 * 60_000));
    await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();
    const [dart] = await f.db.select().from(units).where(and(eq(units.planetId, home), eq(units.location, MOON_LOCATION), eq(units.hull, 'DART')));
    expect(dart?.count ?? 0).toBe(0);
  });

  it('ships coming up to an irradiated moon pay only from the moment they land', async () => {
    const sent = await hit('MOON');
    f.clock.set(new Date(new Date(sent.arriveAt).getTime() + 10 * 60_000));
    const hop = await hopFleet(f.db, f.playerIds[1]!, home, 'UP', { CITADEL: 1 }, f.clock);
    f.clock.set(hop.arriveAt);
    await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();
    const [world] = await f.db.select({ settled: planets.radiationSettledAt }).from(planets).where(eq(planets.id, home));
    expect(world?.settled?.getTime()).toBe(hop.arriveAt.getTime());
    expect((await readHomeHealth(f.db, home, 'MOON')).fleet).toEqual({ CITADEL: 3 });
  });

  it('a transfer or a return landing on an irradiated moon closes the dose before it lands', async () => {
    const sent = await hit('MOON');
    f.clock.set(new Date(new Date(sent.arriveAt).getTime() + 10 * 60_000));
    const landed = await f.db.transaction((tx) => landOnMoon(tx, { planetId: home, ownerPlayerId: f.playerIds[1]!,
      fleet: { CITADEL: 1 }, damage: null, at: f.clock.now() }));
    expect(landed).toBe(true);
    const [world] = await f.db.select({ settled: planets.radiationSettledAt }).from(planets).where(eq(planets.id, home));
    expect(world?.settled?.getTime()).toBe(f.clock.now().getTime());
  });

  it('refuses a moon that is not there', async () => {
    await f.db.delete(moons).where(eq(moons.planetId, home));
    const built = await buildRadiationBomb(f.db, f.planetIds[0]!, 1, f.clock, f.playerIds[0]);
    await f.db.update(strategicAssets).set({ status: 'READY' }).where(eq(strategicAssets.id, built.assetId));
    await expect(launchRadiationBomb(f.db, { playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
      target: { kind: 'PLANET', id: home, body: 'MOON' }, level: 1, key: randomUUID(), clock: f.clock }))
      .rejects.toMatchObject({ code: 'NO_MOON' });
  });
});
