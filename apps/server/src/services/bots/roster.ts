import { randomBytes } from 'node:crypto';
import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import type { Clock } from '../../clock.js';
import { accounts, botProfiles } from '../../db/schema.js';
import { hashPassword } from '../../auth/password.js';
import { normaliseUsername, USERNAME_PATTERN } from '../../auth/credentials.js';
import { GameError } from '../planet.js';
import { personaFor, type BotPersonaId } from './personas.js';

/**
 * THE POOL, AND THE OWNER FILLS IT BY HAND. D159.
 *
 * The one thing this system must never do is invent a name. A generated roster is
 * the tell — "Commander-07" beside "Kara Şahin" ends the illusion in one glance at
 * the leaderboard, and no amount of good behaviour afterwards recovers it. So the
 * seat count is a target the sweep works TOWARDS out of names it was given, never a
 * quota it fills.
 *
 * A bot's account is an ordinary account: same table, same folded-username index,
 * same scrypt. The password is real and random, printed once by the CLI and stored
 * nowhere — these commanders never sign in, and the only reason the value exists at
 * all is so the owner can take one over from a phone if they ever want to.
 */

export interface BotRosterEntry {
  accountId: string;
  displayName: string;
  username: string;
  ordinal: number;
  persona: BotPersonaId;
  nextActionAt: Date;
}

export interface AddedBot extends BotRosterEntry {
  /** Shown once, at the terminal, and never persisted in readable form. */
  password: string;
}

/**
 * Latin letters for the six Türkiye keeps, so a handle stays readable.
 *
 * `normaliseUsername` folds with `toLowerCase()`, which turns `İ` into `i̇` — an `i`
 * with a combining dot that `USERNAME_PATTERN` then rejects. That is a live trap
 * this project has already written down; the fix here is to never let a non-ASCII
 * letter reach the handle in the first place.
 */
const TRANSLITERATE: Readonly<Record<string, string>> = {
  ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
  Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U',
};
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/g;

/**
 * THE NAME AND THE KEY ARE TWO DIFFERENT THINGS, and conflating them is why this
 * does not go through `registerAccount`.
 *
 * `registerAccount` writes the typed name to BOTH `display_name` and the folded
 * `username`, which is right for a person choosing a login and wrong here: the
 * owner types the name other commanders will READ, and "Kara Şahin" is not a legal
 * handle. Other players never see a username, so the handle is free to be a
 * sanitised derivative — and it has to be legal, or the one account the owner might
 * genuinely want to sign into is the one they cannot.
 */
/**
 * Two typed names that are the same name.
 *
 * FOLDED IN TURKISH, not with a bare `toLowerCase()`. `'I'.toLowerCase()` is `'i'`
 * and `'İ'.toLowerCase()` is `'i'` plus a combining dot, so an ASCII fold makes
 * "Işık" and "İşık" neither equal nor unequal in any useful sense. The roster is
 * typed by a Turkish-speaking owner; the comparison uses their alphabet.
 */
const sameName = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase('tr') === b.trim().toLocaleLowerCase('tr');

const handleFor = (displayName: string): string => {
  const latin = displayName.replace(TURKISH, (ch) => TRANSLITERATE[ch] ?? ch);
  const stripped = latin.replace(/[^a-zA-Z0-9_]/g, '');
  return normaliseUsername(stripped.slice(0, 16).padEnd(3, '0'));
};

/**
 * Add one commander to the pool.
 *
 * `ordinal` is `max + 1` rather than `count`, so retiring one commander can never
 * hand its shift and its habits to a different one. It is the roster's identity.
 */
