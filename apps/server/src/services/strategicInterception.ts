import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import {
  ANTI_STRATEGIC,
  distance,
  interceptionRange,
  orbitStandoff,
  pointAlong,
  sensorSphere,
  sphereEntryFraction,
  surfaceStandoff,
  visualLeg,
  worldRadius,
  type SensorSphere,
  type Vec3,
} from '@astera/rules';
import { addMinutes } from '../clock.js';
import type { Tx } from '../db/client.js';
import {
  buildings,
  missions,
  planets,
  strategicAssets,
  strategicInterceptions,
} from '../db/schema.js';
import { publishStrategicSight } from '../stream/bus.js';
import { schedule } from '../worker/queue.js';
import { instrumentLevels, levelOf } from './intel.js';
import { LEAD_TOLERANCE, inboundRadarLead, interceptBefore } from './radar.js';

/**
 * WHERE A DEATH STAR CAN BE SHOT DOWN, AND THE SHOT ITSELF. T10 · D139.
 *
 * A strategic weapon may be engaged in exactly two ways:
 *
 *   1. the TARGET world's effective Radar is L3+ and the weapon has crossed that
 *      Radar rung; L1/L2 deliberately have no interception circle;
 *   2. the weapon is IDENTIFIED by the Telescope sight of ANY world controlled by
 *      the defender.
 *
 * A ready charge still belongs to the target world. Seeing a weapon from a colony
 * does not teleport that colony's ammunition to the capital.
 *
 * TWO CALLERS, ONE STATEMENT. The `strategic_intercept` event fires the shot on
 * time; the arrival settles any shot a late queue still owed (`interceptOwedShot`).
 * Both read the zones and fire through this file, so the two can never disagree
 * about where the weapon could have died.
 */

type Mission = typeof missions.$inferSelect;
export type InterceptionTrigger = 'RADAR' | 'TELESCOPE';

/** One inbound weapon's leg, and every circle along it that can engage it. */
export interface InterceptionLeg {
  mission: Mission;
  target: { id: string; controllerPlayerId: string; x: number; y: number; z: number };
  /** The leg exactly as the disc draws it — the geometry the zones are solved on. */
  drawn: { from: Vec3; to: Vec3 };
  totalMs: number;
  /** Minutes before arrival the weapon enters the target's interception ring; 0 when there is none. */
  radarLead: number;
  /** Every Telescope the defender holds, on any world. */
  telescopes: SensorSphere[];
}

/**
 * Read one weapon's leg against the defender as the world stands now. Null for a
 * world nobody holds: a caretaker world has no commander, no research and nothing
 * to fire.
 */
export async function interceptionLeg(tx: Tx, mission: Mission): Promise<InterceptionLeg | null> {
  const [target] = await tx.select().from(planets).where(eq(planets.id, mission.targetPlanetId));
  if (!target?.controllerPlayerId) return null;

  const [ownedWorlds, [origin]] = await Promise.all([
    tx.select({
      id: planets.id,
      x: planets.x,
      y: planets.y,
      z: planets.z,
    }).from(planets).where(eq(planets.controllerPlayerId, target.controllerPlayerId)),
    tx.select().from(planets).where(eq(planets.id, mission.originPlanetId)),
  ]);
  if (!origin) return null;

  const worldIds = [...new Set([
    mission.originPlanetId,
    mission.targetPlanetId,
    ...ownedWorlds.map((world) => world.id),
  ])];
  const [coreRows, levels] = await Promise.all([
    tx.select({ planetId: buildings.planetId, level: buildings.level })
      .from(buildings)
      .where(and(inArray(buildings.planetId, worldIds), eq(buildings.type, 'CORE'))),
    instrumentLevels(tx, worldIds),
  ]);

  const coreByPlanet = new Map(coreRows.map((row) => [row.planetId, row.level]));
  const originPoint = { x: origin.x, y: origin.y, z: origin.z };
  const targetPoint = { x: target.x, y: target.y, z: target.z };
  const timedLeg = {
    from: originPoint,
    to: targetPoint,
    originCoreLevel: coreByPlanet.get(origin.id) ?? 1,
    targetCoreLevel: coreByPlanet.get(target.id) ?? 1,
    oneWayMinutes: (mission.arriveAt.getTime() - mission.departAt.getTime()) / 60_000,
  };

  // `interceptionRange` is zero at L1/L2. Do not replace this with the wider
  // contact radius: detection and anti-strategic engagement are separate rules.
  const reach = interceptionRange(levelOf(levels, target.id, 'RADAR'));
  const telescopes = ownedWorlds.flatMap((world) => {
    const telescope = levelOf(levels, world.id, 'TELESCOPE');
    // The general sight model has a naked-eye floor for drawing nearby craft.
    // This rule explicitly requires Telescope sight, so no installed/effective
    // Telescope means no optical interception sphere.
    return telescope <= 0 ? [] : [sensorSphere(
      { x: world.x, y: world.y, z: world.z },
      telescope,
      0,
      world.id,
    )];
  });

  return {
    mission,
    target: { ...targetPoint, id: target.id, controllerPlayerId: target.controllerPlayerId },
    drawn: visualLeg(
      originPoint,
      targetPoint,
      surfaceStandoff(worldRadius(timedLeg.originCoreLevel)),
      orbitStandoff(worldRadius(timedLeg.targetCoreLevel)),
    ),
    totalMs: Math.max(1, mission.arriveAt.getTime() - mission.departAt.getTime()),
    radarLead: reach > 0 ? inboundRadarLead(reach, timedLeg) : 0,
    telescopes,
  };
}

