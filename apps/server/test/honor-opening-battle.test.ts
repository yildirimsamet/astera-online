import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
import { battleReports, botProfiles, honorCommitments, honorEvents, honorSeasons, honorTotals, missions, scheduledEvents, seasons } from '../src/db/schema.js';
import { openHonorRanking } from '../src/services/honorActivation.js';
import { launchAttack } from '../src/services/mission.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { readBattleReports } from '../src/services/reports.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { fuelUp, giveUnits, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

describe('real raids crossing the announced Honor boundary', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 24771);
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion });
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 12);
      await fuelUp(f.db, id, 50_000);
      await giveUnits(f.db, id, { DART: 80 });
    }
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
    f.clock.advance(2 * 24 * 60);
  });
  afterAll(async () => { await (await testDb()).close(); });
  const open = () => openHonorRanking(f.db, { seasonId: f.seasonId, clock: f.clock, apply: true });
  const launch = () => launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 20 }, f.clock);
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

  it('scores a raid on a server-run commander exactly like a raid on a person', async () => {
    await f.db.insert(botProfiles).values({ accountId: f.accountIds[1]!, ordinal: 1, persona: 'RAIDER',
      nextActionAt: f.clock.now(), createdAt: f.clock.now() });
    await open(); const raid = await launch(); await land(raid);
    const [entry] = await f.db.select().from(honorEvents);
    expect(entry!.evidence.eligible).toBe(true);
    expect(entry!.outcome.attack.total).not.toBe(0);
    const honor = (await readBattleReports(f.db, f.playerIds[0]!)).reports.find(report => report.kind === 'BATTLE')?.honor;
    expect(honor).toMatchObject({ delta: entry!.outcome.attack.total });
    expect(honor?.breakdown).toBeDefined();
    expect(honor?.reason).not.toBe('INELIGIBLE');
  });

  it('a fight between server-run commanders alone produces no Honor', async () => {
    await f.db.insert(botProfiles).values(f.accountIds.map((accountId, index) => ({ accountId, ordinal: index + 1,
      persona: 'RAIDER', nextActionAt: f.clock.now(), createdAt: f.clock.now() })));
    await open(); const raid = await launch(); await land(raid);
    const [entry] = await f.db.select().from(honorEvents);
    expect(entry!.evidence.eligible).toBe(false);
    expect(entry!.outcome.attack.total).toBe(0);
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
});
