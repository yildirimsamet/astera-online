import { and, asc, eq, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { CLAN } from '@astera/rules';
import { ARENA_ECONOMY as E, TEAM_CLAIM_DAYS, TEAM_CONNECT_SECONDS, entryOpen, refillCost, shipStats,
  type Tactic, type TeamMemberView, type TeamView } from '@astera/rules/arena';
import type { Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import { accounts, arenaShips, arenaTeamMembers, arenaTeams, clanMemberships, clans, planets, players, seasons } from '../db/schema.js';
import { activeTeamFor, claimTeamIn, recallAbsentMember, recallTeamFlights, releaseStaleLobby } from './arenaTeamLedger.js';
import { commander, shipFor, type ShipRow } from './arenaShipState.js';
import { launchSortieIn, type Launch } from './arenaShips.js';
import { assertWorldOperational, GameError, lockSeason, readPlanetSnapshot } from './planet.js';

const membership = async (q: Queryable, playerId: string) => (await q.select({ clanId: clanMemberships.clanId, role: clanMemberships.role })
  .from(clanMemberships).innerJoin(clans, eq(clans.id, clanMemberships.clanId))
  .where(and(eq(clanMemberships.playerId, playerId), isNull(clanMemberships.leftAt), isNull(clans.disbandedAt))))[0];
const fingerprint = (s: ShipRow | undefined): string => JSON.stringify(s ? [s.ship, s.level, s.abilities, s.fuel, s.ammo,
  s.holdAlloy, s.holdCrystal, s.holdDeuterium, s.readyAt?.toISOString() ?? null, s.sortieId, s.admiralId] : null);

async function readiness(q: Tx, clock: Clock, accountId: string) {
  const who = await commander(q, accountId); const [ship] = await shipFor(q, who.playerId);
  let blocked: string | null = !ship ? 'NO_SHIP' : ship.sortieId ? 'SHIP_FLYING' : ship.admiralId ? 'ADMIRAL_AWAY'
    : ship.readyAt && ship.readyAt > clock.now() ? 'SHIP_NOT_READY' : null;
  if (ship && blocked === null) {
    const capital = await readPlanetSnapshot(q, who.capitalId, clock);
    try { assertWorldOperational(capital); } catch (error) { if (!(error instanceof GameError)) throw error; blocked = error.code; }
    if (capital.buildings.CORE < E.minCore) blocked ??= 'CORE_TOO_LOW';
    if (!entryOpen(capital.seasonEndsAt, clock.now())) blocked ??= 'SEASON_CLOSING';
    if (capital.deuterium + 1e-9 < refillCost(ship.ship, ship.fuel, ship.ammo, ship.level).total) blocked ??= 'NOT_ENOUGH_DEUTERIUM';
  }
  return { who, ship, blocked, fingerprint: fingerprint(ship) };
}

/** Forming rosters track current membership; launched rosters never change. Caller holds the team. */
async function pruneLobby(tx: Tx, teamId: string, clanId: string, now: Date): Promise<void> {
  const current = await tx.select({ id: clanMemberships.playerId }).from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, clanId), isNull(clanMemberships.leftAt)));
  const ids = new Set(current.map(m => m.id));
  const roster = await tx.select().from(arenaTeamMembers).where(and(eq(arenaTeamMembers.teamId, teamId), isNull(arenaTeamMembers.releasedAt)));
  for (const m of roster) if (!ids.has(m.playerId)) await tx.update(arenaTeamMembers).set({ releasedAt: now, ready: false }).where(eq(arenaTeamMembers.id, m.id));
}

