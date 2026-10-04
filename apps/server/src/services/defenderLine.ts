import { and, eq } from 'drizzle-orm';
import {
  clanDefenseApplies,
  combatValue,
  fleetCount,
  fleetEntries,
  hangarLoad,
  normalizeLots,
  normalizeHpDamage,
  hpRadiationApplies,
  shipDamageApplies,
  withinTierBand,
  type HpDamageLot,
  type DefenderOutcome,
  type DefenderStack,
  type Fleet,
  type HullId,
  type Resources,
  type SupportFactor,
  supportFactor,
} from '@astera/rules';
import type { Tx } from '../db/client.js';
import { clanSupportBattleResults, clanSupportWaves } from '../db/schema.js';
import { activeClanMembership } from './clanCombat.js';
import { loseWave, lockWaves, publishSupport, returnWave, shipsOf, supportFlightTech } from './clanSupport.js';
import type { WaveRow } from './clanSupportView.js';
import { notify } from './notifications.js';
import { recomputePlayerWealth, setUnits, type LockedPlanet } from './planet.js';
import { peakCoreLevels } from './player.js';

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
 *      inside the host's tier band, the world still at SUPPORT. One that fails goes home
 *      untouched before a shot (owner K3); the rest become owned stacks;
 *   3. `settleStations` — each wave's survivors and damage written back to its own row;
 *   4. `supportFactorOf` / `writeDefenderResults` / `notifySupporters`.
 */

export interface Station {
  wave: WaveRow;
  fleet: Fleet;
  stack: DefenderStack;
  /** `combatValue` the wave brought — its Dominion weight (owner K6). */
  power: number;
}

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
  if (input.host.defencePosture !== 'SUPPORT') {
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
    const lots = !damageRule ? [] : hpRadiationApplies(input.rulesetVersion)
      ? normalizeHpDamage(fleet, wave.damage) : normalizeLots(wave.damage);
    stations.push({
      wave,
      fleet,
      power: combatValue(fleet),
      stack: {
        stackId: wave.id,
        playerId: wave.senderPlayerId,
        fleet,
        tech: { tech: await supportFlightTech(tx, wave) },
        ...(lots.length > 0 ? { damage: lots } : {}),
      },
    });
  }
  return stations;
}

/** One for the host, plus one per commander who stood at least one ship in the line. */
export const defenderCountOf = (stations: readonly Station[]): number =>
  1 + new Set(stations.filter((station) => fleetCount(station.fleet) > 0).map((s) => s.wave.senderPlayerId)).size;

/** The whole line as it stood: the host's own and every wave's ships. */
export function lineOf(hostLine: Fleet, stations: readonly Station[]): Fleet {
  const out: Fleet = { ...hostLine };
  for (const station of stations) {
    for (const [hull, n] of fleetEntries(station.fleet)) out[hull] = (out[hull] ?? 0) + n;
  }
  return out;
}

/** Each wave's survivors and damage written back to its own row; a wiped wave is lost. */
export async function settleStations(
  tx: Tx,
  input: { stations: readonly Station[]; outcomes: readonly DefenderOutcome[]; damageRule: boolean; now: Date },
): Promise<void> {
  for (const station of input.stations) {
    const outcome = input.outcomes.find((row) => row.stackId === station.wave.id);
    if (!outcome) throw new Error(`support wave ${station.wave.id} left the battle unrecorded`);
    if (fleetCount(outcome.survivors) === 0) {
      await loseWave(tx, station.wave, input.now);
      continue;
    }
    // Every hull the wave stood with is written, so one wiped out is zeroed rather than kept.
    const remaining: Fleet = {};
    for (const hull of Object.keys(station.fleet) as HullId[]) remaining[hull] = outcome.survivors[hull] ?? 0;
    await setUnits(tx, station.wave.originPlanetId, remaining, station.wave.unitLocation, station.wave.senderPlayerId);
    const damage = input.damageRule
      ? (outcome.survivorDamage.length > 0 ? outcome.survivorDamage : null)
      : station.wave.damage;
    await tx.update(clanSupportWaves).set({
      damage,
      reservedBulk: hangarLoad(outcome.survivors),
      battles: station.wave.battles + 1,
    }).where(eq(clanSupportWaves.id, station.wave.id));
    await recomputePlayerWealth(tx, station.wave.senderPlayerId);
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
    const outcome = outcomes.find((row) => row.stackId === station.wave.id);
    const row = rows.get(station.wave.senderPlayerId) ?? {
      playerId: station.wave.senderPlayerId, power: 0, sent: {}, losses: {}, survivors: {}, lossValue: 0, damage: [],
    };
    row.power += station.power;
    add(row.sent, station.fleet);
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
    now: Date;
  },
): Promise<void> {
  for (const row of bySupporter(input.stations, input.outcomes)) {
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
}
