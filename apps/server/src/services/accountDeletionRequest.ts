import { and, asc, eq, sql } from 'drizzle-orm';
import type { Db, Tx } from '../db/client.js';
import type { Clock } from '../clock.js';
import { accountDeletionRequests, accounts, adminActions, mediaDeletionQueue, players, seasons } from '../db/schema.js';
import { verifyPassword } from '../auth/password.js';
import { normaliseUsername } from '../auth/credentials.js';
import { takeSecurityCounter } from './mail.js';
import { GameError } from './planet.js';
import { deleteRequestedAccount } from './accountDeletion.js';
import { writeErasureIntent, type ErasureJournalContext } from './erasureJournal.js';

const receipt = (request: typeof accountDeletionRequests.$inferSelect) => ({
  requestId: request.requestId, requestedAt: request.requestedAt.toISOString(), status: request.approvedAt ? 'approved' as const : 'requested' as const,
});

async function recordRequest(tx: Tx, accountId: string, locale: string, now: Date) {
  const [created] = await tx.insert(accountDeletionRequests).values({ accountId, requestedAt: now, locale }).onConflictDoNothing({ target: accountDeletionRequests.accountId }).returning();
  const [request] = created ? [created] : await tx.select().from(accountDeletionRequests).where(eq(accountDeletionRequests.accountId, accountId));
  if (!request) throw new Error('Deletion request was not recorded');
  return { request, created: !!created };
}

/** Support ownership verification is an explicit operator responsibility, never a public bypass. */
export async function recordSupportDeletionRequest(db: Db, clock: Clock, username: string, locale: string, actorAccountId: string) {
  return db.transaction(async tx => {
    const [account] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.username, normaliseUsername(username))).for('update');
    if (!account) throw new GameError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
    const now = clock.now();
    const result = await recordRequest(tx, account.id, locale, now);
    if (result.created) await tx.insert(adminActions).values({ actorAccountId, targetAccountId: account.id, action: 'ACCOUNT_DELETION_SUPPORT_REQUEST', details: { requestId: result.request.requestId }, createdAt: now });
    return { request: receipt(result.request) };
  });
}

export async function accountDeletionStatus(db: Db, accountId: string) {
  const [request] = await db.select().from(accountDeletionRequests).where(eq(accountDeletionRequests.accountId, accountId));
  return { request: request ? receipt(request) : null };
}

/** Operator queue is bounded and contains no password, email or session credential. */
export async function listAccountDeletionRequests(db: Db) {
  const requests = await db.select({ request: accountDeletionRequests, accountId: accounts.id, username: accounts.username, displayName: accounts.displayName })
    .from(accountDeletionRequests).innerJoin(accounts, eq(accounts.id, accountDeletionRequests.accountId))
    .orderBy(asc(accountDeletionRequests.requestedAt), asc(accountDeletionRequests.requestId)).limit(100);
  const mediaPending = await db.select({ requestId: mediaDeletionQueue.requestId, files: sql<number>`count(*)::int` }).from(mediaDeletionQueue)
    .groupBy(mediaDeletionQueue.requestId).orderBy(sql`min(${mediaDeletionQueue.createdAt})`, asc(mediaDeletionQueue.requestId)).limit(100);
  return { requests: requests.map(row => ({ ...receipt(row.request), accountId: row.accountId, username: row.username, displayName: row.displayName })), mediaPending };
}

/** Approval closes access atomically; it never destroys worlds or accelerates flights. */
export async function approveAccountDeletion(db: Db, clock: Clock, requestId: string, actorAccountId: string, journal: ErasureJournalContext) {
  const [initial] = await db.select().from(accountDeletionRequests).where(eq(accountDeletionRequests.requestId, requestId));
  const missing = () => new GameError('DELETION_REQUEST_NOT_FOUND', 'Deletion request not found', 404);
  if (!initial) throw missing();
  return db.transaction(async tx => {
    const [account] = await tx.select().from(accounts).where(eq(accounts.id, initial.accountId)).for('update');
    const [request] = await tx.select().from(accountDeletionRequests).where(eq(accountDeletionRequests.requestId, requestId)).for('update');
    if (!account || !request) throw missing();
    if (request.approvedAt) {
      await writeErasureIntent(journal, { ...request, approvedAt: request.approvedAt }, clock.now());
      return { request: receipt(request) };
    }
    const now = clock.now();
    await tx.update(accounts).set({ authVersion: account.authVersion + 1, deletionApprovedAt: now }).where(eq(accounts.id, account.id));
    const [approved] = await tx.update(accountDeletionRequests).set({ approvedAt: now }).where(eq(accountDeletionRequests.requestId, requestId)).returning();
    if (!approved) throw new Error('Deletion approval was not recorded');
    await tx.insert(adminActions).values({ actorAccountId, targetAccountId: account.id, action: 'ACCOUNT_DELETION_APPROVED', details: { requestId }, createdAt: now });
    await writeErasureIntent(journal, { ...approved, approvedAt: now }, now);
    return { request: receipt(approved) };
  });
}

