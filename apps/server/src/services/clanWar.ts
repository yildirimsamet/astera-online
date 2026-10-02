import { randomUUID } from 'node:crypto';
import { and, count, eq, gt, inArray, isNull, ne, sql } from 'drizzle-orm';
import {
  ABUSE,
  CLAN,
  MULTI_WORLD,
  COMBAT_HULLS,
  ENGAGEMENT_MS,
  HULLS,
  JOINT_WAR_PHYSICAL_LEGS,
  JOINT_WAR_STAGING_LEGS,
  UNAIDED,
  canAttack,
  distance,
  capLoadToSurvivors,
  fleetCount,
  fleetSpeed,
  fleetSpeedMult,
  fleetTravelExact,
  engagementEndsAt,
  hangarCapacity,
  maxRadarRange,
  travelExact,
  hangarLoad,
  isMissionPace,
  jointWarFuelLegs,
  pacesForMinutes,
  type FaultKind,
  type Fleet,
  type HullId,
  type JointWarFuelLeg,
  type TechLevels,
} from '@astera/rules';
import { addMinutes, type Clock } from '../clock.js';
import { commitGameError } from './idempotency.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import {
  accounts,
  attackCommitments,
  clanWarContributions,
  clanWarMissions,
  clanWarOperations,
  clans,
  buildings,
  missions,
  planetFaults,
  planets,
  players,
  satellites,
  seasons,
  units,
  type ClanWarCloseReason,
  type ClanWarContributionSource,
  type ClanWarContributionStatus,
} from '../db/schema.js';
import {
  GameError,
  assertWorldOperational,
  loadLocked,
  lockSeason,
  orbitOf as orbitOfWorld,
  orbitFromRows,
  recomputePlayerWealth,
  saveResources,
  setUnits,
  totalUnitsOf,
  type LockedPlanet,
} from './planet.js';
import { dockNotice, landShips, type DockReport } from './shipDamage.js';
import { settleWaveRadiation, tellRadiationLoss } from './radiation.js';
import { safeHomePlanet } from './ownership.js';
import { notify } from './notifications.js';
import { assertDeparturesAllowed, baysOf } from './flight.js';
import { inboundRadarLead } from './radar.js';
import { assertFuel, fuelAvailable } from './fuel.js';
import { techOf } from './researchState.js';
import { planetView, type PlanetView } from './planetView.js';
import { pendingThreads, type PendingThread } from './session.js';
import { peakCoreLevels } from './player.js';
import {
  activeClanMembership,
  activeClanPlayerIds,
  assertClanHostilityAllowed,
  lockClanPlayers,
  prepareJointClanAttack,
  recordJointClanAttack,
} from './clanCombat.js';
import {
  assertAttackProtections,
  assertTargetReachable,
  assertTierBand,
  assertWorldAttackable,
  protectionFrom,
} from './attackProtection.js';
import {
  assertJointWarRuleset,
  clanHangarUsage,
  clanTreasuryProjection,
  jointWarAvailable,
  requireMemberClan,
  type ClanHangarUsage,
  type ClanWarEconomyView,
} from './clanTreasury.js';
import { locationIsKnown } from './locationSight.js';
import { galaxyTraffic, sensorPosts, type Contact } from './traffic.js';
import { rememberedWorlds } from './intel.js';
import { schedule } from '../worker/queue.js';
import { publishPrivate, publishShard } from '../stream/bus.js';
import { fleetChangesWatch, publishWatchChanges } from './watchEvents.js';
import type { ClanActor } from './clan.js';
/*
  THE SETTLEMENT IS A SEPARATE FILE AND IMPORTS BACK INTO THIS ONE for the return
  planner and the close. Both directions are plain function declarations, which
  ES modules resolve cleanly; what would not is either side calling the other at
  module scope, and neither does.
*/
import { resolveClanWarBattle } from './clanWarSettlement.js';

/**
 * KLAN ORTAK SAVAŞI — the operation. Owner design, 2026-09-20.
 *
 * A clan's joint war is a persistent state machine, not an attack with a bigger
 * fleet. The leader MARKS a target; for twenty-four hours members fly waves to
 * the leader's capital and wait there; the leader launches one combined strike;
 * every survivor flies home to the world it left from. Each of those is a state a
 * player can see, a worker can resume, and a crash can be recovered from.
 *
 * WHAT MARKING IS AND IS NOT. It is a statement of intent that costs nothing: no
 * fleet moves, no fuel is spent, the leader's own shield stays where it is, and
 * the target is not told. What it DOES do is claim the clan — one open operation
 * at a time — and freeze two facts for twenty-four hours: WHO is being hit, and
 * WHERE everybody is flying to. Both have to be frozen, because members commit
 * real fuel against them.
 *
 * THE CROSS-SYSTEM LOCK INVARIANTS:
 * - the season row serialises every joint-war state transition;
 * - every world the transition may write is locked first, in planet-id order;
 * - clan score rows are locked before player ledgers; and
 * - a set of player ledgers is locked in player-id order.
 *
 * Operation and contribution rows may be taken on either side of a player row:
 * no non-joint path locks them, and the season row prevents two joint paths from
 * crossing. `clanTreasury` uses the same season/world/clan ordering. The explicit
 * clan-before-player rule is what keeps both systems compatible with clan
 * management, which also takes its clan row before member ledgers.
 */

/** Contribution states that still hold something the operation has to wait for. */
const LIVE_CONTRIBUTION_STATUSES: readonly ClanWarContributionStatus[] = [
  'OUTBOUND', 'STAGED', 'RECALL_ORDERED', 'IN_BATTLE', 'RETURNING',
];

export type ClanWarOperationRow = typeof clanWarOperations.$inferSelect;

export interface ClanWarTargetView {
  playerId: string;
  username: string;
  planetId: string;
  planetName: string;
  position: { x: number; y: number; z: number };
}

/**
 * ONE WAVE AS ITS OWN CLAN SEES IT.
 *
 * Members see every wave in the pool — whose it is, where it left from, what is
 * in it and when it lands — because that is what makes the pool a shared decision
 * rather than five private ones. Nobody outside the clan sees any of it.
 */
export interface ClanWarContributionView {
  id: string;
  playerId: string;
  username: string;
  originPlanetId: string;
  originPlanetName: string;
  sourceKind: ClanWarContributionSource;
  status: ClanWarContributionStatus;
  fleet: Fleet;
  bulk: number;
  fuelPaid: number;
  sentAt: string;
  /** When it reaches the staging world. Null once it is there, or never flew. */
  arrivesAt: string | null;
  /** True only for the caller's own waves: a recall is theirs alone. */
  mine: boolean;
  canRecall: boolean;
}

export interface ClanWarOperationView {
  id: string;
  status: ClanWarOperationRow['status'];
  closeReason: ClanWarCloseReason | null;
  leaderPlayerId: string;
  /** Identity and coordinates only. The leader's own intel is never shared. */
  target: ClanWarTargetView;
  staging: { planetId: string; name: string; position: { x: number; y: number; z: number } };
  createdAt: string;
  expiresAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  completedAt: string | null;
  /** Present only for the leader viewing an assembling launch. */
  startShieldWouldDrop: { kind: 'NEWCOMER' | 'RECOVERY'; until: string } | null;
  contributions: ClanWarContributionView[];
  /** Room the pool is holding right now, so the composer and the list agree. */
  pool: {
    combatHulls: number;
    waves: number;
    participants: number;
    /**
     * The combined leg at FULL speed, for the staged pool — the figure the leader's pace rungs
     * divide. Null while nothing is staged or the operation is no longer gathering.
     */
    strikeMinutes: number | null;
  };
}


/**
 * EVERY WORLD A JOINT-WAR MUTATION WILL WRITE TO, TAKEN FIRST AND IN ID ORDER.
 *
 * THE ORDER IS THE WHOLE POINT. A wave standing down hands its ships back to a
 * world's home stack, and a launch from that same world reads that stack under
 * the world's row lock — so a stand-down that did not hold the lock could have
 * its ships overwritten by a launch that read the stack a moment earlier, and the
 * fleet would simply cease to exist.
 *
 * Taken BEFORE the clan row, because `sendClanWarContribution` reaches the clan
 * through `loadLocked` and therefore holds a world first. A path that took the
 * clan first and a world second would deadlock against it the first time a leader
 * committed a wave while somebody cancelled the operation.
 *
 * Sorted, so two mutations touching the same pair of worlds queue rather than
 * cross. Re-taking a row this transaction already holds costs nothing, which is
 * why `landContribution` asks again at the point of use rather than trusting it.
 */
async function lockWarWorlds(tx: Tx, planetIds: readonly (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(planetIds.filter((id): id is string => typeof id === 'string'))].sort();
  for (const id of unique) {
    await tx.select({ id: planets.id }).from(planets).where(eq(planets.id, id)).for('update');
  }
}

/* ── loading and projection ─────────────────────────────────────── */

/** The clan's one unfinished operation, if it has one. Read-only. */
export async function openOperation(
  db: Queryable,
  clanId: string,
): Promise<ClanWarOperationRow | null> {
  const [row] = await db
    .select()
    .from(clanWarOperations)
    .where(and(eq(clanWarOperations.clanId, clanId), ne(clanWarOperations.status, 'COMPLETED')))
    .limit(1);
  return row ?? null;
}

/**
 * World rows whose escrow unit stacks a joint-war arrival may read or delete.
 * The worker adds these to the ordinary mission endpoints before taking any
 * operation, contribution, or player lock.
 */
export async function clanWarEscrowPlanetIds(
  db: Queryable,
  missionId: string,
): Promise<string[]> {
  const [leg] = await db
    .select({
      operationId: clanWarMissions.operationId,
      contributionId: clanWarMissions.contributionId,
    })
    .from(clanWarMissions)
    .where(eq(clanWarMissions.missionId, missionId))
    .limit(1);
  if (!leg) return [];
  const rows = await db
    .select({ planetId: clanWarContributions.originPlanetId })
    .from(clanWarContributions)
    .where(leg.contributionId === null
      ? eq(clanWarContributions.operationId, leg.operationId)
      : eq(clanWarContributions.id, leg.contributionId));
  return [...new Set(rows.map((row) => row.planetId))].sort();
}

/** The same row, held for the whole transaction. Every mutation takes this. */
async function lockOperation(
  tx: Tx,
  clanId: string,
): Promise<ClanWarOperationRow | null> {
  const [row] = await tx
    .select()
    .from(clanWarOperations)
    .where(and(eq(clanWarOperations.clanId, clanId), ne(clanWarOperations.status, 'COMPLETED')))
    .for('update');
  return row ?? null;
}

