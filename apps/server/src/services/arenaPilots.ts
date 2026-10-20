import { desc, eq } from 'drizzle-orm';
import { normaliseUsername } from '../auth/credentials.js';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { accounts, arenaPilots } from '../db/schema.js';
import { GameError } from './planet.js';

/** Who may fly the Komutan Gemisi playtest, newest seat first. */
export function listArenaPilots(db: Db) {
  return db.select({ accountId: accounts.id, username: accounts.username, name: accounts.displayName, grantedAt: arenaPilots.grantedAt })
    .from(arenaPilots).innerJoin(accounts, eq(accounts.id, arenaPilots.accountId)).orderBy(desc(arenaPilots.grantedAt));
}

/** Seats or unseats one commander; repeating either is harmless. */
export async function setArenaPilot(db: Db, clock: Clock, operatorAccountId: string, username: string, pilot: boolean) {
  const [account] = await db.select({ id: accounts.id, name: accounts.displayName }).from(accounts)
    .where(eq(accounts.username, normaliseUsername(username)));
  if (!account) throw new GameError('ACCOUNT_NOT_FOUND', 'Account not found', 404);
  if (pilot) {
    await db.insert(arenaPilots).values({ accountId: account.id, grantedByAccountId: operatorAccountId, grantedAt: clock.now() })
      .onConflictDoNothing();
  } else {
    await db.delete(arenaPilots).where(eq(arenaPilots.accountId, account.id));
  }
  return { accountId: account.id, username: account.name, pilot };
}
