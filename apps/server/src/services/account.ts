import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { accounts } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { normaliseUsername } from '../auth/credentials.js';
import { GameError } from './planet.js';

/**
 * Accounts with a name and a password. D21.
 *
 * The account is global and permanent — it outlives every season, holds no power,
 * and is the thing that lets the same commander sign in from a second browser.
 * Where they are PLACED is a separate fact, in `players`, and is wiped with the
 * galaxy.
 */

export interface AccountRecord {
  id: string;
  username: string;
  displayName: string;
}

const publicShape = (row: {
  id: string;
  username: string;
  displayName: string;
}): AccountRecord => ({
  id: row.id,
  username: row.username,
  displayName: row.displayName,
});

/**
 * Create an account, or fail because the name is taken.
 *
 * `onConflictDoNothing` rather than a SELECT-then-INSERT: two registrations of the
 * same name in the same instant both pass a prior existence check and one of them
 * then explodes on the index. Letting the insert itself decide makes the race
 * impossible instead of unlikely, and an empty result is a plain value to test —
 * no error codes to sniff, no driver internals to depend on.
 */
export async function registerAccount(
  db: Db,
  input: { username: string; password: string },
): Promise<AccountRecord> {
  const username = normaliseUsername(input.username);
  const passwordHash = await hashPassword(input.password);

  const [created] = await db
    .insert(accounts)
    .values({
      username,
      passwordHash,
      // The typed casing is what other players read; the folded one is the key.
      displayName: input.username.trim(),
    })
    .onConflictDoNothing({ target: accounts.username })
    .returning();

  if (!created) {
    throw new GameError('USERNAME_TAKEN', 'That name is already flying', 409);
  }
  return publicShape(created);
}

/**
 * Sign in, or fail identically whatever went wrong.
 *
 * ONE ERROR FOR BOTH CAUSES. "No such commander" and "wrong password" must be
 * indistinguishable, or the endpoint becomes a way to enumerate who plays this
 * game. The hash is still verified against a decoy when the account is missing, so
 * the two paths take the same time as well as saying the same thing — a login that
 * fails in one millisecond and one that fails in forty are two different answers
 * however carefully the text is worded.
 */
export async function authenticate(
  db: Db,
  input: { username: string; password: string },
): Promise<AccountRecord> {
  const username = normaliseUsername(input.username);
  const [row] = await db.select().from(accounts).where(eq(accounts.username, username));

  const ok = await verifyPassword(input.password, row?.passwordHash ?? (await decoyHash()));
  if (!row || !ok) {
    throw new GameError('BAD_CREDENTIALS', 'That name and password do not match', 401);
  }
  return publicShape(row);
}

export async function findAccount(db: Db, accountId: string): Promise<AccountRecord | null> {
  const [row] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  return row ? publicShape(row) : null;
}

/**
 * A real scrypt hash of a string nobody knows, used only to burn the same work on
 * a missing account as on a present one.
 *
 * Computed on first use and kept, rather than written in as a literal, so it can
 * never drift from the current cost parameters — a decoy that is cheaper than the
 * real thing reintroduces exactly the timing signal it exists to remove.
 */
let decoy: Promise<string> | null = null;
const decoyHash = (): Promise<string> =>
  (decoy ??= hashPassword('blindspace-decoy-never-a-real-password'));
