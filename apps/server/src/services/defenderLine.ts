import { and, eq, inArray } from 'drizzle-orm';
import {
  clanDefenseApplies,
  combatValue,
  fleetCount,
  fleetEntries,
  hangarLoad,
  normalizeLots,
  normalizeHpDamage,
  partitionCombatFleet,
  shipDamageApplies,
  withinTierBand,
  type HpDamageLot,
  type DefenderOutcome,
  type DefenderStack,
  type Fleet,
  type HullId,
  type Resources,
  type SupportFactor,
  supportAccepted,
  supportFactor,
  type EscapeOutcome,
} from '@astera/rules';
import type { Tx } from '../db/client.js';
import { accounts, clanSupportBattleResults, clanSupportWaves, players } from '../db/schema.js';
import { postClanEvent } from './clanChatEvents.js';
import { activeClanMembership } from './clanCombat.js';
import { loseWave, lockWaves, publishSupport, returnWave, shipsOf, supportFlightTech } from './clanSupport.js';
import type { WaveRow } from './clanSupportView.js';
import { notify } from './notifications.js';
import { recomputePlayerWealth, setUnits, type LockedPlanet } from './planet.js';
import { peakCoreLevels } from './player.js';
import { admiralForFlight, recordAdmiralBattle, reportAdmirals } from './admiral.js';
import { withAdmiral, type AdmiralSnapshot } from '@astera/rules/arena';
import type { ReportAdmiral } from '../db/schema.js';

/**
 * KLAN SAVUNMA DESTEĞİ — THE DEFENDING LINE, WHOEVER HOLDS IT. Plan §Server.
 *
 * The ordinary raid (`worker/handlers.ts`) and a clan's joint war
 * (`clanWarSettlement.ts`) both fight a world, and both read the clanmates' waves
 * standing at it through here, so the line is assembled once and settled once:
 *
 *   1. `lockStationsAt` — the STATIONED waves at the world, locked after the world and
 *      before any clan or player row (season → planets → waves → clans → players);
 *   2. `standStations` — each wave re-checked at the instant of the fight: same clan,
 *      inside the host's tier band, the world still taking support. One that fails goes
 *      home untouched before a shot (owner K3); the rest become owned stacks;
 *   3. `foughtStations` — the waves that fought: none when the line lifted together (F1);
 *   4. `settleStations` — each wave's survivors and damage written back to its own row;
 *   5. `supportFactorOf` / `writeDefenderResults` / `notifySupporters`, or
 *      `notifyLiftedSupporters` when the line ran.
 */

export interface Station {
  wave: WaveRow;
  fleet: Fleet;
  stack: DefenderStack;
  /** `combatValue` the wave brought — its Dominion weight (owner K6). */
  power: number;
  /** The commander ship standing with this wave (Y9): it lends its bonus and is never hit. */
  escort: AdmiralSnapshot | null;
}

/** The report's escort lines for the defending line. */
export const stationAdmirals = (stations: readonly Station[]): ReportAdmiral[] =>
  stations.flatMap((station) => reportAdmirals('defence', station.escort));

export async function lockStationsAt(
  tx: Tx,
  input: { hostPlanetId: string; rulesetVersion: number },
): Promise<WaveRow[]> {
  if (!clanDefenseApplies(input.rulesetVersion)) return [];
  const candidates = await tx.select({ id: clanSupportWaves.id }).from(clanSupportWaves)
    .where(and(eq(clanSupportWaves.hostPlanetId, input.hostPlanetId), eq(clanSupportWaves.status, 'STATIONED')));
  if (candidates.length === 0) return [];
  return (await lockWaves(tx, candidates.map((row) => row.id)))
    .filter((wave) => wave.status === 'STATIONED' && wave.hostPlanetId === input.hostPlanetId);
}

/** The commanders a battle must lock a ledger for, beyond attacker and host. */
export const supporterIdsOf = (waves: readonly WaveRow[]): string[] =>
  [...new Set(waves.map((wave) => wave.senderPlayerId))].sort();

