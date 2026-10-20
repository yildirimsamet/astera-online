import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { HONOR_LAUNCH_VERSION, isHonorCandidate, HONOR_HISTORY_HOURS, isSupportedHonorVersion } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { honorCommitments, honorEvents, honorSeasons, honorTotals, players, seasons } from '../db/schema.js';
import { pendingHonorLegacySources, prepareHonorSeason } from './honorLedger.js';
import { emptyHonorState, honorEventKey, honorStateSchema, replayHonor } from './honorAccounting.js';
import { honorOwnerReference, observeHonorOwner } from './honorReference.js';
import { publishShard } from '../stream/bus.js';
import { isSilentSpaceShard } from './waitingRoom.js';

/** Explicit operator action, never an automatic deployment or a public route. */
export async function activateHonorShadow(db: Db, input: { seasonId: string; clock: Clock; apply: boolean }) {
  const seasonId = z.string().uuid().parse(input.seasonId);
  return db.transaction(async tx => {
    const query = tx.select().from(seasons).where(eq(seasons.id, seasonId));
    const [season] = input.apply ? await query.for('update') : await query;
    const now = input.clock.now();
    if (season?.status !== 'live' || season.closedAt !== null || now < season.startsAt
      || now >= season.endsAt || await isSilentSpaceShard(tx, season.shardId)) {
      throw new Error('An open main season is required');
    }
    const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
    if (config) {
      if (config.mode !== 'SHADOW') throw new Error('Honor season configuration is immutable');
      if (!isSupportedHonorVersion(config.version)) throw new Error('Unsupported frozen Honor version');
      if (config.closedAt !== null) throw new Error('Honor season is sealed');
    }
    const legacySources = config?.legacySources ?? await pendingHonorLegacySources(tx, seasonId);
    const commanders = await tx.select({ id: players.id }).from(players).where(eq(players.seasonId, seasonId));
    const preactivationAttacks = { world: 0, clanWar: 0, monument: 0 };
    for (const key of legacySources) {
      if (key.startsWith('WORLD:')) preactivationAttacks.world++;
      else if (key.startsWith('CLAN_WAR:')) preactivationAttacks.clanWar++;
      else if (key.startsWith('MONUMENT:')) preactivationAttacks.monument++;
      else if (key.startsWith('STRATEGIC_IMPACT:')) continue;
      else throw new Error('Invalid frozen Honor legacy source');
    }
    const applied = input.apply && !config;
    if (applied) await prepareHonorSeason(tx, seasonId, 'SHADOW', { now: () => now }, HONOR_LAUNCH_VERSION);
    return { status: config ? 'ALREADY_ENABLED' as const : 'READY' as const,
      applied, seasonId, mode: 'SHADOW' as const, version: config?.version ?? HONOR_LAUNCH_VERSION,
      startsAt: config?.createdAt ?? now, commanders: commanders.length, preactivationAttacks };
  }, input.apply ? undefined : { isolationLevel: 'repeatable read', accessMode: 'read only' });
}

/**
 * Explicit ranked cutover. Parent UPDATE lock orders every gameplay SHARE lock,
 * including launches with an identical millisecond. Trial evidence is preserved;
 * the competitive projection starts empty and retries cannot reset it again.
 */
