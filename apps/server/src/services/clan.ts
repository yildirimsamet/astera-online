import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import {
  CLAN,
  MULTI_WORLD,
  clanNameIsValid,
  clanNameKey,
  clanTagIsValid,
  normaliseClanName,
  normaliseClanTag,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import {
  accounts,
  buildings,
  clanCeasefires,
  clanEvents,
  clanLootShares,
  clanMemberships,
  clanMessages,
  clanRequests,
  clans,
  planets,
  players,
  seasons,
} from '../db/schema.js';
import { publishPrivate, publishShard, type ClanPrivateEventKind } from '../stream/bus.js';
import {
  activeClanMembership,
  activeClanPlayerIds,
  bindOpenAttacksToClan,
  canonicalPlayerPair,
  hasHostileFlightWithClan,
  lockClanPlayers,
} from './clanCombat.js';
import { capitalPlanet } from './ownership.js';
import {
  GameError,
  loadLocked,
  lockSeason,
  recomputePlayerWealth,
  saveResources,
} from './planet.js';
import { planetView } from './planetView.js';

export interface ClanActor {
  playerId: string;
  seasonId: string;
  accountId: string;
  displayName: string;
  clanLockedUntil: Date | null;
  lastClanSeenAt: Date | null;
}

export async function clanActor(db: Queryable, accountId: string): Promise<ClanActor> {
  const [actor] = await db
    .select({
      playerId: players.id,
      seasonId: players.seasonId,
      accountId: players.accountId,
      displayName: accounts.displayName,
      clanLockedUntil: players.clanLockedUntil,
      lastClanSeenAt: players.lastClanSeenAt,
    })
    .from(players)
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .where(eq(players.accountId, accountId))
    .limit(1);
  if (!actor) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  return actor;
}

/**
 * Current clan identity is not sight. D114 keeps every instrument private, while
 * membership immediately tells the crew who its commanders are and where their
 * worlds are. Keep that deliberately small identity projection separate from the
 * resolved galaxy rows so adding a clanmate can never reveal development,
 * hardware, traffic or another commander's sensor spheres.
 */
export async function readClanPresence(db: Queryable, playerId: string) {
  const membership = await activeClanMembership(db, playerId);
  if (!membership) return null;

  const [clan] = await db
    .select({ id: clans.id, name: clans.name, tag: clans.tag })
    .from(clans)
    .where(and(eq(clans.id, membership.clanId), isNull(clans.disbandedAt)))
    .limit(1);
  if (!clan) return null;

  const rows = await db
    .select({
      playerId: clanMemberships.playerId,
      username: accounts.displayName,
      slot: clanMemberships.slot,
      planetId: planets.id,
      planetName: planets.name,
      x: planets.x,
      y: planets.y,
      z: planets.z,
      planetSlot: planets.slotIndex,
    })
    .from(clanMemberships)
    .innerJoin(players, eq(players.id, clanMemberships.playerId))
    .innerJoin(accounts, eq(accounts.id, players.accountId))
    .innerJoin(planets, eq(planets.controllerPlayerId, clanMemberships.playerId))
    .where(and(
      eq(clanMemberships.clanId, membership.clanId),
      isNull(clanMemberships.leftAt),
    ))
    .orderBy(asc(clanMemberships.slot), asc(planets.slotIndex));

  const members = new Map<string, {
    playerId: string;
    username: string;
    worlds: { planetId: string; name: string; position: { x: number; y: number; z: number } }[];
  }>();
  for (const row of rows) {
    const member = members.get(row.playerId) ?? {
      playerId: row.playerId,
      username: row.username,
      worlds: [],
    };
    member.worlds.push({
      planetId: row.planetId,
      name: row.planetName,
      position: { x: row.x, y: row.y, z: row.z },
    });
    members.set(row.playerId, member);
  }

  return { clan, members: [...members.values()] };
}

async function assertClanRuleset(
  db: Queryable,
  seasonId: string,
): Promise<typeof seasons.$inferSelect> {
  const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1);
  if (!season) throw new GameError('SEASON_NOT_FOUND', 'No such season', 404);
  if (season.rulesetVersion < MULTI_WORLD.clanRulesetVersion) {
    throw new GameError('CLANS_NEXT_SEASON', 'Clans begin with the next ruleset-v3 season', 409);
  }
  return season;
}

async function lockClan(
  tx: Tx,
  clanId: string,
  seasonId: string,
): Promise<typeof clans.$inferSelect> {
  const [clan] = await tx
    .select()
    .from(clans)
    .where(and(eq(clans.id, clanId), eq(clans.seasonId, seasonId)))
    .for('update');
  if (!clan || clan.disbandedAt) throw new GameError('CLAN_NOT_FOUND', 'No such active clan', 404);
  return clan;
}

async function expireRequests(
  tx: Tx,
  now: Date,
  filter: { clanId?: string; playerId?: string } = {},
): Promise<void> {
  await tx
    .update(clanRequests)
    .set({ status: 'EXPIRED', resolvedAt: now })
    .where(and(
      eq(clanRequests.status, 'PENDING'),
      lte(clanRequests.expiresAt, now),
      filter.clanId ? eq(clanRequests.clanId, filter.clanId) : undefined,
      filter.playerId ? eq(clanRequests.playerId, filter.playerId) : undefined,
    ));
}

function assertRecruitmentUnlocked(player: Pick<ClanActor, 'clanLockedUntil'>, now: Date): void {
  if (player.clanLockedUntil && player.clanLockedUntil > now) {
    throw new GameError('CLAN_MEMBERSHIP_LOCKED', 'Clan actions are temporarily locked', 409, {
      until: player.clanLockedUntil.toISOString(),
    });
  }
}

/** Authoritative check after the common player lock, never from a route snapshot. */
async function assertLockedRecruitmentUnlocked(
  tx: Tx,
  playerId: string,
  now: Date,
): Promise<void> {
  const [player] = await tx
    .select({ clanLockedUntil: players.clanLockedUntil })
    .from(players)
    .where(eq(players.id, playerId))
    .for('update');
  if (!player) throw new GameError('PLAYER_NOT_FOUND', 'That commander is gone', 404);
  assertRecruitmentUnlocked(player, now);
}

async function displayNameOf(db: Queryable, playerId: string): Promise<string> {
  const [row] = await db
    .select({ displayName: accounts.displayName })
    .from(players)
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .where(eq(players.id, playerId))
    .limit(1);
  return row?.displayName ?? 'Former commander';
}

async function recordClanEvent(
  tx: Tx,
  input: {
    seasonId: string;
    clanId: string;
    kind: string;
    actorPlayerId?: string;
    actorName?: string;
    subjectPlayerId?: string;
    subjectName?: string;
    payload?: Record<string, unknown>;
    at: Date;
  },
): Promise<void> {
  await tx.insert(clanEvents).values({
    seasonId: input.seasonId,
    clanId: input.clanId,
    kind: input.kind,
    actorPlayerId: input.actorPlayerId,
    actorName: input.actorName,
    subjectPlayerId: input.subjectPlayerId,
    subjectName: input.subjectName,
    payload: input.payload ?? {},
    occurredAt: input.at,
  });
}

