import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import {
  allocateMonumentDominion,
  battleDominion,
  fleetCount,
  hangarLoad,
  lootMonumentDeuterium,
  resolveMonumentCombat,
  seededFrom,
  selectMonumentHold,
  splitMonumentBattleSurvivors,
  type Fleet,
  type HpDamageLot,
  type MonumentShipLot,
} from '@astera/rules';
import type { Queryable, Tx } from '../db/client.js';
import { accounts, clans, clanScoreEvents, monumentBattles, monumentBattleParticipants, monumentProbes, monuments, monumentWaves, players, type planets } from '../db/schema.js';
import { adminPlayerIdsInSeason } from './admin.js';
import { addDominionCounters } from './dominion.js';
import { lockMonument, settleLockedMonument, type LockedMonument } from './monument.js';
import { beginMonumentReturn, replaceWaveLots, saveWave, settleMonumentFlight } from './monumentMovement.js';
import { lockWorlds, safeHomePlanet } from './ownership.js';
import { GameError, recomputePlayerWealth } from './planet.js';
import { publish, publishShard } from '../stream/bus.js';
import { restoreMonumentGarrison } from './monumentBoundaries.js';
import { observeLockedMonumentProbe } from './monumentProbe.js';
import { completeMonumentJoint } from './monumentJoint.js';
import { notify } from './notifications.js';

type Wave = typeof monumentWaves.$inferSelect;
type Battle = typeof monumentBattles.$inferSelect;
interface World { id: string; x: number; y: number; z: number }
const fleetOf = (lots: readonly { hull: MonumentShipLot['hull']; count: number }[]): Fleet => {
  const fleet: Fleet = {};
  for (const lot of lots) fleet[lot.hull] = (fleet[lot.hull] ?? 0) + lot.count;
  return fleet;
};

/** A target can eject any participating wave. Discover and lock every endpoint before it. */
export async function monumentEndpoints(tx: Queryable, monumentIds: readonly string[]) {
  const discovered = await tx.select().from(monumentWaves).where(and(inArray(monumentWaves.monumentId, [...monumentIds]),
    inArray(monumentWaves.status, ['OUTBOUND', 'HOLD', 'RETURNING'])));
  const probes = await tx.select().from(monumentProbes).where(and(inArray(monumentProbes.monumentId, [...monumentIds]),
    inArray(monumentProbes.status, ['OUTBOUND', 'RETURNING'])));
  const homeIds = new Map<string, string>();
  for (const wave of discovered) homeIds.set(wave.id, await safeHomePlanet(tx, wave.playerId, wave.originPlanetId));
  for (const probe of probes) homeIds.set(probe.id, await safeHomePlanet(tx, probe.playerId, probe.originPlanetId));
  return { homeIds, planetIds: [...new Set([...discovered.map((wave) => wave.originPlanetId), ...probes.map((probe) => probe.originPlanetId), ...homeIds.values()])] };
}

export async function monumentHomes(tx: Queryable, locked: LockedMonument, homeIds: ReadonlyMap<string, string>, worlds: ReadonlyMap<string, typeof planets.$inferSelect>): Promise<Map<string, World>> {
  const homes = new Map<string, World>();
  for (const wave of locked.waves) {
    const homeId = homeIds.get(wave.id);
    const home = homeId === undefined ? undefined : worlds.get(homeId);
    if (!worlds.has(wave.originPlanetId) || home?.controllerPlayerId !== wave.playerId
      || await safeHomePlanet(tx, wave.playerId, wave.originPlanetId) !== home.id) {
      throw new GameError('PLACEMENT_CHANGED', 'The arriving fleet changed; refresh and try again', 409);
    }
    homes.set(wave.id, home);
  }
  return homes;
}

async function lockArrival(tx: Tx, monumentId: string) {
  const endpoints = await monumentEndpoints(tx, [monumentId]);
  const worlds = endpoints.planetIds.length === 0 ? new Map<string, typeof planets.$inferSelect>() : await lockWorlds(tx, endpoints.planetIds);
  const locked = await lockMonument(tx, monumentId);
  return { locked, homes: await monumentHomes(tx, locked, endpoints.homeIds, worlds) };
}

async function saveControl(tx: Tx, locked: LockedMonument): Promise<void> {
  const m = locked.monument;
  await tx.update(monuments).set({ controllerPlayerId: m.controllerPlayerId, controllerClanId: m.controllerClanId,
    emptySince: m.emptySince, generation: m.generation, garrison: m.garrison, garrisonDamage: m.garrisonDamage })
    .where(eq(monuments.id, m.id));
}

