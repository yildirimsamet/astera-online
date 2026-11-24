import { and, asc, desc, eq, gt, gte, notInArray, sql } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { honorQuestTotals, honorSeasons, honorTotals, players } from '../db/schema.js';

type Place = 1 | 2 | 3;
export interface HonorPodium { active: boolean; ranks: ReadonlyMap<string, Place> }

/** Positive achievements only; tied ranks follow the same competition ladder. A bot
 * is crowned like anybody, since a crown that skips a ladder place would expose it. */
export async function honorPodium(db: Queryable, seasonId: string, excluded: ReadonlySet<string>): Promise<HonorPodium> {
  const [config] = await db.select({ mode: honorSeasons.mode }).from(honorSeasons).where(eq(honorSeasons.seasonId, seasonId));
  if (config?.mode !== 'ACTIVE') return { active: false, ranks: new Map() };
  // The ledger's total plus what the daily quests paid the seat (owner 2026-11-24: ordinary Honor), so a commander
  // who only did quests has a place too. Read from the seats of this season: the ledger row may not exist.
  const total = sql<number>`coalesce(${honorTotals.score}, 0) + coalesce(${honorQuestTotals.micros}, 0)`.mapWith(Number);
  const eligible = and(eq(players.seasonId, seasonId), gt(total, 0),
    excluded.size > 0 ? notInArray(players.id, [...excluded]) : undefined);
  const ledger = and(eq(honorTotals.playerId, players.id), eq(honorTotals.seasonId, seasonId));
  const quests = and(eq(honorQuestTotals.playerId, players.id), eq(honorQuestTotals.seasonId, seasonId));
  // Whoever ties the third score is still on the podium; nobody below it can be. Only those rows are read.
  const third = db.select({ score: total }).from(players).leftJoin(honorTotals, ledger).leftJoin(honorQuestTotals, quests)
    .where(eligible).orderBy(desc(total)).offset(2).limit(1);
  const rows = await db.select({ id: players.id, score: total }).from(players).leftJoin(honorTotals, ledger).leftJoin(honorQuestTotals, quests)
    .where(and(eligible, gte(total, sql`coalesce((${third}), 0)`)))
    .orderBy(desc(total), asc(players.id));
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
