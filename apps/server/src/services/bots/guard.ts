import type { FastifyBaseLogger } from 'fastify';
import type { Resources } from '@astera/rules';
import type { Db } from '../../db/client.js';
import type { Clock } from '../../clock.js';
import { GameError } from '../planet.js';
import type { PlanetView } from '../planetView.js';
import { buildUnits, installSatellite, upgradeBuilding } from '../build.js';
import { completeResearch } from '../research.js';
import { claimReward, rewardsView } from '../rewards.js';
import { guardGoalAvailable, guardGoals, guardQuote, type GuardGoal } from './guardRoute.js';

/** Small paid execution adapter. Service-returned state is the only wallet used after a purchase. */
export async function developGuard(
  db: Db, clock: Clock, seat: { playerId: string; planetId: string }, view: PlanetView,
  did: string[], log: FastifyBaseLogger,
): Promise<{ view: PlanetView; reserved: Resources; complete: boolean }> {
  // Bounded work on an existing season with many earned-but-unclaimed tiers.
  const rewards = await rewardsView(db, seat.planetId, clock);
  const earned = rewards.chains.filter(chain => chain.scope === 'season')
    .flatMap(chain => chain.tiers.filter(tier => tier.state === 'claimable')).slice(0, 3);
  for (const tier of earned) {
    try {
      view = (await claimReward(db, seat.planetId, tier.id, clock)).planet;
      did.push(`reward:${tier.id}`);
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
      if (err.code !== 'REWARD_TAKEN') log.warn({ code: err.code, reward: tier.id }, 'guard reward refused');
    }
  }
  const reserved: Resources = { alloy: 0, crystal: 0, deuterium: 0 };
  const waiting: { goal: string; reason: string; cost?: Resources }[] = [];
  const goals = guardGoals(view);
  for (const goal of goals) {
    const { cost, count } = guardQuote(view, goal);
    const label = goalLabel(goal);
    if (!guardGoalAvailable(view, goal)) { waiting.push({ goal: label, reason: 'PREREQUISITE_OR_CAPACITY' }); continue; }
    if (view.planet.alloy - reserved.alloy < cost.alloy || view.planet.crystal - reserved.crystal < cost.crystal
      || view.planet.deuterium - reserved.deuterium < cost.deuterium) {
      reserved.alloy += cost.alloy; reserved.crystal += cost.crystal; reserved.deuterium += cost.deuterium;
      waiting.push({ goal: label, reason: 'SAVING', cost });
      continue;
    }
    try {
      const result = goal.kind === 'building'
        ? await upgradeBuilding(db, seat.planetId, goal.id, clock, seat.playerId,
          goal.id === 'CORE' ? { confirmedLevel: view.buildings.CORE + view.queues.CONSTRUCTION.filter(q => q.subject === 'CORE')
            .reduce((sum, q) => sum + q.count, 0) + 1 } : {})
        : goal.kind === 'research' ? await completeResearch(db, seat.planetId, goal.id, clock, seat.playerId)
        : goal.kind === 'satellite' ? await installSatellite(db, seat.planetId, goal.id, clock, seat.playerId)
        : await buildUnits(db, seat.planetId, goal.id, count, clock, seat.playerId);
      view = result.planet; did.push(label);
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
      waiting.push({ goal: label, reason: err.code });
    }
  }
  log.info({ playerId: seat.playerId, did, waiting }, 'guard development');
  return { view, reserved, complete: goals.length === 0 };
}

function goalLabel(goal: GuardGoal): string {
  return `${goal.kind === 'building' ? 'build' : goal.kind === 'hull' ? 'ship' : goal.kind}:${goal.id}`;
}