export async function projectOperation(
  db: Queryable,
  operation: ClanWarOperationRow,
  viewerPlayerId?: string,
  now: Date = new Date(),
): Promise<ClanWarOperationView> {
  const [target, staging, waves] = await Promise.all([
    db
      .select({ username: accounts.displayName })
      .from(players)
      .innerJoin(accounts, eq(accounts.id, players.accountId))
      .where(eq(players.id, operation.targetPlayerId))
      .limit(1),
    db
      .select({ name: planets.name, x: planets.x, y: planets.y, z: planets.z })
      .from(planets)
      .where(eq(planets.id, operation.stagingPlanetId))
      .limit(1),
    /*
      ONE QUERY FOR THE WHOLE POOL, joined rather than looked up per wave. Five
      members with three waves each is fifteen rows, and fifteen round trips for
      a name and a world is the N+1 this screen would grow into first.
    */
    db
      .select({
        id: clanWarContributions.id,
        playerId: clanWarContributions.playerId,
        username: accounts.displayName,
        originPlanetId: clanWarContributions.originPlanetId,
        originPlanetName: planets.name,
        sourceKind: clanWarContributions.sourceKind,
        status: clanWarContributions.status,
        fleet: clanWarContributions.fleet,
        tech: clanWarContributions.tech,
        reservedBulk: clanWarContributions.reservedBulk,
        fuelPaid: clanWarContributions.fuelPaid,
        sentAt: clanWarContributions.sentAt,
        arriveAt: missions.arriveAt,
      })
      .from(clanWarContributions)
      .innerJoin(players, eq(players.id, clanWarContributions.playerId))
      .innerJoin(accounts, eq(accounts.id, players.accountId))
      .innerJoin(planets, eq(planets.id, clanWarContributions.originPlanetId))
      .leftJoin(clanWarMissions, and(
        eq(clanWarMissions.contributionId, clanWarContributions.id),
        eq(clanWarMissions.leg, 'SUPPORT_OUT'),
      ))
      .leftJoin(missions, eq(missions.id, clanWarMissions.missionId))
      .where(eq(clanWarContributions.operationId, operation.id))
      .orderBy(clanWarContributions.sentAt, clanWarContributions.id),
  ]);

  const contributions: ClanWarContributionView[] = waves.map((wave) => ({
    id: wave.id,
    playerId: wave.playerId,
    username: wave.username,
    originPlanetId: wave.originPlanetId,
    originPlanetName: wave.originPlanetName,
    sourceKind: wave.sourceKind,
    status: wave.status,
    fleet: wave.fleet,
    bulk: wave.reservedBulk,
    fuelPaid: wave.fuelPaid,
    sentAt: wave.sentAt.toISOString(),
    arrivesAt: wave.status === 'OUTBOUND' ? wave.arriveAt?.toISOString() ?? null : null,
    mine: wave.playerId === viewerPlayerId,
    canRecall: wave.playerId === viewerPlayerId
      && operation.status === 'ASSEMBLING'
      && (wave.status === 'OUTBOUND' || wave.status === 'STAGED'),
  }));
  const pooled = waves.filter(
    (wave) => wave.status === 'OUTBOUND' || wave.status === 'STAGED',
  );
  /*
    WHEN THE STRIKE WOULD LAND, SO THE LEADER CAN CHOOSE IT. Review 2026-09-22, #2.
    Off the same speed and the same live positions `startClanWar` flies by, and only for the waves
    it would actually launch — a wave still outbound blocks the launch anyway.
  */
  const staged = waves.filter((wave) => wave.status === 'STAGED');
  let strikeMinutes: number | null = null;
  if (operation.status === 'ASSEMBLING' && staged.length > 0 && staging[0]) {
    const [targetAt] = await db
      .select({ x: planets.x, y: planets.y, z: planets.z })
      .from(planets)
      .where(eq(planets.id, operation.targetPlanetId))
      .limit(1);
    const speed = await strikeSpeed(db, operation.stagingPlanetId, staged);
    const minutes = targetAt ? travelExact(distance(staging[0], targetAt), speed) : Infinity;
    strikeMinutes = Number.isFinite(minutes) ? minutes : null;
  }
  const pool = {
    combatHulls: pooled.reduce(
      (sum, wave) => sum + COMBAT_HULLS.reduce((n, hull) => n + (wave.fleet[hull] ?? 0), 0),
      0,
    ),
    waves: pooled.length,
    participants: new Set(pooled.map((wave) => wave.playerId)).size,
    strikeMinutes,
  };
  let startShieldWouldDrop: ClanWarOperationView['startShieldWouldDrop'] = null;
  if (operation.status === 'ASSEMBLING' && viewerPlayerId === operation.leaderPlayerId) {
    const [leader] = await db
      .select({ newcomer: players.newcomerShieldUntil, recovery: players.recoveryShieldUntil })
      .from(players)
      .where(eq(players.id, operation.leaderPlayerId))
      .limit(1);
    const protection = leader
      ? protectionFrom(leader.newcomer, leader.recovery, now)
      : null;
    if (protection) {
      startShieldWouldDrop = {
        kind: protection.kind,
        until: new Date(protection.until).toISOString(),
      };
    }
  }
  return {
    id: operation.id,
    status: operation.status,
    closeReason: operation.closeReason,
    leaderPlayerId: operation.leaderPlayerId,
    target: {
      playerId: operation.targetPlayerId,
      username: target[0]?.username ?? 'Former commander',
      planetId: operation.targetPlanetId,
      planetName: operation.targetPlanetName,
      position: { x: operation.targetX, y: operation.targetY, z: operation.targetZ },
    },
    staging: {
      planetId: operation.stagingPlanetId,
      name: staging[0]?.name ?? 'Staging world',
      position: {
        x: staging[0]?.x ?? 0,
        y: staging[0]?.y ?? 0,
        z: staging[0]?.z ?? 0,
      },
    },
    createdAt: operation.createdAt.toISOString(),
    expiresAt: operation.expiresAt.toISOString(),
    startedAt: operation.startedAt?.toISOString() ?? null,
    resolvedAt: operation.resolvedAt?.toISOString() ?? null,
    completedAt: operation.completedAt?.toISOString() ?? null,
    startShieldWouldDrop,
    contributions,
    pool,
  };
}

/**
 * THE CLAN'S WHOLE WAR SCREEN, IN ONE READ.
 *
 * The purse, the rung, the shared hangar and the operation are looked at together
 * and decided on together, so they are fetched together: two round trips would
 * let a client draw a level that does not match the hangar beside it.
 *
 * `serverNow` is here because every countdown on that screen runs against the
 * SERVER'S clock (D51). A client that ran an expiry timer off its own would show
 * a target as live for the seconds its phone is ahead, and offer an action the
 * server has already refused.
 *
 * AN EXPIRED OPERATION IS FINISHED BEFORE IT IS DRAWN. The worker's timer is the
 * timely path, but a worker can be behind, and a player must never be shown — or
 * allowed to act on — a target whose day ran out forty seconds ago.
 */
export async function readClanWar(
  db: Db,
  actor: ClanActor,
  now: Date,
): Promise<ClanWarEconomyView & {
  serverNow: string;
  operation: ClanWarOperationView | null;
}> {
  const clan = await requireMemberClan(db, actor);
  const available = await jointWarAvailable(db, actor.seasonId);
  let operation = available ? await openOperation(db, clan.id) : null;
  if (operation !== null && operation.status === 'ASSEMBLING') {
    await db.transaction(async (tx) => {
      await lockSeason(tx, actor.seasonId);
      await lockWarWorlds(tx, [operation!.stagingPlanetId, operation!.targetPlanetId]);
      await lockClanPlayers(tx, [operation!.targetPlayerId]);
      const [locked] = await tx
        .select()
        .from(clanWarOperations)
        .where(eq(clanWarOperations.id, operation!.id))
        .for('update');
      if (locked) {
        const fresh = await finalizeIfExpired(tx, locked, now);
        await finalizeIfTargetChanged(tx, fresh, now);
      }
    });
    operation = await openOperation(db, clan.id);
  }
  return {
    ...await clanTreasuryProjection(db, clan, available),
    serverNow: now.toISOString(),
    operation: operation === null
      ? null
      : await projectOperation(db, operation, actor.playerId, now),
  };
}

/* ── closing ────────────────────────────────────────────────────── */

/**
 * THE ONE WAY AN OPERATION STOPS BEING OPEN. Leader cancel, expiry, target drift
 * and a failed launch all come through here.
 *
 * FOUR CALLERS, ONE FUNCTION, deliberately: each of them has to return every live
 * wave to its owner, and four copies of "and also send everybody home" is how one
 * of them ends up not doing it. The return planning itself lands in the phase that
 * can create waves; what is settled here is the state machine.
 *
 * AN OPERATION WITH NOTHING IN IT COMPLETES IMMEDIATELY. A clan that marked a
 * target and never sent a ship must not be locked out of its next target while a
 * `RETURNING` row with no returns waits for a worker that has nothing to do.
 */
export async function closeOperation(
  tx: Tx,
  input: { operation: ClanWarOperationRow; reason: ClanWarCloseReason; now: Date },
): Promise<ClanWarOperationRow> {
  const { operation, reason, now } = input;
  if (operation.status === 'COMPLETED') return operation;

  const [returning] = await tx
    .update(clanWarOperations)
    .set({
      status: 'RETURNING',
      closeReason: reason,
      resolvedAt: reason === 'BATTLE' ? now : operation.resolvedAt,
    })
    .where(eq(clanWarOperations.id, operation.id))
    .returning();
  let row = returning ?? operation;

  /*
    EVERY WAVE STILL IN THE POOL GOES HOME, through the one planner. A wave still
    flying to the staging world is marked `RECALL_ORDERED` and turns round when it
    lands; a staged one leaves now; the leader's own capital wave simply stands
    down. Nothing is refunded and nothing extra is charged.
  */
  const live = await tx
    .select()
    .from(clanWarContributions)
    .where(and(
      eq(clanWarContributions.operationId, operation.id),
      inArray(clanWarContributions.status, [...LIVE_CONTRIBUTION_STATUSES]),
    ))
    .for('update');
  for (const contribution of live) {
    await planContributionReturn(tx, {
      contribution,
      operation: row,
      fromPlanetId: operation.stagingPlanetId,
      fleet: contribution.fleet,
      now,
    });
  }

  const stillOut = await tx
    .select({ id: clanWarContributions.id })
    .from(clanWarContributions)
    .where(and(
      eq(clanWarContributions.operationId, operation.id),
      inArray(clanWarContributions.status, [...LIVE_CONTRIBUTION_STATUSES]),
    ))
    .limit(1);
  if (stillOut.length === 0) {
    const [completed] = await tx
      .update(clanWarOperations)
      .set({ status: 'COMPLETED', completedAt: now })
      .where(eq(clanWarOperations.id, operation.id))
      .returning();
    row = completed ?? row;
  }
  await publishWar(tx, operation.clanId);
  return row;
}

/**
 * FINISH AN OPERATION WHOSE CLOCK HAS RUN OUT, WHEREVER WE NOTICED.
 *
 * The worker's `clan_war_expiry` event is the timely path; this is also called
 * inline by every read and every mutation, because a worker can be behind and a
 * player must never be shown — or allowed to act on — a target that expired
 * forty seconds ago. Idempotent by the status check: whichever notices first
 * wins, and the other sees a row that is no longer `ASSEMBLING`.
 */
export async function finalizeIfExpired(
  tx: Tx,
  operation: ClanWarOperationRow,
  now: Date,
): Promise<ClanWarOperationRow> {
  if (operation.status !== 'ASSEMBLING' || now < operation.expiresAt) return operation;
  return closeOperation(tx, { operation, reason: 'EXPIRED', now });
}

/**
 * Persist target drift wherever an authoritative path notices it.
 *
 * Ownership hooks and membership hooks intentionally use SKIP LOCKED to avoid
 * deadlocking their host transaction. This locked fallback is therefore the
 * authority: after contention clears, the next read or mutation closes the pool
 * and sends every live wave home.
 */
async function finalizeIfTargetChanged(
  tx: Tx,
  operation: ClanWarOperationRow,
  now: Date,
): Promise<ClanWarOperationRow> {
  if (operation.status !== 'ASSEMBLING') return operation;
  const [target] = await tx
    .select({ controllerPlayerId: planets.controllerPlayerId })
    .from(planets)
    .where(eq(planets.id, operation.targetPlanetId))
    .limit(1);
  const targetMembership = await activeClanMembership(tx, operation.targetPlayerId);
  if (target?.controllerPlayerId === operation.targetPlayerId
    && targetMembership?.clanId !== operation.clanId) {
    return operation;
  }
  return closeOperation(tx, { operation, reason: 'TARGET_CHANGED', now });
}

/** Refuse any state-machine graph that has been split across season boundaries. */
async function assertClanWarSeason(
  tx: Tx,
  input: {
    operation: ClanWarOperationRow;
    actorSeasonId: string;
    clanSeasonId: string;
    worldSeasonIds: readonly string[];
  },
): Promise<void> {
  const playerRows = await tx
    .select({ id: players.id, seasonId: players.seasonId })
    .from(players)
    .where(inArray(players.id, [
      input.operation.leaderPlayerId,
      input.operation.targetPlayerId,
    ]));
  const playerSeasons = new Map(playerRows.map((row) => [row.id, row.seasonId]));
  const expected = input.operation.seasonId;
  if (input.actorSeasonId !== expected
    || input.clanSeasonId !== expected
    || input.worldSeasonIds.some((seasonId) => seasonId !== expected)
    || playerSeasons.get(input.operation.leaderPlayerId) !== expected
    || playerSeasons.get(input.operation.targetPlayerId) !== expected) {
    throw new GameError(
      'CROSS_SEASON',
      'Every joint-war participant and world must remain in one galaxy',
      409,
    );
  }
}

/* ── marking a target ───────────────────────────────────────────── */

/**
 * Lock the clan and prove the caller still leads it, in the one order every
 * joint-war path uses. The first membership read only locates the clan.
 */
async function lockLedClan(
  tx: Tx,
  actor: ClanActor,
  alsoLockPlayerIds: readonly string[] = [],
): Promise<typeof clans.$inferSelect & { level: number }> {
  await assertJointWarRuleset(tx, actor.seasonId);
  const hint = await activeClanMembership(tx, actor.playerId);
  if (hint?.role !== 'LEADER') {
    throw new GameError('CLAN_WAR_LEADER_ONLY', 'Only the clan leader can do that', 403);
  }
  const [clan] = await tx
    .select()
    .from(clans)
    .where(and(eq(clans.id, hint.clanId), isNull(clans.disbandedAt)))
    .for('update');
  if (!clan) throw new GameError('CLAN_NOT_FOUND', 'No such active clan', 404);
  // Player rows in one sorted batch, so two operations touching overlapping
  // commanders queue rather than deadlock.
  await lockClanPlayers(tx, [actor.playerId, ...alsoLockPlayerIds]);
  const membership = await activeClanMembership(tx, actor.playerId);
  if (membership?.clanId !== clan.id || membership.role !== 'LEADER') {
    throw new GameError('CLAN_WAR_LEADER_ONLY', 'Only the clan leader can do that', 403);
  }
  if (clan.level === null) {
    throw new GameError('CLAN_JOINT_WAR_UNAVAILABLE', 'This clan predates the joint war', 409);
  }
  return { ...clan, level: clan.level };
}

/** Has this commander actually found that world? Ownership, live sight or probe memory. */
async function assertTargetDiscovered(
  tx: Tx,
  leaderPlayerId: string,
  target: typeof planets.$inferSelect,
): Promise<void> {
  const owned = await tx
    .select({ id: planets.id })
    .from(planets)
    .where(eq(planets.controllerPlayerId, leaderPlayerId));
  const [sensors, remembered] = await Promise.all([
    sensorPosts(tx, owned.map((world) => world.id)),
    rememberedWorlds(tx, leaderPlayerId),
  ]);
  const known = locationIsKnown(
    target.id,
    { x: target.x, y: target.y, z: target.z },
    target.controllerPlayerId === leaderPlayerId,
    { sensors, remembered },
  );
  if (!known) {
    throw new GameError(
      'CLAN_WAR_TARGET_UNDISCOVERED',
      'Your clan has not found that world',
      403,
    );
  }
}

