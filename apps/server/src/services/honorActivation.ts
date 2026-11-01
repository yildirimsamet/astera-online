import { and, asc, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { HONOR_LAUNCH_VERSION, isHonorCandidate, HONOR_HISTORY_HOURS, isSupportedHonorVersion } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { honorCommitments, honorEvents, honorSeasons, honorTotals, players, seasons, shards } from '../db/schema.js';
import { pendingHonorLegacySources, prepareHonorSeason } from './honorLedger.js';
import { honorCommitmentSchema } from './honorCommitment.js';
import { readHonorRelations } from './honorRelations.js';
import { emptyHonorState, honorStateSchema } from './honorAccounting.js';
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
export async function openHonorRanking(db: Db, input: { seasonId: string; clock: Clock; apply: boolean },
  initialize = false) {
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
    let [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
    // Owner 2026-11-01: every competitive galaxy has Honor, including existing seasons.
    if (!config && initialize) {
      await prepareHonorSeason(tx, seasonId, 'SHADOW', { now: () => now }, HONOR_LAUNCH_VERSION);
      [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
    }
    if (!config) throw new Error('Honor shadow observation must be enabled first');
    if (!isSupportedHonorVersion(config.version)) throw new Error('Unsupported frozen Honor version');
    if (isHonorCandidate(config.version)) throw new Error('Candidate Honor is not ready for ranked opening');
    if (config.closedAt !== null) throw new Error('Honor season is sealed');
    const active = config.mode === 'ACTIVE';
    if (active && !config.rankedAt) throw new Error('Missing Honor ranked boundary');
    if (!active && (config.rankedAt !== null || (!initialize && now.getTime() - config.createdAt.getTime() < HONOR_HISTORY_HOURS * 3_600_000))) {
      throw new Error('Honor opening requires at least 24 hours of shadow observation');
    }
    const owners = await tx.select({ id: players.id }).from(players)
      .where(eq(players.seasonId, seasonId)).orderBy(asc(players.id));
    if (!active) {
      honorStateSchema.parse(config.state);
      // Boot adoption records a genuine present sample for legacy seats. It never
      // invents past inventory; the manual read-only preview still requires history.
      if (initialize) for (const owner of owners) await observeHonorOwner(tx, owner.id, now);
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

/** Boot repair for every environment. The season lock makes concurrent replicas safe. */
export async function ensureMainHonorRankings(db: Db, clock: Clock): Promise<number> {
  const now = clock.now();
  const live = await db.select({ id: seasons.id }).from(seasons)
    .innerJoin(shards, eq(shards.id, seasons.shardId))
    .where(and(eq(shards.role, 'MAIN'), eq(seasons.status, 'live'), isNull(seasons.closedAt),
      lte(seasons.startsAt, now), gt(seasons.endsAt, now)));
  let opened = 0;
  for (const season of live) {
    const result = await openHonorRanking(db, { seasonId: season.id, clock, apply: true }, true);
    if (result.applied) opened++;
  }
  return opened;
}

/** The former hide command stays a refusal so old operator scripts cannot disable Honor. */
export function hideHonorRanking(_db: Db, _input: { seasonId: string; clock: Clock; apply: boolean }): Promise<never> {
  return Promise.reject(new Error('Honor ranking is permanently active'));
}

/**
 * Owner 2026-10-29: a fight with a bot counts unless no person is in it. A flight
 * committed by an older image froze the old bot exclusion, so one explicit run after
 * the rollout re-judges every unsettled ineligible commitment under today's rule.
 * Settled sources keep their evidence; relations and conditions stay frozen.
 */
export async function refreshHonorEligibility(db: Db, input: {
  seasonId: string; adminUsernames: ReadonlySet<string>; apply: boolean;
}) {
  const seasonId = z.string().uuid().parse(input.seasonId);
  return db.transaction(async tx => {
    // The parent UPDATE lock orders every launch and settlement, as in the ranked cutover.
    if (input.apply) await tx.select({ id: seasons.id }).from(seasons).where(eq(seasons.id, seasonId)).for('update');
    const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
    if (config?.closedAt !== null) throw new Error('An open Honor season is required');
    const rows = await tx.select().from(honorCommitments).where(eq(honorCommitments.seasonId, seasonId))
      .orderBy(asc(honorCommitments.source), asc(honorCommitments.sourceId));
    const refreshed: string[] = [];
    for (const row of rows) {
      const snapshot = honorCommitmentSchema.parse(row.snapshot);
      if (snapshot.eligible || snapshot.exclusion || snapshot.defence.length === 0) continue;
      const [settled] = await tx.select({ at: honorEvents.at }).from(honorEvents).where(and(eq(honorEvents.seasonId, seasonId),
        eq(honorEvents.source, row.source), eq(honorEvents.sourceId, row.sourceId))).limit(1);
      if (settled) continue;
      const actors = [...new Set([...snapshot.attack, ...snapshot.defence].map(member => member.id))];
      // Somebody who has since left the galaxy cannot be judged here; their flight keeps its terms.
      const present = await tx.select({ id: players.id }).from(players)
        .where(and(eq(players.seasonId, seasonId), inArray(players.id, actors)));
      if (present.length !== actors.length) continue;
      const facts = await readHonorRelations(tx, { seasonId, adminUsernames: input.adminUsernames, at: new Date(snapshot.at),
        attack: snapshot.attack.map(member => member.id), defence: snapshot.defence.map(member => member.id) });
      if (!facts.eligible) continue;
      refreshed.push(`${row.source}:${row.sourceId}`);
      if (input.apply) {
        await tx.update(honorCommitments).set({ snapshot: { ...snapshot, eligible: true } }).where(and(
          eq(honorCommitments.seasonId, seasonId), eq(honorCommitments.source, row.source), eq(honorCommitments.sourceId, row.sourceId)));
      }
    }
    return { seasonId, applied: input.apply, refreshed };
  }, input.apply ? undefined : { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