function friendly(locked: LockedMonument, wave: Wave): boolean {
  return locked.monument.controllerPlayerId === wave.playerId
    || (locked.monument.controllerClanId !== null && locked.memberships.get(wave.playerId) === locked.monument.controllerClanId);
}

async function finishDeadWave(tx: Tx, wave: Wave, at: Date): Promise<void> {
  wave.status = 'LOST';
  wave.resolvedAt = at;
  wave.reservedBulk = 0;
  wave.generation += 1;
  await saveWave(tx, wave);
}

async function chooseHold(tx: Tx, locked: LockedMonument, homes: ReadonlyMap<string, World>, incomingWaves: readonly Wave[], at: Date): Promise<void> {
  // A friendly arrival may join the side, but it never re-auctions ships that
  // already paid for HOLD. The tier/power selector is only allowed to choose
  // among this arrival's own lots; otherwise a late reinforcement could evict
  // an earlier holder (and silently change that player's production share).
  const existingHoldIds = new Set(locked.waves.filter((wave) => wave.status === 'HOLD').map((wave) => wave.id));
  const incomingIds = new Set(incomingWaves.map((wave) => wave.id));
  for (const incoming of incomingWaves) {
    incoming.status = 'HOLD';
    incoming.heldAt = at;
    incoming.radiationSettledAt = at;
    incoming.reservedBulk = 0;
    incoming.generation += 1;
    await saveWave(tx, incoming);
  }
  const existingLots = locked.lots.filter((lot) => existingHoldIds.has(lot.waveId));
  const existingBulk = existingLots.reduce((sum, lot) => sum + hangarLoad({ [lot.hull]: lot.count }), 0);
  // Friendly outbound reinforcements already reserve capacity. An attack that
  // was launched before control changed made no reservation and is handled as
  // a normal incoming wave, so it can only use what remains at this instant.
  const reservedBulk = locked.waves.filter((wave) => !incomingIds.has(wave.id)
    && wave.status === 'OUTBOUND' && wave.purpose === 'REINFORCE' && friendly(locked, wave))
    .reduce((sum, wave) => sum + wave.reservedBulk, 0);
  const available = Math.max(0, locked.monument.capacity - existingBulk - reservedBulk);
  const incomingLots = locked.lots.filter((lot) => incomingIds.has(lot.waveId));
  const excess = new Map(selectMonumentHold(incomingLots, available).choices.map((choice) => [choice.lotId, choice.returnCount]));
  for (const wave of incomingWaves.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    const selections = incomingLots.filter((lot) => lot.waveId === wave.id && (excess.get(lot.id) ?? 0) > 0)
      .map((lot) => ({ lotId: lot.id, count: excess.get(lot.id)! }));
    if (selections.length === 0) continue;
    const home = homes.get(wave.id);
    if (!home) throw new GameError('PLACEMENT_CHANGED', 'The return world changed; refresh and try again', 409);
    await beginMonumentReturn(tx, locked, wave, selections, home, at, 'CAPACITY');
  }
  // This also runs for friendly reinforcements. A newcomer was absent from the
  // original hostile launch; the unique notice key preserves existing warnings.
  const holders = new Set(locked.waves.filter((wave) => wave.status === 'HOLD').map((wave) => wave.playerId));
  for (const pending of locked.waves.filter((wave) => wave.status === 'OUTBOUND' && wave.purpose === 'ATTACK'
    && wave.arriveAt !== null && wave.arriveAt > at && !friendly(locked, wave))) {
    for (const playerId of holders) await notify(tx, { playerId, kind: 'monument_inbound', at, refId: pending.id,
      payload: { targetKind: 'MONUMENT', monumentId: locked.monument.id, monumentOrdinal: locked.monument.ordinal,
        waveId: pending.id, arriveAt: pending.arriveAt!.toISOString() } });
  }
}

async function bookPersonalScore(tx: Tx, playerId: string, delta: number): Promise<void> {
  if (delta === 0) return;
  const [player] = await tx.select().from(players).where(eq(players.id, playerId));
  if (!player) throw new GameError('PLACEMENT_CHANGED', 'A battle participant changed; refresh and try again', 409);
  await tx.update(players).set(delta > 0
    ? { dominionTaken: addDominionCounters(player.dominionTaken, delta) }
    : { dominionLost: addDominionCounters(player.dominionLost, -delta) }).where(eq(players.id, player.id));
}