async function publishClan(
  tx: Tx,
  clanId: string,
  kind: ClanPrivateEventKind,
  extraPlayerIds: readonly string[] = [],
): Promise<void> {
  const memberIds = await activeClanPlayerIds(tx, clanId);
  for (const playerId of new Set([...memberIds, ...extraPlayerIds])) {
    await publishPrivate(tx, playerId, kind);
  }
}

const clanScoreSql = sql<number>`round(${clans.dominionTaken} - ${clans.dominionLost})`;

export interface PublicClanView {
  id: string;
  name: string;
  tag: string;
  description: string;
  recruiting: boolean;
  leaderName: string;
  memberCount: number;
  score: number;
}

export async function listPublicClans(
  db: Db,
  accountId: string,
  input: { search?: string; offset: number; limit: number },
): Promise<{ clans: PublicClanView[]; total: number }> {
  const actor = await clanActor(db, accountId);
  await assertClanRuleset(db, actor.seasonId);
  const search = input.search?.trim();
  const where = and(
    eq(clans.seasonId, actor.seasonId),
    isNull(clans.disbandedAt),
    search
      ? or(ilike(clans.name, `%${search}%`), ilike(clans.tag, `%${search}%`))
      : undefined,
  );
  const memberCount = sql<number>`count(${clanMemberships.id}) filter (where ${clanMemberships.leftAt} is null)::int`;
  const leaderName = sql<string>`coalesce(max(${accounts.displayName}) filter (where ${clanMemberships.role} = 'LEADER' and ${clanMemberships.leftAt} is null), 'Unknown')`;
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: clans.id,
        name: clans.name,
        tag: clans.tag,
        description: clans.description,
        recruiting: clans.recruiting,
        leaderName,
        memberCount,
        score: clanScoreSql,
      })
      .from(clans)
      .leftJoin(clanMemberships, eq(clanMemberships.clanId, clans.id))
      .leftJoin(players, eq(clanMemberships.playerId, players.id))
      .leftJoin(accounts, eq(players.accountId, accounts.id))
      .where(where)
      .groupBy(clans.id)
      .orderBy(desc(clanScoreSql), asc(clans.createdAt), asc(clans.id))
      .offset(input.offset)
      .limit(input.limit),
    db.select({ value: count() }).from(clans).where(where),
  ]);
  return { clans: rows, total: totals[0]?.value ?? 0 };
}

export async function publicClan(
  db: Db,
  accountId: string,
  clanId: string,
): Promise<PublicClanView> {
  const actor = await clanActor(db, accountId);
  await assertClanRuleset(db, actor.seasonId);
  const memberCount = sql<number>`count(${clanMemberships.id}) filter (where ${clanMemberships.leftAt} is null)::int`;
  const leaderName = sql<string>`coalesce(max(${accounts.displayName}) filter (where ${clanMemberships.role} = 'LEADER' and ${clanMemberships.leftAt} is null), 'Unknown')`;
  const [row] = await db
    .select({
      id: clans.id,
      name: clans.name,
      tag: clans.tag,
      description: clans.description,
      recruiting: clans.recruiting,
      leaderName,
      memberCount,
      score: clanScoreSql,
    })
    .from(clans)
    .leftJoin(clanMemberships, eq(clanMemberships.clanId, clans.id))
    .leftJoin(players, eq(clanMemberships.playerId, players.id))
    .leftJoin(accounts, eq(players.accountId, accounts.id))
    .where(and(eq(clans.id, clanId), eq(clans.seasonId, actor.seasonId), isNull(clans.disbandedAt)))
    .groupBy(clans.id);
  if (!row) throw new GameError('CLAN_NOT_FOUND', 'No such active clan', 404);
  return row;
}

export async function clanLeaderboard(
  db: Db,
  accountId: string,
): Promise<{ clans: (PublicClanView & { rank: number; self: boolean })[] }> {
  const actor = await clanActor(db, accountId);
  const mine = await activeClanMembership(db, actor.playerId);
  const directory = await listPublicClans(db, accountId, { offset: 0, limit: 300 });
  return {
    clans: directory.clans.map((clan, index) => ({
      ...clan,
      rank: index + 1,
      self: clan.id === mine?.clanId,
    })),
  };
}

export async function readClanBadge(db: Db, accountId: string, now: Date) {
  const actor = await clanActor(db, accountId);
  const [season] = await db
    .select({ rulesetVersion: seasons.rulesetVersion })
    .from(seasons)
    .where(eq(seasons.id, actor.seasonId));
  if (!season || season.rulesetVersion < MULTI_WORLD.clanRulesetVersion) {
    return {
      available: false as const,
      membership: null,
      attention: false,
      attentionCount: 0,
      clanChatUnread: 0,
    };
  }
  const membership = await activeClanMembership(db, actor.playerId);
  if (!membership) {
    const [pendingInvites, resolvedApplications, depot] = await Promise.all([
      db.select({ value: count() }).from(clanRequests).where(and(
        eq(clanRequests.playerId, actor.playerId),
        eq(clanRequests.kind, 'INVITATION'),
        eq(clanRequests.status, 'PENDING'),
        gt(clanRequests.expiresAt, now),
      )),
      db.select({ value: count() }).from(clanRequests).where(and(
        eq(clanRequests.playerId, actor.playerId),
        eq(clanRequests.kind, 'APPLICATION'),
        inArray(clanRequests.status, ['ACCEPTED', 'REJECTED', 'CLOSED']),
        actor.lastClanSeenAt ? gt(clanRequests.resolvedAt, actor.lastClanSeenAt) : undefined,
      )),
      db.select({ value: count() }).from(clanLootShares).where(and(
        eq(clanLootShares.playerId, actor.playerId),
        or(
          gt(clanLootShares.remainingAlloy, 0),
          gt(clanLootShares.remainingCrystal, 0),
          gt(clanLootShares.remainingDeuterium, 0),
        ),
      )),
    ]);
    const attentionCount = (pendingInvites[0]?.value ?? 0)
      + (resolvedApplications[0]?.value ?? 0)
      + (depot[0]?.value ?? 0);
    return {
      available: true as const,
      membership: null,
      attention: attentionCount > 0,
      attentionCount,
      clanChatUnread: 0,
    };
  }

  const [clan] = await db.select({ id: clans.id, name: clans.name, tag: clans.tag })
    .from(clans).where(eq(clans.id, membership.clanId));
  if (!clan) {
    return {
      available: true as const,
      membership: null,
      attention: false,
      attentionCount: 0,
      clanChatUnread: 0,
    };
  }
  const [requests, unread, depot] = await Promise.all([
    membership.role === 'LEADER'
      ? db.select({ value: count() }).from(clanRequests).where(and(
          eq(clanRequests.clanId, membership.clanId),
          eq(clanRequests.kind, 'APPLICATION'),
          eq(clanRequests.status, 'PENDING'),
          gt(clanRequests.expiresAt, now),
        ))
      : Promise.resolve([{ value: 0 }]),
    db.select({ value: count() }).from(clanMessages).where(and(
      eq(clanMessages.clanId, membership.clanId),
      ne(clanMessages.authorPlayerId, actor.playerId),
      gte(clanMessages.createdAt, membership.joinedAt),
      membership.lastChatReadAt ? gt(clanMessages.createdAt, membership.lastChatReadAt) : undefined,
    )),
    db.select({ value: count() }).from(clanLootShares).where(and(
      eq(clanLootShares.playerId, actor.playerId),
      or(
        gt(clanLootShares.remainingAlloy, 0),
        gt(clanLootShares.remainingCrystal, 0),
        gt(clanLootShares.remainingDeuterium, 0),
      ),
    )),
  ]);
  const attentionCount = (requests[0]?.value ?? 0) + (unread[0]?.value ?? 0) + (depot[0]?.value ?? 0);
  return {
    available: true as const,
    membership: {
      clanId: clan.id,
      name: clan.name,
      tag: clan.tag,
      role: membership.role,
      matureAt: membership.matureAt.toISOString(),
      mature: membership.matureAt <= now,
    },
    attention: attentionCount > 0,
    attentionCount,
    clanChatUnread: unread[0]?.value ?? 0,
  };
}

