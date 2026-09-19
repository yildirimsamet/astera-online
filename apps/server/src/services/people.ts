import { and, eq, sql } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { botProfiles, players } from '../db/schema.js';

/**
 * A GALAXY'S CAPACITY IS PEOPLE. Owner instruction, 2026-09-19.
 *
 * The server's own commanders stand on their own band of addresses
 * (`MULTI_WORLD.botSlots`), so a seat one of them holds is never a seat a person
 * could have had. Every capacity check — joining, the galaxy list, the waiting
 * galaxies, a transfer — counts through here, so the four can never disagree
 * about who fills a galaxy.
 */
export const isPerson = sql`NOT EXISTS (
  SELECT 1 FROM ${botProfiles} WHERE ${botProfiles.accountId} = ${players.accountId}
)`;

/** How many people — never the server's own commanders — hold a seat in this season. */
export async function peopleIn(db: Queryable, seasonId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(players)
    .where(and(eq(players.seasonId, seasonId), isPerson));
  return row?.n ?? 0;
}
