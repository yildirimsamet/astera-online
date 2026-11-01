import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { commanderTransfers, legacyAwards, playerResearch, players, seasonResults, seasons } from '../src/db/schema.js';
import { RESEARCH_MAX_LEVEL, RESEARCH_PROJECT_IDS } from '@astera/rules';
import { emptySeasonStats } from '../src/services/seasonArchive.js';
import { importLegacyArchive, backfillLegacyBatch, preserveLegacySeasonEvents } from '../src/services/legacyArchive.js';
import { legacyProgress, recordLegacyActivity } from '../src/services/legacy.js';
import { recordLegacyMonumentInterval, refreshLegacyAwards } from '../src/services/legacy.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { recordLegacyFact } from '../src/services/legacy.js';
import { wipeAllServers } from '../src/services/servers.js';
import { ensureWaitingSeason } from '../src/services/waitingServers.js';

let f: Fixture;
beforeEach(async () => { f = await seedWorld(1, 7331); });
afterAll(async () => { await (await testDb()).close(); });

async function archive(days: number) {
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  const closedAt = new Date(season!.startsAt.getTime() + days * 86400000);
  const stats = emptySeasonStats();
  stats.competition.shipsBuiltByHull = { DART: 1_000 };
  stats.competition.shipsBuilt = 1_000;
  // Runs do not prove DISTINCT rocks: this total must never earn asteroid trophies.
  stats.exploration.asteroidRuns = 100;
  await f.db.insert(seasonResults).values({ accountId: f.accountIds[0]!, seasonId: f.seasonId,
    cycleId: season!.cycleId, finalRank: 1, dominion: 100, honorRank: 2, honorScore: 50,
    title: 'Commander', recap: { commanderName: 'Tester0', planetName: 'World', battles: 1,
      attacks: 1, defences: 0, rival: null, biggestRaid: null }, stats, statsVersion: 1, createdAt: closedAt });
  await f.db.update(seasons).set({ status: 'frozen', closedAt, endReason: 'FORCED_WIPE' }).where(eq(seasons.id, f.seasonId));
  f.clock.set(closedAt);
}

it('restores provable awards and separate ladders idempotently, without inventing missing metrics or dates', async () => {
  await archive(12);
  const run = () => f.db.transaction(tx => importLegacyArchive(tx, f.seasonId, f.clock.now()));
  await run();
  await run();
  const rows = await f.db.select().from(legacyAwards);
  expect(rows.filter(row => row.definitionId === 'shipwright-dart').map(row => row.tier).sort()).toEqual([1, 2]);
  expect(rows.find(row => row.definitionId === 'shipwright-dart')?.earnedAt).toBeNull();
  expect(rows.find(row => row.definitionId === 'honor-podium')?.tier).toBe(2);
  expect(rows.find(row => row.definitionId === 'dominion-podium')?.tier).toBe(1);
  expect((await legacyProgress(f.db, f.accountIds[0]!, f.clock.now())).find(row => row.id === 'asteroid-hunter')?.progress).toBe(0);
  expect(rows.find(row => row.definitionId === 'loyal-commander')).toBeUndefined();
});

it('ignores all history from a season that closed before twelve days', async () => {
  await archive(11);
  await f.db.transaction(tx => importLegacyArchive(tx, f.seasonId, f.clock.now()));
  expect(await f.db.select().from(legacyAwards)).toHaveLength(0);
});

it('recognises an archived participation receipt even when old action statistics are missing', async () => {
  await archive(12);
  await f.db.update(seasonResults).set({ stats: null,
    recap: { commanderName: 'Tester0', planetName: 'World', battles: 0, attacks: 0, defences: 0, rival: null, biggestRaid: null } });
  await f.db.transaction(tx => importLegacyArchive(tx, f.seasonId, f.clock.now()));
  expect((await f.db.select().from(legacyAwards)).filter(row => row.definitionId === 'season-memento')).toHaveLength(1);
  expect((await f.db.select().from(legacyAwards)).find(row => row.definitionId === 'year-of-service'))
    .toMatchObject({ edition: 'year:2026', earnedAt: null });
});

it('does not attribute a mixed main/waiting production snapshot to a main galaxy', async () => {
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await archive(12);
  const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
  await f.db.insert(commanderTransfers).values({ accountId: f.accountIds[0]!, playerId: f.playerIds[0]!,
    cycleId: season!.cycleId, sourceSeasonId: f.seasonId, targetSeasonId: waiting!.id,
    fromVersion: 0, toVersion: 1, direction: 'OUT', worlds: [], committedAt: f.clock.now() });
  await f.db.transaction(tx => importLegacyArchive(tx, f.seasonId, f.clock.now()));
  expect((await f.db.select().from(legacyAwards)).filter(row => row.definitionId === 'shipwright-dart')).toEqual([]);
});

