import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  MULTI_WORLD,
  clanHangarCapacity,
  clanLevelUpgradeCost,
  CLAN_LEVEL_MAX,
  type Resources,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Queryable, Tx } from '../db/client.js';
import {
  clanTreasuryEvents,
  clanWarContributions,
  clans,
  seasons,
} from '../db/schema.js';
import {
  GameError,
  loadLocked,
  lockSeason,
  recomputePlayerWealth,
  saveResources,
} from './planet.js';
import { activeClanMembership, activeClanPlayerIds, lockClanPlayers } from './clanCombat.js';
/*
  TYPE ONLY, AND ON PURPOSE. `clan.ts` calls `burnClanTreasury` from inside
  `disbandClan`, so a value import back the other way would close a module cycle.
  The actor is resolved by the caller and handed in.
*/
import type { ClanActor } from './clan.js';
import { publishPrivate } from '../stream/bus.js';

/**
 * THE CLAN PURSE AND THE RUNG IT BUYS. Klan Ortak Savaşı, owner design 2026-09-20.
 *
 * A clan level exists for exactly one reason: it sets the Klan Hangarı, which is
 * how much fleet the clan may hold in one joint operation. It is bought with a
 * SHARED purse that members pay into out of their own worlds, and only the leader
 * may spend it.
 *
 * THE PURSE IS NOT A BANK, and that is the decision that shapes this whole file.
 * Each resource fills only as far as the NEXT rung's price, so a clan cannot
 * quietly hoard a season's production in a place no raider can reach. A donation
 * past that ceiling is refused whole rather than trimmed: silently accepting 900
 * of somebody's 1,000 alloy is the kind of "help" a player discovers afterwards.
 *
 * NOTHING COMES BACK. Leaving pays no refund, and a disband burns what is left
 * after an explicit yes. A purse that could be withdrawn would be a way to move
 * ore between commanders with no flight, no fuel and no risk — which is exactly
 * what `clanAid` exists to price.
 */

/** What a member may see of their own clan's war economy. */
export interface ClanWarEconomyView {
  /** False in a season dealt before the joint war existed. Everything else is then inert. */
  available: boolean;
  /** Null only when `available` is false. */
  level: number | null;
  maxLevel: boolean;
  treasury: Resources;
  /** The exact price of the next rung, or null at the top. */
  nextCost: Resources | null;
  /** Room left per resource before the cap refuses. Null at the top rung. */
  room: Resources | null;
  canUpgrade: boolean;
  hangar: ClanHangarUsage;
}

/**
 * THE KLAN HANGARI, AS A PLAYER HAS TO READ IT.
 *
 * `used` is what is standing in the pool right now; `reserved` is what is still
 * flying to the staging world and has already taken its room. Both count against
 * `total` — they are split because "40 of 160, and 20 more on the way" is a
 * different decision from "60 of 160", and a single number cannot say it.
 */
export interface ClanHangarUsage {
  used: number;
  reserved: number;
  total: number;
}

const NOTHING: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
const RESOURCE_KEYS = ['alloy', 'crystal', 'deuterium'] as const;

/**
 * THE FEATURE GATE, AND IT IS A SEASON'S PROPERTY RATHER THAN A FLAG.
 *
 * A galaxy already running when this shipped keeps the game it was dealt: its
 * clans have no level, no purse they may spend and no joint war. Backfilling one
 * would change Dominion, raid loot and clan semantics under people mid-season.
 */
export async function assertJointWarRuleset(
  db: Queryable,
  seasonId: string,
): Promise<typeof seasons.$inferSelect> {
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1);
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
  if (season.rulesetVersion < MULTI_WORLD.clanJointWarRulesetVersion) {
    throw new GameError(
      'CLAN_JOINT_WAR_UNAVAILABLE',
      'Clan joint war begins with the next galaxy',
      409,
    );
  }
  return season;
}

/** True when this season was dealt the joint war. Never throws; for read paths. */
export async function jointWarAvailable(db: Queryable, seasonId: string): Promise<boolean> {
  const [season] = await db
    .select({ rulesetVersion: seasons.rulesetVersion })
    .from(seasons)
    .where(eq(seasons.id, seasonId))
    .limit(1);
  return (season?.rulesetVersion ?? 0) >= MULTI_WORLD.clanJointWarRulesetVersion;
}

