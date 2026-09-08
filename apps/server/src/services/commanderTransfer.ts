import { randomUUID } from 'node:crypto';
import { and, asc, eq, gt, inArray, isNull, ne, notInArray, or, sql } from 'drizzle-orm';
import { CLAN, INACTIVITY_MS, MULTI_WORLD, generateGalaxy, inactivityEligible, returnPlacement, waitingColonySlots } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { accounts, buildOrders, clanMemberships, clanRequests, clans, commanderTransfers, mainVacancies,
  miningRuns, missions, planets, players, probeWorldMemories, researchOrders, returnApplications,
  scheduledEvents, seasons, shards, strategicAssets, strategicInterceptions, units, watches, pirateRaids, tradeRuns } from '../db/schema.js';
import { loadLocked } from './planet.js';
import { lockAdmission } from './returnQueue.js';
import { refreshSensorEpoch } from './sensorHistory.js';
import { reconcileClanPlayerReclaim } from './clan.js';
import { publish, publishShard, publishSight } from '../stream/bus.js';

export type TransferStatus = 'MOVED' | 'ACTIVE' | 'PLACEMENT' | 'SEASON' | 'CAPACITY' | 'FLIGHT' | 'EVENT' | 'EFFECT' | 'UNITS' | 'CONTENTION' | 'APPLICATION';
class Deferred extends Error { constructor(readonly status: TransferStatus) { super(status); } }
function defer(status: TransferStatus): never { throw new Deferred(status); }

