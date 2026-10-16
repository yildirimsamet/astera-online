import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { createHonorCatalogue, createHonorShieldCatalogue, createHonorStrategicCatalogue, HONOR_VERSION, HONOR_LAUNCH_VERSION, honorAdvancedPolicy, isHonorCandidate, isSupportedHonorVersion, type HonorVersion } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Queryable, Tx } from '../db/client.js';
import { honorCommitments, honorEvents, honorSeasons, honorTotals, players, seasons } from '../db/schema.js';
import { honorCommitmentSchema } from './honorCommitment.js';
import { advanceHonor, emptyHonorState, honorEventKey, honorEvidenceSchema, honorStateSchema, replayHonor,
  type HonorAccountedEvent, type HonorAccountingState, type HonorEvidence } from './honorAccounting.js';
import { isSilentSpaceShard } from './waitingRoom.js';
import { observeHonorOwner } from './honorReference.js';
import { publish, publishShard } from '../stream/bus.js';

/** Read-only boundary inspection; activation holds the exclusive season lock. */
export async function pendingHonorLegacySources(tx: Queryable, seasonId: string): Promise<string[]> {
  const flying = await tx.execute<{ key: string }>(sql`
    SELECT 'WORLD:' || m.id::text AS key FROM missions m
    WHERE m.season_id = ${seasonId} AND m.kind = 'attack' AND m.status = 'in_flight'
    UNION
    SELECT 'CLAN_WAR:' || m.id::text FROM missions m JOIN clan_war_missions w ON w.mission_id = m.id
    WHERE m.season_id = ${seasonId} AND m.status = 'in_flight' AND w.leg = 'COMBINED_ATTACK'
    UNION
    SELECT 'MONUMENT:' || COALESCE(w.joint_operation_id, w.id)::text FROM monument_waves w
    WHERE w.season_id = ${seasonId} AND w.status = 'OUTBOUND'
    UNION
    SELECT 'STRATEGIC_IMPACT:' || m.id::text FROM missions m
    WHERE m.season_id = ${seasonId} AND m.kind = 'death_star' AND m.status = 'in_flight'
    UNION
    SELECT 'STRATEGIC_IMPACT:bomb:' || b.id::text FROM radiation_bomb_flights b
    WHERE b.season_id = ${seasonId} AND b.status IN ('OUTBOUND', 'HIT')
    ORDER BY key
  `);
  return flying.map(row => row.key);
}

/** Existing live seasons may collect shadow evidence, but never silently become ranked. */
export async function prepareHonorSeason(tx: Tx, seasonId: string, mode: 'SHADOW' | 'ACTIVE', clock: Clock,
  version: HonorVersion = HONOR_VERSION): Promise<void> {
  if (!isSupportedHonorVersion(version)) throw new Error('Unsupported frozen Honor version');
  if (isHonorCandidate(version) && mode !== 'SHADOW') throw new Error('Candidate Honor requires shadow mode');
  // Launches and arrivals already hold SHARE on their season. Activation takes
  // the exclusive parent lock first, so its flight boundary is a real DB order,
  // even when before/after launches have an identical millisecond timestamp.
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId)).for('update');
  if (!season) throw new Error('Missing Honor season');
  const now = clock.now();
  if (mode === 'ACTIVE' && season.status !== 'live') throw new Error('Honor requires a live season');
  if (mode === 'ACTIVE' && await isSilentSpaceShard(tx, season.shardId)) throw new Error('Honor requires a main galaxy');
  if (mode === 'ACTIVE' && season.startsAt < now) throw new Error('Honor must be announced before the season starts');
  const [existing] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
  if (existing) {
    if (existing.version !== version || existing.mode !== mode) throw new Error('Honor season configuration is immutable');
    return;
  }
  const legacySources = await pendingHonorLegacySources(tx, seasonId);
  const [inserted] = await tx.insert(honorSeasons).values({ seasonId, version, mode,
    catalogue: createHonorCatalogue(), shieldCatalogue: [...createHonorShieldCatalogue()],
    strategicCatalogue: honorAdvancedPolicy(version) ? createHonorStrategicCatalogue(version === HONOR_LAUNCH_VERSION) : null,
    legacySources, state: emptyHonorState(), createdAt: now,
    rankedAt: mode === 'ACTIVE' ? now : null }).onConflictDoNothing().returning();
  if (!inserted) {
    const [existing] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
    if (existing?.version !== version || existing.mode !== mode) throw new Error('Honor season configuration is immutable');
  } else {
    // Existing seats have a genuine starting sample, never an invented past launch.
    const owners = await tx.select({ id: players.id }).from(players)
      .where(eq(players.seasonId, seasonId)).orderBy(asc(players.id)).for('update');
    for (const owner of owners) await observeHonorOwner(tx, owner.id, now);
  }
}

