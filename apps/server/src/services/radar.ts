import {
  RADAR_RANGES,
  coreTier,
  orbitStandoff,
  sensorLeadOnVisualLeg,
  surfaceStandoff,
  worldRadius,
  type Vec3,
} from '@astera/rules';
import { and, eq, gt, inArray, or } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { missions, planets, scheduledEvents } from '../db/schema.js';

interface InboundLeg {
  from: Vec3;
  to: Vec3;
  originCoreLevel: number;
  targetCoreLevel: number;
  oneWayMinutes: number;
}

/** The timed Radar crossing for the exact leg players see on the galaxy. */
export function inboundRadarLead(range: number, leg: InboundLeg): number {
  const start = surfaceStandoff(worldRadius(coreTier(leg.originCoreLevel)));
  const end = orbitStandoff(worldRadius(coreTier(leg.targetCoreLevel)));
  return sensorLeadOnVisualLeg(
    range,
    leg.from,
    leg.to,
    start,
    end,
    leg.oneWayMinutes,
  );
}

/**
 * SLACK ON EVERY RADAR CROSSING, IN MINUTES.
 *
 * A check armed for `arriveAt − 12` that the worker claims forty milliseconds late
 * reads 11.999 against a 12-minute lead. Without this it decides the defender has
 * not earned the warning and silently demotes a Radar 5 to the 8-minute rung — and
 * on the way down it re-chooses the shell it just crossed and reschedules for the
 * instant it already fired at. One figure, read by both decisions, so they cannot
 * disagree about whether a shell has been crossed.
 */
export const LEAD_TOLERANCE = 0.05;

/**
 * THE SHOT RESOLVES A BEAT BEFORE THE SIREN THAT WOULD DESCRIBE IT. T10.
 *
 * An interception and the warning it makes untrue are armed for the same crossing
 * of the same circle, on the same mission — so they share a `resolveAt` AND a
 * `refId`, and the worker's remaining tiebreak is a random UUID. Half the time the
 * defender would be told "incoming" in the same tick as "you destroyed it".
 *
 * A second is enough to make the order a fact rather than a coin toss, and it is
 * the honest description of what happens: the weapon dies, and then the siren has
 * nothing to announce. `onRadarWarning` re-reads the mission besides, so a
 * redelivery cannot reopen the hole.
 */
export const interceptBefore = (at: Date): Date => new Date(at.getTime() - 1_000);

/**
 * Next Radar boundary that the moving marker has not crossed yet.
 *
 * THE TOLERANCE IS WHAT STOPS THIS RESCHEDULING ITSELF FOR EVER, and the loop is
 * not hypothetical: a check armed for the crossing of one shell fires at an
 * instant the database rounded to the millisecond, so the remaining minutes come
 * back a hair LARGER than the lead that produced them. `lead < remaining` is then
 * true for the shell just crossed, the same rung is chosen again, the event is
 * rescheduled for the instant it already fired at, and the worker spins on it
 * until the fleet lands. Every rung below the top is exposed to it.
 *
 * `LEAD_TOLERANCE` is the same slack the fire check uses on the way in — a shell
 * within it has been crossed — so the two decisions agree by construction.
 */
export function nextInboundRadarCheck(
  minutesRemaining: number,
  leg: InboundLeg,
): number | null {
  return RADAR_RANGES.find(
    (range) => inboundRadarLead(range, leg) < minutesRemaining - LEAD_TOLERANCE,
  ) ?? null;
}

/**
 * A Core tier changes both endpoints of every visual leg touching that world.
 * Wake the one pending Radar check immediately so it can recompute the crossing;
 * otherwise a marker can move across a shell while its old warning sleeps.
 */
export async function recheckRadarLegsForWorld(
  db: Queryable,
  planetId: string,
  now: Date,
): Promise<void> {
  const affected = db
    .select({ id: missions.id })
    .from(missions)
    .where(and(
      eq(missions.status, 'in_flight'),
      inArray(missions.kind, ['attack', 'death_star']),
      or(eq(missions.originPlanetId, planetId), eq(missions.targetPlanetId, planetId)),
    ));

  await db
    .update(scheduledEvents)
    .set({ resolveAt: now })
    .where(and(
      eq(scheduledEvents.kind, 'radar_warning'),
      eq(scheduledEvents.status, 'pending'),
      gt(scheduledEvents.resolveAt, now),
      inArray(scheduledEvents.refId, affected),
    ));
}

