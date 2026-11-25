import { and, eq, gt, lte } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Queryable } from '../db/client.js';
import { galaxyEventOccurrences, seasons } from '../db/schema.js';

/**
 * IS THE ASTERYUM FIRTINASI BLOWING NOW? (plan 2026-11-24 §3.2). The Yarık is one room shared by every
 * galaxy, and the storm is a fixed daily window, so the room asks whether any live season has a dealt
 * storm open at this instant. Half-open, like every galaxy event: `[startsAt, endsAt)`.
 */
export async function asteriumStormActive(db: Queryable, clock: Clock): Promise<boolean> {
  const now = clock.now();
  const [row] = await db.select({ id: galaxyEventOccurrences.id }).from(galaxyEventOccurrences)
    .innerJoin(seasons, eq(seasons.id, galaxyEventOccurrences.seasonId))
    .where(and(
      eq(galaxyEventOccurrences.kind, 'ASTERIUM_STORM'), eq(seasons.status, 'live'),
      lte(galaxyEventOccurrences.startsAt, now), gt(galaxyEventOccurrences.endsAt, now),
    )).limit(1);
  return row !== undefined;
}
