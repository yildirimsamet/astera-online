import { and, eq } from 'drizzle-orm';
import type { Tx } from '../db/client.js';
import { monumentWaves, players, seasons, shards } from '../db/schema.js';
import { reconcileMonumentTargets } from './monumentView.js';

/** Profile reads must reconcile real duty, including an overdue last ship death. */
export async function syncLegacyMonumentDuty(tx: Tx, input: {
  accountId: string; at: Date; adminUsernames: readonly string[];
}): Promise<void> {
  const rows = await tx.selectDistinct({ monumentId: monumentWaves.monumentId, playerId: players.id,
    seasonId: seasons.id, endsAt: seasons.endsAt }).from(monumentWaves)
    .innerJoin(players, eq(players.id, monumentWaves.playerId)).innerJoin(seasons, eq(seasons.id, monumentWaves.seasonId))
    .innerJoin(shards, eq(shards.id, seasons.shardId)).where(and(eq(players.accountId, input.accountId),
      eq(monumentWaves.status, 'HOLD'), eq(seasons.status, 'live'), eq(shards.role, 'MAIN')));
  const groups = new Map<string, { playerId: string; endsAt: Date; targets: Set<string> }>();
  for (const row of rows) {
    const group = groups.get(row.seasonId) ?? { playerId: row.playerId, endsAt: row.endsAt, targets: new Set<string>() };
    group.targets.add(row.monumentId);
    groups.set(row.seasonId, group);
  }
  for (const [seasonId, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    await reconcileMonumentTargets(tx, { seasonId, playerId: group.playerId,
      at: new Date(Math.min(input.at.getTime(), group.endsAt.getTime())), adminUsernames: input.adminUsernames }, [...group.targets].sort());
  }
}