export async function standStations(
  tx: Tx,
  input: { waves: readonly WaveRow[]; host: LockedPlanet; rulesetVersion: number; now: Date },
): Promise<Station[]> {
  if (input.waves.length === 0) return [];
  if (!supportAccepted(input.host.defencePosture)) {
    for (const wave of input.waves) await returnWave(tx, wave, 'HOST_CLOSED', input.now);
    return [];
  }
  const senders = supporterIdsOf(input.waves);
  const [peaks, hostMembership] = await Promise.all([
    peakCoreLevels(tx, [input.host.playerId, ...senders]),
    activeClanMembership(tx, input.host.playerId),
  ]);
  const hostPeak = peaks.get(input.host.playerId) ?? 1;
  const damageRule = shipDamageApplies(input.rulesetVersion);
  const stations: Station[] = [];
  for (const wave of input.waves) {
    if (wave.hostPlayerId !== input.host.playerId) {
      await returnWave(tx, wave, 'WORLD_CHANGED', input.now);
      continue;
    }
    const membership = await activeClanMembership(tx, wave.senderPlayerId);
    if (membership?.clanId !== wave.clanId || hostMembership?.clanId !== wave.clanId) {
      await returnWave(tx, wave, 'MEMBERSHIP', input.now);
      continue;
    }
    if (!withinTierBand(peaks.get(wave.senderPlayerId) ?? 1, hostPeak)) {
      await returnWave(tx, wave, 'BAND', input.now);
      continue;
    }
    const fleet = await shipsOf(tx, wave);
    if (fleetCount(fleet) === 0) {
      await loseWave(tx, wave, input.now);
      continue;
    }
    const lots = !damageRule ? [] : normalizeHpDamage(fleet, wave.damage);
    const ready = partitionCombatFleet(fleet, lots);
    const escort = await admiralForFlight(tx, 'defence', wave.id);
    stations.push({
      wave,
      fleet,
      power: combatValue(ready.eligible),
      escort: escort && { ship: escort.ship, level: escort.level },
      stack: {
        stackId: wave.id,
        playerId: wave.senderPlayerId,
        fleet: ready.eligible,
        tech: withAdmiral({ tech: await supportFlightTech(tx, wave) }, escort),
        ...(ready.damage.length > 0 ? { damage: ready.damage } : {}),
      },
    });
  }
  return stations;
}

/**
 * THE WAVES THAT FOUGHT. When the whole line lifted (F1, owner 2026-11-10) the guns fought
 * alone: no wave took a shot, so none is settled, weighed into D or written as a result —
 * the battle books as an unsupported one (D = 1) and every wave stands exactly as it was.
 */
export const foughtStations = (stations: readonly Station[], escape: EscapeOutcome | null): readonly Station[] =>
  escape?.kind === 'ESCAPED' ? [] : stations;

/** One for the host, plus one per commander who stood at least one ship in the line. */
export const defenderCountOf = (stations: readonly Station[]): number =>
  1 + new Set(stations.filter((station) => fleetCount(station.stack.fleet) > 0).map((s) => s.wave.senderPlayerId)).size;

/** The whole line as it stood: the host's own and every wave's ships. */
export function lineOf(hostLine: Fleet, stations: readonly Station[]): Fleet {
  const out: Fleet = { ...hostLine };
  for (const station of stations) {
    for (const [hull, n] of fleetEntries(station.stack.fleet)) out[hull] = (out[hull] ?? 0) + n;
  }
  return out;
}

/** Each wave's survivors and damage written back to its own row; a wiped wave is lost. */
export async function settleStations(
  tx: Tx,
  input: { stations: readonly Station[]; outcomes: readonly DefenderOutcome[]; damageRule: boolean; now: Date;
    /** What the battle meant to an escort (`escortedBattle('defence', result)`). */
    battle: { lost: boolean; lostValue: number } },
): Promise<void> {
  for (const station of input.stations) {
    const outcome = input.outcomes.find((row) => row.stackId === station.wave.id);
    if (!outcome) throw new Error(`support wave ${station.wave.id} left the battle unrecorded`);
    // Before a lost wave releases its escort: a decisive defeat is what sends it to repair.
    if (fleetCount(station.stack.fleet) > 0) await recordAdmiralBattle(tx, 'defence', station.wave.id, input.battle);
    const excluded = partitionCombatFleet(station.fleet, station.wave.damage);
    const physical: Fleet = { ...outcome.survivors };
    for (const [hull, count] of fleetEntries(excluded.excluded)) physical[hull] = (physical[hull] ?? 0) + count;
    if (fleetCount(physical) === 0) {
      await loseWave(tx, station.wave, input.now);
      continue;
    }
    // Every hull the wave stood with is written, so one wiped out is zeroed rather than kept.
    const remaining: Fleet = {};
    for (const hull of Object.keys(station.fleet) as HullId[]) remaining[hull] = physical[hull] ?? 0;
    await setUnits(tx, station.wave.originPlanetId, remaining, station.wave.unitLocation, station.wave.senderPlayerId);
    const wounds = normalizeHpDamage(physical, [...outcome.survivorDamage, ...excluded.excludedDamage]);
    const damage = input.damageRule
      ? (wounds.length > 0 ? wounds : null)
      : station.wave.damage;
    await tx.update(clanSupportWaves).set({
      damage,
      reservedBulk: hangarLoad(physical),
      battles: station.wave.battles + (fleetCount(station.stack.fleet) > 0 ? 1 : 0),
    }).where(eq(clanSupportWaves.id, station.wave.id));
    await recomputePlayerWealth(tx, station.wave.senderPlayerId, input.now);
    await publishSupport(tx, station.wave);
  }
}