const progressAt = (leg: InterceptionLeg, at: Date): number =>
  (at.getTime() - leg.mission.departAt.getTime()) / leg.totalMs;

/** Where the weapon is drawn at `at`. */
const pointAt = (leg: InterceptionLeg, at: Date): Vec3 =>
  pointAlong(leg.drawn.from, leg.drawn.to, progressAt(leg, at));

/** The zone the weapon stands in at `at`, if any. Radar wins a tie, as it always has. */
export function triggerAt(leg: InterceptionLeg, at: Date): InterceptionTrigger | null {
  const remaining = (leg.mission.arriveAt.getTime() - at.getTime()) / 60_000;
  if (leg.radarLead > 0 && remaining <= leg.radarLead + LEAD_TOLERANCE) return 'RADAR';
  const point = pointAt(leg, at);
  // The crossing solver resolves to milliseconds while positions are continuous.
  // One game unit is less than a second on this leg and prevents an exact edge
  // from being rounded a fraction outside and then losing its only event.
  return leg.telescopes.some((sphere) => distance(sphere.at, point) <= sphere.identify + 1)
    ? 'TELESCOPE'
    : null;
}

/**
 * The next boundary the weapon has not crossed yet, and the instant the queue
 * should wake for it. Radar shares a boundary with its warning and must win that
 * ordering, so it wakes a beat early; a Telescope has no competing siren and
 * wakes on the exact sight edge.
 */
export function nextCheckAt(leg: InterceptionLeg, now: Date): Date | null {
  const candidates: { at: Date; radar: boolean }[] = [];
  if (leg.radarLead > 0) {
    const crossing = addMinutes(leg.mission.arriveAt, -leg.radarLead);
    if (crossing.getTime() > now.getTime()) candidates.push({ at: crossing, radar: true });
  }
  const current = pointAt(leg, now);
  const remainingFraction = Math.max(0, 1 - Math.max(0, Math.min(1, progressAt(leg, now))));
  for (const sphere of leg.telescopes) {
    const fraction = sphereEntryFraction(current, leg.drawn.to, sphere.at, sphere.identify);
    if (fraction === null || fraction <= 0) continue;
    const at = new Date(now.getTime() + leg.totalMs * remainingFraction * fraction);
    if (at.getTime() > now.getTime() && at.getTime() < leg.mission.arriveAt.getTime()) {
      candidates.push({ at, radar: false });
    }
  }
  const next = candidates.toSorted((a, b) => a.at.getTime() - b.at.getTime())[0];
  if (!next) return null;
  return next.radar ? interceptBefore(next.at) : next.at;
}

