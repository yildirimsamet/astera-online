import { CLAN } from '@astera/rules';
import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { clanMemberships, clans, players, starterDepartures } from '../db/schema.js';
import { activeClanMembership } from './clanCombat.js';

const DAY_MS = 86_400_000;
/** A clan counts as alive while one of its members acted in the last three days. */
const ACTIVE_MS = 3 * DAY_MS;

export interface ClanCandidate { id: string; name: string; tag: string; members: number; neighbours: number; lastActiveAt: Date }

/**
 * WHICH CLAN IS SUGGESTED (plan 2026-11-06 §7.3). A seat free; alive in the last three days; then the
 * one with the most former starter neighbours; then the one that acted last.
 */
export function pickClan(candidates: readonly ClanCandidate[], now: Date): ClanCandidate | null {
  const open = candidates.filter(clan => clan.members < CLAN.maxMembers && now.getTime() - clan.lastActiveAt.getTime() < ACTIVE_MS);
  return [...open].sort((a, b) => b.neighbours - a.neighbours || b.lastActiveAt.getTime() - a.lastActiveAt.getTime() || a.id.localeCompare(b.id))[0] ?? null;
}

/**
 * A CLAN ON THE LANDING DAY (Faz 4.5). Only on the first day after the jump, only to a commander in no
 * clan. Former neighbours are the commanders who jumped from the same starter galaxy.
 */
export async function clanSuggestion(db: Queryable, accountId: string, now: Date): Promise<Omit<ClanCandidate, 'lastActiveAt'> | null> {
  const [landing] = await db.select({ galaxy: starterDepartures.starterGalaxyId, at: starterDepartures.at })
    .from(starterDepartures).where(eq(starterDepartures.accountId, accountId)).orderBy(desc(starterDepartures.at)).limit(1);
  if (!landing || now.getTime() - landing.at.getTime() >= DAY_MS) return null;
  const [me] = await db.select({ id: players.id, seasonId: players.seasonId }).from(players).where(eq(players.accountId, accountId)).limit(1);
  if (!me || await activeClanMembership(db, me.id)) return null;

  const neighbours = (await db.select({ accountId: starterDepartures.accountId }).from(starterDepartures)
    .where(and(eq(starterDepartures.starterGalaxyId, landing.galaxy), ne(starterDepartures.accountId, accountId))))
    .map(row => row.accountId);
  const rows = await db.select({
    id: clans.id, name: clans.name, tag: clans.tag,
    members: sql<number>`count(${clanMemberships.id})::int`,
    neighbours: neighbours.length > 0
      ? sql<number>`count(${clanMemberships.id}) filter (where ${inArray(players.accountId, neighbours)})::int`
      : sql<number>`0`,
    lastActiveAt: sql<Date>`max(${players.lastActiveAt})`.mapWith((value: string | Date) => new Date(value)),
  }).from(clans)
    .innerJoin(clanMemberships, and(eq(clanMemberships.clanId, clans.id), isNull(clanMemberships.leftAt)))
    .innerJoin(players, eq(players.id, clanMemberships.playerId))
    .where(and(eq(clans.seasonId, me.seasonId), isNull(clans.disbandedAt), eq(clans.recruiting, true)))
    .groupBy(clans.id);
  const best = pickClan(rows, now);
  return best ? { id: best.id, name: best.name, tag: best.tag, members: best.members, neighbours: best.neighbours } : null;
}