export async function markClanWarTarget(
  tx: Tx,
  input: { actor: ClanActor; targetPlanetId: string; clock: Clock },
): Promise<{ operation: ClanWarOperationView }> {
  const now = input.clock.now();
  const season = await lockSeason(tx, input.actor.seasonId);
  /*
    The world being marked, and the staging world of whatever operation is still
    open — finalising an expired one hands its leader-capital wave back, which
    writes that world's home stack.
  */
  const standing = await activeClanMembership(tx, input.actor.playerId);
  const previous = standing ? await openOperation(tx, standing.clanId) : null;
  await lockWarWorlds(tx, [input.targetPlanetId, previous?.stagingPlanetId]);

  /*
    THE TARGET WORLD IS HELD, NOT JUST READ.

    `transferPlanetControl` takes this same row before it changes hands, so
    marking and capturing serialise against each other: without the lock a mark
    could read the old controller a millisecond before a capture committed and
    write an operation aimed at a commander who is no longer there — and the
    drift hook could not save it, because the operation did not exist yet when
    the capture ran. Season → planet → clan is the order every joint-war path and
    every treasury path takes.
  */
  const [target] = await tx
    .select()
    .from(planets)
    .where(eq(planets.id, input.targetPlanetId))
    .for('update');
  if (!target) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);
  if (target.seasonId !== input.actor.seasonId) {
    throw new GameError('CROSS_SEASON', 'That world is in another galaxy', 409);
  }
  /*
    A CARETAKER WORLD IS NOT AN OPPONENT. The whole operation is priced against a
    commander — bash quota, Dominion, the report's fog — and a neutral, an asteroid
    or a pirate has none of those. The ordinary attack lane is where those go.
  */
  if (target.kind === 'NEUTRAL' || target.controllerPlayerId === null) {
    throw new GameError('CLAN_WAR_TARGET_INVALID', 'A joint war needs a commander', 403);
  }
  const targetPlayerId = target.controllerPlayerId;

  const clan = await lockLedClan(tx, input.actor, [targetPlayerId]);

  const existing = await lockOperation(tx, clan.id);
  if (existing) {
    /*
      An operation whose day ran out is finished HERE, so a leader whose last
      target expired with nothing in the air can mark the next one in the same
      breath. When it had waves out the close leaves it `RETURNING` and the
      refusal below rolls this transaction back — the finalise is then simply
      redone by the worker's timer or by the next read, both of which own their
      own transaction. Nothing is lost either way.
    */
    const settled = await finalizeIfExpired(tx, existing, now);
    if (settled.status !== 'COMPLETED') {
      throw new GameError(
        'CLAN_WAR_ALREADY_OPEN',
        settled.status === 'ASSEMBLING'
          ? 'Your clan already has a target'
          : 'Your clan is still finishing its last operation',
        409,
        { status: settled.status },
      );
    }
  }

  /*
    THE TARGET IS GOOD FOR TWENTY-FOUR HOURS, SO THE GALAXY HAS TO LAST THAT LONG.

    Refused rather than truncated: a member who pays three legs of fuel toward a
    rendezvous the season ends before is a member who lost a fleet to the calendar.
    The whole window has to fit, which is what `warTargetMinutes` is measured against.
  */
  const expiresAt = addMinutes(now, CLAN.warTargetMinutes);
  if (expiresAt > season.endsAt) {
    throw new GameError(
      'CLAN_WAR_SEASON_TOO_SHORT',
      'This galaxy ends before a joint war could finish',
      409,
      { endsAt: season.endsAt.toISOString() },
    );
  }

  await assertTargetDiscovered(tx, input.actor.playerId, target);
  await assertClanHostilityAllowed(tx, input.actor.playerId, targetPlayerId, now);
  /*
    THE TARGET'S SHIELDS, AND NOT THE LEADER'S. Marking spends nothing, so it
    cannot spend a shield: the leader's own window drops when they send a wave
    (`clanWar` contributions), with the acknowledgement the launch lane already uses.
  */
  await assertTargetReachable(tx, targetPlayerId, now);
  assertWorldAttackable(target, now);

  /*
    THE LEADER'S OWN BAND, ASKED HERE AND ASKED AGAIN OF EVERY PARTICIPANT.

    A clan cannot use its leader as a legal fig leaf for members who are outside
    the band, and it cannot mark a target its own leader could not raid. Both
    halves matter; this is the first.
  */
  await assertTierBand(tx, input.actor.playerId, targetPlayerId);

  /*
    THE STAGING WORLD IS SNAPSHOTTED, NOT LOOKED UP LATER. Owner decision.

    Members commit fuel for a flight to THIS world. A leader who takes a nearer
    capital mid-operation must not move the rendezvous under a wave that is
    already paid for and in the air.
  */
  const [staging] = await tx
    .select()
    .from(planets)
    .where(and(
      eq(planets.controllerPlayerId, input.actor.playerId),
      eq(planets.kind, 'CAPITAL'),
    ))
    .limit(1);
  if (!staging) throw new GameError('NO_CAPITAL', 'You have no capital to stage at', 409);

  const [operation] = await tx.insert(clanWarOperations).values({
    seasonId: input.actor.seasonId,
    clanId: clan.id,
    clanName: clan.name,
    clanTag: clan.tag,
    leaderPlayerId: input.actor.playerId,
    stagingPlanetId: staging.id,
    targetPlanetId: target.id,
    targetPlayerId,
    targetPlanetName: target.name,
    targetX: target.x,
    targetY: target.y,
    targetZ: target.z,
    createdAt: now,
    expiresAt,
  }).returning();
  if (!operation) throw new Error('clan war operation insert returned no row');

  /*
    THE EXPIRY IS SCHEDULED IN THE SAME TRANSACTION THE TARGET IS MARKED IN, with a
    producer-owned dedupe key: a retried mark cannot leave two timers on one
    operation, and an operation can never exist without the timer that ends it.
  */
  await schedule(tx, {
    seasonId: input.actor.seasonId,
    kind: 'clan_war_expiry',
    refId: operation.id,
    dedupeKey: `clan-war-expiry:${operation.id}`,
    resolveAt: expiresAt,
  });
  /*
    AND THE TARGET IS TOLD NOTHING. Owner decision: a mark is intel the clan paid
    for, and warning the defender a day early would turn every operation into a
    day of free preparation for the person it is aimed at. The defender learns of
    it exactly when an ordinary raid would tell them — the radar warning on the
    combined strike's own leg.
  */
  await publishWar(tx, clan.id);
  return { operation: await projectOperation(tx, operation) };
}


/* ── contributions ──────────────────────────────────────────────── */

/**
 * ONE WAVE, QUOTED BEFORE IT IS COMMITTED AND CHARGED WHEN IT IS.
 *
 * A contribution is the boundary of everything that happens exactly once: the
 * fuel for all three legs, the owner's research snapshot, the flight bay, the
 * Klan Hangarı reservation and the idempotency key. A commander sending more
 * ships creates ANOTHER wave rather than growing this one, which is what keeps
 * "paid once" true under a retry.
 */
export interface ClanWarRefusal {
  code: string;
  message: string;
}

export interface ClanWarFuelLegQuote {
  leg: JointWarFuelLeg;
  distance: number;
  fuel: number;
}

export interface ClanWarContributionQuote {
  ok: boolean;
  /** Every reason this wave would be refused, not just the first one. */
  refusals: ClanWarRefusal[];
  sourceKind: ClanWarContributionSource;
  /** Room this wave takes out of the Klan Hangarı, in the same units a Hangar uses. */
  bulk: number;
  fuel: { legs: ClanWarFuelLegQuote[]; total: number; available: number };
  travel: {
    stagingMinutes: number;
    /** This wave's own pace over the combat leg. The real strike flies at its slowest ship. */
    combinedMinutes: number;
    returnMinutes: number;
    stagingEta: string | null;
    earliestHome: string | null;
  };
  bays: { used: number; total: number };
  /**
   * PERSONAL ROOM DOES NOT MOVE, and the quote says so out loud.
   *
   * Contributed ships keep occupying their OWNER'S Hangar for the whole operation
   * (owner decision) — sending them abroad is not a way to make room at home. The
   * figure is published before and after precisely so the screen can show that
   * they are the same number rather than leaving a player to discover it.
   */
  personalHangar: { used: number; total: number; afterSend: number };
  clanHangar: ClanHangarUsage & { afterSend: number };
  /** The last instant the leader could still launch and have everyone home in time. */
  latestStartAt: string | null;
  canFinishBeforeSeasonEnd: boolean;
  /** Non-null when committing this wave would give up the sender's own shield. */
  shieldWouldDrop: { kind: 'NEWCOMER' | 'RECOVERY'; until: string } | null;
}

/** Structural fleet validation, shared by the quote and the dispatch. */
function assertMobileAttackFleet(fleet: Fleet): void {
  for (const [hull, n] of Object.entries(fleet) as [HullId, number][]) {
    if (!Number.isInteger(n) || n < 0) {
      throw new GameError('BAD_FLEET', `Bad ship count for ${hull}`, 400, { hull });
    }
    if (n === 0) continue;
    if (HULLS[hull].ground) {
      throw new GameError('GROUND_UNIT', `${HULLS[hull].name}s cannot travel`, 400, { hull });
    }
    if (hull === 'PROSPECTOR') {
      throw new GameError('NOT_A_WARSHIP', 'Prospectors mine; they do not raid', 400);
    }
  }
  if (fleetCount(fleet) === 0) throw new GameError('EMPTY_FLEET', 'Send at least one ship', 400);
  /*
    A SUPPORT-ONLY WAVE IS ACCEPTED HERE, AND REFUSED AT START IF IT IS ALL THERE IS.

    Owner decision: a member whose whole contribution is transports is contributing
    — the hold is what carries the haul home. What the pool may not do is LAUNCH
    with no gun in it, and that is a question about the pool rather than about any
    one wave, so it is asked once, at the start, where the answer is knowable.
  */
  if (fleetSpeed(fleet, UNAIDED.tech) <= 0) {
    throw new GameError('IMMOBILE_FLEET', 'That fleet cannot travel', 400);
  }
}

interface ContributionContext {
  operation: ClanWarOperationRow;
  clan: typeof clans.$inferSelect & { level: number };
  sourceKind: ClanWarContributionSource;
  origin: LockedPlanet;
  staging: typeof planets.$inferSelect;
  target: typeof planets.$inferSelect;
  tech: Awaited<ReturnType<typeof techOf>>;
  legs: ClanWarFuelLegQuote[];
  fuel: number;
  bulk: number;
  stagingMinutes: number;
  combinedMinutes: number;
  returnMinutes: number;
  stagingAt: Date;
  latestStartAt: Date | null;
  refusals: ClanWarRefusal[];
  shieldWouldDrop: { kind: 'NEWCOMER' | 'RECOVERY'; until: string } | null;
  bays: { used: number; total: number };
  personalHangar: { used: number; total: number };
  clanHangar: ClanHangarUsage;
  seasonEndsAt: Date;
}

/**
 * EVERYTHING THE QUOTE AND THE DISPATCH BOTH HAVE TO KNOW, computed once.
 *
 * The quote lists every refusal so the screen can show all of them at once; the
 * dispatch raises the first one. Two code paths deciding eligibility separately is
 * exactly how a screen comes to offer a launch the server then refuses, so there
 * is one gatherer and two presentations of it.
 */
