import { STARTER } from '@astera/rules';
import { and, eq, inArray, lt, notInArray, or } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db } from '../../db/client.js';
import {
  starterChatMessages, starterEvents, vesselBattleReports, vesselBotState, vesselMigrations, vesselMissions, vesselNotifications,
  vesselOrders, vesselProbeReports, vesselScanEvents, vesselUnits, vesselWatches, vessels,
} from '../../db/schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const STILL_FLYING = ['OUTBOUND', 'RETURNING'] as const;

/**
 * WHAT A GALAXY WITH NO WIPE FORGETS. Plan §5: the main game's season wipe empties its tables, and
 * nothing does that here. A landed ship keeps its `vessels` and `vessel_migrations` rows, since the
 * one-ship rule stands on them, and drops everything else. Old reports, chat and finished queue
 * events go for everyone. A queued event is never touched, however old: it is still owed.
 */
export async function sweepStarterRetention(db: Db, clock: Clock): Promise<void> {
  const cutoff = new Date(clock.now().getTime() - STARTER.retentionDays * DAY_MS);
  await db.transaction(async (tx) => {
    const landed = (await tx.select({ id: vessels.id }).from(vessels)
      .innerJoin(vesselMigrations, eq(vesselMigrations.vesselId, vessels.id))
      .where(and(eq(vessels.status, 'DEPARTED'), lt(vesselMigrations.startedAt, cutoff)))).map(row => row.id);
    if (landed.length > 0) {
      await tx.delete(vesselUnits).where(inArray(vesselUnits.vesselId, landed));
      await tx.delete(vesselOrders).where(inArray(vesselOrders.vesselId, landed));
      await tx.delete(vesselNotifications).where(inArray(vesselNotifications.vesselId, landed));
      await tx.delete(vesselWatches).where(or(inArray(vesselWatches.observerVesselId, landed), inArray(vesselWatches.targetVesselId, landed)));
      await tx.delete(vesselScanEvents).where(inArray(vesselScanEvents.targetVesselId, landed));
      await tx.delete(vesselProbeReports).where(inArray(vesselProbeReports.observerVesselId, landed));
      await tx.delete(vesselBotState).where(inArray(vesselBotState.vesselId, landed));
      await tx.delete(vesselMissions).where(and(inArray(vesselMissions.ownerVesselId, landed), notInArray(vesselMissions.status, [...STILL_FLYING])));
    }
    await tx.delete(vesselNotifications).where(lt(vesselNotifications.createdAt, cutoff));
    await tx.delete(vesselScanEvents).where(lt(vesselScanEvents.at, cutoff));
    await tx.delete(vesselProbeReports).where(lt(vesselProbeReports.at, cutoff));
    await tx.delete(vesselBattleReports).where(lt(vesselBattleReports.at, cutoff));
    await tx.delete(vesselMissions).where(and(lt(vesselMissions.arriveAt, cutoff), notInArray(vesselMissions.status, [...STILL_FLYING])));
    await tx.delete(starterChatMessages).where(lt(starterChatMessages.createdAt, cutoff));
    await tx.delete(starterEvents).where(and(lt(starterEvents.resolveAt, cutoff), inArray(starterEvents.status, ['done', 'failed'])));
  });
}
