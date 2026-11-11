import { and, eq, isNull, lte, ne } from 'drizzle-orm';
import { clanAlarmUnlocked, clanDefenseApplies, supportAccepted, type DefencePosture } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { accounts, clanAlarms, clanMemberships, players, seasons } from '../db/schema.js';
import { postClanEvent } from './clanChatEvents.js';
import { activeClanMembership } from './clanCombat.js';
import { clanLevelOf } from './clanPerks.js';
import { notify } from './notifications.js';

/**
 * KLAN ALARMI — a clanmate's radar heard a raid, and the clan hears it too (F2, owner 2026-11-10).
 *
 * The card is the host's own `incoming_fleet` warning, word for word, plus who and where: the
 * radar is what heard it, so a world without one raises nothing and every clanmate reads exactly
 * what the host's instrument could tell. It is a call for support, so a world whose door is shut
 * raises nothing, and only a member who could answer — a settled one — is called. One per raid.
 */
export async function raiseClanAlarm(tx: Tx, input: {
  seasonId: string;
  missionId: string;
  arriveAt: Date;
  host: { playerId: string; planetId: string; posture: DefencePosture };
  warning: Record<string, unknown>;
  now: Date;
}): Promise<void> {
  if (!supportAccepted(input.host.posture)) return;
  const membership = await activeClanMembership(tx, input.host.playerId);
  if (!membership) return;
  const [season] = await tx.select({ rulesetVersion: seasons.rulesetVersion }).from(seasons)
    .where(eq(seasons.id, input.seasonId));
  if (!season || !clanDefenseApplies(season.rulesetVersion)) return;
  const level = await clanLevelOf(tx, membership.clanId);
  if (level === null || !clanAlarmUnlocked(level)) return;

  const [raised] = await tx.insert(clanAlarms).values({
    seasonId: input.seasonId,
    clanId: membership.clanId,
    missionId: input.missionId,
    hostPlayerId: input.host.playerId,
    hostPlanetId: input.host.planetId,
    arriveAt: input.arriveAt,
    createdAt: input.now,
  }).onConflictDoNothing({ target: clanAlarms.missionId }).returning({ id: clanAlarms.id });
  if (!raised) return;

  // The card and the clan's room name the host: whose world is under attack.
  const [host] = await tx.select({ name: accounts.displayName }).from(players)
    .innerJoin(accounts, eq(accounts.id, players.accountId)).where(eq(players.id, input.host.playerId));
  const hostName = host?.name ?? '';
  const members = await tx.select({ playerId: clanMemberships.playerId }).from(clanMemberships).where(and(
    eq(clanMemberships.clanId, membership.clanId),
    isNull(clanMemberships.leftAt),
    ne(clanMemberships.playerId, input.host.playerId),
    lte(clanMemberships.matureAt, input.now),
  ));
  for (const member of members) {
    await notify(tx, {
      playerId: member.playerId,
      kind: 'clan_alarm',
      payload: {
        ...input.warning,
        alarmId: raised.id,
        hostPlayerId: input.host.playerId,
        hostPlanetId: input.host.planetId,
        hostName,
      },
      at: input.now,
      refId: input.missionId,
    });
  }
  // F2 E2: the call is posted to the clan's room too, under the host's name.
  await postClanEvent(tx, {
    clanId: membership.clanId,
    seasonId: input.seasonId,
    authorPlayerId: input.host.playerId,
    event: { kind: 'ALARM', params: {
      hostName,
      hostPlanetName: typeof input.warning.targetPlanetName === 'string' ? input.warning.targetPlanetName : '',
      arriveAt: input.arriveAt.toISOString(),
    } },
    now: input.now,
  });
}
