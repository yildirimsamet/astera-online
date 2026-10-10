import { and, eq } from 'drizzle-orm';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { segmentsExposureHp } from '@astera/rules';
import { clanWarOperations, clans, hpRadiationSources, monumentProbes, monuments, monumentWaves, scheduledEvents, seasons, shards } from '../src/db/schema.js';
import { adoptMonumentLayout } from '../src/services/monumentAdoption.js';
import { sendMonument } from '../src/services/monument.js';
import { hpSourcesForSeason } from '../src/services/radiationSources.js';
import { HANDLERS } from '../src/worker/handlers.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => {
  f = await seedWorld(1, 20261011);
  await f.db.update(seasons).set({ rulesetVersion: 16 }).where(eq(seasons.id, f.seasonId));
  const rows = await f.db.insert(monuments).values(Array.from({ length: 5 }, (_, index) => ({
    seasonId: f.seasonId, ordinal: index + 1, x: 6000 * Math.cos(index * 2 * Math.PI / 5),
    y: 6000 * Math.sin(index * 2 * Math.PI / 5), z: 0, capacity: 7270,
    productionPerMinute: 10, garrison: { LEVIATHAN: 10 }, garrisonTemplate: { LEVIATHAN: 10 }, settledAt: f.clock.now(),
  }))).returning();
  await f.db.insert(hpRadiationSources).values(rows.map(row => ({ seasonId: f.seasonId, anchorKind: 'MONUMENT' as const,
    anchorId: row.id, x: row.x, y: row.y, z: row.z, radius: 1000, intensityHpPerMinute: 4,
    mode: 'EMIT' as const, activeFrom: f.clock.now() })));
  f.clock.advance(1);
});
afterAll(async () => { await (await testDb()).close(); });
const adopt = (apply = true) => adoptMonumentLayout(f.db, { seasonId: f.seasonId, clock: f.clock, apply });