/**
 * Installing Radar (or its Uplink) late in a flight must still buy the remaining
 * warning. The ordinary ladder deliberately stops scheduling once the craft is
 * inside its narrowest shell, so installation also creates a fresh immediate
 * check when no live check remains.
 */
export async function wakeInboundRadarWarnings(
  db: Queryable,
  planetId: string,
  now: Date,
): Promise<void> {
  const inbound = await db
    .select({ id: missions.id, seasonId: missions.seasonId })
    .from(missions)
    .where(and(
      eq(missions.status, 'in_flight'),
      gt(missions.arriveAt, now),
      eq(missions.targetPlanetId, planetId),
      inArray(missions.kind, ['attack', 'death_star']),
    ));
  if (inbound.length === 0) return;

  const ids = inbound.map((mission) => mission.id);
  await db
    .update(scheduledEvents)
    .set({ resolveAt: now })
    .where(and(
      eq(scheduledEvents.kind, 'radar_warning'),
      eq(scheduledEvents.status, 'pending'),
      gt(scheduledEvents.resolveAt, now),
      inArray(scheduledEvents.refId, ids),
    ));

  const live = await db
    .select({ refId: scheduledEvents.refId })
    .from(scheduledEvents)
    .where(and(
      eq(scheduledEvents.kind, 'radar_warning'),
      inArray(scheduledEvents.status, ['pending', 'processing']),
      inArray(scheduledEvents.refId, ids),
    ));
  const liveIds = new Set(live.flatMap((event) => event.refId ? [event.refId] : []));
  const missing = inbound.filter((mission) => !liveIds.has(mission.id));
  if (missing.length > 0) {
    await db.insert(scheduledEvents).values(missing.map((mission) => ({
      seasonId: mission.seasonId,
      kind: 'radar_warning' as const,
      refId: mission.id,
      resolveAt: now,
    })));
  }
}

/**
 * Re-evaluate Death Stars aimed at any world owned by this commander's sensor
 * network. Radar intent belongs to the target world, while Telescope sight is the
 * union of every controlled world, so a Telescope upgrade on a colony may wake a
 * shot defending the capital.
 */
export async function wakeStrategicInterceptions(
  db: Queryable,
  changedPlanetId: string,
  now: Date,
): Promise<void> {
  const [changed] = await db
    .select({ playerId: planets.controllerPlayerId })
    .from(planets)
    .where(eq(planets.id, changedPlanetId))
    .limit(1);
  if (!changed?.playerId) return;

  const owned = await db
    .select({ id: planets.id })
    .from(planets)
    .where(eq(planets.controllerPlayerId, changed.playerId));
  if (owned.length === 0) return;
  const inbound = await db
    .select({ id: missions.id, seasonId: missions.seasonId })
    .from(missions)
    .where(and(
      eq(missions.kind, 'death_star'),
      eq(missions.status, 'in_flight'),
      gt(missions.arriveAt, now),
      inArray(missions.targetPlanetId, owned.map((world) => world.id)),
    ));
  if (inbound.length === 0) return;

  const ids = inbound.map((mission) => mission.id);
  await db
    .update(scheduledEvents)
    .set({ resolveAt: now })
    .where(and(
      eq(scheduledEvents.kind, 'strategic_intercept'),
      eq(scheduledEvents.status, 'pending'),
      gt(scheduledEvents.resolveAt, now),
      inArray(scheduledEvents.refId, ids),
    ));
  const live = await db
    .select({ refId: scheduledEvents.refId })
    .from(scheduledEvents)
    .where(and(
      eq(scheduledEvents.kind, 'strategic_intercept'),
      inArray(scheduledEvents.status, ['pending', 'processing']),
      inArray(scheduledEvents.refId, ids),
    ));
  const liveIds = new Set(live.flatMap((row) => row.refId ? [row.refId] : []));
  const missing = inbound.filter((mission) => !liveIds.has(mission.id));
  if (missing.length > 0) {
    await db.insert(scheduledEvents).values(missing.map((mission) => ({
      seasonId: mission.seasonId,
      kind: 'strategic_intercept' as const,
      refId: mission.id,
      resolveAt: now,
    })));
  }
}