/** The level a clan created in this season starts at: 1 with the war, none without. */
export const startingClanLevel = (rulesetVersion: number): number | null =>
  rulesetVersion >= MULTI_WORLD.clanJointWarRulesetVersion ? 1 : null;

const treasuryOf = (clan: typeof clans.$inferSelect): Resources => ({
  alloy: clan.treasuryAlloy,
  crystal: clan.treasuryCrystal,
  deuterium: clan.treasuryDeuterium,
});

/**
 * The purse's ceiling: the next rung's exact price, per resource. Null at the top,
 * which is what closes donation there rather than a separate switch.
 */
const nextCostFor = (level: number): Resources | null =>
  level >= CLAN_LEVEL_MAX ? null : clanLevelUpgradeCost(level);

const roomFor = (treasury: Resources, cost: Resources | null): Resources | null =>
  cost === null ? null : {
    alloy: Math.max(0, cost.alloy - treasury.alloy),
    crystal: Math.max(0, cost.crystal - treasury.crystal),
    deuterium: Math.max(0, cost.deuterium - treasury.deuterium),
  };

const affords = (treasury: Resources, cost: Resources): boolean =>
  RESOURCE_KEYS.every((key) => treasury[key] >= cost[key]);

/**
 * A refusal's figures, taken apart the way `ErrorParams` needs them.
 *
 * The client keeps its own sentence per code and fills the numbers in (D124's
 * rule about finished English), so a nested `{ alloy, crystal, deuterium }` has
 * to arrive as three named scalars rather than an object.
 */
const flatten = (prefix: string, amounts: Resources): Record<string, number> => ({
  [`${prefix}Alloy`]: amounts.alloy,
  [`${prefix}Crystal`]: amounts.crystal,
  [`${prefix}Deuterium`]: amounts.deuterium,
});

/** The room a clan's live contributions are holding, split by where they are. */
export async function clanHangarUsage(
  db: Queryable,
  clanId: string,
  level: number,
): Promise<ClanHangarUsage> {
  const [row] = await db
    .select({
      // Cast explicitly: an aggregate's own type decides whether the driver hands
      // this back as a number or as a numeric string, and the difference would
      // only show up once a clan actually had ships in the pool.
      used: sql<number>`coalesce(sum(${clanWarContributions.reservedBulk})
        filter (where ${clanWarContributions.status} in ('STAGED', 'IN_BATTLE')), 0)::double precision`,
      reserved: sql<number>`coalesce(sum(${clanWarContributions.reservedBulk})
        filter (where ${clanWarContributions.status} = 'OUTBOUND'), 0)::double precision`,
    })
    .from(clanWarContributions)
    .where(eq(clanWarContributions.clanId, clanId));
  return {
    used: row?.used ?? 0,
    reserved: row?.reserved ?? 0,
    total: clanHangarCapacity(level),
  };
}

/** The caller's own clan row, or the refusal that says they have none. */
async function memberClan(
  db: Queryable,
  actor: ClanActor,
): Promise<typeof clans.$inferSelect> {
  const membership = await activeClanMembership(db, actor.playerId);
  if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 403);
  const [clan] = await db
    .select()
    .from(clans)
    .where(and(eq(clans.id, membership.clanId), isNull(clans.disbandedAt)))
    .limit(1);
  if (!clan) throw new GameError('CLAN_NOT_FOUND', 'No such active clan', 404);
  return clan;
}

/**
 * THE MEMBERS-ONLY PROJECTION: the purse, the rung and the shared hangar.
 *
 * A clan outsider gets none of this. What a clan has saved and how much fleet it
 * can field are the two facts that decide whether its next operation is worth
 * fearing, and publishing them would hand every rival the clan's war plan. The
 * public profile publishes `level` alone.
 *
 * It is a projection rather than a route because the war screen is ONE read: the
 * purse and the operation are looked at together, decided on together, and a
 * client that had to fetch them separately would draw a level that does not match
 * the hangar beside it.
 */
