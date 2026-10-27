import { and, desc, eq, gt, isNotNull } from 'drizzle-orm';
import type { Queryable } from '../db/client.js';
import { arenaAdmiralLegs, arenaAdmirals, clanSupportWaves, missions, monuments, monumentWaves, pirateRaids, planets } from '../db/schema.js';

interface Point { x: number; y: number; z: number }
export interface HomewardPath { from: Point; to: Point; departAt: string; arriveAt: string }

/**
 * THE COMMANDER SHIP FLYING HOME ALONE (Y9, doc 23): its fleet was lost, or stayed in a monument.
 * There is no flight row for it, so the way is read off the flight it escorted: from where that
 * flight stood when the ship turned (the battle, or a point on the route for a wave lost on the
 * way), back to the world it left. Owner-only: it is read for the asking commander's own ship.
 */
export async function admiralHomewardPath(q: Queryable, playerId: string, now: Date): Promise<HomewardPath | null> {
  const [task] = await q.select({ id: arenaAdmirals.id, departAt: arenaAdmirals.homeDepartAt, arriveAt: arenaAdmirals.finishedAt }).from(arenaAdmirals)
    .where(and(eq(arenaAdmirals.playerId, playerId), eq(arenaAdmirals.status, 'returned'), isNotNull(arenaAdmirals.homeDepartAt), gt(arenaAdmirals.finishedAt, now)))
    .orderBy(desc(arenaAdmirals.finishedAt)).limit(1);
  if (!task?.departAt || !task.arriveAt) return null;
  const [leg] = await q.select({ kind: arenaAdmiralLegs.kind, refId: arenaAdmiralLegs.refId }).from(arenaAdmiralLegs)
    .where(and(eq(arenaAdmiralLegs.admiralId, task.id), eq(arenaAdmiralLegs.finishedAt, task.arriveAt))).limit(1);
  const flight = leg ? await escorted(q, leg.kind, leg.refId) : null;
  if (!flight) return null;
  const span = (flight.arriveAt?.getTime() ?? 0) - flight.departAt.getTime();
  const t = span <= 0 ? 1 : Math.min(1, Math.max(0, (task.departAt.getTime() - flight.departAt.getTime()) / span));
  const from = { x: flight.home.x + (flight.target.x - flight.home.x) * t, y: flight.home.y + (flight.target.y - flight.home.y) * t,
    z: flight.home.z + (flight.target.z - flight.home.z) * t };
  return { from, to: flight.home, departAt: task.departAt.toISOString(), arriveAt: task.arriveAt.toISOString() };
}

const at = (row: Point | undefined): Point | null => row ? { x: row.x, y: row.y, z: row.z } : null;
const world = async (q: Queryable, id: string): Promise<Point | null> =>
  at((await q.select({ x: planets.x, y: planets.y, z: planets.z }).from(planets).where(eq(planets.id, id)))[0]);

/** The escorted flight's two ends and its outbound clock. */
async function escorted(q: Queryable, kind: string, id: string): Promise<{ home: Point; target: Point; departAt: Date; arriveAt: Date | null } | null> {
  const ends = async (homeId: string, target: Point | null, departAt: Date, arriveAt: Date | null) => {
    const home = await world(q, homeId);
    return home && target ? { home, target, departAt, arriveAt } : null;
  };
  if (kind === 'mission') {
    const [m] = await q.select().from(missions).where(eq(missions.id, id));
    return m?.targetPlanetId ? ends(m.originPlanetId, await world(q, m.targetPlanetId), m.departAt, m.arriveAt) : null;
  }
  if (kind === 'pirate') {
    const [r] = await q.select().from(pirateRaids).where(eq(pirateRaids.id, id));
    return r ? ends(r.planetId, { x: r.interceptX, y: r.interceptY, z: r.interceptZ }, r.departAt, r.arriveAt) : null;
  }
  if (kind === 'defence') {
    const [w] = await q.select().from(clanSupportWaves).where(eq(clanSupportWaves.id, id));
    return w ? ends(w.originPlanetId, await world(q, w.hostPlanetId), w.sentAt, w.arriveAt) : null;
  }
  if (kind === 'monument') {
    const [w] = await q.select().from(monumentWaves).where(eq(monumentWaves.id, id));
    const [m] = w ? await q.select({ x: monuments.x, y: monuments.y, z: monuments.z }).from(monuments).where(eq(monuments.id, w.monumentId)) : [];
    return w ? ends(w.originPlanetId, at(m), w.sentAt, w.arriveAt) : null;
  }
  return null;
}
