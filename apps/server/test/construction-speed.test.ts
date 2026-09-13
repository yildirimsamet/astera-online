import { eq } from 'drizzle-orm';
import {
  buildMinutes,
  buildingMinutes,
  instrumentCost,
  satelliteCost,
  hullWorkMinutes,
} from '@astera/rules';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildOrders, planets } from '../src/db/schema.js';
import {
  buildUnits, installSatellite, raiseInstrument, upgradeBuilding,
} from '../src/services/build.js';
import {
  giveResearch, giveSatellite, grant, seedWorld, setLevel, testDb, type Fixture,
} from './helpers.js';

/**
 * AI ROBOTS REACH THE QUEUE, NOT JUST THE RULES. D198.
 *
 * `packages/rules` already holds the arithmetic, and `construction-speed.test.ts`
 * there walks every structure. What this file holds is the half that has failed
 * before in this code base and would fail silently: a multiplier that exists in
 * the rules and never arrives at the row the server writes. The satellites did
 * exactly that once, and the warning is still in `tech.ts`.
 *
 * So all three construction kinds are placed through their real services and the
 * row's own `readyAt` is measured, rather than a pure function being called twice.
 */

const CORE = 8;

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * SECONDS the QUEUE committed to, off the row rather than off the quote.
 *
 * Seconds and not minutes because that is the unit a row is stored in:
 * `placeBuildOrder` writes `Math.ceil(minutes * 60)`, so a timer is whole seconds
 * and an assertion in minutes would be comparing against a figure the database
 * cannot hold. Every expectation below therefore rounds the same way.
 */
const queuedSeconds = async (f: Fixture, planetId: string): Promise<number> => {
  const [order] = await f.db
    .select()
    .from(buildOrders)
    .where(eq(buildOrders.planetId, planetId));
  if (!order) throw new Error('no order was placed');
  return (order.readyAt.getTime() - order.startedAt.getTime()) / 1000;
};

/** The same rounding the queue applies, so the two are comparable at all. */
const asStored = (minutes: number): number => Math.ceil(minutes * 60);

describe('the surface build ladder, through the real queue', () => {
  let f: Fixture;
  let planetId: string;

  beforeEach(async () => {
    f = await seedWorld(1);
    planetId = f.planetIds[0]!;
    // `grant` sizes producers — and the Core above them — to hold what it hands
    // out, so the Core this file prices against is set AFTER it, never before.
    await grant(f.db, planetId, 4_000_000, 4_000_000);
    await setLevel(f.db, planetId, 'CORE', CORE);
  });

  it('shortens a building by the rung the commander holds', async () => {
    await giveResearch(f.db, planetId, 'AI_ROBOTS', 5);
    const placed = await upgradeBuilding(f.db, planetId, 'VAULT', f.clock);
    const took = await queuedSeconds(f, planetId);

    expect(took).toBe(asStored(buildingMinutes('VAULT', placed.level, { AI_ROBOTS: 5 })));
    // And it is genuinely shorter than the same order without the research.
    expect(took).toBe(asStored(buildingMinutes('VAULT', placed.level, {}) * 0.75));
    expect(took).toBeLessThan(asStored(buildingMinutes('VAULT', placed.level, {})));
  });

  it('shortens an instrument by the same rung', async () => {
    await giveSatellite(f.db, planetId, 'UPLINK');
    await giveResearch(f.db, planetId, 'AI_ROBOTS', 5);
    await raiseInstrument(f.db, planetId, 'RADAR', f.clock);

    expect(await queuedSeconds(f, planetId))
      .toBe(asStored(buildMinutes(instrumentCost('RADAR', 0), CORE, {}) * 0.75));
  });

  it('shortens a satellite by the same rung', async () => {
    await giveResearch(f.db, planetId, 'AI_ROBOTS', 3);
    await installSatellite(f.db, planetId, 'FOUNDRY', f.clock);

    expect(await queuedSeconds(f, planetId))
      .toBe(asStored(buildMinutes(satelliteCost('FOUNDRY'), CORE, {}) * 0.85));
  });

  /** D209: the Uplink is five minutes by hand, and the robots still take their share. */
  it('builds the Uplink in five minutes, less the robot rung, for 1,000 / 500', async () => {
    const [before] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    await giveResearch(f.db, planetId, 'AI_ROBOTS', 3);
    await installSatellite(f.db, planetId, 'UPLINK', f.clock);

    expect(await queuedSeconds(f, planetId)).toBe(asStored(5 * 0.85));
    const [after] = await f.db.select().from(planets).where(eq(planets.id, planetId));
    expect(before!.alloy - after!.alloy).toBeCloseTo(1_000, 0);
    expect(before!.crystal - after!.crystal).toBeCloseTo(500, 0);
  });

  /**
   * THE YARD IS THE OTHER QUEUE AND IT HAS ITS OWN PROJECT. A commander holding
   * five rungs of the surface ladder and none of the Yard's must find a hull
   * taking exactly as long as it always did.
   */
  it('leaves a hull in the yard untouched', async () => {
    await setLevel(f.db, planetId, 'SHIPYARD', 4);
    await giveResearch(f.db, planetId, 'AI_ROBOTS', 5);
    await buildUnits(f.db, planetId, 'DART', 2, f.clock);

    expect(await queuedSeconds(f, planetId))
      .toBe(asStored(hullWorkMinutes('DART', 2, 4, {})));
  });

  /** And the figure handed back to the client is the one the queue actually took. */
  it('quotes the shortened figure back on the planet view', async () => {
    await giveResearch(f.db, planetId, 'AI_ROBOTS', 4);
    const placed = await upgradeBuilding(f.db, planetId, 'VAULT', f.clock);

    const queued = placed.planet.queues.CONSTRUCTION[0];
    expect(queued).toBeDefined();
    const seconds = (queued!.finishesAt.getTime() - f.clock.now().getTime()) / 1000;
    expect(seconds).toBe(asStored(buildingMinutes('VAULT', placed.level, { AI_ROBOTS: 4 })));
  });
});
