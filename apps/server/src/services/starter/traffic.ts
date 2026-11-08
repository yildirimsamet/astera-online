import { createHash } from 'node:crypto';
import { STARTER, distance, fleetCount, massClass, moduleStage, pointAlong, sensorZone, vesselSphere, type Fleet, type Vec3 } from '@astera/rules';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Queryable } from '../../db/client.js';
import { starterSites, vesselMissions, vesselOrders, vessels } from '../../db/schema.js';
import { GameError } from '../planet.js';
import { windowOf } from '../traffic.js';
import { progressOf, refuseLeft, type VesselRow } from './vessel.js';
import { missionFrom, missionTo, placeOf, siteName, type MissionRow } from './world.js';

async function shipOf(q: Queryable, accountId: string): Promise<VesselRow> {
  const [row] = await q.select().from(vessels).where(eq(vessels.accountId, accountId));
  if (!row) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);
  refuseLeft(row);
  return row;
}

const KIND_ON_THE_MAP = { PROBE: 'probe', ATTACK: 'fleet', RAID_SITE: 'fleet', MINE: 'mining', SCOUT: 'fleet', PIRATE: 'pirate', PASSING: 'fleet' } as const;

/** Stable for one flight, so that focus survives a refetch, and it maps to nothing else. */
const contactId = (missionId: string): string => createHash('sha256').update(`contact:${missionId}`).digest('hex').slice(0, 22);

/** A leg as it is flown right now, whichever way it is going. */
function legOf(mission: MissionRow) {
  if (mission.status === 'OUTBOUND') return { from: missionFrom(mission), to: missionTo(mission), departAt: mission.departAt, arriveAt: mission.arriveAt };
  if (mission.status === 'RETURNING' && mission.returnAt) return { from: missionTo(mission), to: missionFrom(mission), departAt: mission.arriveAt, arriveAt: mission.returnAt };
  return null;
}

