import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { settleHold, splitTeamLoot, type SortieOutcome } from '@astera/rules/arena';
import type { Db, Queryable, Tx } from '../db/client.js';
import type { Clock } from '../clock.js';
import { arenaShips, arenaTeamMembers, arenaTeams, clanMemberships, clans } from '../db/schema.js';
import { commander, landArenaCargo, shipFor, ZERO } from './arenaShipState.js';
import { notify } from './notifications.js';
import { GameError, loadLocked, lockSeason } from './planet.js';

export async function activeTeamFor(q: Queryable, playerId: string) {
  return (await q.select({ team: arenaTeams, member: arenaTeamMembers }).from(arenaTeamMembers)
    .innerJoin(arenaTeams, eq(arenaTeams.id, arenaTeamMembers.teamId))
    .where(and(eq(arenaTeamMembers.playerId, playerId), isNull(arenaTeamMembers.releasedAt), inArray(arenaTeams.state, ['forming', 'flying']))))[0];
}

/** A departed member cannot strand a forming reservation. Commit cleanup before taking another clan's locks. */
export async function releaseStaleLobby(db: Db, clock: Clock, accountId: string): Promise<void> {
  await db.transaction(async tx => {
    const who = await commander(tx, accountId); await lockSeason(tx, who.seasonId, false);
    const active = await activeTeamFor(tx, who.playerId);
    if (active?.team.state !== 'forming') return;
    const [team] = await tx.select().from(arenaTeams).where(eq(arenaTeams.id, active.team.id)).for('update');
    if (team?.state !== 'forming') return;
    const [clan] = await tx.select().from(clans).where(eq(clans.id, team.clanId));
    if (!clan || clan.disbandedAt) {
      await tx.update(arenaTeams).set({ state: 'cancelled', finishedAt: clock.now() }).where(eq(arenaTeams.id, team.id));
      await tx.update(arenaTeamMembers).set({ releasedAt: clock.now(), ready: false }).where(eq(arenaTeamMembers.teamId, team.id));
      return;
    }
    const [member] = await tx.select().from(clanMemberships).where(and(eq(clanMemberships.clanId, team.clanId),
      eq(clanMemberships.playerId, who.playerId), isNull(clanMemberships.leftAt)));
    if (!member) await tx.update(arenaTeamMembers).set({ releasedAt: clock.now(), ready: false }).where(eq(arenaTeamMembers.id, active.member.id));
  });
}

/** Caller holds the season and the team. A member who never connected comes home with nothing extracted. */
export async function recallAbsentMember(tx: Tx, memberId: string, teamId: string, now: Date): Promise<void> {
  const [member] = await tx.select().from(arenaTeamMembers).where(eq(arenaTeamMembers.id, memberId));
  if (!member?.sortieId || member.connectedAt || member.outcome !== null) return;
  await tx.update(arenaShips).set({ sortieId: null }).where(and(eq(arenaShips.playerId, member.playerId), eq(arenaShips.sortieId, member.sortieId)));
  await tx.update(arenaTeamMembers).set({ outcome: 'recalled', extracted: { ...ZERO } }).where(eq(arenaTeamMembers.id, member.id));
  await finishTeam(tx, teamId, now);
}

/** The asking commander's own absent reservation, recalled as the sweep would. */
export async function recallLateMember(db: Db, clock: Clock, accountId: string): Promise<void> {
  await db.transaction(async tx => {
    const who = await commander(tx, accountId); await lockSeason(tx, who.seasonId, false);
    const active = await activeTeamFor(tx, who.playerId);
    if (active?.team.state !== 'flying') return;
    await tx.select().from(arenaTeams).where(eq(arenaTeams.id, active.team.id)).for('update');
    await recallAbsentMember(tx, active.member.id, active.team.id, clock.now());
  });
}

/** Caller holds the team row. Only the frozen launched roster divides the pool. */
/** `news` is off only at season close, which deposits every share itself: nothing is left to claim. */
export async function finishTeam(tx: Tx, teamId: string, now: Date, news = true): Promise<void> {
  const members = await tx.select().from(arenaTeamMembers).where(and(eq(arenaTeamMembers.teamId, teamId), isNotNull(arenaTeamMembers.sortieId)));
  if (members.length === 0 || members.some(m => m.outcome === null)) return;
  const shares = splitTeamLoot(members.map(m => ({ playerId: m.playerId, extracted: m.extracted })));
  for (const s of shares) {
    await tx.update(arenaTeamMembers).set({ share: s.share, releasedAt: now, ready: false,
      ...(members.length === 1 ? { claimedAt: now, receipt: { deposit: { ...ZERO }, overflow: { ...ZERO } } } : {}) })
      .where(and(eq(arenaTeamMembers.teamId, teamId), eq(arenaTeamMembers.playerId, s.playerId)));
    // The member who closed the browser learns the share waits; an empty share is not news.
    if (news && members.length > 1 && s.share.alloy + s.share.crystal + s.share.deuterium > 0) {
      await notify(tx, { playerId: s.playerId, kind: 'arena_team_share', refId: teamId, at: now, payload: { teamId, share: s.share } });
    }
  }
  await tx.update(arenaTeams).set({ state: 'finished', finishedAt: now }).where(eq(arenaTeams.id, teamId));
}

