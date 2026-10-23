import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
import { battleReports, honorCommitments, honorEvents, honorSeasons, honorTotals, missions, players, scheduledEvents, seasons, seasonResults, seasonRewardEntitlements } from '../src/db/schema.js';
import { openHonorRanking } from '../src/services/honorActivation.js';
import { launchAttack } from '../src/services/mission.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { readBattleReports } from '../src/services/reports.js';
import { forceSeasonEnd, onMissionArrival, onSeasonRollover } from '../src/worker/handlers.js';
import { enableHonorBenefits } from '../src/services/honorBenefits.js';
import { joinSeason } from '../src/services/player.js';
import { fuelUp, giveResearch, giveUnits, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

// Release gate: real v4 cutover must work before the policy becomes selectable.
// Frozen v3 coverage remains in honor-opening-battle.test.ts.
describe('v4 release rehearsal: real raids across a clean ranked opening', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 24771);
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion });
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 12);
      await fuelUp(f.db, id, 50_000);
      await giveUnits(f.db, id, { DART: 80 });
    }
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock, 4));
    f.clock.advance(2 * 24 * 60);
  });
  afterAll(async () => { await (await testDb()).close(); });
  const open = () => openHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true });
  // Unequal real fleets exercise the cutover with a non-zero combat award. The
  // closing/reward case below separately guarantees positive ranked Honor.
  const launch = () => launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 40 }, f.clock);
  const land = async (raid: Awaited<ReturnType<typeof launch>>) => {
    f.clock.set(settledAt(raid.arriveAt));
    const [event] = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.refId, raid.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
  };

  it.each([0, 1])('completes an already committed flight without ranked points, opening delay %i ms', async delay => {
    const raid = await launch();
    expect(await f.db.select().from(honorCommitments)).toHaveLength(1);
    f.clock.set(new Date(f.clock.now().getTime() + delay));
    await open(); await land(raid);
    expect(await f.db.select().from(battleReports)).toHaveLength(1);
    expect((await f.db.select().from(missions).where(eq(missions.id, raid.missionId)))[0]!.status).toBe('resolved');
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
    const reports = await readBattleReports(f.db, f.playerIds[0]!);
    expect(reports.reports.find(report => report.kind === 'BATTLE')?.honor).toBeNull();
  });

  it('scores a genuine raid sent immediately after opening at the identical millisecond', async () => {
    await open(); const raid = await launch(); await land(raid);
    const [entry] = await f.db.select().from(honorEvents);
    expect(entry).toMatchObject({ ranked: true, source: 'WORLD', sourceId: raid.missionId });
    expect(entry!.outcome.attack.total).not.toBe(0);
    const reports = await readBattleReports(f.db, f.playerIds[0]!);
    expect(reports.reports.find(report => report.kind === 'BATTLE')?.honor)
      .toMatchObject({ delta: entry!.outcome.attack.total });
  });

  it('keeps finished shadow reports hidden after opening and resets their points', async () => {
    const raid = await launch(); await land(raid);
    const [trial] = await f.db.select().from(honorEvents);
    expect(trial!.outcome.attack.total).not.toBe(0);
    expect(trial!.ranked).toBe(false);
    await open();
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
    expect(await f.db.select().from(honorEvents)).toEqual([trial]);
    expect((await readBattleReports(f.db, f.playerIds[0]!)).reports.find(report => report.kind === 'BATTLE')?.honor).toBeNull();
  });

  it('a retry cannot turn a new corrupt flight into a pre-opening exception', async () => {
    await open(); const raid = await launch();
    await f.db.delete(honorCommitments);
    await open();
    expect((await f.db.select().from(honorSeasons))[0]!.legacySources).not.toContain(`WORLD:${raid.missionId}`);
    await expect(land(raid)).rejects.toThrow('Missing Honor attack commitment');
    expect(await f.db.select().from(battleReports)).toHaveLength(0);
  });
  it('previews v4 opening without writing and preserves immutable policy evidence on apply', async () => {
    const before = await f.db.select().from(honorSeasons);
    const points = await f.db.select().from(honorTotals);
    expect(await openHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply: false }))
      .toMatchObject({ applied: false, version: 4 });
    expect(await f.db.select().from(honorSeasons)).toEqual(before);
    expect(await f.db.select().from(honorTotals)).toEqual(points);
    await open();
    const [after] = await f.db.select().from(honorSeasons);
    expect(after).toMatchObject({ version: 4, mode: 'ACTIVE', createdAt: before[0]!.createdAt,
      catalogue: before[0]!.catalogue, shieldCatalogue: before[0]!.shieldCatalogue,
      strategicCatalogue: before[0]!.strategicCatalogue, benefitsVersion: null, rankedAt: f.clock.now() });
    expect(await f.db.select().from(honorTotals)).toEqual([]);
  });

  it('closes a real ranked v4 result, grants rewards once and carries the program into playable successors', async () => {
    await open();
    await enableHonorBenefits(f.db, f.seasonId, f.clock, true);
    // The reward test needs a positive rank across random targets, rather than
    // assuming an outnumbered raid always earns positive Honor. Equal full wings
    // and researched attack/armour keep physical enemy losses above own losses.
    await giveResearch(f.db, f.planetIds[0]!, 'SHIP_POWER', 5);
    await giveResearch(f.db, f.planetIds[0]!, 'SHIP_ARMOR', 5);
    const raid = await launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 80 }, f.clock);
    await land(raid);
    const before = await f.db.select().from(honorTotals).orderBy(honorTotals.playerId);
    expect(before.some(row => row.score > 0)).toBe(true);
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    const results = await f.db.select().from(seasonResults).where(eq(seasonResults.seasonId, f.seasonId)).orderBy(seasonResults.accountId);
    for (const total of before) {
      const index = f.playerIds.indexOf(total.playerId);
      expect(results.find(row => row.accountId === f.accountIds[index])?.honorScore).toBe(total.score);
    }
    const rewards = await f.db.select().from(seasonRewardEntitlements);
    expect(rewards.some(row => row.ranking === 'HONOR')).toBe(true);
    expect(new Set(rewards.map(row => row.accountId)).size).toBe(rewards.length);
    const [rollover] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.seasonId, f.seasonId), eq(scheduledEvents.kind, 'season_rollover')));
    if (!rollover) throw new Error('Missing successor event');
    f.clock.set(rollover.resolveAt);
    await onSeasonRollover({ db: f.db, clock: f.clock }, rollover);
    const next = await f.db.select().from(seasons).where(eq(seasons.status, 'live'));
    const configs = await f.db.select().from(honorSeasons);
    expect(next.length).toBeGreaterThan(0);
    expect(next.every(row => configs.some(config => config.seasonId === row.id && config.mode === 'ACTIVE' && config.version === 4 && config.benefitsVersion === 1))).toBe(true);
    await joinSeason(f.db, f.accountIds[0]!, next[0]!.id, f.clock);
    expect((await f.db.select().from(players))[0]).toMatchObject({ vacationUntil: null });
    expect(await f.db.select().from(honorTotals).where(eq(honorTotals.seasonId, next[0]!.id))).toHaveLength(0);
    // Historical totals intentionally survive the commander wipe as audit evidence.
    expect(await f.db.select().from(honorTotals).where(eq(honorTotals.seasonId, f.seasonId)).orderBy(honorTotals.playerId)).toEqual(before);
    expect(await f.db.select().from(seasonResults).where(eq(seasonResults.seasonId, f.seasonId)).orderBy(seasonResults.accountId)).toEqual(results);
  });

});