export async function addBot(db: Db, displayName: string, clock: Clock): Promise<AddedBot> {
  const name = displayName.trim();
  if (name.length === 0) throw new GameError('BAD_NAME', 'A commander needs a name', 400);

  const base = handleFor(name);
  if (!USERNAME_PATTERN.test(base)) {
    throw new GameError('BAD_NAME', `"${name}" does not reduce to a usable handle`, 400);
  }

  const password = randomBytes(18).toString('base64url');
  const passwordHash = await hashPassword(password);

  /*
    THE ACCOUNT AND ITS PROFILE ARE ONE COMMITMENT, NOT TWO.

    Written as two statements this leaks: the account lands, the profile insert then
    fails on the advisory lock or a dropped connection, and what is left is an
    account with no profile — invisible to `bots list`, never seated, and holding
    the name so the owner's next attempt quietly creates "karasahin1" instead. One
    transaction makes the failure a no-op rather than a mess somebody has to find.

    `pg_advisory_xact_lock` serialises the `max(ordinal) + 1` read against a second
    terminal doing the same thing; the unique index behind it is what would make the
    loser fail rather than collide.
  */
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(159159159)`);

    /*
      A HANDLE COLLISION IS NOT A REFUSAL; A NAME COLLISION IS.

      Two different names may sanitise to one handle ("Kara Şahin" and "Karasahin"),
      and refusing the second would be refusing a name for a reason the owner cannot
      see. A suffix settles it. Typing the same NAME twice is a different matter — it
      is a mistake, and two identical commanders on one leaderboard is exactly the
      oddity this whole design is avoiding.

      CHECKED AGAINST EVERY ACCOUNT, NOT JUST THE ROSTER. `registerAccount` writes a
      person's typed name to `display_name` AND to the folded `username`, so the
      unique index on the handle makes real commanders' names unique as a side
      effect. Decoupling the two here is what lets a bot carry "Kara Şahin" — and it
      is also what silently reintroduces the collision, against a real player who
      cannot do anything about it.
    */
    const taken = await tx.select({ displayName: accounts.displayName }).from(accounts);
    if (taken.some((row) => sameName(row.displayName, name))) {
      throw new GameError('USERNAME_TAKEN', `${name} is already flying in this galaxy`, 409);
    }

    let account: { id: string; username: string; displayName: string } | undefined;
    for (let attempt = 0; attempt < 20 && !account; attempt++) {
      const suffix = attempt === 0 ? '' : String(attempt);
      const username = `${base.slice(0, 16 - suffix.length)}${suffix}`;
      const [created] = await tx
        .insert(accounts)
        .values({ username, passwordHash, displayName: name })
        .onConflictDoNothing({ target: accounts.username })
        .returning({
          id: accounts.id,
          username: accounts.username,
          displayName: accounts.displayName,
        });
      account = created;
    }
    if (!account) throw new GameError('USERNAME_TAKEN', 'That name is already flying', 409);

    const [{ next } = { next: 0 }] = await tx
      .select({ next: sql<number>`coalesce(max(${botProfiles.ordinal}), -1) + 1` })
      .from(botProfiles);
    await tx.insert(botProfiles).values({
      accountId: account.id,
      ordinal: next,
      persona: personaFor(next).id,
      // Due immediately: the first sweep after seating gives them something to do.
      nextActionAt: clock.now(),
      createdAt: clock.now(),
    });

    return {
      accountId: account.id,
      displayName: account.displayName,
      username: account.username,
      ordinal: next,
      persona: personaFor(next).id,
      nextActionAt: clock.now(),
      password,
    };
  });
}

export async function listBots(db: Db): Promise<BotRosterEntry[]> {
  const rows = await db
    .select({
      accountId: botProfiles.accountId,
      ordinal: botProfiles.ordinal,
      persona: botProfiles.persona,
      nextActionAt: botProfiles.nextActionAt,
      displayName: accounts.displayName,
      username: accounts.username,
    })
    .from(botProfiles)
    .innerJoin(accounts, eq(accounts.id, botProfiles.accountId))
    .orderBy(asc(botProfiles.ordinal));
  return rows.map((row) => ({ ...row, persona: row.persona as BotPersonaId }));
}

/**
 * Take a commander off the roster WITHOUT deleting anything they own.
 *
 * The profile row is the only thing removed. The account, the world, the fleet and
 * every battle report anybody fought against them stay exactly where they are —
 * deleting a world is `reclaimIdleSeats`' job, it is destructive, and it takes other
 * people's history with it. What retiring does is stop the sweep driving them; the
 * world then goes quiet and is reclaimed on the ordinary three-day terms, like any
 * commander who stopped coming back.
 */
export async function retireBot(db: Db, displayName: string): Promise<boolean> {
  const username = normaliseUsername(displayName);
  const [account] = await db.select({ id: accounts.id })
    .from(accounts).where(eq(accounts.username, username));
  if (!account) return false;
  const removed = await db
    .delete(botProfiles)
    .where(eq(botProfiles.accountId, account.id))
    .returning({ ordinal: botProfiles.ordinal });
  return removed.length > 0;
}
