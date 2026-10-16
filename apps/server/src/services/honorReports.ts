import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { honorSoloCredit, isSupportedHonorVersion, honorNumber, honorSharedSide, honorSideParticipantCount } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { honorEvents, honorSeasons, players } from '../db/schema.js';
import { honorEventKey, type HonorEvidence } from './honorAccounting.js';

export interface HonorReportReceipt {
  delta: number;
  reason: 'COMBAT' | 'TACTICAL' | 'WEAK_TARGET' | 'ATTACK_LOSS' | 'NO_GAIN' | 'RELATED' | 'INELIGIBLE'
    | 'TARGET_CHANGED' | 'PARTICIPANT_JOINED_LATE' | 'SHARED_SIDE';
  breakdown?: { teamDelta: number; rawTeamDelta: number; participants: number; contributionPpm: number;
    militaryDamage: number; permanentLoss: number; weakTargetDebit: boolean; sharedPositiveBlocked?: boolean; tactical?: boolean };
}

/** Read the rebuildable journal, never a stale copy in an immutable battle report.
 * Auth is frozen participation below; a move never revokes your own past receipt. */
export async function readHonorReceipts(tx: Tx, playerId: string,
  sources: readonly Pick<HonorEvidence, 'source' | 'id'>[]): Promise<Map<string, HonorReportReceipt>> {
  if (sources.length === 0) return new Map();
  const requested = new Map(sources.map(source => [honorEventKey(source), source]));
  return readReceipts(tx, playerId, or(...[...requested.values()].map(source =>
    and(eq(honorEvents.source, source.source), eq(honorEvents.sourceId, source.id)))));
}

async function readReceipts(tx: Tx, playerId: string, filter: ReturnType<typeof or>) {
  const rows = await tx.select({ evidence: honorEvents.evidence, outcome: honorEvents.outcome, version: honorSeasons.version })
    .from(honorEvents).innerJoin(honorSeasons, eq(honorSeasons.seasonId, honorEvents.seasonId))
    .innerJoin(players, eq(players.id, playerId))
    .where(and(eq(honorSeasons.mode, 'ACTIVE'), eq(honorEvents.ranked, true), filter));
  const receipts = new Map<string, HonorReportReceipt>();
  for (const { evidence, outcome, version } of rows) {
    const attacking = evidence.attack.some(member => member.id === playerId);
    const defending = evidence.defence.some(member => member.id === playerId);
    if (!attacking && !defending) continue;
    const side = attacking ? outcome.attack : outcome.defence;
    const delta = side.shares.find(share => share.actor === playerId)?.points ?? 0;
    const sharedPositiveBlocked = (isSupportedHonorVersion(version) && honorSoloCredit(version)) && honorSharedSide(evidence, attacking ? 'attack' : 'defence');
    const pool = attacking ? outcome.pool.attack : outcome.pool.defence;
    const relations = evidence.relations.filter(relation => attacking ? relation.a === playerId : relation.b === playerId);
    const reason: HonorReportReceipt['reason'] = evidence.exclusion ?? (!evidence.eligible ? 'INELIGIBLE'
      : delta > 0 ? evidence.tactical?.length ? 'TACTICAL' : 'COMBAT'
      : delta < 0 && attacking && pool.exposures.some(exposure => exposure.bullying && exposure.harmFifths > exposure.retaliationSpentFifths) ? 'WEAK_TARGET'
      : delta < 0 ? 'ATTACK_LOSS'
      : sharedPositiveBlocked ? 'SHARED_SIDE'
      : relations.length > 0 && relations.every(relation => relation.related) ? 'RELATED' : 'NO_GAIN');
    const own = attacking ? evidence.attack : evidence.defence;
    const enemy = attacking ? evidence.defence : evidence.attack;
    const totalWeight = pool.weights.reduce((total, row) => total + BigInt(row.weight), 0n);
    const ownWeight = BigInt(pool.weights.find(row => row.actor === playerId)?.weight ?? 0);
    const breakdown = evidence.eligible && !evidence.exclusion && !(defending && evidence.tactical?.length) ? {
      teamDelta: side.total, rawTeamDelta: pool.raw,
      ...(evidence.tactical?.length ? { tactical: true } : {}),
      participants: (isSupportedHonorVersion(version) && honorSoloCredit(version)) ? honorSideParticipantCount(evidence, attacking ? 'attack' : 'defence') : pool.weights.length,
      ...(sharedPositiveBlocked ? { sharedPositiveBlocked: true } : {}),
      contributionPpm: totalWeight === 0n ? 0 : honorNumber(1_000_000n * ownWeight / totalWeight),
      militaryDamage: honorNumber(enemy.reduce((total, row) => total + BigInt(row.combatLoss), 0n)),
      permanentLoss: honorNumber(own.reduce((total, row) => total + BigInt(row.loss), 0n)),
      weakTargetDebit: pool.exposures.some(exposure => exposure.bullying
        && exposure.harmFifths > exposure.retaliationSpentFifths),
    } : undefined;
    receipts.set(honorEventKey(evidence), { delta, reason, ...(breakdown ? { breakdown } : {}) });
  }
  return receipts;
}


/** A bomb's health intervals form one report; never return their private raw damage evidence. */
export async function readRadiationHonorReceipts(tx: Tx, playerId: string,
  flightIds: readonly string[]): Promise<Map<string, HonorReportReceipt>> {
  if (flightIds.length === 0) return new Map();
  const keys = flightIds.map(id => `bomb:${id}`);
  const rows = await tx.select({ id: honorEvents.sourceId, key: sql<string>`${honorEvents.evidence}->>'attackKey'` })
    .from(honorEvents).innerJoin(players, eq(players.id, playerId))
    .where(and(eq(honorEvents.source, 'STRATEGIC_IMPACT'), inArray(sql<string>`${honorEvents.evidence}->>'attackKey'`, keys)));
  const receipts = await readReceipts(tx, playerId, and(eq(honorEvents.source, 'STRATEGIC_IMPACT'),
    inArray(sql<string>`${honorEvents.evidence}->>'attackKey'`, keys)));
  const result = new Map<string, HonorReportReceipt>();
  const sum = (a: number, b: number) => honorNumber(BigInt(a) + BigInt(b));
  for (const row of rows) {
    const next = receipts.get(honorEventKey({ source: 'STRATEGIC_IMPACT', id: row.id }));
    if (!next) continue;
    const id = row.key.slice('bomb:'.length), previous = result.get(id);
    if (!previous) { result.set(id, structuredClone(next)); continue; }
    previous.delta = sum(previous.delta, next.delta);
    previous.reason = previous.delta > 0 ? 'TACTICAL' : previous.delta < 0
      ? previous.reason === 'WEAK_TARGET' || next.reason === 'WEAK_TARGET' ? 'WEAK_TARGET' : 'ATTACK_LOSS' : next.reason;
    if (previous.breakdown && next.breakdown) {
      const a = previous.breakdown, b = next.breakdown;
      a.teamDelta = sum(a.teamDelta, b.teamDelta);
      a.rawTeamDelta = sum(a.rawTeamDelta, b.rawTeamDelta);
      a.participants = Math.max(a.participants, b.participants);
      a.weakTargetDebit ||= b.weakTargetDebit;
    }
  }
  return result;
}
