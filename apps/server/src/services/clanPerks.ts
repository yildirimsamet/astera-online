import { eq, sql, type SQL } from 'drizzle-orm';
import { clanRefineryBonus } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { clans } from '../db/schema.js';

/**
 * KLAN PERKLERİ — the server's one read of the rung that sets them (F2, owner 2026-11-10;
 * the table itself is `@astera/rules` `clanPerks.ts`). Null for a clan of a season dealt
 * before the joint war, which keeps every old rule.
 */
export async function clanLevelOf(db: Queryable, clanId: string): Promise<number | null> {
  const [row] = await db.select({ level: clans.level }).from(clans).where(eq(clans.id, clanId));
  return row?.level ?? null;
}

/** The commander's clan level as a column of a read the caller already makes; null outside a levelled clan. */
export const clanLevelColumn = (playerId: SQL | string | null) =>
  sql<number | null>`(select c.level from clan_memberships me join clans c on c.id = me.clan_id
    where me.player_id = ${playerId} and me.left_at is null limit 1)`;

/** "Active" for the Ortak Ocak: gave a development or combat order in the last day (owner). */
const REFINERY_ACTIVE_MS = 24 * 60 * 60_000;

/**
 * ORTAK OCAK'S TWO INPUTS, AS COLUMNS of a read the caller already makes — the economy tick is
 * the hottest path in the server, and a statement of its own would cost every touch of every
 * world. The commander's clan level (null outside a clan, or in a levelless clan) and how many
 * current members — themselves included — gave an order (`last_progress_at`, the Silent Space
 * clock) since a day before `now`.
 */
export function clanRefineryColumns(playerId: SQL | string | null, now: Date) {
  const since = new Date(now.getTime() - REFINERY_ACTIVE_MS).toISOString();
  return {
    clanLevel: clanLevelColumn(playerId),
    clanActive: sql<number>`(select count(*)::int from clan_memberships me
      join clan_memberships m on m.clan_id = me.clan_id and m.left_at is null
      join players p on p.id = m.player_id
      where me.player_id = ${playerId} and me.left_at is null and p.last_progress_at >= ${since}::timestamptz)`,
  };
}

/** The share those columns buy; nothing outside a levelled clan. */
export const clanRefineryShare = (columns: { clanLevel: number | null; clanActive: number } | undefined): number =>
  columns?.clanLevel == null ? 0 : clanRefineryBonus(columns.clanLevel, columns.clanActive);