async function creationState(db: Queryable, actor: ClanActor) {
  const capital = await capitalPlanet(db, actor.playerId);
  const [core] = await db.select({ level: buildings.level }).from(buildings).where(and(
    eq(buildings.planetId, capital.id),
    eq(buildings.type, 'CORE'),
  ));
  return {
    capitalPlanetId: capital.id,
    coreLevel: core?.level ?? 0,
    requiredCoreLevel: CLAN.founderCoreLevel,
    cost: CLAN.creationCost,
    affordable: capital.alloy >= CLAN.creationCost.alloy
      && capital.crystal >= CLAN.creationCost.crystal,
    unlockedAt: actor.clanLockedUntil?.toISOString() ?? null,
  };
}

export async function readClanHome(db: Db, accountId: string, now: Date) {
  const actor = await clanActor(db, accountId);
  await assertClanRuleset(db, actor.seasonId);
  const membership = await activeClanMembership(db, actor.playerId);
  if (!membership) {
    const [requests, [depot]] = await Promise.all([
      db
        .select({
          id: clanRequests.id,
          clanId: clans.id,
          clanName: clans.name,
          clanTag: clans.tag,
          kind: clanRequests.kind,
          status: clanRequests.status,
          expiresAt: clanRequests.expiresAt,
          resolvedAt: clanRequests.resolvedAt,
        })
        .from(clanRequests)
        .innerJoin(clans, eq(clanRequests.clanId, clans.id))
        .where(and(
          eq(clanRequests.playerId, actor.playerId),
          or(ne(clanRequests.status, 'PENDING'), gt(clanRequests.expiresAt, now)),
        ))
        .orderBy(desc(clanRequests.createdAt))
        .limit(20),
      db.select({
        alloy: sql<number>`coalesce(sum(${clanLootShares.remainingAlloy}), 0)`,
        crystal: sql<number>`coalesce(sum(${clanLootShares.remainingCrystal}), 0)`,
        deuterium: sql<number>`coalesce(sum(${clanLootShares.remainingDeuterium}), 0)`,
      }).from(clanLootShares).where(eq(clanLootShares.playerId, actor.playerId)),
    ]);
    return {
      state: 'OUTSIDE' as const,
      requests: requests.map((request) => ({
        ...request,
        expiresAt: request.expiresAt.toISOString(),
        resolvedAt: request.resolvedAt?.toISOString() ?? null,
      })),
      depot: depot ?? { alloy: 0, crystal: 0, deuterium: 0 },
      creation: await creationState(db, actor),
    };
  }

  const [clan] = await db.select().from(clans).where(eq(clans.id, membership.clanId));
  if (!clan || clan.disbandedAt) throw new GameError('CLAN_NOT_FOUND', 'Clan is no longer active', 404);
  const memberRows = await db
    .select({
      playerId: clanMemberships.playerId,
      username: accounts.displayName,
      role: clanMemberships.role,
      slot: clanMemberships.slot,
      joinedAt: clanMemberships.joinedAt,
      matureAt: clanMemberships.matureAt,
      aidEnabled: clanMemberships.aidEnabled,
      lastActiveAt: players.lastActiveAt,
    })
    .from(clanMemberships)
    .innerJoin(players, eq(clanMemberships.playerId, players.id))
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .where(and(eq(clanMemberships.clanId, clan.id), isNull(clanMemberships.leftAt)))
    .orderBy(asc(clanMemberships.slot));
  const requestRows = membership.role === 'LEADER'
    ? await db
        .select({
          id: clanRequests.id,
          playerId: clanRequests.playerId,
          username: accounts.displayName,
          kind: clanRequests.kind,
          status: clanRequests.status,
          expiresAt: clanRequests.expiresAt,
        })
        .from(clanRequests)
        .innerJoin(players, eq(clanRequests.playerId, players.id))
        .innerJoin(accounts, eq(players.accountId, accounts.id))
        .where(and(
          eq(clanRequests.clanId, clan.id),
          eq(clanRequests.status, 'PENDING'),
          gt(clanRequests.expiresAt, now),
        ))
        .orderBy(asc(clanRequests.createdAt))
    : [];

  return {
    state: 'MEMBER' as const,
    clan: {
      id: clan.id,
      name: clan.name,
      tag: clan.tag,
      description: clan.description,
      recruiting: clan.recruiting,
      score: Math.round(clan.dominionTaken - clan.dominionLost),
      role: membership.role,
      matureAt: membership.matureAt.toISOString(),
      mature: membership.matureAt <= now,
      aidEnabled: memberRows.find((member) => member.playerId === actor.playerId)?.aidEnabled ?? true,
    },
    members: memberRows.map((member) => ({
      ...member,
      joinedAt: member.joinedAt.toISOString(),
      matureAt: member.matureAt.toISOString(),
      mature: member.matureAt <= now,
      activeRecently: member.lastActiveAt > addMinutes(now, -3 * 24 * 60),
    })),
    requests: requestRows.map((request) => ({
      ...request,
      expiresAt: request.expiresAt.toISOString(),
    })),
  };
}

export async function markClanSeen(tx: Tx, playerId: string, at: Date): Promise<string> {
  await tx.update(players).set({ lastClanSeenAt: at }).where(eq(players.id, playerId));
  return at.toISOString();
}

