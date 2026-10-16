import { eq } from 'drizzle-orm';
import { maxRadarRange, radarRange, sphereEntryFraction } from '@astera/rules';
import type { Tx } from '../db/client.js';
import { planets, radiationBombFlights } from '../db/schema.js';
import { schedule } from '../worker/queue.js';
import { instrumentLevels, levelOf } from './intel.js';
import { notify } from './notifications.js';
import { lockSeason } from './planet.js';
import { lockWorlds } from './ownership.js';
import { publish } from '../stream/bus.js';

type Flight = typeof radiationBombFlights.$inferSelect;
const entryAt = (flight: Flight, centre: typeof flight.targetPosition, reach: number) => {
  if (reach <= 0) return null;
  const fraction = sphereEntryFraction(flight.originPosition, flight.targetPosition, centre, reach);
  return fraction === null ? null : new Date(Math.ceil(flight.departAt.getTime()
    + fraction * (flight.arriveAt.getTime() - flight.departAt.getTime())));
};
const arm = (tx: Tx, flight: Flight, at: Date) => schedule(tx, {seasonId:flight.seasonId,kind:'radar_warning',
  refId:flight.id,dedupeKey:`radiation-bomb-warning:${flight.id}:${String(at.getTime())}`,resolveAt:at});

/** Uses the existing generic warning clock; an upgrade wakes this same live projection. */
export async function scheduleBombWarning(tx: Tx, flight: Flight): Promise<void> {
  if (!flight.targetPlanetId) return;
  const first = entryAt(flight, flight.targetPosition, maxRadarRange());
  if (first) await arm(tx, flight, first);
}

/** The flight and target world are already locked. One addressed warning, no route disclosure. */
export async function warnRadiationBombInTx(tx: Tx, flight: Flight, now: Date): Promise<void> {
  if (flight.status !== 'OUTBOUND' || !flight.targetPlanetId || now >= flight.arriveAt) return;
  const [target] = await tx.select().from(planets).where(eq(planets.id,flight.targetPlanetId));
  if (!target?.controllerPlayerId) return;
  const levels = await instrumentLevels(tx,[target.id]);
  const reach = radarRange(levelOf(levels,target.id,'RADAR'));
  const crossing = entryAt(flight,target,reach);
  if (!crossing) return;
  if (crossing > now) { await arm(tx,flight,crossing);return; }
  await notify(tx,{playerId:target.controllerPlayerId,kind:'incoming_fleet',refId:flight.id,at:now,
    payload:{arriveAt:flight.arriveAt.toISOString(),etaMinutes:Math.max(0,Math.round((flight.arriveAt.getTime()-now.getTime())/60000)),
      targetPlanetId:target.id,targetPlanetName:target.name,range:reach,contactId:flight.id}});
  await publish(tx,target.controllerPlayerId,'fleet');
}

export async function warnRadiationBombById(tx: Tx, id: string, now: Date): Promise<void> {
  const [identity] = await tx.select().from(radiationBombFlights).where(eq(radiationBombFlights.id,id));
  if (identity?.status !== 'OUTBOUND' || !identity.targetPlanetId) return;
  const season = await lockSeason(tx,identity.seasonId,false);
  if (season.status !== 'live') return;
  await lockWorlds(tx,[identity.originPlanetId,identity.targetPlanetId],{requireLive:false});
  const [flight] = await tx.select().from(radiationBombFlights).where(eq(radiationBombFlights.id,id)).for('update');
  if (flight) await warnRadiationBombInTx(tx,flight,now);
}
