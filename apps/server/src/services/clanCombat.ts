import { and, count, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm';
import { ABUSE, CLAN } from '@astera/rules';
import { addMinutes } from '../clock.js';
import type { Queryable, Tx } from '../db/client.js';
import {
  attackCommitments,
  clanCeasefires,
  clanMemberships,
  clanRaidRoster,
  clans,
  players,
} from '../db/schema.js';
import { GameError } from './planet.js';

export interface ClanMembershipSnapshot {
  clanId: string;
  playerId: string;
  slot: number;
  role: 'LEADER' | 'MEMBER';
  joinedAt: Date;
  matureAt: Date;
  aidEnabled: boolean;
  aidPolicyChangedAt: Date;
  lastChatReadAt: Date | null;
}

/** Player locks are the common serialization point between recruitment and hostility. */
export async function lockClanPlayers(tx: Tx, playerIds: readonly string[]): Promise<void> {
  for (const playerId of [...new Set(playerIds)].sort()) {
    await tx.select({ id: players.id }).from(players).where(eq(players.id, playerId)).for('update');
  }
}

export async function activeClanMembership(
  db: Queryable,
  playerId: string,
): Promise<ClanMembershipSnapshot | null> {
  const [row] = await db
    .select({
      clanId: clanMemberships.clanId,
      playerId: clanMemberships.playerId,
      slot: clanMemberships.slot,
      role: clanMemberships.role,
      joinedAt: clanMemberships.joinedAt,
      matureAt: clanMemberships.matureAt,
      aidEnabled: clanMemberships.aidEnabled,
      aidPolicyChangedAt: clanMemberships.aidPolicyChangedAt,
      lastChatReadAt: clanMemberships.lastChatReadAt,
    })
    .from(clanMemberships)
    .innerJoin(clans, and(eq(clanMemberships.clanId, clans.id), isNull(clans.disbandedAt)))
    .where(and(eq(clanMemberships.playerId, playerId), isNull(clanMemberships.leftAt)))
    .limit(1);
  return row ?? null;
}

export const membershipIsMature = (
  membership: ClanMembershipSnapshot | null,
  now: Date,
): membership is ClanMembershipSnapshot => membership !== null && membership.matureAt <= now;

export const canonicalPlayerPair = (a: string, b: string): [string, string] =>
  a < b ? [a, b] : [b, a];

/** Must be called after both player rows are locked. */
export async function assertClanHostilityAllowed(
  tx: Tx,
  attackerPlayerId: string,
  targetPlayerId: string,
  now: Date,
): Promise<void> {
  if (attackerPlayerId === targetPlayerId) {
    throw new GameError('SELF_ATTACK', 'You cannot attack your own commander', 403);
  }
  const [attacker, target] = await Promise.all([
    activeClanMembership(tx, attackerPlayerId),
    activeClanMembership(tx, targetPlayerId),
  ]);
  if (attacker?.clanId !== undefined && attacker.clanId === target?.clanId) {
    throw new GameError('CLAN_FRIENDLY_FIRE', 'Clanmates cannot target each other', 403);
  }

  const [low, high] = canonicalPlayerPair(attackerPlayerId, targetPlayerId);
  const [ceasefire] = await tx
    .select({ endsAt: clanCeasefires.endsAt })
    .from(clanCeasefires)
    .where(and(
      eq(clanCeasefires.playerLowId, low),
      eq(clanCeasefires.playerHighId, high),
      gt(clanCeasefires.endsAt, now),
    ))
    .limit(1);
  if (ceasefire) {
    throw new GameError('CLAN_CEASEFIRE', 'Former clanmates are under ceasefire', 403, {
      until: ceasefire.endsAt.toISOString(),
    });
  }
}

export interface PreparedClanAttack {
  quotaClanId: string | null;
  attackerClanId: string | null;
  defenderClanId: string | null;
  attackerScoreClanId: string | null;
  defenderScoreClanId: string | null;
  lootRoster: { clanId: string; playerId: string; slot: number }[];
  personalRecent: number;
}

/**
 * Locks and validates both launch quotas, then freezes the membership facts that
 * later settlement is allowed to use. The transaction keeps advisory locks until commit.
 */
export async function prepareClanAttack(
  tx: Tx,
  input: { seasonId: string; attackerPlayerId: string; targetPlayerId: string; now: Date },
): Promise<PreparedClanAttack> {
  await lockClanPlayers(tx, [input.attackerPlayerId, input.targetPlayerId]);
  await assertClanHostilityAllowed(tx, input.attackerPlayerId, input.targetPlayerId, input.now);

  const [attackerMembership, defenderMembership] = await Promise.all([
    activeClanMembership(tx, input.attackerPlayerId),
    activeClanMembership(tx, input.targetPlayerId),
  ]);
  const since = addMinutes(input.now, -ABUSE.bashWindowMinutes);

  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`personal-attack:${input.attackerPlayerId}:${input.targetPlayerId}`}))`);
  const [personal] = await tx
    .select({ value: count() })
    .from(attackCommitments)
    .where(and(
      eq(attackCommitments.attackerPlayerId, input.attackerPlayerId),
      eq(attackCommitments.targetPlayerId, input.targetPlayerId),
      gt(attackCommitments.launchedAt, since),
    ));
  const personalRecent = personal?.value ?? 0;
  if (personalRecent >= ABUSE.bashLimit) {
    throw new GameError('BASH_LIMIT', 'You have hit that commander too many times recently', 403, {
      limit: ABUSE.bashLimit,
      hours: ABUSE.bashWindowMinutes / 60,
    });
  }

  if (attackerMembership) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`clan-attack:${attackerMembership.clanId}:${input.targetPlayerId}`}))`);
    // The clan ceiling has its own window, and it is not the personal bash window.
    // They are both twelve hours today; reading one off the other is how they stop
    // agreeing the first time either moves.
    const clanSince = addMinutes(input.now, -CLAN.attackWindowMinutes);
    const [clanRecent] = await tx
      .select({ value: count() })
      .from(attackCommitments)
      .where(and(
        eq(attackCommitments.quotaClanId, attackerMembership.clanId),
        eq(attackCommitments.targetPlayerId, input.targetPlayerId),
        gt(attackCommitments.launchedAt, clanSince),
      ));
    if ((clanRecent?.value ?? 0) >= CLAN.attackLimit) {
      throw new GameError('CLAN_ATTACK_LIMIT', 'Your clan has reached its attack limit for that commander', 403, {
        limit: CLAN.attackLimit,
        hours: CLAN.attackWindowMinutes / 60,
      });
    }
  }

  let lootRoster: PreparedClanAttack['lootRoster'] = [];
  if (membershipIsMature(attackerMembership, input.now)) {
    const rows = await tx
      .select({
        clanId: clanMemberships.clanId,
        playerId: clanMemberships.playerId,
        slot: clanMemberships.slot,
      })
      .from(clanMemberships)
      .where(and(
        eq(clanMemberships.clanId, attackerMembership.clanId),
        isNull(clanMemberships.leftAt),
        lte(clanMemberships.matureAt, input.now),
      ));
    if (rows.length >= CLAN.minimumLootRoster) lootRoster = rows;
  }

  return {
    quotaClanId: attackerMembership?.clanId ?? null,
    attackerClanId: attackerMembership?.clanId ?? null,
    defenderClanId: defenderMembership?.clanId ?? null,
    attackerScoreClanId: membershipIsMature(attackerMembership, input.now)
      ? attackerMembership.clanId
      : null,
    defenderScoreClanId: membershipIsMature(defenderMembership, input.now)
      ? defenderMembership.clanId
      : null,
    lootRoster,
    personalRecent,
  };
}

