import { RESEARCH_PROJECTS, researchMinutes, type ResearchProjectId } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { buildQueueContext, placeBuildOrder } from './buildQueue.js';
import { planetView, type PlanetView } from './planetView.js';
import {
  GameError,
  assertWorldOperational,
  withPlanetLock,
} from './planet.js';
import { researchView } from './researchState.js';

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
  return withPlanetLock(db, planetId, clock, async (tx, planet) => {
    assertWorldOperational(planet);
    const context = await buildQueueContext(tx, planet, 'CONSTRUCTION');
    if (context.projected.research.has(projectId)) {
      throw new GameError('RESEARCH_ALREADY_COMPLETE', 'That research is already complete', 409);
    }
    const state = (await researchView(tx, planet, context.projected.research))
      .find((project) => project.id === projectId);
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
    if (context.projected.buildings.CORE < requiredCore) {
      throw new GameError('RESEARCH_UNAVAILABLE', 'Raise the Command Core first', 403, {
        requiredCore,
      });
    }

    const cost = RESEARCH_PROJECTS[projectId].cost;
    await placeBuildOrder(tx, planet, context, {
      kind: 'RESEARCH',
      subject: projectId,
      count: 1,
      cost,
      minutes: researchMinutes(cost, context.projected.buildings.CORE),
    });

    return { projectId, planet: await planetView(tx, planetId, clock) };
  }, expectedPlayerId);
}