/**
 * THE FIRST INSTANT AT OR AFTER `from`, BEFORE ARRIVAL, THE WEAPON STOOD IN A ZONE.
 *
 * Each zone is one interval along a straight leg — the ring from its crossing to
 * the world, a Telescope sphere from entry to exit — so the earliest shot owed
 * since `from` always begins at `from` itself or at a zone's entry. Those are the
 * only candidates, and each is checked with the same `triggerAt` the event uses.
 */
export function firstShotSince(
  leg: InterceptionLeg,
  from: Date,
): { at: Date; trigger: InterceptionTrigger } | null {
  const arrive = leg.mission.arriveAt.getTime();
  const floor = Math.max(from.getTime(), leg.mission.departAt.getTime());
  const candidates = [floor];
  if (leg.radarLead > 0) {
    candidates.push(addMinutes(leg.mission.arriveAt, -leg.radarLead).getTime());
  }
  for (const sphere of leg.telescopes) {
    const fraction = sphereEntryFraction(leg.drawn.from, leg.drawn.to, sphere.at, sphere.identify);
    if (fraction !== null) candidates.push(leg.mission.departAt.getTime() + leg.totalMs * fraction);
  }
  const ordered = candidates.filter((at) => at >= floor && at < arrive).toSorted((a, b) => a - b);
  for (const instant of ordered) {
    const at = new Date(instant);
    const trigger = triggerAt(leg, at);
    if (trigger) return { at, trigger };
  }
  return null;
}

/**
 * ONE CHARGE, AND EXACTLY ONE WEAPON MAY HAVE IT — spent at `at`.
 *
 * The caller holds the charge row FOR UPDATE; the guarded update is what makes
 * it safe even if that lock is ever lost: a second writer updates nothing and
 * its own strike goes on to land. D139's whole balance is that a loaded defender
 * stops the FIRST weapon and the stockpile is the reply.
 *
 * `claimMission` is false only for the arrival, which has already claimed it.
 */
export async function fireInterception(
  tx: Tx,
  leg: InterceptionLeg,
  chargeId: string,
  at: Date,
  trigger: InterceptionTrigger,
  options: { claimMission: boolean },
): Promise<boolean> {
  const { mission, target } = leg;
  const spent = await tx
    .update(strategicAssets)
    .set({ status: 'CONSUMED', missionId: mission.id })
    .where(and(
      eq(strategicAssets.id, chargeId),
      eq(strategicAssets.status, 'READY'),
    ))
    .returning({ id: strategicAssets.id });
  if (!spent[0]) return false;
  if (options.claimMission) {
    const claimed = await tx
      .update(missions)
      .set({ status: 'resolved' })
      .where(and(eq(missions.id, mission.id), eq(missions.status, 'in_flight')))
      .returning({ id: missions.id });
    // The caller locked an in-flight mission, so this cannot miss. If it ever
    // does, roll back rather than commit a charge spent on nothing.
    if (!claimed[0]) throw new Error(`interception lost mission ${mission.id} after spending ${chargeId}`);
  }
  await tx
    .update(strategicAssets)
    .set({ status: 'CONSUMED' })
    .where(and(eq(strategicAssets.missionId, mission.id), eq(strategicAssets.type, 'DEATH_STAR')));

  /*
    FIRE IMMEDIATELY; LET THE FLIGHT PROVIDE THE REACTION WINDOW.

    Delaying launch would make a ready defence look inert and could let the
    Death Star arrive while its counter was deliberately waiting. The missile
    instead takes eight seconds to meet it. If a charge becomes ready inside
    those final eight seconds, clamp the cinematic to the remaining journey so
    the interception can never explode after the strike's original arrival.
  */
  const flightMs = Math.min(
    ANTI_STRATEGIC.flightSeconds * 1_000,
    mission.arriveAt.getTime() - at.getTime(),
  );
  const impactAt = new Date(at.getTime() + flightMs);
  const from = pointAt(leg, at);
  const collision = pointAt(leg, impactAt);
  await tx.insert(strategicInterceptions).values({
    seasonId: mission.seasonId,
    missionId: mission.id,
    attackerPlayerId: mission.ownerPlayerId,
    defenderPlayerId: target.controllerPlayerId,
    targetPlanetId: target.id,
    chargeId,
    trigger,
    launchAt: at,
    impactAt,
    launchX: target.x,
    launchY: target.y,
    launchZ: target.z,
    deathStarFromX: from.x,
    deathStarFromY: from.y,
    deathStarFromZ: from.z,
    collisionX: collision.x,
    collisionY: collision.y,
    collisionZ: collision.z,
  });
  await schedule(tx, {
    seasonId: mission.seasonId,
    kind: 'strategic_intercept_impact',
    refId: mission.id,
    resolveAt: impactAt,
  });

  /*
    THE LAUNCH INSTANT IS NOT A GALAXY-WIDE FACT. D139.

    A shard `impact` here told every connected commander that a hidden weapon
    had just been intercepted, eight seconds before the public Chronicle moment.
    Address the two participants and only effective-Telescope witnesses instead;
    each recipient still refetches in time to see the rocket leave the planet.
  */
  const witnessWorlds = await tx
    .select({
      id: planets.id,
      controllerPlayerId: planets.controllerPlayerId,
      x: planets.x,
      y: planets.y,
      z: planets.z,
    })
    .from(planets)
    .where(and(
      eq(planets.seasonId, mission.seasonId),
      isNotNull(planets.controllerPlayerId),
    ));
  const witnessLevels = await instrumentLevels(tx, witnessWorlds.map((world) => world.id));
  const audience = new Set([mission.ownerPlayerId, target.controllerPlayerId]);
  for (const world of witnessWorlds) {
    const telescope = levelOf(witnessLevels, world.id, 'TELESCOPE');
    if (telescope <= 0 || !world.controllerPlayerId) continue;
    const sight = sensorSphere({ x: world.x, y: world.y, z: world.z }, telescope, 0, world.id);
    if (distance(sight.at, collision) <= sight.identify) audience.add(world.controllerPlayerId);
  }
  for (const playerId of audience) await publishStrategicSight(tx, playerId);
  return true;
}

