import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  BUILD,
  RESEARCH_PROJECTS,
  cancelRefund,
  researchMinutes,
  type ResearchProjectId,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import {
  playerResearch,
  planets,
  players,
  researchOrders,
  scheduledEvents,
} from '../db/schema.js';
import { schedule } from '../worker/queue.js';
import { planetView, type PlanetView } from './planetView.js';
import {
  GameError,
  assertWorldOperational,
  loadLocked,
  recomputePlayerWealth,
  saveResources,
} from './planet.js';
import { activeResearchOrders, projectedResearchLevels } from './researchQueue.js';
import { researchView } from './researchState.js';
import { safeHomePlanet } from './ownership.js';

export interface CompleteResearchResult {
  projectId: ResearchProjectId;
  planet: PlanetView;
}

/**
 * Commit one project to the commander's own research queue.
 *
 * The selected planet funds the work and supplies the Core level used to price
 * its duration. The queue and completed level belong to the player, so adding or
 * losing a colony never creates, blocks or destroys research throughput.
 */
export async function completeResearch(
  db: Db,
  planetId: string,
  projectId: ResearchProjectId,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<CompleteResearchResult> {
  return db.transaction(async (tx) => {
    const [world] = await tx
      .select({ playerId: planets.controllerPlayerId })
      .from(planets)
      .where(eq(planets.id, planetId));
    if (!world?.playerId) throw new GameError('PLANET_NOT_OWNED', 'No such world', 404);
    if (expectedPlayerId !== undefined && world.playerId !== expectedPlayerId) {
      throw new GameError('PLANET_NOT_OWNED', 'You do not control that world', 403);
    }

    // One lock for one commander-wide lane. It is always taken before the planet.
    await tx
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, world.playerId))
      .for('update');

    const planet = await loadLocked(tx, planetId, clock, {
      expectedPlayerId: expectedPlayerId ?? world.playerId,
    });
    assertWorldOperational(planet);
    const queue = await activeResearchOrders(tx, planet.playerId);
    if (queue.length >= BUILD.queueDepth) {
      throw new GameError('QUEUE_FULL', 'The research queue is full', 409, {
        queue: 'RESEARCH',
        max: BUILD.queueDepth,
      });
    }
    if (queue.some((order, index) => order.slot !== index)) {
      throw new Error(`research queue ${planet.playerId} is not compact`);
    }
    if (queue[0] && queue[0].readyAt <= planet.now) {
      throw new GameError('QUEUE_SETTLING', 'The completed research is settling now', 409, {
        queue: 'RESEARCH',
      });
    }
    if (queue.some((order) =>
      order.projectId === projectId
      && order.level >= RESEARCH_PROJECTS[projectId].maxLevel)) {
      throw new GameError('RESEARCH_ALREADY_COMPLETE', 'That research is already queued', 409);
    }

    const projected = await projectedResearchLevels(tx, planet.playerId, queue);
    const state = (await researchView(tx, planet, projected))
      .find((candidate) => candidate.id === projectId);
    if (!state) throw new GameError('NO_SUCH_RESEARCH', 'No such research project', 404);
    if (state.completed) {
      throw new GameError('RESEARCH_ALREADY_COMPLETE', 'That research is already complete', 409);
    }
    if (!state.queueDiscovered) {
      throw new GameError('RESEARCH_NOT_DISCOVERED', 'That research has not been discovered', 403);
    }
    if (!state.queueAvailable) {
      throw new GameError('RESEARCH_UNAVAILABLE', 'That research is not available yet', 403);
    }
    const requiredCore = RESEARCH_PROJECTS[projectId].requiredCore ?? 0;
    if (planet.buildings.CORE < requiredCore) {
      throw new GameError('RESEARCH_UNAVAILABLE', 'Raise the Command Core first', 403, {
        requiredCore,
      });
    }

    const level = state.nextLevel;
    const cost = RESEARCH_PROJECTS[projectId].costAt(level);
    if (
      planet.alloy < cost.alloy
      || planet.crystal < cost.crystal
      || planet.deuterium < cost.deuterium
    ) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }
    const durationSeconds = Math.max(
      1,
      Math.ceil(researchMinutes(cost, planet.buildings.CORE) * 60),
    );
    const startedAt = queue.at(-1)?.readyAt ?? planet.now;
    const readyAt = new Date(startedAt.getTime() + durationSeconds * 1_000);
    if (readyAt >= planet.seasonEndsAt) {
      throw new GameError(
        'SEASON_ENDS_BEFORE_BUILD',
        'That research cannot finish before the season ends',
        409,
        { endsAt: planet.seasonEndsAt.toISOString() },
      );
    }

    planet.alloy -= cost.alloy;
    planet.crystal -= cost.crystal;
    planet.deuterium -= cost.deuterium;
    await saveResources(tx, planet.planetId, {
      alloy: planet.alloy,
      crystal: planet.crystal,
      deuterium: planet.deuterium,
    });
    const [order] = await tx
      .insert(researchOrders)
      .values({
        playerId: planet.playerId,
        fundingPlanetId: planet.planetId,
        slot: queue.length,
        projectId,
        level,
        status: 'BUILDING',
        startedAt,
        readyAt,
        remainingSeconds: durationSeconds,
        cost,
      })
      .returning();
    if (!order) throw new Error('research order insert returned no row');
    await schedule(tx, {
      seasonId: planet.seasonId,
      kind: 'research_complete',
      refId: order.id,
      payload: { expectedReadyAt: readyAt.toISOString() },
      resolveAt: readyAt,
    });
    await recomputePlayerWealth(tx, planet.playerId);
    return { projectId, planet: await planetView(tx, planetId, clock) };
  });
}

