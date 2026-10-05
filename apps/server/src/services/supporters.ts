import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Db, Queryable } from '../db/client.js';
import { accounts, cosmeticEntitlements, players } from '../db/schema.js';
import { normaliseUsername } from '../auth/credentials.js';
import { publishGlobal } from '../stream/bus.js';
import { GameError } from './planet.js';

export const SUPPORTER_BADGE_ID = 'badge-supporter';

/** Recognition follows the account, not a seasonal commander or a skin purchase. */
export async function supporterPlayers(db: Queryable, playerIds: readonly string[]): Promise<Set<string>> {
  if (playerIds.length === 0) return new Set();
  const rows = await db.select({ playerId: players.id }).from(players)
    .innerJoin(cosmeticEntitlements, eq(cosmeticEntitlements.accountId, players.accountId))
    .where(and(inArray(players.id, [...new Set(playerIds)]),
      eq(cosmeticEntitlements.cosmeticId, SUPPORTER_BADGE_ID), isNull(cosmeticEntitlements.revokedAt)));
  return new Set(rows.map((row) => row.playerId));
}

/** Manual and reversible. Keep the ledger across wipes; serialize opposite/repeated requests. */
export async function setSupporterStatus(
  db: Db, clock: Clock, operatorAccountId: string, username: string, supporter: boolean,
) {
  return db.transaction(async (tx) => {
    const [account] = await tx.select({ id: accounts.id, displayName: accounts.displayName }).from(accounts)
      .where(eq(accounts.username, normaliseUsername(username))).for('update');
    if (!account) throw new GameError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
    const active = and(eq(cosmeticEntitlements.accountId, account.id),
      eq(cosmeticEntitlements.cosmeticId, SUPPORTER_BADGE_ID), isNull(cosmeticEntitlements.revokedAt));
    const [existing] = await tx.select({ grantedAt: cosmeticEntitlements.grantedAt })
      .from(cosmeticEntitlements).where(active).limit(1);
    if (supporter === (existing !== undefined)) {
      return { accountId: account.id, username: account.displayName, supporter, grantedAt: existing?.grantedAt ?? null };
    }
    const now = clock.now();
    if (supporter) {
      await tx.insert(cosmeticEntitlements).values({ accountId: account.id, cosmeticId: SUPPORTER_BADGE_ID,
        source: 'MANUAL', orderRef: `supporter:${randomUUID()}`, grantedByAccountId: operatorAccountId, grantedAt: now });
    } else {
      await tx.update(cosmeticEntitlements).set({ revokedAt: now }).where(active);
    }
    // DMs may cross galaxies. Broadcast only a chat invalidation, without account details.
    await publishGlobal(tx, 'chat-badges');
    return { accountId: account.id, username: account.displayName, supporter, grantedAt: supporter ? now : null };
  });
}