async function gatherContribution(
  tx: Tx,
  input: {
    actor: ClanActor;
    originPlanetId: string;
    fleet: Fleet;
    clock: Clock;
    acknowledgeShieldLoss: boolean;
  },
): Promise<ContributionContext> {
  const now = input.clock.now();
  const refusals: ClanWarRefusal[] = [];
  const refuse = (code: string, message: string): void => { refusals.push({ code, message }); };

  const season = await lockSeason(tx, input.actor.seasonId);
  await assertJointWarRuleset(tx, input.actor.seasonId);
  assertMobileAttackFleet(input.fleet);

  // Origin and staging together, in id order, before anything takes the clan row.
  const standing = await activeClanMembership(tx, input.actor.playerId);
  const pending = standing ? await openOperation(tx, standing.clanId) : null;
  await lockWarWorlds(tx, [
    input.originPlanetId,
    pending?.stagingPlanetId,
    pending?.targetPlanetId,
  ]);

  const origin = await loadLocked(tx, input.originPlanetId, input.clock, {
    expectedPlayerId: input.actor.playerId,
  });
  assertWorldOperational(origin);

  const membership = await activeClanMembership(tx, input.actor.playerId);
  if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 403);
  const [clanRow] = await tx
    .select()
    .from(clans)
    .where(and(eq(clans.id, membership.clanId), isNull(clans.disbandedAt)))
    .for('update');
  if (clanRow?.level == null) {
    throw new GameError('CLAN_JOINT_WAR_UNAVAILABLE', 'This clan predates the joint war', 409);
  }

  const opened = await lockOperation(tx, clanRow.id);
  if (!opened) throw new GameError('CLAN_WAR_NOT_FOUND', 'Your clan has no target', 404);
  let operation = await finalizeIfExpired(tx, opened, now);
  if (operation.status !== 'ASSEMBLING') {
    throw new GameError(
      operation.closeReason === 'EXPIRED' ? 'CLAN_WAR_EXPIRED' : 'CLAN_WAR_NOT_ASSEMBLING',
      'That operation is no longer taking fleets',
      409,
      { status: operation.status },
    );
  }

  await lockClanPlayers(tx, [input.actor.playerId, operation.targetPlayerId]);
  const confirmed = await activeClanMembership(tx, input.actor.playerId);
  if (confirmed?.clanId !== clanRow.id) {
    throw new GameError('NOT_IN_CLAN', 'You no longer belong to that clan', 403);
  }
  /*
    TWELVE HOURS BEFORE YOUR SHIPS COUNT. Owner decision, and the same adaptation
    window recruitment already uses: a clan cannot borrow a stranger's fleet for
    an afternoon, and a member who has just arrived cannot be pressured into
    committing one. An immature member still SEES the operation and still pays
    into the purse — what they cannot do is put hulls in it.
  */
  if (confirmed.matureAt > now) {
    refuse('CLAN_WAR_MEMBER_IMMATURE', 'Your membership is still settling in');
  }

  const [staging] = await tx.select().from(planets)
    .where(eq(planets.id, operation.stagingPlanetId)).limit(1);
  const [target] = await tx.select().from(planets)
    .where(eq(planets.id, operation.targetPlanetId)).limit(1);
  if (!staging || !target) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);
  await assertClanWarSeason(tx, {
    operation,
    actorSeasonId: input.actor.seasonId,
    clanSeasonId: clanRow.seasonId,
    worldSeasonIds: [origin.seasonId, staging.seasonId, target.seasonId],
  });
  operation = await finalizeIfTargetChanged(tx, operation, now);
  if (operation.status !== 'ASSEMBLING') {
    refuse('CLAN_WAR_TARGET_CHANGED', 'That target is no longer hostile');
  }
  try {
    assertWorldAttackable(target, now);
  } catch (error) {
    if (!(error instanceof GameError)) throw error;
    refuse(error.code, error.message);
  }

  /*
    THE LEADER'S OWN CAPITAL IS THE ONE FLEET THAT DOES NOT FLY.

    It is already standing on the staging world, so there is no journey to make,
    no bay to hold and no staging leg to pay for. Every other wave — including the
    leader's own colonies — flies like anybody else's.
  */
  const sourceKind: ClanWarContributionSource =
    origin.planetId === operation.stagingPlanetId
      && input.actor.playerId === operation.leaderPlayerId
      ? 'LEADER_CAPITAL'
      : 'PHYSICAL';

  for (const [hull, n] of Object.entries(input.fleet) as [HullId, number][]) {
    if ((origin.homeFleet[hull] ?? 0) < n) {
      throw new GameError('NOT_ENOUGH_SHIPS', `Not enough ${hull} at home`, 400, { hull });
    }
  }

  const tech = await techOf(tx, input.actor.playerId);
  const originToStaging = distance(origin, staging);
  const stagingToTarget = distance(staging, target);
  const targetToOrigin = distance(target, origin);

  const legs = sourceKind === 'LEADER_CAPITAL'
    ? jointWarFuelLegs(input.fleet, [
      { leg: JOINT_WAR_STAGING_LEGS[0]!, distance: stagingToTarget },
      { leg: JOINT_WAR_STAGING_LEGS[1]!, distance: stagingToTarget },
    ])
    : jointWarFuelLegs(input.fleet, [
      { leg: JOINT_WAR_PHYSICAL_LEGS[0]!, distance: originToStaging },
      { leg: JOINT_WAR_PHYSICAL_LEGS[1]!, distance: stagingToTarget },
      { leg: JOINT_WAR_PHYSICAL_LEGS[2]!, distance: targetToOrigin },
    ]);

  const originPace = { boost: fleetSpeedMult(origin.orbit), tech };
  const stagingPace = { boost: fleetSpeedMult(await orbitOfWorld(tx, staging.id)), tech };
  const stagingMinutes = sourceKind === 'LEADER_CAPITAL'
    ? 0
    : fleetTravelExact(originToStaging, input.fleet, originPace);
  const combinedMinutes = fleetTravelExact(stagingToTarget, input.fleet, stagingPace);
  const returnMinutes = fleetTravelExact(
    sourceKind === 'LEADER_CAPITAL' ? stagingToTarget : targetToOrigin,
    input.fleet,
    originPace,
  );
  const stagingAt = addMinutes(now, stagingMinutes);

  /*
    THREE DEADLINES, AND A WAVE HAS TO CLEAR ALL OF THEM BEFORE IT IS ACCEPTED.

    1. It must REACH the staging world before the target's day runs out. A wave
       that lands after the operation cancels has paid three legs of fuel to fly
       nowhere.
    2. In the WORST cancellation — the target expiring at the last second — it must
       still get home before the galaxy ends.
    3. If the leader launched the instant it landed, the whole battle and the flight
       home must also fit inside the galaxy.

    All three are refusals rather than warnings, because each of them is a fleet
    the commander would lose to the calendar rather than to an opponent.
  */
  const engagementMinutes = ENGAGEMENT_MS / 60_000;
  if (sourceKind === 'PHYSICAL' && stagingAt >= operation.expiresAt) {
    refuse('CLAN_WAR_EXPIRED', 'This wave cannot reach the staging world in time');
  }
  const cancelHomeAt = addMinutes(operation.expiresAt, stagingMinutes);
  const battleHomeAt = addMinutes(stagingAt, combinedMinutes + engagementMinutes + returnMinutes);
  const canFinish = cancelHomeAt <= season.endsAt && battleHomeAt <= season.endsAt;
  if (!canFinish) {
    refuse('CLAN_WAR_SEASON_TOO_SHORT', 'This galaxy ends before that wave could get home');
  }
  const latestStart = new Date(Math.min(
    operation.expiresAt.getTime(),
    season.endsAt.getTime()
      - (combinedMinutes + engagementMinutes + returnMinutes) * 60_000,
  ));

  const bulk = hangarLoad(input.fleet);
  const clanHangar = await clanHangarUsage(tx, clanRow.id, clanRow.level);
  if (clanHangar.used + clanHangar.reserved + bulk > clanHangar.total) {
    refuse('CLAN_HANGAR_FULL', 'The clan hangar has no room for that wave');
  }

  /*
    A PHYSICAL WAVE IS A DEPARTURE, so it answers to everything a departure does:
    a bay, and a yard that is not in revolt. `TERSANEDE İSYAN` grounds a world, and
    a lane that read the bay count without asking the fault would be the one hole
    in the single chokepoint `assertDeparturesAllowed` exists to be.

    A LEADER-CAPITAL WAVE IS NOT A DEPARTURE. Those ships never leave the staging
    world to join the pool; what departs is the combined strike, and the strike is
    checked against the staging world's own yard when the leader launches it.
  */
  const bays = sourceKind === 'LEADER_CAPITAL'
    ? { used: 0, total: 0 }
    : await baysOf(tx, origin.planetId, origin.buildings.CORE);
  if (sourceKind === 'PHYSICAL') {
    try {
      assertDeparturesAllowed(origin.planetId, origin.faults);
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      refuse(error.code, error.message);
    }
    if (bays.used >= bays.total) {
      refuse('NO_FREE_BAY', `All ${String(bays.total)} flight bays are in use`);
    }
  }

  const tank = fuelAvailable(origin.deuterium);
  if (tank < legs.total) refuse('INSUFFICIENT_FUEL', 'Not enough deuterium to fly that');

  /*
    EVERY PARTICIPANT IS CHECKED AGAINST THE TARGET ON THEIR OWN ACCOUNT.

    The leader's band was checked when the target was marked; that does not make
    the target legal for a member three tiers below them. Quota, ceasefire and
    protection are pre-checked here and re-checked — and only then consumed — at
    the start, because a wave sitting in escrow for twenty hours can be overtaken
    by any of the three.
  */
  const peaks = await peakCoreLevels(tx, [input.actor.playerId, operation.targetPlayerId]);
  const [recent] = await tx
    .select({ value: count() })
    .from(attackCommitments)
    .where(and(
      eq(attackCommitments.attackerPlayerId, input.actor.playerId),
      eq(attackCommitments.targetPlayerId, operation.targetPlayerId),
      gt(attackCommitments.launchedAt, addMinutes(now, -ABUSE.bashWindowMinutes)),
    ));
  const gate = canAttack(
    { playerId: input.actor.playerId, peakCoreLevel: peaks.get(input.actor.playerId) ?? 1 },
    { playerId: operation.targetPlayerId, peakCoreLevel: peaks.get(operation.targetPlayerId) ?? 1 },
    recent?.value ?? 0,
  );
  if (!gate.ok) {
    refuse(gate.reason ?? 'CLAN_WAR_PARTICIPANT_INELIGIBLE', 'You cannot fight that commander');
  }
  try {
    await assertClanHostilityAllowed(tx, input.actor.playerId, operation.targetPlayerId, now);
    await assertTargetReachable(tx, operation.targetPlayerId, now);
  } catch (error) {
    if (!(error instanceof GameError)) throw error;
    refuse(error.code, error.message);
  }

  const [me] = await tx
    .select({
      newcomer: players.newcomerShieldUntil,
      recovery: players.recoveryShieldUntil,
    })
    .from(players)
    .where(eq(players.id, input.actor.playerId));
  const mine = me ? protectionFrom(me.newcomer, me.recovery, now) : null;
  const shieldWouldDrop = mine
    ? { kind: mine.kind, until: new Date(mine.until).toISOString() }
    : null;
  if (shieldWouldDrop && !input.acknowledgeShieldLoss) {
    refuse('SHIELD_WOULD_DROP', 'Sending this wave gives up your own shield');
  }

  const owned = await totalUnitsOf(tx, origin.planetId);
  return {
    operation,
    clan: { ...clanRow, level: clanRow.level },
    sourceKind,
    origin,
    staging,
    target,
    tech,
    legs: legs.legs,
    fuel: legs.total,
    bulk,
    stagingMinutes,
    combinedMinutes,
    returnMinutes,
    stagingAt,
    latestStartAt: latestStart > now ? latestStart : null,
    refusals,
    shieldWouldDrop,
    bays,
    personalHangar: {
      used: hangarLoad(owned),
      total: hangarCapacity(origin.buildings.HANGAR),
    },
    clanHangar,
    seasonEndsAt: season.endsAt,
  };
}

/**
 * WHAT THIS WAVE WOULD COST, BEFORE ANYTHING IS COMMITTED.
 *
 * It decides nothing. Every figure here is recomputed inside the dispatch, and
 * every refusal is raised again there under the locks — a quote read a second ago
 * can be stale by the time the button is pressed, and a surface that treated this
 * as authority would offer launches the server then refuses.
 *
 * WHY IT RUNS IN A TRANSACTION AT ALL: so the fuel, the bays, the clan hangar and
 * the operation's own clock are one consistent picture. A quote assembled from
 * four different instants can contradict itself on screen.
 */
export async function quoteClanWarContribution(
  db: Db,
  input: {
    actor: ClanActor;
    originPlanetId: string;
    fleet: Fleet;
    clock: Clock;
    acknowledgeShieldLoss?: boolean;
  },
): Promise<ClanWarContributionQuote> {
  return db.transaction(async (tx) => {
    const context = await gatherContribution(tx, {
      ...input,
      acknowledgeShieldLoss: input.acknowledgeShieldLoss ?? false,
    });
    const engagementMinutes = ENGAGEMENT_MS / 60_000;
    const earliestHome = addMinutes(
      context.stagingAt,
      context.combinedMinutes + engagementMinutes + context.returnMinutes,
    );
    return {
      ok: context.refusals.length === 0,
      refusals: context.refusals,
      sourceKind: context.sourceKind,
      bulk: context.bulk,
      fuel: {
        legs: context.legs,
        total: context.fuel,
        available: Math.floor(fuelAvailable(context.origin.deuterium)),
      },
      travel: {
        stagingMinutes: context.stagingMinutes,
        combinedMinutes: context.combinedMinutes,
        returnMinutes: context.returnMinutes,
        stagingEta: context.sourceKind === 'LEADER_CAPITAL'
          ? null
          : context.stagingAt.toISOString(),
        earliestHome: earliestHome.toISOString(),
      },
      bays: context.bays,
      personalHangar: {
        ...context.personalHangar,
        // Contributed ships never leave their owner's books. Same number, said twice.
        afterSend: context.personalHangar.used,
      },
      clanHangar: {
        ...context.clanHangar,
        afterSend: context.clanHangar.used + context.clanHangar.reserved + context.bulk,
      },
      latestStartAt: context.latestStartAt?.toISOString() ?? null,
      canFinishBeforeSeasonEnd: !context.refusals.some(
        (refusal) => refusal.code === 'CLAN_WAR_SEASON_TOO_SHORT',
      ),
      shieldWouldDrop: context.shieldWouldDrop,
    };
  });
}

export interface ClanWarContributionResult {
  contributionId: string;
  sourceKind: ClanWarContributionSource;
  status: ClanWarContributionStatus;
  fuelPaid: number;
  reservedBulk: number;
  stagedAt: string | null;
  planet: PlanetView;
  pending: PendingThread[];
  war: ClanWarOperationView;
  traffic: { contacts: Contact[] };
}

/**
 * COMMIT ONE WAVE. Everything it will ever be charged happens here, once.
 *
 * FUEL FOR EVERY LEG IS TAKEN NOW AND NEVER GIVEN BACK. Owner decision, and the
 * same rule the ordinary raid has had since T6: a fleet in the air has no access
 * to a store, so a one-way budget is not a cheaper operation, it is a stranded
 * fleet. A recall that flies a shorter route is not refunded and a cancellation
 * that flies a longer one is not surcharged — both are the operation's weather
 * rather than the player's decision, and pricing them would make this quote a lie.
 *
 * THE SHIPS STAY ON THEIR OWN WORLD, in a row of their own. They are off the home
 * stack — so they do not defend it and cannot be launched again — while still
 * being owned by it, which is what keeps them inside their owner's personal
 * Hangar and their owner's Wealth for the whole operation.
 */