export async function clanTreasuryProjection(
  db: Queryable,
  clan: typeof clans.$inferSelect,
  available: boolean,
): Promise<ClanWarEconomyView> {
  if (!available || clan.level === null) {
    return {
      available: false,
      level: null,
      maxLevel: false,
      treasury: NOTHING,
      nextCost: null,
      room: null,
      canUpgrade: false,
      hangar: { used: 0, reserved: 0, total: 0 },
    };
  }
  const treasury = treasuryOf(clan);
  const nextCost = nextCostFor(clan.level);
  return {
    available: true,
    level: clan.level,
    maxLevel: nextCost === null,
    treasury,
    nextCost,
    room: roomFor(treasury, nextCost),
    canUpgrade: nextCost !== null && affords(treasury, nextCost),
    hangar: await clanHangarUsage(db, clan.id, clan.level),
  };
}

/** The caller's own active clan row, or the refusal that says they have none. */
export async function requireMemberClan(
  db: Queryable,
  actor: ClanActor,
): Promise<typeof clans.$inferSelect> {
  return memberClan(db, actor);
}

/**
 * LOCK THE CLAN, THEN THE MEMBER — and never the other way round.
 *
 * THE LOCK ORDER IS THE WHOLE POINT OF THIS HELPER. `disbandClan` takes the clan
 * row and then its members' player rows; a treasury mutation that took the player
 * first would deadlock against a disband running at the same instant, and the
 * symptom would be two requests hanging until Postgres killed one of them.
 * Season → planet → clan → player, in every joint-war path.
 *
 * The first membership read is a HINT — it only locates the clan to lock. What
 * authorises anything is the second read, taken after the player row is held.
 */
async function lockOwnClan(
  tx: Tx,
  actor: ClanActor,
): Promise<typeof clans.$inferSelect & { level: number; role: 'LEADER' | 'MEMBER' }> {
  await assertJointWarRuleset(tx, actor.seasonId);
  const hint = await activeClanMembership(tx, actor.playerId);
  if (!hint) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 403);
  const [clan] = await tx
    .select()
    .from(clans)
    .where(and(eq(clans.id, hint.clanId), isNull(clans.disbandedAt)))
    .for('update');
  if (!clan) throw new GameError('CLAN_NOT_FOUND', 'No such active clan', 404);
  await lockClanPlayers(tx, [actor.playerId]);
  const membership = await activeClanMembership(tx, actor.playerId);
  if (membership?.clanId !== clan.id) {
    throw new GameError('NOT_IN_CLAN', 'You no longer belong to that clan', 403);
  }
  if (clan.level === null) {
    throw new GameError(
      'CLAN_JOINT_WAR_UNAVAILABLE',
      'This clan predates the joint war',
      409,
    );
  }
  return { ...clan, level: clan.level, role: membership.role };
}

export interface ClanTreasuryResult {
  level: number;
  treasury: Resources;
  nextCost: Resources | null;
  room: Resources | null;
  capacity: number;
  canUpgrade: boolean;
}

const resultFor = (level: number, treasury: Resources): ClanTreasuryResult => {
  const nextCost = nextCostFor(level);
  return {
    level,
    treasury,
    nextCost,
    room: roomFor(treasury, nextCost),
    capacity: clanHangarCapacity(level),
    canUpgrade: nextCost !== null && affords(treasury, nextCost),
  };
};

/**
 * PAY INTO THE PURSE OUT OF ONE OF YOUR OWN WORLDS.
 *
 * OPEN TO EVERY ACTIVE MEMBER, maturity included. The twelve-hour adaptation
 * exists so a fresh member cannot immediately aim the clan's guns; paying for the
 * clan's hangar is the opposite of that, and a newcomer who cannot contribute at
 * all has nothing to do for half a day.
 *
 * ONE TRANSACTION, THREE MOVES: the world is debited, the purse is credited and
 * the audit row is written together, under the world's lock and the clan's. The
 * ceiling is re-read inside that lock, which is what makes two donors racing for
 * the last unit resolve as one success and one `CLAN_TREASURY_OVER_CAP` rather
 * than as an overfilled purse.
 */
