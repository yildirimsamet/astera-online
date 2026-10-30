import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, not } from 'drizzle-orm';
import { accountIsBanned } from './accountBan.js';
import type { Db } from '../db/client.js';
import { accounts, nativeSessions } from '../db/schema.js';
import type { Clock } from '../clock.js';
import type { IdentityGrant } from '../auth/identityCache.js';
import type { TokenService } from '../auth/tokens.js';
import { findAccount, type AccountRecord } from './account.js';
import { GameError } from './planet.js';

const digest = (credential: string): string => createHash('sha256').update(credential).digest('hex');
const badSession = () => new GameError('BAD_SESSION', 'Session is invalid or expired', 401);

/** Credentials cross native HTTP only. The native bridge persists them before exposing access. */
export class NativeSessions {
  constructor(private readonly db: Db, private readonly clock: Clock, private readonly tokens: TokenService) {}

  async open(account: AccountRecord) {
    const id = randomUUID();
    const credential = randomBytes(32).toString('base64url');
    const now = this.clock.now();
    await this.db.transaction(async tx => {
      const current = await findAccount(tx, account.id);
      if (current?.authVersion !== account.authVersion) throw badSession();
      await tx.insert(nativeSessions).values({ id, accountId: account.id, version: account.authVersion,
        refreshHash: digest(credential), expiresAt: this.expiry(now), createdAt: now });
    });
    return { ...await this.describe(account, id), refreshToken: credential };
  }

  async refresh(input: { sessionId: string; refreshToken: string; nextRefreshToken: string }) {
    const hash = digest(input.refreshToken);
    const nextHash = digest(input.nextRefreshToken);
    const now = this.clock.now();
    const account = await this.db.transaction(async tx => {
      const [session] = await tx.select().from(nativeSessions).where(eq(nativeSessions.id, input.sessionId)).for('update');
      if (!session || session.revokedAt || session.expiresAt <= now) return null;
      const current = await findAccount(tx, session.accountId);
      if (current?.authVersion !== session.version) return null;
      if (session.refreshHash === hash && session.previousHash !== nextHash) {
        await tx.update(nativeSessions).set({ previousHash: hash, refreshHash: nextHash, expiresAt: this.expiry(now) })
          .where(eq(nativeSessions.id, session.id));
        return current;
      }
      // The bridge persisted both values before sending: a lost response is safe to retry.
      if (session.previousHash === hash && session.refreshHash === nextHash) return current;
      if (session.previousHash === hash) {
        // Return outside this transaction; throwing here would roll back the revocation.
        await tx.update(nativeSessions).set({ revokedAt: now }).where(eq(nativeSessions.id, session.id));
      }
      return null;
    });
    if (!account) throw badSession();
    return this.describe(account, input.sessionId);
  }

  async logout(input: { sessionId: string; refreshToken: string }): Promise<void> {
    const hash = digest(input.refreshToken);
    await this.db.transaction(async tx => {
      const [session] = await tx.select().from(nativeSessions).where(eq(nativeSessions.id, input.sessionId)).for('update');
      if (session && !session.revokedAt && (session.refreshHash === hash || session.previousHash === hash)) {
        await tx.update(nativeSessions).set({ revokedAt: this.clock.now() }).where(eq(nativeSessions.id, session.id));
      }
    });
  }

  /** Plain read for request/stream fences; never write or take a lock per frame. Its expiry while current, else null. */
  async currentGrant(id: string, accountId: string, version: number): Promise<IdentityGrant | null> {
    const [row] = await this.db.select({ until: nativeSessions.expiresAt }).from(nativeSessions)
      .innerJoin(accounts, eq(accounts.id, nativeSessions.accountId))
      .where(and(eq(nativeSessions.id, id), eq(nativeSessions.accountId, accountId),
        eq(nativeSessions.version, version), eq(accounts.authVersion, version),
        isNull(accounts.deletionApprovedAt), not(accountIsBanned),
        isNull(nativeSessions.revokedAt), gt(nativeSessions.expiresAt, this.clock.now())));
    return row ?? null;
  }

  private expiry(now: Date): Date { return new Date(now.getTime() + this.tokens.refreshDays * 86_400_000); }

  private async describe(account: AccountRecord, nativeSessionId: string) {
    return { accountId: account.id, username: account.username, displayName: account.displayName,
      country: account.country, accessToken: await this.tokens.issueAccess(account.id, account.authVersion, nativeSessionId),
      nativeSessionId, ...(account.loginEmail === undefined ? {} : { loginEmail: account.loginEmail }) };
  }
}