it('restores a proven full research ladder at its actual last completion, once', async () => {
  await archive(12);
  const completedAt = new Date(f.clock.now().getTime() - 86400000);
  await f.db.insert(playerResearch).values(RESEARCH_PROJECT_IDS.map(projectId => ({
    playerId: f.playerIds[0]!, projectId, level: RESEARCH_MAX_LEVEL[projectId], completedAt,
  })));
  const run = () => f.db.transaction(tx => preserveLegacySeasonEvents(tx, f.seasonId, f.clock.now()));
  await run(); await run();
  const rows = (await f.db.select().from(legacyAwards)).filter(row => row.definitionId === 'science-horizon');
  expect(rows).toHaveLength(1);
  expect(rows[0]?.earnedAt).toEqual(completedAt);
});

it('previews a bounded historical batch without writing and applies the same awards idempotently', async () => {
  await archive(12);
  const preview = await backfillLegacyBatch(f.db, { at: f.clock.now(), limit: 1, apply: false });
  expect(preview.seasons).toBe(1);
  expect(preview.awardsAdded).toBeGreaterThan(0);
  expect(await f.db.select().from(legacyAwards)).toHaveLength(0);
  const applied = await backfillLegacyBatch(f.db, { at: f.clock.now(), limit: 1, apply: true });
  expect(applied.awardsAdded).toBe(preview.awardsAdded);
  expect((await backfillLegacyBatch(f.db, { at: f.clock.now(), limit: 1, apply: true })).awardsAdded).toBe(0);
});

it('includes proven commanders absent from the season-result roster in preview and apply', async () => {
  await archive(12);
  await f.db.delete(seasonResults);
  await f.db.transaction(tx => recordLegacyMonumentInterval(tx, { accountId: f.accountIds[0]!, seasonId: f.seasonId,
    sourceKey: 'old:hold', from: new Date(f.clock.now().getTime() - 3600000), to: f.clock.now() }));
  await f.db.delete(legacyAwards);
  const preview = await backfillLegacyBatch(f.db, { at: f.clock.now(), limit: 1, apply: false });
  expect(preview.awardsAdded).toBe(1);
  expect(await f.db.select().from(legacyAwards)).toEqual([]);
  const applied = await backfillLegacyBatch(f.db, { at: f.clock.now(), limit: 1, apply: true });
  expect(applied.awardsAdded).toBe(1);
  await f.db.transaction(tx => refreshLegacyAwards(tx, f.accountIds[0]!, f.clock.now()));
  expect(await f.db.select().from(legacyAwards)).toHaveLength(1);
});

it('seals legacy before wiping worlds, keeps every tier and makes redelivery harmless', async () => {
  f.clock.advance(12 * 24 * 60);
  await f.db.transaction(tx => recordLegacyFact(tx, { accountId: f.accountIds[0]!, seasonId: f.seasonId,
    metric: 'PROBES', sourceKey: 'test:probes', amount: 100, at: f.clock.now() }));
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  expect((await f.db.select().from(legacyAwards)).filter(row => row.definitionId === 'season-memento')).toHaveLength(1);
  await wipeAllServers(f.db, f.clock);
  const rows = await f.db.select().from(legacyAwards);
  expect(rows.filter(row => row.definitionId === 'deep-sight')).toHaveLength(2);
  expect(rows.filter(row => row.definitionId === 'season-memento')).toHaveLength(1);
});

it('revokes early closed season contributions before deleting world rows', async () => {
  f.clock.advance(24 * 60);
  await f.db.transaction(tx => recordLegacyFact(tx, { accountId: f.accountIds[0]!, seasonId: f.seasonId,
    metric: 'PROBES', sourceKey: 'test:probes', amount: 100, at: f.clock.now() }));
  expect((await f.db.select().from(legacyAwards)).filter(row => row.definitionId === 'deep-sight' && row.revokedAt === null)).toHaveLength(2);
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  expect((await f.db.select().from(legacyAwards)).filter(row => row.revokedAt === null)).toHaveLength(0);
});

it('reevaluates activity-only commanders who left the main galaxy before an early closure', async () => {
  await f.db.transaction(tx => recordLegacyActivity(tx, f.playerIds[0]!, f.clock.now()));
  const waiting = await ensureWaitingSeason(f.db, f.seasonId, f.clock);
  await f.db.update(players).set({ seasonId: waiting!.id }).where(eq(players.id, f.playerIds[0]!));
  f.clock.advance(24 * 60);
  await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
  expect((await f.db.select().from(legacyAwards)).filter(row => row.revokedAt === null)).toEqual([]);
});