/**
 * THE SHOT A LATE QUEUE STILL OWES, SETTLED BY THE ARRIVAL. CLAUDE.md: timed
 * systems tolerate restarts.
 *
 * A whole strike is one to nine minutes and the ring sits a minute and a half to
 * two from the world, so a worker held by a deploy can wake after the weapon has
 * already landed. The event then found no time left and did nothing, and the
 * arrival in the same batch struck a world whose battery had been loaded the
 * whole way in. A charge that became ready while the queue slept is the same
 * story: its completion wakes a check that lands in the NEXT batch, behind the
 * arrival.
 *
 * So the arrival asks the question itself, before it strikes: was there an
 * instant before arrival at which the weapon stood in a zone WITH a charge ready?
 * If so the shot is taken at that instant — the same zones, the same collision,
 * the same cinematic record — and the weapon never arrives. This is not an
 * arrival-time rule: on a punctual worker the event has already fired and the
 * mission never reaches here in flight.
 *
 * The world is read as it stands at the arrival, which after an in-order catch-up
 * is the world as it stood at the arrival instant.
 */
export async function interceptOwedShot(tx: Tx, mission: Mission): Promise<boolean> {
  const leg = await interceptionLeg(tx, mission);
  if (!leg) return false;
  const charges = await tx
    .select({
      id: strategicAssets.id,
      readyAt: strategicAssets.readyAt,
      startedAt: strategicAssets.startedAt,
    })
    .from(strategicAssets)
    .where(and(
      eq(strategicAssets.planetId, leg.target.id),
      eq(strategicAssets.type, 'INTERCEPTOR'),
      eq(strategicAssets.status, 'READY'),
    ))
    .for('update');
  // A completed build keeps the instant it finished; a charge with none has been
  // ready since it was placed.
  const readySince = (charge: (typeof charges)[number]): Date => charge.readyAt ?? charge.startedAt;
  const [charge] = charges.toSorted((a, b) => readySince(a).getTime() - readySince(b).getTime());
  if (!charge) return false;
  const shot = firstShotSince(leg, readySince(charge));
  if (!shot) return false;
  return fireInterception(tx, leg, charge.id, shot.at, shot.trigger, { claimMission: false });
}