async function viewIn(q: Tx, clock: Clock, accountId: string): Promise<TeamView> {
  const who = await commander(q, accountId); const clan = await membership(q, who.playerId);
  const mine = await activeTeamFor(q, who.playerId);
  const team = mine?.team ?? (clan ? (await q.select().from(arenaTeams).where(and(eq(arenaTeams.clanId, clan.clanId),
    inArray(arenaTeams.state, ['forming', 'flying']))))[0] : undefined);
  const claims = await q.select({ teamId: arenaTeams.id, share: arenaTeamMembers.share, at: arenaTeams.finishedAt }).from(arenaTeamMembers)
    .innerJoin(arenaTeams, eq(arenaTeams.id, arenaTeamMembers.teamId)).where(and(eq(arenaTeamMembers.playerId, who.playerId),
      eq(arenaTeams.state, 'finished'), isNull(arenaTeamMembers.claimedAt), isNotNull(arenaTeamMembers.share)))
    .orderBy(asc(arenaTeams.finishedAt)).limit(20);
  let detail: TeamView['team'] = null;
  if (team && (team.state === 'forming' || team.state === 'flying')) {
    const leader = (await q.select({ id: clanMemberships.playerId }).from(clanMemberships).where(and(eq(clanMemberships.clanId, team.clanId),
      eq(clanMemberships.role, 'LEADER'), isNull(clanMemberships.leftAt))))[0]?.id ?? '';
    const rows = await q.select({ m: arenaTeamMembers, accountId: players.accountId, name: accounts.displayName }).from(arenaTeamMembers)
      .innerJoin(players, eq(players.id, arenaTeamMembers.playerId)).innerJoin(accounts, eq(accounts.id, players.accountId))
      .where(and(eq(arenaTeamMembers.teamId, team.id), isNull(arenaTeamMembers.releasedAt))).orderBy(asc(arenaTeamMembers.joinedAt), asc(arenaTeamMembers.playerId));
    const members: TeamMemberView[] = [];
    for (const { m, accountId: memberAccount, name } of rows) {
      const state = await readiness(q, clock, memberAccount);
      const currentClan = team.state === 'forming' ? await membership(q, m.playerId) : null;
      const blocked = team.state === 'forming' && currentClan?.clanId !== team.clanId ? 'NO_CLAN' : state.blocked;
      members.push({ playerId: m.playerId, name, tactic: m.tactic, outcome: m.outcome, blocked,
        ready: m.ready && blocked === null && m.fingerprint === state.fingerprint,
        ship: state.ship ? { class: state.ship.ship, level: state.ship.level, fuel: state.ship.fuel,
          fuelMax: shipStats(state.ship.ship, state.ship.level).fuelTank, readyAt: state.ship.readyAt?.toISOString() ?? null } : null });
    }
    detail = { id: team.id, state: team.state, leaderId: leader, joined: members.some(m => m.playerId === who.playerId), members };
  }
  return { playerId: who.playerId, clanId: clan?.clanId ?? null, capacity: CLAN.maxMembers, canCreate: clan?.role === 'LEADER' && !team,
    team: detail, claims: claims.flatMap(c => c.share && c.at ? [{ teamId: c.teamId, share: c.share, finishedAt: c.at.toISOString(),
      autoAt: new Date(c.at.getTime() + TEAM_CLAIM_DAYS * 86400000).toISOString() }] : []) };
}

export async function readTeam(db: Db, clock: Clock, accountId: string): Promise<TeamView> {
  await releaseStaleLobby(db, clock, accountId);
  return db.transaction(tx => viewIn(tx, clock, accountId));
}

async function clanAction(tx: Tx, accountId: string) {
  const who = await commander(tx, accountId); await lockSeason(tx, who.seasonId);
  const initial = await membership(tx, who.playerId);
  if (!initial) throw new GameError('NO_CLAN', 'Join a clan first', 409);
  await tx.select().from(clans).where(eq(clans.id, initial.clanId)).for('update');
  const clan = await membership(tx, who.playerId);
  if (clan?.clanId !== initial.clanId) throw new GameError('NO_CLAN', 'Your clan changed', 409);
  return { who, clan };
}

