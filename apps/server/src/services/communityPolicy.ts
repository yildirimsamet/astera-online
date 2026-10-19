import { and, eq, ne } from 'drizzle-orm';
import { COMMUNITY_POLICY_VERSION, type ChatLanguage } from '@astera/rules';
import type { Db, Queryable, Tx } from '../db/client.js';
import type { Clock } from '../clock.js';
import { accounts, communityPolicyAcceptances } from '../db/schema.js';
import { GameError } from './planet.js';

export function requireCurrentCommunityPolicy(version: unknown): typeof COMMUNITY_POLICY_VERSION {
  if (version !== COMMUNITY_POLICY_VERSION) throw new GameError('COMMUNITY_POLICY_REQUIRED', 'Review and accept the current community rules', 403);
  return COMMUNITY_POLICY_VERSION;
}
export async function communityPolicyStatus(db: Queryable, accountId: string) {
  const [record] = await db.select().from(communityPolicyAcceptances).where(eq(communityPolicyAcceptances.accountId, accountId));
  return { version: COMMUNITY_POLICY_VERSION, acceptedAt: record?.version === COMMUNITY_POLICY_VERSION ? record.acceptedAt.toISOString() : null };
}
export async function recordCommunityPolicy(tx: Tx, accountId: string, locale: ChatLanguage, now: Date): Promise<void> {
  await tx.insert(communityPolicyAcceptances).values({ accountId, version: COMMUNITY_POLICY_VERSION, locale, acceptedAt: now })
    .onConflictDoUpdate({ target: communityPolicyAcceptances.accountId,
      set: { version: COMMUNITY_POLICY_VERSION, locale, acceptedAt: now }, setWhere: ne(communityPolicyAcceptances.version, COMMUNITY_POLICY_VERSION) });
}
export async function acceptCommunityPolicy(db: Db, clock: Clock, accountId: string, version: unknown, locale: ChatLanguage) {
  requireCurrentCommunityPolicy(version);
  return db.transaction(async tx => {
    const [account] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)).for('key share');
    if (!account) throw new GameError('ACCOUNT_NOT_FOUND', 'Account unavailable', 404);
    await recordCommunityPolicy(tx, accountId, locale, clock.now()); return communityPolicyStatus(tx, accountId);
  });
}
export async function assertCommunityPolicyAccepted(db: Queryable, accountId: string): Promise<void> {
  const [record] = await db.select({ id: communityPolicyAcceptances.accountId }).from(communityPolicyAcceptances)
    .where(and(eq(communityPolicyAcceptances.accountId, accountId), eq(communityPolicyAcceptances.version, COMMUNITY_POLICY_VERSION)));
  if (!record) throw new GameError('COMMUNITY_POLICY_REQUIRED', 'Review and accept the current community rules', 403);
}