export async function sendClanWarContribution(
  tx: Tx,
  input: {
    actor: ClanActor;
    originPlanetId: string;
    fleet: Fleet;
    acknowledgeShieldLoss: boolean;
    clock: Clock;
  },
): Promise<ClanWarContributionResult> {
  const now = input.clock.now();
  const context = await gatherContribution(tx, input);
  const refusal = context.refusals[0];
  if (refusal) {
    if (refusal.code === 'CLAN_WAR_TARGET_CHANGED') {
      return commitGameError(new GameError(refusal.code, refusal.message, 409));
    }
    throw new GameError(refusal.code, refusal.message, 409, {
      refusals: context.refusals.map((row) => row.code).join(','),
    });
  }

  /*
    THE SHIELD IS SPENT HERE AND NOT AT THE MARK. Marking a target commits nothing;
    putting hulls in the pool is the reaching-out the rule is about, so it goes
    through the same gate an ordinary raid does — which also re-checks that the
    TARGET can be reached at all.
  */
  await assertAttackProtections(tx, {
    attackerPlayerId: input.actor.playerId,
    defenderPlayerId: context.operation.targetPlayerId,
    now,
    acknowledgeShieldLoss: input.acknowledgeShieldLoss,
  });

  const instant = context.sourceKind === 'LEADER_CAPITAL';
  /*
    A UNIT LOCATION OF ITS OWN, DECIDED BEFORE THE INSERT. `units` is primary-keyed
    `(planet, hull, location)`, so two waves of Darts out of the same world would
    overwrite one another under a shared name — which is exactly the multi-wave
    case the owner asked for. It is drawn here rather than derived from the row's
    id afterwards so the column is unique from the instant it exists; a placeholder
    filled in by a second statement would collide under the unique index the moment
    two waves were committed at once.
  */
  const unitLocation = `clan-war:${randomUUID()}`;
  const [contribution] = await tx.insert(clanWarContributions).values({
    seasonId: context.operation.seasonId,
    operationId: context.operation.id,
    clanId: context.clan.id,
    playerId: input.actor.playerId,
    originPlanetId: context.origin.planetId,
    sourceKind: context.sourceKind,
    fleet: input.fleet,
    /*
      THE OWNER'S RESEARCH, FROZEN THE MOMENT THEY COMMITTED. Owner decision.

      These hulls fire and die by their OWN commander's ladders for the whole
      operation — never the leader's, and never what the owner finishes while the
      wave is sitting in escrow. It is the same rule an ordinary raid has had
      since T9, applied per wave because a joint strike has several owners in it.
    */
    tech: context.tech,
    unitLocation,
    reservedBulk: context.bulk,
    fuelPaid: context.fuel,
    fuelLegs: context.legs,
    status: instant ? 'STAGED' : 'OUTBOUND',
    sentAt: now,
    stagedAt: instant ? now : null,
  }).returning();
  if (!contribution) throw new Error('clan war contribution insert returned no row');

  const remaining: Fleet = { ...context.origin.homeFleet };
  for (const [hull, n] of Object.entries(input.fleet) as [HullId, number][]) {
    remaining[hull] = (remaining[hull] ?? 0) - n;
  }
  await setUnits(tx, context.origin.planetId, remaining, 'home');
  await setUnits(tx, context.origin.planetId, input.fleet, unitLocation);

  if (context.fuel > 0) {
    assertFuel(context.fuel, context.origin.deuterium);
    await saveResources(tx, context.origin.planetId, {
      alloy: context.origin.alloy,
      crystal: context.origin.crystal,
      deuterium: context.origin.deuterium - context.fuel,
    });
  }

  if (!instant) {
    const arriveAt = addMinutes(now, context.stagingMinutes);
    const [mission] = await tx.insert(missions).values({
      fuelPaid: context.fuel,
      seasonId: context.operation.seasonId,
      kind: 'clan_war',
      ownerPlayerId: input.actor.playerId,
      originPlanetId: context.origin.planetId,
      targetPlanetId: context.operation.stagingPlanetId,
      fleet: input.fleet,
      tech: context.tech,
      distance: distance(context.origin, context.staging),
      departAt: now,
      arriveAt,
    }).returning();
    if (!mission) throw new Error('clan war support mission insert returned no row');
    await tx.insert(clanWarMissions).values({
      missionId: mission.id,
      operationId: context.operation.id,
      contributionId: contribution.id,
      leg: 'SUPPORT_OUT',
    });
    await schedule(tx, {
      seasonId: context.operation.seasonId,
      kind: 'mission_arrival',
      refId: mission.id,
      resolveAt: arriveAt,
    });
    /*
      A DEPARTURE IS PUBLIC, and a support flight is an ordinary departure: it
      shows as its SENDER'S fleet with the sender's own fog, not as the clan's.
      Only the combined strike wears the clan's colours (`traffic`).
    */
    await publishShard(tx, context.operation.seasonId, 'launch');
  }
  // Watchers of this world see its board change, exactly as on an ordinary launch.
  if (fleetChangesWatch(input.fleet)) {
    await publishWatchChanges(tx, [context.origin.planetId]);
  }

  await publishWar(tx, context.clan.id);
  const ownPlanetIds = (await tx
    .select({ id: planets.id })
    .from(planets)
    .where(eq(planets.controllerPlayerId, input.actor.playerId)))
    .map((row) => row.id);
  const war = await projectOperation(tx, context.operation, input.actor.playerId, now);
  const contacts = await galaxyTraffic(
    tx,
    context.operation.seasonId,
    context.origin.planetId,
    now,
    input.actor.playerId,
    ownPlanetIds,
  );
  return {
    contributionId: contribution.id,
    sourceKind: context.sourceKind,
    status: instant ? 'STAGED' : 'OUTBOUND',
    fuelPaid: context.fuel,
    reservedBulk: context.bulk,
    stagedAt: instant ? now.toISOString() : null,
    planet: await planetView(tx, context.origin.planetId, input.clock),
    pending: await pendingThreads(tx, context.origin.planetId, now),
    war,
    traffic: { contacts },
  };
}

/* ── cancelling ─────────────────────────────────────────────────── */

export async function cancelClanWarOperation(
  tx: Tx,
  input: { actor: ClanActor; clock: Clock },
): Promise<{ operation: ClanWarOperationView }> {
  const now = input.clock.now();
  await lockSeason(tx, input.actor.seasonId);
  const standing = await activeClanMembership(tx, input.actor.playerId);
  const pending = standing ? await openOperation(tx, standing.clanId) : null;
  await lockWarWorlds(tx, [pending?.stagingPlanetId, pending?.targetPlanetId]);
  const clan = await lockLedClan(tx, input.actor, pending ? [pending.targetPlayerId] : []);
  const operation = await lockOperation(tx, clan.id);
  if (!operation) throw new GameError('CLAN_WAR_NOT_FOUND', 'No operation to cancel', 404);
  let settled = await finalizeIfExpired(tx, operation, now);
  settled = await finalizeIfTargetChanged(tx, settled, now);
  if (settled.closeReason === 'TARGET_CHANGED') {
    return commitGameError(new GameError(
      'CLAN_WAR_TARGET_CHANGED',
      'That target is no longer hostile',
      409,
    ));
  }
  if (settled.status !== 'ASSEMBLING') {
    throw new GameError(
      'CLAN_WAR_NOT_ASSEMBLING',
      'That operation can no longer be cancelled',
      409,
      { status: settled.status },
    );
  }
  const closed = await closeOperation(tx, {
    operation: settled,
    reason: 'LEADER_CANCEL',
    now,
  });
  return { operation: await projectOperation(tx, closed) };
}


/* ── returning, recalling and cancelling one wave ───────────────── */

/** A world's Beacon read without locking it — return legs need the destination's. */
async function orbitOfPlanet(
  tx: Tx,
  planetId: string,
): Promise<ReturnType<typeof orbitFromRows>> {
  const [rows, core] = await Promise.all([
    tx.select({ slot: satellites.slot, type: satellites.type })
      .from(satellites).where(eq(satellites.planetId, planetId)),
    tx.select({ level: buildings.level }).from(buildings)
      .where(and(eq(buildings.planetId, planetId), eq(buildings.type, 'CORE'))).limit(1),
  ]);
  return orbitFromRows(rows, core[0]?.level ?? 0);
}

/**
 * Put a wave's surviving ships back on the world they land at. What they carried out of
 * the battle (or its legs) is judged here by the Repair Station. Kalıcı gemi hasarı.
 */
async function landContribution(
  tx: Tx,
  contribution: typeof clanWarContributions.$inferSelect,
  fleet: Fleet,
  destinationPlanetId: string,
  now: Date,
): Promise<DockReport> {
  // Free when the caller already holds it, which every path is arranged to do.
  await lockWarWorlds(tx, [destinationPlanetId]);
  await tx.delete(units).where(and(
    eq(units.planetId, contribution.originPlanetId),
    eq(units.location, contribution.unitLocation),
  ));

  const report = await landShips(tx, {
    planetId: destinationPlanetId,
    ownerPlayerId: contribution.playerId,
    fleet,
    damage: contribution.damage,
    at: now,
  });
  await tx.update(clanWarContributions)
    .set({ status: 'HOME', resolvedAt: now })
    .where(eq(clanWarContributions.id, contribution.id));
  if (fleetChangesWatch(fleet)) await publishWatchChanges(tx, [destinationPlanetId]);
  return report;
}

/**
 * THE ONE PLACE A WAVE IS SENT HOME. Recall, leader cancel, expiry, target drift
 * and — from the settlement — a resolved battle all come through here.
 *
 * FIVE CALLERS, ONE FUNCTION, deliberately. Each of them has to hand the ships
 * back to their owner, and five copies of that is five chances for one of them to
 * strand a fleet. What varies between them is only WHERE the wave is standing
 * when it is told to go home, which is exactly what its status says.
 *
 * A WAVE STILL FLYING TO THE STAGING WORLD DOES NOT TURN AROUND IN SPACE. Owner
 * decision: it finishes the leg it paid for, and the return is planned when it
 * lands (`resolveSupportArrival`). The alternative is a fleet whose position on
 * the disc reverses mid-flight, which no other lane in the game does.
 *
 * NO FUEL CHANGES HANDS EITHER WAY. Every leg was paid at dispatch. A recall that
 * flies a shorter route is not refunded and a cancellation that flies a longer one
 * is not surcharged — see `sendClanWarContribution` for why.
 */
export async function planContributionReturn(
  tx: Tx,
  input: {
    contribution: typeof clanWarContributions.$inferSelect;
    operation: ClanWarOperationRow;
    /** Where the survivors are flying FROM. The staging world before a battle. */
    fromPlanetId: string;
    /** What actually survives. The whole wave on every pre-battle path. */
    fleet: Fleet;
    now: Date;
  },
): Promise<void> {
  const { contribution, operation, now } = input;
  if (contribution.status === 'HOME' || contribution.status === 'LOST') return;

  if (fleetCount(input.fleet) === 0) {
    await tx.delete(units).where(and(
      eq(units.planetId, contribution.originPlanetId),
      eq(units.location, contribution.unitLocation),
    ));
    await tx.update(clanWarContributions)
      .set({ status: 'LOST', resolvedAt: now })
      .where(eq(clanWarContributions.id, contribution.id));
    return;
  }

  // A return mission already owns this wave's physical journey. In particular,
  // a leader-capital wave is no longer standing at staging after it has fought;
  // `closeOperation` revisits every live contribution and must not interpret that
  // second call as a pre-battle instant stand-down with the original roster.
  if (contribution.status === 'RETURNING') return;

  /*
    THE LEADER'S CAPITAL WAVE NEVER LEFT, so there is nothing to fly back. It is
    handed straight to the world it has been standing on the whole time — which is
    only true BEFORE a battle; survivors of the strike fly the ordinary return leg
    like everybody else's, and the settlement passes the target as `fromPlanetId`.
  */
  if (contribution.sourceKind === 'LEADER_CAPITAL'
    && input.fromPlanetId === operation.stagingPlanetId) {
    await landContribution(tx, contribution, input.fleet, contribution.originPlanetId, now);
    return;
  }

  if (contribution.status === 'OUTBOUND') {
    await tx.update(clanWarContributions)
      .set({ status: 'RECALL_ORDERED', recalledAt: now })
      .where(eq(clanWarContributions.id, contribution.id));
    return;
  }
  if (contribution.status === 'RECALL_ORDERED') return;

  /*
    THE DESTINATION IS THE WORLD IT LEFT, IF THAT WORLD IS STILL THEIRS.

    `safeHomePlanet` is the ordinary fallback every other lane uses: a commander who
    lost the world their fleet left from lands at their capital instead. No extra
    fuel is taken for the longer leg and none is given back for a shorter one.
  */
  const destinationPlanetId = await safeHomePlanet(
    tx,
    contribution.playerId,
    contribution.originPlanetId,
  );
  const [from] = await tx.select().from(planets).where(eq(planets.id, input.fromPlanetId));
  const [to] = await tx.select().from(planets).where(eq(planets.id, destinationPlanetId));
  if (!from || !to) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);

  const span = distance(from, to);
  const arriveAt = addMinutes(now, fleetTravelExact(span, input.fleet, {
    boost: fleetSpeedMult(await orbitOfPlanet(tx, destinationPlanetId)),
    tech: contribution.tech,
  }));
  const leg = contribution.status === 'IN_BATTLE' ? 'BATTLE_RETURN' : 'SUPPORT_RETURN';
  const [mission] = await tx.insert(missions).values({
    // A return leg is already paid for: fuel is charged in full at the outbound launch.
    fuelPaid: 0,
    seasonId: operation.seasonId,
    kind: 'clan_war',
    ownerPlayerId: contribution.playerId,
    originPlanetId: input.fromPlanetId,
    targetPlanetId: destinationPlanetId,
    fleet: input.fleet,
    tech: contribution.tech,
    distance: span,
    departAt: now,
    arriveAt,
  }).returning();
  if (!mission) throw new Error('clan war return mission insert returned no row');
  await tx.insert(clanWarMissions).values({
    missionId: mission.id,
    operationId: operation.id,
    contributionId: contribution.id,
    leg,
  });
  await schedule(tx, {
    seasonId: operation.seasonId,
    kind: 'mission_arrival',
    refId: mission.id,
    resolveAt: arriveAt,
  });
  /*
    THE WAVE'S OWN UNIT ROW IS CUT DOWN TO WHAT SURVIVED.

    Those rows are what the owner's personal Hangar and their Wealth are counted
    from, and until now they still held the pre-battle numbers — so a commander
    who lost half a wing would have gone on being charged Hangar room for hulls
    that no longer exist, for the whole flight home. Every hull the wave STARTED
    with is written, so one that was wiped out entirely is zeroed rather than left
    standing: `setUnits` upserts what it is given and never removes what it is not.
  */
  const remaining: Fleet = {};
  for (const hull of Object.keys(contribution.fleet) as HullId[]) {
    remaining[hull] = input.fleet[hull] ?? 0;
  }
  await setUnits(
    tx,
    contribution.originPlanetId,
    remaining,
    contribution.unitLocation,
    contribution.playerId,
  );
  await tx.update(clanWarContributions)
    .set({ status: 'RETURNING', returnAt: arriveAt })
    .where(eq(clanWarContributions.id, contribution.id));
  await publishShard(tx, operation.seasonId, 'launch');
}