/** Membership clans and players were already locked in that order by lockMonument. */
async function bookClanScores(tx: Tx, locked: LockedMonument, battle: Battle, participants: readonly (typeof monumentBattleParticipants.$inferInsert)[]): Promise<void> {
  for (const side of ['ATTACK', 'DEFENCE'] as const) {
    const ids = [...new Set(participants.filter((row) => row.side === side && row.clanId).map((row) => row.clanId!))].sort();
    for (const clanId of ids) {
      const delta = participants.filter((row) => row.side === side && row.clanId === clanId).reduce((sum, row) => sum + row.dominionDelta, 0);
      const [written] = await tx.insert(clanScoreEvents).values({ seasonId: locked.season.id, missionId: battle.triggerWaveId,
        clanId, side, dominionDelta: delta, createdAt: battle.createdAt }).onConflictDoNothing().returning();
      if (!written) continue;
      const [clan] = await tx.select().from(clans).where(eq(clans.id, clanId));
      if (!clan) throw new GameError('PLACEMENT_CHANGED', 'A battle clan changed; refresh and try again', 409);
      await tx.update(clans).set(delta >= 0
        ? { dominionTaken: addDominionCounters(clan.dominionTaken, delta) }
        : { dominionLost: addDominionCounters(clan.dominionLost, -delta) }).where(eq(clans.id, clanId));
    }
  }
}

