import { randomUUID } from 'node:crypto';
import { pino } from 'pino';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
import { missions, planets, seasons, units } from '../src/db/schema.js';
import { secedeColony } from '../src/services/loyalty.js';
import { launchAttack } from '../src/services/mission.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/**
 * V22 (owner 2026-11-19): a colony lost to loyalty destroys only what STANDS on it. A fleet
 * already in the air keeps flying and lands where its commander still holds a world — the
 * existing `safeHomePlanet` rule, fixed here against a real secession.
 */
const silent = pino({ level: 'silent' });

describe('a fleet in the air when its launch colony secedes', () => {
  let f: Fixture;
  let capital: string;
  let colony: string;
  let target: string;

  beforeEach(async () => {
    f = await seedWorld(4, 19_929);
    [capital, colony, target] = [f.planetIds[0]!, f.planetIds[2]!, f.planetIds[3]!];
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[0]! }).where(eq(planets.id, colony));
    await f.db.update(planets).set({ kind: 'COLONY', controllerPlayerId: f.playerIds[1]!, defencePosture: 'HOLD' })
      .where(eq(planets.id, target));
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 12);
    await fuelUp(f.db, colony, 50_000);
    await giveUnits(f.db, colony, { DART: 40 });
    f.clock.advance(250);
  });
  afterAll(async () => { await (await testDb()).close(); });

  const darts = async (planetId: string): Promise<number> => {
    const [row] = await f.db.select().from(units)
      .where(and(eq(units.planetId, planetId), eq(units.hull, 'DART'), eq(units.location, 'home')));
    return row?.count ?? 0;
  };

  it('keeps flying, and lands its survivors at the capital, not on the lost world', async () => {
    const raid = await launchAttack(f.db, colony, target, { DART: 40 }, f.clock);
    f.clock.advance(1);
    expect(await f.db.transaction((tx) => secedeColony(tx, colony, f.clock.now(), randomUUID()))).toBe(true);

    const airborne = await f.db.select().from(units).where(eq(units.location, raid.missionId));
    expect(airborne.reduce((sum, row) => sum + row.count, 0)).toBe(40);

    const capitalBefore = await darts(capital);
    // The raid resolves, then its survivors fly a separate return leg: follow every flight of theirs.
    for (let i = 0; i < 8; i++) {
      const flying = await f.db.select().from(missions)
        .where(and(eq(missions.ownerPlayerId, f.playerIds[0]!), eq(missions.status, 'in_flight')));
      if (flying.length === 0) break;
      const latest = Math.max(...flying.map((row) => row.arriveAt.getTime()));
      f.clock.set(new Date(latest + 60_000));
      await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent).tick();
    }
    const stillFlying = await f.db.select().from(missions)
      .where(and(eq(missions.ownerPlayerId, f.playerIds[0]!), eq(missions.status, 'in_flight')));
    expect(stillFlying).toEqual([]);

    const landed = await darts(capital) - capitalBefore;
    expect(landed).toBeGreaterThan(0);
    expect(await darts(colony)).toBe(0);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, colony));
    expect(world?.kind).toBe('NEUTRAL');
  });
});