/** Each supporting commander's waves summed — the unit the ladder and the report use. */
function bySupporter(stations: readonly Station[], outcomes: readonly DefenderOutcome[]) {
  const rows = new Map<string, {
    playerId: string;
    power: number;
    sent: Fleet;
    losses: Fleet;
    survivors: Fleet;
    lossValue: number;
    damage: HpDamageLot[];
  }>();
  const add = (into: Fleet, from: Fleet) => {
    for (const [hull, n] of fleetEntries(from)) into[hull] = (into[hull] ?? 0) + n;
  };
  for (const station of stations) {
    if (fleetCount(station.stack.fleet) === 0) continue;
    const outcome = outcomes.find((row) => row.stackId === station.wave.id);
    const row = rows.get(station.wave.senderPlayerId) ?? {
      playerId: station.wave.senderPlayerId, power: 0, sent: {}, losses: {}, survivors: {}, lossValue: 0, damage: [],
    };
    row.power += station.power;
    add(row.sent, station.stack.fleet);
    if (outcome) {
      add(row.losses, outcome.losses);
      add(row.survivors, outcome.survivors);
      row.lossValue += outcome.lossValue;
      row.damage.push(...outcome.survivorDamage);
    }
    rows.set(row.playerId, row);
  }
  return [...rows.values()].sort((a, b) => (a.playerId < b.playerId ? -1 : 1));
}

/**
 * HOW MUCH THIS LINE'S SUPPORT MULTIPLIES THE HOST'S DOMINION. Owner decision, 2026-10-02.
 *
 * `hostPower` is the host's own line as it stood — ships and the guns that fired — and the
 * support is every wave's ships; see `supportFactor`. Only the host's ledger moves.
 */
export const supportFactorOf = (hostPower: number, stations: readonly Station[]): SupportFactor =>
  supportFactor({ hostPower, supportPower: stations.reduce((sum, station) => sum + station.power, 0) });

/**
 * WHAT THE SUPPORTERS' SHIPS WERE WORTH WHEN THEY DIED — the part of the exchange written at
 * face value, never multiplied (owner decision (b), `defendedTransfer`).
 */
export function supportLossOf(stations: readonly Station[], outcomes: readonly DefenderOutcome[]): number {
  let total = 0;
  for (const station of stations) {
    total += outcomes.find((row) => row.stackId === station.wave.id)?.lossValue ?? 0;
  }
  return total;
}

/** The report's per-commander rows: who stood, what they lost, what the ladder said. */
export async function writeDefenderResults(
  tx: Tx,
  input: {
    seasonId: string;
    reportId: string;
    host: { playerId: string; outcome: DefenderOutcome; power: number; lootLost: Resources };
    stations: readonly Station[];
    outcomes: readonly DefenderOutcome[];
    /** What the host's ledger moved by; a supporter's never moves (owner, 2026-10-02). */
    hostDelta: number;
    now: Date;
  },
): Promise<void> {
  await tx.insert(clanSupportBattleResults).values([
    {
      seasonId: input.seasonId,
      reportId: input.reportId,
      playerId: input.host.playerId,
      role: 'HOST' as const,
      sent: input.host.outcome.sent,
      losses: input.host.outcome.losses,
      survivors: input.host.outcome.survivors,
      power: input.host.power,
      lossValue: input.host.outcome.lossValue,
      damage: input.host.outcome.survivorDamage,
      lootLost: input.host.lootLost,
      dominionDelta: input.hostDelta,
      createdAt: input.now,
    },
    ...bySupporter(input.stations, input.outcomes).map((row) => ({
      seasonId: input.seasonId,
      reportId: input.reportId,
      playerId: row.playerId,
      role: 'SUPPORT' as const,
      sent: row.sent,
      losses: row.losses,
      survivors: row.survivors,
      power: row.power,
      lossValue: row.lossValue,
      damage: row.damage.some((lot) => lot.remainderBp !== undefined) ? normalizeHpDamage(row.survivors, row.damage) : normalizeLots(row.damage),
      dominionDelta: 0,
      createdAt: input.now,
    })),
  ]);
}