async function battleAt(tx: Tx, locked: LockedMonument, incomingWaves: readonly Wave[], homes: ReadonlyMap<string, World>, at: Date, adminUsernames: ReadonlySet<string>): Promise<Battle> {
  const incoming = incomingWaves[0]!;
  const incomingIds = new Set(incomingWaves.map((wave) => wave.id));
  const aBefore = locked.lots.filter((lot) => incomingIds.has(lot.waveId));
  const defenders = locked.waves.filter((wave) => wave.status === 'HOLD');
  const defenderIds = new Set(defenders.map((wave) => wave.id));
  const dBefore = locked.lots.filter((lot) => defenderIds.has(lot.waveId));
  const neutral = dBefore.length === 0 && fleetCount(locked.monument.garrison) > 0;
  const result = resolveMonumentCombat(aBefore.map((lot) => ({ contributionId: lot.id, playerId: lot.playerId,
    fleet: { [lot.hull]: lot.count }, damage: [lot], tech: { tech: lot.tech } })),
  neutral ? [{ stackId: `neutral:${locked.monument.id}`, playerId: `neutral:${locked.monument.id}`,
    fleet: locked.monument.garrison, damage: locked.monument.garrisonDamage, tech: { tech: locked.monument.garrisonTech } }]
    : dBefore.map((lot) => ({ stackId: lot.id, playerId: lot.playerId, fleet: { [lot.hull]: lot.count }, damage: [lot], tech: { tech: lot.tech } })),
  seededFrom('monument-battle', incoming.id));
  const survivors: MonumentShipLot[] = [];
  const aDead: MonumentShipLot[] = [];
  const dDead: MonumentShipLot[] = [];
  for (const [before, outcomes, dead] of [[aBefore, result.contributions.map((row) => ({ id: row.contributionId, survivors: row.survivors, damage: row.survivorDamage })), aDead],
    [dBefore, result.defenders.map((row) => ({ id: row.stackId, survivors: row.survivors, damage: row.survivorDamage })), dDead]] as const) {
    for (const lot of before) {
      const outcome = outcomes.find((row) => row.id === lot.id);
      if (!outcome) throw new Error('monument battle omitted a physical stack');
      const count = outcome.survivors[lot.hull] ?? 0;
      const wounded = outcome.damage.reduce((sum, row) => sum + row.count, 0);
      const groupCount = outcome.damage.length + (count > wounded ? 1 : 0);
      const split = splitMonumentBattleSurvivors(lot, { survivors: count, damage: outcome.damage }, Array.from({ length: groupCount }, () => randomUUID()));
      survivors.push(...split.lots);
      if (split.destroyedCount > 0) dead.push({ ...lot, count: split.destroyedCount, deuterium: split.destroyedDeuterium });
    }
  }
  const winnerIds = result.control === 'ATTACKER' ? incomingIds : result.control === 'DEFENDER' ? defenderIds : new Set<string>();
  const looting = neutral || dBefore.length === 0 ? null : lootMonumentDeuterium(survivors.filter((lot) => winnerIds.has(lot.waveId)), result.control === 'ATTACKER' ? dDead : aDead);
  const winners = new Map(looting?.lots.map((lot) => [lot.id, lot]) ?? []);
  const after = survivors.map((lot) => winners.get(lot.id) ?? lot);
  const lootDeuterium = looting?.shares.reduce((sum, row) => sum + row.deuterium, 0) ?? 0;
  // Ordinary PvP measures the attacker’s realised loot; defensive recovery stays their own cargo.
  const lootValue = Math.round(result.control === 'ATTACKER' ? lootDeuterium : 0);
  const excluded = await adminPlayerIdsInSeason(tx, locked.season.id, adminUsernames);
  const eligible = dBefore.length > 0 && [...aBefore, ...dBefore].every((lot) => !excluded.has(lot.playerId));
  const score = eligible ? battleDominion(lootValue, result, locked.season.rulesetVersion) : null;
  const transfer = score?.transfer ?? 0;
  const aShares = allocateMonumentDominion(transfer, aBefore.map((lot) => ({ playerId: lot.playerId, fleet: { [lot.hull]: lot.count } })));
  const dShares = allocateMonumentDominion(-transfer, dBefore.map((lot) => ({ playerId: lot.playerId, fleet: { [lot.hull]: lot.count } })));
  const [battle] = await tx.insert(monumentBattles).values({ seasonId: locked.season.id, monumentId: locked.monument.id, triggerWaveId: incoming.id,
    monumentOrdinal: locked.monument.ordinal, monumentPosition: { x: locked.monument.x, y: locked.monument.y, z: locked.monument.z },
    attackerFleet: fleetOf(aBefore), defenderFleet: neutral ? locked.monument.garrison : fleetOf(dBefore),
    attackerSurvivors: result.attackerSurvivors, defenderSurvivors: result.defenderSurvivors, grade: result.grade,
    rounds: result.rounds, control: result.control, lootDeuterium, lootValue, attackerLossValue: result.attackerLossValue,
    defenderLossValue: result.defenderLossValue, rulesetVersion: locked.season.rulesetVersion, eligible,
    rawExchange: score?.rawExchange ?? 0, transfer, createdAt: at }).returning();
  if (!battle) throw new Error('monument battle insert returned no row');
  const participantIds = [...new Set([...aBefore, ...dBefore].map((lot) => lot.playerId))];
  const identities = participantIds.length === 0 ? [] : await tx.select({ id: players.id, name: accounts.displayName })
    .from(players).innerJoin(accounts, eq(accounts.id, players.accountId)).where(inArray(players.id, participantIds));
  const identityByPlayer = new Map(identities.map((row) => [row.id, row.name]));
  const clanIds = [...new Set(participantIds.map((playerId) => locked.memberships.get(playerId)).filter((id): id is string => id !== undefined))];
  const clanRows = clanIds.length === 0 ? [] : await tx.select({ id: clans.id, name: clans.name, tag: clans.tag })
    .from(clans).where(inArray(clans.id, clanIds));
  const clanById = new Map(clanRows.map((row) => [row.id, row]));
  const participants: (typeof monumentBattleParticipants.$inferInsert)[] = [];
  for (const [side, before, shares] of [['ATTACK', aBefore, aShares], ['DEFENCE', dBefore, dShares]] as const) {
    for (const playerId of [...new Set(before.map((lot) => lot.playerId))].sort()) {
      const own = before.filter((lot) => lot.playerId === playerId);
      const ownAfter = after.filter((lot) => lot.playerId === playerId);
      const dead = (side === 'ATTACK' ? aDead : dDead).filter((lot) => lot.playerId === playerId);
      const damage: HpDamageLot[] = ownAfter.filter((lot) => lot.damageBp > 0 || lot.remainderBp > 0)
        .map(({ hull, count, damageBp, remainderBp }) => ({ hull, count, damageBp, remainderBp }));
      const clanId = locked.memberships.get(playerId) ?? null;
      const clan = clanId === null ? undefined : clanById.get(clanId);
      participants.push({ battleId: battle.id, seasonId: locked.season.id, playerId, clanId: locked.memberships.get(playerId) ?? null,
        commanderName: identityByPlayer.get(playerId) ?? 'Unknown commander', clanName: clan?.name ?? null, clanTag: clan?.tag ?? null,
        side, waveIds: [...new Set(own.map((lot) => lot.waveId))].sort(), fleet: fleetOf(own), survivors: fleetOf(ownAfter), losses: fleetOf(dead), damage,
        lootDeuterium: looting?.shares.find((row) => row.playerId === playerId)?.deuterium ?? 0,
        dominionDelta: shares.find((row) => row.playerId === playerId)?.delta ?? 0, createdAt: at });
    }
  }
  await tx.insert(monumentBattleParticipants).values(participants);
  for (const participant of participants) {
    const opposingRows = participants.filter((row) => row.side !== participant.side);
    const opponents = opposingRows.length > 0
      ? [...new Map(opposingRows.map((row) => [row.playerId, {
        kind: 'PLAYER' as const, name: row.commanderName, clanName: row.clanName, clanTag: row.clanTag,
      }])).values()]
      : participant.side === 'ATTACK'
        ? [{ kind: 'NEUTRAL' as const, name: 'Neutral garrison', clanName: null, clanTag: null }]
        : [];
    await bookPersonalScore(tx, participant.playerId, participant.dominionDelta);
    await notify(tx, { playerId: participant.playerId, kind: 'raid_result', refId: battle.id, at,
      payload: { targetKind: 'MONUMENT', monumentId: battle.monumentId, monumentOrdinal: battle.monumentOrdinal,
        attacking: participant.side === 'ATTACK', grade: battle.grade, control: battle.control,
        survivors: fleetCount(participant.survivors), unitsLost: fleetCount(participant.losses),
        lootDeuterium: participant.lootDeuterium, dominion: participant.dominionDelta, opponents } });
  }
  if (eligible) await bookClanScores(tx, locked, battle, participants);
  for (const wave of [...incomingWaves, ...defenders]) {
    const remaining = after.filter((lot) => lot.waveId === wave.id);
    await replaceWaveLots(tx, locked, wave, remaining);
    if (remaining.length === 0) await finishDeadWave(tx, wave, at);
  }
  const m = locked.monument;
  if (neutral) {
    m.garrison = result.defenderSurvivors;
    m.garrisonDamage = result.defenderDamage;
  }
  if (result.control === 'ATTACKER') {
    m.controllerClanId = locked.memberships.get(incoming.playerId) ?? null;
    m.controllerPlayerId = m.controllerClanId === null ? incoming.playerId : null;
    m.garrison = {};
    m.garrisonDamage = [];
    m.emptySince = null;
    m.generation += 1;
    await saveControl(tx, locked);
    await chooseHold(tx, locked, homes, incomingWaves.filter((wave) => wave.status !== 'LOST'), at);
  } else {
    if (result.control === 'EMPTY') {
      m.controllerClanId = null;
      m.controllerPlayerId = null;
      m.emptySince = at;
      m.generation += 1;
    }
    await saveControl(tx, locked);
    for (const incoming of incomingWaves.filter((wave) => after.some((lot) => lot.waveId === wave.id))) {
      const home = homes.get(incoming.id);
      if (!home) throw new GameError('PLACEMENT_CHANGED', 'The return world changed; refresh and try again', 409);
      await beginMonumentReturn(tx, locked, incoming, after.filter((lot) => lot.waveId === incoming.id).map((lot) => ({ lotId: lot.id, count: lot.count })), home, at, 'DEFEAT');
    }
  }
  for (const playerId of [...new Set([...aBefore, ...dBefore].map((lot) => lot.playerId))].sort()) {
    await recomputePlayerWealth(tx, playerId);
    await publish(tx, playerId, 'private:monument');
  }
  await publishShard(tx, locked.season.id, 'control');
  return battle;
}