function researchDependsOn(later: typeof researchOrders.$inferSelect, earlier: typeof researchOrders.$inferSelect): boolean {
  if (later.slot <= earlier.slot) return false;
  if (later.projectId === earlier.projectId && later.level > earlier.level) return true;
  let prerequisite = RESEARCH_PROJECTS[later.projectId].prerequisite;
  while (prerequisite !== null) {
    if (prerequisite === earlier.projectId) return true;
    prerequisite = RESEARCH_PROJECTS[prerequisite].prerequisite;
  }
  return false;
}

/** Re-number the commander's lane and make every absolute event time agree. */
async function reflowResearchQueue(
  tx: Tx,
  playerId: string,
  now: Date,
  preserveFirst: boolean,
): Promise<void> {
  const rows = await activeResearchOrders(tx, playerId);
  let at = now;
  for (const [slot, row] of rows.entries()) {
    const preserve = slot === 0 && preserveFirst;
    const startedAt = preserve ? row.startedAt : at;
    const readyAt = preserve
      ? row.readyAt
      : new Date(startedAt.getTime() + row.remainingSeconds * 1_000);
    at = readyAt;
    await tx.update(researchOrders).set({ slot, startedAt, readyAt }).where(and(
      eq(researchOrders.id, row.id),
      eq(researchOrders.status, 'BUILDING'),
    ));
    await tx.update(scheduledEvents).set({
      resolveAt: readyAt,
      payload: { expectedReadyAt: readyAt.toISOString() },
      status: 'pending',
      claimedAt: null,
    }).where(and(
      inArray(scheduledEvents.kind, ['research_complete', 'build_complete']),
      eq(scheduledEvents.refId, row.id),
      inArray(scheduledEvents.status, ['pending', 'processing']),
    ));
  }
}

export async function cancelResearchOrder(
  db: Db,
  planetId: string,
  orderId: string,
  clock: Clock,
  expectedPlayerId?: string,
) {
  return db.transaction(async (tx) => {
    const [world] = await tx
      .select({ playerId: planets.controllerPlayerId })
      .from(planets)
      .where(eq(planets.id, planetId));
    if (!world?.playerId || (expectedPlayerId !== undefined && world.playerId !== expectedPlayerId)) {
      throw new GameError('PLANET_NOT_OWNED', 'You do not control that world', 403);
    }
    await tx.select({ id: players.id }).from(players).where(eq(players.id, world.playerId)).for('update');
    const planet = await loadLocked(tx, planetId, clock, {
      expectedPlayerId: expectedPlayerId ?? world.playerId,
    });
    assertWorldOperational(planet);
    const queue = await activeResearchOrders(tx, planet.playerId);
    const order = queue.find((candidate) => candidate.id === orderId);
    if (!order) throw new GameError('RESEARCH_ORDER_NOT_FOUND', 'No active research order by that id', 404);
    if (order.readyAt <= planet.now) {
      throw new GameError('BUILD_ORDER_FINISHED', 'That research has already finished', 409);
    }
    if (queue.some((candidate) => researchDependsOn(candidate, order))) {
      throw new GameError(
        'BUILD_ORDER_HAS_DEPENDENTS',
        'Cancel the dependent research behind this one first',
        409,
      );
    }

    const refund = cancelRefund(order.cost);
    await tx.update(researchOrders).set({ status: 'CANCELLED' }).where(and(
      eq(researchOrders.id, order.id),
      eq(researchOrders.status, 'BUILDING'),
    ));
    await tx.update(scheduledEvents).set({ status: 'done', claimedAt: null }).where(and(
      inArray(scheduledEvents.kind, ['research_complete', 'build_complete']),
      eq(scheduledEvents.refId, order.id),
      inArray(scheduledEvents.status, ['pending', 'processing']),
    ));

    planet.alloy += refund.alloy;
    planet.crystal += refund.crystal;
    planet.deuterium += refund.deuterium;
    await saveResources(tx, planet.planetId, {
      alloy: planet.alloy,
      crystal: planet.crystal,
      deuterium: planet.deuterium,
    });
    await reflowResearchQueue(tx, planet.playerId, planet.now, order.slot !== 0);
    await recomputePlayerWealth(tx, planet.playerId);
    return { orderId, refund, planet: await planetView(tx, planetId, clock) };
  });
}