export async function createClan(
  tx: Tx,
  input: {
    actor: ClanActor;
    name: string;
    tag: string;
    description: string;
    recruiting: boolean;
    clock: Clock;
  },
) {
  const now = input.clock.now();
  const name = normaliseClanName(input.name);
  const tag = normaliseClanTag(input.tag);
  const description = input.description.trim();
  if (!clanNameIsValid(name)) throw new GameError('BAD_CLAN_NAME', 'Choose a valid clan name', 400);
  if (!clanTagIsValid(tag)) throw new GameError('BAD_CLAN_TAG', 'Use two to five letters or digits', 400);
  if (Array.from(description).length > CLAN.descriptionMaxChars) {
    throw new GameError('BAD_CLAN_DESCRIPTION', 'Clan description is too long', 400);
  }
  assertRecruitmentUnlocked(input.actor, now);
  const capital = await capitalPlanet(tx, input.actor.playerId);
  const locked = await loadLocked(tx, capital.id, input.clock, { expectedPlayerId: input.actor.playerId });
  const season = await assertClanRuleset(tx, input.actor.seasonId);
  if (season.status !== 'live') throw new GameError('SEASON_FROZEN', 'That season is over', 409);
  await lockClanPlayers(tx, [input.actor.playerId]);
  await assertLockedRecruitmentUnlocked(tx, input.actor.playerId, now);
  if (await activeClanMembership(tx, input.actor.playerId)) {
    throw new GameError('ALREADY_IN_CLAN', 'Leave your current clan first', 409);
  }
  if (locked.buildings.CORE < CLAN.founderCoreLevel) {
    throw new GameError('CLAN_CORE_REQUIRED', 'Raise the capital Command Core first', 409, {
      required: CLAN.founderCoreLevel,
    });
  }
  if (locked.alloy < CLAN.creationCost.alloy || locked.crystal < CLAN.creationCost.crystal) {
    throw new GameError('CLAN_COST_REQUIRED', 'The capital cannot pay the founding cost', 409, {
      alloy: CLAN.creationCost.alloy,
      crystal: CLAN.creationCost.crystal,
    });
  }
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-identity:${input.actor.seasonId}`}))`);
  const key = clanNameKey(name);
  const [taken] = await tx
    .select({ id: clans.id, nameKey: clans.nameKey, tag: clans.tag })
    .from(clans)
    .where(and(
      eq(clans.seasonId, input.actor.seasonId),
      or(eq(clans.nameKey, key), eq(clans.tag, tag)),
    ))
    .limit(1);
  if (taken) {
    throw new GameError(
      taken.tag === tag ? 'CLAN_TAG_TAKEN' : 'CLAN_NAME_TAKEN',
      taken.tag === tag ? 'That clan tag is already used' : 'That clan name is already used',
      409,
    );
  }
  const [clan] = await tx.insert(clans).values({
    seasonId: input.actor.seasonId,
    name,
    nameKey: key,
    tag,
    description,
    recruiting: input.recruiting,
    createdAt: now,
  }).returning();
  if (!clan) throw new Error('clan insert returned no row');
  await tx.insert(clanMemberships).values({
    seasonId: input.actor.seasonId,
    clanId: clan.id,
    playerId: input.actor.playerId,
    role: 'LEADER',
    slot: 0,
    joinedAt: now,
    matureAt: now,
    aidPolicyChangedAt: now,
  });
  await saveResources(tx, capital.id, {
    alloy: locked.alloy - CLAN.creationCost.alloy,
    crystal: locked.crystal - CLAN.creationCost.crystal,
    deuterium: locked.deuterium,
  });
  await recomputePlayerWealth(tx, input.actor.playerId);
  await recordClanEvent(tx, {
    seasonId: input.actor.seasonId,
    clanId: clan.id,
    kind: 'CREATED',
    actorPlayerId: input.actor.playerId,
    actorName: input.actor.displayName,
    at: now,
  });
  await publishPrivate(tx, input.actor.playerId, 'membership');
  await publishShard(tx, input.actor.seasonId, 'clan');
  return {
    clanId: clan.id,
    name: clan.name,
    tag: clan.tag,
    capitalPlanetId: capital.id,
    planet: await planetView(tx, capital.id, input.clock),
  };
}

async function assertLeader(
  tx: Queryable,
  playerId: string,
  clanId?: string,
): Promise<NonNullable<Awaited<ReturnType<typeof activeClanMembership>>>> {
  const membership = await activeClanMembership(tx, playerId);
  if (membership?.role !== 'LEADER' || (clanId !== undefined && membership.clanId !== clanId)) {
    throw new GameError('CLAN_LEADER_REQUIRED', 'Only the clan leader can do that', 403);
  }
  return membership;
}

/** Serialize clan management, then prove the actor still leads after waiting. */
async function lockLedClan(tx: Tx, actor: ClanActor) {
  const initial = await assertLeader(tx, actor.playerId);
  const clan = await lockClan(tx, initial.clanId, actor.seasonId);
  const membership = await assertLeader(tx, actor.playerId, clan.id);
  return { clan, membership };
}

export async function updateClanSettings(
  tx: Tx,
  input: { actor: ClanActor; description: string; recruiting: boolean; now: Date },
) {
  await lockSeason(tx, input.actor.seasonId);
  const { membership } = await lockLedClan(tx, input.actor);
  const description = input.description.trim();
  if (Array.from(description).length > CLAN.descriptionMaxChars) {
    throw new GameError('BAD_CLAN_DESCRIPTION', 'Clan description is too long', 400);
  }
  await tx.update(clans).set({ description, recruiting: input.recruiting })
    .where(eq(clans.id, membership.clanId));
  await recordClanEvent(tx, {
    seasonId: input.actor.seasonId,
    clanId: membership.clanId,
    kind: 'SETTINGS_CHANGED',
    actorPlayerId: input.actor.playerId,
    actorName: input.actor.displayName,
    payload: { recruiting: input.recruiting },
    at: input.now,
  });
  await publishClan(tx, membership.clanId, 'membership');
  await publishShard(tx, input.actor.seasonId, 'clan');
  return { description, recruiting: input.recruiting };
}

export async function applyToClan(
  tx: Tx,
  input: { actor: ClanActor; clanId: string; now: Date },
) {
  await lockSeason(tx, input.actor.seasonId);
  const clan = await lockClan(tx, input.clanId, input.actor.seasonId);
  await lockClanPlayers(tx, [input.actor.playerId]);
  await assertLockedRecruitmentUnlocked(tx, input.actor.playerId, input.now);
  assertRecruitmentUnlocked(input.actor, input.now);
  if (await activeClanMembership(tx, input.actor.playerId)) {
    throw new GameError('ALREADY_IN_CLAN', 'Leave your current clan first', 409);
  }
  if (!clan.recruiting) throw new GameError('CLAN_NOT_RECRUITING', 'That clan is not accepting applications', 409);
  await expireRequests(tx, input.now, { clanId: clan.id });
  await expireRequests(tx, input.now, { playerId: input.actor.playerId });
  const [[existing], [mine], [theirs], [members]] = await Promise.all([
    tx.select({ id: clanRequests.id, kind: clanRequests.kind }).from(clanRequests).where(and(
      eq(clanRequests.clanId, clan.id),
      eq(clanRequests.playerId, input.actor.playerId),
      eq(clanRequests.status, 'PENDING'),
    )).limit(1),
    tx.select({ value: count() }).from(clanRequests).where(and(
      eq(clanRequests.playerId, input.actor.playerId),
      eq(clanRequests.kind, 'APPLICATION'),
      eq(clanRequests.status, 'PENDING'),
    )),
    tx.select({ value: count() }).from(clanRequests).where(and(
      eq(clanRequests.clanId, clan.id),
      eq(clanRequests.kind, 'APPLICATION'),
      eq(clanRequests.status, 'PENDING'),
    )),
    tx.select({ value: count() }).from(clanMemberships).where(and(
      eq(clanMemberships.clanId, clan.id),
      isNull(clanMemberships.leftAt),
    )),
  ]);
  if (existing) {
    throw new GameError(
      'CLAN_REQUEST_EXISTS',
      existing.kind === 'INVITATION'
        ? 'That clan has already invited you'
        : 'You already applied to that clan',
      409,
    );
  }
  if ((members?.value ?? 0) >= CLAN.maxMembers) throw new GameError('CLAN_FULL', 'That clan is full', 409);
  if ((mine?.value ?? 0) >= CLAN.maxPlayerApplications) {
    throw new GameError('CLAN_APPLICATION_LIMIT', 'Withdraw an application before sending another', 409, {
      limit: CLAN.maxPlayerApplications,
    });
  }
  if ((theirs?.value ?? 0) >= CLAN.maxClanApplications) {
    throw new GameError('CLAN_APPLICATIONS_FULL', 'That clan has too many applications waiting', 409);
  }
  const [request] = await tx.insert(clanRequests).values({
    seasonId: input.actor.seasonId,
    clanId: clan.id,
    playerId: input.actor.playerId,
    kind: 'APPLICATION',
    createdByPlayerId: input.actor.playerId,
    createdAt: input.now,
    expiresAt: addMinutes(input.now, CLAN.requestExpiryMinutes),
  }).returning();
  if (!request) throw new Error('clan application insert returned no row');
  await publishClan(tx, clan.id, 'request', [input.actor.playerId]);
  return { requestId: request.id, expiresAt: request.expiresAt.toISOString() };
}

