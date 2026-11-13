import { and, eq, gt, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { HONOR_HISTORY_HOURS } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { accounts, botProfiles, clanAidCommitments, clanMemberships, honorEvents, players, seasons } from '../db/schema.js';

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

/** Table 33: the attacker/defender pairs that already met in a raid during the day before
 * `at`, as `[a, b]` keys. Read from the Honor journal, so a rebuild sees what was frozen.
 * A commander who only stood in somebody else's line was not the one raided. */
export async function readRepeatRaids(db: Queryable, input: {
  seasonId: string; attack: readonly string[]; defence: readonly string[]; at: Date; except?: string;
}): Promise<Set<string>> {
  const raids = await db.select({ evidence: honorEvents.evidence }).from(honorEvents).where(and(
    eq(honorEvents.seasonId, input.seasonId), inArray(honorEvents.source, ['WORLD', 'CLAN_WAR']),
    gt(honorEvents.at, new Date(input.at.getTime() - HONOR_HISTORY_HOURS * 3_600_000)), lte(honorEvents.at, input.at),
    ...(input.except === undefined ? [] : [ne(honorEvents.sourceId, input.except)]),
    or(...input.attack.map(id => sql`${honorEvents.evidence}->'attack' @> ${JSON.stringify([{ id }])}::jsonb`))));
  const pairs = new Set<string>();
  for (const { evidence } of raids) {
    for (const a of input.attack) {
      if (!evidence.attack.some(row => row.id === a)) continue;
      for (const b of input.defence) {
        if (evidence.selectedDefenders?.includes(b) && evidence.defence.some(row => row.id === b)) pairs.add(JSON.stringify([a, b]));
      }
    }
  }
  return pairs;
}