export async function recordClanAttack(
  tx: Tx,
  input: PreparedClanAttack & {
    missionId: string;
    seasonId: string;
    attackerPlayerId: string;
    targetPlayerId: string;
    now: Date;
  },
): Promise<void> {
  await tx.insert(attackCommitments).values({
    seasonId: input.seasonId,
    missionId: input.missionId,
    attackerPlayerId: input.attackerPlayerId,
    targetPlayerId: input.targetPlayerId,
    quotaClanId: input.quotaClanId,
    attackerClanId: input.attackerClanId,
    defenderClanId: input.defenderClanId,
    attackerScoreClanId: input.attackerScoreClanId,
    defenderScoreClanId: input.defenderScoreClanId,
    launchedAt: input.now,
    expiresAt: addMinutes(input.now, CLAN.attackWindowMinutes),
  });
  if (input.lootRoster.length > 0) {
    await tx.insert(clanRaidRoster).values(input.lootRoster.map((member) => ({
      missionId: input.missionId,
      clanId: member.clanId,
      playerId: member.playerId,
      slot: member.slot,
    })));
  }
}

/**
 * First membership adopts live clanless launches so join cannot reset the aggregate
 * ceiling. It touches `quotaClanId` ONLY: `attackerClanId` is what a battle report
 * reads, and a report describes the launch rather than the launcher's later choices.
 */
export async function bindOpenAttacksToClan(
  tx: Tx,
  playerId: string,
  clanId: string,
  now: Date,
): Promise<void> {
  await tx
    .update(attackCommitments)
    .set({ quotaClanId: clanId })
    .where(and(
      eq(attackCommitments.attackerPlayerId, playerId),
      isNull(attackCommitments.quotaClanId),
      gt(attackCommitments.expiresAt, now),
    ));
}

export async function activeClanPlayerIds(tx: Queryable, clanId: string): Promise<string[]> {
  const rows = await tx
    .select({ playerId: clanMemberships.playerId })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, clanId), isNull(clanMemberships.leftAt)));
  return rows.map((row) => row.playerId);
}

/** Used by accept to surface missions that cannot be cancelled by recruitment. */
export async function hasHostileFlightWithClan(
  tx: Queryable,
  candidatePlayerId: string,
  memberPlayerIds: readonly string[],
): Promise<boolean> {
  if (memberPlayerIds.length === 0) return false;
  const rows = await tx.execute<{ exists: boolean }>(sql`
    select exists (
      select 1
      from missions m
      join planets target on target.id = m.target_planet_id
      where m.status = 'in_flight'
        and m.parent_mission_id is null
        and m.kind in ('attack', 'probe', 'death_star')
        and (
          (m.owner_player_id = ${candidatePlayerId}
            and target.player_id in (${sql.join(memberPlayerIds.map((id) => sql`${id}::uuid`), sql`, `)}))
          or
          (m.owner_player_id in (${sql.join(memberPlayerIds.map((id) => sql`${id}::uuid`), sql`, `)})
            and target.player_id = ${candidatePlayerId})
        )
    ) as exists
  `);
  return rows[0]?.exists ?? false;
}

/** Convenience for reclaim/wipe code that needs every player tied to a clan. */
export const membershipsForPlayers = (tx: Queryable, playerIds: string[]) => tx
  .select()
  .from(clanMemberships)
  .where(and(inArray(clanMemberships.playerId, playerIds), isNull(clanMemberships.leftAt)));
