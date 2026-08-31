import { and, asc, eq } from 'drizzle-orm';
import type { ResearchProjectId } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { researchOrders } from '../db/schema.js';
import { researchLevels } from './researchState.js';

export type ResearchOrder = typeof researchOrders.$inferSelect;

export async function activeResearchOrders(
  db: Queryable,
  playerId: string,
): Promise<ResearchOrder[]> {
  return db
    .select()
    .from(researchOrders)
    .where(and(
      eq(researchOrders.playerId, playerId),
      eq(researchOrders.status, 'BUILDING'),
    ))
    .orderBy(asc(researchOrders.slot));
}

/** Durable levels plus every rung already paid for in the commander's queue. */
export async function projectedResearchLevels(
  db: Queryable,
  playerId: string,
  orders?: readonly ResearchOrder[],
): Promise<Map<ResearchProjectId, number>> {
  const levels = await researchLevels(db, playerId);
  const queued = orders ?? await activeResearchOrders(db, playerId);
  for (const order of queued) {
    levels.set(order.projectId, Math.max(levels.get(order.projectId) ?? 0, order.level));
  }
  return levels;
}

export const researchOrderView = (order: ResearchOrder) => ({
  id: order.id,
  slot: order.slot,
  projectId: order.projectId,
  level: order.level,
  startedAt: order.startedAt,
  finishesAt: order.readyAt,
  cost: order.cost,
});