/** Only the already-flown segment, while the observer actually owned this reach. */
function seenOnLeg(leg: NonNullable<ReturnType<typeof legOf>>, at: Vec3, reach: number, since: Date, now: Date): boolean {
  const depart = leg.departAt.getTime(), span = leg.arriveAt.getTime() - depart;
  const start = Math.max(depart, since.getTime()), end = Math.min(now.getTime(), leg.arriveAt.getTime());
  if (span <= 0 || end < start) return false;
  const a = pointAlong(leg.from, leg.to, (start-depart)/span);
  const b = pointAlong(leg.from, leg.to, (end-depart)/span);
  const d = {x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
  const squared = d.x*d.x+d.y*d.y+d.z*d.z;
  const t = squared === 0 ? 0 : Math.max(0,Math.min(1,((at.x-a.x)*d.x+(at.y-a.y)*d.y+(at.z-a.z)*d.z)/squared));
  return distance(at, pointAlong(a,b,t)) <= reach;
}

/**
 * OTHER PEOPLE'S CRAFT, THROUGH THIS SHIP'S EYES. Plan §3.5. Position is public and intent is not, so
 * a contact carries a bearing window and never an owner or a target. Radar alone is a mark of no
 * known kind; inside the telescope it has a kind and a tally.
 */
export async function starterTrafficView(db: Db, accountId: string, clock: Clock) {
  const row = await shipOf(db, accountId);
  const now = clock.now();
  const progress = progressOf(row);
  const sphere = vesselSphere(placeOf(row), moduleStage(progress, 'TELESCOPE'), moduleStage(progress, 'RADAR'), row.id);
  const flights = await db.select().from(vesselMissions).where(and(
    eq(vesselMissions.starterGalaxyId, row.starterGalaxyId), inArray(vesselMissions.status, ['OUTBOUND', 'RETURNING']),
  ));
  const telescope = moduleStage(progress, 'TELESCOPE');
  const orders = await db.select({stage:vesselOrders.stage,since:vesselOrders.readyAt}).from(vesselOrders).where(and(
    eq(vesselOrders.vesselId,row.id),eq(vesselOrders.subject,'TELESCOPE'),eq(vesselOrders.status,'DONE'),
  ));
  const eyes = [
    {reach:STARTER.nakedEye,since:row.sightSince},
    ...orders.filter(order=>order.stage<=telescope).map(order=>({reach:vesselSphere(placeOf(row),order.stage,0).identify,since:new Date(Math.max(order.since.getTime(),row.sightSince.getTime()))})),
  ];
  const contacts = flights.flatMap((mission) => {
    if (mission.ownerVesselId === row.id) return [];
    const leg = legOf(mission);
    if (!leg) return [];
    const window = windowOf(leg.from, leg.to, leg.departAt, leg.arriveAt, now);
    if (!window) return [];
    const zone = sensorZone([sphere], window.from);
    const remembered = eyes.some(eye=>seenOnLeg(leg,placeOf(row),eye.reach,eye.since,now));
    if (zone === 'NONE' && !remembered) return [];
    const identified = zone === 'IDENTIFIED' || remembered;
    const hasFleet = fleetCount(mission.fleet) > 0;
    return [{
      id: contactId(mission.id),
      kind: identified ? KIND_ON_THE_MAP[mission.kind] : 'unknown' as const,
      ...window,
      ...(identified && hasFleet ? { fleet: mission.fleet, mass: massClass(mission.fleet) } : {}),
      ...(identified && mission.kind === 'SCOUT' ? { scout: true as const } : {}),
      // A scout comes to look from a distance: nothing is coming for this ship.
      ...(mission.targetVesselId === row.id && mission.status === 'OUTBOUND' && mission.kind !== 'SCOUT' ? { inbound: true as const } : {}),
    }];
  });
  return { contacts };
}

const minutesLeft = (to: Date, now: Date): number => Math.max(0, (to.getTime() - now.getTime()) / 60_000);

/** One thread of the bottom strip: this ship's own craft. */
export function ownThread(mission: MissionRow, targetName: string, now: Date) {
  const outbound = mission.status === 'OUTBOUND';
  const arriveAt = outbound ? mission.arriveAt : mission.returnAt ?? mission.arriveAt;
  const kind = mission.kind === 'PROBE' ? 'probe' as const : 'fleet' as const;
  return {
    id: mission.id,
    kind,
    targetName,
    minutesRemaining: minutesLeft(arriveAt, now),
    arriveAt,
    ...(mission.returnAt ? { homeAt: mission.returnAt } : {}),
    leg: outbound ? 'outbound' as const : 'return' as const,
    ...(fleetCount(mission.fleet) > 0 ? { fleet: mission.fleet } : {}),
    ...(mission.targetVesselId ? { targetPlanetId: mission.targetVesselId } : {}),
    ...(mission.targetSiteId ? { targetPlanetId: mission.targetSiteId } : {}),
    recallable: outbound && mission.kind !== 'PROBE',
    path: outbound
      ? { from: missionFrom(mission), to: missionTo(mission), departAt: mission.departAt, arriveAt: mission.arriveAt }
      : { from: missionTo(mission), to: missionFrom(mission), departAt: mission.arriveAt, arriveAt },
  };
}

/** What is flying because of this ship, and what its radar says is coming for it. */
export async function starterPendingView(q: Queryable, row: VesselRow, clock: Clock) {
  const now = clock.now();
  const own = await q.select().from(vesselMissions).where(and(
    eq(vesselMissions.ownerVesselId, row.id), inArray(vesselMissions.status, ['OUTBOUND', 'RETURNING']), ne(vesselMissions.kind, 'MINE'),
  ));
  const shipIds = own.flatMap(m => m.targetVesselId ? [m.targetVesselId] : []);
  const siteIds = own.flatMap(m => m.targetSiteId ? [m.targetSiteId] : []);
  const names = new Map<string, string>();
  if (shipIds.length > 0) for (const ship of await q.select({ id: vessels.id, name: vessels.name }).from(vessels).where(inArray(vessels.id, shipIds))) names.set(ship.id, ship.name);
  if (siteIds.length > 0) for (const site of await q.select({ id: starterSites.id, kind: starterSites.kind }).from(starterSites).where(inArray(starterSites.id, siteIds))) names.set(site.id, siteName(site));
  const threads = own.map(mission => ownThread(mission, names.get(mission.targetVesselId ?? mission.targetSiteId ?? '') ?? '', now));

  const progress = progressOf(row);
  const sphere = vesselSphere(placeOf(row), moduleStage(progress, 'TELESCOPE'), moduleStage(progress, 'RADAR'), row.id);
  const inbound = await q.select().from(vesselMissions).where(and(
    eq(vesselMissions.targetVesselId, row.id), eq(vesselMissions.status, 'OUTBOUND'), inArray(vesselMissions.kind, ['ATTACK', 'PIRATE', 'SCOUT']),
  ));
  const incoming = inbound.flatMap((mission) => {
    const span = mission.arriveAt.getTime() - mission.departAt.getTime();
    const at = pointAlong(missionFrom(mission), missionTo(mission), span > 0 ? (now.getTime() - mission.departAt.getTime()) / span : 1);
    const zone = sensorZone([sphere], at);
    if (zone === 'NONE') return [];
    const fleet: Fleet = mission.fleet;
    return [{
      contactId: contactId(mission.id),
      kind: 'incoming' as const,
      targetName: row.name,
      targetPlanetId: row.id,
      minutesRemaining: minutesLeft(mission.arriveAt, now),
      arriveAt: mission.arriveAt,
      ...(zone === 'IDENTIFIED' ? { fleet, mass: massClass(fleet), ...(mission.kind === 'ATTACK' ? {} : { raider: mission.kind }) } : {}),
    }];
  });
  return { pending: [...threads, ...incoming] };
}

export const readStarterPending = async (db: Db, accountId: string, clock: Clock) =>
  starterPendingView(db, await shipOf(db, accountId), clock);
