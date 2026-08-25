import { and, eq, isNull, or, sql } from 'drizzle-orm';
import {
  REWARD_CHAINS,
  findRewardTier,
  rewardId,
  type Fleet,
  type RewardChain,
  type RewardChainId,
  type RewardMetric,
  type RewardScope,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { normaliseUsername } from '../auth/credentials.js';
import {
  accountRewards,
  accounts,
  miningRuns,
  missions,
  planets,
  players,
  rewardGrants,
} from '../db/schema.js';
import {
  GameError,
  assertWorldOperational,
  loadLocked,
  refreshWealth,
  saveResources,
  withPlanetLock,
  type LockedPlanet,
} from './planet.js';
import { planetView } from './planetView.js';

/**
 * WHAT THE PLAYER HAS DONE, AND WHAT THE GAME OWES THEM FOR IT.
 *
 * The design of this file is one decision: **progress is COUNTED, never
 * accumulated.** There is no achievement-progress table, no counter incremented
 * from six different services, and no listener on the event queue.
 *
 * That is the architectural rule of the whole project applied to a feature that
 * usually breaks it — "nothing is stored that a formula and a clock can derive".
 * Ten of the eleven chains are read straight off rows the game keeps anyway:
 *
 *   PROBE / RAID          `missions`, by kind, from this planet
 *   MINE / SALVAGE        `mining_runs` that actually ARRIVED
 *   CORE … EXTRACTOR      the building level standing right now
 *   AEGIS                 the instrument level standing right now
 *   SHIPS                 `planets.builtEver` — the one exception, see the schema
 *   SOCIAL                a row somebody wrote by hand, against the ACCOUNT
 *
 * IT COSTS FOUR QUERIES AND IT BUYS FOUR THINGS. A chain added next month is
 * retroactive for everyone with no backfill. A counter cannot drift from the world
 * it counts, because it IS the world. Nothing has to be made idempotent, because
 * nothing is written on the path that produces progress. And a raid that resolves
 * while the panel is open does not need to tell the panel anything — the next read
 * simply counts one more mission.
 *
 * THE ONE THING THAT IS WRITTEN is the claim, and it is written under the planet
 * row lock with a primary key that makes a second one impossible.
 */

/** What the caller needs to count against, gathered once. */
interface Standing {
  planetId: string;
  playerId: string;
  /** The person behind the seat. Account-scoped tiers are keyed on this, not on the player. */
  accountId: string;
  levels: Record<string, number>;
  aegis: number;
  builtWasps: number;
}

/**
 * THE COUNTS THAT NEED A QUERY, IN ONE ROUND TRIP EACH.
 *
 * `missions` answers two chains at once with conditional aggregates rather than
 * two scans, and the distinction between them is load-bearing:
 *
 *   · PROBES ARE COUNTED, so sending five at one neighbour is five.
 *   · RAIDS ARE COUNTED DISTINCT BY TARGET, so sending five at one neighbour is
 *     ONE. Farming a single world repeatedly is the exact behaviour `BASH_LIMIT`
 *     exists to suppress, and a reward that paid for it would be the game buying
 *     what the game refuses.
 *
 * A RETURN LEG CANNOT DOUBLE-COUNT EITHER OF THEM. Return missions carry
 * `kind = 'return'` and are stored with origin and target SWAPPED, so they match
 * neither filter — but the swap is precisely why this reads `kind` explicitly
 * instead of "every mission that left here".
 */
async function flightCounts(tx: Tx, planetId: string): Promise<{ probes: number; raided: number }> {
  const rows = await tx
    .select({
      probes: sql<number>`count(*) filter (where ${missions.kind} = 'probe')::int`,
      raided: sql<number>`count(distinct ${missions.targetPlanetId})
                          filter (where ${missions.kind} = 'attack')::int`,
    })
    .from(missions)
    /**
     * A CANCELLED MISSION IS NOT AN ACT THE PLAYER PERFORMED.
     *
     * `abandon()` writes that status when a flight's scheduled event has failed
     * permanently: the ships are handed back, nothing was fought and nothing was
     * scouted. Counting it would pay a reward for a SERVER FAULT — quietly, and
     * only on the days something was already going wrong, which is the worst
     * possible time to also be handing out alloy.
     */
    .where(
      and(eq(missions.originPlanetId, planetId), sql`${missions.status} <> 'cancelled'`),
    );
  return { probes: rows[0]?.probes ?? 0, raided: rows[0]?.raided ?? 0 };
}

/**
 * MINING RUNS THAT REACHED WHAT THEY WERE AIMED AT.
 *
 * `status <> 'outbound'` is the whole rule and it is not pedantry. A run in the
 * air has decided nothing — the rock may be stripped by the time the craft gets
 * there, which is the race D19 exists to create — so counting the LAUNCH would
 * pay for pressing a button. `outbound` becomes `returning` in the arrival
 * handler, at the moment the ore is actually claimed.
 */
async function miningCounts(tx: Tx, planetId: string): Promise<{ rocks: number; wrecks: number }> {
  const rows = await tx
    .select({ kind: miningRuns.targetKind, n: sql<number>`count(*)::int` })
    .from(miningRuns)
    .where(and(eq(miningRuns.planetId, planetId), sql`${miningRuns.status} <> 'outbound'`))
    .groupBy(miningRuns.targetKind);
  const of = (k: string): number => rows.find((r) => r.kind === k)?.n ?? 0;
  return { rocks: of('asteroid'), wrecks: of('debris') };
}

/** One tier's record, whichever ledger it was found in. */
type Ledger = Map<string, { claimed: boolean }>;

const ledgerFrom = (rows: { id: string; claimedAt: Date | null }[]): Ledger =>
  new Map(rows.map((r) => [r.id, { claimed: r.claimedAt !== null }]));

/** Every season-scoped grant row this player has, keyed by tier id. */
async function seasonGrantsOf(tx: Tx, playerId: string): Promise<Ledger> {
  return ledgerFrom(
    await tx
      .select({ id: rewardGrants.rewardId, claimedAt: rewardGrants.claimedAt })
      .from(rewardGrants)
      .where(eq(rewardGrants.playerId, playerId)),
  );
}

/**
 * Every account-scoped grant row this PERSON has, keyed by tier id.
 *
 * A SEPARATE QUERY AND A SEPARATE TABLE BECAUSE IT ANSWERS A DIFFERENT QUESTION:
 * not "what has this commander done this season" but "what has this human already
 * been paid for, ever". The season's player row is deleted by a wipe and by the
 * idle-seat reclaim; the account is not, which is the whole reason the @JoinAstera
 * bonus is keyed here.
 */
async function accountGrantsOf(tx: Tx, accountId: string): Promise<Ledger> {
  return ledgerFrom(
    await tx
      .select({ id: accountRewards.rewardId, claimedAt: accountRewards.claimedAt })
      .from(accountRewards)
      .where(eq(accountRewards.accountId, accountId)),
  );
}

export type RewardState = 'locked' | 'claimable' | 'claimed';

export interface RewardChainView {
  id: RewardChainId;
  metric: RewardMetric;
  /** Season-scoped chains start again with the world; account-scoped ones never do. */
  scope: RewardScope;
  progress: number;
  tiers: {
    id: string;
    goal: number;
    alloy: number;
    crystal: number;
    deuterium: number;
    state: RewardState;
  }[];
}

export interface RewardsView {
  chains: RewardChainView[];
  /** How many tiers are waiting to be taken. The menu badge is this, and nothing else. */
  claimable: number;
}

/**
 * Build the whole panel. Reads only; safe to call inside any transaction.
 *
 * `standing` is passed in rather than loaded here because every caller already
 * holds a locked planet — the claim path especially, where re-loading would mean
 * re-locking a row it owns and re-running the economy advance for nothing.
 */
async function assemble(tx: Tx, standing: Standing): Promise<RewardsView> {
  const [flights, mining, seasonGrants, accountGrants] = await Promise.all([
    flightCounts(tx, standing.planetId),
    miningCounts(tx, standing.planetId),
    seasonGrantsOf(tx, standing.playerId),
    accountGrantsOf(tx, standing.accountId),
  ]);

  /**
   * WHICH LEDGER OWNS A CHAIN, IN ONE PLACE.
   *
   * Every read of a tier's state, every read of a GRANT'S PROGRESS and every
   * write of a claim goes through this, so the panel and the payment cannot
   * disagree about where a reward is remembered — which is the failure that would
   * pay somebody twice. `progressOf` reached past it for `SOCIAL` in the first
   * draft: correct today, because that chain is account-scoped, and silently
   * wrong the moment a hand-granted chain is added for one season only — its
   * progress would be read from one ledger and its state from the other.
   */
  const ledgerFor = (chain: RewardChain): Ledger =>
    chain.scope === 'account' ? accountGrants : seasonGrants;

  const progressOf = (chain: RewardChain): number => {
    switch (chain.id) {
      case 'PROBE':
        return flights.probes;
      case 'RAID':
        return flights.raided;
      case 'MINE':
        return mining.rocks;
      case 'SALVAGE':
        return mining.wrecks;
      case 'SHIPS':
        return standing.builtWasps;
      case 'AEGIS':
        return standing.aegis;
      /**
       * A GRANT'S PROGRESS IS WHETHER SOMEBODY WROTE THE ROW. There is nothing in
       * the galaxy to count — the act happened on Twitter — so the existence of
       * the grant IS the progress, claimed or not. The row is the ACCOUNT's, so a
       * commander who took this in an earlier galaxy arrives in the next one with
       * the card already showing as taken.
       */
      case 'SOCIAL':
        return ledgerFor(chain).has(rewardId('SOCIAL', 1)) ? 1 : 0;
      default:
        return standing.levels[chain.id] ?? 0;
    }
  };

  let claimable = 0;
  const chains = REWARD_CHAINS.map((chain) => {
    const progress = progressOf(chain);
    const ledger = ledgerFor(chain);
    return {
      id: chain.id,
      metric: chain.metric,
      scope: chain.scope,
      progress,
      tiers: chain.tiers.map((t) => {
        const id = rewardId(chain.id, t.goal);
        const grant = ledger.get(id);
        const state: RewardState = grant?.claimed
          ? 'claimed'
          : progress >= t.goal
            ? 'claimable'
            : 'locked';
        if (state === 'claimable') claimable += 1;
        return {
          id,
          goal: t.goal,
          alloy: t.reward.alloy,
          crystal: t.reward.crystal,
          deuterium: t.reward.deuterium,
          state,
        };
      }),
    };
  });

  return { chains, claimable };
}

/**
 * `loadLocked` carries everything but two facts, and neither is a column it has
 * any reason to know about: the ships-ever tally on the planet row, and WHO owns
 * the seat. Two selects on primary keys, in parallel, inside the lock.
 *
 * The account is here rather than on `LockedPlanet` because rewards are the only
 * feature that needs it — every other service works entirely in terms of the
 * season's player, which is the right level for everything that dies with a world.
 */
async function standingOf(tx: Tx, planet: LockedPlanet): Promise<Standing> {
  const [worldRows, ownerRows] = await Promise.all([
    tx.select({ builtEver: planets.builtEver }).from(planets).where(eq(planets.id, planet.planetId)),
    tx.select({ accountId: players.accountId }).from(players).where(eq(players.id, planet.playerId)),
  ]);
  const accountId = ownerRows[0]?.accountId;
  // A locked, owned planet always has a player row; if it does not, something has
  // deleted a commander out from under a live world and paying a reward against it
  // would be the least of the problems. The same code and sentence `loadLocked`
  // uses for a world with nobody at the controls — a refusal the client already
  // has words for, rather than a new one meaning "join a galaxy first".
  if (accountId === undefined) {
    throw new GameError('PLANET_NOT_OWNED', 'That world has no commander', 403);
  }
  const builtEver: Fleet = worldRows[0]?.builtEver ?? {};

  return {
    planetId: planet.planetId,
    playerId: planet.playerId,
    accountId,
    levels: planet.buildings,
    aegis: planet.instruments.AEGIS ?? 0,
    builtWasps: builtEver.WASP ?? 0,
  };
}

export async function rewardsView(db: Db, planetId: string, clock: Clock): Promise<RewardsView> {
  return db.transaction(async (tx) => {
    const planet = await loadLocked(tx, planetId, clock, { requireLive: false });
    return assemble(tx, await standingOf(tx, planet));
  });
}

/**
 * TAKE ONE TIER. The whole of the payment path, and every guard it needs.
 *
 * FOUR REFUSALS, IN THE ORDER THAT MAKES THE MESSAGE USEFUL: is this a real tier,
 * has it already been taken, is it actually earned, and — for SOCIAL alone — has
 * a human said so. A player who has not earned it is told that; a player who
 * already took it is told that; the two must never collapse into one sentence.
 *
 * THE PRIMARY KEY IS THE IDEMPOTENCY, NOT THE CHECK ABOVE IT. Two taps a
 * millisecond apart both read "not claimed" if the read is the guard, and the
 * planet row lock is what makes that impossible here — but the insert is written
 * so that even without the lock the second one loses. Belt and braces on the one
 * path in this feature that moves resources.
 *
 * IT GRANTS ABOVE THE STORAGE CAP, DELIBERATELY, and that is not an oversight to
 * be clamped later. `OPENING_BONUS` already does exactly this and its docblock
 * explains why: nothing in this game clamps stored resources downward — the cap
 * gates what may be COLLECTED out of the works — so a grant is never silently
 * lost, and a player who is briefly over their ceiling has money to spend rather
 * than money to sit on. Clamping instead would mean a reward quietly evaporating
 * at the exact moment it was earned, which is worse than any pressure it avoids.
 * Everything granted lands in STORAGE, above the vault floor, where a raider can
 * come and take it — which is what keeps a reward inside the PvP economy.
 */
export async function claimReward(
  db: Db,
  planetId: string,
  id: string,
  clock: Clock,
): Promise<{
  granted: { alloy: number; crystal: number; deuterium: number };
  rewards: RewardsView;
  planet: Awaited<ReturnType<typeof planetView>>;
}> {
  const ref = findRewardTier(id);
  if (!ref) throw new GameError('NO_SUCH_REWARD', 'No such reward', 404);
  /**
   * FROM HERE ON THE CALLER'S STRING IS NOT USED AGAIN.
   *
   * The primary key on `reward_grants` is what makes a claim once-only, and a key
   * built from an un-canonicalised input is one alias away from being two keys for
   * one tier. See `findRewardTier`.
   */
  const rewardKey = ref.id;

  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    assertWorldOperational(planet);
    const standing = await standingOf(tx, planet);
    const view = await assemble(tx, standing);

    const tier = view.chains
      .find((c) => c.id === ref.chain.id)
      ?.tiers.find((t) => t.id === rewardKey);
    if (!tier) throw new GameError('NO_SUCH_REWARD', 'No such reward', 404);
    if (tier.state === 'claimed') {
      throw new GameError('REWARD_TAKEN', 'You have already taken that reward');
    }
    if (tier.state === 'locked') {
      /**
       * A grant that nobody has written is not "not far enough" — there is no
       * progress bar to be short of. Two codes, because the two are different
       * facts and the player can act on only one of them.
       */
      throw ref.chain.metric === 'grant'
        ? new GameError('REWARD_NOT_GRANTED', 'That reward has not been unlocked for you')
        : new GameError('REWARD_LOCKED', 'You have not earned that yet', 400, {
            goal: tier.goal,
            progress: view.chains.find((c) => c.id === ref.chain.id)?.progress ?? 0,
          });
    }

    const alloy = planet.alloy + tier.alloy;
    const crystal = planet.crystal + tier.crystal;
    const deuterium = planet.deuterium + tier.deuterium;

    /**
     * ONE STATEMENT FOR BOTH SHAPES OF ROW, IN WHICHEVER LEDGER OWNS THE CHAIN.
     *
     * An earned tier has no row yet and this inserts it, already claimed. A
     * SOCIAL grant has a row with `claimedAt` NULL and this stamps it — the
     * `WHERE claimed_at IS NULL` is what makes the update a no-op on a second
     * attempt instead of re-stamping a paid reward. Either way exactly one row
     * ends up claimed, and the primary key means it cannot become two.
     *
     * THE TWO BRANCHES ARE THE SAME STATEMENT AGAINST TWO KEYS, and they are
     * written out rather than abstracted because the key IS the guarantee: an
     * account-scoped tier is paid once per person for ever, a season-scoped one
     * once per commander per galaxy, and a helper that took the table as an
     * argument would make that difference a parameter instead of a fact.
     */
    const claimed = { claimedAt: planet.now, alloy: tier.alloy, crystal: tier.crystal, deuterium: tier.deuterium };
    const written = ref.chain.scope === 'account'
      ? await tx
        .insert(accountRewards)
        .values({ accountId: standing.accountId, rewardId: rewardKey, ...claimed })
        .onConflictDoUpdate({
          target: [accountRewards.accountId, accountRewards.rewardId],
          set: claimed,
          where: isNull(accountRewards.claimedAt),
        })
        .returning({ id: accountRewards.rewardId })
      : await tx
        .insert(rewardGrants)
        .values({ playerId: planet.playerId, rewardId: rewardKey, ...claimed })
        .onConflictDoUpdate({
          target: [rewardGrants.playerId, rewardGrants.rewardId],
          set: claimed,
          where: isNull(rewardGrants.claimedAt),
        })
        .returning({ id: rewardGrants.rewardId });

    /**
     * NOTHING CHANGED MEANS SOMEBODY ELSE GOT THERE FIRST. The conflict clause
     * declined because the row was already claimed, which the read above did not
     * see — a second tab, a retried request. Refusing here rather than paying
     * out is the difference between an idempotency guard and a comment about one.
     */
    if (written.length === 0) {
      throw new GameError('REWARD_TAKEN', 'You have already taken that reward');
    }

    await saveResources(tx, planetId, { alloy, crystal, deuterium });
    planet.alloy = alloy;
    planet.crystal = crystal;
    planet.deuterium = deuterium;
    await refreshWealth(tx, planet);

    return {
      granted: { alloy: tier.alloy, crystal: tier.crystal, deuterium: tier.deuterium },
      rewards: await assemble(tx, standing),
      planet: await planetView(tx, planetId, clock),
    };
  });
}

