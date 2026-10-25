import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { alloyRate, computeLoot, crystalRate, deuteriumRate, pvpBalanceForTier, type Resources } from '@astera/rules';
import { battleReports, missions, planets, players, probeReports, satellites } from '../src/db/schema.js';
import { forceRecoveryShield, grantRecoveryShield } from '../src/services/attackProtection.js';
import { launchProbe } from '../src/services/intel.js';
import { reportsSchema } from '../../web/src/api/schemas.js';
import { launchAttack } from '../src/services/mission.js';
import { planetView } from '../src/services/planetView.js';
import { readBattleReports } from '../src/services/reports.js';
import { EventWorker } from '../src/worker/loop.js';
import { fuelUp, giveUnits, grant, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

const HOUR = 3_600_000;
const empty: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
const loss = (hours: number): Resources => ({
  alloy: alloyRate(3) * hours, crystal: crystalRate(3) * hours, deuterium: deuteriumRate(3) * hours,
});
afterAll(async () => { await (await testDb()).close(); });

describe('tier-specific PvP settlement and recovery', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let me: string;
  let them: string;
  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, theirs] = f.planetIds as [string, string];
    [me, them] = f.playerIds as [string, string];
    await f.db.delete(satellites);
    for (const id of [mine, theirs]) {
      await setLevel(f.db, id, 'CORE', 7);
      for (const type of ['REFINERY', 'EXTRACTOR', 'DEUTERIUM_PLANT'] as const) await setLevel(f.db, id, type, 3);
    }
    f.clock.advance(250);
  });
  const giveShield = (hours: number) => f.db.transaction(tx => grantRecoveryShield(tx, {
    playerId: them, planetId: theirs, now: f.clock.now(), lootLost: loss(hours), fleetLost: empty,
  }));

  async function pastDefeat(hoursAgo: number, hoursLost: number) {
    const at = new Date(f.clock.now().getTime() - hoursAgo * HOUR);
    const [mission] = await f.db.insert(missions).values({
      seasonId: f.seasonId, ownerPlayerId: me, originPlanetId: mine, targetPlanetId: theirs,
      kind: 'attack', status: 'resolved', fleet: { DART: 1 }, distance: 150, fuelPaid: 0,
      departAt: new Date(at.getTime() - HOUR), arriveAt: at,
    }).returning();
    await f.db.insert(battleReports).values({
      seasonId: f.seasonId, missionId: mission!.id, attackerPlayerId: me, defenderPlayerId: them,
      targetPlanetId: theirs, targetKind: 'PLAYER', grade: 'DECISIVE', rounds: [],
      loot: loss(hoursLost), attackerLosses: {}, defenderLosses: {}, createdAt: at,
    });
  }

  it('grants at exactly two hours, for twelve hours, with matching production boost', async () => {
    const result = await giveShield(2);
    expect(result.hours).toBeCloseTo(2);
    expect(result.until?.getTime()).toBe(f.clock.now().getTime() + 12 * HOUR);
    const [world] = await f.db.select().from(planets).where(eq(planets.id, theirs));
    expect(world!.recoveryBoostUntil?.getTime()).toBe(result.until?.getTime());
    // The easier shield must not make colony battle faults easier to earn.
    expect(result.earned).toBe(false);
  });

  it('the report API preserves the actual longer shield deadline for the defender only', async () => {
    await pastDefeat(0, 4);
    const until = new Date(f.clock.now().getTime() + 11 * HOUR);
    await f.db.update(battleReports).set({
      recoveryLossHours: 4, recoveryShieldUntil: until, pvpBalance: pvpBalanceForTier(4),
    }).where(eq(battleReports.defenderPlayerId, them));
    const defended = reportsSchema.parse(await f.db.transaction(tx => readBattleReports(tx, them)));
    expect(defended.reports[0]).toMatchObject({ recovery: { until, shielded: true } });
    const attacked = reportsSchema.parse(await f.db.transaction(tx => readBattleReports(tx, me)));
    expect(attacked.reports[0]).toMatchObject({ recovery: null });
  });

  it('preserves a historical eight-hour report profile and its actual deadline', async () => {
    await pastDefeat(0, 4);
    const until = new Date(f.clock.now().getTime() + 8 * HOUR);
    const legacy = { ...pvpBalanceForTier(4), recoveryShieldHours: 8 };
    await f.db.update(battleReports).set({
      recoveryLossHours: 4, recoveryShieldUntil: until, pvpBalance: legacy,
    }).where(eq(battleReports.defenderPlayerId, them));
    const defended = reportsSchema.parse(await f.db.transaction(tx => readBattleReports(tx, them)));
    expect(defended.reports[0]).toMatchObject({ pvpBalance: legacy, recovery: { until, shielded: true } });
  });

  it.each([6, 5.999])('keeps the colony fault cutoff at six hours (defeat age %s)', async age => {
    await pastDefeat(age, 3);
    const result = await giveShield(1);
    expect(result.until).not.toBeNull();
    expect(result.earned).toBe(age < 6);
  });

  it('refuses a loss just below two hours', async () => {
    expect((await giveShield(1.999)).until).toBeNull();
  });

  it('counts a seven-hour-old defeat for low-tier recovery but not colony faults', async () => {
    await pastDefeat(7, 3);
    const result = await giveShield(1);
    expect(result.hours).toBeCloseTo(4);
    expect(result.until).not.toBeNull();
    expect(result.earned).toBe(false);
  });

  it('excludes a defeat exactly eight hours old', async () => {
    await pastDefeat(8, 3);
    const result = await giveShield(1);
    expect(result.hours).toBeCloseTo(1);
    expect(result.until).toBeNull();
  });

  it('keeps the tier-four threshold, six-hour history and twelve-hour duration', async () => {
    await setLevel(f.db, theirs, 'CORE', 10);
    await pastDefeat(7, 10);
    expect((await giveShield(2)).until).toBeNull();
    const result = await giveShield(4);
    expect(result.hours).toBeCloseTo(4);
    expect(result.until?.getTime()).toBe(f.clock.now().getTime() + 12 * HOUR);
    expect(result.earned).toBe(true);
  });

  it.each([7, 10])('an outright recovery grant uses twelve hours at Core %i', async core => {
    await setLevel(f.db, theirs, 'CORE', core);
    const until = await f.db.transaction(tx => forceRecoveryShield(tx, { playerId: them, planetId: theirs, now: f.clock.now() }));
    expect(until?.getTime()).toBe(f.clock.now().getTime() + 12 * HOUR);
  });

  it('a high-tier colony selects the commander profile even when the struck capital is small', async () => {
    const colony = f.planetIds[2]!;
    await f.db.update(planets).set({ controllerPlayerId: them, kind: 'COLONY' }).where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', 10);
    const until = await f.db.transaction(tx => forceRecoveryShield(tx, { playerId: them, planetId: theirs, now: f.clock.now() }));
    expect(until?.getTime()).toBe(f.clock.now().getTime() + 12 * HOUR);
  });

  it('never shortens an existing shield when a commander reaches tier four', async () => {
    const until = new Date(f.clock.now().getTime() + 15 * HOUR);
    await f.db.update(players).set({ recoveryShieldUntil: until }).where(eq(players.id, them));
    await setLevel(f.db, theirs, 'CORE', 10);
    expect((await giveShield(4)).until?.getTime()).toBe(until.getTime());
  });

  it('uses the defender profile for actual loot and freezes it in both sides’ reports', async () => {
    await setLevel(f.db, mine, 'CORE', 10);
    await grant(f.db, theirs, 100_000, 30_000);
    // grant sizes producers and can raise Core; this test deliberately keeps the defender at tier 3.
    await setLevel(f.db, theirs, 'CORE', 7);
    await fuelUp(f.db, mine, 100_000);
    await giveUnits(f.db, mine, { DART: 10, COURIER: 300 });
    const run = await launchAttack(f.db, mine, theirs, { DART: 10, COURIER: 300 }, f.clock);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, run.missionId));
    f.clock.set(settledAt(mission!.arriveAt));
    const before = await f.db.transaction(tx => planetView(tx, theirs, f.clock));
    const [rawBefore] = await f.db.select().from(planets).where(eq(planets.id, theirs));
    await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
    const [row] = await f.db.select().from(battleReports).where(eq(battleReports.missionId, run.missionId));
    expect(row!.grade).toBe('DECISIVE');
    expect(row!.cargoLimited).toBe(false);
    expect(row!.loot.alloy).toBe(
      Math.floor(Math.max(0, rawBefore!.alloy - before.planet.vaultCapacity.alloy) * 0.25)
      + Math.floor(rawBefore!.bufferAlloy * 0.15),
    );
    expect(row).toHaveProperty('pvpBalance', pvpBalanceForTier(3));
    await setLevel(f.db, theirs, 'CORE', 10);
    for (const id of [me, them]) {
      const reports = await f.db.transaction(tx => readBattleReports(tx, id));
      const report = reportsSchema.parse(reports).reports.find(r => r.id === row!.id);
      expect(report).toHaveProperty('pvpBalance', pvpBalanceForTier(3));
    }
    const [after] = await f.db.select().from(planets).where(and(eq(planets.id, theirs), eq(planets.controllerPlayerId, them)));
    const remaining = rawBefore!.alloy - Math.floor(Math.max(0, rawBefore!.alloy - before.planet.vaultCapacity.alloy) * 0.25);
    expect(after!.alloy).toBeCloseTo(remaining, 9);
  });

  it.each([7, 10])('the probe uses the commander’s highest Core %i across their worlds', async peak => {
    const colony = f.planetIds[2]!;
    await f.db.update(planets).set({ controllerPlayerId: them, kind: 'COLONY' }).where(eq(planets.id, colony));
    await setLevel(f.db, colony, 'CORE', peak);
    await setLevel(f.db, mine, 'SHIPYARD', 4);
    await grant(f.db, theirs, 20_000, 5_000);
    await setLevel(f.db, theirs, 'CORE', 7);
    const scout = await launchProbe(f.db, mine, theirs, f.clock);
    f.clock.set(scout.arriveAt);
    await new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' })).tick();
    const view = await f.db.transaction(tx => planetView(tx, theirs, f.clock));
    const p = view.planet;
    const [raw] = await f.db.select().from(planets).where(eq(planets.id, theirs));
    const balance = pvpBalanceForTier(peak === 7 ? 3 : 4);
    const expected = computeLoot(
      { alloy: raw!.alloy, crystal: raw!.crystal, deuterium: raw!.deuterium },
      { alloy: raw!.bufferAlloy, crystal: raw!.bufferCrystal, deuterium: raw!.bufferDeuterium },
      p.vaultCapacity, 'DECISIVE', Number.MAX_SAFE_INTEGER, balance,
    );
    const total = expected.alloy + expected.crystal + expected.deuterium;
    const [report] = await f.db.select().from(probeReports).where(eq(probeReports.missionId, scout.missionId));
    expect(report!.accuracy).toBe(1);
    expect(report!.stock.low).toBeLessThanOrEqual(total);
    expect(report!.stock.high).toBeGreaterThanOrEqual(total);
    expect(view.pvpBalance).toEqual(balance);
  });

});