/** No gameplay retry in this transaction: a busy row defers the whole move without skipping FIFO. */
export async function transferCommander(db: Db, playerId: string, targetSeasonId: string, clock: Clock, applicationId?: string): Promise<{ status: TransferStatus }> {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '150ms'`);
      await tx.execute(sql`set local statement_timeout = '3000ms'`);
      const [initial] = await tx.select().from(players).where(eq(players.id, playerId));
      const [targetBefore] = await tx.select().from(seasons).where(eq(seasons.id, targetSeasonId));
      if (!initial || !targetBefore || initial.seasonId === targetSeasonId) defer('PLACEMENT');
      // Lifecycle first; NOWAIT prevents a transfer from holding up the world queue.
      const [lifecycle] = await tx.execute<{ acquired: boolean }>(sql`select pg_try_advisory_xact_lock(83202488) as acquired`);
      if (!lifecycle?.acquired) defer('CONTENTION');
      await lockAdmission(tx, targetBefore.cycleId, targetBefore.shardId);
      const lockedSeasons = await tx.select().from(seasons)
        .where(inArray(seasons.id, [initial.seasonId, targetSeasonId])).orderBy(asc(seasons.id)).for('update', { noWait: true });
      const source = lockedSeasons.find(s => s.id === initial.seasonId);
      const target = lockedSeasons.find(s => s.id === targetSeasonId);
      if (!source || !target || source.status !== 'live' || target.status !== 'live'
        || source.cycleId !== target.cycleId || source.rulesetVersion !== target.rulesetVersion) defer('SEASON');
      const [fromShard] = await tx.select().from(shards).where(eq(shards.id, source.shardId));
      const [toShard] = await tx.select().from(shards).where(eq(shards.id, target.shardId));
      const returning = applicationId !== undefined;
      if (fromShard?.role !== (returning ? 'WAITING' : 'MAIN') || toShard?.role !== (returning ? 'MAIN' : 'WAITING')) defer('PLACEMENT');
      // Clan reconciliation has a clan → players order. Take those locks before the commander.
      const [membership] = await tx.select().from(clanMemberships).where(and(eq(clanMemberships.playerId, playerId), isNull(clanMemberships.leftAt)));
      const memberIds = [playerId];
      if (membership) {
        await tx.select({ id: clans.id }).from(clans).where(eq(clans.id, membership.clanId)).for('update', { noWait: true });
        const members = await tx.select({ id: clanMemberships.playerId }).from(clanMemberships)
          .where(and(eq(clanMemberships.clanId, membership.clanId), isNull(clanMemberships.leftAt)));
        memberIds.push(...members.map(m => m.id));
      }
      const lockedPlayers = await tx.select().from(players).where(inArray(players.id, [...new Set(memberIds)]))
        .orderBy(asc(players.id)).for('update', { noWait: true });
      const player = lockedPlayers.find(p => p.id === playerId);
      if (player?.seasonId !== source.id || player.placementVersion !== initial.placementVersion) defer('PLACEMENT');
      const worlds = await tx.select().from(planets).where(eq(planets.controllerPlayerId, playerId)).orderBy(asc(planets.id)).for('update', { noWait: true });
      const capital = worlds.find(w => w.kind === 'CAPITAL');
      const colonies = worlds.filter(w => w.kind === 'COLONY');
      if (!capital || worlds.some(w => w.seasonId !== source.id) || worlds.length !== colonies.length + 1) defer('PLACEMENT');
      const ids = worlds.map(w => w.id);
      const now = clock.now();
      if (now >= source.endsAt || now >= target.endsAt) defer('SEASON');
      if (!returning && !inactivityEligible({ lastActiveAt: player.lastActiveAt.getTime(), joinedAt: player.joinedAt.getTime(), mainEnteredAt: (player.mainEnteredAt ?? player.joinedAt).getTime() }, now.getTime())) defer('ACTIVE');
      if (returning) {
        const [application] = await tx.select().from(returnApplications).where(eq(returnApplications.id, applicationId)).for('update', { noWait: true });
        if (application?.playerId !== playerId || application.status !== 'QUEUED' || now >= application.expiresAt
          || application.cycleId !== source.cycleId || application.targetShardId !== target.shardId || player.homeShardId !== target.shardId) defer('APPLICATION');
      }
      // Others can still attack an inactive commander. Neither cancel nor teleport a launched fleet.
      const [flight] = await tx.select({ id: missions.id }).from(missions).where(and(eq(missions.status, 'in_flight'),
        or(eq(missions.ownerPlayerId, playerId), inArray(missions.originPlanetId, ids), inArray(missions.targetPlanetId, ids)))).limit(1);
      if (flight) defer('FLIGHT');
      const [mining] = await tx.select({ id: miningRuns.id }).from(miningRuns).where(and(inArray(miningRuns.planetId, ids), ne(miningRuns.status, 'done'))).limit(1);
      const [pirate] = await tx.select({ id: pirateRaids.id }).from(pirateRaids).where(and(ne(pirateRaids.status, 'done'), or(eq(pirateRaids.ownerPlayerId, playerId), inArray(pirateRaids.planetId, ids)))).limit(1);
      const [trade] = await tx.select({ id: tradeRuns.id }).from(tradeRuns).where(and(ne(tradeRuns.status, 'done'), or(eq(tradeRuns.ownerPlayerId, playerId), inArray(tradeRuns.planetId, ids)))).limit(1);
      if (mining || pirate || trade) defer('FLIGHT');
      const [foreign] = await tx.select({ id: units.planetId }).from(units).where(and(gt(units.count, 0), or(
        and(inArray(units.planetId, ids), or(ne(units.ownerPlayerId, playerId), ne(units.location, 'home'))),
        and(eq(units.ownerPlayerId, playerId), notInArray(units.planetId, ids)),
      ))).limit(1);
      if (foreign) defer('UNITS');
      const [interception] = await tx.select({ id: strategicInterceptions.id }).from(strategicInterceptions).where(and(isNull(strategicInterceptions.resolvedAt),
        or(eq(strategicInterceptions.attackerPlayerId, playerId), eq(strategicInterceptions.defenderPlayerId, playerId), inArray(strategicInterceptions.targetPlanetId, ids)))).limit(1);
      if (interception || worlds.some(w => w.recoveryUntil !== null || (w.protectedUntil !== null && w.protectedUntil > now))) defer('EFFECT');
      const orders = await tx.select().from(buildOrders).where(inArray(buildOrders.planetId, ids));
      const research = await tx.select().from(researchOrders).where(eq(researchOrders.playerId, playerId));
      const assets = await tx.select().from(strategicAssets).where(inArray(strategicAssets.planetId, ids));
      if (assets.some(a => a.status === 'LAUNCHED')) defer('FLIGHT');
      const refs = [...ids, ...orders.map(o => o.id), ...research.map(o => o.id), ...assets.map(a => a.id)];
      const events = await tx.select().from(scheduledEvents).where(and(inArray(scheduledEvents.refId, refs), ne(scheduledEvents.status, 'done'))).for('update', { noWait: true });
      // Never retarget a claim that a stale handler may still hold. Attempts>0 is an incident, not absence.
      for (const e of events) {
        const personal = (e.kind === 'build_complete' && orders.some(o => o.id === e.refId))
          || (e.kind === 'research_complete' && research.some(o => o.id === e.refId))
          || (e.kind === 'death_star_ready' && assets.some(a => a.id === e.refId));
        if (e.status !== 'pending' || e.attempts !== 0 || e.resolveAt <= now || (!personal && e.kind !== 'neutral_reinforce')) defer('EVENT');
      }
      for (const work of [...orders.filter(o => o.status === 'BUILDING'), ...research.filter(o => o.status === 'BUILDING'), ...assets.filter(a => a.status === 'BUILDING')]) {
        if (!events.some(e => e.refId === work.id)) defer('EVENT');
      }
      const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(players).where(eq(players.seasonId, target.id));
      if ((count?.n ?? 0) >= toShard.playerCap) defer('CAPACITY');
      const occupiedWorlds = await tx.select().from(planets).where(eq(planets.seasonId, target.id));
      const occupied = new Set(occupiedWorlds.map(w => w.slotIndex));
      const vacancies = returning ? await tx.select().from(mainVacancies).where(and(eq(mainVacancies.seasonId, target.id), isNull(mainVacancies.consumedAt))).for('update') : [];
      const returnSlots = returning ? returnPlacement(vacancies.map(v => ({ ...v, index: v.slotIndex, createdAt: v.createdAt.getTime() })), occupied, colonies.length) : null;
      const reserved = returning ? [] : generateGalaxy(target.seed, MULTI_WORLD.capitalSlots).slots;
      const capitalSlot = returning ? returnSlots?.capital : reserved.slice(0, toShard.playerCap).find(s => !occupied.has(s.index));
      const colonySlots = returning ? returnSlots?.colonies ?? [] : waitingColonySlots(target.seed,
        [...reserved, ...occupiedWorlds.map(w => ({ index: w.slotIndex, x: w.x, y: w.y, z: w.z }))], colonies.length);
      if (!capitalSlot || colonySlots.length !== colonies.length) defer('CAPACITY');
      const ordered = [capital, ...colonies];
      const slots = [capitalSlot, ...colonySlots];
      const transferId = randomUUID();
      // Settle source production exactly once. This never collects the works or gives a starter grant.
      for (const w of worlds) await loadLocked(tx, w.id, { now: () => now });
      if (membership) {
        const [account] = await tx.select().from(accounts).where(eq(accounts.id, player.accountId));
        await reconcileClanPlayerReclaim(tx, { playerId, seasonId: source.id, displayName: account?.displayName ?? player.name, now, activeCutoff: new Date(now.getTime() - INACTIVITY_MS) });
        await tx.update(clanMemberships).set({ leftAt: now }).where(and(eq(clanMemberships.playerId, playerId), isNull(clanMemberships.leftAt)));
      }
      await tx.update(clanRequests).set({ status: 'CLOSED', resolvedAt: now }).where(and(eq(clanRequests.playerId, playerId), eq(clanRequests.status, 'PENDING')));
      const observers = await tx.selectDistinct({ id: watches.observerPlayerId }).from(watches).where(inArray(watches.targetPlanetId, ids));
      await tx.update(watches).set({ detachedAt: now, lastStatus: null, lastConfirmedAt: null }).where(or(eq(watches.observerPlayerId, playerId), inArray(watches.targetPlanetId, ids)));
      await tx.update(probeWorldMemories).set({ invalidatedAt: now }).where(or(eq(probeWorldMemories.observerPlayerId, playerId), inArray(probeWorldMemories.targetPlanetId, ids)));
      await tx.insert(commanderTransfers).values({ id: transferId, playerId, accountId: player.accountId, cycleId: source.cycleId,
        sourceSeasonId: source.id, targetSeasonId: target.id, fromVersion: player.placementVersion, toVersion: player.placementVersion + 1,
        direction: returning ? 'RETURN' : 'OUT', applicationId: applicationId ?? null, committedAt: now,
        worlds: ordered.map((w, i) => ({ id: w.id, kind: w.kind, from: { index: w.slotIndex, x: w.x, y: w.y, z: w.z }, to: slots[i]! })),
      });
      if (!returning) await tx.insert(mainVacancies).values(ordered.map(w => ({ cycleId: source.cycleId, seasonId: source.id, departureTransferId: transferId,
        kind: w.kind === 'CAPITAL' ? 'CAPITAL' as const : 'COLONY' as const, slotIndex: w.slotIndex, x: w.x, y: w.y, z: w.z, createdAt: now })));
      else {
        await tx.update(mainVacancies).set({ consumedAt: now, consumedReason: 'RETURN' }).where(inArray(mainVacancies.id, [returnSlots!.capital.id, ...returnSlots!.colonies.map(v => v.id)]));
        await tx.update(returnApplications).set({ status: 'COMPLETED', closedAt: now, updatedAt: now, closedReason: 'RETURNED' }).where(eq(returnApplications.id, applicationId));
      }
      for (let i = 0; i < ordered.length; i++) {
        const slot = slots[i]!;
        await tx.update(planets).set({ seasonId: target.id, slotIndex: slot.index, x: slot.x, y: slot.y, z: slot.z }).where(eq(planets.id, ordered[i]!.id));
      }
      await tx.update(players).set({ seasonId: target.id, homeShardId: player.homeShardId ?? source.shardId,
        placementVersion: player.placementVersion + 1,
        ...(returning ? { mainEnteredAt: now } : {}),
        ...(membership ? { clanLockedUntil: new Date(Math.max(player.clanLockedUntil?.getTime() ?? 0, now.getTime() + CLAN.membershipLockMinutes * 60_000)) } : {}),
      }).where(eq(players.id, playerId));
      for (const event of events) await tx.update(scheduledEvents).set({ seasonId: target.id }).where(eq(scheduledEvents.id, event.id));
      for (const w of worlds) await refreshSensorEpoch(tx, w.id, now);
      for (const observer of observers) await publishSight(tx, observer.id);
      await publish(tx, playerId, 'placement_changed');
      for (const id of [source.id, target.id]) { await publishShard(tx, id, 'world'); await publishShard(tx, id, 'score'); }
    });
    return { status: 'MOVED' };
  } catch (error) {
    if (error instanceof Deferred) return { status: error.status };
    if (databaseCode(error) === '55P03' || databaseCode(error) === '40P01' || databaseCode(error) === '57014') return { status: 'CONTENTION' };
    throw error;
  }
}
function databaseCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  return 'cause' in error ? databaseCode(error.cause) : undefined;
}

/** The audit is the outbox; crashes after COMMIT are recovered, duplicate invalidations are harmless. */
export async function emitTransferOutbox(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    const pending = await tx.select().from(commanderTransfers).where(isNull(commanderTransfers.emittedAt)).limit(25).for('update', { skipLocked: true });
    for (const move of pending) {
      await publish(tx, move.playerId, 'placement_changed');
      for (const id of [move.sourceSeasonId, move.targetSeasonId]) await publishShard(tx, id, 'world');
      await tx.update(commanderTransfers).set({ emittedAt: move.committedAt }).where(eq(commanderTransfers.id, move.id));
    }
  });
}