export async function inviteToClan(
  tx: Tx,
  input: { actor: ClanActor; playerId: string; now: Date },
) {
  await lockSeason(tx, input.actor.seasonId);
  const { clan } = await lockLedClan(tx, input.actor);
  const targetActor = await tx
    .select({
      playerId: players.id,
      seasonId: players.seasonId,
      accountId: players.accountId,
      displayName: accounts.displayName,
      clanLockedUntil: players.clanLockedUntil,
      lastClanSeenAt: players.lastClanSeenAt,
    })
    .from(players)
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .where(eq(players.id, input.playerId))
    .then((rows) => rows[0]);
  if (targetActor?.seasonId !== input.actor.seasonId) {
    throw new GameError('PLAYER_NOT_FOUND', 'No such commander in this galaxy', 404);
  }
  await lockClanPlayers(tx, [input.actor.playerId, input.playerId]);
  await assertLockedRecruitmentUnlocked(tx, input.playerId, input.now);
  assertRecruitmentUnlocked(targetActor, input.now);
  if (await activeClanMembership(tx, input.playerId)) {
    throw new GameError('PLAYER_ALREADY_IN_CLAN', 'That commander already belongs to a clan', 409);
  }
  await expireRequests(tx, input.now, { clanId: clan.id });
  await expireRequests(tx, input.now, { playerId: input.playerId });
  const since = addMinutes(input.now, -24 * 60);
  const [[existing], [pending], [sent], [members]] = await Promise.all([
    tx.select({ id: clanRequests.id, kind: clanRequests.kind }).from(clanRequests).where(and(
      eq(clanRequests.clanId, clan.id),
      eq(clanRequests.playerId, input.playerId),
      eq(clanRequests.status, 'PENDING'),
    )).limit(1),
    tx.select({ value: count() }).from(clanRequests).where(and(
      eq(clanRequests.clanId, clan.id),
      eq(clanRequests.kind, 'INVITATION'),
      eq(clanRequests.status, 'PENDING'),
    )),
    tx.select({ value: count() }).from(clanRequests).where(and(
      eq(clanRequests.createdByPlayerId, input.actor.playerId),
      eq(clanRequests.kind, 'INVITATION'),
      gt(clanRequests.createdAt, since),
    )),
    tx.select({ value: count() }).from(clanMemberships).where(and(
      eq(clanMemberships.clanId, clan.id),
      isNull(clanMemberships.leftAt),
    )),
  ]);
  if (existing) {
    throw new GameError(
      'CLAN_REQUEST_EXISTS',
      existing.kind === 'APPLICATION'
        ? 'That commander already applied to your clan'
        : 'That commander already has your invitation',
      409,
    );
  }
  if ((members?.value ?? 0) >= CLAN.maxMembers) throw new GameError('CLAN_FULL', 'Your clan is full', 409);
  if ((pending?.value ?? 0) >= CLAN.maxClanInvitations) {
    throw new GameError('CLAN_INVITATIONS_FULL', 'Your clan has too many invitations waiting', 409);
  }
  if ((sent?.value ?? 0) >= CLAN.maxLeaderInvitationsPerDay) {
    throw new GameError('CLAN_INVITE_RATE', 'You have sent too many invitations today', 429, {
      limit: CLAN.maxLeaderInvitationsPerDay,
      hours: 24,
    });
  }
  const [request] = await tx.insert(clanRequests).values({
    seasonId: input.actor.seasonId,
    clanId: clan.id,
    playerId: input.playerId,
    kind: 'INVITATION',
    createdByPlayerId: input.actor.playerId,
    createdAt: input.now,
    expiresAt: addMinutes(input.now, CLAN.requestExpiryMinutes),
  }).returning();
  if (!request) throw new Error('clan invitation insert returned no row');
  await recordClanEvent(tx, {
    seasonId: input.actor.seasonId,
    clanId: clan.id,
    kind: 'INVITED',
    actorPlayerId: input.actor.playerId,
    actorName: input.actor.displayName,
    subjectPlayerId: input.playerId,
    subjectName: targetActor.displayName,
    at: input.now,
  });
  await publishClan(tx, clan.id, 'request', [input.playerId]);
  return { requestId: request.id, expiresAt: request.expiresAt.toISOString() };
}

async function activeMemberRows(tx: Queryable, clanId: string) {
  return tx.select().from(clanMemberships).where(and(
    eq(clanMemberships.clanId, clanId),
    isNull(clanMemberships.leftAt),
  )).orderBy(asc(clanMemberships.slot));
}