export async function openHonorRanking(db: Db, input: { seasonId: string; clock: Clock; apply: boolean }) {
  const seasonId = z.string().uuid().parse(input.seasonId);
  return db.transaction(async tx => {
    const query = tx.select().from(seasons).where(eq(seasons.id, seasonId));
    const [season] = input.apply ? await query.for('update') : await query;
    const now = input.clock.now();
    if (!Number.isSafeInteger(now.getTime())) throw new Error('Invalid Honor opening time');
    if (season?.status !== 'live' || season.closedAt !== null || now < season.startsAt
      || now >= season.endsAt || await isSilentSpaceShard(tx, season.shardId)) {
      throw new Error('An open main season is required');
    }
    const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
    if (!config) throw new Error('Honor shadow observation must be enabled first');
    if (!isSupportedHonorVersion(config.version)) throw new Error('Unsupported frozen Honor version');
    if (isHonorCandidate(config.version)) throw new Error('Candidate Honor is not ready for ranked opening');
    if (config.closedAt !== null) throw new Error('Honor season is sealed');
    const active = config.mode === 'ACTIVE';
    if (active && !config.rankedAt) throw new Error('Missing Honor ranked boundary');
    if (!active && (config.rankedAt !== null || now.getTime() - config.createdAt.getTime() < HONOR_HISTORY_HOURS * 3_600_000)) {
      throw new Error('Honor opening requires at least 24 hours of shadow observation');
    }
    const owners = await tx.select({ id: players.id }).from(players)
      .where(eq(players.seasonId, seasonId)).orderBy(asc(players.id));
    if (!active) {
      honorStateSchema.parse(config.state);
      // Even a read-only preview must refuse missing inventory history.
      for (const owner of owners) await honorOwnerReference(tx, seasonId, owner.id, now);
    }
    const [trial] = await tx.select({ count: sql<number>`count(*)::int` }).from(honorEvents)
      .where(and(eq(honorEvents.seasonId, seasonId), ...(active ? [eq(honorEvents.ranked, false)] : [])));
    const pending = active ? [] : await pendingHonorLegacySources(tx, seasonId);
    const commitments = active ? [] : await tx.select({ source: honorCommitments.source, id: honorCommitments.sourceId })
      .from(honorCommitments).where(eq(honorCommitments.seasonId, seasonId));
    const legacySources = [...new Set([...config.legacySources, ...pending,
      ...commitments.map(row => `${row.source}:${row.id}`)])].sort();
    const applied = input.apply && !active;
    if (applied) {
      // Hold the same sorted owner locks as launch/activation. Keep all genuine
      // prior observations, and record the current inventory before publication.
      const locked = await tx.select({ id: players.id }).from(players)
        .where(eq(players.seasonId, seasonId)).orderBy(asc(players.id)).for('update');
      for (const owner of locked) await observeHonorOwner(tx, owner.id, now);
      // The still-SHADOW season makes every existing event a trial, including
      // rows written using an older image's default. Preserve evidence/outcome.
      await tx.update(honorEvents).set({ ranked: false }).where(eq(honorEvents.seasonId, seasonId));
      await tx.delete(honorTotals).where(eq(honorTotals.seasonId, seasonId));
      await tx.update(honorSeasons).set({ mode: 'ACTIVE', rankedAt: now,
        legacySources, state: emptyHonorState() }).where(eq(honorSeasons.seasonId, seasonId));
      await publishShard(tx, seasonId, 'score');
      await publishShard(tx, seasonId, 'season');
    }
    return { status: active ? 'ALREADY_ACTIVE' as const : 'READY' as const,
      applied, seasonId, mode: 'ACTIVE' as const, version: config.version,
      startsAt: config.rankedAt ?? now, observedSince: config.createdAt,
      commanders: owners.length, shadowEvents: trial?.count ?? 0,
      excludedSources: legacySources.length };
  }, input.apply ? undefined : { isolationLevel: 'repeatable read', accessMode: 'read only' });
}

/**
 * Owner 2026-10-20: the inverse of the ranked cutover. Every event becomes invisible
 * evidence again and the projection is rebuilt over the whole season, exactly as if
 * the race had never opened; the next cycle still starts with ranked Honor.
 */
export async function hideHonorRanking(db: Db, input: { seasonId: string; clock: Clock; apply: boolean }) {
  const seasonId = z.string().uuid().parse(input.seasonId);
  return db.transaction(async tx => {
    const query = tx.select().from(seasons).where(eq(seasons.id, seasonId));
    const [season] = input.apply ? await query.for('update') : await query;
    const now = input.clock.now();
    if (season?.status !== 'live' || season.closedAt !== null || now < season.startsAt || now >= season.endsAt) {
      throw new Error('An open main season is required');
    }
    const configQuery = tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
    const [config] = input.apply ? await configQuery.for('update') : await configQuery;
    if (!config) throw new Error('No Honor race in this season');
    if (!isSupportedHonorVersion(config.version)) throw new Error('Unsupported frozen Honor version');
    if (config.closedAt !== null) throw new Error('Honor season is sealed');
    if (config.benefitsVersion !== null) throw new Error('Honor benefits are on; hiding would strand their prices');
    const active = config.mode === 'ACTIVE';
    const events = await tx.select().from(honorEvents).where(eq(honorEvents.seasonId, seasonId));
    const applied = input.apply && active;
    if (applied) {
      const { events: outcomes, ...state } = replayHonor(events.map(row => row.evidence), config.version);
      const byKey = new Map(outcomes.map(row => [row.key, row]));
      for (const row of events) {
        const outcome = byKey.get(honorEventKey(row.evidence));
        if (!outcome) throw new Error('Honor replay omitted prior source');
        await tx.update(honorEvents).set({ ranked: false, outcome }).where(and(eq(honorEvents.seasonId, seasonId),
          eq(honorEvents.source, row.source), eq(honorEvents.sourceId, row.sourceId)));
      }
      await tx.delete(honorTotals).where(eq(honorTotals.seasonId, seasonId));
      if (state.totals.length > 0) {
        await tx.insert(honorTotals).values(state.totals.map(row => ({ seasonId, playerId: row.actor, score: row.score })));
      }
      await tx.update(honorSeasons).set({ mode: 'SHADOW', rankedAt: null, state, successorAnnounced: true })
        .where(eq(honorSeasons.seasonId, seasonId));
      await publishShard(tx, seasonId, 'score');
      await publishShard(tx, seasonId, 'season');
    }
    return { status: active ? 'READY' as const : 'ALREADY_HIDDEN' as const, applied, seasonId, mode: 'SHADOW' as const,
      version: config.version, rankedEvents: events.filter(row => row.ranked).length };
  }, input.apply ? undefined : { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
