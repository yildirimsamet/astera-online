import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { fleetCount, type Resources } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import {
  accounts,
  clanAidCommitments,
  clanMemberships,
  clanSupportWaves,
  clanTreasuryEvents,
  clanWarContributions,
  players,
} from '../db/schema.js';
import type { ClanActor } from './clan.js';
import { requireMemberClan } from './clanTreasury.js';

/**
 * KATKI DEFTERİ — who carries the clan this season (F2 P6, owner 2026-11-10).
 *
 * Owner: "Kim ne yapıyor görünür olsun. Böylece oyuncular kendini sorumlu hisseder." Every current
 * member's season, read from the rows the actions already wrote: the purse's audit, the support
 * waves, the aid commitments and the joint-war contributions. Members only, like the purse.
 * `towardNext` is what each member has given since the last rung was bought — the purse bar's split.
 */
export interface ClanLedgerMember {
  playerId: string;
  name: string;
  donated: Resources;
  towardNext: Resources;
  supportWaves: number;
  supportShips: number;
  supportBattles: number;
  alarmAnswers: number;
  aidSent: number;
  jointWar: number;
}

const none = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });

export async function readClanLedger(db: Queryable, actor: ClanActor): Promise<{ members: ClanLedgerMember[] }> {
  const clan = await requireMemberClan(db, actor);
  const people = await db.select({ playerId: clanMemberships.playerId, name: accounts.displayName })
    .from(clanMemberships)
    .innerJoin(players, eq(players.id, clanMemberships.playerId))
    .innerJoin(accounts, eq(accounts.id, players.accountId))
    .where(and(eq(clanMemberships.clanId, clan.id), isNull(clanMemberships.leftAt)));
  const ids = people.map((person) => person.playerId);
  const [purse, waves, aid, war] = await Promise.all([
    db.select().from(clanTreasuryEvents).where(eq(clanTreasuryEvents.clanId, clan.id))
      .orderBy(desc(clanTreasuryEvents.createdAt), desc(clanTreasuryEvents.id)),
    db.select({
      senderPlayerId: clanSupportWaves.senderPlayerId, fleet: clanSupportWaves.fleet,
      battles: clanSupportWaves.battles, alarmId: clanSupportWaves.alarmId,
    }).from(clanSupportWaves).where(and(eq(clanSupportWaves.clanId, clan.id), inArray(clanSupportWaves.senderPlayerId, ids))),
    db.select({ senderPlayerId: clanAidCommitments.senderPlayerId }).from(clanAidCommitments)
      .where(and(eq(clanAidCommitments.clanId, clan.id), inArray(clanAidCommitments.senderPlayerId, ids))),
    db.select({ playerId: clanWarContributions.playerId }).from(clanWarContributions)
      .where(and(eq(clanWarContributions.clanId, clan.id), inArray(clanWarContributions.playerId, ids))),
  ]);
  // Newest first, so everything before the first LEVEL_UP met is the purse now being filled.
  const lastRung = purse.findIndex((event) => event.kind === 'LEVEL_UP');
  const filling = lastRung === -1 ? purse : purse.slice(0, lastRung);
  const add = (into: Resources, event: Resources) => {
    into.alloy += event.alloy; into.crystal += event.crystal; into.deuterium += event.deuterium;
  };
  return {
    members: people.map(({ playerId, name }) => {
      const donated = none();
      const towardNext = none();
      for (const event of purse) if (event.kind === 'DONATION' && event.actorPlayerId === playerId) add(donated, event);
      for (const event of filling) if (event.kind === 'DONATION' && event.actorPlayerId === playerId) add(towardNext, event);
      const mine = waves.filter((wave) => wave.senderPlayerId === playerId);
      return {
        playerId,
        name,
        donated,
        towardNext,
        supportWaves: mine.length,
        supportShips: mine.reduce((sum, wave) => sum + fleetCount(wave.fleet), 0),
        supportBattles: mine.reduce((sum, wave) => sum + wave.battles, 0),
        alarmAnswers: mine.filter((wave) => wave.alarmId !== null).length,
        aidSent: aid.filter((row) => row.senderPlayerId === playerId).length,
        jointWar: war.filter((row) => row.playerId === playerId).length,
      };
    }),
  };
}
