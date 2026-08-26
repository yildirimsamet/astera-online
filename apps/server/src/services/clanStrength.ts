import { ALL_HULLS, HULLS, type HullId } from '@astera/rules';
import { and, count, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import {
  accounts,
  clanMemberships,
  clans,
  missions,
  planets,
  players,
  units,
} from '../db/schema.js';
import { clanActor } from './clan.js';
import { activeClanMembership } from './clanCombat.js';
import { GameError } from './planet.js';

/**
 * The private, current strength of one clan.
 *
 * The roster is read once and every contribution is then grouped for the whole
 * player-id set. The number of SQL statements is fixed whether the clan has one
 * member or five; adding a seat can never turn this surface into an N+1 query.
 * Units are counted by owner across every location, so a ship remains part of the
 * clan's fleet while it is travelling. Ground hulls are reported separately and
 * never inflate the number labelled "ships".
 */
export async function readClanStrength(db: Db, accountId: string) {
  const actor = await clanActor(db, accountId);
  const membership = await activeClanMembership(db, actor.playerId);
  if (!membership) throw new GameError('NOT_IN_CLAN', 'You do not belong to a clan', 403);

  const [[clan], memberRows] = await Promise.all([
    db.select({
      id: clans.id,
      name: clans.name,
      tag: clans.tag,
      dominionTaken: clans.dominionTaken,
      dominionLost: clans.dominionLost,
    }).from(clans).where(and(
      eq(clans.id, membership.clanId),
      isNull(clans.disbandedAt),
    )).limit(1),
    db.select({
      playerId: clanMemberships.playerId,
      username: accounts.displayName,
      role: clanMemberships.role,
      slot: clanMemberships.slot,
      dominionTaken: players.dominionTaken,
      dominionLost: players.dominionLost,
    })
      .from(clanMemberships)
      .innerJoin(players, eq(clanMemberships.playerId, players.id))
      .innerJoin(accounts, eq(players.accountId, accounts.id))
      .where(and(
        eq(clanMemberships.clanId, membership.clanId),
        isNull(clanMemberships.leftAt),
      ))
      .orderBy(clanMemberships.slot),
  ]);
  if (!clan) throw new GameError('CLAN_NOT_FOUND', 'Clan is no longer active', 404);

  const playerIds = memberRows.map((member) => member.playerId);
  if (playerIds.length === 0) throw new GameError('CLAN_NOT_FOUND', 'Clan has no active members', 404);

  const [unitRows, worldRows, [flightRow]] = await Promise.all([
    db.select({
      playerId: units.ownerPlayerId,
      hull: units.hull,
      value: sql<number>`cast(coalesce(sum(${units.count}), 0) as integer)`,
    }).from(units).where(and(
      inArray(units.ownerPlayerId, playerIds),
      gt(units.count, 0),
    )).groupBy(units.ownerPlayerId, units.hull),
    db.select({
      playerId: planets.controllerPlayerId,
      value: count(),
    }).from(planets).where(inArray(planets.controllerPlayerId, playerIds))
      .groupBy(planets.controllerPlayerId),
    db.select({ value: count() }).from(missions).where(and(
      inArray(missions.ownerPlayerId, playerIds),
      eq(missions.status, 'in_flight'),
    )),
  ]);

  const shipsByPlayer = new Map<string, number>();
  const worldsByPlayer = new Map(
    worldRows.flatMap((row) => row.playerId ? [[row.playerId, row.value] as const] : []),
  );
  const composition = new Map<HullId, number>();
  let ships = 0;
  let fleetValue = 0;
  let groundDefences = 0;

  for (const row of unitRows) {
    if (!row.playerId || row.value <= 0) continue;
    const hull = HULLS[row.hull];
    if (hull.ground) {
      groundDefences += row.value;
      continue;
    }
    ships += row.value;
    fleetValue += row.value * (hull.alloy + hull.crystal + hull.deuterium);
    shipsByPlayer.set(row.playerId, (shipsByPlayer.get(row.playerId) ?? 0) + row.value);
    composition.set(row.hull, (composition.get(row.hull) ?? 0) + row.value);
  }

  const members = memberRows.map((member) => ({
    playerId: member.playerId,
    username: member.username,
    role: member.role,
    dominion: Math.round(member.dominionTaken - member.dominionLost),
    ships: shipsByPlayer.get(member.playerId) ?? 0,
    worlds: worldsByPlayer.get(member.playerId) ?? 0,
  }));

  return {
    clan: { id: clan.id, name: clan.name, tag: clan.tag },
    totals: {
      clanDominion: Math.round(clan.dominionTaken - clan.dominionLost),
      memberDominion: members.reduce((total, member) => total + member.dominion, 0),
      ships,
      fleetValue,
      groundDefences,
      worlds: members.reduce((total, member) => total + member.worlds, 0),
      activeFlights: flightRow?.value ?? 0,
    },
    composition: ALL_HULLS.flatMap((hull) => {
      const value = composition.get(hull) ?? 0;
      return value > 0 ? [{ hull, count: value }] : [];
    }),
    members,
  };
}
