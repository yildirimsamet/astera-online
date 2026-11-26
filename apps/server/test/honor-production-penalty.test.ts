import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorSeasons, honorTotals, missions, planets, scheduledEvents } from '../src/db/schema.js';
import { ensureMainHonorRankings } from '../src/services/honorActivation.js';
import { enableHonorBenefits } from '../src/services/honorBenefits.js';
import { prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import { loadPlanetViewStates } from '../src/services/planet.js';
import { transferPlanetControl } from '../src/services/ownership.js';
import { planetView } from '../src/services/planetView.js';
import { claimDailyQuest } from '../src/services/dailyQuests.js';
import { HANDLERS } from '../src/worker/handlers.js';
import { seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

describe('Honor Tier -4 (-25% production) & live season V2 activation', () => {
  let f: Fixture;
  beforeEach(async () => { f = await seedWorld(2, 9104); });
  afterAll(async () => { await (await testDb()).close(); });

  it('upgrades a live V1 season to V2 on boot and schedules honor_penalty_sync for Tier -4 commanders', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await f.db.update(honorSeasons).set({ benefitsVersion: 1 }).where(eq(honorSeasons.seasonId, f.seasonId));
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: -210_000_000 });

    await ensureMainHonorRankings(f.db, f.clock);
    const [config] = await f.db.select().from(honorSeasons).where(eq(honorSeasons.seasonId, f.seasonId));
    expect(config?.benefitsVersion).toBe(2);

    const events = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, f.seasonId),
      eq(scheduledEvents.kind, 'honor_penalty_sync'),
      eq(scheduledEvents.refId, f.playerIds[0]!),
    ));
    expect(events).toHaveLength(1);

    await HANDLERS.honor_penalty_sync!({ db: f.db, clock: f.clock }, events[0]!);
    const [world] = await f.db.select({ share: planets.honorProductionShare }).from(planets).where(eq(planets.id, f.planetIds[0]!));
    expect(world?.share).toBe(-0.25);
  });

  it('applies -25% production after crossing -200 via settleHonor, preserves nominal caps, and matches /api/planets', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
    await setLevel(f.db, f.planetIds[0]!, 'REFINERY', 10);
    await setLevel(f.db, f.planetIds[0]!, 'EXTRACTOR', 10);
    await setLevel(f.db, f.planetIds[0]!, 'DEUTERIUM_PLANT', 10);

    const beforeView = await f.db.transaction(tx => planetView(tx, f.planetIds[0]!, f.clock));

    // Advance 60 minutes at 100%, then drop to <= -200 via bullying battle
    f.clock.advance(60);
    const member = (id: string, tier: number, navy: number, loss = 0) => ({
      id, tier, navy, weight: 10_000, civilianWeight: 0, loss, combatLoss: loss, lootLost: 0,
    });
    await f.db.transaction(tx => settleHonor(tx, f.seasonId, {
      source: 'WORLD', id: randomUUID(), at: f.clock.now().getTime(), eligible: true, weakRepeatScale: 100,
      attack: [member(f.playerIds[0]!, 4, 200_000)],
      defence: [member(f.playerIds[1]!, 2, 10_000, 900_000)],
      relations: [{ a: f.playerIds[0]!, b: f.playerIds[1]!, related: false }],
    }));

    const [syncEvent] = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, f.seasonId),
      eq(scheduledEvents.kind, 'honor_penalty_sync'),
      eq(scheduledEvents.refId, f.playerIds[0]!),
    ));
    expect(syncEvent).toBeDefined();
    await HANDLERS.honor_penalty_sync!({ db: f.db, clock: f.clock }, syncEvent!);

    // Single-planet view and batched loadPlanetViewStates must agree on 75% rate and nominal caps
    const afterView = await f.db.transaction(tx => planetView(tx, f.planetIds[0]!, f.clock));
    expect(Math.abs(afterView.planet.alloyPerHour - beforeView.planet.nominalAlloyPerHour * 0.75)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterView.planet.crystalPerHour - beforeView.planet.nominalCrystalPerHour * 0.75)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterView.planet.deuteriumPerHour - beforeView.planet.nominalDeuteriumPerHour * 0.75)).toBeLessThanOrEqual(1);
    expect(afterView.planet.alloyCap).toBe(beforeView.planet.alloyCap);
    expect(afterView.planet.bufferAlloyCap).toBe(beforeView.planet.bufferAlloyCap);

    const [batched] = await f.db.transaction(tx => loadPlanetViewStates(tx, [f.planetIds[0]!], f.clock));
    expect(batched?.planet.honorProductionShare).toBe(-0.25);

    // Advance another 60 minutes: must accrue 75% of 1 hour
    const bufAtDrop = afterView.planet.bufferAlloy;
    f.clock.advance(60);
    const laterView = await f.db.transaction(tx => planetView(tx, f.planetIds[0]!, f.clock));
    expect(laterView.planet.bufferAlloy - bufAtDrop).toBeCloseTo(afterView.planet.alloyPerHour, -1);
  });

  it('clears the -25% penalty when a daily quest lifts Honor above -200', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: -200_000_000 });
    await f.db.update(planets).set({ honorProductionShare: -0.25 }).where(eq(planets.id, f.planetIds[0]!));

    // Satisfy the PROBES daily quest (3 probes today)
    const now = f.clock.now();
    for (let i = 0; i < 3; i++) {
      await f.db.insert(missions).values({
        seasonId: f.seasonId, ownerPlayerId: f.playerIds[0]!, kind: 'probe',
        originPlanetId: f.planetIds[0]!, targetPlanetId: f.planetIds[1]!,
        fleet: {}, status: 'resolved', fuelPaid: 1, distance: 100, departAt: now, arriveAt: now,
      });
    }
    const claimed = await claimDailyQuest(f.db, f.planetIds[0]!, 'PROBES', f.clock);
    // The locked world's immediate HTTP response already reflects 100% production (no stale -25% contradiction).
    expect(claimed.planet.planet.alloyPerHour).toBeCloseTo(claimed.planet.planet.nominalAlloyPerHour, 1);

    const [syncEvent] = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.seasonId, f.seasonId),
      eq(scheduledEvents.kind, 'honor_penalty_sync'),
      eq(scheduledEvents.refId, f.playerIds[0]!),
    ));
    expect(syncEvent).toBeDefined();
    await HANDLERS.honor_penalty_sync!({ db: f.db, clock: f.clock }, syncEvent!);
    const [world] = await f.db.select({ share: planets.honorProductionShare }).from(planets).where(eq(planets.id, f.planetIds[0]!));
    expect(world?.share).toBe(0);
  });

  it('immediately applies the new owner Honor Tier -4 production share on transferPlanetControl', async () => {
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: -210_000_000 });
    await f.db.update(planets).set({ controllerPlayerId: null, kind: 'NEUTRAL', honorProductionShare: 0 })
      .where(eq(planets.id, f.planetIds[1]!));

    await f.db.transaction(tx => transferPlanetControl(tx, {
      targetPlanetId: f.planetIds[1]!,
      newPlayerId: f.playerIds[0]!,
      expectedControllerPlayerId: null,
      now: f.clock.now(),
      protectedUntil: f.clock.now(),
    }));

    const [transferred] = await f.db.select({ share: planets.honorProductionShare }).from(planets).where(eq(planets.id, f.planetIds[1]!));
    expect(transferred?.share).toBe(-0.25);
  });
});
