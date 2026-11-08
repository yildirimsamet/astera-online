import {
  PROSPECTOR, STARTER, canTakePart, distance, interceptOrbit, isFeatureOpen, orbitSeedOf, partsVisible, prospectorHoldMult, starterAsteroidOrbit, travelExact,
  type Resources, type Vec3,
} from '@astera/rules';
import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import type { Clock } from '../../clock.js';
import type { Db, Tx } from '../../db/client.js';
import { starterEvents, starterGalaxies, starterSites, vesselMissions, vessels } from '../../db/schema.js';
import { publish, publishShard } from '../../stream/bus.js';
import { scheduleStarter } from '../../worker/starterQueue.js';
import { GameError } from '../planet.js';
import { vesselProvenance } from '../commandOrigin.js';
import { readHome, takeFromHome, writeHome } from './fleet.js';
import { markProgress } from './quiet.js';
import { starterPendingView } from './traffic.js';
import { progressOf, refuseLeft, vesselView, withVesselLock, type LockedVessel, type VesselRow } from './vessel.js';
import { assertFeatureOpen, inShips, mayTakePart, partSight, placeOf, takeFlightToRecall, type MissionRow } from './world.js';

type SiteRow = typeof starterSites.$inferSelect;

/** The client's rock id is a uuid in the alphabet its schema asks for. */
export const rockIdOf = (uuid: string): string => Buffer.from(uuid.replace(/-/g, ''), 'hex').toString('base64url');
function uuidOfRock(id: string): string | null {
  const hex = Buffer.from(id, 'base64url').toString('hex');
  if (hex.length !== 32) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const stockOf = (site: Pick<SiteRow, 'alloy' | 'crystal' | 'deuterium'>): number => site.alloy + site.crystal + site.deuterium;
const minutesSince = (from: Date, to: Date): number => (to.getTime() - from.getTime()) / 60_000;
const holdEach = (row: VesselRow): number => PROSPECTOR.hold * prospectorHoldMult(row.research);

function asteroidView(site: SiteRow, epoch: Date, now: Date) {
  const orbit = starterAsteroidOrbit(orbitSeedOf(site.id));
  const ore = stockOf(site);
  const appearsAt = minutesSince(epoch, site.createdAt);
  const expiresAt = site.expiresAt ? minutesSince(epoch, site.expiresAt) : appearsAt;
  return {
    id: rockIdOf(site.id),
    level: site.level,
    ore: site.stockFull,
    oreRemaining: ore,
    crystalShare: ore > 0 ? site.crystal / ore : 0,
    ...orbit,
    appearsAt,
    expiresAt,
    active: minutesSince(epoch, now) < expiresAt && ore > 0,
    isotopeRich: site.deuterium > 0,
    deuteriumShare: ore > 0 && site.deuterium > 0 ? site.deuterium / ore : null,
  };
}

const placeOfSite = (site: SiteRow): Vec3 => ({ x: site.x, y: site.y, z: site.z });

async function lockSite(tx: Tx, galaxyId: string, id: string, kinds: SiteRow['kind'][]): Promise<SiteRow | undefined> {
  const [site] = await tx.select().from(starterSites).where(and(eq(starterSites.id, id), eq(starterSites.starterGalaxyId, galaxyId), inArray(starterSites.kind, kinds)));
  return site;
}

/** What the map and the Mining sheet read, in the main game's shape. */
async function miningOf(q: Tx | Db, row: VesselRow, epoch: Date, now: Date) {
  const progress = progressOf(row);
  const fleetOpen = isFeatureOpen(progress, 'fleet');
  const sites = fleetOpen ? await q.select().from(starterSites).where(and(
    eq(starterSites.starterGalaxyId, row.starterGalaxyId),
    inArray(starterSites.kind, ['ASTEROID', 'WRECK', 'BATTLE_WRECK']),
    or(isNull(starterSites.expiresAt), gt(starterSites.expiresAt, now)),
  )) : [];
  const flights = await q.select().from(vesselMissions).where(and(eq(vesselMissions.ownerVesselId, row.id), eq(vesselMissions.kind, 'MINE'), inArray(vesselMissions.status, ['OUTBOUND', 'RETURNING'])));
  const salvage = isFeatureOpen(progress, 'salvage');
  const seesPart = await partSight(q, row);
  return {
    derrick: false,
    craftSpeed: STARTER.prospectorSpeed,
    craftHold: holdEach(row),
    derrickHold: 0,
    craftReadyAt: null,
    craftCooldowns: [],
    asteroids: sites.filter(site => site.kind === 'ASTEROID').map(site => asteroidView(site, epoch, now)).filter(rock => rock.active),
    nextFieldChangeAt: null,
    debris: sites.filter(site => salvage && site.kind !== 'ASTEROID' && (stockOf(site) > 0 || seesPart(site))).map(site => ({
      id: site.id, planetId: null, at: placeOfSite(site), alloy: site.alloy, crystal: site.crystal, deuterium: site.deuterium,
      minutesLeft: site.expiresAt ? minutesSince(now, site.expiresAt) : 10_000,
      ...(seesPart(site) ? { hasPart: true } : {}),
    })),
    runs: flights.map(flight => {
      const rock = sites.some(site => site.id === flight.targetSiteId && site.kind === 'ASTEROID');
      return {
      id: flight.id,
      targetKind: rock ? 'asteroid' as const : 'debris' as const,
      asteroidId: rock && flight.targetSiteId ? rockIdOf(flight.targetSiteId) : null,
      debrisFieldId: rock ? null : flight.targetSiteId,
      status: flight.status === 'OUTBOUND' ? 'outbound' as const : 'returning' as const,
      craft: flight.fleet.PROSPECTOR ?? 0,
      departAt: flight.departAt,
      arriveAt: flight.arriveAt,
      homeAt: flight.returnAt,
      intercept: { x: flight.toX, y: flight.toY, z: flight.toZ },
      minedAlloy: flight.cargo.alloy,
      minedCrystal: flight.cargo.crystal,
      minedDeuterium: flight.cargo.deuterium,
      };
    }),
    isotopes: [],
  };
}

export async function starterMiningView(db: Db, accountId: string, clock: Clock) {
  const [found] = await db.select({ row: vessels, epoch: starterGalaxies.epoch }).from(vessels)
    .innerJoin(starterGalaxies, eq(starterGalaxies.id, vessels.starterGalaxyId)).where(eq(vessels.accountId, accountId));
  if (!found) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);
  refuseLeft(found.row);
  return miningOf(db, found.row, found.epoch, clock.now());
}

