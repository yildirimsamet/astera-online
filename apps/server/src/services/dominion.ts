import { MULTI_WORLD, dominion as ledgerDominion } from '@astera/rules';
import { and, asc, desc, eq, notInArray, sql } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { clans, planets, players } from '../db/schema.js';

/** Canonical integer score expressions used by every public projection. */
export const playerDominionSql = sql<number>`
  ${players.dominionTaken} - ${players.dominionLost}
`.mapWith(Number);
export const clanDominionSql = sql<number>`
  ${clans.dominionTaken} - ${clans.dominionLost}
`.mapWith(Number);

/** Add two monotonic Dominion counters without ever rounding through `number`. */
export function addDominionCounters(
  left: number,
  right: number,
  label = 'Dominion counter sum',
): number {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) {
    throw new RangeError(`${label} is outside the safe integer range`);
  }
  if (left < 0 || right < 0) {
    throw new RangeError(`${label} requires non-negative counters`);
  }
  const exact = BigInt(left) + BigInt(right);
  if (exact > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${label} is outside the safe integer range`);
  }
  return Number(exact);
}

export function dominionScore(taken: number, lost: number): number {
  return ledgerDominion({ taken, lost });
}

/** Sum signed Dominion scores without lossy intermediate `number` arithmetic. */
export function sumDominionScores(
  values: readonly number[],
  label = 'Dominion score sum',
): number {
  let exact = 0n;
  for (const value of values) {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`${label} is outside the safe integer range`);
    }
    exact += BigInt(value);
  }
  if (
    exact > BigInt(Number.MAX_SAFE_INTEGER)
    || exact < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new RangeError(`${label} is outside the safe integer range`);
  }
  return Number(exact);
}

/** Descending score order without subtracting two opposite safe-integer extremes. */
export function compareDominionScoresDescending(left: number, right: number): number {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) {
    throw new RangeError('Dominion score is outside the safe integer range');
  }
  return left === right ? 0 : right > left ? 1 : -1;
}

/** The same eligible top-three ordering used by the ladder, without operator accounts. */
export async function dominionPodium(
  db: Queryable,
  seasonId: string,
  excludedPlayerIds: ReadonlySet<string>,
): Promise<Map<string, 1 | 2 | 3>> {
  const rows = await db
    .select({ playerId: players.id })
    .from(players)
    .innerJoin(
      planets,
      and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')),
    )
    .where(and(
      eq(players.seasonId, seasonId),
      excludedPlayerIds.size > 0
        ? notInArray(players.id, [...excludedPlayerIds])
        : undefined,
    ))
    .orderBy(desc(playerDominionSql), asc(players.joinedAt), asc(players.id))
    .limit(3);
  return new Map(rows.map((row, index) => [row.playerId, (index + 1) as 1 | 2 | 3]));
}

/** Replace cached all-player podium marks with the competition-eligible podium. */
export function applyDominionPodium<World extends {
  controller: { kind: string; playerId?: string };
  dominionRank?: 1 | 2 | 3;
}>(worlds: readonly World[], podium: ReadonlyMap<string, 1 | 2 | 3>): World[] {
  return worlds.map((world) => {
    const { dominionRank: _discarded, ...withoutRank } = world;
    if (world.controller.kind !== 'PLAYER' || world.controller.playerId === undefined) {
      return withoutRank as World;
    }
    const rank = podium.get(world.controller.playerId);
    return (rank === undefined ? withoutRank : { ...withoutRank, dominionRank: rank }) as World;
  });
}

interface DominionLedgerRow {
  playerId: string;
  taken: number;
  lost: number;
}

interface DominionEventRow {
  attackerPlayerId: string;
  defenderPlayerId: string | null;
  dominionSwing: number | null;
  dominionRuleVersion: number | null;
  dominionLootValue: number | null;
  dominionAttackerLossValue: number | null;
  dominionDefenderLossValue: number | null;
  dominionRawExchange: number | null;
  dominionEligible: boolean | null;
}

interface ClanDominionLedgerRow {
  clanId: string;
  taken: number;
  lost: number;
}

interface ClanDominionEventRow {
  clanId: string;
  dominionDelta: number;
}

const addMovement = (
  ledger: { taken: number; lost: number },
  movement: number,
): void => {
  if (movement >= 0) {
    ledger.taken = addDominionCounters(
      ledger.taken,
      movement,
      'Dominion audit failed: accumulated movement',
    );
  } else {
    ledger.lost = addDominionCounters(
      ledger.lost,
      -movement,
      'Dominion audit failed: accumulated movement',
    );
  }
};

/**
 * Reproduce v7 ledgers from their immutable score journal before final ranks freeze.
 *
 * A player keeps the same id and balance while D174 moves them between MAIN and
 * Silent Space, so `events` must cover the whole cycle while `roster` is the
 * local galaxy being frozen. This is intentionally a hard assertion: silently
 * publishing a rank that cannot be explained by its reports would make the
 * competitive record untrustworthy.
 */
export function assertDominionLedgers(
  roster: readonly DominionLedgerRow[],
  events: readonly DominionEventRow[],
  rulesetVersion: number,
): void {
  if (rulesetVersion < MULTI_WORLD.dominionLinearRulesetVersion) return;

  const expected = new Map(roster.map((player) => [
    player.playerId,
    { taken: 0, lost: 0 },
  ]));

  for (const event of events) {
    const attacker = expected.get(event.attackerPlayerId);
    const defender = event.defenderPlayerId === null
      ? undefined
      : expected.get(event.defenderPlayerId);
    if (!attacker && !defender) continue;

    const equationDetail = [
      event.dominionLootValue,
      event.dominionAttackerLossValue,
      event.dominionDefenderLossValue,
      event.dominionRawExchange,
    ];
    // The explicit marker survives room moves and operator configuration changes;
    // a zero with blank detail alone is never enough to infer an exemption.
    if (event.dominionEligible === false) {
      if (
        event.defenderPlayerId === null
        || event.dominionSwing !== 0
        || event.dominionRuleVersion !== rulesetVersion
        || equationDetail.some((value) => value !== null)
      ) {
        throw new Error('Dominion audit failed: invalid competition exemption');
      }
      continue;
    }
    if (event.dominionEligible !== true) {
      throw new Error('Dominion audit failed: a v7 event has no eligibility marker');
    }
    const audit = [event.dominionSwing, event.dominionRuleVersion, ...equationDetail];
    if (event.defenderPlayerId === null || audit.some((value) => value === null)) {
      throw new Error('Dominion audit failed: a scored v7 event has incomplete audit data');
    }
    const [swing, rule, loot, attackerLoss, defenderLoss, raw] = audit as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    if (
      !audit.every((value) => Number.isSafeInteger(value))
      || rule !== rulesetVersion
      || loot < 0
      || attackerLoss < 0
      || defenderLoss < 0
    ) {
      throw new Error('Dominion audit failed: a scored v7 event does not reproduce its transfer');
    }
    // Keep the audit as exact as the rule that produced the row. All operands are
    // safe integers here, but an intermediate `number` sum can cross 2^53 before
    // the subtraction brings the result back into range and silently lose one.
    const exactRaw = BigInt(loot) + BigInt(defenderLoss) - BigInt(attackerLoss);
    if (exactRaw !== BigInt(raw) || raw !== swing) {
      throw new Error('Dominion audit failed: a scored v7 event does not reproduce its transfer');
    }

    if (attacker) addMovement(attacker, swing);
    if (defender) addMovement(defender, -swing);
  }

  for (const player of roster) {
    const reproduced = expected.get(player.playerId)!;
    if (
      !Number.isSafeInteger(player.taken)
      || !Number.isSafeInteger(player.lost)
      || reproduced.taken !== player.taken
      || reproduced.lost !== player.lost
    ) {
      throw new Error(`Dominion audit failed: player ${player.playerId} ledger does not match journal`);
    }
  }
}

/** Reproduce every active clan cache from its immutable per-mission event log. */
export function assertClanDominionLedgers(
  roster: readonly ClanDominionLedgerRow[],
  events: readonly ClanDominionEventRow[],
  rulesetVersion: number,
): void {
  if (rulesetVersion < MULTI_WORLD.dominionLinearRulesetVersion) return;

  const expected = new Map(roster.map((clan) => [
    clan.clanId,
    { taken: 0, lost: 0 },
  ]));
  for (const event of events) {
    const ledger = expected.get(event.clanId);
    if (!ledger) continue;
    if (!Number.isSafeInteger(event.dominionDelta)) {
      throw new Error('Clan Dominion audit failed: event is outside the safe integer range');
    }
    addMovement(ledger, event.dominionDelta);
  }

  for (const clan of roster) {
    const reproduced = expected.get(clan.clanId)!;
    if (
      !Number.isSafeInteger(clan.taken)
      || !Number.isSafeInteger(clan.lost)
      || reproduced.taken !== clan.taken
      || reproduced.lost !== clan.lost
    ) {
      throw new Error(`Clan Dominion audit failed: clan ${clan.clanId} cache does not match events`);
    }
  }
}