/**
 * TAKE MY WAVE BACK. Owner's decision, and the one thing a joint war lets a
 * commander undo that an ordinary raid never has.
 *
 * ONLY YOUR OWN, AND ONLY BEFORE THE STRIKE. What a member commits is theirs to
 * withdraw while the pool is still assembling; once the leader launches, it is a
 * fleet in the air and the ordinary rule applies — nothing comes back.
 *
 * A SECOND RECALL IS NOT AN ERROR. Mobile clients retry, and a commander who taps
 * twice has asked for the same thing twice; the second call answers with the state
 * the first one produced rather than a refusal or a second return mission.
 */
export async function recallClanWarContribution(
  tx: Tx,
  input: { actor: ClanActor; contributionId: string; clock: Clock },
): Promise<{ contributionId: string; status: ClanWarContributionStatus }> {
  const now = input.clock.now();
  await lockSeason(tx, input.actor.seasonId);
  const [row] = await tx
    .select()
    .from(clanWarContributions)
    .where(eq(clanWarContributions.id, input.contributionId))
    .limit(1);
  if (!row) throw new GameError('CLAN_WAR_NOT_FOUND', 'No such contribution', 404);
  if (row.playerId !== input.actor.playerId) {
    throw new GameError('CLAN_WAR_CONTRIBUTION_NOT_OWNED', 'That wave is not yours', 403);
  }

  const [pending] = await tx
    .select({
      stagingPlanetId: clanWarOperations.stagingPlanetId,
      targetPlanetId: clanWarOperations.targetPlanetId,
      targetPlayerId: clanWarOperations.targetPlayerId,
    })
    .from(clanWarOperations)
    .where(eq(clanWarOperations.id, row.operationId))
    .limit(1);
  await lockWarWorlds(tx, [
    row.originPlanetId,
    pending?.stagingPlanetId,
    pending?.targetPlanetId,
  ]);

  const [clan] = await tx.select().from(clans)
    .where(eq(clans.id, row.clanId)).for('update');
  if (!clan) throw new GameError('CLAN_NOT_FOUND', 'No such active clan', 404);
  await lockClanPlayers(tx, [input.actor.playerId, ...(pending ? [pending.targetPlayerId] : [])]);
  const [operationRow] = await tx
    .select()
    .from(clanWarOperations)
    .where(eq(clanWarOperations.id, row.operationId))
    .for('update');
  if (!operationRow) throw new GameError('CLAN_WAR_NOT_FOUND', 'No such operation', 404);
  let operation = await finalizeIfExpired(tx, operationRow, now);
  operation = await finalizeIfTargetChanged(tx, operation, now);

  const [contribution] = await tx
    .select()
    .from(clanWarContributions)
    .where(eq(clanWarContributions.id, input.contributionId))
    .for('update');
  if (!contribution) throw new GameError('CLAN_WAR_NOT_FOUND', 'No such contribution', 404);

  // Already on its way back, home, or lost: answer with what is, not with a refusal.
  if (contribution.status !== 'OUTBOUND' && contribution.status !== 'STAGED') {
    if (contribution.status === 'IN_BATTLE') {
      throw new GameError('CLAN_WAR_POOL_LOCKED', 'The strike has already launched', 409);
    }
    return { contributionId: contribution.id, status: contribution.status };
  }
  if (operation.status === 'ATTACKING') {
    throw new GameError('CLAN_WAR_POOL_LOCKED', 'The strike has already launched', 409);
  }

  await planContributionReturn(tx, {
    contribution,
    operation,
    fromPlanetId: operation.stagingPlanetId,
    fleet: contribution.fleet,
    now,
  });
  const [after] = await tx
    .select({ status: clanWarContributions.status })
    .from(clanWarContributions)
    .where(eq(clanWarContributions.id, contribution.id));
  await publishWar(tx, contribution.clanId);
  /*
    A CANCELLED OPERATION WITH NOTHING LEFT IN IT FINISHES HERE. The last wave to
    leave the pool is what completes a `RETURNING` operation, and a recall can be
    that wave when the operation was already closing.
  */
  await completeIfSettled(tx, operation, now);
  return { contributionId: contribution.id, status: after?.status ?? 'RETURNING' };
}

/** An operation in `RETURNING` finishes the moment its last wave is terminal. */
export async function completeIfSettled(
  tx: Tx,
  operation: ClanWarOperationRow,
  now: Date,
): Promise<void> {
  if (operation.status !== 'RETURNING') return;
  const live = await tx
    .select({ id: clanWarContributions.id })
    .from(clanWarContributions)
    .where(and(
      eq(clanWarContributions.operationId, operation.id),
      inArray(clanWarContributions.status, [...LIVE_CONTRIBUTION_STATUSES]),
    ))
    .limit(1);
  if (live.length > 0) return;
  await tx.update(clanWarOperations)
    .set({ status: 'COMPLETED', completedAt: now })
    .where(and(
      eq(clanWarOperations.id, operation.id),
      eq(clanWarOperations.status, 'RETURNING'),
    ));
  await publishWar(tx, operation.clanId);
}


/* ── membership, while an operation is undecided ────────────────── */

/**
 * NOBODY WALKS OUT IN THE MIDDLE OF AN OPERATION THEY PUT SHIPS INTO.
 *
 * Owner decision, and it protects both sides of the same fact: the ships are the
 * member's, and the operation is the clan's. A member who left mid-assembly would
 * have a fleet in a pool they are no longer part of, under a leader who could
 * spend it; a leader who could kick them would be able to confiscate it.
 *
 * IT READS HISTORY, NOT LIVE STATUS. A commander who recalled their wave, or whose
 * wave is already home, is still locked while the operation is undecided — they
 * committed, and the roster that committed is the roster the outcome belongs to.
 *
 * IT LIFTS THE MOMENT THE OUTCOME IS FINAL, not when the last ship lands. Returns
 * can take hours and they carry their own snapshot of who owned what; making
 * somebody wait those hours to leave a clan would be a lock with nothing behind it.
 */
export async function assertClanWarMembershipUnlocked(
  tx: Tx,
  input: { clanId: string; playerId?: string },
): Promise<void> {
  const [operation] = await tx
    .select({ id: clanWarOperations.id, status: clanWarOperations.status })
    .from(clanWarOperations)
    .where(and(
      eq(clanWarOperations.clanId, input.clanId),
      inArray(clanWarOperations.status, ['ASSEMBLING', 'ATTACKING']),
    ))
    .limit(1);
  if (!operation) return;

  /*
    LEADERSHIP AND THE CLAN ITSELF ARE PART OF THE OPERATION'S AUTHORITY.

    Transfer and disband call this guard without a player id. They must be held
    from the moment a target is marked, before the first wave exists; otherwise
    the old leader remains recorded as coordinator after handing the clan over,
    or the operation survives a disband with no clan left to control it.
  */
  if (input.playerId === undefined) {
    throw new GameError(
      'CLAN_WAR_MEMBERSHIP_LOCKED',
      'A joint war is still undecided; that cannot change until it settles',
      409,
      { status: operation.status },
    );
  }

  const [committed] = await tx
    .select({ id: clanWarContributions.id })
    .from(clanWarContributions)
    .where(and(
      eq(clanWarContributions.operationId, operation.id),
      eq(clanWarContributions.playerId, input.playerId),
    ))
    .limit(1);
  if (!committed) return;

  throw new GameError(
    'CLAN_WAR_MEMBERSHIP_LOCKED',
    'A joint war is still undecided; that cannot change until it settles',
    409,
    { status: operation.status },
  );
}

/* ── target drift ───────────────────────────────────────────────── */

/**
 * THE TARGET STOPPED BEING THE TARGET. Owner decision, and only before launch.
 *
 * Two things end an operation that has not fired yet: the world changes hands, so
 * the commander the clan aimed at is not there any more, and the target JOINS the
 * attacking clan, so the strike would be friendly fire. Both cancel and send every
 * wave home.
 *
 * AFTER THE STRIKE LAUNCHES, NEITHER APPLIES. An ordinary raid already has rules
 * for a world that changes hands mid-flight, and a joint war is a raid once it is
 * in the air — inventing a retroactive cancel here would be a second set of
 * in-flight semantics nobody could predict from the ordinary one.
 *
 * THE HOOKS ARE A SPEED-UP, NOT THE AUTHORITY. Every read, add, recall, cancel and
 * start re-checks the target itself, so an operation whose hook never fired is
 * still refused rather than flown.
 */
export async function revalidateClanWarTargetPlanet(
  tx: Tx,
  planetId: string,
  now: Date,
): Promise<void> {
  const [current] = await tx
    .select({ controllerPlayerId: planets.controllerPlayerId })
    .from(planets)
    .where(eq(planets.id, planetId))
    .limit(1);
  const candidates = await tx
    .select()
    .from(clanWarOperations)
    .where(and(
      eq(clanWarOperations.targetPlanetId, planetId),
      eq(clanWarOperations.status, 'ASSEMBLING'),
    ));
  for (const candidate of candidates) {
    if (current?.controllerPlayerId === candidate.targetPlayerId) continue;
    if (!await tryCloseFromHook(tx, candidate, 'TARGET_CHANGED', now)) continue;
  }
}

/**
 * CLOSE AN OPERATION FROM INSIDE SOMEBODY ELSE'S TRANSACTION, OR LEAVE IT ALONE.
 *
 * A capture, a secession and a recruitment all run with worlds of their own
 * already locked, and closing an operation writes the staging world's home stack.
 * Taking that lock the ordinary way would mean acquiring worlds in whatever order
 * the host transaction happened to leave, which is how a deadlock is built.
 *
 * So the hook asks WITHOUT WAITING and gives up if the world is busy. That is
 * sound because the hook was never the authority: every read, add, recall, cancel
 * and start re-checks the target and finalises an operation that has drifted, and
 * the twenty-four hour timer catches anything they all miss. The hook exists to
 * make the common case immediate, not to be the only thing that works.
 */
async function tryCloseFromHook(
  tx: Tx,
  operation: ClanWarOperationRow,
  reason: ClanWarCloseReason,
  now: Date,
): Promise<boolean> {
  const held = await tx
    .select({ id: planets.id })
    .from(planets)
    .where(eq(planets.id, operation.stagingPlanetId))
    .for('update', { skipLocked: true });
  if (held.length === 0) return false;
  const [locked] = await tx
    .select()
    .from(clanWarOperations)
    .where(eq(clanWarOperations.id, operation.id))
    .for('update', { skipLocked: true });
  if (locked?.status !== 'ASSEMBLING') return false;
  await closeOperation(tx, { operation: locked, reason, now });
  return true;
}

/** The commander a clan is aiming at just joined that clan. Friendly fire cancels it. */
export async function revalidateClanWarTargetMembership(
  tx: Tx,
  playerId: string,
  clanId: string,
  now: Date,
): Promise<void> {
  const candidates = await tx
    .select()
    .from(clanWarOperations)
    .where(and(
      eq(clanWarOperations.targetPlayerId, playerId),
      eq(clanWarOperations.clanId, clanId),
      eq(clanWarOperations.status, 'ASSEMBLING'),
    ));
  for (const candidate of candidates) {
    await tryCloseFromHook(tx, candidate, 'TARGET_CHANGED', now);
  }
}

/* ── the worker's timer ─────────────────────────────────────────── */

/**
 * THE TWENTY-FOUR HOURS RAN OUT. Idempotent against redelivery and against a
 * leader who cancelled or launched in the same instant: the row is taken
 * `FOR UPDATE` and only an `ASSEMBLING` row past its own expiry is closed.
 */
export async function resolveClanWarExpiry(
  tx: Tx,
  operationId: string,
  now: Date,
): Promise<void> {
  const [pending] = await tx
    .select({ stagingPlanetId: clanWarOperations.stagingPlanetId })
    .from(clanWarOperations)
    .where(eq(clanWarOperations.id, operationId))
    .limit(1);
  if (!pending) return;
  await lockWarWorlds(tx, [pending.stagingPlanetId]);
  const [operation] = await tx
    .select()
    .from(clanWarOperations)
    .where(eq(clanWarOperations.id, operationId))
    .for('update');
  if (!operation) return;
  await finalizeIfExpired(tx, operation, now);
}



/* ── the leader pulls the trigger ───────────────────────────────── */

