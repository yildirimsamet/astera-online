import { and, asc, desc, eq, gt, notInArray } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { honorSeasons, honorTotals, players } from '../db/schema.js';

type Place = 1 | 2 | 3;
interface HonorPodium { active: boolean; ranks: ReadonlyMap<string, Place> }

/** Positive achievements only; tied ranks follow the same competition ladder. A bot
 * is crowned like anybody, since a crown that skips a ladder place would expose it. */
export async function honorPodium(db: Queryable, seasonId: string, excluded: ReadonlySet<string>): Promise<HonorPodium> {
  const [config] = await db.select({ mode: honorSeasons.mode }).from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
  if (config?.mode !== 'ACTIVE') return { active: false, ranks: new Map() };
  const rows = await db.select({ id: players.id, score: honorTotals.score }).from(honorTotals)
    .innerJoin(players, and(eq(players.id, honorTotals.playerId), eq(players.seasonId, seasonId)))
    .where(and(eq(honorTotals.seasonId, seasonId), gt(honorTotals.score, 0),
      excluded.size > 0 ? notInArray(players.id, [...excluded]) : undefined))
    .orderBy(desc(honorTotals.score), asc(players.id));
  const ranks = new Map<string, Place>();
  let rank = 0;
  for (const [index, row] of rows.entries()) {
    if (index === 0 || rows[index - 1]?.score !== row.score) rank = index + 1;
    if (rank > 3) break;
    if (rank === 1 || rank === 2 || rank === 3) ranks.set(row.id, rank);
  }
  return { active: true, ranks };
}

/** Keep Dominion on the wire for compatibility; new clients identify the primary podium. */
export function applyHonorPodium<World extends { controller: { kind: string; playerId?: string } }>(
  worlds: readonly World[], podium: HonorPodium,
): (World & { honorRanking?: true; honorRank?: Place })[] {
  return worlds.map(world => !podium.active ? world : { ...world, honorRanking: true,
    honorRank: world.controller.kind === 'PLAYER' && world.controller.playerId !== undefined
      ? podium.ranks.get(world.controller.playerId) : undefined });
}
