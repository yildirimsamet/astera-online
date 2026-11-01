import { and, asc, count, eq, gt, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { accounts, legacyAwards, players, seasons, shards } from '../db/schema.js';
import { preserveLegacySeasonEvents } from './legacyArchive.js';
import { refreshLegacyAwards } from './legacy.js';

interface BootstrapResult { processed: number; awardsAdded: number; nextCursor: string | null }
class BootstrapPreview extends Error {
  constructor(readonly result: BootstrapResult) { super('Legacy bootstrap preview complete'); }
}

/** Bounded rollout reconciliation: retained live receipts first, account-only rights second. */
export async function bootstrapLegacyBatch(db: Db, input: {
  scope: 'players' | 'accounts'; at: Date; limit: number; apply: boolean; cursor?: string;
}): Promise<BootstrapResult> {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 24) throw new RangeError('Legacy batch limit must be 1–24');
  try {
    return await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('legacy-backfill'))`);
      const rows = input.scope === 'players'
        ? await tx.select({ id: players.id, accountId: players.accountId, seasonId: players.seasonId }).from(players)
          .innerJoin(seasons, eq(seasons.id, players.seasonId)).innerJoin(shards, eq(shards.id, seasons.shardId))
          .where(and(eq(seasons.status, 'live'), eq(shards.role, 'MAIN'), input.cursor ? gt(players.id, input.cursor) : undefined))
          .orderBy(asc(players.id)).limit(input.limit + 1)
        : (await tx.select({ id: accounts.id }).from(accounts).where(input.cursor ? gt(accounts.id, input.cursor) : undefined)
          .orderBy(asc(accounts.id)).limit(input.limit + 1)).map(row => ({ ...row, accountId: row.id, seasonId: null }));
      const page = rows.slice(0, input.limit), owners = [...new Set(page.map(row => row.accountId))].sort();
      const [before] = owners.length === 0 ? [] : await tx.select({ n: count() }).from(legacyAwards).where(inArray(legacyAwards.accountId, owners));
      for (const row of page) {
        if (row.seasonId !== null) await preserveLegacySeasonEvents(tx, row.seasonId, input.at, row.id);
      }
      for (const owner of owners) await refreshLegacyAwards(tx, owner, input.at);
      const [after] = owners.length === 0 ? [] : await tx.select({ n: count() }).from(legacyAwards).where(inArray(legacyAwards.accountId, owners));
      const result = { processed: page.length, awardsAdded: (after?.n ?? 0) - (before?.n ?? 0),
        nextCursor: rows.length > input.limit ? page.at(-1)!.id : null };
      if (!input.apply) throw new BootstrapPreview(result);
      return result;
    }, { isolationLevel: 'repeatable read' });
  } catch (error) {
    if (error instanceof BootstrapPreview) return error.result;
    throw error;
  }
}
