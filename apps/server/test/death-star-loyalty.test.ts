import { and, asc, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ANTI_STRATEGIC, DEATH_STAR, FAULT, FAULT_KINDS, radarRange } from '@astera/rules';
import {
  notifications,
  planetFaults,
  planets,
  scheduledEvents,
  strategicAssets,
  strategicImpacts,
} from '../src/db/schema.js';
import { launchDeathStar } from '../src/services/strategic.js';
import { readBattleReports, type StrategicReportView } from '../src/services/reports.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveInstrument,
  giveSatellite,
  grant,
  levelWorld,
  placeAt,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

/**
 * ÖLÜM YILDIZI KOLONİNİN SADAKATİNİ KIRAR. Sahip, 2026-10-01:
 * *"her ölüm yıldızı vuruşunda %20 sadakat puanı düşer. Yetersiz sadakat puanı varsa
 * (örn: %20 veya daha az) → vuruştan sonra koloni neutral'a döner."*
 *
 * Savaş kaybındaki sadakat düşüşüyle aynı yol: sayı düşer, izleyici yeniden kurulur, sıfırda
 * `colony_secession` koloniyi kimseye vermeden NEUTRAL yapar. Ana dünyanın sadakati yoktur.
 */

const silent = pino({ level: 'silent' });
const workerFor = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('a Death Star hit on a colony', () => {
  let f: Fixture;
  let attacker: string;
  let capital: string;
  let colony: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [attacker, capital, colony] = f.planetIds as [string, string, string];
    // The third seat's world becomes the second commander's colony.
    await f.db.update(planets).set({
      controllerPlayerId: f.playerIds[1]!,
      statsOwnerPlayerId: f.playerIds[1]!,
      kind: 'COLONY',
    }).where(eq(planets.id, colony));
    await placeAt(f.db, attacker, { x: 0 });
    await placeAt(f.db, colony, { x: radarRange(5) * 4 });
    await setLevel(f.db, colony, 'CORE', 8);
    await setLevel(f.db, attacker, 'CORE', DEATH_STAR.requiredCore);
    await setLevel(f.db, attacker, 'SHIPYARD', DEATH_STAR.requiredShipyard);
    await grant(f.db, attacker, 400_000, 200_000);
    // D168: a Death Star strike answers to the same development band as a raid, and `grant`
    // raised the attacker's Core to hold the purse. The defender's CAPITAL comes up to
    // match; the colony under test keeps its own Core.
    await levelWorld(f.db, [attacker, capital]);
    await f.db.insert(strategicAssets).values({
      planetId: attacker,
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });
    f.clock.advance(250);
  });

  const setLoyalty = (planetId: string, loyalty: number) => f.db.update(planets)
    .set({ loyalty, lastTickAt: f.clock.now() })
    .where(eq(planets.id, planetId));

  /**
   * Walk the queue the way a one-second worker does, then land and let it settle.
   *
   * `loyaltyAtImpact` is written AT the arrival instant: a colony with no fault standing
   * climbs back while the weapon flies, so a figure written at launch is not the figure
   * the hit meets — which is the rule, and would make every exact assertion drift.
   */
  const strike = async (target: string, loyaltyAtImpact?: number) => {
    const launched = await launchDeathStar(f.db, attacker, target, f.clock);
    const worker = workerFor(f);
    for (let step = 0; step < 30; step++) {
      const [next] = await f.db
        .select({ at: scheduledEvents.resolveAt })
        .from(scheduledEvents)
        .where(eq(scheduledEvents.status, 'pending'))
        .orderBy(asc(scheduledEvents.resolveAt))
        .limit(1);
      if (!next || next.at >= launched.arriveAt) break;
      if (next.at > f.clock.now()) f.clock.set(next.at);
      await worker.tick();
    }
    f.clock.set(launched.arriveAt);
    if (loyaltyAtImpact !== undefined) await setLoyalty(target, loyaltyAtImpact);
    await worker.tick();
    // A secession booked by the hit is due at the hit's own instant.
    f.clock.advance(1 / 60);
    await worker.tick();
    return launched;
  };

  const worldOf = async (planetId: string) =>
    (await f.db.select().from(planets).where(eq(planets.id, planetId)))[0]!;

  const impactOf = async (missionId: string) =>
    (await f.db.select().from(strategicImpacts).where(eq(strategicImpacts.missionId, missionId)))[0]!;

  it('takes twenty points and leaves a loyal colony with its commander', async () => {
    const launched = await strike(colony);

    const world = await worldOf(colony);
    expect(world.kind).toBe('COLONY');
    expect(world.controllerPlayerId).toBe(f.playerIds[1]);
    expect(world.loyalty).toBeCloseTo(100 - DEATH_STAR.colonyLoyaltyLoss, 6);
    const impact = await impactOf(launched.missionId);
    expect(impact.loyaltyBefore).toBeCloseTo(100, 6);
    expect(impact.loyaltyAfter).toBeCloseTo(80, 6);
  });

  it('keeps a colony above twenty, by the margin it had', async () => {
    const launched = await strike(colony, 35);

    const world = await worldOf(colony);
    expect(world.kind).toBe('COLONY');
    expect(world.loyalty).toBeCloseTo(15, 6);
    expect((await impactOf(launched.missionId)).loyaltyAfter).toBeCloseTo(15, 6);
  });

  it('turns a colony at exactly twenty NEUTRAL — nobody gains it', async () => {
    const launched = await strike(colony, 20);

    const world = await worldOf(colony);
    expect(world.kind).toBe('NEUTRAL');
    expect(world.controllerPlayerId).toBeNull();
    const impact = await impactOf(launched.missionId);
    expect(impact.loyaltyBefore).toBeCloseTo(20, 6);
    expect(impact.loyaltyAfter).toBe(0);
    const lost = (await f.db.select().from(notifications)
      .where(and(eq(notifications.playerId, f.playerIds[1]!), eq(notifications.kind, 'colony_lost'))));
    expect(lost).toHaveLength(1);
    expect(lost[0]!.payload).toMatchObject({ planetId: colony, cause: 'SECESSION' });
  });

  it('turns a colony below twenty NEUTRAL and never below zero', async () => {
    const launched = await strike(colony, 7);

    expect((await worldOf(colony)).kind).toBe('NEUTRAL');
    expect((await impactOf(launched.missionId)).loyaltyAfter).toBe(0);
  });

  /**
   * THE LOSS COMES OFF THE LOYALTY THE WORLD HAS NOW, not the figure last written. Eight
   * faults standing drain about eight points an hour, so a colony written at 25 an hour
   * before the hit is below twenty when the weapon lands — and falls.
   */
  it('reads loyalty as it stands at the hit, faults and all', async () => {
    for (const kind of FAULT_KINDS) {
      await f.db.insert(planetFaults).values({ planetId: colony, kind, startedAt: f.clock.now() });
    }
    await setLoyalty(colony, 25);
    f.clock.advance(60);

    await strike(colony);

    expect((await worldOf(colony)).kind).toBe('NEUTRAL');
  });

  /** Like a battle loss, the hit reaches every colony — below the fault gate too. */
  it('takes loyalty from a colony too young to break', async () => {
    await setLevel(f.db, colony, 'CORE', FAULT.minCoreLevel - 1);
    await strike(colony, 70);

    expect((await worldOf(colony)).loyalty).toBeCloseTo(50, 6);
  });

  /**
   * TWO WEAPONS LANDING IN THE SAME INSTANT. The worker settles them one after the other
   * (an earlier mission at the same arrival goes first), so the second hit reads what the
   * first left: 30 → 10 → 0, and the colony goes.
   */
  it('settles two weapons landing together one after the other', async () => {
    await f.db.insert(strategicAssets).values({
      planetId: attacker, status: 'READY', startedAt: f.clock.now(), remainingSeconds: 0,
    });
    const first = await launchDeathStar(f.db, attacker, colony, f.clock);
    const second = await launchDeathStar(f.db, attacker, colony, f.clock);
    expect(second.arriveAt.getTime()).toBe(first.arriveAt.getTime());

    const worker = workerFor(f);
    f.clock.set(first.arriveAt);
    await setLoyalty(colony, 30);
    for (let pass = 0; pass < 3; pass++) await worker.tick();
    f.clock.advance(1 / 60);
    await worker.tick();

    const hits = [await impactOf(first.missionId), await impactOf(second.missionId)]
      .map((impact) => [impact.loyaltyBefore, impact.loyaltyAfter])
      .sort((a, b) => (b[0] ?? 0) - (a[0] ?? 0));
    expect(hits[0]![0]).toBeCloseTo(30, 6);
    expect(hits[0]![1]).toBeCloseTo(10, 6);
    expect(hits[1]![0]).toBeCloseTo(10, 6);
    expect(hits[1]![1]).toBe(0);
    expect((await worldOf(colony)).kind).toBe('NEUTRAL');
  });

  /** The bell says it too, so a commander who never opens the report still learns it. */
  it('puts the loyalty it took on both commanders’ notifications', async () => {
    const launched = await strike(colony, 60);

    const told = await f.db.select().from(notifications)
      .where(and(eq(notifications.kind, 'death_star_result'), eq(notifications.refId, launched.missionId)));
    expect(told.map((row) => row.playerId).sort()).toEqual([f.playerIds[0]!, f.playerIds[1]!].sort());
    for (const row of told) expect(row.payload).toMatchObject({ loyalty: { before: 60, after: 40 } });
  });

  it('leaves a capital’s loyalty alone and records none', async () => {
    const launched = await strike(capital);

    expect((await worldOf(capital)).loyalty).toBe(100);
    const impact = await impactOf(launched.missionId);
    expect(impact.outcome).toBe('FIRST_STRIKE');
    expect(impact.loyaltyBefore).toBeNull();
    expect(impact.loyaltyAfter).toBeNull();
  });

  it('costs nothing when the weapon is shot down on the way', async () => {
    await giveSatellite(f.db, colony, 'UPLINK');
    await giveInstrument(f.db, colony, 'RADAR', ANTI_STRATEGIC.requiredRadar);
    await f.db.insert(strategicAssets).values({
      planetId: colony,
      type: 'INTERCEPTOR',
      status: 'READY',
      startedAt: f.clock.now(),
      remainingSeconds: 0,
    });

    await strike(colony);

    const world = await worldOf(colony);
    expect(world.kind).toBe('COLONY');
    expect(world.loyalty).toBe(100);
  });

  /** Both sides read the same two figures, so the attacker learns what the hit did. */
  it('puts the loyalty it took on both commanders’ reports', async () => {
    await strike(colony, 60);

    for (const playerId of [f.playerIds[0]!, f.playerIds[1]!]) {
      const { reports } = await readBattleReports(f.db, playerId);
      const report = reports.find((row): row is StrategicReportView => row.kind === 'STRATEGIC');
      expect(report?.loyalty, playerId).toEqual({ before: 60, after: 40 });
    }
  });

  it('puts no loyalty on the report of a capital strike', async () => {
    await strike(capital);

    const { reports } = await readBattleReports(f.db, f.playerIds[0]!);
    const report = reports.find((row): row is StrategicReportView => row.kind === 'STRATEGIC');
    expect(report?.loyalty).toBeNull();
  });
});