export async function acceptClanRequest(
  tx: Tx,
  input: { actor: ClanActor; requestId: string; acknowledgeHostile: boolean; now: Date },
) {
  await lockSeason(tx, input.actor.seasonId);
  const [initial] = await tx.select().from(clanRequests).where(and(
    eq(clanRequests.id, input.requestId),
    eq(clanRequests.seasonId, input.actor.seasonId),
  )).limit(1);
  if (!initial) throw new GameError('CLAN_REQUEST_NOT_FOUND', 'No such clan request', 404);
  const clan = await lockClan(tx, initial.clanId, input.actor.seasonId);
  const before = await activeMemberRows(tx, clan.id);
  await lockClanPlayers(tx, [...before.map((member) => member.playerId), initial.playerId]);
  const [request] = await tx.select().from(clanRequests)
    .where(eq(clanRequests.id, input.requestId)).for('update');
  if (request?.status !== 'PENDING' || request.expiresAt <= input.now) {
    if (request?.status === 'PENDING') {
      await tx.update(clanRequests).set({ status: 'EXPIRED', resolvedAt: input.now })
        .where(eq(clanRequests.id, request.id));
    }
    throw new GameError('CLAN_REQUEST_CLOSED', 'That clan request is no longer open', 409);
  }
  if (request.kind === 'APPLICATION') {
    await assertLeader(tx, input.actor.playerId, clan.id);
  } else if (request.playerId !== input.actor.playerId) {
    throw new GameError('CLAN_REQUEST_NOT_YOURS', 'Only the invited commander can accept', 403);
  }
  const [candidate] = await tx.select({
    id: players.id,
    accountId: players.accountId,
    clanLockedUntil: players.clanLockedUntil,
  }).from(players).where(eq(players.id, request.playerId));
  if (!candidate) throw new GameError('PLAYER_NOT_FOUND', 'That commander is gone', 404);
  assertRecruitmentUnlocked(candidate, input.now);
  if (await activeClanMembership(tx, candidate.id)) {
    throw new GameError('PLAYER_ALREADY_IN_CLAN', 'That commander already belongs to a clan', 409);
  }
  const members = await activeMemberRows(tx, clan.id);
  if (members.length >= CLAN.maxMembers) throw new GameError('CLAN_FULL', 'That clan is full', 409);
  const hostile = await hasHostileFlightWithClan(tx, candidate.id, members.map((member) => member.playerId));
  if (hostile && !input.acknowledgeHostile) {
    throw new GameError(
      'CLAN_HOSTILE_FLIGHT_ACK_REQUIRED',
      'Existing hostile flights will still resolve; acknowledge before accepting',
      409,
    );
  }
  const used = new Set(members.map((member) => member.slot));
  const slot = Array.from({ length: CLAN.maxMembers }, (_, index) => index)
    .find((index) => !used.has(index));
  if (slot === undefined) throw new GameError('CLAN_FULL', 'That clan is full', 409);
  const candidateName = await displayNameOf(tx, candidate.id);
  await tx.update(clanRequests).set({ status: 'ACCEPTED', resolvedAt: input.now })
    .where(eq(clanRequests.id, request.id));
  await tx.insert(clanMemberships).values({
    seasonId: input.actor.seasonId,
    clanId: clan.id,
    playerId: candidate.id,
    role: 'MEMBER',
    slot,
    joinedAt: input.now,
    matureAt: addMinutes(input.now, CLAN.adaptationMinutes),
    aidPolicyChangedAt: input.now,
  });
  await bindOpenAttacksToClan(tx, candidate.id, clan.id, input.now);
  await tx.update(clanRequests).set({ status: 'CLOSED', resolvedAt: input.now }).where(and(
    eq(clanRequests.playerId, candidate.id),
    eq(clanRequests.status, 'PENDING'),
    ne(clanRequests.id, request.id),
  ));
  if (members.length + 1 >= CLAN.maxMembers) {
    await tx.update(clanRequests).set({ status: 'CLOSED', resolvedAt: input.now }).where(and(
      eq(clanRequests.clanId, clan.id),
      eq(clanRequests.status, 'PENDING'),
    ));
  }
  await recordClanEvent(tx, {
    seasonId: input.actor.seasonId,
    clanId: clan.id,
    kind: 'JOINED',
    actorPlayerId: input.actor.playerId,
    actorName: input.actor.displayName,
    subjectPlayerId: candidate.id,
    subjectName: candidateName,
    payload: { hostileFlightsAcknowledged: hostile },
    at: input.now,
  });
  await publishClan(tx, clan.id, 'membership', [candidate.id]);
  await publishShard(tx, input.actor.seasonId, 'clan');
  return {
    clanId: clan.id,
    playerId: candidate.id,
    slot,
    matureAt: addMinutes(input.now, CLAN.adaptationMinutes).toISOString(),
    hostileFlightsContinue: hostile,
  };
}

export async function closeClanRequest(
  tx: Tx,
  input: {
    actor: ClanActor;
    requestId: string;
    action: 'REJECT' | 'WITHDRAW';
    now: Date;
  },
) {
  await lockSeason(tx, input.actor.seasonId);
  const [initial] = await tx.select().from(clanRequests).where(and(
    eq(clanRequests.id, input.requestId),
    eq(clanRequests.seasonId, input.actor.seasonId),
  ));
  if (!initial) throw new GameError('CLAN_REQUEST_CLOSED', 'That clan request is no longer open', 409);
  await lockClan(tx, initial.clanId, input.actor.seasonId);
  const [request] = await tx.select().from(clanRequests).where(and(
    eq(clanRequests.id, input.requestId),
    eq(clanRequests.seasonId, input.actor.seasonId),
  )).for('update');
  if (request?.status !== 'PENDING' || request.expiresAt <= input.now) {
    throw new GameError('CLAN_REQUEST_CLOSED', 'That clan request is no longer open', 409);
  }
  if (input.action === 'WITHDRAW') {
    if (request.kind !== 'APPLICATION' || request.playerId !== input.actor.playerId) {
      throw new GameError('CLAN_REQUEST_NOT_YOURS', 'Only the applicant can withdraw', 403);
    }
  } else {
    const leader = await activeClanMembership(tx, input.actor.playerId);
    const mayLead = leader?.role === 'LEADER' && leader.clanId === request.clanId;
    const mayDeclineInvite = request.kind === 'INVITATION' && request.playerId === input.actor.playerId;
    if (!mayLead && !mayDeclineInvite) {
      throw new GameError('CLAN_REQUEST_NOT_YOURS', 'You cannot close that request', 403);
    }
  }
  const status = input.action === 'WITHDRAW' ? 'WITHDRAWN' as const : 'REJECTED' as const;
  await tx.update(clanRequests).set({ status, resolvedAt: input.now })
    .where(eq(clanRequests.id, request.id));
  await publishClan(tx, request.clanId, 'request', [request.playerId]);
  return { requestId: request.id, status };
}

async function addCeasefires(
  tx: Tx,
  seasonId: string,
  clanId: string,
  departingPlayerIds: readonly string[],
  allMemberIds: readonly string[],
  now: Date,
): Promise<void> {
  const endsAt = addMinutes(now, CLAN.ceasefireMinutes);
  const pairs = new Map<string, [string, string]>();
  for (const departing of departingPlayerIds) {
    for (const other of allMemberIds) {
      if (departing === other) continue;
      const pair = canonicalPlayerPair(departing, other);
      pairs.set(pair.join(':'), pair);
    }
  }
  for (const [low, high] of pairs.values()) {
    await tx.insert(clanCeasefires).values({
      seasonId,
      playerLowId: low,
      playerHighId: high,
      sourceClanId: clanId,
      startsAt: now,
      endsAt,
    }).onConflictDoUpdate({
      target: [clanCeasefires.seasonId, clanCeasefires.playerLowId, clanCeasefires.playerHighId],
      set: {
        startsAt: now,
        endsAt: sql`greatest(${clanCeasefires.endsAt}, ${endsAt.toISOString()}::timestamptz)`,
        sourceClanId: clanId,
      },
    });
  }
}