/** The ship's successful exit enters this pool instead of the solo deposit path, in the same transaction. */
export async function recordTeamEnd(tx: Tx, teamId: string, playerId: string, outcome: SortieOutcome, hold: readonly number[], now: Date): Promise<void> {
  const extracted = outcome === 'extracted' ? settleHold(hold, { alloy: Number.MAX_SAFE_INTEGER, crystal: Number.MAX_SAFE_INTEGER, deuterium: Number.MAX_SAFE_INTEGER }).deposit : { ...ZERO };
  await tx.update(arenaTeamMembers).set({ outcome, extracted }).where(and(eq(arenaTeamMembers.teamId, teamId),
    eq(arenaTeamMembers.playerId, playerId), isNull(arenaTeamMembers.outcome)));
  await finishTeam(tx, teamId, now);
}

/** Caller already holds the season. Team → ship → capital also serialises concurrent claims and solo exits. */
export async function claimTeamIn(tx: Tx, accountId: string, teamId: string, now: Date) {
  const who = await commander(tx, accountId);
  const [team] = await tx.select().from(arenaTeams).where(and(eq(arenaTeams.id, teamId), eq(arenaTeams.seasonId, who.seasonId))).for('update');
  const [member] = await tx.select().from(arenaTeamMembers).where(and(eq(arenaTeamMembers.teamId, teamId), eq(arenaTeamMembers.playerId, who.playerId)));
  if (!team || member?.sortieId == null) throw new GameError('TEAM_SHARE_NOT_FOUND', 'No share belongs to you in this match', 404);
  if (team.state !== 'finished' || member.share === null) throw new GameError('TEAM_UNFINISHED', 'The team still has ships in the Yarık', 409);
  if (member.claimedAt) return member.receipt ?? { deposit: { ...ZERO }, overflow: { ...ZERO } };
  const [ship] = await shipFor(tx, who.playerId).for('update');
  if (!ship) throw new GameError('NO_SHIP', 'No ship owns this transfer counter', 409);
  // Already earned cargo returns even if the capital is on vacation. It is not a new commitment.
  const planet = await loadLocked(tx, who.capitalId, { now: () => now });
  const receipt = await landArenaCargo(tx, ship, planet, [member.share.alloy, member.share.crystal, member.share.deuterium], now);
  await tx.update(arenaTeamMembers).set({ claimedAt: now, receipt }).where(eq(arenaTeamMembers.id, member.id));
  return receipt;
}

/** A deploy ends unreported team flights but never erases cargo that was already extracted. */
export async function recallTeamFlights(tx: Tx, now: Date, seasonId?: string, cancelLobbies = false): Promise<void> {
  const teams = await tx.select().from(arenaTeams).where(and(seasonId ? eq(arenaTeams.seasonId, seasonId) : undefined,
    inArray(arenaTeams.state, cancelLobbies ? ['forming', 'flying'] : ['flying']))).orderBy(asc(arenaTeams.id)).for('update');
  for (const team of teams) {
    if (team.state === 'forming') {
      await tx.update(arenaTeams).set({ state: 'cancelled', finishedAt: now }).where(eq(arenaTeams.id, team.id));
      await tx.update(arenaTeamMembers).set({ releasedAt: now, ready: false }).where(eq(arenaTeamMembers.teamId, team.id));
      continue;
    }
    const members = await tx.select().from(arenaTeamMembers).where(and(eq(arenaTeamMembers.teamId, team.id), isNotNull(arenaTeamMembers.sortieId), isNull(arenaTeamMembers.outcome)));
    if (members.length > 0) {
      await tx.update(arenaShips).set({ sortieId: null }).where(inArray(arenaShips.playerId, members.map(m => m.playerId).sort()));
      await tx.update(arenaTeamMembers).set({ outcome: 'recalled', extracted: { ...ZERO } })
        .where(and(eq(arenaTeamMembers.teamId, team.id), isNotNull(arenaTeamMembers.sortieId), isNull(arenaTeamMembers.outcome)));
    }
    // Lobbies are cancelled only at season close, which deposits the shares itself.
    await finishTeam(tx, team.id, now, !cancelLobbies);
  }
}