export async function donateToClanTreasury(
  tx: Tx,
  input: {
    actor: ClanActor;
    planetId: string;
    resources: Resources;
    clock: Clock;
  },
): Promise<ClanTreasuryResult> {
  const now = input.clock.now();
  for (const key of RESOURCE_KEYS) {
    const amount = input.resources[key];
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new GameError('BAD_REQUEST', 'A donation is whole, non-negative amounts', 400);
    }
  }
  if (RESOURCE_KEYS.every((key) => input.resources[key] === 0)) {
    throw new GameError('BAD_REQUEST', 'Donate at least one resource', 400);
  }

  // Season and planet inside `loadLocked`, then the clan and the member. See
  // `lockOwnClan` for why that order is not negotiable.
  const planet = await loadLocked(tx, input.planetId, input.clock, {
    expectedPlayerId: input.actor.playerId,
  });
  const clan = await lockOwnClan(tx, input.actor);

  const nextCost = nextCostFor(clan.level);
  if (nextCost === null) {
    throw new GameError('CLAN_LEVEL_MAX', 'The clan hangar is already at its top rung', 409);
  }
  const treasury = treasuryOf(clan);
  const after: Resources = {
    alloy: treasury.alloy + input.resources.alloy,
    crystal: treasury.crystal + input.resources.crystal,
    deuterium: treasury.deuterium + input.resources.deuterium,
  };
  const over = RESOURCE_KEYS.find((key) => after[key] > nextCost[key]);
  if (over !== undefined) {
    /*
      REFUSED WHOLE, NEVER TRIMMED. Owner decision.

      The alternative is accepting part of a donation and returning the rest,
      which reads to the player as the game having taken a number they did not
      choose. The refusal names the room that is actually left.
    */
    throw new GameError(
      'CLAN_TREASURY_OVER_CAP',
      'The clan purse only holds the next rung',
      409,
      flatten('room', roomFor(treasury, nextCost) ?? NOTHING),
    );
  }
  if (
    planet.alloy < input.resources.alloy
    || planet.crystal < input.resources.crystal
    || planet.deuterium < input.resources.deuterium
  ) {
    throw new GameError('INSUFFICIENT_RESOURCES', 'That world cannot pay it', 409);
  }

  await saveResources(tx, planet.planetId, {
    alloy: planet.alloy - input.resources.alloy,
    crystal: planet.crystal - input.resources.crystal,
    deuterium: planet.deuterium - input.resources.deuterium,
  });
  await tx.update(clans).set({
    treasuryAlloy: after.alloy,
    treasuryCrystal: after.crystal,
    treasuryDeuterium: after.deuterium,
  }).where(eq(clans.id, clan.id));
  await tx.insert(clanTreasuryEvents).values({
    seasonId: clan.seasonId,
    clanId: clan.id,
    actorPlayerId: input.actor.playerId,
    sourcePlanetId: planet.planetId,
    kind: 'DONATION',
    alloy: input.resources.alloy,
    crystal: input.resources.crystal,
    deuterium: input.resources.deuterium,
    createdAt: now,
  });
  await recomputePlayerWealth(tx, input.actor.playerId);
  await publishClanTreasury(tx, clan.id);
  return resultFor(clan.level, after);
}

/**
 * BUY THE NEXT RUNG. Leader only, exact price, no partial payment.
 *
 * `expectedLevel` is the caller's view of the world, and it is checked rather
 * than trusted: two taps on a slow connection must not buy two rungs, and a
 * member watching the purse fill must not be surprised by a level they did not
 * choose to pay for. The stale request is refused with `CLAN_LEVEL_STALE`.
 */