async function separateMember(
  tx: Tx,
  input: {
    actor: ClanActor;
    membershipId: string;
    playerId: string;
    playerName: string;
    clanId: string;
    memberIds: string[];
    kind: 'LEFT' | 'KICKED';
    now: Date;
  },
): Promise<void> {
  await addCeasefires(tx, input.actor.seasonId, input.clanId, [input.playerId], input.memberIds, input.now);
  await tx.update(clanMemberships).set({ leftAt: input.now })
    .where(and(eq(clanMemberships.id, input.membershipId), isNull(clanMemberships.leftAt)));
  await tx.update(players).set({ clanLockedUntil: addMinutes(input.now, CLAN.membershipLockMinutes) })
    .where(eq(players.id, input.playerId));
  await tx.update(clanRequests).set({ status: 'CLOSED', resolvedAt: input.now }).where(and(
    eq(clanRequests.playerId, input.playerId),
    eq(clanRequests.status, 'PENDING'),
  ));
  await recordClanEvent(tx, {
    seasonId: input.actor.seasonId,
    clanId: input.clanId,
    kind: input.kind,
    actorPlayerId: input.actor.playerId,
    actorName: input.actor.displayName,
    subjectPlayerId: input.playerId,
    subjectName: input.playerName,
    at: input.now,
  });
}

export async function leaveClan(tx: Tx, input: { actor: ClanActor; now: Date }) {
  await lockSeason(tx, input.actor.seasonId);
  const membership = await activeClanMembership(tx, input.actor.playerId);
  if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 409);
  if (membership.role === 'LEADER') {
    throw new GameError('CLAN_LEADER_MUST_TRANSFER', 'Transfer leadership or disband the clan first', 409);
  }
  await lockClan(tx, membership.clanId, input.actor.seasonId);
  const members = await activeMemberRows(tx, membership.clanId);
  await lockClanPlayers(tx, members.map((member) => member.playerId));
  const mine = members.find((member) => member.playerId === input.actor.playerId);
  if (!mine) throw new GameError('NOT_IN_CLAN', 'You no longer belong to that clan', 409);
  if (mine.role === 'LEADER') {
    throw new GameError('CLAN_LEADER_MUST_TRANSFER', 'Transfer leadership or disband the clan first', 409);
  }
  await separateMember(tx, {
    actor: input.actor,
    membershipId: mine.id,
    playerId: mine.playerId,
    playerName: input.actor.displayName,
    clanId: membership.clanId,
    memberIds: members.map((member) => member.playerId),
    kind: 'LEFT',
    now: input.now,
  });
  await publishClan(tx, membership.clanId, 'membership', [input.actor.playerId]);
  await publishShard(tx, input.actor.seasonId, 'clan');
  return { left: true as const, lockedUntil: addMinutes(input.now, CLAN.membershipLockMinutes).toISOString() };
}

export async function kickClanMember(
  tx: Tx,
  input: { actor: ClanActor; playerId: string; now: Date },
) {
  await lockSeason(tx, input.actor.seasonId);
  const { membership: leader } = await lockLedClan(tx, input.actor);
  if (input.playerId === input.actor.playerId) {
    throw new GameError('CLAN_LEADER_MUST_TRANSFER', 'Transfer leadership or disband the clan first', 409);
  }
  const members = await activeMemberRows(tx, leader.clanId);
  await lockClanPlayers(tx, members.map((member) => member.playerId));
  const target = members.find((member) => member.playerId === input.playerId);
  if (!target) throw new GameError('CLAN_MEMBER_NOT_FOUND', 'That commander is not in your clan', 404);
  const targetName = await displayNameOf(tx, target.playerId);
  await separateMember(tx, {
    actor: input.actor,
    membershipId: target.id,
    playerId: target.playerId,
    playerName: targetName,
    clanId: leader.clanId,
    memberIds: members.map((member) => member.playerId),
    kind: 'KICKED',
    now: input.now,
  });
  await publishClan(tx, leader.clanId, 'membership', [target.playerId]);
  await publishShard(tx, input.actor.seasonId, 'clan');
  return { kickedPlayerId: target.playerId, lockedUntil: addMinutes(input.now, CLAN.membershipLockMinutes).toISOString() };
}

export async function transferClanLeadership(
  tx: Tx,
  input: { actor: ClanActor; playerId: string; now: Date },
) {
  await lockSeason(tx, input.actor.seasonId);
  const { membership: leader } = await lockLedClan(tx, input.actor);
  const members = await activeMemberRows(tx, leader.clanId);
  await lockClanPlayers(tx, members.map((member) => member.playerId));
  const next = members.find((member) => member.playerId === input.playerId);
  if (!next || next.playerId === input.actor.playerId) {
    throw new GameError('CLAN_MEMBER_NOT_FOUND', 'Choose another clan member', 404);
  }
  const current = members.find((member) => member.playerId === input.actor.playerId);
  if (current?.role !== 'LEADER') {
    throw new GameError('CLAN_LEADER_REQUIRED', 'You are no longer the clan leader', 403);
  }
  await tx.update(clanMemberships).set({ role: 'MEMBER' }).where(eq(clanMemberships.id, current.id));
  await tx.update(clanMemberships).set({ role: 'LEADER' }).where(eq(clanMemberships.id, next.id));
  const nextName = await displayNameOf(tx, next.playerId);
  await recordClanEvent(tx, {
    seasonId: input.actor.seasonId,
    clanId: leader.clanId,
    kind: 'LEADERSHIP_TRANSFERRED',
    actorPlayerId: input.actor.playerId,
    actorName: input.actor.displayName,
    subjectPlayerId: next.playerId,
    subjectName: nextName,
    at: input.now,
  });
  await publishClan(tx, leader.clanId, 'membership');
  await publishShard(tx, input.actor.seasonId, 'clan');
  return { leaderPlayerId: next.playerId };
}

export async function disbandClan(tx: Tx, input: { actor: ClanActor; now: Date }) {
  await lockSeason(tx, input.actor.seasonId);
  const { membership: leader } = await lockLedClan(tx, input.actor);
  const members = await activeMemberRows(tx, leader.clanId);
  const memberIds = members.map((member) => member.playerId);
  await lockClanPlayers(tx, memberIds);
  await addCeasefires(tx, input.actor.seasonId, leader.clanId, memberIds, memberIds, input.now);
  await recordClanEvent(tx, {
    seasonId: input.actor.seasonId,
    clanId: leader.clanId,
    kind: 'DISBANDED',
    actorPlayerId: input.actor.playerId,
    actorName: input.actor.displayName,
    at: input.now,
  });
  await tx.update(clanMemberships).set({ leftAt: input.now }).where(and(
    eq(clanMemberships.clanId, leader.clanId),
    isNull(clanMemberships.leftAt),
  ));
  await tx.update(players).set({ clanLockedUntil: addMinutes(input.now, CLAN.membershipLockMinutes) })
    .where(inArray(players.id, memberIds));
  await tx.update(clanRequests).set({ status: 'CLOSED', resolvedAt: input.now }).where(and(
    eq(clanRequests.clanId, leader.clanId),
    eq(clanRequests.status, 'PENDING'),
  ));
  await tx.update(clans).set({ disbandedAt: input.now, recruiting: false })
    .where(eq(clans.id, leader.clanId));
  for (const playerId of memberIds) await publishPrivate(tx, playerId, 'membership');
  await publishShard(tx, input.actor.seasonId, 'clan');
  return { disbanded: true as const, lockedUntil: addMinutes(input.now, CLAN.membershipLockMinutes).toISOString() };
}

