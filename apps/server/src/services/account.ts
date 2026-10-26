import { and, eq, not } from 'drizzle-orm';
import { accountIsBanned } from './accountBan.js';
import type { Db } from '../db/client.js';
import { accounts, accountRewards } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { normaliseUsername } from '../auth/credentials.js';
import { normaliseEmail } from '../auth/email.js';
import { GameError } from './planet.js';
import { BRAND_RECALL, findProfanity, type CountryCode } from '@astera/rules';

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
  country: CountryCode;
  authVersion: number;
  /** Owner-only session hint, never part of the public commander identity. */
  loginEmail?: string;
}

const publicShape = (row: {
  id: string;
  username: string;
  displayName: string;
  countryCode: CountryCode;
  authVersion: number;
  email: string | null;
  emailVerifiedAt: Date | null;
}): AccountRecord => ({
  id: row.id,
  username: row.username,
  displayName: row.displayName,
  country: row.countryCode,
  authVersion: row.authVersion,
  ...(row.emailVerifiedAt !== null && row.email !== null ? { loginEmail: row.email } : {}),
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
  input: { username: string; password: string; countryCode?: CountryCode; communityPolicyVersion?: string; communityPolicyLocale?: ChatLanguage },
  firstGameShieldAvailable = true,
  now = new Date(),
): Promise<AccountRecord> {
  const word = findProfanity(input.username);
  if (word) throw new GameError('NAME_NOT_ALLOWED', 'Choose another commander name', 400, { word });
  const username = normaliseUsername(input.username);
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(accounts)
      .values({
        username,
        passwordHash,
        // The typed casing is what other players read; the folded one is the key.
        displayName: input.username.trim(),
        firstGameShieldAvailable,
        ...(input.countryCode === undefined ? {} : { countryCode: input.countryCode }),
      })
      .onConflictDoNothing({ target: accounts.username })
      .returning();

    if (!created) {
      throw new GameError('USERNAME_TAKEN', 'That name is already flying', 409);
    }
    if (input.communityPolicyVersion !== undefined) {
      requireCurrentCommunityPolicy(input.communityPolicyVersion);
      await recordCommunityPolicy(tx, created.id, input.communityPolicyLocale ?? 'en', now);
    }
    // Only creation enrolls a commander. Login, claim retries and season rollover
    // must never turn an established account into a first-session quiz candidate.
    await tx.insert(accountRewards).values({
      accountId: created.id,
      rewardId: BRAND_RECALL.rewardId,
      createdAt: now,
    });
    return publicShape(created);
  });
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
  const identifier = input.username.trim();
  const emailLogin = identifier.includes('@');
  const [row] = await db.select().from(accounts).where(and(not(accountIsBanned), emailLogin
    ? eq(accounts.email, normaliseEmail(identifier))
    : eq(accounts.username, normaliseUsername(identifier))));

  const ok = await verifyPassword(input.password, row?.passwordHash ?? (await decoyHash()));
  if (!row || !ok || row.deletionApprovedAt !== null || (emailLogin ? !row.emailVerifiedAt : row.emailVerifiedAt !== null)) {
    throw new GameError('BAD_CREDENTIALS', 'That name and password do not match', 401);
  }
  return publicShape(row);
}

export async function findAccount(db: Pick<Db, 'select'>, accountId: string): Promise<AccountRecord | null> {
  const [row] = await db.select().from(accounts).where(and(eq(accounts.id, accountId), not(accountIsBanned)));
  return row?.deletionApprovedAt === null ? publicShape(row) : null;
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
  (decoy ??= hashPassword('astera-decoy-never-a-real-password'));
import { recordCommunityPolicy, requireCurrentCommunityPolicy } from './communityPolicy.js';
import type { ChatLanguage } from '@astera/rules';
