import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { MAINTENANCE } from '@astera/rules';
import type { Db, Queryable } from '../db/client.js';
import { galaxyEventOccurrences, maintenanceWindows, seasons } from '../db/schema.js';
import { GameError } from './planet.js';

/**
 * THE PLANNED MAINTENANCE WINDOW. Scaling plan F0.9, owner K5/K7.
 *
 * A window is announced by being scheduled a day ahead. From then on nothing hostile
 * may land inside it: the worker is down, and a raid resolved at the reopening would
 * meet a defender who could not answer. Probes and transfers stay free.
 */
export interface MaintenanceWindow { id: string; startsAt: Date; endsAt: Date }

const HOUR_MS = 3_600_000;
const GUARD_MS = MAINTENANCE.guardMinutes * 60_000;
const view = (row: typeof maintenanceWindows.$inferSelect): MaintenanceWindow =>
  ({ id: row.id, startsAt: row.startsAt, endsAt: row.endsAt });
const live = isNull(maintenanceWindows.cancelledAt);

/** Every window still ahead or under way, soonest first. */
export async function listMaintenance(db: Queryable, now: Date): Promise<MaintenanceWindow[]> {
  const rows = await db.select().from(maintenanceWindows)
    .where(and(live, gt(maintenanceWindows.endsAt, now)))
    .orderBy(asc(maintenanceWindows.startsAt));
  return rows.map(view);
}

/** The window still ahead or under way, soonest first. */
export async function nextMaintenance(db: Queryable, now: Date): Promise<MaintenanceWindow | null> {
  const [row] = await db.select().from(maintenanceWindows)
    .where(and(live, gt(maintenanceWindows.endsAt, now)))
    .orderBy(asc(maintenanceWindows.startsAt)).limit(1);
  return row ? view(row) : null;
}

export async function scheduleMaintenance(db: Db, input: { startsAt: Date; minutes: number; now: Date }): Promise<MaintenanceWindow> {
  const { startsAt, minutes, now } = input;
  if (!Number.isInteger(minutes) || minutes < MAINTENANCE.minMinutes || minutes > MAINTENANCE.maxMinutes) {
    throw new GameError('MAINTENANCE_LENGTH',
      `A window lasts ${String(MAINTENANCE.minMinutes)}–${String(MAINTENANCE.maxMinutes)} minutes`, 400);
  }
  if (startsAt.getTime() < now.getTime() + MAINTENANCE.noticeHours * HOUR_MS) {
    throw new GameError('MAINTENANCE_NOTICE', `A window is announced ${String(MAINTENANCE.noticeHours)} hours ahead`, 409);
  }
  const endsAt = new Date(startsAt.getTime() + minutes * 60_000);
  return db.transaction(async (tx) => {
    // One scheduler at a time, so two overlapping windows cannot both pass the check.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('maintenance_windows', 0))`);
    const [overlap] = await tx.select({ id: maintenanceWindows.id }).from(maintenanceWindows)
      .where(and(live, lt(maintenanceWindows.startsAt, endsAt), gt(maintenanceWindows.endsAt, startsAt))).limit(1);
    if (overlap) throw new GameError('MAINTENANCE_OVERLAP', 'Another window is already planned then', 409);
    const clearOfEnds = MAINTENANCE.seasonEndClearHours * HOUR_MS;
    const [ending] = await tx.select({ endsAt: seasons.endsAt }).from(seasons).where(and(eq(seasons.status, 'live'),
      gte(seasons.endsAt, new Date(startsAt.getTime() - clearOfEnds)), lte(seasons.endsAt, new Date(endsAt.getTime() + clearOfEnds))))
      .limit(1);
    if (ending) {
      throw new GameError('MAINTENANCE_SEASON_END', 'A window stays clear of a season end', 409,
        { seasonEndsAt: ending.endsAt.toISOString() });
    }
    const clearOfEvents = MAINTENANCE.eventClearHours * HOUR_MS;
    const [event] = await tx.select({ kind: galaxyEventOccurrences.kind, startsAt: galaxyEventOccurrences.startsAt })
      .from(galaxyEventOccurrences)
      .innerJoin(seasons, and(eq(seasons.id, galaxyEventOccurrences.seasonId), eq(seasons.status, 'live')))
      .where(and(inArray(galaxyEventOccurrences.kind, [...MAINTENANCE.bigEvents]),
        lt(galaxyEventOccurrences.startsAt, new Date(endsAt.getTime() + clearOfEvents)),
        gt(galaxyEventOccurrences.endsAt, new Date(startsAt.getTime() - clearOfEvents))))
      .limit(1);
    if (event) {
      throw new GameError('MAINTENANCE_EVENT', 'A window stays clear of a big galaxy event', 409,
        { kind: event.kind, eventStartsAt: event.startsAt.toISOString() });
    }
    const [row] = await tx.insert(maintenanceWindows).values({ startsAt, endsAt, createdAt: now }).returning();
    if (!row) throw new Error('maintenance window insert returned no row');
    return view(row);
  });
}

export async function cancelMaintenance(db: Queryable, id: string, now: Date): Promise<void> {
  const cancelled = await db.update(maintenanceWindows).set({ cancelledAt: now })
    .where(and(eq(maintenanceWindows.id, id), live)).returning({ id: maintenanceWindows.id });
  if (cancelled.length === 0) throw new GameError('MAINTENANCE_NOT_FOUND', 'No such planned window', 404);
}

/** The first live window that, widened by the guard, touches `[from, to]`. */
async function windowTouching(db: Queryable, from: Date, to: Date): Promise<MaintenanceWindow | null> {
  const [row] = await db.select().from(maintenanceWindows).where(and(live,
    lte(maintenanceWindows.startsAt, new Date(to.getTime() + GUARD_MS)),
    gte(maintenanceWindows.endsAt, new Date(from.getTime() - GUARD_MS))))
    .orderBy(asc(maintenanceWindows.startsAt)).limit(1);
  return row ? view(row) : null;
}

const spanOf = (window: MaintenanceWindow) =>
  ({ startsAt: window.startsAt.toISOString(), endsAt: window.endsAt.toISOString() });

/** A raid, a strike or a wave: refused when any of its instants lands inside a window. */
export async function assertLandsOutsideMaintenance(db: Queryable, instants: readonly Date[]): Promise<void> {
  for (const instant of instants) {
    const window = await windowTouching(db, instant, instant);
    if (window) {
      throw new GameError('MAINTENANCE_LANDING',
        'This fleet would land during maintenance; choose another speed or send it after', 409, spanOf(window));
    }
  }
}

/**
 * A Death Star or a radiation bomb: refused when any part of its flight is inside a
 * window (owner, 2026-10-30). The interceptor that may meet it fires on the defender's
 * sensors along the way, so its instant is not known at launch; only a flight wholly
 * clear of the window keeps every collision out of it.
 */
export async function assertFliesOutsideMaintenance(db: Queryable, from: Date, to: Date): Promise<void> {
  const window = await windowTouching(db, from, to);
  if (window) {
    throw new GameError('MAINTENANCE_IN_FLIGHT',
      'This weapon would be in the air during maintenance; launch it after', 409, spanOf(window));
  }
}
