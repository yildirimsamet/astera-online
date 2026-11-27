import { and, eq, gt, inArray } from 'drizzle-orm';
import { ARENA_ECONOMY as E } from '@astera/rules/arena';
import type { Clock } from '../clock.js';
import type { Queryable } from '../db/client.js';
import { galaxyEventOccurrences, seasons } from '../db/schema.js';

/** Where the Yarık stands now (owner 2026-11-27). Instants, never durations: each reader measures from its own clock. */
export interface RiftWindow {
  /** A Yarık Saati or an Asteryum Fırtınası is open now: a ship may go in. */
  open: boolean;
  /** The open window is the storm: the room seeds Asteryum (plan 2026-11-24 §3.2). */
  storm: boolean;
  /** When the open window ends; null while shut. */
  closesAt: Date | null;
  /** While shut, inside the `riftGraceMinutes` after a window: when every ship still inside is lost. */
  deadline: Date | null;
  /** While shut: the next window's start; null when the calendar holds none. */
  opensAt: Date | null;
}

const GRACE_MS = E.riftGraceMinutes * 60_000;

/**
 * IS THE YARIK OPEN NOW? The room is one, shared by every galaxy, and its windows are fixed daily ones (the Yarık
 * Saati and the Asteryum Fırtınası), so it reads every live season's calendar. Half-open, like every galaxy event:
 * `[startsAt, endsAt)`. Rows that ended before the grace began can change nothing and are not read.
 */
export async function riftWindow(db: Queryable, clock: Clock): Promise<RiftWindow> {
  const now = clock.now();
  const rows = await db.select({ kind: galaxyEventOccurrences.kind, startsAt: galaxyEventOccurrences.startsAt, endsAt: galaxyEventOccurrences.endsAt })
    .from(galaxyEventOccurrences)
    .innerJoin(seasons, eq(seasons.id, galaxyEventOccurrences.seasonId))
    .where(and(
      inArray(galaxyEventOccurrences.kind, ['RIFT_HOUR', 'ASTERIUM_STORM']), eq(seasons.status, 'live'),
      gt(galaxyEventOccurrences.endsAt, new Date(now.getTime() - GRACE_MS)),
    ));
  const at = now.getTime();
  const open = rows.filter(row => row.startsAt.getTime() <= at && at < row.endsAt.getTime());
  if (open.length > 0) {
    return { open: true, storm: open.some(row => row.kind === 'ASTERIUM_STORM'), closesAt: new Date(Math.max(...open.map(row => row.endsAt.getTime()))),
      deadline: null, opensAt: null };
  }
  const ended = rows.filter(row => row.endsAt.getTime() <= at).map(row => row.endsAt.getTime());
  const next = rows.filter(row => row.startsAt.getTime() > at).map(row => row.startsAt.getTime());
  return { open: false, storm: false, closesAt: null, deadline: ended.length > 0 ? new Date(Math.max(...ended) + GRACE_MS) : null,
    opensAt: next.length > 0 ? new Date(Math.min(...next)) : null };
}
