import { and, asc, desc, eq, gt, lte, notInArray, or, sql } from 'drizzle-orm';
import { coreTier, HONOR_HISTORY_HOURS, honorReferenceAt, type HonorObservation } from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { accounts, buildings, honorEvents, honorObservations, honorSeasons, planets, players } from '../db/schema.js';
import { ownedHonorNavy } from './honorNavy.js';

/**
 * Call after ownership/production/loss mutations, in their transaction, with
 * the injected observation time. World locks precede sorted player locks.
 * Wealth refresh already holds the same player lock, so this must not strengthen it:
 * FOR UPDATE would wait for a new row's key-share lock on the commander while that
 * transaction waits to write Wealth (production deadlocks, November 2026). No Honor
 * journal lock is taken, so recording inventory never acquires the ledger before gameplay.
 */
export async function observeHonorOwner(tx: Tx, playerId: string, at?: Date): Promise<void> {
  const [identity] = await tx.select({ seasonId: players.seasonId }).from(players).where(eq(players.id, playerId));
  if (!identity) return;
  const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, identity.seasonId));
  if (config?.closedAt !== null) return;
  if (!at) throw new Error('Honor inventory requires an injected observation time');
  const [locked] = await tx.select({ seasonId: players.seasonId }).from(players).where(eq(players.id, playerId)).for('no key update');
  if (locked?.seasonId !== identity.seasonId) throw new Error('Honor owner moved during observation');
  const [previous] = await tx.select().from(honorObservations).where(and(
    eq(honorObservations.seasonId, identity.seasonId), eq(honorObservations.playerId, playerId),
  )).orderBy(desc(honorObservations.at), desc(honorObservations.id)).limit(1);
  if (!Number.isSafeInteger(at.getTime())) throw new Error('Honor inventory requires a valid observation time');
  // This reads TODAY's inventory. A delayed worker or a transaction that lost the
  // player lock race stamps it no earlier than the newest row, never backdated.
  const floor = previous?.at ?? config.createdAt;
  const stamp = at < floor ? floor : at;
  const [navy, coreRows] = await Promise.all([
    ownedHonorNavy(tx, playerId, config),
    tx.select({ level: buildings.level }).from(buildings).innerJoin(planets, eq(buildings.planetId, planets.id))
      .where(and(eq(planets.controllerPlayerId, playerId), eq(buildings.type, 'CORE'))),
  ]);
  // units already includes anıt/support/dock escrow. Never add their manifests again.
  const tier = coreTier(Math.max(1, ...coreRows.map(row => row.level)));
  if (previous?.navy === navy && previous.coreTier === tier) return;
  await tx.insert(honorObservations).values({ seasonId: identity.seasonId, playerId, at: stamp, navy, coreTier: tier });
}

export interface HonorCombatLoss { at: number; value: number }

/** What each owner lost in battle during the day before `at`. The Honor journal is the
 * witness: its evidence already holds every side's armed loss in the navy's own measure. */
export async function honorCombatLosses(db: Queryable, seasonId: string, playerIds: readonly string[], at: Date): Promise<Map<string, HonorCombatLoss[]>> {
  const losses = new Map<string, HonorCombatLoss[]>(playerIds.map(id => [id, []]));
  const fought = playerIds.flatMap(id => {
    const member = JSON.stringify([{ id }]);
    return [sql`${honorEvents.evidence}->'attack' @> ${member}::jsonb`, sql`${honorEvents.evidence}->'defence' @> ${member}::jsonb`];
  });
  const rows = await db.select({ evidence: honorEvents.evidence }).from(honorEvents).where(and(eq(honorEvents.seasonId, seasonId),
    gt(honorEvents.at, new Date(at.getTime() - HONOR_HISTORY_HOURS * 3_600_000)), lte(honorEvents.at, at), or(...fought)));
  for (const { evidence } of rows) {
    for (const row of [...evidence.attack, ...evidence.defence]) {
      if (row.combatLoss > 0) losses.get(row.id)?.push({ at: evidence.at, value: row.combatLoss });
    }
  }
  return losses;
}

/** A loss belongs to the first observation taken at or after it, the one that saw it. */
export function withCombatLosses(history: readonly HonorObservation[], losses: readonly HonorCombatLoss[]): HonorObservation[] {
  const rows = [...history].sort((a, b) => a.at - b.at || (a.order ?? 0) - (b.order ?? 0));
  return rows.map((row, index) => ({ ...row, combatLoss: losses.reduce((sum, loss) =>
    sum + (loss.at <= row.at && loss.at > (rows[index - 1]?.at ?? -Infinity) ? loss.value : 0), 0) }));
}

/** Historical reference at commitment, never today's navy applied to an older launch. */
export async function honorOwnerReference(db: Queryable, seasonId: string, playerId: string, at: Date, throughOrder?: number): Promise<{ navy: number; tier: number }> {
  const rows = await db.select().from(honorObservations).where(and(eq(honorObservations.seasonId, seasonId),
    eq(honorObservations.playerId, playerId), lte(honorObservations.at, at),
    ...(throughOrder === undefined ? [] : [lte(honorObservations.id, throughOrder)])))
    .orderBy(asc(honorObservations.at), asc(honorObservations.id));
  const losses = await honorCombatLosses(db, seasonId, [playerId], at);
  return honorReferenceAt(withCombatLosses(rows.map(row => ({ at: row.at.getTime(), order: row.id, navy: row.navy, coreTier: row.coreTier })),
    losses.get(playerId) ?? []), at.getTime());
}

/** One read snapshot, no new locks. Match Honor's season Core peak, including
 * current Core not yet journalled, but only for commanders still in this galaxy.
 * A neutral world, old resident, admin or another galaxy cannot move it; a bot
 * competes for Honor like anybody, so it can. */
export async function honorGalaxyTopTier(db: Queryable, seasonId: string, at: Date,
  adminUsernames: ReadonlySet<string>): Promise<number> {
  const [row] = await db.execute<{ tier: number; level: number }>(sql`
    WITH honor_contenders AS (
      SELECT ${players.id} FROM ${players}
      INNER JOIN ${accounts} ON ${accounts.id} = ${players.accountId}
      WHERE ${players.seasonId} = ${seasonId}
        AND ${adminUsernames.size > 0 ? notInArray(accounts.username, [...adminUsernames]) : sql`true`}
    )
    SELECT
      (SELECT coalesce(max(${honorObservations.coreTier}), 1)::int
       FROM ${honorObservations}
       INNER JOIN honor_contenders ON honor_contenders.id = ${honorObservations.playerId}
       WHERE ${honorObservations.seasonId} = ${seasonId}
         AND ${honorObservations.at} <= ${at.toISOString()}::timestamptz) AS tier,
      (SELECT coalesce(max(${buildings.level}), 1)::int
       FROM ${buildings}
       INNER JOIN ${planets} ON ${planets.id} = ${buildings.planetId}
       INNER JOIN honor_contenders ON honor_contenders.id = ${planets.controllerPlayerId}
       WHERE ${buildings.type} = 'CORE'
         AND ${planets.seasonId} = ${seasonId}) AS level
  `);
  if (!row) throw new Error('Missing Honor galaxy tier');
  return Math.max(row.tier, coreTier(Math.max(1, row.level)));
}