/** Apply one due rung and compact the remaining commander queue. Idempotent. */
export async function applyResearchCompletion(
  tx: Tx,
  orderId: string,
  expectedReadyAt: string,
  _clock: Clock,
): Promise<{ playerId: string } | null> {
  const [candidate] = await tx
    .select()
    .from(researchOrders)
    .where(eq(researchOrders.id, orderId));
  if (candidate?.status !== 'BUILDING') return null;
  if (candidate.readyAt.toISOString() !== expectedReadyAt) return null;

  await tx
    .select({ id: players.id })
    .from(players)
    .where(eq(players.id, candidate.playerId))
    .for('update');
  const [applied] = await tx
    .update(researchOrders)
    .set({ status: 'COMPLETED' })
    .where(and(
      eq(researchOrders.id, orderId),
      eq(researchOrders.status, 'BUILDING'),
      eq(researchOrders.readyAt, candidate.readyAt),
    ))
    .returning();
  if (!applied) return null;

  await tx
    .insert(playerResearch)
    .values({
      playerId: applied.playerId,
      projectId: applied.projectId,
      level: applied.level,
      completedAt: applied.readyAt,
    })
    .onConflictDoUpdate({
      target: [playerResearch.playerId, playerResearch.projectId],
      set: { level: sql`GREATEST(${playerResearch.level}, ${applied.level})` },
    });

  // Slot zero is free now. Move in ascending order so the partial unique index
  // never sees two live rows in the same slot during compaction.
  const tail = (await activeResearchOrders(tx, applied.playerId))
    .filter((order) => order.slot > applied.slot);
  for (const order of tail) {
    await tx
      .update(researchOrders)
      .set({ slot: order.slot - 1 })
      .where(and(eq(researchOrders.id, order.id), eq(researchOrders.status, 'BUILDING')));
  }
  await recomputePlayerWealth(tx, applied.playerId);
  return { playerId: applied.playerId };
}

/** Release a research order whose completion event exhausted its retries. */
export async function abandonResearchOrder(
  db: Db,
  orderId: string,
  clock: Clock,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(researchOrders).where(eq(researchOrders.id, orderId));
    if (order?.status !== 'BUILDING') return false;
    await tx
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, order.playerId))
      .for('update');
    const queue = await activeResearchOrders(tx, order.playerId);
    const abandoned = queue.filter((candidate) =>
      candidate.id === order.id || researchDependsOn(candidate, order));
    const ids = abandoned.map((candidate) => candidate.id);
    const refundPlanetId = await safeHomePlanet(
      tx,
      order.playerId,
      order.fundingPlanetId,
    );
    const planet = await loadLocked(tx, refundPlanetId, clock, { requireLive: false });
    const affected = await tx
      .update(researchOrders)
      .set({ status: 'FAILED' })
      .where(and(inArray(researchOrders.id, ids), eq(researchOrders.status, 'BUILDING')))
      .returning({ id: researchOrders.id });
    if (!affected.some((candidate) => candidate.id === order.id)) return false;
    await tx.update(scheduledEvents).set({ status: 'done', claimedAt: null }).where(and(
      inArray(scheduledEvents.kind, ['research_complete', 'build_complete']),
      inArray(scheduledEvents.refId, ids),
      inArray(scheduledEvents.status, ['pending', 'processing']),
    ));
    for (const candidate of abandoned) {
      planet.alloy += candidate.cost.alloy;
      planet.crystal += candidate.cost.crystal;
      planet.deuterium += candidate.cost.deuterium;
    }
    await saveResources(tx, planet.planetId, {
      alloy: planet.alloy,
      crystal: planet.crystal,
      deuterium: planet.deuterium,
    });
    await reflowResearchQueue(
      tx,
      order.playerId,
      planet.now,
      queue[0]?.id !== order.id,
    );
    await recomputePlayerWealth(tx, order.playerId);
    return true;
  });
}
