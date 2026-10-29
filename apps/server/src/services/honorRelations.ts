import { and, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { accounts, botProfiles, clanAidCommitments, clanMemberships, players, seasons } from '../db/schema.js';

const RELATION_WINDOW = 7 * 86_400_000;

/** Read at commitment. Never accept client-supplied eligibility or relationship flags. */
export async function readHonorRelations(db: Queryable, input: {
  seasonId: string; attack: readonly string[]; defence: readonly string[];
  at: Date; adminUsernames: ReadonlySet<string>;
}): Promise<{ eligible: boolean; relations: { a: string; b: string; related: boolean }[] }> {
  const time = input.at.getTime();
  if (!Number.isSafeInteger(time) || time < 0) throw new Error('Invalid Honor relationship time');
  const attack = [...new Set(input.attack)].sort(), defence = [...new Set(input.defence)].sort();
  if (attack.length === 0 || attack.some(id => defence.includes(id))) throw new Error('Invalid Honor actor sides');
  const ids = [...new Set([...attack, ...defence])];
  const actors = await db.select({ id: players.id, accountId: players.accountId,
    username: accounts.username, bot: botProfiles.accountId }).from(players)
    .innerJoin(accounts, eq(accounts.id, players.accountId))
    .leftJoin(botProfiles, eq(botProfiles.accountId, players.accountId))
    .where(and(eq(players.seasonId, input.seasonId), inArray(players.id, ids)));
  if (actors.length !== ids.length) throw new Error('Missing or foreign-season Honor actor');
  const [season] = await db.select({ cycleId: seasons.cycleId }).from(seasons).where(eq(seasons.id, input.seasonId));
  if (!season) throw new Error('Missing Honor relationship season');
  // Player identities persist across Silent Space moves within the same cycle.
  // Their actual membership/aid rows prove the relationship, not their location now.
  const historySeasons = db.select({ id: seasons.id }).from(seasons).where(eq(seasons.cycleId, season.cycleId));
  const since = new Date(time - RELATION_WINDOW);
  const [memberships, aid] = await Promise.all([
    db.select().from(clanMemberships).where(and(inArray(clanMemberships.seasonId, historySeasons),
      inArray(clanMemberships.playerId, ids), lte(clanMemberships.joinedAt, input.at),
      or(isNull(clanMemberships.leftAt), gt(clanMemberships.leftAt, since)))),
    db.select({ sender: clanAidCommitments.senderPlayerId, recipient: clanAidCommitments.recipientPlayerId })
      .from(clanAidCommitments).where(and(inArray(clanAidCommitments.seasonId, historySeasons),
        inArray(clanAidCommitments.senderPlayerId, ids), inArray(clanAidCommitments.recipientPlayerId, ids),
        eq(clanAidCommitments.status, 'DELIVERED'), gt(clanAidCommitments.resolvedAt, since),
        lte(clanAidCommitments.resolvedAt, input.at))),
  ]);
  // Owner 2026-10-29: a bot scores like a person so its Honor never gives it away;
  // only a fight with no person in it is ineligible, so bots cannot farm each other.
  const eligible = defence.length > 0 && actors.some(row => row.bot === null)
    && actors.every(row => !input.adminUsernames.has(row.username))
    && new Set(actors.map(row => row.accountId)).size === actors.length;
  const relations = attack.flatMap(a => defence.map(b => {
    const recentClan = memberships.filter(row => row.playerId === a).some(left =>
      memberships.filter(row => row.playerId === b && row.clanId === left.clanId).some(right => {
        const start = Math.max(left.joinedAt.getTime(), right.joinedAt.getTime());
        const end = Math.min(left.leftAt?.getTime() ?? Infinity, right.leftAt?.getTime() ?? Infinity);
        // Half-open membership intervals; equal leave/join times are not shared membership.
        return start <= time && start < end && end > since.getTime();
      }));
    const directAid = aid.some(row => (row.sender === a && row.recipient === b) || (row.sender === b && row.recipient === a));
    return { a, b, related: recentClan || directAid };
  }));
  return { eligible, relations };
}