async function teamAction(tx: Tx, clock: Clock, accountId: string, teamId: string, leader = false) {
  const actor = await clanAction(tx, accountId);
  if (leader && actor.clan.role !== 'LEADER') throw new GameError('TEAM_LEADER_ONLY', 'Only the current clan leader can do this', 403);
  const [team] = await tx.select().from(arenaTeams).where(and(eq(arenaTeams.id, teamId), eq(arenaTeams.clanId, actor.clan.clanId))).for('update');
  if (!team) throw new GameError('TEAM_NOT_FOUND', 'No team belongs to your clan', 404);
  if (team.state === 'forming') await pruneLobby(tx, team.id, team.clanId, clock.now());
  return { ...actor, team };
}

async function joinIn(tx: Tx, clock: Clock, playerId: string, teamId: string): Promise<void> {
  await shipFor(tx, playerId).for('update');
  const active = await activeTeamFor(tx, playerId);
  if (active?.team.id === teamId) return;
  if (active) throw new GameError('TEAM_ALREADY_JOINED', 'Leave your current team first', 409);
  const [ship] = await shipFor(tx, playerId);
  if (ship?.sortieId) throw new GameError('SHIP_FLYING', 'Return to the hangar before joining', 409);
  const roster = await tx.select().from(arenaTeamMembers).where(and(eq(arenaTeamMembers.teamId, teamId), isNull(arenaTeamMembers.releasedAt)));
  if (roster.length >= CLAN.maxMembers) throw new GameError('TEAM_FULL', 'The team is at clan capacity', 409);
  await tx.insert(arenaTeamMembers).values({ teamId, playerId, joinedAt: clock.now() }).onConflictDoUpdate({
    target: [arenaTeamMembers.teamId, arenaTeamMembers.playerId], set: { releasedAt: null, ready: false, fingerprint: null, joinedAt: clock.now() } });
}

export async function createTeam(db: Db, clock: Clock, accountId: string): Promise<TeamView> {
  await releaseStaleLobby(db, clock, accountId);
  return db.transaction(async tx => {
    const { who, clan } = await clanAction(tx, accountId);
    if (clan.role !== 'LEADER') throw new GameError('TEAM_LEADER_ONLY', 'Only the clan leader opens a lobby', 403);
    const [existing] = await tx.select().from(arenaTeams).where(and(eq(arenaTeams.clanId, clan.clanId), inArray(arenaTeams.state, ['forming', 'flying'])));
    if (!existing) {
      const [team] = await tx.insert(arenaTeams).values({ seasonId: who.seasonId, clanId: clan.clanId, createdAt: clock.now() }).returning();
      if (!team) throw new Error('Team insert returned no row');
      await joinIn(tx, clock, who.playerId, team.id);
    }
    return viewIn(tx, clock, accountId);
  });
}

export async function joinTeam(db: Db, clock: Clock, accountId: string, teamId: string): Promise<TeamView> {
  await releaseStaleLobby(db, clock, accountId);
  return db.transaction(async tx => {
    const { who, team } = await teamAction(tx, clock, accountId, teamId);
    if (team.state !== 'forming') throw new GameError('TEAM_STARTED', 'The launched roster is fixed', 409);
    await joinIn(tx, clock, who.playerId, team.id);
    return viewIn(tx, clock, accountId);
  });
}

export async function leaveTeam(db: Db, clock: Clock, accountId: string, teamId: string, removePlayerId?: string): Promise<TeamView> {
  return db.transaction(async tx => {
    const { who, clan, team } = await teamAction(tx, clock, accountId, teamId, removePlayerId !== undefined);
    if (team.state !== 'forming') throw new GameError('TEAM_STARTED', 'Finish this match before leaving the team', 409);
    if (!removePlayerId && clan.role === 'LEADER') {
      await tx.update(arenaTeams).set({ state: 'cancelled', finishedAt: clock.now() }).where(eq(arenaTeams.id, team.id));
      await tx.update(arenaTeamMembers).set({ releasedAt: clock.now(), ready: false }).where(eq(arenaTeamMembers.teamId, team.id));
    } else await tx.update(arenaTeamMembers).set({ releasedAt: clock.now(), ready: false })
      .where(and(eq(arenaTeamMembers.teamId, team.id), eq(arenaTeamMembers.playerId, removePlayerId ?? who.playerId)));
    return viewIn(tx, clock, accountId);
  });
}

