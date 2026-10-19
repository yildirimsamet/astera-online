import { and, asc, desc, eq, lte, notInArray, sql } from 'drizzle-orm';
import { coreTier, honorReferenceAt } from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { accounts, botProfiles, buildings, honorObservations, honorSeasons, planets, players } from '../db/schema.js';
import { ownedHonorNavy } from './honorNavy.js';

/**
 * Call after ownership/production/loss mutations, in their transaction, with
 * the injected observation time. World locks precede sorted player locks.
 * Wealth refresh already holds the same player lock; no Honor journal lock is
 * taken, so recording inventory never acquires the ledger before gameplay.
 */
export async function observeHonorOwner(tx: Tx, playerId: string, at?: Date): Promise<void> {
  const [identity] = await tx.select({ seasonId: players.seasonId }).from(players).where(eq(players.id, playerId));
  if (!identity) return;
  const [config] = await tx.select().from(honorSeasons).where(eq(honorSeasons.seasonId, identity.seasonId));
  if (config?.closedAt !== null) return;
  if (!at) throw new Error('Honor inventory requires an injected observation time');
  const [locked] = await tx.select({ seasonId: players.seasonId }).from(players).where(eq(players.id, playerId)).for('update');
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

/** Historical reference at commitment, never today's navy applied to an older launch. */
export async function honorOwnerReference(db: Queryable, seasonId: string, playerId: string, at: Date, throughOrder?: number): Promise<{ navy: number; tier: number }> {
  const rows = await db.select().from(honorObservations).where(and(eq(honorObservations.seasonId, seasonId),
    eq(honorObservations.playerId, playerId), lte(honorObservations.at, at),
    ...(throughOrder === undefined ? [] : [lte(honorObservations.id, throughOrder)])))
    .orderBy(asc(honorObservations.at), asc(honorObservations.id));
  return honorReferenceAt(rows.map(row => ({ at: row.at.getTime(), order: row.id, navy: row.navy, coreTier: row.coreTier })), at.getTime());
}

/** One read snapshot, no new locks. Match Honor's season Core peak, including
 * current Core not yet journalled, but only for commanders still in this galaxy.
 * A neutral world, old resident, bot, admin or another galaxy cannot move it. */
export async function honorGalaxyTopTier(db: Queryable, seasonId: string, at: Date,
  adminUsernames: ReadonlySet<string>): Promise<number> {
  const [row] = await db.execute<{ tier: number; level: number }>(sql`
    WITH honor_contenders AS (
      SELECT ${players.id} FROM ${players}
      INNER JOIN ${accounts} ON ${accounts.id} = ${players.accountId}
      LEFT JOIN ${botProfiles} ON ${botProfiles.accountId} = ${players.accountId}
      WHERE ${players.seasonId} = ${seasonId} AND ${botProfiles.accountId} IS NULL
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