/** Parsed evidence keys are canonical; object insertion order is not source identity. */
export function honorEvidenceHash(evidence: HonorEvidence, version: number): string {
  // Zod rebuilds object keys in schema order, including nested owners and relations.
  const parsed = honorEvidenceSchema.parse(evidence);
  const order = <T>(rows: readonly T[]): T[] => [...rows].sort((a, b) => {
    const left = JSON.stringify(a), right = JSON.stringify(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  // Unordered DB row delivery is not a different battle. Amounts and ownership
  // remain in the digest, including distinct same-owner contribution evidence.
  return createHash('sha256').update(JSON.stringify({ version, evidence: { ...parsed,
    ...(parsed.selectedDefenders === undefined ? {} : { selectedDefenders: order(parsed.selectedDefenders) }),
    attack: order(parsed.attack), defence: order(parsed.defence), relations: order(parsed.relations) } })).digest('hex');
}

export type HonorSettlement = { status: 'DISABLED' } | {
  status: 'APPLIED' | 'REPLAYED' | 'REBUILT'; receipt: HonorAccountedEvent;
};

/**
 * Acquire after game locks and before no further gameplay locks. The per-season
 * row serialises the short accounting section across all participating pairs.
 * Caller owns the outer battle transaction: there is no independent commit here.
 */
export async function settleHonor(tx: Tx, seasonId: string, value: unknown): Promise<HonorSettlement> {
  const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId)).for('update');
  if (!config) return { status: 'DISABLED' };
  if (!isSupportedHonorVersion(config.version)) throw new Error('Unsupported frozen Honor version');
  if (isHonorCandidate(config.version) && config.mode !== 'SHADOW') throw new Error('Candidate Honor requires shadow mode');
  const evidence = honorEvidenceSchema.parse(value), evidenceHash = honorEvidenceHash(evidence, config.version);
  const sourceWhere = and(eq(honorEvents.seasonId, seasonId), eq(honorEvents.source, evidence.source), eq(honorEvents.sourceId, evidence.id));
  const [seen] = await tx.select().from(honorEvents).where(sourceWhere);
  if (seen) {
    if (seen.evidenceHash !== evidenceHash) throw new Error('Conflicting Honor source replay');
    if (config.mode === 'ACTIVE' && !seen.ranked) return { status: 'DISABLED' };
    return { status: 'REPLAYED', receipt: seen.outcome };
  }
  if (config.closedAt !== null) throw new Error('Honor season is sealed');
  if (config.mode === 'ACTIVE' && (!config.rankedAt || evidence.at < config.rankedAt.getTime())) {
    throw new Error('Honor source before ranked opening');
  }
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId));
  if (!season || evidence.at < season.startsAt.getTime() || evidence.at >= season.endsAt.getTime()) {
    throw new Error('Honor source outside its season');
  }
  const ids = [...new Set([...evidence.attack, ...evidence.defence].map(row => row.id))];
  const owners = await tx.select({ id: players.id }).from(players).where(and(eq(players.seasonId, seasonId), inArray(players.id, ids)));
  if (owners.length !== ids.length) {
    // A launched bomb can keep hurting its original target after its sender
    // legitimately moves away. Score its frozen season, never the new galaxy.
    const [commitment] = config.version === HONOR_LAUNCH_VERSION && evidence.attackKey
      ? await tx.select().from(honorCommitments).where(and(eq(honorCommitments.seasonId, seasonId),
        eq(honorCommitments.source, 'STRATEGIC_IMPACT'), eq(honorCommitments.sourceId, evidence.attackKey))) : [];
    const frozen = commitment ? honorCommitmentSchema.parse(commitment.snapshot) : null;
    const present = await tx.select({ id: players.id, cycleId: seasons.cycleId }).from(players)
      .innerJoin(seasons, eq(seasons.id, players.seasonId)).where(inArray(players.id, ids));
    const expected = frozen ? [...new Set([...frozen.attack, ...frozen.defence].map(row => row.id))].sort() : [];
    if (evidence.source !== 'STRATEGIC_IMPACT' || !evidence.attackKey?.startsWith('bomb:') || !frozen
      || JSON.stringify(expected) !== JSON.stringify([...ids].sort()) || present.length !== ids.length
      || present.some(row => row.cycleId !== season.cycleId)) throw new Error('Honor source has foreign or missing owners');
  }
  const before = honorStateSchema.parse(config.state), key = honorEventKey(evidence);
  const late = before.lastAt !== null && (evidence.at < before.lastAt || (evidence.at === before.lastAt
    && (honorAdvancedPolicy(config.version) || key <= before.lastKey)));
  let state: HonorAccountingState, receipt: HonorAccountedEvent;
  if (late) {
    const previous = await tx.select().from(honorEvents).where(and(eq(honorEvents.seasonId, seasonId),
      eq(honorEvents.ranked, config.mode === 'ACTIVE')));
    const replay = replayHonor([...previous.map(row => row.evidence), evidence], config.version);
    const { events, ...rebuilt } = replay;
    state = rebuilt;
    const outcomes = new Map(events.map(row => [row.key, row]));
    const result = outcomes.get(key);
    if (!result) throw new Error('Honor replay omitted new source');
    receipt = result;
    for (const row of previous) {
      const outcome = outcomes.get(honorEventKey(row.evidence));
      if (!outcome) throw new Error('Honor replay omitted prior source');
      await tx.update(honorEvents).set({ outcome }).where(and(eq(honorEvents.seasonId, seasonId),
        eq(honorEvents.source, row.source), eq(honorEvents.sourceId, row.sourceId)));
    }
  } else {
    const result = advanceHonor(before, evidence, config.version);
    state = result.state; receipt = result.event;
  }
  await tx.insert(honorEvents).values({ seasonId, source: evidence.source, sourceId: evidence.id,
    at: new Date(evidence.at), evidenceHash, evidence, outcome: receipt, ranked: config.mode === 'ACTIVE' });
  if (state.totals.length > 0) {
    await tx.insert(honorTotals).values(state.totals.map(row => ({ seasonId, playerId: row.actor, score: row.score })))
      .onConflictDoUpdate({ target: [honorTotals.seasonId, honorTotals.playerId], set: { score: sql`excluded.score` } });
  }
  await tx.update(honorSeasons).set({ state }).where(eq(honorSeasons.seasonId, seasonId));
  if (config.mode === 'ACTIVE') {
    const previousTotals = new Map(before.totals.map(row => [row.actor, row.score]));
    if (state.totals.some(row => row.score !== (previousTotals.get(row.actor) ?? 0))) {
      await publishShard(tx, seasonId, 'score');
    }
    // Rebuild can change an older receipt even when its owner's total stays equal.
    // Private events refresh authorised reports without exposing participants.
    const readers = late ? state.totals.map(row => row.actor) : ids;
    // Radiation can add a receipt without a mission/arrival notification. The
    // participant's open report must refresh on its first result as well.
    for (const actor of readers) await publish(tx, actor, 'private:honor');
  }
  return { status: late ? 'REBUILT' : 'APPLIED', receipt };
}