export async function readyTeam(db: Db, clock: Clock, accountId: string, input: { teamId: string; ready: boolean; tactic: Tactic }): Promise<TeamView> {
  return db.transaction(async tx => {
    const { who, team } = await teamAction(tx, clock, accountId, input.teamId);
    if (team.state !== 'forming') throw new GameError('TEAM_STARTED', 'This match already launched', 409);
    const active = await activeTeamFor(tx, who.playerId);
    if (active?.team.id !== team.id) throw new GameError('TEAM_NOT_JOINED', 'Join the lobby first', 409);
    await shipFor(tx, who.playerId).for('update');
    const state = await readiness(tx, clock, accountId);
    if (input.ready && state.blocked) throw new GameError(state.blocked, 'Your ship is not ready for this team', 409);
    await tx.update(arenaTeamMembers).set({ ready: input.ready, fingerprint: input.ready ? state.fingerprint : null, tactic: input.tactic }).where(eq(arenaTeamMembers.id, active.member.id));
    return viewIn(tx, clock, accountId);
  });
}

export async function startTeam(db: Db, clock: Clock, accountId: string, teamId: string): Promise<TeamView> {
  return db.transaction(async tx => {
    // Galaxy clan operations lock planets before clans. Serialize only the joint launch with
    // those season commitments so taking clan → team → all ships/capitals cannot invert them.
    const actor = await commander(tx, accountId);
    await tx.select().from(seasons).where(eq(seasons.id, actor.seasonId)).for('update');
    const { team, who } = await teamAction(tx, clock, accountId, teamId, true);
    if (team.state === 'flying') return viewIn(tx, clock, accountId);
    if (team.state !== 'forming') throw new GameError('TEAM_STARTED', 'This match is closed', 409);
    const roster = await tx.select({ m: arenaTeamMembers, accountId: players.accountId }).from(arenaTeamMembers)
      .innerJoin(players, eq(players.id, arenaTeamMembers.playerId)).where(and(eq(arenaTeamMembers.teamId, team.id), isNull(arenaTeamMembers.releasedAt)))
      .orderBy(asc(arenaTeamMembers.playerId));
    if (roster.length === 0 || roster.length > CLAN.maxMembers) throw new GameError('TEAM_NOT_READY', 'The team roster is empty or oversized', 409);
    if (!roster.some(r => r.m.playerId === who.playerId)) throw new GameError('TEAM_NOT_JOINED', 'Join the launch roster first', 409);
    const ids = roster.map(r => r.m.playerId);
    await tx.select().from(arenaShips).where(inArray(arenaShips.playerId, ids)).orderBy(asc(arenaShips.playerId)).for('update');
    const capitals: string[] = [];
    for (const r of roster) capitals.push((await commander(tx, r.accountId)).capitalId);
    await tx.select().from(planets).where(inArray(planets.id, capitals.sort())).orderBy(asc(planets.id)).for('update');
    for (const r of roster) {
      const state = await readiness(tx, clock, r.accountId);
      if (!r.m.ready || r.m.fingerprint !== state.fingerprint) throw new GameError('TEAM_NOT_READY', 'Every member must confirm this ship', 409);
      if (state.blocked) throw new GameError(state.blocked, 'A member can no longer launch', 409);
    }
    for (const r of roster) {
      const flight = await launchSortieIn(tx, clock, r.accountId, true);
      const launch: Launch = { ...flight, tactic: r.m.tactic, ...(roster.length > 1 ? { teamId: team.id } : {}) };
      await tx.update(arenaTeamMembers).set({ sortieId: launch.sortieId, launch }).where(eq(arenaTeamMembers.id, r.m.id));
    }
    await tx.update(arenaTeams).set({ state: 'flying', solo: roster.length === 1, startedAt: clock.now() }).where(eq(arenaTeams.id, team.id));
    return viewIn(tx, clock, accountId);
  });
}