/** Manual fulfillment is retryable; shared-flight and lifecycle contention defer it. */
export async function completeAccountDeletion(db: Db, clock: Clock, requestId: string, actorAccountId: string, journal: ErasureJournalContext) {
  const result = { requestId, status: 'completed' as const };
  return db.transaction(async tx => {
    await tx.execute(sql`set local lock_timeout = '250ms'`);
    // Per-request admission also coalesces concurrent completion retries across replicas.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`account-deletion:${requestId}`}, 0))`);
    const [completed] = await tx.select({ id: adminActions.id }).from(adminActions).where(and(eq(adminActions.action, 'ACCOUNT_DELETION_COMPLETED'), sql`${adminActions.details}->>'requestId' = ${requestId}`)).limit(1);
    if (completed) return result;
    const [request] = await tx.select().from(accountDeletionRequests).where(eq(accountDeletionRequests.requestId, requestId));
    if (!request) throw new GameError('DELETION_REQUEST_NOT_FOUND', 'Deletion request not found', 404);
    if (!request.approvedAt) throw new GameError('DELETION_NOT_APPROVED', 'Deletion has not been approved', 409);
    await writeErasureIntent(journal, { ...request, approvedAt: request.approvedAt }, clock.now());
    const [initial] = await tx.select().from(players).where(eq(players.accountId, request.accountId));
    if (initial) await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`placement:${initial.seasonId}`}, 0))`);
    const [lifecycle] = await tx.execute<{ acquired: boolean }>(sql`select pg_try_advisory_xact_lock(83202488) as acquired`);
    if (!lifecycle?.acquired) throw new GameError('DELETION_BUSY', 'The world is changing; retry later', 409);
    // An exclusive season row prevents a new incoming flight crossing the quiet check.
    if (initial) await tx.select({ id: seasons.id }).from(seasons).where(eq(seasons.id, initial.seasonId)).for('update');
    const [account] = await tx.select().from(accounts).where(eq(accounts.id, request.accountId)).for('update');
    const [current] = await tx.select().from(players).where(eq(players.accountId, request.accountId));
    if (!account || initial?.id !== current?.id || initial?.seasonId !== current?.seasonId || initial?.placementVersion !== current?.placementVersion) {
      throw new GameError('DELETION_BUSY', 'The world changed; retry later', 409);
    }
    await deleteRequestedAccount(tx, clock, request.accountId, requestId);
    await tx.insert(adminActions).values({ actorAccountId, action: 'ACCOUNT_DELETION_COMPLETED', details: { requestId }, createdAt: clock.now() });
    return result;
  }).catch((error: unknown) => {
    let current: unknown = error;
    for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth++) {
      if ('code' in current && typeof current.code === 'string' && ['55P03', '40P01', '57014'].includes(current.code)) throw new GameError('DELETION_BUSY', 'The world is busy; retry later', 409);
      current = 'cause' in current ? current.cause : undefined;
    }
    throw error;
  });
}

/** Authenticated identity is authoritative; the request cannot name another account. */
export async function requestAccountDeletion(db: Db, clock: Clock, accountId: string, version: number, password: string, locale: string) {
  const now = clock.now();
  // Shares the existing account-security guessing budget across operations and replicas.
  if (!await takeSecurityCounter(db, `password-check:${accountId}`, 10, 15 * 60_000, now)) {
    throw new GameError('RATE_LIMITED', 'Try later', 429, { seconds: 900 });
  }
  const [snapshot] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (snapshot?.authVersion !== version || !await verifyPassword(password, snapshot.passwordHash)) {
    throw new GameError('BAD_CREDENTIALS', 'Credentials do not match', 401);
  }
  return db.transaction(async tx => {
    const [current] = await tx.select().from(accounts).where(eq(accounts.id, accountId)).for('update');
    if (current?.authVersion !== version || current.passwordHash !== snapshot.passwordHash) {
      throw new GameError('UNAUTHENTICATED', 'Sign in again', 401);
    }
    const { request } = await recordRequest(tx, accountId, locale, now);
    return { request: receipt(request) };
  });
}