/**
 * UNLOCK A HAND-CHECKED REWARD. The operator's half of the Twitter bonus.
 *
 * Called from `season reward <commander>` and from nowhere else — there is no
 * HTTP surface for this and deliberately so. An admin endpoint would mean an
 * admin credential living in the environment of a public API for the sake of a
 * few dozen manual grants a season; a CLI on a box only the operator can reach
 * has the same effect and no attack surface at all.
 *
 * IDEMPOTENT. Running it twice for the same commander writes nothing the second
 * time and reports so, because the operator WILL run it twice — the input is a
 * direct message read on a phone.
 *
 * AND IDEMPOTENT ACROSS SEASONS, WHICH IS THE POINT OF `scope: 'account'`. The
 * @JoinAstera bonus is paid once per PERSON: a commander who was granted it in
 * the last galaxy is reported as `already` in the next one and no second row is
 * written, whether or not the world they held then still exists. Before the
 * ledger moved up to the account this said `already: false` every fortnight,
 * because the player row it was keyed on had been deleted with the season.
 *
 * IT RESOLVES AN ACCOUNT, NOT A PLAYER, for the same reason: the operator is
 * reading a direct message from a human being, and that human is entitled to the
 * grant while they are between galaxies with no world at all.
 */
export async function grantReward(
  db: Db,
  username: string,
  id: string,
): Promise<{ player: string; already: boolean }> {
  const ref = findRewardTier(id);
  if (!ref) throw new GameError('NO_SUCH_REWARD', 'No such reward', 404);

  return db.transaction(async (tx) => {
    /**
     * TWO EXACT MATCHES, AND DELIBERATELY NO `lower()` ANYWHERE.
     *
     * The obvious version of this — `lower(name) = lower($1)` — is wrong in this
     * codebase for a reason that is written into the traps list: case-folding a
     * Turkish name is not reversible. `İ` folds to `i` plus a COMBINING DOT, so a
     * commander called `İhsan` would never match `ihsan`, and the operator would
     * be told no such commander exists while looking at their direct message.
     *
     * So neither side is folded here. The display name is compared as written —
     * which is how it arrives in a DM — and the username is compared after
     * `normaliseUsername`, the SAME function that folded it on the way into the
     * database. Comparing a value against itself through its own normaliser is
     * the only case-insensitivity that is safe in any alphabet.
     */
    const rows = await tx
      .select({ accountId: accounts.id, name: accounts.displayName, playerId: players.id })
      .from(accounts)
      // LEFT, not INNER: an account between galaxies — reclaimed, or waiting out a
      // rollover — has no player row, and a person who followed us is still that
      // person while they have no world.
      .leftJoin(players, eq(players.accountId, accounts.id))
      .where(
        or(eq(accounts.displayName, username), eq(accounts.username, normaliseUsername(username))),
      )
      .limit(1);
    const found = rows[0];
    if (!found) throw new GameError('PLAYER_NOT_FOUND', `No commander named ${username}`, 404);

    // Canonical, for the same reason `claimReward` uses it: this row IS the
    // once-only key, and the operator types the id on a command line.
    const values = {
      rewardId: ref.id,
      alloy: ref.tier.reward.alloy,
      crystal: ref.tier.reward.crystal,
    };

    if (ref.chain.scope === 'account') {
      const written = await tx
        .insert(accountRewards)
        .values({ accountId: found.accountId, ...values })
        .onConflictDoNothing()
        .returning({ id: accountRewards.rewardId });
      return { player: found.name, already: written.length === 0 };
    }

    /**
     * A SEASON-SCOPED HAND GRANT NEEDS A SEASON TO PUT IT IN. No chain is written
     * this way today — every earned tier is counted off the world — but the id is
     * an argument on a command line, so the case has to answer rather than write a
     * row against a null.
     */
    if (found.playerId === null) {
      throw new GameError('PLAYER_NOT_IN_SEASON', `${found.name} is not in a galaxy right now`, 409);
    }
    const written = await tx
      .insert(rewardGrants)
      .values({ playerId: found.playerId, ...values })
      .onConflictDoNothing()
      .returning({ id: rewardGrants.rewardId });

    return { player: found.name, already: written.length === 0 };
  });
}
