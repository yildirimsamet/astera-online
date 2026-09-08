import { eq, or, sql } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { commanderTransfers } from '../db/schema.js';

/** A report remains personal history, but relocation breaks its link to a live address. */
export async function spatialHistory(db: Queryable, observerId: string, worldIds: string[]) {
  const ids = [...new Set(worldIds)];
  const moves = await db.select({ playerId: commanderTransfers.playerId, at: commanderTransfers.committedAt, worlds: commanderTransfers.worlds })
    .from(commanderTransfers).where(or(eq(commanderTransfers.playerId, observerId), ids.length > 0
      ? sql`exists (select 1 from jsonb_array_elements(${commanderTransfers.worlds}) as w where w->>'id' in (${sql.join(ids.map(id => sql`${id}`), sql`, `)}))`
      : undefined));
  let observerMovedAt = -Infinity;
  const movedAt = new Map<string, number>();
  for (const move of moves) {
    const at = move.at.getTime();
    if (move.playerId === observerId) observerMovedAt = Math.max(observerMovedAt, at);
    for (const world of move.worlds) movedAt.set(world.id, Math.max(movedAt.get(world.id) ?? -Infinity, at));
  }
  return (worldId: string | null, at: Date): boolean => worldId !== null
    && at.getTime() > Math.max(observerMovedAt, movedAt.get(worldId) ?? -Infinity);
}
