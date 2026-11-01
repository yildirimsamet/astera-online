import { and, asc, count, eq, gt, inArray, sql } from 'drizzle-orm';
import { HULLS, fleetEntries, fleetCount, legacyResearchMastered, legacySeasonEligible, type LegacyMetric, type ResearchProjectId } from '@astera/rules';
import type { Db, Tx } from '../db/client.js';
import { battleReports, clanWarParticipantResults, commanderTransfers, miningRuns, missions, pirateRaids,
  monumentProbes, monumentWaves, monumentBattleParticipants, playerResearch, planets, seasonTelemetrySegments,
  legacyActivityDays, legacyAwards, legacyFacts, players, radiationBombFlights, seasonResults, seasons, shards, strategicInterceptions } from '../db/schema.js';
import { deferLegacyRefresh, recordLegacyFact, recordLegacyMonumentInterval, refreshLegacyAwards, registerLegacyParticipation } from './legacy.js';

/** Sealed aggregate fields prove only their own metric. Missing per-target history stays unknown. */
export async function importLegacyArchive(tx: Tx, seasonId: string, at: Date): Promise<void> {
  const [season] = await tx.select({ season: seasons, role: shards.role }).from(seasons)
    .innerJoin(shards, eq(shards.id, seasons.shardId)).where(eq(seasons.id, seasonId));
  if (season?.role !== 'MAIN' || season.season.status === 'live' || season.season.status === 'pending') return;
  const rows = await tx.select().from(seasonResults).where(eq(seasonResults.seasonId, seasonId));
  const movers = new Set((await tx.select({ accountId: commanderTransfers.accountId }).from(commanderTransfers)
    .where(eq(commanderTransfers.cycleId, season.season.cycleId))).map(row => row.accountId));
  for (const row of rows) {
    const closedAt = new Date(Math.min((season.season.closedAt ?? row.createdAt).getTime(), season.season.endsAt.getTime()));
    if (!legacySeasonEligible(season.season.startsAt.getTime(), Math.min(closedAt.getTime(), season.season.endsAt.getTime()))) continue;
    // Existing archive stats are cycle-wide and include production in Silent Space.
    for (const [hull, amount] of fleetEntries(movers.has(row.accountId) ? {} : row.stats?.competition.shipsBuiltByHull ?? {})) {
      if (amount <= 0 || HULLS[hull].ground) continue;
      await recordLegacyFact(tx, { accountId: row.accountId, seasonId, metric: `SHIPS_BUILT:${hull}`,
        sourceKey: `archive:ships:${hull}`, origin: 'ARCHIVE', dateKnown: false, amount, at: closedAt });
    }
    deferLegacyRefresh(tx, row.accountId, at);
  }
}

interface BackfillResult { seasons: number; awardsAdded: number; nextCursor: string | null }
class PreviewComplete extends Error {
  constructor(readonly result: BackfillResult) { super('Legacy preview complete'); }
}