async function sendCraft(tx: Tx, vessel: LockedVessel, clock: Clock, target: { site: SiteRow; rock: boolean; to: Vec3; arriveAt: Date }, craft: number) {
  const { left, flying } = takeFromHome(await readHome(tx, vessel.row.id), { PROSPECTOR: craft });
  await writeHome(tx, vessel.row.id, left);
  const from = placeOf(vessel.row);
  const [mission] = await tx.insert(vesselMissions).values({
    starterGalaxyId: vessel.row.starterGalaxyId, ownerVesselId: vessel.row.id, kind: 'MINE', targetSiteId: target.site.id,
    fromX: from.x, fromY: from.y, fromZ: from.z, toX: target.to.x, toY: target.to.y, toZ: target.to.z,
    fleet: flying.fleet, damage: flying.damage, departAt: vessel.now, arriveAt: target.arriveAt, ...vesselProvenance(vessel.now),
  }).returning();
  await scheduleStarter(tx, { starterGalaxyId: vessel.row.starterGalaxyId, kind: 'vessel_mission_arrival', refId: mission!.id, resolveAt: target.arriveAt });
  await publishShard(tx, vessel.row.starterGalaxyId, 'mining');
  const { pending } = await starterPendingView(tx, vessel.row, clock);
  return {
    runId: mission!.id,
    ...(target.rock ? { asteroidId: rockIdOf(target.site.id) } : {}),
    craft,
    arriveAt: target.arriveAt,
    flightMinutes: minutesSince(vessel.now, target.arriveAt),
    intercept: target.to,
    capacity: holdEach(vessel.row) * craft,
    mining: await miningOf(tx, vessel.row, vessel.epoch, vessel.now),
    pending,
    vessel: await vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal),
  };
}