/** Every supporter hears their wave fought, with the way into the report. */
export async function notifySupporters(
  tx: Tx,
  input: {
    missionId: string;
    reportId: string;
    grade: string;
    hostPlanetId: string;
    hostPlanetName: string;
    stations: readonly Station[];
    outcomes: readonly DefenderOutcome[];
    /** Attacking ships destroyed, for the clan room's line. */
    attackerLost: number;
    now: Date;
  },
): Promise<void> {
  const supporters = bySupporter(input.stations, input.outcomes);
  for (const row of supporters) {
    await notify(tx, {
      playerId: row.playerId,
      kind: 'clan_support_result',
      payload: {
        reportId: input.reportId,
        grade: input.grade,
        hostPlanetId: input.hostPlanetId,
        hostPlanetName: input.hostPlanetName,
        lost: fleetCount(row.losses),
        survived: fleetCount(row.survivors),
      },
      at: input.now,
      refId: input.missionId,
    });
  }
  const first = input.stations[0]?.wave;
  if (!first || supporters.length === 0) return;
  // F2 E2: the clan's room hears how the line held, under the host's name; a repelled raid names
  // the supporter who brought the most ships.
  const hero = input.grade === 'REPELLED'
    ? [...supporters].sort((a, b) => fleetCount(b.sent) - fleetCount(a.sent) || (a.playerId < b.playerId ? -1 : 1))[0]
    : undefined;
  const people = await tx.select({ playerId: players.id, name: accounts.displayName }).from(players)
    .innerJoin(accounts, eq(accounts.id, players.accountId))
    .where(inArray(players.id, [first.hostPlayerId, ...(hero ? [hero.playerId] : [])]));
  const nameOf = (playerId: string) => people.find((row) => row.playerId === playerId)?.name ?? '';
  await postClanEvent(tx, {
    clanId: first.clanId,
    seasonId: first.seasonId,
    authorPlayerId: first.hostPlayerId,
    event: { kind: 'DEFENCE', params: {
      hostName: nameOf(first.hostPlayerId), hostPlanetName: input.hostPlanetName, grade: input.grade,
      supporters: supporters.length, attackerLost: input.attackerLost, heroName: hero ? nameOf(hero.playerId) : null,
    } },
    now: input.now,
  });
}

/**
 * EVERY SUPPORTER WHOSE WAVE LIFTED WITH THE LINE HEARS IT ONCE (F1). Nothing of theirs fought,
 * so there is no battle report for them to read — only that the wave ran and still stands.
 */
export async function notifyLiftedSupporters(
  tx: Tx,
  input: {
    missionId: string;
    hostPlanetId: string;
    hostPlanetName: string;
    stations: readonly Station[];
    escape: EscapeOutcome | null;
    now: Date;
  },
): Promise<void> {
  if (input.escape?.kind !== 'ESCAPED') return;
  const lifted = new Set((input.escape.support ?? []).map((row) => row.stackId));
  const waves = new Map<string, number>();
  for (const station of input.stations) {
    if (!lifted.has(station.wave.id)) continue;
    waves.set(station.wave.senderPlayerId, (waves.get(station.wave.senderPlayerId) ?? 0) + fleetCount(station.fleet));
  }
  for (const [playerId, ships] of [...waves].sort(([a], [b]) => (a < b ? -1 : 1))) {
    await notify(tx, {
      playerId,
      kind: 'clan_support_lifted',
      payload: { hostPlanetId: input.hostPlanetId, hostPlanetName: input.hostPlanetName, ships },
      at: input.now,
      refId: input.missionId,
    });
  }
}
