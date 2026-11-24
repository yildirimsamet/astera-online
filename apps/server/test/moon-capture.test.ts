import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MOON } from '@astera/rules';
import { planets, researchOrders, seasons } from '../src/db/schema.js';
import { holdsLunarCapture } from '../src/services/moon.js';
import { completeResearch } from '../src/services/research.js';
import { giveResearch, grant, levelWorld, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

/*
  V34 slice (S7, S9; owner 2026-11-19, V28): Lunar Capture is offered only in a galaxy with moons, behind
  Core 9, for 20k alloy, 10k crystal and 500 deuterium, and takes four hours whatever the Core. Holding it
  is what lets a moon be born over the holder's worlds.
*/
describe('Lunar Capture', () => {
  let f: Fixture;
  let home: string;

  beforeEach(async () => {
    f = await seedWorld(1, 20_194);
    home = f.planetIds[0]!;
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    await setLevel(f.db, home, 'CORE', 12);
    await grant(f.db, home, 100_000, 100_000);
    await f.db.update(planets).set({ deuterium: 10_000 }).where(eq(planets.id, home));
    await levelWorld(f.db, [home]);
    f.clock.advance(10);
  });
  afterAll(async () => { await (await testDb()).close(); });

  const tank = async () => (await f.db.select({ alloy: planets.alloy, crystal: planets.crystal, deuterium: planets.deuterium })
    .from(planets).where(eq(planets.id, home)))[0]!;

  it('takes the owner’s price and exactly four hours, whatever the Core', async () => {
    const before = await tank();
    await completeResearch(f.db, home, 'LUNAR_CAPTURE', f.clock);
    const after = await tank();
    expect(before.alloy - after.alloy).toBeCloseTo(20_000, 0);
    expect(before.crystal - after.crystal).toBeCloseTo(10_000, 0);
    expect(before.deuterium - after.deuterium).toBeCloseTo(500, 0);
    const [order] = await f.db.select().from(researchOrders)
      .where(and(eq(researchOrders.playerId, f.playerIds[0]!), eq(researchOrders.projectId, 'LUNAR_CAPTURE')));
    expect(order!.readyAt.getTime() - order!.startedAt.getTime()).toBe(MOON.capture.minutes * 60_000);
  });

  it('wants Core 9', async () => {
    await setLevel(f.db, home, 'CORE', 8);
    await expect(completeResearch(f.db, home, 'LUNAR_CAPTURE', f.clock)).rejects.toMatchObject({ code: 'RESEARCH_UNAVAILABLE' });
  });

  it('is not offered in a galaxy without moons', async () => {
    await f.db.update(seasons).set({ rulesetVersion: MOON.rulesetVersion - 1 }).where(eq(seasons.id, f.seasonId));
    await expect(completeResearch(f.db, home, 'LUNAR_CAPTURE', f.clock)).rejects.toMatchObject({ code: 'NO_SUCH_RESEARCH' });
  });

  it('is what lets a moon be born over its holder’s worlds (S9)', async () => {
    expect(await holdsLunarCapture(f.db, f.playerIds[0]!)).toBe(false);
    await giveResearch(f.db, home, 'LUNAR_CAPTURE');
    expect(await holdsLunarCapture(f.db, f.playerIds[0]!)).toBe(true);
  });
});