/** Each page is one transaction; preview deliberately rolls back facts, profiles and awards. */
export async function backfillLegacyBatch(db: Db, input: {
  at: Date; limit: number; apply: boolean; cursor?: string;
}): Promise<BackfillResult> {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 24) throw new RangeError('Legacy batch limit must be 1–24');
  try {
    return await db.transaction(async tx => {
      // Two operators cannot restore different snapshots of the same page concurrently.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('legacy-backfill'))`);
      const rows = await tx.select({ season: seasons }).from(seasons).innerJoin(shards, eq(shards.id, seasons.shardId))
        .where(and(eq(shards.role, 'MAIN'), inArray(seasons.status, ['frozen', 'wiped']),
          input.cursor ? gt(seasons.id, input.cursor) : undefined)).orderBy(asc(seasons.id)).limit(input.limit + 1);
      const affected = new Set<string>();
      for (const { season } of rows.slice(0, input.limit)) {
        const [first] = await tx.select({ at: seasonResults.createdAt }).from(seasonResults)
          .where(eq(seasonResults.seasonId, season.id)).orderBy(asc(seasonResults.createdAt)).limit(1);
        const boundary = season.closedAt ?? first?.at;
        const cutoff = boundary ? new Date(Math.min(boundary.getTime(), season.endsAt.getTime())) : undefined;
        if (!cutoff || !legacySeasonEligible(season.startsAt.getTime(), cutoff.getTime())) continue;
        await preserveLegacySeasonEvents(tx, season.id, cutoff);
        await importLegacyArchive(tx, season.id, input.at);
        const owners = await tx.execute<{ accountId: string }>(sql`
          SELECT account_id AS "accountId" FROM season_results WHERE season_id = ${season.id}
          UNION SELECT account_id FROM legacy_facts WHERE season_id = ${season.id}
          UNION SELECT account_id FROM legacy_participation WHERE season_id = ${season.id}
          UNION SELECT account_id FROM legacy_activity_days WHERE season_id = ${season.id}
          UNION SELECT account_id FROM legacy_monument_intervals WHERE season_id = ${season.id}
        `);
        for (const owner of owners) affected.add(owner.accountId);
      }
      const owners = [...affected].sort();
      const [before] = owners.length === 0 ? [] : await tx.select({ n: count() }).from(legacyAwards).where(inArray(legacyAwards.accountId, owners));
      for (const owner of owners) await refreshLegacyAwards(tx, owner, input.at);
      const [after] = owners.length === 0 ? [] : await tx.select({ n: count() }).from(legacyAwards).where(inArray(legacyAwards.accountId, owners));
      const result = { seasons: Math.min(rows.length, input.limit), awardsAdded: (after?.n ?? 0) - (before?.n ?? 0),
        nextCursor: rows.length > input.limit ? rows[input.limit - 1]!.season.id : null };
      if (!input.apply) throw new PreviewComplete(result);
      return result;
    });
  } catch (error) {
    if (error instanceof PreviewComplete) return error.result;
    throw error;
  }
}

