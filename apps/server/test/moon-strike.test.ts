import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DEATH_STAR, MOON, radarRange } from '@astera/rules';
import { moons, planets, seasons, strategicAssets, strategicImpacts, units } from '../src/db/schema.js';
import { secedeColony } from '../src/services/loyalty.js';
import { moonsSeenBy, probeMoon } from '../src/services/moon.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { MOON_LOCATION } from '../src/services/unitLocation.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, grant, levelWorld, placeAt, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/*
  F7a (S19, S36, S39, S54, E15; plan §6.14): a Death Star may be aimed at a moon. Each hit cracks it, shuts its
  gate and Gözcü for three hours, and the cracks heal 24 hours after the last hit. A hit on the moon leaves
  the planet alone — no EMP, no loyalty — and a hit on the planet leaves the moon alone. A neutral world's
  seeded moon is a target too.
*/
const silent = pino({ level: 'silent' });

describe('a Death Star on a moon', () => {
  let f: Fixture;
  let attacker: string;
  let capital: string;
  let colony: string;

  const strike = async (target: string, body: 'PLANET' | 'MOON' = 'MOON') => {
    await f.db.insert(strategicAssets).values({ planetId: attacker, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0 });
    const launch = await launchDeathStar(f.db, attacker, target, f.clock, f.playerIds[0], false, new Set(), body);
    f.clock.set(launch.arriveAt);
    await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();
    const [impact] = await f.db.select().from(strategicImpacts).where(eq(strategicImpacts.missionId, launch.missionId));
    return impact;
  };
  const moonOf = async (planetId: string) => (await f.db.select().from(moons).where(eq(moons.planetId, planetId)))[0];
  const worldOf = async (planetId: string) => (await f.db.select().from(planets).where(eq(planets.id, planetId)))[0]!;

  beforeEach(async () => {
    f = await seedWorld(3, 20_190);
    [attacker, capital, colony] = f.planetIds as [string, string, string];
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[1]!, statsOwnerPlayerId: f.playerIds[1]!, kind: 'COLONY' })
      .where(eq(planets.id, colony));
    await placeAt(f.db, attacker, { x: 0 });
    await placeAt(f.db, colony, { x: radarRange(5) * 4 });
    await setLevel(f.db, colony, 'CORE', 8);
    await setLevel(f.db, attacker, 'CORE', DEATH_STAR.requiredCore);
    await setLevel(f.db, attacker, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await grant(f.db, attacker, 400_000, 200_000);
    await levelWorld(f.db, [attacker, capital]);
    await f.db.insert(moons).values({ planetId: colony, rarity: 'RARE', origin: 'BUILT', visualSeed: 4, bornAt: f.clock.now() });
    f.clock.advance(250);
  });
  afterAll(async () => { const { close } = await testDb(); await close(); });

  it('cracks the moon and shuts its gate for three hours, and leaves the planet alone (S19, S36)', async () => {
    await giveUnits(f.db, colony, { DART: 10 });
    const before = await worldOf(colony);
    const impact = await strike(colony);
    expect(impact?.outcome).toBe('MOON_CRACKED');
    const moon = await moonOf(colony);
    expect(moon).toMatchObject({ cracks: 1 });
    expect(moon!.lastHitAt?.getTime()).toBe(f.clock.now().getTime());
    expect(moon!.closedUntil?.getTime()).toBe(f.clock.now().getTime() + MOON.strikeCloseHours * 3_600_000);
    const after = await worldOf(colony);
    expect({ empUntil: after.empUntil, loyalty: after.loyalty, shield: after.shield })
      .toEqual({ empUntil: before.empUntil, loyalty: before.loyalty, shield: before.shield });
    expect(impact!.destroyedFleet).toEqual({});
  });

  it('heals a day after the last hit: the next hit starts the count again, and the map reads it healed', async () => {
    await strike(colony);
    await strike(colony);
    expect((await moonOf(colony))?.cracks).toBe(2);
    f.clock.advance(MOON.crackHealHours * 60 + 1);
    const view = await moonsSeenBy(f.db, f.seasonId, new Set([colony]), () => false, () => undefined, () => 'NONE', f.clock.now());
    expect(view.list[0]?.cracks).toBe(0);
    expect((await probeMoon(f.db, colony, (count) => ({ low: count, high: count }), f.clock.now()))?.cracks).toBe(0);
    await strike(colony);
    expect((await moonOf(colony))?.cracks).toBe(1);
  });

  it('a hit on the planet leaves the moon whole (S39)', async () => {
    await strike(colony, 'PLANET');
    expect(await moonOf(colony)).toMatchObject({ cracks: 0, closedUntil: null, lastHitAt: null });
  });

  it('may crack a neutral world’s seeded moon (S54)', async () => {
    await f.db.transaction((tx) => secedeColony(tx, colony, f.clock.now(), randomUUID()));
    expect((await worldOf(colony)).kind).toBe('NEUTRAL');
    const impact = await strike(colony);
    expect(impact?.outcome).toBe('MOON_CRACKED');
    expect((await moonOf(colony))?.cracks).toBe(1);
  });

  it('refuses a world without a moon, and a galaxy without moons', async () => {
    await f.db.insert(strategicAssets).values({ planetId: attacker, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0 });
    await expect(launchDeathStar(f.db, attacker, capital, f.clock, f.playerIds[0], false, new Set(), 'MOON'))
      .rejects.toMatchObject({ code: 'NO_MOON' });
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion - 1 }).where(eq(seasons.id, f.seasonId));
    await expect(launchDeathStar(f.db, attacker, colony, f.clock, f.playerIds[0], false, new Set(), 'MOON'))
      .rejects.toMatchObject({ code: 'MOONS_DISABLED' });
  });

  it('leaves the moon’s ships standing while it only cracks', async () => {
    await f.db.insert(units).values({ planetId: colony, ownerPlayerId: f.playerIds[1]!, hull: 'PIKE', location: MOON_LOCATION, count: 4 });
    await strike(colony);
    const [pike] = await f.db.select().from(units).where(and(eq(units.planetId, colony), eq(units.location, MOON_LOCATION)));
    expect(pike?.count).toBe(4);
  });
});
