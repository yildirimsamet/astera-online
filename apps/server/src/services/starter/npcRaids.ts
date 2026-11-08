import { STARTER, distance, fleetCount, fleetSpeed, garrisonOf, moduleStage, normalizeHpDamage, seededFrom, travelExact, vesselSphere, type Fleet, type Vec3 } from '@astera/rules';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Tx } from '../../db/client.js';
import { vesselBotState, vesselMissions, vesselUnits, type starterGalaxies } from '../../db/schema.js';
import { publishShard } from '../../stream/bus.js';
import { scheduleStarter } from '../../worker/starterQueue.js';
import { warnInReach } from './fleet.js';
import { progressOf, type VesselRow } from './vessel.js';
import { placeOf } from './world.js';

const HERE_WITHIN_MS = 10 * 60_000;
/** Far enough that a working radar has its minutes to speak. */
const APPROACH = 1500;
/** Pirates are an event here, not a tax. */
const RAID_EVERY_HOURS = 18;
const SCOUT: Fleet = { DART: 1 };
/** Just outside the first radar's ring: its return has to reach the player inside the first session (N12). */
const SCOUT_APPROACH = STARTER.radar[1] + 120;
const FIRST_RAID_AT_LEAST: Fleet = { DART: 1 };
/** How close a scout comes before it turns away: near enough to be watched, never at the hull. */
export const SCOUT_STANDOFF = 200;
/** Two different fleets, so a first look shows that there is more than one kind of thing out there. */
const PASSERS: readonly Fleet[] = [{ PIKE: 3, WARDEN: 1 }, { COURIER: 2, DART: 2 }];
/** Long enough to be watched while the player looks around the ring. */
const PASSING_MINUTES = 4;

type Galaxy = typeof starterGalaxies.$inferSelect;

function launch(tx: Tx, galaxy: Galaxy, ship: VesselRow, kind: 'SCOUT' | 'PIRATE', fleet: Fleet, now: Date) {
  const to = placeOf(ship);
  const random = seededFrom(ship.id, now.getTime());
  const angle = random() * 2 * Math.PI;
  const span = kind === 'SCOUT' ? SCOUT_APPROACH : APPROACH;
  const from: Vec3 = { x: to.x + Math.cos(angle) * span, y: to.y, z: to.z + Math.sin(angle) * span };
  if (kind === 'SCOUT') {
    const short = (span - SCOUT_STANDOFF) / span;
    to.x = from.x + (to.x - from.x) * short;
    to.z = from.z + (to.z - from.z) * short;
  }
  const arriveAt = new Date(now.getTime() + travelExact(distance(from, to), fleetSpeed(fleet, {})) * 60_000);
  return tx.insert(vesselMissions).values({
    starterGalaxyId: galaxy.id, ownerVesselId: null, kind, targetVesselId: ship.id,
    fromX: from.x, fromY: from.y, fromZ: from.z, toX: to.x, toY: to.y, toZ: to.z,
    fleet, damage: normalizeHpDamage(fleet, []), departAt: now, arriveAt,
  }).returning();
}

/**
 * THE FIRST LOOK THROUGH THE TELESCOPE (owner playtest 2026-11-08): two fleets crossing the ring, so
 * the player sees what it is for. They belong to nobody, are bound for nowhere and fight nobody; a
 * contact never says whose it is, so to anyone watching they are traffic like any other.
 */
