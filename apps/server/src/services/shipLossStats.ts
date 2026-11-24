import { HULLS, fleetCount, type Fleet } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { seasonTelemetrySegments } from '../db/schema.js';

/**
 * A LOSS NOBODY WON. Ships destroyed with a seceding colony (owner 2026-11-18, S19c/S42/S43)
 * score no Dominion and no Honor, but the commander's season record still shows them.
 *
 * Written as a production-free telemetry segment, the shape freeze already sums per
 * commander, so the season stats need no table of their own.
 */
export async function recordShipLoss(
  tx: Tx,
  input: { seasonId: string; playerId: string; sourcePlanetId: string; fleet: Fleet; now: Date },
): Promise<void> {
  const shipsLost: Fleet = {};
  for (const [hull, count] of Object.entries(input.fleet) as [keyof typeof HULLS, number][]) {
    if (!HULLS[hull].ground && count > 0) shipsLost[hull] = count;
  }
  if (fleetCount(shipsLost) === 0) return;
  await tx.insert(seasonTelemetrySegments).values({
    seasonId: input.seasonId,
    playerId: input.playerId,
    sourcePlanetId: input.sourcePlanetId,
    telemetry: {
      produced: { alloy: 0, crystal: 0, deuterium: 0 },
      productiveSeconds: 0,
      shipsBuilt: {},
      shipsLost,
    },
    closedAt: input.now,
  });
}