/** Delayed independent arrivals resolve one by one at their own ETA, never as an accidental pool. */
export async function resolveMonumentArrival(tx: Tx, input: { waveId: string; generation: number; at: Date; adminUsernames?: readonly string[] }): Promise<Battle[] | null> {
  const [identity] = await tx.select().from(monumentWaves).where(eq(monumentWaves.id, input.waveId));
  if (identity?.status !== 'OUTBOUND' || identity.generation !== input.generation || identity.arriveAt === null || input.at < identity.arriveAt) return null;
  const scope = await lockArrival(tx, identity.monumentId);
  const { locked, homes } = scope;
  const current = locked.waves.find((wave) => wave.id === input.waveId);
  if (current?.status !== 'OUTBOUND' || current.generation !== input.generation) return null;
  return advanceLockedMonument(tx, locked, homes, input.at, input.adminUsernames ?? []);
}

export async function advanceMonument(tx: Tx, input: { monumentId: string; at: Date; adminUsernames?: readonly string[] }) {
  const scope = await lockArrival(tx, input.monumentId);
  await advanceLockedMonument(tx, scope.locked, scope.homes, input.at, input.adminUsernames ?? []);
  return scope;
}

export async function advanceLockedMonument(tx: Tx, locked: LockedMonument, homes: ReadonlyMap<string, World>, at: Date, adminUsernames: readonly string[], closing = false): Promise<Battle[]> {
  const cutoff = new Date(Math.min(at.getTime(), locked.season.endsAt.getTime()));
  const beforeCutoff = (arrival: Date) => arrival < cutoff || (arrival.getTime() === cutoff.getTime() && !closing && cutoff < locked.season.endsAt);
  const due = locked.waves.filter((wave) => wave.status === 'OUTBOUND' && wave.arriveAt !== null && beforeCutoff(wave.arriveAt))
    .sort((a, b) => a.arriveAt!.getTime() - b.arriveAt!.getTime() || a.id.localeCompare(b.id));
  const probes = (await tx.select().from(monumentProbes).where(and(eq(monumentProbes.monumentId, locked.monument.id),
    eq(monumentProbes.status, 'OUTBOUND'))).for('update')).filter((probe) => beforeCutoff(probe.arriveAt));
  const groups: Wave[][] = [];
  for (const wave of due) {
    const group = wave.jointOperationId === null ? undefined : groups.find((rows) => rows[0]?.jointOperationId === wave.jointOperationId);
    if (group) {
      if (group[0]!.arriveAt!.getTime() !== wave.arriveAt!.getTime()) throw new GameError('MONUMENT_TIMELINE_INVALID', 'A joint formation has inconsistent arrival times', 409);
      group.push(wave);
    } else groups.push([wave]);
  }
  const arrivals = [...groups.map((waves) => ({ kind: 'WAVE' as const, waves, id: waves[0]!.id, at: waves[0]!.arriveAt! })),
    ...probes.map((probe) => ({ kind: 'PROBE' as const, probe, id: probe.id, at: probe.arriveAt }))]
    .sort((a, b) => a.at.getTime() - b.at.getTime() || a.id.localeCompare(b.id));
  const battles: Battle[] = [];
  for (const arrival of arrivals) {
    const at = arrival.at;
    if (at < locked.monument.settledAt) throw new GameError('MONUMENT_TIMELINE_INVALID', 'An arrival precedes the target’s settled roster', 409);
    await settleLockedMonument(tx, locked, at);
    await restoreMonumentGarrison(tx, locked, at);
    if (arrival.kind === 'PROBE') {
      await observeLockedMonumentProbe(tx, locked, arrival.probe);
      continue;
    }
    const incoming: Wave[] = [];
    for (const wave of arrival.waves) {
      if (wave.status !== 'OUTBOUND') continue;
      const flight = await settleMonumentFlight(tx, locked, wave.id, at);
      if (flight.wave.status !== 'LOST') incoming.push(wave);
    }
    if (incoming.length > 0) {
      if (friendly(locked, incoming[0]!)) {
        await chooseHold(tx, locked, homes, incoming, at);
        for (const wave of incoming) await publish(tx, wave.playerId, 'private:monument');
      } else if (incoming[0]!.purpose === 'REINFORCE') {
        for (const wave of incoming) {
          const home = homes.get(wave.id);
          if (!home) throw new GameError('PLACEMENT_CHANGED', 'The return world changed; refresh and try again', 409);
          await beginMonumentReturn(tx, locked, wave, locked.lots.filter((lot) => lot.waveId === wave.id)
            .map((lot) => ({ lotId: lot.id, count: lot.count })), home, at, 'CONTROL_CHANGED');
        }
      } else battles.push(await battleAt(tx, locked, incoming, homes, at, new Set(adminUsernames)));
    }
    await completeMonumentJoint(tx, arrival.waves[0]!.jointOperationId, at);
  }
  await settleLockedMonument(tx, locked, cutoff);
  await restoreMonumentGarrison(tx, locked, cutoff);
  return battles;
}
