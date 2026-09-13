/**
 * DELETING A PERSON, AT THEIR OWN REQUEST.
 *
 * `reclaim.ts` takes a SEASON PRESENCE from somebody who stopped coming back and
 * deliberately keeps the account, because they are expected to return. This takes
 * the account too, because they asked to be forgotten. There is no UI for it and
 * there should not be: it is an operator command, run once, for one person who
 * wrote in.
 *
 * ── IT DOES NOT HOLD A SECOND OPINION ABOUT WHAT A WORLD IS ─────────────────
 *
 * The whole destructive half is `commanderRows` / `busy` / `demolish`, imported
 * from `reclaim.ts` rather than restated. Those three are one set on purpose: a
 * caller that checks a different set from the one it deletes can delete something
 * it never checked was quiet, and this project has stranded a real player's fleet
 * that way once. A second implementation here would be exactly that hole, opened
 * again, in a command with no sweep behind it to notice.
 *
 * ── WHAT IS DIFFERENT FROM A RECLAIM ────────────────────────────────────────
 *
 *   1. A CAPTURED COLONY GOES BACK TO THE GALAXY. D209 seeds a season with 65
 *      caretaker worlds and `docs/deployment.md` accepts a live shard on
 *      `neutrals + colonies = 65`. A colony deleted outright is a world that has
 *      LEFT — one fewer thing for everybody else to fight over for the rest of the
 *      season, and that acceptance query permanently red. So the address is
 *      re-seeded through `createNeutralWorld`, from the same generator the season
 *      was born from: same slot, same tier, same profile seed, same name. An
 *      address the generator never put a neutral at — a Silent Space departure
 *      site — is simply left empty, because inventing one there would make a 66th
 *      world.
 *   2. THE ACCOUNT ROW GOES, and with it the once-and-for-ever ledger a reclaim
 *      protects. `account_rewards` survives a reclaim because the person is coming
 *      back; it cannot survive the person.
 *
 * ── AND WHAT IT REFUSES, IN WORDS ───────────────────────────────────────────
 *
 * Four guards, and each of them would otherwise be a constraint name in a stack
 * trace at three in the morning: a commander the server plays, an author of public
 * news, an account with Silent Space move history other people's return addresses
 * hang off, and a queued return application whose CHECK forbids the null this
 * deletion would write. Every one is answered before a single row is removed.
 */
