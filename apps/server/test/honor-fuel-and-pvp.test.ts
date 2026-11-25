import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  MULTI_WORLD, alloyRate, crystalRate, deuteriumRate, distance, honorFuelCost, missionFuel,
} from '@astera/rules';
import { honorTotals, missions, planets, seasons } from '../src/db/schema.js';
import { enableHonorBenefits } from '../src/services/honorBenefits.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { launchAttack } from '../src/services/mission.js';
import { launchTransfer } from '../src/services/movement.js';
import { grantRecoveryShield } from '../src/services/attackProtection.js';
import { giveUnits, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

describe('Step 5: +25% Honor fuel surcharge, 3h shield vs 4h fault split, and bash/cooldown limits', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(2, 9501); });
  afterAll(async () => { await (await testDb()).close(); });

  it('charges +25% fuel on launchAttack at Tier -3 and refuses stale expectedHonorTier with 409', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: -150_000_000 });
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 13);
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 13);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 20 });

    const [p0] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const [p1] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    const dist = distance(p0!, p1!);
    const baseFuel = missionFuel({ DART: 20 }, dist, 2, 'HOSTILE', 1);
    const taxedFuel = honorFuelCost(baseFuel, { fuelPct: 25 });
    expect(taxedFuel).toBeGreaterThan(baseFuel);

    // Give exactly baseFuel (enough without penalty, NOT enough with +25% penalty)
    await f.db.update(planets).set({ deuterium: baseFuel, bufferDeuterium: 0 }).where(eq(planets.id, f.planetIds[0]!));
    await expect(launchAttack(
      f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 20 }, f.clock, f.playerIds[0], true,
    )).rejects.toMatchObject({ code: 'INSUFFICIENT_FUEL' });

    // Give taxedFuel, but send stale expectedHonorTier: 0 -> 409 HONOR_QUOTE_CHANGED
    await f.db.update(planets).set({ deuterium: taxedFuel + 10 }).where(eq(planets.id, f.planetIds[0]!));
    await expect(launchAttack(
      f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 20 }, f.clock, f.playerIds[0], true,
      undefined, false, new Set(), false, 'PLANET', 'PLANET', [], 0,
    )).rejects.toMatchObject({ code: 'HONOR_QUOTE_CHANGED', status: 409 });

    // Matching expectedHonorTier: -3 succeeds and charges taxedFuel
    const before = (await f.db.select({ d: planets.deuterium }).from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]!.d;
    const res = await launchAttack(
      f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 20 }, f.clock, f.playerIds[0], true,
      undefined, false, new Set(), false, 'PLANET', 'PLANET', [], -3,
    );
    const after = (await f.db.select({ d: planets.deuterium }).from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]!.d;
    expect(res.missionId).toBeTruthy();
    expect(Math.round(before - after)).toBe(taxedFuel);
  });

  it('charges +25% fuel on launchTransfer at Tier -3', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: -150_000_000 });
    await f.db.update(planets).set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' }).where(eq(planets.id, f.planetIds[1]!));
    await giveUnits(f.db, f.planetIds[0]!, { COURIER: 10 });
    await f.db.update(planets).set({ deuterium: 50_000 }).where(eq(planets.id, f.planetIds[0]!));

    const [p0] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[0]!));
    const [p1] = await f.db.select().from(planets).where(eq(planets.id, f.planetIds[1]!));
    const baseFuel = missionFuel({ COURIER: 10 }, distance(p0!, p1!), 1, 'HOMEWARD', 1);
    const taxedFuel = honorFuelCost(baseFuel, { fuelPct: 25 });

    const before = (await f.db.select({ d: planets.deuterium }).from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]!.d;
    await launchTransfer(
      f.db, f.playerIds[0]!, f.planetIds[0]!, f.planetIds[1]!,
      { COURIER: 10 }, { alloy: 0, crystal: 0, deuterium: 0 }, f.clock,
    );
    const after = (await f.db.select({ d: planets.deuterium }).from(planets).where(eq(planets.id, f.planetIds[0]!)))[0]!.d;
    expect(Math.round(before - after)).toBe(taxedFuel);
  });

  it('grants a 12h recovery shield at 3.2h loss for Tier 4+ WITHOUT triggering colony faults (earned stays false until 4h)', async () => {
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 12); // Tier 4
    await setLevel(f.db, f.planetIds[1]!, 'REFINERY', 10);
    await setLevel(f.db, f.planetIds[1]!, 'EXTRACTOR', 10);
    await setLevel(f.db, f.planetIds[1]!, 'DEUTERIUM_PLANT', 10);

    const prod = { alloy: alloyRate(10), crystal: crystalRate(10), deuterium: deuteriumRate(10) };
    const loss32 = { alloy: Math.round(prod.alloy * 3.2), crystal: Math.round(prod.crystal * 3.2), deuterium: Math.round(prod.deuterium * 3.2) };
    const res32 = await f.db.transaction(tx => grantRecoveryShield(tx, {
      playerId: f.playerIds[1]!, planetId: f.planetIds[1]!,
      lootLost: loss32, fleetLost: { alloy: 0, crystal: 0, deuterium: 0 },
      now: f.clock.now(),
    }));
    expect(res32.until).not.toBeNull();
    expect(res32.earned).toBe(false);

    const loss41 = { alloy: Math.round(prod.alloy * 4.1), crystal: Math.round(prod.crystal * 4.1), deuterium: Math.round(prod.deuterium * 4.1) };
    const res41 = await f.db.transaction(tx => grantRecoveryShield(tx, {
      playerId: f.playerIds[1]!, planetId: f.planetIds[1]!,
      lootLost: loss41, fleetLost: { alloy: 0, crystal: 0, deuterium: 0 },
      now: f.clock.now(),
    }));
    expect(res41.until).not.toBeNull();
    expect(res41.earned).toBe(true);
  });

  it('refuses a 3rd solo attack at Tier 5+ with BASH_LIMIT and { limit: 2, hours: 12 } params', async () => {
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.clanRulesetVersion }).where(eq(seasons.id, f.seasonId));
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 15); // Tier 5
    await setLevel(f.db, f.planetIds[1]!, 'CORE', 15); // Tier 5
    await giveUnits(f.db, f.planetIds[0]!, { DART: 30 });
    await f.db.update(planets).set({ deuterium: 100_000 }).where(eq(planets.id, f.planetIds[0]!));

    const m1 = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 5 }, f.clock, f.playerIds[0], true);
    await f.db.update(missions).set({ status: 'resolved' }).where(eq(missions.id, m1.missionId));
    const m2 = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 5 }, f.clock, f.playerIds[0], true);
    await f.db.update(missions).set({ status: 'resolved' }).where(eq(missions.id, m2.missionId));
    await expect(
      launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 5 }, f.clock, f.playerIds[0], true),
    ).rejects.toMatchObject({ code: 'BASH_LIMIT', params: { limit: 2, hours: 12 } });
  });
});
