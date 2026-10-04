import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { Tx } from '../db/client.js';
import { clanMemberships, clanSupportWaves, monuments, monumentWaves, planets } from '../db/schema.js';
import { lockMonuments, settleLockedMonument, type LockedMonument } from './monument.js';
import { advanceLockedMonument, monumentEndpoints, monumentHomes } from './monumentArrival.js';
import { beginMonumentReturn, settleMonumentFlight } from './monumentMovement.js';
import { lockWaves } from './clanSupport.js';
import { lockWorlds, safeHomePlanet } from './ownership.js';
import { GameError } from './planet.js';
import { publishShard } from '../stream/bus.js';

interface PreparedTarget {
  locked: LockedMonument;
  homes: ReadonlyMap<string, { id: string; x: number; y: number; z: number }>;
}

/** Membership mutations call this before their clan/player locks or any support return. */
export async function prepareClanMonuments(tx: Tx, input: { playerIds: readonly string[]; now: Date; extraClanIds?: readonly string[]; adminUsernames?: readonly string[] }): Promise<PreparedTarget[]> {
  const playerIds = [...new Set(input.playerIds)].sort();
  if (playerIds.length === 0) return [];
  const [waves, solo] = await Promise.all([
    tx.select({ monumentId: monumentWaves.monumentId }).from(monumentWaves).where(and(inArray(monumentWaves.playerId, playerIds), inArray(monumentWaves.status, ['OUTBOUND', 'HOLD']))),
    tx.select({ id: monuments.id }).from(monuments).where(inArray(monuments.controllerPlayerId, playerIds)),
  ]);
  const ids = [...new Set([...waves.map((wave) => wave.monumentId), ...solo.map((m) => m.id)])].sort();
  if (ids.length === 0) return [];
  const [endpoints, ownWorlds, support, memberships] = await Promise.all([
    monumentEndpoints(tx, ids),
    tx.select({ id: planets.id }).from(planets).where(inArray(planets.controllerPlayerId, playerIds)),
    tx.select().from(clanSupportWaves).where(and(inArray(clanSupportWaves.status, ['OUTBOUND', 'STATIONED', 'RETURNING']),
      or(inArray(clanSupportWaves.senderPlayerId, playerIds), inArray(clanSupportWaves.hostPlayerId, playerIds)))),
    tx.select({ clanId: clanMemberships.clanId }).from(clanMemberships).where(and(inArray(clanMemberships.playerId, playerIds), isNull(clanMemberships.leftAt))),
  ]);
  const supportHomes: string[] = [];
  for (const wave of support) supportHomes.push(await safeHomePlanet(tx, wave.senderPlayerId, wave.originPlanetId));
  const worlds = await lockWorlds(tx, [...endpoints.planetIds, ...ownWorlds.map((world) => world.id),
    ...support.flatMap((wave) => [wave.originPlanetId, wave.hostPlanetId]), ...supportHomes]);
  await lockWaves(tx, support.map((wave) => wave.id));
  const targets = await lockMonuments(tx, ids, {
    extraPlayerIds: [...playerIds, ...support.flatMap((wave) => [wave.senderPlayerId, wave.hostPlayerId])],
    extraClanIds: [...new Set([...input.extraClanIds ?? [], ...memberships.map((row) => row.clanId)])],
  });
  const prepared: PreparedTarget[] = [];
  for (const locked of targets) {
    if (input.now >= locked.season.endsAt) throw new GameError('SEASON_FROZEN', 'That season is over', 409);
    const homes = await monumentHomes(tx, locked, endpoints.homeIds, worlds);
    await advanceLockedMonument(tx, locked, homes, input.now, input.adminUsernames ?? []);
    prepared.push({ locked, homes });
  }
  return prepared;
}

/** A launch/join between discovery and clan locking requests a retry, never late world locks. */
async function assertPrepared(tx: Tx, prepared: readonly PreparedTarget[], playerIds: readonly string[]): Promise<void> {
  const ids = new Set(prepared.map((target) => target.locked.monument.id));
  const active = await tx.select({ monumentId: monumentWaves.monumentId }).from(monumentWaves)
    .where(and(inArray(monumentWaves.playerId, [...playerIds]), inArray(monumentWaves.status, ['OUTBOUND', 'HOLD'])));
  if (active.some((wave) => !ids.has(wave.monumentId))) throw new GameError('MEMBERSHIP_CHANGED', 'A monument fleet changed; refresh and try again', 409);
}

export async function releaseClanMonuments(tx: Tx, prepared: readonly PreparedTarget[], playerIds: readonly string[], at: Date): Promise<void> {
  await assertPrepared(tx, prepared, playerIds);
  const own = new Set(playerIds);
  for (const { locked, homes } of prepared) {
    for (const wave of locked.waves.filter((wave) => own.has(wave.playerId) && (wave.status === 'OUTBOUND' || wave.status === 'HOLD'))) {
      if (wave.status === 'OUTBOUND') {
        const loss = await settleMonumentFlight(tx, locked, wave.id, at);
        if (loss.wave.status === 'LOST') continue;
      }
      const lots = locked.lots.filter((lot) => lot.waveId === wave.id);
      const home = homes.get(wave.id);
      if (!home) throw new GameError('PLACEMENT_CHANGED', 'The return world changed; refresh and try again', 409);
      await beginMonumentReturn(tx, locked, wave, lots.map((lot) => ({ lotId: lot.id, count: lot.count })), home, at, 'MEMBERSHIP');
    }
  }
}

/** Control follows the current affiliation; every physical manifest remains its player's. */
export async function promoteClanMonuments(tx: Tx, prepared: readonly PreparedTarget[], playerId: string, clanId: string, at: Date): Promise<void> {
  await assertPrepared(tx, prepared, [playerId]);
  for (const { locked } of prepared) {
    const m = locked.monument;
    if (m.controllerPlayerId !== playerId) continue;
    m.controllerPlayerId = null;
    m.controllerClanId = clanId;
    m.generation += 1;
    locked.memberships.set(playerId, clanId);
    await tx.update(monuments).set({ controllerPlayerId: null, controllerClanId: clanId, generation: m.generation }).where(eq(monuments.id, m.id));
    await settleLockedMonument(tx, locked, at);
    await publishShard(tx, m.seasonId, 'control');
  }
}