export const launchVesselMining = (db: Db, accountId: string, asteroidId: string, craft: number, clock: Clock) =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    assertFeatureOpen(vessel.row, 'fleet');
    // First, because waking can move the ship: the rock and the route are read from where it stands now.
    await markProgress(tx, vessel, clock);
    const uuid = uuidOfRock(asteroidId);
    const site = uuid ? await lockSite(tx, vessel.row.starterGalaxyId, uuid, ['ASTEROID']) : undefined;
    if (!site) throw new GameError('NO_SUCH_ASTEROID', 'No such asteroid', 404);
    if (stockOf(site) <= 0) throw new GameError('ASTEROID_EMPTY', 'That rock has already been stripped', 409);
    const nowMinutes = minutesSince(vessel.epoch, vessel.now);
    const expires = site.expiresAt ? minutesSince(vessel.epoch, site.expiresAt) : nowMinutes;
    const hit = interceptOrbit(placeOf(vessel.row), STARTER.prospectorSpeed, starterAsteroidOrbit(orbitSeedOf(site.id)), expires, nowMinutes);
    if (!hit) throw new GameError('CANNOT_INTERCEPT', 'It will drift off before your craft could reach it', 409);
    const arriveAt = new Date(vessel.epoch.getTime() + hit.meetsAtMinutes * 60_000);
    return sendCraft(tx, vessel, clock, { site, rock: true, to: hit.at, arriveAt }, craft);
  });

export const launchVesselHarvest = (db: Db, accountId: string, fieldId: string, craft: number, clock: Clock) =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    assertFeatureOpen(vessel.row, 'salvage');
    await markProgress(tx, vessel, clock);
    const site = await lockSite(tx, vessel.row.starterGalaxyId, fieldId, ['WRECK', 'BATTLE_WRECK']);
    if (!site) throw new GameError('NO_SUCH_FIELD', 'No such field', 404);
    if (stockOf(site) <= 0 && !site.hasPart) throw new GameError('FIELD_EMPTY', 'Nothing left there', 409);
    const to = placeOfSite(site);
    const minutes = travelExact(distance(placeOf(vessel.row), to), STARTER.prospectorSpeed);
    return sendCraft(tx, vessel, clock, { site, rock: false, to, arriveAt: new Date(vessel.now.getTime() + minutes * 60_000) }, craft);
  });

export const recallVesselMining = (db: Db, accountId: string, runId: string, clock: Clock) =>
  withVesselLock(db, accountId, clock, async (tx, vessel) => {
    const [flight] = await tx.select().from(vesselMissions).where(and(eq(vesselMissions.id, runId), eq(vesselMissions.ownerVesselId, vessel.row.id), eq(vesselMissions.kind, 'MINE')));
    if (!flight) throw new GameError('MISSION_NOT_FOUND', 'No such run', 404);
    const refused = () => new GameError('NOT_RECALLABLE', 'That run can no longer turn back', 409);
    if (flight.status !== 'OUTBOUND' || flight.arriveAt <= vessel.now || !await takeFlightToRecall(tx, flight.id)) throw refused();
    const homeAt = new Date(vessel.now.getTime() + (vessel.now.getTime() - flight.departAt.getTime()));
    const share = (vessel.now.getTime() - flight.departAt.getTime()) / (flight.arriveAt.getTime() - flight.departAt.getTime());
    const claimed = await tx.update(vesselMissions).set({
      status: 'RETURNING', returnAt: homeAt, departAt: vessel.now, arriveAt: vessel.now,
      toX: flight.fromX + (flight.toX - flight.fromX) * share, toY: flight.fromY + (flight.toY - flight.fromY) * share, toZ: flight.fromZ + (flight.toZ - flight.fromZ) * share,
    }).where(and(eq(vesselMissions.id, flight.id), eq(vesselMissions.status, 'OUTBOUND'))).returning({ id: vesselMissions.id });
    if (claimed.length === 0) throw refused();
    await tx.update(starterEvents).set({ status: 'done', claimedAt: null }).where(and(eq(starterEvents.refId, flight.id), eq(starterEvents.kind, 'vessel_mission_arrival'), inArray(starterEvents.status, ['pending', 'processing'])));
    await scheduleStarter(tx, { starterGalaxyId: flight.starterGalaxyId, kind: 'vessel_mission_return', refId: flight.id, resolveAt: homeAt });
    await publishShard(tx, flight.starterGalaxyId, 'mining');
    const { pending } = await starterPendingView(tx, vessel.row, clock);
    return { runId: flight.id, homeAt, mining: await miningOf(tx, vessel.row, vessel.epoch, vessel.now), pending, vessel: await vesselView(tx, vessel.row, vessel.epoch, vessel.galaxyOrdinal) };
  });

