import { and, eq, inArray } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { accounts, players } from '../db/schema.js';

/** Admin authority is configured outside the database and cannot be granted by an API call. */
export async function isAdminAccount(
  db: Queryable,
  accountId: string,
  allowedUsernames: ReadonlySet<string>,
): Promise<boolean> {
  if (allowedUsernames.size === 0) return false;
  const [account] = await db
    .select({ username: accounts.username })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  return account !== undefined && allowedUsernames.has(account.username);
}

/**
 * Player identities owned by an out-of-band admin account in one season.
 *
 * Admin authority is deliberately not stored on a player or a planet, so the
 * public galaxy cannot safely infer this from either row. Resolve the configured
 * usernames at the response boundary instead: callers may then omit those worlds
 * without adding a client-visible `isAdmin` flag that would merely advertise the
 * hidden identity.
 */
export async function adminPlayerIdsInSeason(
  db: Queryable,
  seasonId: string,
  allowedUsernames: ReadonlySet<string>,
): Promise<Set<string>> {
  if (allowedUsernames.size === 0) return new Set();
  const rows = await db
    .select({ playerId: players.id })
    .from(players)
    .innerJoin(accounts, eq(accounts.id, players.accountId))
    .where(and(
      eq(players.seasonId, seasonId),
      inArray(accounts.username, [...allowedUsernames]),
    ));
  return new Set(rows.map((row) => row.playerId));
}