import { and, eq, isNull } from 'drizzle-orm';
import {
  MULTI_WORLD,
  SERVERS,
  generateGalaxy,
  selectNeutralSlots,
  type NeutralTier,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { publishShard } from '../stream/bus.js';
import { normaliseUsername } from '../auth/credentials.js';
import {
  accountRewards,
  accounts,
  announcementReads,
  announcements,
  botProfiles,
  commanderTransfers,
  feedbackEntries,
  planets,
  players,
  returnApplications,
  seasonResults,
  seasons,
} from '../db/schema.js';
import { GameError } from './planet.js';
import { busy, commanderRows, demolish } from './reclaim.js';
import { reconcileClanPlayerReclaim } from './clan.js';
import { createNeutralWorld } from './season.js';

export interface DeleteAccountResult {
  /** The public display name, so the operator can read back who was removed. */
  account: string;
  username: string;
  /** Names of the worlds that stopped existing, capital first. */
  worldsRemoved: string[];
  /** Names of the caretaker worlds handed back to the galaxy. */
  coloniesReturned: string[];
}

/**
 * The caretaker world this address was born as, if it was born as one.
 *
 * Rebuilt from the season's seed rather than remembered, for the same reason the
 * galaxy itself is: a slot is a function of the seed, and storing it would be a
 * second copy to disagree with. The ordinal is counted in selection order so the
 * restored world carries the NAME it originally had — `createNeutralWorlds` numbers
 * them exactly this way, and a world that comes back as `Neutral T3-01` is the one
 * that left.
 */
function originalNeutral(
  seed: number,
  slotIndex: number,
): { neutral: ReturnType<typeof selectNeutralSlots>[number]; number: number } | undefined {
  const selected = selectNeutralSlots(seed, generateGalaxy(seed, MULTI_WORLD.neutralSlotPool).slots);
  const ordinal = new Map<NeutralTier, number>([[1, 0], [2, 0], [3, 0]]);
  for (const neutral of selected) {
    const number = (ordinal.get(neutral.tier) ?? 0) + 1;
    ordinal.set(neutral.tier, number);
    if (neutral.slot.index === slotIndex) return { neutral, number };
  }
  return undefined;
}

/** Everything about the person that is not about a season. */
async function forgetAccount(tx: Tx, accountId: string): Promise<void> {
  await tx.delete(accountRewards).where(eq(accountRewards.accountId, accountId));
  await tx.delete(announcementReads).where(eq(announcementReads.accountId, accountId));
  await tx.delete(feedbackEntries).where(eq(feedbackEntries.accountId, accountId));
  await tx.delete(seasonResults).where(eq(seasonResults.accountId, accountId));
  await tx.delete(accounts).where(eq(accounts.id, accountId));
}

/**
 * Remove one account, its commander and everything either was the reason for.
 *
 * ONE TRANSACTION. A half-deleted person is worse than a deleted one and much
 * worse than a refused one, and every guard below throws rather than returns
 * precisely so the rollback is the failure path.
 */
export async function deleteAccount(
  db: Db,
  clock: Clock,
  name: string,
): Promise<DeleteAccountResult> {
  const now = clock.now();
  return db.transaction(async (tx) => {
    /**
     * TWO EXACT MATCHES, AND DELIBERATELY NO `lower()` — the same rule
     * `grantReward` is written against. Case-folding a Turkish name is not
     * reversible: `İ` folds to `i` plus a combining dot, so a commander called
     * `İhsan` would never match `ihsan` and the operator would be told no such
     * person exists while looking at their message. The display name is compared
     * as written; the login is compared through the SAME normaliser that folded it
     * on the way in.
     */
    const [found] = await tx
      .select({
        id: accounts.id,
        username: accounts.username,
        displayName: accounts.displayName,
      })
      .from(accounts)
      .where(eq(accounts.displayName, name))
      .limit(1)
      .union(
        tx
          .select({
            id: accounts.id,
            username: accounts.username,
            displayName: accounts.displayName,
          })
          .from(accounts)
          .where(eq(accounts.username, normaliseUsername(name)))
          .limit(1),
      );
    if (!found) throw new GameError('PLAYER_NOT_FOUND', `No commander named ${name}`, 404);

    // The row is read again under a lock, so nothing can join, move or be granted
    // anything between the search above and the deletion below.
    const [locked] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, found.id))
      .for('update');
    if (!locked) throw new GameError('PLAYER_NOT_FOUND', `No commander named ${name}`, 404);

    const [bot] = await tx
      .select({ accountId: botProfiles.accountId })
      .from(botProfiles)
      .where(eq(botProfiles.accountId, found.id));
    if (bot) {
      throw new GameError(
        'BOT_ACCOUNT',
        `${found.displayName} is a commander the server plays. Retire it with 'pnpm bots retire' instead.`,
        409,
      );
    }

    const [authored] = await tx
      .select({ id: announcements.id })
      .from(announcements)
      .where(eq(announcements.authorAccountId, found.id));
    if (authored) {
      throw new GameError(
        'ANNOUNCEMENT_AUTHOR',
        `${found.displayName} has authored public news, which outlives its author. Reassign it first.`,
        409,
      );
    }

    /**
     * Silent Space move history is not this command's to take. `main_vacancies`
     * hangs return addresses off `commander_transfers`, and somebody else may be
     * queued for one of them; deleting the history would take an address a
     * different person is waiting on.
     */
    const [moved] = await tx
      .select({ id: commanderTransfers.id })
      .from(commanderTransfers)
      .where(eq(commanderTransfers.accountId, found.id));
    if (moved) {
      throw new GameError(
        'TRANSFER_HISTORY',
        `${found.displayName} has Silent Space move history other return addresses hang off. Not deletable here.`,
        409,
      );
    }

    const [player] = await tx
      .select({
        id: players.id,
        seasonId: players.seasonId,
        seed: seasons.seed,
      })
      .from(players)
      .innerJoin(seasons, eq(seasons.id, players.seasonId))
      .where(eq(players.accountId, found.id))
      .for('update', { of: players });

    // An account between galaxies is still a person, and still deletable.
    if (!player) {
      await forgetAccount(tx, found.id);
      return {
        account: found.displayName,
        username: found.username,
        worldsRemoved: [],
        coloniesReturned: [],
      };
    }

    const [queued] = await tx
      .select({ id: returnApplications.id })
      .from(returnApplications)
      .where(and(
        eq(returnApplications.playerId, player.id),
        eq(returnApplications.status, 'QUEUED'),
      ));
    if (queued) {
      throw new GameError(
        'RETURN_QUEUED',
        `${found.displayName} has a queued return application. Close it before deleting the account.`,
        409,
      );
    }

    /**
     * Read ONCE and used by both the quiet check and the deletion, so what is
     * checked and what is removed can never be different sets. See `commanderRows`.
     */
    const worlds = await tx
      .select({
        id: planets.id,
        name: planets.name,
        kind: planets.kind,
        slotIndex: planets.slotIndex,
      })
      .from(planets)
      .where(eq(planets.controllerPlayerId, player.id))
      .orderBy(planets.slotIndex);
    const planetIds = worlds.map((world) => world.id);
    const rows = await commanderRows(tx, planetIds, player.id);
    if (await busy(tx, planetIds, player.id, rows)) {
      throw new GameError(
        'WORLD_BUSY',
        `${found.displayName} still has craft in the air. Let them land and run this again.`,
        409,
      );
    }

    await reconcileClanPlayerReclaim(tx, {
      playerId: player.id,
      seasonId: player.seasonId,
      displayName: found.displayName,
      now,
      activeCutoff: new Date(now.getTime() - SERVERS.idleDays * 24 * 60 * 60_000),
    });
    await demolish(tx, planetIds, player.id, rows);

    /**
     * AND NOW GIVE THE GALAXY BACK WHAT WAS NEVER THIS COMMANDER'S TO REMOVE.
     *
     * After `demolish`, not before: the address is only free once the colony row
     * is gone, and `createNeutralWorld` inserts a new planet at the same slot.
     */
    const coloniesReturned: string[] = [];
    for (const world of worlds) {
      if (world.kind !== 'COLONY') continue;
      const original = originalNeutral(player.seed, world.slotIndex);
      if (!original) continue;
      await createNeutralWorld(tx, player.seasonId, original.neutral, now, original.number);
      coloniesReturned.push(world.name);
    }

    await forgetAccount(tx, found.id);

    // A public world left, some of them came back, a ladder row went and any
    // authored chat with it. Distinct query families; the client's coalescer turns
    // the transactional broadcasts into one visible refresh.
    await publishShard(tx, player.seasonId, 'world');
    await publishShard(tx, player.seasonId, 'mining');
    await publishShard(tx, player.seasonId, 'chat');
    await publishShard(tx, player.seasonId, 'score');

    return {
      account: found.displayName,
      username: found.username,
      worldsRemoved: worlds.map((world) => world.name),
      coloniesReturned,
    };
  });
}