export interface ClanWarStartResult {
  missionId: string;
  arriveAt: string;
  resolveAt: string;
  participants: number;
  operation: ClanWarOperationView;
}

/**
 * LAUNCH THE COMBINED STRIKE. The one irreversible moment in the operation.
 *
 * Everything the pool has been assembling for twenty-four hours becomes a single
 * mission here, and from this instant nothing can be added, removed or recalled —
 * it is a fleet in the air, and this game has never let one turn round.
 *
 * WHAT IS RE-CHECKED, AND WHY EVERY ONE OF IT. A wave may have sat in escrow for
 * a day: the target can have gained a shield, a ceasefire can have started, a
 * participant can have outgrown the development band, and anybody's bash quota
 * can have filled up in the meantime. The quote checked all of it; the quote is
 * old. Nothing is consumed until this transaction commits.
 *
 * WHAT IT REFUSES TO WAIT FOR. A wave still flying to the staging world stops the
 * launch outright (`CLAN_WAR_SUPPORT_INBOUND`) rather than being left behind —
 * a member who paid three legs of fuel to join this strike should not watch it
 * leave without them because they live further away. A wave whose owner has
 * ALREADY recalled it is not waited for: they chose to leave.
 */
export async function startClanWar(
  tx: Tx,
  input: {
    actor: ClanActor;
    acknowledgeShieldLoss: boolean;
    /** The combined leg's pace, one of `MISSION_PACES`. Full speed when absent. */
    pace?: number;
    clock: Clock;
  },
): Promise<ClanWarStartResult> {
  const now = input.clock.now();
  const chosenPace = input.pace ?? 1;
  if (!isMissionPace(chosenPace)) {
    throw new GameError('BAD_PACE', 'that is not a flight speed this fleet can be set to', 400);
  }
  const season = await lockSeason(tx, input.actor.seasonId);

  const standing = await activeClanMembership(tx, input.actor.playerId);
  const pending = standing ? await openOperation(tx, standing.clanId) : null;
  await lockWarWorlds(tx, [pending?.stagingPlanetId, pending?.targetPlanetId]);

  const clan = await lockLedClan(tx, input.actor, pending ? [pending.targetPlayerId] : []);
  const opened = await lockOperation(tx, clan.id);
  if (!opened) throw new GameError('CLAN_WAR_NOT_FOUND', 'Your clan has no target', 404);
  let operation = await finalizeIfExpired(tx, opened, now);
  if (operation.status !== 'ASSEMBLING') {
    throw new GameError(
      operation.closeReason === 'EXPIRED' ? 'CLAN_WAR_EXPIRED' : 'CLAN_WAR_NOT_ASSEMBLING',
      'That operation can no longer be launched',
      409,
      { status: operation.status },
    );
  }
  /*
    THE DEADLINE IS EXCLUSIVE. A strike that leaves at the last whole second of
    the day is legal; one that leaves at the instant the target expires is not.
    Once it is in the air the timer no longer matters — the operation is
    `ATTACKING` and the expiry handler leaves it alone.
  */
  if (now >= operation.expiresAt) {
    throw new GameError('CLAN_WAR_EXPIRED', 'That target has expired', 409);
  }

  const [staging] = await tx.select().from(planets)
    .where(eq(planets.id, operation.stagingPlanetId)).limit(1);
  const [target] = await tx.select().from(planets)
    .where(eq(planets.id, operation.targetPlanetId)).limit(1);
  if (!staging || !target) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);
  await assertClanWarSeason(tx, {
    operation,
    actorSeasonId: input.actor.seasonId,
    clanSeasonId: clan.seasonId,
    worldSeasonIds: [staging.seasonId, target.seasonId],
  });
  operation = await finalizeIfTargetChanged(tx, operation, now);
  if (operation.status !== 'ASSEMBLING') {
    return commitGameError(new GameError(
      'CLAN_WAR_TARGET_CHANGED',
      'That target is no longer hostile',
      409,
    ));
  }
  assertWorldAttackable(target, now);
  assertDeparturesAllowed(staging.id, await faultsOfPlanet(tx, staging.id));

  const waves = await tx
    .select()
    .from(clanWarContributions)
    .where(eq(clanWarContributions.operationId, operation.id))
    .for('update');
  const inbound = waves.filter((wave) => wave.status === 'OUTBOUND');
  if (inbound.length > 0) {
    throw new GameError(
      'CLAN_WAR_SUPPORT_INBOUND',
      'Support is still on its way; wait for it to land',
      409,
      { waves: inbound.length },
    );
  }
  const pool = waves.filter((wave) => wave.status === 'STAGED');
  if (pool.length === 0) {
    throw new GameError('CLAN_WAR_NO_COMBAT_FLEET', 'There is nothing in the pool', 409);
  }
  /*
    A POOL OF NOTHING BUT HOLDS DOES NOT LAUNCH. Owner decision: a single wave may
    be all transports — the hold is what carries the haul home — but the strike
    itself needs something that shoots, and that is a question about the POOL,
    which is why it is asked here and not when a wave is committed.
  */
  const combatHulls = pool.reduce(
    (sum, wave) => sum + COMBAT_HULLS.reduce((n, hull) => n + (wave.fleet[hull] ?? 0), 0),
    0,
  );
  if (combatHulls === 0) {
    throw new GameError(
      'CLAN_WAR_NO_COMBAT_FLEET',
      'A combined attack needs at least one combat hull',
      409,
    );
  }

  const combined: Fleet = {};
  for (const wave of pool) {
    for (const [hull, n] of Object.entries(wave.fleet) as [HullId, number][]) {
      combined[hull] = (combined[hull] ?? 0) + n;
    }
  }
  const slowest = await strikeSpeed(tx, staging.id, pool);
  if (!Number.isFinite(slowest) || slowest <= 0) {
    throw new GameError('IMMOBILE_FLEET', 'That pool cannot travel', 409);
  }
  const span = distance(staging, target);
  /*
    THE LEADER CHOOSES WHEN IT LANDS, and the rung is checked against THIS leg before any shield
    or quota is touched — the same order the personal raid lane keeps. Only the combined leg is
    paced; survivors come home at full speed like every other lane (plan §15.5a).
  */
  const fullSpeed = travelExact(span, slowest);
  if (!pacesForMinutes(fullSpeed).includes(chosenPace)) {
    throw new GameError(
      'PACE_TOO_SLOW',
      'at that speed the fleet would be in the air past the twelve-hour ceiling',
      400,
    );
  }
  const oneWay = fullSpeed / chosenPace;

  const fighters = [...new Set(pool.map((wave) => wave.playerId))].sort();
  const eligibleAttackers = [...new Set([...fighters, operation.leaderPlayerId])].sort();
  await lockClanPlayers(tx, [...eligibleAttackers, operation.targetPlayerId]);

  /*
    EVERY COMMANDER BEHIND THE STRIKE, ON THEIR OWN ACCOUNT, AGAIN. Maturity, the
    development band and the clan they are still in — a day is long enough for any
    of the three to have moved. The fleetless leader is included because pulling
    the trigger spends their quota and shield; their eligibility cannot be lent
    by a member whose hulls are in the pool.
  */
  const peaks = await peakCoreLevels(tx, [...eligibleAttackers, operation.targetPlayerId]);
  const attackerSeasonRows = await tx
    .select({ id: players.id, seasonId: players.seasonId })
    .from(players)
    .where(inArray(players.id, eligibleAttackers));
  const attackerSeasons = new Map(attackerSeasonRows.map((row) => [row.id, row.seasonId]));
  const targetPeak = peaks.get(operation.targetPlayerId) ?? 1;
  const ineligible: string[] = [];
  for (const playerId of eligibleAttackers) {
    const membership = await activeClanMembership(tx, playerId);
    if (membership?.clanId !== clan.id
      || attackerSeasons.get(playerId) !== operation.seasonId
      || membership.matureAt > now) {
      ineligible.push(playerId);
      continue;
    }
    const band = canAttack(
      { playerId, peakCoreLevel: peaks.get(playerId) ?? 1 },
      { playerId: operation.targetPlayerId, peakCoreLevel: targetPeak },
      0,
    );
    if (!band.ok) ineligible.push(playerId);
  }
  if (ineligible.length > 0) {
    throw new GameError(
      'CLAN_WAR_PARTICIPANT_INELIGIBLE',
      'A commander behind this strike may no longer fight that target',
      409,
      { playerIds: ineligible.join(',') },
    );
  }

  /*
    THE COORDINATING LEADER SPENDS A QUOTA AND A SHIELD EVEN WITH NO HULLS IN IT,
    and is counted ONCE when they have some. Owner decision: pulling the trigger is
    the act the bash limit and the shield are both about.
  */
  const leaderFought = fighters.includes(operation.leaderPlayerId);
  const participants = [
    ...fighters.map((playerId) => ({ playerId, fought: true })),
    ...(leaderFought ? [] : [{ playerId: operation.leaderPlayerId, fought: false }]),
  ];
  const prepared = await prepareJointClanAttack(tx, {
    clanId: clan.id,
    participants,
    targetPlayerId: operation.targetPlayerId,
    now,
  });

  /*
    THE TARGET'S SHIELDS AND EVERY ATTACKER'S, IN ONE PASS. The gate refuses on
    the defender first and then spends each attacker's own window — including the
    fleetless leader's, whose acknowledgement is the one this call carries.
  */
  for (const participant of prepared.participants) {
    /*
      A COMMANDER WITH HULLS IN THE POOL CANNOT BE HOLDING A SHIELD: committing
      them spent whatever they had, and `hasOutboundPvpStrike` counts a committed
      wave so none can be earned while it waits. The acknowledgement is therefore
      only ever the fleetless coordinator's, and passing it for a fighter is a
      no-op rather than a silent spend.
    */
    await assertAttackProtections(tx, {
      attackerPlayerId: participant.playerId,
      defenderPlayerId: operation.targetPlayerId,
      now,
      acknowledgeShieldLoss: participant.fought || input.acknowledgeShieldLoss,
    });
  }

  const arriveAt = addMinutes(now, oneWay);
  const resolveAt = new Date(engagementEndsAt(arriveAt.getTime()));
  /*
    EVERY WAVE HAS TO BE ABLE TO GET HOME INSIDE THE GALAXY, recomputed from where
    it is standing NOW rather than from the estimate its quote made a day ago.
  */
  for (const wave of pool) {
    const home = await safeHomePlanet(tx, wave.playerId, wave.originPlanetId);
    const [destination] = await tx.select().from(planets).where(eq(planets.id, home)).limit(1);
    if (!destination) continue;
    const back = fleetTravelExact(distance(target, destination), wave.fleet, {
      boost: fleetSpeedMult(await orbitOfWorld(tx, destination.id)),
      tech: wave.tech,
    });
    if (addMinutes(resolveAt, back) > season.endsAt) {
      throw new GameError(
        'CLAN_WAR_SEASON_TOO_SHORT',
        'This galaxy ends before every wave could get home',
        409,
      );
    }
  }

  const [mission] = await tx.insert(missions).values({
    // Each contributor paid on their own row; see `clan_war_contributions.fuelPaid`.
    fuelPaid: 0,
    seasonId: operation.seasonId,
    kind: 'clan_war',
    /*
      THE COORDINATOR IS THE TECHNICAL OWNER OF THE ROW AND NOTHING MORE.

      `missions.owner_player_id` is NOT NULL and holds exactly one commander, and
      a combined strike has up to five behind it. Nothing that decides an outcome
      reads this column: ownership of the hulls is per contribution, the quota is
      `attack_commitments`, and the report's participant list is
      `clan_war_participant_results`.
    */
    ownerPlayerId: operation.leaderPlayerId,
    originPlanetId: staging.id,
    targetPlanetId: target.id,
    fleet: combined,
    distance: span,
    departAt: now,
    arriveAt,
    pace: chosenPace,
  }).returning();
  if (!mission) throw new Error('clan war combined mission insert returned no row');
  await tx.insert(clanWarMissions).values({
    missionId: mission.id,
    operationId: operation.id,
    leg: 'COMBINED_ATTACK',
  });
  await recordJointClanAttack(tx, {
    ...prepared,
    missionId: mission.id,
    seasonId: operation.seasonId,
    targetPlayerId: operation.targetPlayerId,
    now,
  });

  await tx.update(clanWarContributions)
    .set({ status: 'IN_BATTLE', battleAt: arriveAt })
    .where(and(
      eq(clanWarContributions.operationId, operation.id),
      eq(clanWarContributions.status, 'STAGED'),
    ));
  const [attacking] = await tx.update(clanWarOperations)
    .set({
      status: 'ATTACKING',
      startedAt: now,
      attackerScoreClanId: prepared.attackerScoreClanId,
      defenderScoreClanId: prepared.defenderScoreClanId,
    })
    .where(eq(clanWarOperations.id, operation.id))
    .returning();

  await schedule(tx, {
    seasonId: operation.seasonId,
    kind: 'mission_arrival',
    refId: mission.id,
    resolveAt,
  });
  const warnAt = addMinutes(arriveAt, -inboundRadarLead(maxRadarRange(), {
    from: staging,
    to: target,
    originCoreLevel: await coreLevelOf(tx, staging.id),
    targetCoreLevel: await coreLevelOf(tx, target.id),
    oneWayMinutes: oneWay,
  }));
  await schedule(tx, {
    seasonId: operation.seasonId,
    kind: 'radar_warning',
    refId: mission.id,
    resolveAt: warnAt > now ? warnAt : now,
  });

  await publishShard(tx, operation.seasonId, 'launch');
  await publishWar(tx, clan.id);
  return {
    missionId: mission.id,
    arriveAt: arriveAt.toISOString(),
    resolveAt: resolveAt.toISOString(),
    participants: fighters.length,
    operation: await projectOperation(tx, attacking ?? operation, input.actor.playerId, now),
  };
}