export async function claimTeamLoot(db: Db, clock: Clock, accountId: string, teamId: string): Promise<TeamView> {
  return db.transaction(async tx => {
    const who = await commander(tx, accountId); await lockSeason(tx, who.seasonId);
    const receipt = await claimTeamIn(tx, accountId, teamId, clock.now());
    return { ...await viewIn(tx, clock, accountId), receipt };
  });
}

/** Explicit observer entry, never a second sortie or a second launch charge. */
export async function spectateTeam(db: Db, clock: Clock, accountId: string): Promise<Launch> {
  return db.transaction(async tx => {
    const who = await commander(tx, accountId); await lockSeason(tx, who.seasonId);
    const active = await activeTeamFor(tx, who.playerId);
    if (active?.team.state !== 'flying' || active.member.outcome === null || !active.member.launch) throw new GameError('TEAM_NOT_SPECTATING', 'No ended team flight can be watched', 409);
    return { ...active.member.launch, spectating: active.member.outcome };
  });
}

/** Before a season snapshot: stop the outstanding team flights, divide durable pools and land every share. */
export async function finishArenaTeamSeason(tx: Tx, clock: Clock, seasonId: string): Promise<void> {
  await recallTeamFlights(tx, clock.now(), seasonId, true);
  const shares = await tx.select({ teamId: arenaTeams.id, accountId: players.accountId }).from(arenaTeamMembers)
    .innerJoin(arenaTeams, eq(arenaTeams.id, arenaTeamMembers.teamId)).innerJoin(players, eq(players.id, arenaTeamMembers.playerId))
    .where(and(eq(arenaTeams.seasonId, seasonId), eq(arenaTeams.state, 'finished'), isNull(arenaTeamMembers.claimedAt), isNotNull(arenaTeamMembers.share)))
    .orderBy(asc(arenaTeams.id), asc(arenaTeamMembers.playerId));
  for (const s of shares) await claimTeamIn(tx, s.accountId, s.teamId, clock.now());
}

/** Bounded housekeeping in the arena process: absent reservations and seven-day shares are both durable. */
export async function housekeepArenaTeams(db: Db, clock: Clock): Promise<void> {
  const now = clock.now();
  const absent = await db.select({ id: arenaTeamMembers.id, teamId: arenaTeams.id, seasonId: arenaTeams.seasonId }).from(arenaTeamMembers)
    .innerJoin(arenaTeams, eq(arenaTeams.id, arenaTeamMembers.teamId)).where(and(eq(arenaTeams.state, 'flying'),
      lte(arenaTeams.startedAt, new Date(now.getTime() - TEAM_CONNECT_SECONDS * 1000)), isNotNull(arenaTeamMembers.sortieId), isNull(arenaTeamMembers.connectedAt), isNull(arenaTeamMembers.outcome)))
    .orderBy(asc(arenaTeams.id)).limit(50);
  for (const a of absent) await db.transaction(async tx => {
    await lockSeason(tx, a.seasonId, false);
    await tx.select().from(arenaTeams).where(eq(arenaTeams.id, a.teamId)).for('update');
    await recallAbsentMember(tx, a.id, a.teamId, now);
  });
  const due = await db.select({ teamId: arenaTeams.id, seasonId: arenaTeams.seasonId, accountId: players.accountId }).from(arenaTeamMembers)
    .innerJoin(arenaTeams, eq(arenaTeams.id, arenaTeamMembers.teamId)).innerJoin(players, eq(players.id, arenaTeamMembers.playerId))
    .where(and(eq(arenaTeams.state, 'finished'), lte(arenaTeams.finishedAt, new Date(now.getTime() - TEAM_CLAIM_DAYS * 86400000)), isNull(arenaTeamMembers.claimedAt), isNotNull(arenaTeamMembers.share)))
    .orderBy(asc(arenaTeams.id), asc(arenaTeamMembers.playerId)).limit(50);
  for (const s of due) await db.transaction(async tx => {
    const season = await lockSeason(tx, s.seasonId, false);
    if (season.status === 'live') await claimTeamIn(tx, s.accountId, s.teamId, now);
  });
}