export async function setClanAidPolicy(
  tx: Tx,
  input: { actor: ClanActor; enabled: boolean; now: Date },
) {
  await lockSeason(tx, input.actor.seasonId);
  await lockClanPlayers(tx, [input.actor.playerId]);
  const [membership] = await tx.select().from(clanMemberships).where(and(
    eq(clanMemberships.playerId, input.actor.playerId),
    isNull(clanMemberships.leftAt),
  )).for('update');
  if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 409);
  if (membership.aidEnabled === input.enabled) {
    return { enabled: input.enabled, changedAt: membership.aidPolicyChangedAt.toISOString() };
  }
  const unlockedAt = addMinutes(membership.aidPolicyChangedAt, CLAN.aidPolicyCooldownMinutes);
  if (unlockedAt > input.now) {
    throw new GameError('CLAN_AID_POLICY_COOLDOWN', 'Aid preference cannot change yet', 409, {
      until: unlockedAt.toISOString(),
    });
  }
  await tx.update(clanMemberships).set({ aidEnabled: input.enabled, aidPolicyChangedAt: input.now })
    .where(eq(clanMemberships.id, membership.id));
  await publishClan(tx, membership.clanId, 'aid');
  return { enabled: input.enabled, changedAt: input.now.toISOString() };
}

export async function readClanEvents(
  db: Db,
  accountId: string,
  input: { before?: string; limit: number; now: Date },
) {
  const actor = await clanActor(db, accountId);
  const membership = await activeClanMembership(db, actor.playerId);
  if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 403);
  if (membership.matureAt > input.now) {
    throw new GameError('CLAN_ADAPTING', 'Detailed history opens after adaptation', 409, {
      until: membership.matureAt.toISOString(),
    });
  }
  let cursor: { occurredAt: Date; id: string } | undefined;
  if (input.before) {
    const [row] = await db.select({ occurredAt: clanEvents.occurredAt, id: clanEvents.id })
      .from(clanEvents).where(and(
        eq(clanEvents.id, input.before),
        eq(clanEvents.clanId, membership.clanId),
        gte(clanEvents.occurredAt, membership.matureAt),
      ));
    if (!row) throw new GameError('BAD_CLAN_CURSOR', 'That history cursor is not visible', 400);
    cursor = row;
  }
  const rows = await db.select().from(clanEvents).where(and(
    eq(clanEvents.clanId, membership.clanId),
    gte(clanEvents.occurredAt, membership.matureAt),
    cursor ? or(
      sql`${clanEvents.occurredAt} < ${cursor.occurredAt}`,
      and(eq(clanEvents.occurredAt, cursor.occurredAt), sql`${clanEvents.id} < ${cursor.id}`),
    ) : undefined,
  )).orderBy(desc(clanEvents.occurredAt), desc(clanEvents.id)).limit(input.limit + 1);
  const page = rows.slice(0, input.limit);
  return {
    events: page.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
    nextBefore: rows.length > input.limit ? page.at(-1)?.id ?? null : null,
  };
}

/**
 * Keep a clan valid when the ordinary three-day idle-seat sweep removes a member.
 *
 * The caller has already proved the commander's world is quiet. History is kept
 * as name/id snapshots in `clan_events`; the membership row itself must later be
 * deleted because it has a real player foreign key. If the leader disappears,
 * the oldest remaining commander who was active inside the same three-day window
 * takes over. With nobody active, retaining a leaderless clan would strand every
 * dormant member, so the clan is closed exactly like an explicit disband.
 */
export async function reconcileClanPlayerReclaim(
  tx: Tx,
  input: {
    playerId: string;
    seasonId: string;
    displayName: string;
    now: Date;
    activeCutoff: Date;
  },
): Promise<void> {
  const [initial] = await tx
    .select({
      id: clanMemberships.id,
      clanId: clanMemberships.clanId,
      role: clanMemberships.role,
    })
    .from(clanMemberships)
    .where(and(
      eq(clanMemberships.playerId, input.playerId),
      eq(clanMemberships.seasonId, input.seasonId),
      isNull(clanMemberships.leftAt),
    ))
    .limit(1);
  if (!initial) return;

  const clan = await lockClan(tx, initial.clanId, input.seasonId);
  const members = await tx
    .select({
      membershipId: clanMemberships.id,
      playerId: clanMemberships.playerId,
      role: clanMemberships.role,
      joinedAt: clanMemberships.joinedAt,
      lastActiveAt: players.lastActiveAt,
      displayName: accounts.displayName,
    })
    .from(clanMemberships)
    .innerJoin(players, eq(clanMemberships.playerId, players.id))
    .innerJoin(accounts, eq(players.accountId, accounts.id))
    .where(and(eq(clanMemberships.clanId, clan.id), isNull(clanMemberships.leftAt)))
    .orderBy(asc(clanMemberships.joinedAt), asc(clanMemberships.playerId));
  await lockClanPlayers(tx, members.map((member) => member.playerId));

  const current = members.find((member) => member.playerId === input.playerId);
  if (!current) return;
  const remaining = members.filter((member) => member.playerId !== input.playerId);

  if (current.role === 'LEADER') {
    const successor = remaining.find((member) => member.lastActiveAt >= input.activeCutoff);
    if (successor) {
      // The partial unique index permits one active leader, so demote first.
      await tx.update(clanMemberships).set({ role: 'MEMBER' })
        .where(eq(clanMemberships.id, current.membershipId));
      await tx.update(clanMemberships).set({ role: 'LEADER' })
        .where(eq(clanMemberships.id, successor.membershipId));
      await recordClanEvent(tx, {
        seasonId: input.seasonId,
        clanId: clan.id,
        kind: 'LEADERSHIP_RECLAIMED',
        actorPlayerId: input.playerId,
        actorName: input.displayName,
        subjectPlayerId: successor.playerId,
        subjectName: successor.displayName,
        at: input.now,
      });
    } else {
      const remainingIds = remaining.map((member) => member.playerId);
      await addCeasefires(tx, input.seasonId, clan.id, remainingIds, remainingIds, input.now);
      if (remainingIds.length > 0) {
        await tx.update(players)
          .set({ clanLockedUntil: addMinutes(input.now, CLAN.membershipLockMinutes) })
          .where(inArray(players.id, remainingIds));
      }
      await tx.update(clanMemberships).set({ leftAt: input.now }).where(and(
        eq(clanMemberships.clanId, clan.id),
        isNull(clanMemberships.leftAt),
      ));
      await tx.update(clanRequests).set({ status: 'CLOSED', resolvedAt: input.now }).where(and(
        eq(clanRequests.clanId, clan.id),
        eq(clanRequests.status, 'PENDING'),
      ));
      await tx.update(clans).set({ disbandedAt: input.now, recruiting: false })
        .where(eq(clans.id, clan.id));
      await recordClanEvent(tx, {
        seasonId: input.seasonId,
        clanId: clan.id,
        kind: 'DISBANDED_INACTIVE',
        actorPlayerId: input.playerId,
        actorName: input.displayName,
        at: input.now,
      });
    }
  } else {
    await recordClanEvent(tx, {
      seasonId: input.seasonId,
      clanId: clan.id,
      kind: 'MEMBER_RECLAIMED',
      subjectPlayerId: input.playerId,
      subjectName: input.displayName,
      at: input.now,
    });
  }

  for (const member of remaining) await publishPrivate(tx, member.playerId, 'membership');
  await publishShard(tx, input.seasonId, 'clan');
}
