import { and, eq, inArray } from 'drizzle-orm';
import { RESEARCH_PROJECTS, researchMinutes, type ResearchProjectId } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { buildOrders, planets, players } from '../db/schema.js';
import { buildQueueContext, placeBuildOrder } from './buildQueue.js';
import { planetView, type PlanetView } from './planetView.js';
import {
  GameError,
  assertWorldOperational,
  loadLocked,
} from './planet.js';
import { researchView } from './researchState.js';

/**
 * The project this commander already has under way, anywhere, or null.
 *
 * Across every world they hold, because the slot is theirs rather than a world's.
 */
async function runningResearch(
  tx: Tx,
  playerId: string,
): Promise<{ planetId: string; projectId: ResearchProjectId } | null> {
  const worlds = await tx
    .select({ id: planets.id })
    .from(planets)
    .where(eq(planets.controllerPlayerId, playerId));
  if (worlds.length === 0) return null;
  const [order] = await tx
    .select({ planetId: buildOrders.planetId, subject: buildOrders.subject })
    .from(buildOrders)
    .where(and(
      inArray(buildOrders.planetId, worlds.map((world) => world.id)),
      eq(buildOrders.kind, 'RESEARCH'),
      eq(buildOrders.status, 'BUILDING'),
    ))
    .limit(1);
  return order ? { planetId: order.planetId, projectId: order.subject as ResearchProjectId } : null;
}

export interface CompleteResearchResult {
  projectId: ResearchProjectId;
  planet: PlanetView;
}

/** Commit one seasonal project to CONSTRUCTION under the same lock as every other spend. */
export async function completeResearch(
  db: Db,
  planetId: string,
  projectId: ResearchProjectId,
  clock: Clock,
  expectedPlayerId?: string,
): Promise<CompleteResearchResult> {
  /**
   * THE PLAYER ROW IS THE SERIALISATION POINT, AND IT IS TAKEN FIRST. T7.
   *
   * Research belongs to the commander now, so two worlds racing to start one hold
   * two DIFFERENT planet locks and would both pass the same check. The player row
   * is what serialises them, and it is the same pattern clan recruitment already
   * uses.
   *
   * PLAYERS BEFORE PLANETS, and that ORDER is not a detail. `lockClanPlayers` takes
   * player rows and then reaches for planets; taking them the other way round here
   * is a textbook ABBA deadlock, and it is not hypothetical — written planet-first
   * this deadlocked seventy-two tests across three suites on the first full run.
   * A total order is the only fix that scales, exactly as `withTwoPlanetLock` says
   * for two planets.
   *
   * This is why the transaction is opened by hand rather than through
   * `withPlanetLock`: the helper's first act is to lock the planet, and the player
   * has to be held before that.
   */
  return db.transaction(async (tx) => {
    const [world] = await tx
      .select({ playerId: planets.controllerPlayerId })
      .from(planets)
      .where(eq(planets.id, planetId));
    if (!world?.playerId) throw new GameError('PLANET_NOT_OWNED', 'No such world', 404);
    if (expectedPlayerId !== undefined && world.playerId !== expectedPlayerId) {
      throw new GameError('PLANET_NOT_OWNED', 'You do not control that world', 403);
    }
    await tx
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, world.playerId))
      .for('update');

    const planet = await loadLocked(tx, planetId, clock, { expectedPlayerId });
    assertWorldOperational(planet);
    const context = await buildQueueContext(tx, planet, 'CONSTRUCTION');
    const state = (await researchView(tx, planet, context.projected.research))
      .find((project) => project.id === projectId);
    if (!state) throw new GameError('NO_SUCH_RESEARCH', 'No such research project', 404);
    if (state.completed) {
      throw new GameError('RESEARCH_ALREADY_COMPLETE', 'That research is already complete', 409);
    }
    /**
     * ONE PROJECT AT A TIME, ACROSS THE WHOLE COMMANDER.
     *
     * Otherwise a third colony is a third research slot, and the ladder is bought
     * three times as fast by whoever settled most — wealth buying progress, which
     * is the thing the score design refuses. Read across every world this commander
     * holds rather than off this one's queue, which is exactly the read the
     * per-planet model could not make.
     *
     * ONE WORLD MAY STILL CHAIN. A project queued behind its own prerequisite on
     * the SAME world is the mechanism D93-D95 are built on — `queueAvailable`
     * exists for it — and the construction queue is already three deep. What is
     * refused is a SECOND world running a second project, which is the thing that
     * turned settling into research speed.
     */
    const running = await runningResearch(tx, planet.playerId);
    if (running !== null && running.planetId !== planet.planetId) {
      throw new GameError('RESEARCH_SLOT_BUSY', 'Another project is already running', 409, {
        projectId: running.projectId,
      });
    }
    if (!state.queueDiscovered) {
      throw new GameError('RESEARCH_NOT_DISCOVERED', 'That research has not been discovered', 403);
    }
    if (!state.queueAvailable) {
      throw new GameError('RESEARCH_UNAVAILABLE', 'That research is not available yet', 403);
    }
    const requiredCore = RESEARCH_PROJECTS[projectId].requiredCore ?? 0;
    if (context.projected.buildings.CORE < requiredCore) {
      throw new GameError('RESEARCH_UNAVAILABLE', 'Raise the Command Core first', 403, {
        requiredCore,
      });
    }

    /*
      THE RUNG BEING BOUGHT, AND THE ORDER'S `count` IS WHAT CARRIES IT.

      `nextLevel` counts the queue, not just what is held. Read off `state.level`
      this stamped a second same-ladder order with rung one at rung one's price,
      and `applyOrderEffect` writes `GREATEST(level, count)` — so the order was
      charged for, occupied a Construction slot for its full build time, and
      delivered nothing. Measured at 680 alloy taken twice for one rung.
    */
    const level = state.nextLevel;
    const cost = RESEARCH_PROJECTS[projectId].costAt(level);
    await placeBuildOrder(tx, planet, context, {
      kind: 'RESEARCH',
      subject: projectId,
      count: level,
      cost,
      minutes: researchMinutes(cost, context.projected.buildings.CORE),
    });

    return { projectId, planet: await planetView(tx, planetId, clock) };
  });
}