/** Use the original source key for restored receipts: a later live delivery is the same act. */
export async function preserveLegacySeasonEvents(tx: Tx, seasonId: string, at: Date, playerId?: string): Promise<void> {
  const [season] = await tx.select({ season: seasons, role: shards.role }).from(seasons)
    .innerJoin(shards, eq(shards.id, seasons.shardId)).where(eq(seasons.id, seasonId));
  if (season?.role !== 'MAIN') return;
  at = new Date(Math.min(at.getTime(), season.season.endsAt.getTime(), season.season.closedAt?.getTime() ?? Infinity));
  const roster = await tx.select({ id: players.id, accountId: players.accountId, joinedAt: players.joinedAt }).from(players)
    .where(playerId ? eq(players.id, playerId) : undefined);
  const accountOf = new Map(roster.map(row => [row.id, row.accountId]));
  const ownerOf = new Map(roster.map(row => [row.id, row]));
  const action = async (actor: string | null, time: Date) => {
    const owner = actor === null ? undefined : ownerOf.get(actor);
    if (!owner || time < season.season.startsAt || time >= season.season.endsAt || time > at) return;
    if (owner.joinedAt >= season.season.startsAt && owner.joinedAt <= time) {
      await registerLegacyParticipation(tx, owner.accountId, seasonId, owner.joinedAt);
    }
    await tx.insert(legacyActivityDays).values({ accountId: owner.accountId, seasonId,
      day: Math.floor((time.getTime() - season.season.startsAt.getTime()) / 86400000), firstActionAt: time })
      .onConflictDoUpdate({ target: [legacyActivityDays.accountId, legacyActivityDays.seasonId, legacyActivityDays.day],
        set: { firstActionAt: sql`least(${legacyActivityDays.firstActionAt}, ${time.toISOString()}::timestamptz)` } });
    deferLegacyRefresh(tx, owner.accountId, at);
  };
  const record = async (playerId: string | null, metric: LegacyMetric, sourceKey: string, time: Date, amount = 1) => {
    const accountId = playerId === null ? undefined : accountOf.get(playerId);
    if (!accountId || time > at || time < season.season.startsAt || amount <= 0) return;
    await recordLegacyFact(tx, { accountId, seasonId, metric, sourceKey, amount, at: time, origin: 'RESTORED' });
    deferLegacyRefresh(tx, accountId, at);
  };
  const flights = await tx.select().from(missions).where(and(eq(missions.seasonId, seasonId),
    playerId ? eq(missions.ownerPlayerId, playerId) : undefined));
  for (const row of flights) {
    if (['attack', 'probe', 'death_star', 'settlement', 'transfer'].includes(row.kind)) await action(row.ownerPlayerId, row.departAt);
    if (row.kind === 'death_star') await record(row.ownerPlayerId, 'DEATH_STAR_LAUNCHES', `death-star:${row.id}`, row.departAt);
    if (row.kind === 'probe') await record(row.ownerPlayerId, 'PROBES', `probe:${row.id}`, row.departAt);
  }
  const bombs = await tx.select().from(radiationBombFlights).where(eq(radiationBombFlights.seasonId, seasonId));
  for (const row of bombs) {
    await action(row.ownerPlayerId, row.departAt);
    await record(row.ownerPlayerId, 'RADIATION_BOMB_LAUNCHES', `bomb:${row.id}`, row.departAt);
    if (row.status === 'INTERCEPTED' && row.interception && row.resolvedAt) await record(row.interception.defenderPlayerId,
      'STRATEGIC_INTERCEPTIONS', `interception:bomb:${row.id}`, row.resolvedAt);
  }
  for (const row of await tx.select().from(strategicInterceptions).where(and(eq(strategicInterceptions.seasonId, seasonId),
    playerId ? eq(strategicInterceptions.defenderPlayerId, playerId) : undefined))) {
    await record(row.defenderPlayerId, 'STRATEGIC_INTERCEPTIONS', `interception:death-star:${row.missionId}`, row.launchAt);
  }
  for (const row of await tx.select().from(monumentProbes).where(and(eq(monumentProbes.seasonId, seasonId),
    playerId ? eq(monumentProbes.playerId, playerId) : undefined))) {
    await action(row.playerId, row.departAt);
    await record(row.playerId, 'PROBES', `monument-probe:${row.id}`, row.departAt);
  }
  const research = await tx.select({ research: playerResearch, playerId: players.id }).from(playerResearch)
    .innerJoin(players, eq(players.id, playerResearch.playerId)).where(and(eq(players.seasonId, seasonId),
      playerId ? eq(players.id, playerId) : undefined));
  const moves = await tx.select().from(commanderTransfers).where(eq(commanderTransfers.cycleId, season.season.cycleId));
  const researchByPlayer = new Map<string, (typeof playerResearch.$inferSelect)[]>();
  for (const row of research) {
    const own = researchByPlayer.get(row.playerId) ?? [];
    own.push(row.research); researchByPlayer.set(row.playerId, own);
  }
  const movedPlayers = new Set(moves.map(row => row.playerId));
  const production = [
    ...await tx.select({ playerId: planets.statsOwnerPlayerId, telemetry: planets.seasonTelemetry }).from(planets)
      .where(and(eq(planets.seasonId, seasonId), playerId ? eq(planets.statsOwnerPlayerId, playerId) : undefined)),
    ...await tx.select({ playerId: seasonTelemetrySegments.playerId, telemetry: seasonTelemetrySegments.telemetry }).from(seasonTelemetrySegments)
      .where(and(eq(seasonTelemetrySegments.seasonId, seasonId), playerId ? eq(seasonTelemetrySegments.playerId, playerId) : undefined)),
  ];
  const produced = new Map<string, Map<LegacyMetric, number>>();
  for (const row of production) {
    if (!row.playerId || movedPlayers.has(row.playerId)) continue;
    const accountId = accountOf.get(row.playerId);
    if (!accountId) continue;
    const own = produced.get(accountId) ?? new Map<LegacyMetric, number>();
    for (const [hull, amount] of fleetEntries(row.telemetry.shipsBuilt)) if (!HULLS[hull].ground) {
      const metric = `SHIPS_BUILT:${hull}` as const;
      own.set(metric, (own.get(metric) ?? 0) + amount);
    }
    produced.set(accountId, own);
  }
  const receipts = await tx.select({ accountId: legacyFacts.accountId, metric: legacyFacts.metric,
    amount: sql<string>`coalesce(sum(${legacyFacts.amount}), 0)::text` }).from(legacyFacts)
    .where(and(eq(legacyFacts.seasonId, seasonId), sql`${legacyFacts.origin} <> 'ARCHIVE'`))
    .groupBy(legacyFacts.accountId, legacyFacts.metric);
  const proven = new Map(receipts.map(row => [`${row.accountId}:${row.metric}`, Number(row.amount)]));
  for (const [accountId, metrics] of produced) for (const [metric, amount] of metrics) {
    if (amount <= (proven.get(`${accountId}:${metric}`) ?? 0)) continue;
    await recordLegacyFact(tx, { accountId, seasonId, metric, sourceKey: `archive:production:${String(at.getTime())}`,
      amount, at, origin: 'ARCHIVE', dateKnown: false });
  }
  for (const owner of roster) {
    const own = researchByPlayer.get(owner.id) ?? [];
    const levels: Partial<Record<ResearchProjectId, number>> = {};
    // A ladder carried through Silent Space cannot establish where it was completed.
    if (movedPlayers.has(owner.id)) continue;
    for (const row of own) if (row.completedAt >= season.season.startsAt && row.completedAt <= at) levels[row.projectId] = row.level;
    if (legacyResearchMastered(levels)) await record(owner.id, 'RESEARCH_MASTERED', `research:${seasonId}`,
      new Date(Math.max(...own.map(row => row.completedAt.getTime()))));
  }
  const waves = await tx.select().from(monumentWaves).where(and(eq(monumentWaves.seasonId, seasonId),
    playerId ? eq(monumentWaves.playerId, playerId) : undefined));
  for (const wave of waves) {
    if (wave.jointOperationId === null) await action(wave.playerId, wave.sentAt);
    const accountId = accountOf.get(wave.playerId);
    // LOST rows may have been settled long after the last ship died. They cannot prove the interval.
    if (!accountId || wave.status !== 'HOLD' || !wave.heldAt || wave.heldAt < season.season.startsAt) continue;
    const through = new Date(Math.min(at.getTime(), wave.radiationSettledAt.getTime()));
    if (through > wave.heldAt) await recordLegacyMonumentInterval(tx, { accountId, seasonId,
      sourceKey: `wave:${wave.id}`, from: wave.heldAt, to: through });
  }
  const participants = await tx.select().from(monumentBattleParticipants).where(and(eq(monumentBattleParticipants.seasonId, seasonId),
    eq(monumentBattleParticipants.side, 'ATTACK'), playerId ? eq(monumentBattleParticipants.playerId, playerId) : undefined));
  const waveById = new Map(waves.map(row => [row.id, row]));
  for (const row of participants) for (const waveId of row.waveIds) {
    const wave = waveById.get(waveId);
    if (wave?.playerId === row.playerId && wave.jointOperationId) {
      await record(row.playerId, 'CLAN_WAR_ATTACKS', `clan-war:${wave.jointOperationId}`, row.createdAt);
    }
  }
  for (const row of await tx.select().from(miningRuns).where(and(eq(miningRuns.seasonId, seasonId),
    playerId ? eq(miningRuns.ownerPlayerId, playerId) : undefined))) {
    await action(row.ownerPlayerId, row.departAt);
    if (row.status === 'done' && row.targetKind === 'asteroid' && row.asteroidIndex !== null && row.homeAt
      && row.minedAlloy + row.minedCrystal + row.minedDeuterium > 0) {
      await record(row.ownerPlayerId, 'ASTEROIDS_MINED', `asteroid:${String(row.asteroidIndex)}`, row.homeAt);
    }
  }
  const pirates = await tx.select({ raid: pirateRaids, report: battleReports }).from(pirateRaids)
    .innerJoin(battleReports, eq(battleReports.pirateRaidId, pirateRaids.id)).where(and(eq(pirateRaids.seasonId, seasonId), eq(battleReports.grade, 'DECISIVE'),
      playerId ? eq(pirateRaids.ownerPlayerId, playerId) : undefined));
  for (const { raid, report } of pirates) if (fleetCount(report.attackerFleet) > fleetCount(report.attackerLosses)) {
    await record(raid.ownerPlayerId, 'PIRATE_VICTORIES', `pirate:${String(raid.pirateIndex)}`, report.createdAt);
  }
  for (const row of await tx.select().from(clanWarParticipantResults).where(and(eq(clanWarParticipantResults.seasonId, seasonId),
    playerId ? eq(clanWarParticipantResults.playerId, playerId) : undefined))) {
    await record(row.playerId, 'CLAN_WAR_ATTACKS', `clan-war:${row.operationId}`, row.createdAt);
  }
}