describe('idle live-season monument adoption', () => {
  it('takes the cutover time after the season barrier opens, without backdating clouds while it waits', async () => {
    let releaseBarrier = (): void => { throw new Error('Barrier not acquired'); };
    const barrier = new Promise<void>(resolve => { releaseBarrier = resolve; });
    let acquired = (): void => { throw new Error('Barrier not acquired'); };
    const ready = new Promise<void>(resolve => { acquired = resolve; });
    const blocker = f.db.transaction(async tx => {
      await tx.select().from(seasons).where(eq(seasons.id, f.seasonId)).for('share');
      acquired();
      await barrier;
    });
    await ready;
    const requestedAt = f.clock.now();
    const waiting = adopt();
    f.clock.advance(5);
    releaseBarrier();
    await blocker;
    expect(await waiting).toMatchObject({ applied: true });
    const sources = await f.db.select().from(hpRadiationSources);
    expect(sources.filter(row => row.activeUntil === null).map(row => row.activeFrom))
      .toEqual(Array(8).fill(f.clock.now()));
    expect(sources.filter(row => row.activeUntil !== null).map(row => row.activeUntil))
      .toEqual(Array(5).fill(f.clock.now()));
    expect(requestedAt).not.toEqual(f.clock.now());
  });

  it('offers a named-shard operator preview that does not alter the live deal', async () => {
    await f.db.update(seasons).set({ endsAt: new Date(Date.now() + 86_400_000) }).where(eq(seasons.id, f.seasonId));
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const [shard] = await f.db.select().from(shards).where(eq(shards.id, season!.shardId));
    const { stdout } = await promisify(execFile)(process.execPath,
      ['--import', 'tsx', 'src/cli/season.ts', 'adopt-monuments', '--shard', shard!.code],
      { env: { ...process.env, NODE_ENV: 'test' } });
    expect(stdout).toContain('READY');
    expect(stdout).toContain('Nothing was written');
    expect(await f.db.select().from(monuments)).toHaveLength(5);
  });

  it('previews without changing the existing five targets or their clouds', async () => {
    const before = await f.db.select().from(monuments);
    expect(await adopt(false)).toMatchObject({ status: 'READY', applied: false });
    expect(await f.db.select().from(monuments)).toEqual(before);
    expect((await f.db.select().from(hpRadiationSources)).every(row => row.activeUntil === null)).toBe(true);
  });

  it('preserves existing target IDs, adds three, and changes only future HP cloud windows', async () => {
    const before = await f.db.select().from(monuments).orderBy(monuments.ordinal);
    const clouds = await f.db.select().from(hpRadiationSources);
    expect(await adopt()).toMatchObject({ status: 'READY', applied: true });
    const rows = await f.db.select().from(monuments).orderBy(monuments.ordinal);
    expect(rows).toHaveLength(8);
    expect(rows.slice(0, 5).map(row => row.id)).toEqual(before.map(row => row.id));
    expect(rows.filter(row => row.difficulty === 'EASY')).toHaveLength(4);
    expect(rows.filter(row => row.difficulty === 'HARD')).toHaveLength(4);
    for (const row of rows) {
      expect(Math.hypot(row.x, row.y, row.z)).toBeCloseTo(6000);
      expect(row).toMatchObject(row.difficulty === 'EASY'
        ? { capacity: 1550, productionPerMinute: 3, garrison: { STRONGHOLD: 3 }, garrisonTemplate: { STRONGHOLD: 3 } }
        : { capacity: 7270, productionPerMinute: 8, garrison: { LEVIATHAN: 10 }, garrisonTemplate: { LEVIATHAN: 10 } });
    }
    const sources = await f.db.select().from(hpRadiationSources);
    expect(sources).toHaveLength(13);
    for (const old of clouds) expect(sources.find(row => row.id === old.id)).toEqual({ ...old, activeUntil: f.clock.now() });
    const current = sources.filter(row => row.activeUntil === null);
    expect(current).toHaveLength(8);
    expect(current.every(row => row.activeFrom.getTime() === f.clock.now().getTime())).toBe(true);
    expect(current.filter(row => row.intensityHpPerMinute === 2)).toHaveLength(4);
    expect(current.filter(row => row.intensityHpPerMinute === 5)).toHaveLength(4);
    expect(await adopt()).toMatchObject({ status: 'ALREADY_UPDATED', applied: false });
    expect(await f.db.select().from(hpRadiationSources)).toHaveLength(13);
  });

  it('refuses moving an unheld target that still has a fleet inbound, writing nothing', async () => {
    const [target] = await f.db.select().from(monuments).orderBy(monuments.ordinal);
    await grant(f.db, f.planetIds[0]!, 10000, 10000);
    await setLevel(f.db, f.planetIds[0]!, 'CORE', 9);
    await giveUnits(f.db, f.planetIds[0]!, { DART: 2 });
    await f.db.transaction(tx => sendMonument(tx, { senderPlayerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!,
      monumentId: target!.id, fleet: { DART: 2 }, purpose: 'ATTACK', acknowledgeShieldLoss: true, clock: f.clock }));
    const before = await f.db.select().from(monuments).orderBy(monuments.ordinal);
    expect(await adopt()).toMatchObject({ status: 'BUSY', applied: false, fleets: 1 });
    expect(await f.db.select().from(monuments).orderBy(monuments.ordinal)).toEqual(before);
    expect((await f.db.select().from(monumentWaves))[0]?.status).toBe('OUTBOUND');
    expect((await f.db.select().from(hpRadiationSources)).every(row => row.activeUntil === null)).toBe(true);
  });

  it('refuses an occupied target even if there is no wave row, and refuses closed seasons', async () => {
    await f.db.update(monuments).set({ controllerPlayerId: f.playerIds[0]! }).where(and(eq(monuments.seasonId, f.seasonId), eq(monuments.ordinal, 1)));
    expect(await adopt()).toMatchObject({ status: 'BUSY', applied: false, held: 1 });
    await f.db.update(seasons).set({ status: 'frozen' }).where(eq(seasons.id, f.seasonId));
    await expect(adopt()).rejects.toMatchObject({ code: 'SEASON_FROZEN' });
  });

  it('waits for probes and clan preparation even without any monument fleet', async () => {
    const [target] = await f.db.select().from(monuments).orderBy(monuments.ordinal);
    const [probe] = await f.db.insert(monumentProbes).values({ seasonId: f.seasonId, monumentId: target!.id,
      playerId: f.playerIds[0]!, originPlanetId: f.planetIds[0]!, outboundRoute: [],
      departAt: f.clock.now(), arriveAt: new Date(f.clock.now().getTime() + 60_000) }).returning();
    expect(await adopt()).toMatchObject({ status: 'BUSY', applied: false, probes: 1, fleets: 0 });
    await f.db.update(monumentProbes).set({ status: 'LOST' }).where(eq(monumentProbes.id, probe!.id));
    const [clan] = await f.db.insert(clans).values({ seasonId: f.seasonId, name: 'Idle test', nameKey: 'idle test',
      tag: 'ID', createdAt: f.clock.now() }).returning();
    await f.db.insert(clanWarOperations).values({ seasonId: f.seasonId, clanId: clan!.id, clanName: clan!.name,
      clanTag: clan!.tag, leaderPlayerId: f.playerIds[0]!, stagingPlanetId: f.planetIds[0]!, targetKind: 'MONUMENT',
      targetMonumentId: target!.id, targetPlanetName: 'Monument 1', targetX: target!.x, targetY: target!.y, targetZ: target!.z,
      createdAt: f.clock.now(), expiresAt: new Date(f.clock.now().getTime() + 86_400_000) });
    expect(await adopt()).toMatchObject({ status: 'BUSY', applied: false, operations: 1, probes: 0, fleets: 0 });
    expect(await f.db.select().from(monuments)).toHaveLength(5);
  });

  it('serializes two operator applications without duplicate monuments or clouds', async () => {
    const results = await Promise.all([adopt(), adopt()]);
    expect(results.filter(result => result.applied)).toHaveLength(1);
    expect(results.filter(result => result.status === 'ALREADY_UPDATED')).toHaveLength(1);
    expect(await f.db.select().from(monuments)).toHaveLength(8);
    expect(await f.db.select().from(hpRadiationSources)).toHaveLength(13);
  });

  it('keeps closed source history and unrelated clouds while settling the old/new boundary exactly once', async () => {
    const [old] = await f.db.select().from(monuments).orderBy(monuments.ordinal);
    const [closed] = await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'MONUMENT', anchorId: old!.id,
      x: old!.x, y: old!.y, z: old!.z, radius: 1000, intensityHpPerMinute: 1, mode: 'EMIT',
      activeFrom: new Date(f.clock.now().getTime() - 60_000), activeUntil: new Date(f.clock.now().getTime() - 30_000) }).returning();
    const [other] = await f.db.insert(hpRadiationSources).values({ seasonId: f.seasonId, anchorKind: 'ZONE',
      x: 0, y: 0, z: 0, radius: 10, intensityHpPerMinute: 7, mode: 'EMIT', activeFrom: f.clock.now() }).returning();
    const past = [{ from: old!, to: old!, startMs: f.clock.now().getTime() - 60_000, endMs: f.clock.now().getTime() }];
    const paid = segmentsExposureHp(past, await hpSourcesForSeason(f.db, f.seasonId));
    await adopt();
    const sources = await hpSourcesForSeason(f.db, f.seasonId);
    expect(segmentsExposureHp(past, sources)).toBe(paid);
    const after = await f.db.select().from(hpRadiationSources);
    expect(after.find(row => row.id === closed!.id)).toEqual(closed);
    expect(after.find(row => row.id === other!.id)).toEqual(other);
    const [hard] = await f.db.select().from(monuments).orderBy(monuments.ordinal);
    const future = [{ from: hard!, to: hard!, startMs: f.clock.now().getTime(), endMs: f.clock.now().getTime() + 60_000 }];
    expect(segmentsExposureHp(future, sources)).toBeCloseTo(5);
    const departedCloud = [{ from: old!, to: old!, startMs: f.clock.now().getTime(), endMs: f.clock.now().getTime() + 60_000 }];
    expect(segmentsExposureHp(departedCloud, sources)).toBe(0);
  });

  it('invalidates previously claimed neutral respawn events and leaves unrelated pending work intact', async () => {
    const [old] = await f.db.select().from(monuments).orderBy(monuments.ordinal);
    const [claimed] = await f.db.insert(scheduledEvents).values({ seasonId: f.seasonId, kind: 'monument_respawn', refId: old!.id,
      status: 'processing', payload: { generation: old!.generation }, resolveAt: f.clock.now() }).returning();
    const [pending] = await f.db.insert(scheduledEvents).values({ seasonId: f.seasonId, kind: 'monument_loss', refId: old!.id,
      payload: { generation: old!.generation, scope: 'HOLD' }, resolveAt: f.clock.now() }).returning();
    const [unrelated] = await f.db.select().from(scheduledEvents).where(and(eq(scheduledEvents.seasonId, f.seasonId), eq(scheduledEvents.kind, 'season_end')));
    expect(unrelated).toBeDefined();
    await adopt();
    const rows = await f.db.select().from(monuments).orderBy(monuments.ordinal);
    await HANDLERS.monument_respawn!({ db: f.db, clock: f.clock }, claimed!);
    expect(await f.db.select().from(monuments).orderBy(monuments.ordinal)).toEqual(rows);
    const events = await f.db.select().from(scheduledEvents);
    expect(events.some(event => event.id === pending!.id)).toBe(false);
    expect(events.find(event => event.id === unrelated!.id)).toEqual(unrelated);
  });

  it('refuses a partial mixed layout without changing any target or source', async () => {
    await f.db.update(monuments).set({ difficulty: 'HARD' }).where(and(eq(monuments.seasonId, f.seasonId), eq(monuments.ordinal, 1)));
    const rows = await f.db.select().from(monuments).orderBy(monuments.ordinal);
    const sources = await f.db.select().from(hpRadiationSources);
    await expect(adopt()).rejects.toMatchObject({ code: 'MONUMENT_LAYOUT_UNSUPPORTED' });
    expect(await f.db.select().from(monuments).orderBy(monuments.ordinal)).toEqual(rows);
    expect(await f.db.select().from(hpRadiationSources)).toEqual(sources);
  });
});