const takeShare = (site: SiteRow, room: number): Resources => {
  const held = stockOf(site);
  const lifted = Math.min(held, room);
  if (held <= 0) return { alloy: 0, crystal: 0, deuterium: 0 };
  return { alloy: site.alloy * (lifted / held), crystal: site.crystal * (lifted / held), deuterium: site.deuterium * (lifted / held) };
};

/** A craft arrives. Whatever is there goes to whoever arrives first, under the place's own lock. */
export async function resolveMiningLanding(tx: Tx, mission: MissionRow, clock: Clock): Promise<void> {
  if (!mission.ownerVesselId || !mission.targetSiteId) return;
  await inShips(tx, [mission.ownerVesselId], clock, async (_, ships) => {
    const owner = ships.get(mission.ownerVesselId!);
    const [site] = await tx.select().from(starterSites).where(eq(starterSites.id, mission.targetSiteId!)).for('update');
    const now = clock.now();
    const cargo = owner && site ? takeShare(site, holdEach(owner.row) * (mission.fleet.PROSPECTOR ?? 0)) : { alloy: 0, crystal: 0, deuterium: 0 };
    const carriesPart = Boolean(owner && site && site.hasPart && partsVisible(progressOf(owner.row)) && canTakePart(owner.row.parts) && await mayTakePart(tx, owner.row));
    if (site) {
      const left = stockOf(site) - cargo.alloy - cargo.crystal - cargo.deuterium;
      const emptied = left <= 0.0001;
      await tx.update(starterSites).set({
        alloy: site.alloy - cargo.alloy, crystal: site.crystal - cargo.crystal, deuterium: site.deuterium - cargo.deuterium,
        hasPart: site.hasPart && !carriesPart,
        ...(emptied && site.kind === 'WRECK' && !site.respawnAt ? { respawnAt: new Date(now.getTime() + STARTER.sites.wrecks.respawnMinutes * 60_000) } : {}),
      }).where(eq(starterSites.id, site.id));
    }
    const homeAt = new Date(mission.arriveAt.getTime() + travelExact(distance({ x: mission.toX, y: mission.toY, z: mission.toZ }, { x: mission.fromX, y: mission.fromY, z: mission.fromZ }), STARTER.prospectorSpeed * PROSPECTOR.returnSpeedFactor) * 60_000);
    const claimed = await tx.update(vesselMissions).set({ status: 'RETURNING', returnAt: homeAt, cargo, carriesPart })
      .where(and(eq(vesselMissions.id, mission.id), eq(vesselMissions.status, 'OUTBOUND'))).returning({ id: vesselMissions.id });
    if (claimed.length === 0) return;
    await scheduleStarter(tx, { starterGalaxyId: mission.starterGalaxyId, kind: 'vessel_mission_return', refId: mission.id, resolveAt: homeAt });
    await publishShard(tx, mission.starterGalaxyId, 'mining');
    if (mission.ownerVesselId) await publish(tx, mission.ownerVesselId, 'private:vessel-sight');
  });
}

