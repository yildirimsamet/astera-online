import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DEATH_STAR, DEBRIS, MOON, crackLimit, radarRange } from '@astera/rules';
import { debrisFields, galaxyEvents, missions, moonMoves, moons, planets, seasons, strategicAssets, strategicImpacts, units } from '../src/db/schema.js';
import { flyingValue } from '../src/services/battleSettlement.js';
import { launchAttack } from '../src/services/mission.js';
import { hopFleet } from '../src/services/moonMovement.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { MOON_LOCATION, PLANET_LOCATION } from '../src/services/unitLocation.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, grant, levelWorld, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/*
  F7b (S35, plan §6.14 steps 1–10): the last crack breaks the moon. Every ship standing on it dies and leaves a
  public wreck beside the world; every flight bound for the moon turns home at that instant; a hop up comes
  down on the planet; the row is gone and the galaxy hears of it, with the moon's rarity (V18).
*/
const silent = pino({ level: 'silent' });

describe('a moon breaking apart', () => {
  let f: Fixture;
  let attacker: string;
  let capital: string;
  let colony: string;
  const run = () => new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();

  /** A Death Star in the air for the last crack; returns its arrival without flying it in. */
  const aim = async () => {
    await f.db.insert(strategicAssets).values({ planetId: attacker, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0 });
    return launchDeathStar(f.db, attacker, colony, f.clock, f.playerIds[0], false, new Set(), 'MOON');
  };

  beforeEach(async () => {
    f = await seedWorld(3, 20_191);
    [attacker, capital, colony] = f.planetIds as [string, string, string];
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[1]!, statsOwnerPlayerId: f.playerIds[1]!, kind: 'COLONY' })
      .where(eq(planets.id, colony));
    await placeAt(f.db, attacker, { x: 0 });
    await placeAt(f.db, colony, { x: radarRange(5) * 4 });
    await setLevel(f.db, colony, 'CORE', 8);
    await setLevel(f.db, colony, 'SHIPYARD', 4);
    await setLevel(f.db, attacker, 'CORE', DEATH_STAR.requiredCore);
    await setLevel(f.db, attacker, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await grant(f.db, attacker, 400_000, 200_000);
    await levelWorld(f.db, [attacker, capital]);
    f.clock.advance(250);
    // One crack short of breaking, hit an hour ago.
    await f.db.insert(moons).values({ planetId: colony, rarity: 'RARE', origin: 'BUILT', visualSeed: 4, bornAt: f.clock.now(),
      cracks: crackLimit('RARE') - 1, lastHitAt: new Date(f.clock.now().getTime() - 3_600_000) });
    await fuelUp(f.db, attacker);
    await fuelUp(f.db, colony);
  });
  afterAll(async () => { const { close } = await testDb(); await close(); });

  it('kills the ships on it, leaves a public wreck beside the world, and the galaxy hears with the rarity', async () => {
    await f.db.insert(units).values({ planetId: colony, ownerPlayerId: f.playerIds[1]!, hull: 'PIKE', location: MOON_LOCATION, count: 40 });
    await giveUnits(f.db, colony, { DART: 5 });
    const strike = await aim();
    f.clock.set(strike.arriveAt);
    await run();

    const [impact] = await f.db.select().from(strategicImpacts).where(eq(strategicImpacts.missionId, strike.missionId));
    expect(impact?.outcome).toBe('MOON_DESTROYED');
    expect(impact?.destroyedFleet).toEqual({ PIKE: 40 });
    expect(await f.db.select().from(moons).where(eq(moons.planetId, colony))).toEqual([]);
    expect(await f.db.select().from(units).where(and(eq(units.planetId, colony), eq(units.location, MOON_LOCATION)))).toEqual([]);
    // The planet's own fleet is not touched.
    const [dart] = await f.db.select().from(units).where(and(eq(units.planetId, colony), eq(units.location, PLANET_LOCATION), eq(units.hull, 'DART')));
    expect(dart?.count).toBe(5);

    const [field] = await f.db.select().from(debrisFields).where(eq(debrisFields.missionId, strike.missionId));
    expect(field).toMatchObject({ planetId: colony, body: 'MOON' });
    expect(field!.alloy + field!.crystal + field!.deuterium).toBeCloseTo(flyingValue({ PIKE: 40 }) * DEBRIS.share, 3);

    const [news] = await f.db.select().from(galaxyEvents).where(and(eq(galaxyEvents.kind, 'moon_destroyed'), eq(galaxyEvents.refId, strike.missionId)));
    expect(news?.subjectPlanetId).toBe(colony);
    expect(news?.payload).toMatchObject({ rarity: 'RARE' });
    expect(await f.db.select().from(galaxyEvents).where(eq(galaxyEvents.kind, 'death_star_impact'))).toEqual([]);
  });

  it('leaves no wreck when nothing stood on it', async () => {
    const strike = await aim();
    f.clock.set(strike.arriveAt);
    await run();
    expect(await f.db.select().from(debrisFields).where(eq(debrisFields.missionId, strike.missionId))).toEqual([]);
    expect(await f.db.select().from(moons).where(eq(moons.planetId, colony))).toEqual([]);
  });

  it('turns home every flight bound for the moon, and a hop up comes down on the planet', async () => {
    const strike = await aim();
    // Just before the weapon lands: a raid on the moon takes off, and the owner sends ships up.
    f.clock.set(new Date(strike.arriveAt.getTime() - 30_000));
    await giveUnits(f.db, attacker, { DART: 10 });
    const raid = await launchAttack(f.db, attacker, colony, { DART: 10 }, f.clock, undefined, false, undefined, false, new Set(), false, 'MOON');
    await giveUnits(f.db, colony, { DART: 6 });
    const hop = await hopFleet(f.db, f.playerIds[1]!, colony, 'UP', { DART: 6 }, f.clock);
    f.clock.set(strike.arriveAt);
    await run();

    const [turned] = await f.db.select().from(missions).where(eq(missions.id, raid.missionId));
    expect(turned?.recalledAt?.getTime()).toBe(strike.arriveAt.getTime());

    f.clock.set(hop.arriveAt);
    await run();
    const [landed] = await f.db.select().from(moonMoves).where(eq(moonMoves.id, hop.id));
    expect(landed?.status).toBe('RETURNED');
    const [dart] = await f.db.select().from(units).where(and(eq(units.planetId, colony), eq(units.location, PLANET_LOCATION), eq(units.hull, 'DART')));
    expect(dart?.count).toBe(6);
    // The raid comes home to the world it left.
    f.clock.set(turned!.arriveAt);
    await run();
    expect((await f.db.select({ status: missions.status }).from(missions).where(eq(missions.id, raid.missionId)))[0]?.status).toBe('resolved');
  });
});