export async function upgradeClanLevel(
  tx: Tx,
  input: { actor: ClanActor; expectedLevel: number; clock: Clock },
): Promise<ClanTreasuryResult> {
  const now = input.clock.now();
  // A frozen galaxy buys nothing: the season lock comes first here exactly as it
  // does inside `loadLocked` on the donation path.
  await lockSeason(tx, input.actor.seasonId);
  const clan = await lockOwnClan(tx, input.actor);
  if (clan.role !== 'LEADER') {
    throw new GameError('CLAN_LEADER_REQUIRED', 'Only the clan leader can do that', 403);
  }
  if (clan.level !== input.expectedLevel) {
    throw new GameError('CLAN_LEVEL_STALE', 'The clan level moved; refresh and try again', 409, {
      level: clan.level,
    });
  }
  const cost = nextCostFor(clan.level);
  if (cost === null) {
    throw new GameError('CLAN_LEVEL_MAX', 'The clan hangar is already at its top rung', 409);
  }
  const treasury = treasuryOf(clan);
  if (!affords(treasury, cost)) {
    throw new GameError('CLAN_TREASURY_INSUFFICIENT', 'The purse cannot pay that rung', 409, {
      ...flatten('cost', cost),
      ...flatten('room', roomFor(treasury, cost) ?? NOTHING),
    });
  }

  const after: Resources = {
    alloy: treasury.alloy - cost.alloy,
    crystal: treasury.crystal - cost.crystal,
    deuterium: treasury.deuterium - cost.deuterium,
  };
  const level = clan.level + 1;
  await tx.update(clans).set({
    level,
    treasuryAlloy: after.alloy,
    treasuryCrystal: after.crystal,
    treasuryDeuterium: after.deuterium,
  }).where(eq(clans.id, clan.id));
  await tx.insert(clanTreasuryEvents).values({
    seasonId: clan.seasonId,
    clanId: clan.id,
    actorPlayerId: input.actor.playerId,
    kind: 'LEVEL_UP',
    alloy: -cost.alloy,
    crystal: -cost.crystal,
    deuterium: -cost.deuterium,
    levelBefore: clan.level,
    levelAfter: level,
    createdAt: now,
  });
  await publishClanTreasury(tx, clan.id);
  return resultFor(level, after);
}

/**
 * BURN WHAT IS LEFT WHEN A CLAN IS DISSOLVED.
 *
 * Called from inside `disbandClan`, under the locks it already holds. Nothing is
 * returned to anybody: the purse was spent the moment it was given, and paying it
 * back at dissolution would make "found a clan, collect donations, disband" a
 * transfer with no flight and no risk.
 */
export async function burnClanTreasury(
  tx: Tx,
  input: { clan: Pick<typeof clans.$inferSelect,
    'id' | 'seasonId' | 'treasuryAlloy' | 'treasuryCrystal' | 'treasuryDeuterium'>;
    /** Null only for an automatic inactivity disband. */
    actorPlayerId: string | null;
    acknowledged: boolean;
    now: Date;
  },
): Promise<Resources> {
  const burned: Resources = {
    alloy: input.clan.treasuryAlloy,
    crystal: input.clan.treasuryCrystal,
    deuterium: input.clan.treasuryDeuterium,
  };
  if (RESOURCE_KEYS.every((key) => burned[key] === 0)) return NOTHING;
  if (!input.acknowledged) {
    throw new GameError(
      'CLAN_TREASURY_BURN_UNCONFIRMED',
      'Disbanding destroys the clan purse; confirm it explicitly',
      409,
      flatten('burned', burned),
    );
  }
  await tx.update(clans).set({
    treasuryAlloy: 0,
    treasuryCrystal: 0,
    treasuryDeuterium: 0,
  }).where(eq(clans.id, input.clan.id));
  await tx.insert(clanTreasuryEvents).values({
    seasonId: input.clan.seasonId,
    clanId: input.clan.id,
    actorPlayerId: input.actorPlayerId,
    kind: 'DISBAND_BURN',
    alloy: -burned.alloy,
    crystal: -burned.crystal,
    deuterium: -burned.deuterium,
    createdAt: input.now,
  });
  return burned;
}

/** Nudge every member's stream; the payload itself never carries private figures. */
async function publishClanTreasury(tx: Tx, clanId: string): Promise<void> {
  for (const playerId of await activeClanPlayerIds(tx, clanId)) {
    await publishPrivate(tx, playerId, 'treasury');
  }
}