/** Not exported for anything but the CLI's dry run; nothing routes to this file. */
export async function describeAccount(
  db: Db,
  name: string,
): Promise<{
  account: string;
  username: string;
  createdAt: Date;
  worlds: { name: string; kind: string; slotIndex: number }[];
} | undefined> {
  const [found] = await db
    .select({
      id: accounts.id,
      username: accounts.username,
      displayName: accounts.displayName,
      createdAt: accounts.createdAt,
    })
    .from(accounts)
    .where(eq(accounts.displayName, name))
    .limit(1)
    .union(
      db
        .select({
          id: accounts.id,
          username: accounts.username,
          displayName: accounts.displayName,
          createdAt: accounts.createdAt,
        })
        .from(accounts)
        .where(eq(accounts.username, normaliseUsername(name)))
        .limit(1),
    );
  if (!found) return undefined;
  const worlds = await db
    .select({ name: planets.name, kind: planets.kind, slotIndex: planets.slotIndex })
    .from(planets)
    .innerJoin(players, eq(players.id, planets.controllerPlayerId))
    .where(and(eq(players.accountId, found.id), isNull(planets.recoveryUntil)))
    .orderBy(planets.slotIndex);
  return {
    account: found.displayName,
    username: found.username,
    createdAt: found.createdAt,
    worlds,
  };
}