export async function launchPassersBy(tx: Tx, ship: VesselRow, now: Date): Promise<void> {
  const [crewless] = await tx.select({ id: vesselBotState.vesselId }).from(vesselBotState).where(eq(vesselBotState.vesselId, ship.id));
  if (crewless) return;
  const at = placeOf(ship);
  const reach = vesselSphere(at, 1, 0, ship.id).identify;
  const random = seededFrom(ship.id, now.getTime());
  const first = random() * 2 * Math.PI;
  const arriveAt = new Date(now.getTime() + PASSING_MINUTES * 60_000);
  for (const [index, fleet] of PASSERS.entries()) {
    const angle = first + index * 2.2, side = index === 0 ? 0.35 : -0.3;
    const across = { x: Math.cos(angle), z: Math.sin(angle) }, beside = { x: -across.z, z: across.x };
    const leg = (share: number): Vec3 => ({ x: at.x + reach * (across.x * share + beside.x * side), y: at.y, z: at.z + reach * (across.z * share + beside.z * side) });
    const from = leg(0.8), to = leg(-1.3);
    const [mission] = await tx.insert(vesselMissions).values({
      starterGalaxyId: ship.starterGalaxyId, ownerVesselId: null, kind: 'PASSING',
      fromX: from.x, fromY: from.y, fromZ: from.z, toX: to.x, toY: to.y, toZ: to.z,
      fleet, damage: normalizeHpDamage(fleet, []), departAt: now, arriveAt,
    }).returning();
    await scheduleStarter(tx, { starterGalaxyId: ship.starterGalaxyId, kind: 'vessel_mission_arrival', refId: mission!.id, resolveAt: arriveAt });
  }
  await publishShard(tx, ship.starterGalaxyId, 'launch');
}

/**
 * THE FIRST THREATS, IN ORDER, AND ONLY TO SOMEONE WHO IS THERE. Plan §3.5. Radar first: a scout comes
 * and looks, and the player asks what would have happened. It follows the player out (owner
 * 2026-11-08, N2): a ship that has flown nothing of its own is left alone. Aegis next: the first real
 * raid, as large as the fleet it meets. Then rarely.
 */
export async function launchPirates(tx: Tx, galaxy: Galaxy, ships: readonly VesselRow[], now: Date): Promise<void> {
  const here = ships.filter(ship => now.getTime() - ship.lastSeenAt.getTime() <= HERE_WITHIN_MS);
  for (const ship of here) {
    const progress = progressOf(ship);
    if (moduleStage(progress, 'RADAR') < 1) continue;
    const flights = await tx.select({ kind: vesselMissions.kind, status: vesselMissions.status, departAt: vesselMissions.departAt }).from(vesselMissions).where(and(
      eq(vesselMissions.targetVesselId, ship.id), inArray(vesselMissions.kind, ['SCOUT', 'PIRATE']),
    )).orderBy(desc(vesselMissions.departAt));
    if (flights.some(flight => flight.status === 'OUTBOUND' || flight.status === 'RETURNING')) continue;
    // Every row a ship owns is its own launch; pirates and scouts belong to nobody.
    const [ventured] = await tx.select({ id: vesselMissions.id }).from(vesselMissions).where(eq(vesselMissions.ownerVesselId, ship.id)).limit(1);
    if (!ventured) continue;

    let mission: Awaited<ReturnType<typeof launch>>[number] | undefined;
    if (!flights.some(flight => flight.kind === 'SCOUT')) {
      [mission] = await launch(tx, galaxy, ship, 'SCOUT', SCOUT, now);
    } else if (moduleStage(progress, 'AEGIS') >= 1) {
      const last = flights.find(flight => flight.kind === 'PIRATE');
      const due = !last || now.getTime() - last.departAt.getTime() >= RAID_EVERY_HOURS * 3_600_000;
      if (!due) continue;
      const units = await tx.select().from(vesselUnits).where(and(eq(vesselUnits.vesselId, ship.id), eq(vesselUnits.location, 'HOME')));
      const home: Fleet = {};
      for (const unit of units) if (unit.count > 0) home[unit.hull] = unit.count;
      const line = garrisonOf(home, {});
      // A match in numbers, not a slaughter: Aegis is what is being taught.
      const count = Math.max(fleetCount(FIRST_RAID_AT_LEAST), Math.min(fleetCount(line), STARTER.hangarRoom[0]));
      [mission] = await launch(tx, galaxy, ship, 'PIRATE', { DART: count }, now);
    }
    if (!mission) continue;
    await scheduleStarter(tx, { starterGalaxyId: galaxy.id, kind: 'vessel_mission_arrival', refId: mission.id, resolveAt: mission.arriveAt });
    await warnInReach(tx, mission, ship, now);
    await publishShard(tx, galaxy.id, 'launch');
  }
}