const coreLevelOf = async (tx: Queryable, planetId: string): Promise<number> => {
  const [row] = await tx.select({ level: buildings.level }).from(buildings)
    .where(and(eq(buildings.planetId, planetId), eq(buildings.type, 'CORE'))).limit(1);
  return row?.level ?? 1;
};

/**
 * THE STRIKE FLIES AT ITS SLOWEST SHIP, and each wave's pace is read with its OWN owner's
 * propulsion. A Beacon over the staging world lifts the whole formation, because that is the world
 * it leaves from — it is not a way to borrow another commander's research.
 *
 * One definition for the launch and for the leader's screen, so the arrival the rungs quote is
 * the arrival the strike flies.
 */
async function strikeSpeed(
  db: Queryable,
  stagingPlanetId: string,
  pool: readonly { fleet: Fleet; tech: TechLevels }[],
): Promise<number> {
  const boost = fleetSpeedMult(orbitFromRows(
    await db.select({ slot: satellites.slot, type: satellites.type })
      .from(satellites).where(eq(satellites.planetId, stagingPlanetId)),
    await coreLevelOf(db, stagingPlanetId),
  ));
  let slowest = Number.POSITIVE_INFINITY;
  for (const wave of pool) slowest = Math.min(slowest, fleetSpeed(wave.fleet, wave.tech) * boost);
  return slowest;
}

const faultsOfPlanet = async (tx: Tx, planetId: string): Promise<FaultKind[]> => {
  const rows = await tx.select({ kind: planetFaults.kind }).from(planetFaults)
    .where(eq(planetFaults.planetId, planetId));
  return rows.map((row) => row.kind);
};

/* ── the worker: one leg of an operation lands ──────────────────── */

/**
 * A CLAN-WAR MISSION REACHED ITS DESTINATION. One entry point, four legs.
 *
 * `missions.kind` says only that this belongs to a joint war; which leg it is
 * lives in `clan_war_missions`, so that relation decides what happens rather than
 * four enum values kept in step by hand. A leg with no relation row is a mission
 * that should not exist; it is left in flight rather than settled as something
 * else, so the mismatch shows up as a stuck flight instead of as silent damage.
 */
export async function resolveClanWarLeg(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  now: Date,
  adminUsernames: ReadonlySet<string> = new Set(),
): Promise<void> {
  const [leg] = await tx
    .select()
    .from(clanWarMissions)
    .where(eq(clanWarMissions.missionId, mission.id))
    .limit(1);
  if (!leg) throw new Error(`clan war mission ${mission.id} has no leg`);
  const [season] = await tx
    .select({ rulesetVersion: seasons.rulesetVersion })
    .from(seasons)
    .where(eq(seasons.id, mission.seasonId))
    .limit(1);
  const rulesetVersion = season?.rulesetVersion ?? MULTI_WORLD.rulesetVersion;

  if (leg.leg === 'SUPPORT_OUT') {
    await resolveSupportArrival(tx, leg.contributionId, mission, now, rulesetVersion);
    return;
  }
  if (leg.leg === 'SUPPORT_RETURN' || leg.leg === 'BATTLE_RETURN') {
    await resolveReturnArrival(tx, leg.contributionId, mission, now, leg.leg, rulesetVersion);
    return;
  }
  const [operation] = await tx
    .select()
    .from(clanWarOperations)
    .where(eq(clanWarOperations.id, leg.operationId))
    .for('update');
  if (!operation) throw new Error(`clan war mission ${mission.id} has no operation`);
  if (operation.status !== 'ATTACKING') return;
  await resolveClanWarBattle(tx, {
    mission,
    operation,
    rulesetVersion,
    clock: { now: () => now },
    adminUsernames,
  });
}

/**
 * A SUPPORT WAVE REACHED THE STAGING WORLD.
 *
 * THE SHIPS DO NOT MOVE. They stay in their own `units` row on the world they
 * left, which is what keeps them inside their owner's Hangar and their owner's
 * Wealth, and out of the staging world's defence — the escrow the owner asked
 * for. What changes is the wave's STATUS, which is what the pool is read from.
 */
/**
 * A WAVE A CLOUD FINISHED ON ONE OF ITS LEGS IS LOST, the way a wave wiped in battle is,
 * and the operation checks whether it is now settled. Radyasyon (plan F9).
 */
async function loseWave(tx: Tx, wave: typeof clanWarContributions.$inferSelect, now: Date): Promise<void> {
  await tx.update(clanWarContributions).set({ status: 'LOST', resolvedAt: now })
    .where(eq(clanWarContributions.id, wave.id));
  const [operation] = await tx.select().from(clanWarOperations)
    .where(eq(clanWarOperations.id, wave.operationId)).for('update');
  if (operation) await completeIfSettled(tx, operation, now);
  await publishWar(tx, wave.clanId);
}

async function resolveSupportArrival(
  tx: Tx,
  contributionId: string | null,
  mission: typeof missions.$inferSelect,
  now: Date,
  rulesetVersion: number,
): Promise<void> {
  if (!contributionId) throw new Error('support leg without a contribution');
  const [contribution] = await tx
    .select()
    .from(clanWarContributions)
    .where(eq(clanWarContributions.id, contributionId))
    .for('update');
  if (!contribution) return;
  if (!['OUTBOUND', 'RECALL_ORDERED'].includes(contribution.status)) return;

  // The dose on the way to the staging world, before the wave counts in the pool.
  const dosed = await settleWaveRadiation(tx, contribution, mission, rulesetVersion);
  await tellRadiationLoss(tx, { playerId: contribution.playerId, refId: mission.id, toPlanetId: mission.targetPlanetId },
    dosed, now);
  if (fleetCount(dosed.fleet) === 0 && fleetCount(dosed.destroyed) > 0) {
    await loseWave(tx, contribution, now);
    return;
  }

  await tx.update(clanWarContributions)
    .set({ status: 'STAGED', stagedAt: now })
    .where(eq(clanWarContributions.id, contributionId));

  /*
    A RECALL GIVEN WHILE IT WAS STILL FLYING TAKES EFFECT NOW.

    Owner decision: a recalled wave does not turn round in space, it finishes the
    leg it paid for and then goes home. So the order is recorded as a status while
    it flies and becomes an actual return leg here, at the one instant the wave is
    somewhere a leg can start from. The same instant serves a cancel or an expiry
    that happened while it was in the air — both left the wave `RECALL_ORDERED`.
  */
  const [operation] = await tx
    .select()
    .from(clanWarOperations)
    .where(eq(clanWarOperations.id, contribution.operationId))
    .for('update');
  if (!operation) return;
  const staged = { ...dosed.wave, status: 'STAGED' as const, stagedAt: now };
  if (contribution.status === 'RECALL_ORDERED' || operation.status !== 'ASSEMBLING') {
    await planContributionReturn(tx, {
      contribution: staged,
      operation,
      fromPlanetId: operation.stagingPlanetId,
      fleet: dosed.wave.fleet,
      now,
    });
    await completeIfSettled(tx, operation, now);
  }
  await publishWar(tx, contribution.clanId);
}

/**
 * A WAVE REACHED THE WORLD IT WAS FLYING HOME TO.
 *
 * The ships rejoin the home stack there and the wave becomes terminal, which is
 * what releases its flight bay and its share of the Klan Hangarı. The LAST wave
 * to land is what finishes a `RETURNING` operation — and therefore what lets the
 * clan mark its next target.
 */
async function resolveReturnArrival(
  tx: Tx,
  contributionId: string | null,
  mission: typeof missions.$inferSelect,
  now: Date,
  leg: 'SUPPORT_RETURN' | 'BATTLE_RETURN',
  rulesetVersion: number,
): Promise<void> {
  if (!contributionId) throw new Error('return leg without a contribution');
  const [contribution] = await tx
    .select()
    .from(clanWarContributions)
    .where(eq(clanWarContributions.id, contributionId))
    .for('update');
  if (!contribution) return;
  if (contribution.status === 'HOME' || contribution.status === 'LOST') return;

  /*
    THE DOSE ON THE WAY HOME, then the landing (plan §3.5, D9): the last ship takes the
    haul with it, and what survives carries only what its holds can.
  */
  const dosed = await settleWaveRadiation(tx, contribution, mission, rulesetVersion);
  await tellRadiationLoss(tx, { playerId: contribution.playerId, refId: mission.id, toPlanetId: mission.targetPlanetId },
    dosed, now);
  if (fleetCount(dosed.fleet) === 0 && fleetCount(dosed.destroyed) > 0) {
    await loseWave(tx, contribution, now);
    return;
  }
  const wave = fleetCount(dosed.destroyed) > 0
    ? {
        ...dosed.wave,
        ...capLoadToSurvivors({ loot: dosed.wave.loot, salvage: dosed.wave.salvage }, dosed.fleet, dosed.wave.tech),
      }
    : dosed.wave;

  const destinationPlanetId = await safeHomePlanet(
    tx, contribution.playerId, mission.targetPlanetId,
  );
  const landed = await landContribution(tx, wave, dosed.fleet, destinationPlanetId, now);
  // The battle wrote immutable per-wave shares, but the ships physically carry
  // them until this return lands. A terminal wave is skipped above, so a repeated
  // arrival cannot credit the haul twice. Joint loot never enters the ordinary
  // clan raid share path.
  const loot = wave.loot ?? { alloy: 0, crystal: 0, deuterium: 0 };
  const salvage = wave.salvage ?? { alloy: 0, crystal: 0, deuterium: 0 };
  if (loot.alloy + loot.crystal + loot.deuterium
    + salvage.alloy + salvage.crystal + salvage.deuterium > 0) {
    await tx.update(planets).set({
      alloy: sql`${planets.alloy} + ${loot.alloy + salvage.alloy}`,
      crystal: sql`${planets.crystal} + ${loot.crystal + salvage.crystal}`,
      deuterium: sql`${planets.deuterium} + ${loot.deuterium + salvage.deuterium}`,
    }).where(eq(planets.id, destinationPlanetId));
  }
  await recomputePlayerWealth(tx, contribution.playerId);
  const [operation] = await tx
    .select()
    .from(clanWarOperations)
    .where(eq(clanWarOperations.id, contribution.operationId))
    .for('update');
  await notify(tx, {
    playerId: contribution.playerId,
    kind: 'fleet_returned',
    payload: leg === 'BATTLE_RETURN'
      ? {
          trip: 'raid',
          ships: fleetCount(dosed.fleet),
          fromPlanetId: mission.originPlanetId,
          fromPlanetName: operation?.targetPlanetName ?? null,
          lootAlloy: loot.alloy,
          lootCrystal: loot.crystal,
          lootDeuterium: loot.deuterium,
          salvageAlloy: salvage.alloy,
          salvageCrystal: salvage.crystal,
          salvageDeuterium: salvage.deuterium,
          ...dockNotice(landed),
        }
      : { trip: 'recalled', craft: fleetCount(dosed.fleet), craftKind: 'fleet', ...dockNotice(landed) },
    at: now,
    refId: mission.id,
  });
  if (operation) await completeIfSettled(tx, operation, now);
  await publishWar(tx, contribution.clanId);
}

/** Recover one failed leg after its mission has been atomically cancelled. */
export async function abandonClanWarLeg(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  now: Date,
): Promise<void> {
  const [leg] = await tx.select().from(clanWarMissions)
    .where(eq(clanWarMissions.missionId, mission.id)).limit(1);
  if (!leg) throw new Error(`clan war mission ${mission.id} has no leg`);
  const [operation] = await tx.select().from(clanWarOperations)
    .where(eq(clanWarOperations.id, leg.operationId)).for('update');
  if (!operation) throw new Error(`clan war mission ${mission.id} has no operation`);

  if (leg.leg === 'COMBINED_ATTACK') {
    await closeOperation(tx, { operation, reason: 'FAILED', now });
    return;
  }
  if (!leg.contributionId) throw new Error(`clan war ${leg.leg} has no contribution`);
  const [contribution] = await tx.select().from(clanWarContributions)
    .where(eq(clanWarContributions.id, leg.contributionId)).for('update');
  if (!contribution || contribution.status === 'HOME' || contribution.status === 'LOST') return;

  if (leg.leg === 'SUPPORT_OUT') {
    const destinationPlanetId = await safeHomePlanet(
      tx, contribution.playerId, contribution.originPlanetId,
    );
    await landContribution(tx, contribution, contribution.fleet, destinationPlanetId, now);
    await recomputePlayerWealth(tx, contribution.playerId);
    await notify(tx, {
      playerId: contribution.playerId,
      kind: 'fleet_returned',
      payload: { trip: 'recalled', craft: fleetCount(contribution.fleet), craftKind: 'fleet' },
      at: now,
      refId: mission.id,
    });
    await completeIfSettled(tx, operation, now);
    await publishWar(tx, operation.clanId);
    return;
  }
  // The ships flew the leg the worker gave up on, so the dose they took is theirs.
  const [season] = await tx.select({ rulesetVersion: seasons.rulesetVersion }).from(seasons)
    .where(eq(seasons.id, mission.seasonId)).limit(1);
  await resolveReturnArrival(tx, contribution.id, mission, now, leg.leg,
    season?.rulesetVersion ?? MULTI_WORLD.rulesetVersion);
}

/* ── streams ────────────────────────────────────────────────────── */

export async function publishWar(tx: Tx, clanId: string): Promise<void> {
  for (const playerId of await activeClanPlayerIds(tx, clanId)) {
    await publishPrivate(tx, playerId, 'war');
  }
}
