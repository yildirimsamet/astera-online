import { and, eq, inArray } from 'drizzle-orm';
import type { Fleet } from '@astera/rules';
import type { Queryable } from '../db/client.js';
import { planets, watches } from '../db/schema.js';
import { publishSight } from '../stream/bus.js';

/**
 * Tell only the commanders whose stored Telescope assignments can have changed.
 *
 * A shard-wide launch/arrival is enough to keep public traffic live, but it is the
 * wrong invalidation for Telescope truth: `/api/galaxy` is caller-specific and is
 * the most expensive read on the client. Broadcasting that read to all 300
 * commanders would fix staleness by creating a fan-out problem. The target ids are
 * known inside the mutation, so address the existing private stream instead.
 *
 * Joining the observer world back to its current controller drops rows left
 * behind by a captured colony. `readTelescopes` still owns the full instrument,
 * range and power gates; an invalidation carries no intel and is harmless if a
 * surviving assignment is temporarily dormant.
 */
export async function publishWatchChanges(
  tx: Queryable,
  targetPlanetIds: readonly string[],
): Promise<void> {
  const targets = [...new Set(targetPlanetIds)];
  if (targets.length === 0) return;

  const observers = await tx
    .selectDistinct({ playerId: watches.observerPlayerId })
    .from(watches)
    .innerJoin(
      planets,
      and(
        eq(planets.id, watches.observerPlanetId),
        eq(planets.controllerPlayerId, watches.observerPlayerId),
      ),
    )
    .where(inArray(watches.targetPlanetId, targets));

  // Keep one transaction connection sequential; NOTIFY itself is delivered on commit.
  for (const observer of observers) await publishSight(tx, observer.playerId);
}

/** Telescope fleet truth deliberately excludes mining craft. */
export function fleetChangesWatch(fleet: Fleet): boolean {
  return Object.entries(fleet).some(([hull, count]) =>
    hull !== 'PROSPECTOR' && count > 0,
  );
}
