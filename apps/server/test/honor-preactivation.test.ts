import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD } from '@astera/rules';
import { battleReports, honorCommitments, honorEvents, honorSeasons, honorTotals, missions, scheduledEvents, seasons } from '../src/db/schema.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';
import { worldHonorCommitment } from '../src/services/honorCommitment.js';
import { launchAttack } from '../src/services/mission.js';
import { lockSeason } from '../src/services/planet.js';
import { honorTargetPreview } from '../src/services/honorTarget.js';
import { honorPodium } from '../src/services/honorPodium.js';
import { readHonorReceipts } from '../src/services/honorReports.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { fuelUp, giveUnits, seedWorld, setLevel, settledAt, testDb, type Fixture } from './helpers.js';

describe('Honor activation with real raids already flying', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(2, 24771);
    await f.db.update(seasons).set({ rulesetVersion: MULTI_WORLD.rulesetVersion }).where(eq(seasons.id, f.seasonId));
    for (const id of f.planetIds) {
      await setLevel(f.db, id, 'CORE', 12);
      await fuelUp(f.db, id, 50000);
      await giveUnits(f.db, id, { DART: 80 });
    }
    f.clock.advance(250);
  });
  afterAll(async () => { await (await testDb()).close(); });
  const enable = () => f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
  const launch = () => launchAttack(f.db, f.planetIds[0]!, f.planetIds[1]!, { DART: 20 }, f.clock);
  const land = async (raid: Awaited<ReturnType<typeof launchAttack>>) => {
    f.clock.set(settledAt(raid.arriveAt));
    const [event] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.refId, raid.missionId), eq(scheduledEvents.kind, 'mission_arrival')));
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
    await onMissionArrival({ db: f.db, clock: f.clock }, event!);
  };

  it.each([0, 1])('finishes an existing raid without inventing Honor, activation delay %i ms', async delay => {
    const raid = await launch();
    f.clock.set(new Date(f.clock.now().getTime() + delay));
    await enable();
    expect(await f.db.select().from(honorCommitments)).toHaveLength(0);
    await land(raid);
    expect(await f.db.select().from(battleReports).where(eq(battleReports.missionId, raid.missionId))).toHaveLength(1);
    const [mission] = await f.db.select().from(missions).where(eq(missions.id, raid.missionId));
    expect(mission?.status).toBe('resolved');
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
  });

  it('still scores an attack launched after activation at the exact same timestamp', async () => {
    await enable();
    const raid = await launch();
    await land(raid);
    expect(await f.db.select().from(honorEvents)).toHaveLength(1);
  });

  it('retrying activation cannot exempt a new attack whose commitment was lost', async () => {
    await enable();
    const raid = await launch();
    await f.db.delete(honorCommitments);
    await enable();
    await expect(land(raid)).rejects.toThrow('Missing Honor attack commitment');
    expect(await f.db.select().from(battleReports)).toHaveLength(0);
    expect(await f.db.select().from(honorEvents)).toHaveLength(0);
  });

  it('does not silently accept a nonexistent old source', async () => {
    await enable();
    await expect(f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId,
      missionId: randomUUID(), host: f.playerIds[1]!, supporters: [], adminUsernames: new Set(), observedAt: f.clock.now() })))
      .rejects.toThrow('Missing Honor attack commitment');
  });

  it('waits for the existing gameplay season lock instead of observing half a launch', async () => {
    await f.db.transaction(async gameplay => {
      await lockSeason(gameplay, f.seasonId);
      await expect(f.db.transaction(async activation => {
        await activation.execute(sql`set local lock_timeout = '100ms'`);
        await prepareHonorSeason(activation, f.seasonId, 'SHADOW', f.clock);
      })).rejects.toMatchObject({ cause: { code: '55P03' } });
      expect(await gameplay.select().from(honorSeasons)).toHaveLength(0);
    });
    await enable();
    expect(await f.db.select().from(honorSeasons)).toHaveLength(1);
  });

  it('freezes only real outgoing sources, rolls back the boundary, and never extends it on retry', async () => {
    const old = await launch();
    await expect(f.db.transaction(async tx => {
      await prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock);
      throw new Error('activation rollback');
    })).rejects.toThrow('activation rollback');
    expect(await f.db.select().from(honorSeasons)).toHaveLength(0);
    await enable();
    const [before] = await f.db.select().from(honorSeasons);
    expect(before?.legacySources).toEqual([`WORLD:${old.missionId}`]);
    // A second raid from the same owner to the same world is forbidden by the
    // game. Use the defender's genuine counter-raid for the new launch.
    const next = await launchAttack(f.db, f.planetIds[1]!, f.planetIds[0]!, { DART: 20 }, f.clock);
    await enable();
    const [after] = await f.db.select().from(honorSeasons);
    expect(after?.legacySources).toEqual(before?.legacySources);
    expect(after?.legacySources).not.toContain(`WORLD:${next.missionId}`);
    await expect(f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId,
      missionId: old.missionId, source: 'CLAN_WAR', host: f.playerIds[1]!, supporters: [], adminUsernames: new Set() })))
      .rejects.toThrow('Missing Honor attack commitment');
  });

  it('records a real post-activation battle in a running shadow season without exposing its score or allowing ranked activation', async () => {
    await expect(f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock)))
      .rejects.toThrow('Honor must be announced before the season starts');
    await enable();
    expect(await honorTargetPreview(f.db, f.playerIds[0]!, f.planetIds[1]!, f.clock, new Set()))
      .toEqual({ enabled: false });
    const raid = await launch();
    await land(raid);
    const [entry] = await f.db.select().from(honorEvents);
    expect(entry?.sourceId).toBe(raid.missionId);
    expect(entry?.outcome.attack.total).not.toBe(0);
    expect(await honorPodium(f.db, f.seasonId, new Set()))
      .toMatchObject({ active: false });
    expect(await f.db.transaction(tx => readHonorReceipts(tx, f.playerIds[0]!, [{ source: 'WORLD', id: raid.missionId }])))
      .toEqual(new Map());
    await expect(f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock)))
      .rejects.toThrow('Honor must be announced before the season starts');
  });

  it('migration repairs genuinely older pending flights without exempting a new corrupt commitment', async () => {
    const old = await launch();
    f.clock.set(new Date(f.clock.now().getTime() + 1));
    await enable();
    const next = await launchAttack(f.db, f.planetIds[1]!, f.planetIds[0]!, { DART: 20 }, f.clock);
    // Recreate the pre-fix config; the migration must prove its own boundary.
    await f.db.update(honorSeasons).set({ legacySources: [] });
    await f.db.delete(honorCommitments);
    const repair = readFileSync(new URL('../drizzle/0164_honor_legacy_sources.sql', import.meta.url), 'utf8').split('--> statement-breakpoint')[1]!;
    await f.db.execute(sql.raw(repair));
    const [config] = await f.db.select().from(honorSeasons);
    expect(config?.legacySources).toEqual([`WORLD:${old.missionId}`]);
    expect(await f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId,
      missionId: old.missionId, host: f.playerIds[1]!, supporters: [], adminUsernames: new Set() }))).toBeNull();
    await expect(f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId,
      missionId: next.missionId, host: f.playerIds[0]!, supporters: [], adminUsernames: new Set() })))
      .rejects.toThrow('Missing Honor attack commitment');
    await land(old);
  });
});
