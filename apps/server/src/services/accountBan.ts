import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { accounts, adminActions, nativeSessions } from '../db/schema.js';
import { GameError } from './planet.js';

/** Durable moderation decisions; checked with the account on every auth fence. */
export const accountIsBanned = sql<boolean>`coalesce((
  select ${adminActions.action} = 'ACCOUNT_BANNED'
    and ((${adminActions.details}->>'expiresAt') is null
      or (${adminActions.details}->>'expiresAt')::timestamptz > current_timestamp)
  from ${adminActions}
  where ${adminActions.targetAccountId} = ${accounts.id}
    and ${adminActions.action} in ('ACCOUNT_BANNED', 'ACCOUNT_UNBANNED')
  order by ${adminActions.createdAt} desc, ${adminActions.id} desc limit 1
), false)`;

export async function banAccount(db: Db, input: { accountId: string; reason: string; at: Date; expiresAt?: Date }) {
  if (input.expiresAt && !(input.expiresAt.getTime() > input.at.getTime())) {
    throw new GameError('INVALID_BAN_EXPIRY', 'Ban expiry must be after its start', 400);
  }
  return db.transaction(async tx => {
    const [account] = await tx.select().from(accounts).where(eq(accounts.id, input.accountId)).for('update');
    if (!account) throw new GameError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
    const [decision] = await tx.select().from(adminActions).where(and(
      eq(adminActions.targetAccountId, account.id), inArray(adminActions.action, ['ACCOUNT_BANNED', 'ACCOUNT_UNBANNED']),
    )).orderBy(desc(adminActions.createdAt), desc(adminActions.id)).limit(1);
    if (decision?.action === 'ACCOUNT_BANNED' && (typeof decision.details.expiresAt !== 'string'
      || new Date(decision.details.expiresAt).getTime() > input.at.getTime())) return decision;
    const authVersion = account.authVersion + 1;
    await tx.update(accounts).set({ authVersion }).where(eq(accounts.id, account.id));
    await tx.update(nativeSessions).set({ revokedAt: input.at }).where(and(
      eq(nativeSessions.accountId, account.id), isNull(nativeSessions.revokedAt),
    ));
    const [receipt] = await tx.insert(adminActions).values({
      targetAccountId: account.id, action: 'ACCOUNT_BANNED', createdAt: input.at,
      details: { reason: input.reason, previousAuthVersion: account.authVersion, authVersion,
        ...(input.expiresAt ? { expiresAt: input.expiresAt.toISOString() } : {}) },
    }).returning();
    return receipt;
  });
}
